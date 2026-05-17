import pandas as pd
from .base import BaseStrategy, Signal


class BollingerBandsStrategy(BaseStrategy):
    name = "Bollinger Bands"
    description = "Buys near lower band (mean-reversion); sells near upper band."

    def __init__(self, period: int = 20, std_dev: float = 2.0):
        self.period = period
        self.std_dev = std_dev

    def generate_signal(self, df: pd.DataFrame) -> Signal:
        if len(df) < self.period:
            return "HOLD"

        close = df["Close"]
        sma = close.rolling(self.period).mean()
        std = close.rolling(self.period).std()
        upper = sma + self.std_dev * std
        lower = sma - self.std_dev * std

        curr_price = close.iloc[-1]
        prev_price = close.iloc[-2]
        curr_lower = lower.iloc[-1]
        curr_upper = upper.iloc[-1]
        prev_lower = lower.iloc[-2]
        prev_upper = upper.iloc[-2]

        if prev_price <= prev_lower and curr_price > curr_lower:
            return "BUY"
        if prev_price >= prev_upper and curr_price < curr_upper:
            return "SELL"
        return "HOLD"
