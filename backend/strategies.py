import pandas as pd
import numpy as np
from ta.trend import SMAIndicator, MACD as MACD_Indicator, EMAIndicator
from ta.momentum import RSIIndicator
from ta.volatility import BollingerBands
from models import TradeAction, StrategyType


class BaseStrategy:
    def __init__(self):
        self.name = "base"

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        raise NotImplementedError

    def get_current_signal(self, df: pd.DataFrame) -> dict:
        raise NotImplementedError


class SMACrossoverStrategy(BaseStrategy):
    def __init__(self, short_window: int = 20, long_window: int = 50):
        super().__init__()
        self.name = "SMA Crossover"
        self.short_window = short_window
        self.long_window = long_window

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["sma_short"] = SMAIndicator(df["Close"], window=self.short_window).sma_indicator()
        df["sma_long"] = SMAIndicator(df["Close"], window=self.long_window).sma_indicator()

        df["signal"] = TradeAction.HOLD.value
        df.loc[
            (df["sma_short"] > df["sma_long"]) &
            (df["sma_short"].shift(1) <= df["sma_long"].shift(1)),
            "signal"
        ] = TradeAction.BUY.value
        df.loc[
            (df["sma_short"] < df["sma_long"]) &
            (df["sma_short"].shift(1) >= df["sma_long"].shift(1)),
            "signal"
        ] = TradeAction.SELL.value
        return df

    def get_current_signal(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        last = df.iloc[-1]
        return {
            "action": last["signal"],
            "sma_short": round(last["sma_short"], 2) if pd.notna(last["sma_short"]) else None,
            "sma_long": round(last["sma_long"], 2) if pd.notna(last["sma_long"]) else None,
            "price": round(last["Close"], 2),
            "strategy": StrategyType.SMA_CROSSOVER.value,
        }


class RSIStrategy(BaseStrategy):
    def __init__(self, window: int = 14, oversold: float = 30, overbought: float = 70):
        super().__init__()
        self.name = "RSI"
        self.window = window
        self.oversold = oversold
        self.overbought = overbought

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["rsi"] = RSIIndicator(df["Close"], window=self.window).rsi()

        df["signal"] = TradeAction.HOLD.value
        df.loc[df["rsi"] < self.oversold, "signal"] = TradeAction.BUY.value
        df.loc[df["rsi"] > self.overbought, "signal"] = TradeAction.SELL.value
        return df

    def get_current_signal(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        last = df.iloc[-1]
        return {
            "action": last["signal"],
            "rsi": round(last["rsi"], 2) if pd.notna(last["rsi"]) else None,
            "oversold_threshold": self.oversold,
            "overbought_threshold": self.overbought,
            "price": round(last["Close"], 2),
            "strategy": StrategyType.RSI.value,
        }


class MACDStrategy(BaseStrategy):
    def __init__(self, fast: int = 12, slow: int = 26, signal: int = 9):
        super().__init__()
        self.name = "MACD"
        self.fast = fast
        self.slow = slow
        self.signal_window = signal

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        macd_indicator = MACD_Indicator(
            df["Close"],
            window_fast=self.fast,
            window_slow=self.slow,
            window_sign=self.signal_window
        )
        df["macd"] = macd_indicator.macd()
        df["macd_signal"] = macd_indicator.macd_signal()
        df["macd_histogram"] = macd_indicator.macd_diff()

        df["signal"] = TradeAction.HOLD.value
        df.loc[
            (df["macd"] > df["macd_signal"]) &
            (df["macd"].shift(1) <= df["macd_signal"].shift(1)),
            "signal"
        ] = TradeAction.BUY.value
        df.loc[
            (df["macd"] < df["macd_signal"]) &
            (df["macd"].shift(1) >= df["macd_signal"].shift(1)),
            "signal"
        ] = TradeAction.SELL.value
        return df

    def get_current_signal(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        last = df.iloc[-1]
        return {
            "action": last["signal"],
            "macd": round(last["macd"], 4) if pd.notna(last["macd"]) else None,
            "macd_signal": round(last["macd_signal"], 4) if pd.notna(last["macd_signal"]) else None,
            "macd_histogram": round(last["macd_histogram"], 4) if pd.notna(last["macd_histogram"]) else None,
            "price": round(last["Close"], 2),
            "strategy": StrategyType.MACD.value,
        }


class BollingerBandsStrategy(BaseStrategy):
    def __init__(self, window: int = 20, std_dev: float = 2.0):
        super().__init__()
        self.name = "Bollinger Bands"
        self.window = window
        self.std_dev = std_dev

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        bb = BollingerBands(df["Close"], window=self.window, window_dev=self.std_dev)
        df["bb_upper"] = bb.bollinger_hband()
        df["bb_middle"] = bb.bollinger_mavg()
        df["bb_lower"] = bb.bollinger_lband()
        df["bb_pct"] = bb.bollinger_pband()

        df["signal"] = TradeAction.HOLD.value
        df.loc[df["Close"] < df["bb_lower"], "signal"] = TradeAction.BUY.value
        df.loc[df["Close"] > df["bb_upper"], "signal"] = TradeAction.SELL.value
        return df

    def get_current_signal(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        last = df.iloc[-1]
        return {
            "action": last["signal"],
            "bb_upper": round(last["bb_upper"], 2) if pd.notna(last["bb_upper"]) else None,
            "bb_middle": round(last["bb_middle"], 2) if pd.notna(last["bb_middle"]) else None,
            "bb_lower": round(last["bb_lower"], 2) if pd.notna(last["bb_lower"]) else None,
            "bb_pct": round(last["bb_pct"], 4) if pd.notna(last["bb_pct"]) else None,
            "price": round(last["Close"], 2),
            "strategy": StrategyType.BOLLINGER_BANDS.value,
        }


class CombinedStrategy(BaseStrategy):
    """Uses majority vote from all strategies."""

    def __init__(self):
        super().__init__()
        self.name = "Combined (Ensemble)"
        self.strategies = [
            SMACrossoverStrategy(),
            RSIStrategy(),
            MACDStrategy(),
            BollingerBandsStrategy(),
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        votes = []
        for strat in self.strategies:
            s_df = strat.generate_signals(df)
            votes.append(s_df["signal"])

        vote_df = pd.concat(votes, axis=1)
        vote_df.columns = [s.name for s in self.strategies]

        def majority_vote(row):
            buy_count = (row == TradeAction.BUY.value).sum()
            sell_count = (row == TradeAction.SELL.value).sum()
            if buy_count >= 3:
                return TradeAction.BUY.value
            elif sell_count >= 3:
                return TradeAction.SELL.value
            elif buy_count >= 2 and sell_count == 0:
                return TradeAction.BUY.value
            elif sell_count >= 2 and buy_count == 0:
                return TradeAction.SELL.value
            return TradeAction.HOLD.value

        df["signal"] = vote_df.apply(majority_vote, axis=1)
        return df

    def get_current_signal(self, df: pd.DataFrame) -> dict:
        sub_signals = {}
        for strat in self.strategies:
            sub_signals[strat.name] = strat.get_current_signal(df)

        df = self.generate_signals(df)
        last = df.iloc[-1]
        return {
            "action": last["signal"],
            "sub_signals": sub_signals,
            "price": round(last["Close"], 2),
            "strategy": StrategyType.COMBINED.value,
        }


STRATEGY_MAP = {
    StrategyType.SMA_CROSSOVER: SMACrossoverStrategy,
    StrategyType.RSI: RSIStrategy,
    StrategyType.MACD: MACDStrategy,
    StrategyType.BOLLINGER_BANDS: BollingerBandsStrategy,
    StrategyType.COMBINED: CombinedStrategy,
}
