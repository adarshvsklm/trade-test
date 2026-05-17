import pandas as pd

from .base import Strategy, StrategyParam, register


def _signals(df: pd.DataFrame, p: dict) -> pd.Series:
    fast = int(p["fast"])
    slow = int(p["slow"])
    if fast >= slow:
        fast, slow = min(fast, slow - 1), max(slow, fast + 1)
    sma_fast = df["Close"].rolling(fast).mean()
    sma_slow = df["Close"].rolling(slow).mean()
    sig = (sma_fast > sma_slow).astype(int) - (sma_fast < sma_slow).astype(int)
    return sig


register(Strategy(
    key="sma_crossover",
    name="SMA Crossover",
    description=(
        "Classic trend-following: go long when the fast simple moving average is "
        "above the slow SMA, short when below. Robust on trending markets, "
        "lags in choppy ones."
    ),
    params=[
        StrategyParam("fast", "int", 20, 2, 100, "Fast SMA window (bars)"),
        StrategyParam("slow", "int", 50, 5, 300, "Slow SMA window (bars)"),
    ],
    fn=_signals,
))
