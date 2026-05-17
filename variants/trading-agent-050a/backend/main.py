import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import (
    BacktestRequest,
    StrategyType,
    TradingConfig,
)
from strategies import STRATEGY_MAP
from trading_engine import (
    Backtester,
    PaperTradingEngine,
    fetch_market_data,
    get_quote,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

engine: Optional[PaperTradingEngine] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Trading Agent API started")
    yield
    global engine
    if engine and engine.is_running:
        await engine.stop()
    logger.info("Trading Agent API stopped")


app = FastAPI(title="Trading Agent API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/strategies")
async def list_strategies():
    return [
        {
            "id": s.value,
            "name": s.value.replace("_", " ").title(),
            "description": _strategy_desc(s),
        }
        for s in StrategyType
    ]


def _strategy_desc(s: StrategyType) -> str:
    descs = {
        StrategyType.SMA_CROSSOVER: "Trades based on short/long Simple Moving Average crossovers. Buys when short SMA crosses above long SMA, sells on the opposite.",
        StrategyType.RSI: "Uses the Relative Strength Index to detect overbought (>70) and oversold (<30) conditions for trade signals.",
        StrategyType.MACD: "Generates signals from MACD line and signal line crossovers, measuring momentum shifts.",
        StrategyType.BOLLINGER_BANDS: "Trades based on price touching Bollinger Band boundaries. Buys at lower band, sells at upper band.",
        StrategyType.COMBINED: "Ensemble approach using majority vote from SMA, RSI, MACD, and Bollinger Bands strategies.",
    }
    return descs.get(s, "")


@app.get("/api/quote/{symbol}")
async def quote(symbol: str):
    try:
        return get_quote(symbol.upper())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/market-data/{symbol}")
async def market_data(symbol: str, period: str = "6mo"):
    try:
        df = fetch_market_data(symbol.upper(), period=period)
        data = []
        for idx, row in df.iterrows():
            data.append({
                "date": idx.strftime("%Y-%m-%d"),
                "open": round(row["Open"], 2),
                "high": round(row["High"], 2),
                "low": round(row["Low"], 2),
                "close": round(row["Close"], 2),
                "volume": int(row["Volume"]) if not isinstance(row["Volume"], float) or not __import__("math").isnan(row["Volume"]) else 0,
            })
        return {"symbol": symbol.upper(), "data": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/analysis/{symbol}")
async def analyze(symbol: str, strategy: StrategyType = StrategyType.SMA_CROSSOVER):
    try:
        df = fetch_market_data(symbol.upper(), period="6mo")
        strat = STRATEGY_MAP[strategy]()
        signal = strat.get_current_signal(df)
        signal_df = strat.generate_signals(df)

        indicators = []
        for idx, row in signal_df.tail(60).iterrows():
            point = {"date": idx.strftime("%Y-%m-%d"), "close": round(row["Close"], 2)}
            for col in signal_df.columns:
                if col not in ["Open", "High", "Low", "Close", "Volume", "Dividends", "Stock Splits", "signal"]:
                    val = row[col]
                    if isinstance(val, (int, float)) and not __import__("math").isnan(val):
                        point[col] = round(val, 4)
            indicators.append(point)

        return {
            "symbol": symbol.upper(),
            "strategy": strategy.value,
            "current_signal": signal,
            "indicator_data": indicators,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/trading/start")
async def start_trading(config: TradingConfig):
    global engine
    if engine and engine.is_running:
        await engine.stop()
    engine = PaperTradingEngine(config)
    await engine.start()
    return {"status": "started", "config": config.model_dump()}


@app.post("/api/trading/stop")
async def stop_trading():
    global engine
    if engine and engine.is_running:
        await engine.stop()
        return {"status": "stopped", **engine.get_status()}
    return {"status": "not_running"}


@app.get("/api/trading/status")
async def trading_status():
    global engine
    if engine:
        return engine.get_status()
    return {
        "is_running": False,
        "symbol": "",
        "strategy": "",
        "portfolio": {"cash": 0, "holdings": {}, "total_value": 0, "unrealized_pnl": 0, "realized_pnl": 0},
        "recent_trades": [],
        "signals": {},
        "current_price": 0,
    }


@app.post("/api/backtest")
async def run_backtest(request: BacktestRequest):
    try:
        backtester = Backtester()
        result = backtester.run(request)
        return result.model_dump()
    except Exception as e:
        logger.error(f"Backtest error: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/watchlist")
async def watchlist():
    symbols = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "SPY"]
    results = []
    for sym in symbols:
        try:
            results.append(get_quote(sym))
        except Exception:
            results.append({"symbol": sym, "price": 0, "change": 0, "change_pct": 0})
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
