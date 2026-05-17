import pandas as pd

from .base import Strategy, StrategyParam, register


def _signals(df: pd.DataFrame, p: dict) -> pd.Series:
    fast = int(p["fast"])
    slow = int(p["slow"])
    signal_n = int(p["signal"])
    ema_fast = df["Close"].ewm(span=fast, adjust=False).mean()
    ema_slow = df["Close"].ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    signal = macd.ewm(span=signal_n, adjust=False).mean()
    sig = (macd > signal).astype(int) - (macd < signal).astype(int)
    return sig


register(Strategy(
    key="macd_trend",
    name="MACD Trend",
    description=(
        "Moving Average Convergence Divergence: long when MACD line crosses "
        "above its signal line, short when below. Smoother than SMA crossover."
    ),
    params=[
        StrategyParam("fast", "int", 12, 2, 50, "Fast EMA"),
        StrategyParam("slow", "int", 26, 5, 100, "Slow EMA"),
        StrategyParam("signal", "int", 9, 2, 30, "Signal EMA"),
    ],
    fn=_signals,
))
