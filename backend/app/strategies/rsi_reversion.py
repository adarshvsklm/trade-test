import pandas as pd

from .base import Strategy, StrategyParam, register


def _rsi(series: pd.Series, period: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0.0)
    loss = -delta.clip(upper=0.0)
    avg_gain = gain.ewm(alpha=1 / period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, 1e-12)
    return 100 - (100 / (1 + rs))


def _signals(df: pd.DataFrame, p: dict) -> pd.Series:
    period = int(p["period"])
    low = float(p["oversold"])
    high = float(p["overbought"])
    rsi = _rsi(df["Close"], period)
    pos = pd.Series(pd.NA, index=df.index, dtype="Int64")
    pos[rsi < low] = 1
    pos[rsi > high] = -1
    return pos.ffill().fillna(0).astype(int)


register(Strategy(
    key="rsi_reversion",
    name="RSI Mean Reversion",
    description=(
        "Buy when RSI shows oversold conditions, sell/short when overbought. "
        "Holds the position until the opposite extreme triggers a flip. "
        "Works best in range-bound markets."
    ),
    params=[
        StrategyParam("period", "int", 14, 2, 50, "RSI lookback period"),
        StrategyParam("oversold", "float", 30, 5, 45, "Oversold threshold"),
        StrategyParam("overbought", "float", 70, 55, 95, "Overbought threshold"),
    ],
    fn=_signals,
))
