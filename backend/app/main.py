import asyncio
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import TradeRequest, BacktestRequest, TradingStrategy
from .trading_engine import engine
from .backtester import run_backtest
from .data_fetcher import get_historical_data, get_current_price, get_stock_info
from .strategies import get_all_strategies, get_strategy

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ws_clients: set[WebSocket] = set()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Trading Agent API started")
    yield
    for session in engine.sessions.values():
        session.stop()
    logger.info("Trading Agent API stopped")


app = FastAPI(title="Trading Agent API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast(data: dict):
    dead = set()
    for ws in ws_clients:
        try:
            await ws.send_json(data)
        except Exception:
            dead.add(ws)
    ws_clients -= dead


# ── REST endpoints ──────────────────────────────────────────────

@app.get("/api/strategies")
async def list_strategies():
    return get_all_strategies()


@app.get("/api/price/{symbol}")
async def price(symbol: str):
    try:
        return get_current_price(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/stock-info/{symbol}")
async def stock_info(symbol: str):
    try:
        return get_stock_info(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/history/{symbol}")
async def history(symbol: str, period: str = "6mo", interval: str = "1d"):
    try:
        df = get_historical_data(symbol.upper(), period=period, interval=interval)
        records = []
        for idx, row in df.iterrows():
            records.append({
                "date": idx.strftime("%Y-%m-%d"),
                "open": round(row["Open"], 2),
                "high": round(row["High"], 2),
                "low": round(row["Low"], 2),
                "close": round(row["Close"], 2),
                "volume": int(row["Volume"]),
            })
        return records
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/indicators/{symbol}")
async def indicators(symbol: str, strategy: str = "sma_crossover"):
    try:
        df = get_historical_data(symbol.upper(), period="6mo")
        strat = get_strategy(strategy)
        return strat.get_indicators(df)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/trade/start")
async def start_trading(req: TradeRequest):
    try:
        session_id = engine.create_session(
            symbol=req.symbol.upper(),
            strategy_name=req.strategy.value,
            initial_capital=req.initial_capital,
            risk_per_trade=req.risk_per_trade,
            on_update=broadcast,
        )
        await engine.start_session(session_id)
        return {"session_id": session_id, "status": "running"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/trade/stop/{session_id}")
async def stop_trading(session_id: str):
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    engine.stop_session(session_id)
    return {"session_id": session_id, "status": "stopped"}


@app.get("/api/sessions")
async def get_sessions():
    return engine.get_all_sessions()


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.to_dict()


@app.get("/api/session/{session_id}/trades")
async def get_session_trades(session_id: str):
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return [t.model_dump() for t in session.trades]


@app.get("/api/session/{session_id}/equity")
async def get_equity_history(session_id: str):
    session = engine.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.equity_history


@app.post("/api/backtest")
async def backtest(req: BacktestRequest):
    try:
        result = run_backtest(
            symbol=req.symbol.upper(),
            strategy_name=req.strategy.value,
            start_date=req.start_date,
            end_date=req.end_date,
            initial_capital=req.initial_capital,
        )
        return result.model_dump()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── WebSocket ───────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.add(ws)
    logger.info(f"WebSocket client connected ({len(ws_clients)} total)")
    try:
        while True:
            data = await ws.receive_text()
            msg = json.loads(data)
            if msg.get("type") == "ping":
                await ws.send_json({"type": "pong"})
    except WebSocketDisconnect:
        ws_clients.discard(ws)
        logger.info(f"WebSocket client disconnected ({len(ws_clients)} total)")
    except Exception:
        ws_clients.discard(ws)
