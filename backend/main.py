import asyncio
import json
import logging
from typing import Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from trading_agent import TradingAgent
from backtester import Backtester
from data_fetcher import fetch_ohlcv, fetch_ohlcv_range, fetch_ticker_info, fetch_current_price

from strategies.sma_crossover import SMACrossoverStrategy
from strategies.rsi_strategy import RSIStrategy
from strategies.macd_strategy import MACDStrategy
from strategies.bollinger_bands import BollingerBandsStrategy
from strategies.ml_strategy import MLStrategy
from strategies.mean_reversion import MeanReversionStrategy

logging.basicConfig(level=logging.INFO)

AVAILABLE_STRATEGIES: dict[str, Any] = {
    "sma_crossover": SMACrossoverStrategy,
    "rsi": RSIStrategy,
    "macd": MACDStrategy,
    "bollinger_bands": BollingerBandsStrategy,
    "ml_random_forest": MLStrategy,
    "mean_reversion": MeanReversionStrategy,
}

agent: TradingAgent | None = None
ws_clients: list[WebSocket] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(broadcast_loop())
    yield


app = FastAPI(title="Trading Agent API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def broadcast_loop():
    while True:
        if agent and ws_clients:
            state = agent.get_state()
            msg = json.dumps({"type": "state", "data": state})
            dead = []
            for ws in ws_clients:
                try:
                    await ws.send_text(msg)
                except Exception:
                    dead.append(ws)
            for d in dead:
                ws_clients.remove(d)
        await asyncio.sleep(5)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    ws_clients.append(ws)
    try:
        if agent:
            state = agent.get_state()
            await ws.send_text(json.dumps({"type": "state", "data": state}))
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in ws_clients:
            ws_clients.remove(ws)


@app.get("/api/strategies")
def list_strategies():
    return [
        {"id": k, "name": AVAILABLE_STRATEGIES[k]().name, "description": AVAILABLE_STRATEGIES[k]().description}
        for k in AVAILABLE_STRATEGIES
    ]


class StartRequest(BaseModel):
    symbol: str = "AAPL"
    strategy_id: str = "sma_crossover"
    initial_capital: float = 10000.0
    interval_seconds: int = 60


@app.post("/api/start")
async def start_trading(req: StartRequest):
    global agent

    if agent and agent.running:
        await agent.stop()

    if req.strategy_id not in AVAILABLE_STRATEGIES:
        raise HTTPException(status_code=400, detail=f"Unknown strategy: {req.strategy_id}")

    strategy = AVAILABLE_STRATEGIES[req.strategy_id]()
    agent = TradingAgent(
        symbol=req.symbol.upper(),
        strategy=strategy,
        initial_capital=req.initial_capital,
        interval_seconds=req.interval_seconds,
    )
    await agent.start()

    # Trigger first tick immediately
    asyncio.create_task(_immediate_tick(agent))

    return {"status": "started", "symbol": req.symbol.upper(), "strategy": strategy.name}


async def _immediate_tick(ag: TradingAgent):
    await asyncio.sleep(1)
    try:
        await ag._tick()
    except Exception as e:
        ag._log(f"Initial tick error: {e}")


@app.post("/api/stop")
async def stop_trading():
    global agent
    if not agent:
        raise HTTPException(status_code=400, detail="No agent running")
    await agent.stop()
    return {"status": "stopped"}


@app.get("/api/state")
def get_state():
    if not agent:
        return {"running": False}
    return agent.get_state()


class BacktestRequest(BaseModel):
    symbol: str = "AAPL"
    strategy_id: str = "sma_crossover"
    start_date: str = "2023-01-01"
    end_date: str = "2024-01-01"
    initial_capital: float = 10000.0
    interval: str = "1d"


@app.post("/api/backtest")
async def run_backtest(req: BacktestRequest):
    if req.strategy_id not in AVAILABLE_STRATEGIES:
        raise HTTPException(status_code=400, detail=f"Unknown strategy: {req.strategy_id}")

    strategy = AVAILABLE_STRATEGIES[req.strategy_id]()

    loop = asyncio.get_event_loop()
    df = await loop.run_in_executor(
        None,
        lambda: fetch_ohlcv_range(req.symbol.upper(), req.start_date, req.end_date, req.interval),
    )

    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for {req.symbol}")

    backtester = Backtester(strategy=strategy, initial_capital=req.initial_capital)
    results = backtester.run(df)
    return results


@app.get("/api/market-data/{symbol}")
async def get_market_data(symbol: str, period: str = "1mo", interval: str = "1d"):
    loop = asyncio.get_event_loop()
    df = await loop.run_in_executor(
        None, lambda: fetch_ohlcv(symbol.upper(), period=period, interval=interval)
    )
    if df.empty:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")

    records = []
    for ts, row in df.iterrows():
        records.append(
            {
                "date": str(ts)[:10],
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row.get("Volume", 0)),
            }
        )
    return {"symbol": symbol.upper(), "data": records}


@app.get("/api/ticker/{symbol}")
async def get_ticker_info(symbol: str):
    loop = asyncio.get_event_loop()
    try:
        info = await loop.run_in_executor(None, lambda: fetch_ticker_info(symbol.upper()))
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/price/{symbol}")
async def get_price(symbol: str):
    loop = asyncio.get_event_loop()
    price = await loop.run_in_executor(None, lambda: fetch_current_price(symbol.upper()))
    return {"symbol": symbol.upper(), "price": price}


@app.get("/api/health")
def health():
    return {"status": "ok"}
