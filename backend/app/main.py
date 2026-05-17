"""FastAPI surface for the trading agent."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .backtest import run_backtest
from .data import get_ohlcv, latest_price
from .strategies import list_strategies
from .trader import TRADER

app = FastAPI(
    title="Trading Agent API",
    description="Backtesting and paper-trading agent with multiple strategies.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----------------------- schemas -----------------------

class BacktestRequest(BaseModel):
    symbol: str = Field(default="AAPL")
    strategy: str = Field(default="sma_crossover")
    params: Dict[str, Any] = Field(default_factory=dict)
    period_days: int = Field(default=365, ge=30, le=3650)
    interval: str = Field(default="1d")
    initial_capital: float = Field(default=10_000.0, gt=0)
    fee_bps: float = Field(default=5.0, ge=0, le=200)
    allow_short: bool = True


class TraderConfig(BaseModel):
    symbol: Optional[str] = None
    strategy: Optional[str] = None
    params: Optional[Dict[str, Any]] = None
    interval_sec: Optional[float] = Field(default=None, gt=0.2, le=60)
    initial_capital: Optional[float] = Field(default=None, gt=0)
    allow_short: Optional[bool] = None
    fee_bps: Optional[float] = Field(default=None, ge=0, le=200)


# ----------------------- endpoints -----------------------

@app.get("/api/health")
def health() -> Dict[str, Any]:
    return {"status": "ok"}


@app.get("/api/strategies")
def strategies() -> List[Dict[str, Any]]:
    return list_strategies()


@app.get("/api/symbols")
def symbols() -> List[Dict[str, str]]:
    return [
        {"symbol": "AAPL", "name": "Apple Inc."},
        {"symbol": "MSFT", "name": "Microsoft Corp."},
        {"symbol": "GOOGL", "name": "Alphabet Inc."},
        {"symbol": "AMZN", "name": "Amazon.com Inc."},
        {"symbol": "NVDA", "name": "NVIDIA Corp."},
        {"symbol": "TSLA", "name": "Tesla Inc."},
        {"symbol": "META", "name": "Meta Platforms"},
        {"symbol": "SPY", "name": "S&P 500 ETF"},
        {"symbol": "QQQ", "name": "Nasdaq 100 ETF"},
        {"symbol": "BTC-USD", "name": "Bitcoin / USD"},
        {"symbol": "ETH-USD", "name": "Ethereum / USD"},
    ]


@app.get("/api/quote/{symbol}")
def quote(symbol: str) -> Dict[str, Any]:
    try:
        price = latest_price(symbol)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"symbol": symbol.upper(), "price": price}


@app.get("/api/history/{symbol}")
def history(symbol: str, period_days: int = 180, interval: str = "1d") -> Dict[str, Any]:
    df = get_ohlcv(symbol, period_days=period_days, interval=interval)
    # Downsample for client.
    n = len(df)
    step = max(1, n // 400)
    points = []
    for i in range(0, n, step):
        row = df.iloc[i]
        points.append({
            "t": df.index[i].isoformat(),
            "o": float(row["Open"]),
            "h": float(row["High"]),
            "l": float(row["Low"]),
            "c": float(row["Close"]),
            "v": float(row["Volume"]),
        })
    return {"symbol": symbol.upper(), "points": points}


@app.post("/api/backtest")
def backtest(req: BacktestRequest) -> Dict[str, Any]:
    try:
        df = get_ohlcv(req.symbol, period_days=req.period_days, interval=req.interval)
        result = run_backtest(
            df,
            symbol=req.symbol.upper(),
            strategy_key=req.strategy,
            params=req.params,
            initial_capital=req.initial_capital,
            fee_bps=req.fee_bps,
            allow_short=req.allow_short,
        )
        return result.to_dict()
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backtest failed: {e}")


@app.post("/api/trader/configure")
def trader_configure(cfg: TraderConfig) -> Dict[str, Any]:
    TRADER.configure(**cfg.model_dump(exclude_none=True))
    return TRADER.snapshot()


@app.post("/api/trader/start")
def trader_start(cfg: Optional[TraderConfig] = None) -> Dict[str, Any]:
    if cfg is not None:
        TRADER.configure(**cfg.model_dump(exclude_none=True))
    return TRADER.start()


@app.post("/api/trader/stop")
def trader_stop() -> Dict[str, Any]:
    return TRADER.stop()


@app.post("/api/trader/reset")
def trader_reset() -> Dict[str, Any]:
    return TRADER.reset()


@app.get("/api/trader/state")
def trader_state() -> Dict[str, Any]:
    return TRADER.snapshot()
