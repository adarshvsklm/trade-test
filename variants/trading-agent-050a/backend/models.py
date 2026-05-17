from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class StrategyType(str, Enum):
    SMA_CROSSOVER = "sma_crossover"
    RSI = "rsi"
    MACD = "macd"
    BOLLINGER_BANDS = "bollinger_bands"
    COMBINED = "combined"


class TradeAction(str, Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class Trade(BaseModel):
    timestamp: datetime
    symbol: str
    action: TradeAction
    price: float
    quantity: float
    strategy: StrategyType
    pnl: float = 0.0
    portfolio_value: float = 0.0


class PortfolioState(BaseModel):
    cash: float
    holdings: dict[str, float]
    total_value: float
    unrealized_pnl: float
    realized_pnl: float


class TradingConfig(BaseModel):
    symbol: str = "AAPL"
    strategy: StrategyType = StrategyType.SMA_CROSSOVER
    initial_capital: float = 100000.0
    trade_size_pct: float = 0.1
    stop_loss_pct: float = 0.05
    take_profit_pct: float = 0.10


class BacktestRequest(BaseModel):
    symbol: str = "AAPL"
    strategy: StrategyType = StrategyType.SMA_CROSSOVER
    start_date: str = "2024-01-01"
    end_date: str = "2025-01-01"
    initial_capital: float = 100000.0
    trade_size_pct: float = 0.1


class BacktestResult(BaseModel):
    total_trades: int
    winning_trades: int
    losing_trades: int
    total_return_pct: float
    max_drawdown_pct: float
    sharpe_ratio: float
    final_portfolio_value: float
    initial_capital: float
    trades: list[Trade]
    equity_curve: list[dict]
    strategy: StrategyType
    symbol: str


class MarketData(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    symbol: str


class TradingStatus(BaseModel):
    is_running: bool
    symbol: str
    strategy: StrategyType
    portfolio: PortfolioState
    recent_trades: list[Trade]
    signals: dict
    market_data: Optional[dict] = None
