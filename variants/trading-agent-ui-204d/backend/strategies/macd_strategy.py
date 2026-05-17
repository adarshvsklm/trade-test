import pandas as pd
from .base import BaseStrategy, Signal


class MACDStrategy(BaseStrategy):
    name = "MACD"
    description = "Trades on MACD line crossing the signal line."

    def __init__(self, fast: int = 12, slow: int = 26, signal: int = 9):
        self.fast = fast
        self.slow = slow
        self.signal = signal

    def generate_signal(self, df: pd.DataFrame) -> Signal:
        if len(df) < self.slow + self.signal:
            return "HOLD"

        close = df["Close"]
        ema_fast = close.ewm(span=self.fast, adjust=False).mean()
        ema_slow = close.ewm(span=self.slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=self.signal, adjust=False).mean()

        prev_macd = macd_line.iloc[-2]
        prev_signal = signal_line.iloc[-2]
        curr_macd = macd_line.iloc[-1]
        curr_signal = signal_line.iloc[-1]

        if prev_macd <= prev_signal and curr_macd > curr_signal:
            return "BUY"
        if prev_macd >= prev_signal and curr_macd < curr_signal:
            return "SELL"
        return "HOLD"
