"""Trading strategies.

Each strategy implements `generate_signals(df) -> pd.Series` returning a
target position in {-1, 0, 1} for each bar (1 = long, -1 = short, 0 = flat).

Strategies are intentionally simple/transparent so they can be reasoned about,
backtested, and combined. The framework supports adding ML-based or more
sophisticated strategies behind the same interface.
"""

from .base import Strategy, STRATEGY_REGISTRY, register, list_strategies, get_strategy
from . import sma_crossover, rsi_reversion, macd_trend, breakout, momentum, ensemble  # noqa: F401

__all__ = [
    "Strategy",
    "STRATEGY_REGISTRY",
    "register",
    "list_strategies",
    "get_strategy",
]
