import pandas as pd

from .base import Strategy, StrategyParam, register


def _signals(df: pd.DataFrame, p: dict) -> pd.Series:
    lookback = int(p["lookback"])
    threshold = float(p["threshold"]) / 100.0
    ret = df["Close"].pct_change(lookback)
    sig = pd.Series(0, index=df.index, dtype=int)
    sig[ret > threshold] = 1
    sig[ret < -threshold] = -1
    return sig


register(Strategy(
    key="momentum",
    name="Momentum",
    description=(
        "Take the sign of the N-bar return: ride momentum after a strong move. "
        "Adjust the threshold to filter weak signals."
    ),
    params=[
        StrategyParam("lookback", "int", 10, 2, 100, "Return lookback (bars)"),
        StrategyParam("threshold", "float", 2.0, 0.0, 20.0, "Min |return| %% to trigger"),
    ],
    fn=_signals,
))
