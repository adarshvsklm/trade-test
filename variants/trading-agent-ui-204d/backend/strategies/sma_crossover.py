import pandas as pd
from .base import BaseStrategy, Signal


class SMACrossoverStrategy(BaseStrategy):
    name = "SMA Crossover"
    description = "Buys when fast SMA crosses above slow SMA; sells on crossover below."

    def __init__(self, fast: int = 10, slow: int = 30):
        self.fast = fast
        self.slow = slow

    def generate_signal(self, df: pd.DataFrame) -> Signal:
        if len(df) < self.slow + 1:
            return "HOLD"

        close = df["Close"]
        fast_sma = close.rolling(self.fast).mean()
        slow_sma = close.rolling(self.slow).mean()

        prev_fast = fast_sma.iloc[-2]
        prev_slow = slow_sma.iloc[-2]
        curr_fast = fast_sma.iloc[-1]
        curr_slow = slow_sma.iloc[-1]

        if prev_fast <= prev_slow and curr_fast > curr_slow:
            return "BUY"
        if prev_fast >= prev_slow and curr_fast < curr_slow:
            return "SELL"
        return "HOLD"
