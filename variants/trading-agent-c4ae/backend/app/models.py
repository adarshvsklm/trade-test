from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


class TradingStrategy(str, Enum):
    SMA_CROSSOVER = "sma_crossover"
    RSI_MOMENTUM = "rsi_momentum"
    MACD_SIGNAL = "macd_signal"
    BOLLINGER_BANDS = "bollinger_bands"
    MEAN_REVERSION = "mean_reversion"
    ENSEMBLE = "ensemble"


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(str, Enum):
    PENDING = "pending"
    FILLED = "filled"
    CANCELLED = "cancelled"


class TradeRequest(BaseModel):
    symbol: str = Field(default="AAPL", description="Stock ticker symbol")
    strategy: TradingStrategy = Field(default=TradingStrategy.SMA_CROSSOVER)
    initial_capital: float = Field(default=10000.0, ge=100)
    risk_per_trade: float = Field(default=0.02, ge=0.001, le=0.1)


class BacktestRequest(BaseModel):
    symbol: str = Field(default="AAPL")
    strategy: TradingStrategy = Field(default=TradingStrategy.SMA_CROSSOVER)
    start_date: str = Field(default="2024-01-01")
    end_date: str = Field(default="2025-01-01")
    initial_capital: float = Field(default=10000.0, ge=100)


class Trade(BaseModel):
    id: str
    timestamp: str
    symbol: str
    side: OrderSide
    price: float
    quantity: float
    total: float
    strategy: str
    pnl: Optional[float] = None


class PortfolioState(BaseModel):
    cash: float
    positions: dict
    total_value: float
    total_pnl: float
    total_pnl_pct: float
    trade_count: int
    win_rate: float
    sharpe_ratio: float
    max_drawdown: float


class BacktestResult(BaseModel):
    strategy: str
    symbol: str
    start_date: str
    end_date: str
    initial_capital: float
    final_value: float
    total_return_pct: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    sharpe_ratio: float
    max_drawdown: float
    avg_trade_pnl: float
    best_trade: float
    worst_trade: float
    equity_curve: list
    trades: list
    buy_hold_return_pct: float
