import pandas as pd

from .base import Strategy, StrategyParam, register


def _signals(df: pd.DataFrame, p: dict) -> pd.Series:
    window = int(p["window"])
    hh = df["High"].rolling(window).max().shift(1)
    ll = df["Low"].rolling(window).min().shift(1)
    pos = pd.Series(pd.NA, index=df.index, dtype="Int64")
    pos[df["Close"] > hh] = 1
    pos[df["Close"] < ll] = -1
    return pos.ffill().fillna(0).astype(int)


register(Strategy(
    key="donchian_breakout",
    name="Donchian Breakout",
    description=(
        "Long when price breaks above the highest high of the last N bars, "
        "short when it breaks below the lowest low. Classic turtle-style "
        "trend system."
    ),
    params=[
        StrategyParam("window", "int", 20, 5, 200, "Lookback window"),
    ],
    fn=_signals,
))
