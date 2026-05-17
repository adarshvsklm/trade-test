import pandas as pd
from .base import BaseStrategy, Signal


class MeanReversionStrategy(BaseStrategy):
    name = "Mean Reversion"
    description = "Buys when price drops significantly below its rolling mean; sells when above."

    def __init__(self, period: int = 20, threshold: float = 0.02):
        self.period = period
        self.threshold = threshold

    def generate_signal(self, df: pd.DataFrame) -> Signal:
        if len(df) < self.period:
            return "HOLD"

        close = df["Close"]
        mean = close.rolling(self.period).mean()
        deviation = (close.iloc[-1] - mean.iloc[-1]) / mean.iloc[-1]

        if deviation < -self.threshold:
            return "BUY"
        if deviation > self.threshold:
            return "SELL"
        return "HOLD"
