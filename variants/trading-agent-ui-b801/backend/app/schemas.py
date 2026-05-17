from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class ModelInfo(BaseModel):
    id: str
    name: str
    description: str


class BacktestRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=12)
    model_id: str
    start: date
    end: date
    initial_cash: float = Field(100_000, ge=1_000, le=10_000_000)


class TradeRecord(BaseModel):
    time: str
    side: Literal["buy", "sell"]
    price: float
    shares: float
    notional: float
    reason: str


class EquityPoint(BaseModel):
    time: str
    equity: float
    cash: float
    position_value: float


class BacktestMetrics(BaseModel):
    total_return_pct: float
    max_drawdown_pct: float
    win_rate_pct: float | None
    trades: int
    sharpe_approx: float | None


class BacktestResponse(BaseModel):
    symbol: str
    model_id: str
    metrics: BacktestMetrics
    equity_curve: list[EquityPoint]
    trades: list[TradeRecord]


class CreateSessionRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=12)
    model_id: str
    initial_cash: float = Field(100_000, ge=1_000, le=10_000_000)
    poll_seconds: int = Field(30, ge=10, le=300)


class SessionState(BaseModel):
    session_id: str
    symbol: str
    model_id: str
    status: Literal["created", "running", "stopped", "error"]
    initial_cash: float
    cash: float
    shares: float
    last_price: float | None
    market_value: float
    equity: float
    realized_pnl: float
    unrealized_pnl: float
    total_pnl: float
    total_pnl_pct: float
    trades: list[TradeRecord]
    last_signal: str
    last_update: str | None
    error: str | None = None
    poll_seconds: int
