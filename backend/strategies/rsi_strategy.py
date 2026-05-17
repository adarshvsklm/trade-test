import pandas as pd
from .base import BaseStrategy, Signal


class RSIStrategy(BaseStrategy):
    name = "RSI"
    description = "Buys when RSI is oversold (<30); sells when overbought (>70)."

    def __init__(self, period: int = 14, oversold: float = 30, overbought: float = 70):
        self.period = period
        self.oversold = oversold
        self.overbought = overbought

    def _compute_rsi(self, series: pd.Series) -> pd.Series:
        delta = series.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=self.period - 1, min_periods=self.period).mean()
        avg_loss = loss.ewm(com=self.period - 1, min_periods=self.period).mean()
        rs = avg_gain / avg_loss.replace(0, float("inf"))
        return 100 - (100 / (1 + rs))

    def generate_signal(self, df: pd.DataFrame) -> Signal:
        if len(df) < self.period + 1:
            return "HOLD"

        rsi = self._compute_rsi(df["Close"])
        current = rsi.iloc[-1]
        previous = rsi.iloc[-2]

        if previous >= self.oversold and current < self.oversold:
            return "BUY"
        if previous <= self.overbought and current > self.overbought:
            return "SELL"

        if current < self.oversold:
            return "BUY"
        if current > self.overbought:
            return "SELL"
        return "HOLD"
