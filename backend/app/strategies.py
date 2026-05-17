import pandas as pd
import numpy as np
import ta
from abc import ABC, abstractmethod
import logging

logger = logging.getLogger(__name__)


class BaseStrategy(ABC):
    name: str = "base"
    description: str = ""

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        """Return df with a 'signal' column: 1=buy, -1=sell, 0=hold."""
        pass

    @abstractmethod
    def get_indicators(self, df: pd.DataFrame) -> dict:
        """Return computed indicator values for the latest bar."""
        pass


class SMACrossover(BaseStrategy):
    name = "sma_crossover"
    description = "Buys when short-period SMA crosses above long-period SMA, sells on the reverse."

    def __init__(self, short_window: int = 20, long_window: int = 50):
        self.short_window = short_window
        self.long_window = long_window

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["sma_short"] = df["Close"].rolling(window=self.short_window).mean()
        df["sma_long"] = df["Close"].rolling(window=self.long_window).mean()
        df["signal"] = 0
        df.loc[df["sma_short"] > df["sma_long"], "signal"] = 1
        df.loc[df["sma_short"] <= df["sma_long"], "signal"] = -1
        df["signal"] = df["signal"].diff().clip(-1, 1)
        df["signal"] = df["signal"].fillna(0).astype(int)
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        latest = df.iloc[-1]
        return {
            "sma_short": round(latest.get("sma_short", 0), 2),
            "sma_long": round(latest.get("sma_long", 0), 2),
            "signal": int(latest["signal"]),
        }


class RSIMomentum(BaseStrategy):
    name = "rsi_momentum"
    description = "Buys when RSI drops below oversold level, sells when RSI rises above overbought."

    def __init__(self, period: int = 14, oversold: float = 30, overbought: float = 70):
        self.period = period
        self.oversold = oversold
        self.overbought = overbought

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["rsi"] = ta.momentum.RSIIndicator(df["Close"], window=self.period).rsi()
        df["signal"] = 0
        df.loc[df["rsi"] < self.oversold, "signal"] = 1
        df.loc[df["rsi"] > self.overbought, "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        latest = df.iloc[-1]
        return {
            "rsi": round(latest.get("rsi", 0), 2),
            "oversold": self.oversold,
            "overbought": self.overbought,
            "signal": int(latest["signal"]),
        }


class MACDSignal(BaseStrategy):
    name = "macd_signal"
    description = "Trades based on MACD line crossing its signal line."

    def __init__(self, fast: int = 12, slow: int = 26, signal: int = 9):
        self.fast = fast
        self.slow = slow
        self.signal_period = signal

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        macd_ind = ta.trend.MACD(df["Close"], window_slow=self.slow, window_fast=self.fast, window_sign=self.signal_period)
        df["macd"] = macd_ind.macd()
        df["macd_signal"] = macd_ind.macd_signal()
        df["macd_hist"] = macd_ind.macd_diff()
        df["signal"] = 0
        df.loc[df["macd"] > df["macd_signal"], "signal"] = 1
        df.loc[df["macd"] <= df["macd_signal"], "signal"] = -1
        df["signal"] = df["signal"].diff().clip(-1, 1).fillna(0).astype(int)
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        latest = df.iloc[-1]
        return {
            "macd": round(latest.get("macd", 0), 4),
            "macd_signal": round(latest.get("macd_signal", 0), 4),
            "macd_histogram": round(latest.get("macd_hist", 0), 4),
            "signal": int(latest["signal"]),
        }


class BollingerBands(BaseStrategy):
    name = "bollinger_bands"
    description = "Buys when price touches lower band, sells when price touches upper band."

    def __init__(self, period: int = 20, std_dev: float = 2.0):
        self.period = period
        self.std_dev = std_dev

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        bb = ta.volatility.BollingerBands(df["Close"], window=self.period, window_dev=self.std_dev)
        df["bb_upper"] = bb.bollinger_hband()
        df["bb_middle"] = bb.bollinger_mavg()
        df["bb_lower"] = bb.bollinger_lband()
        df["signal"] = 0
        df.loc[df["Close"] <= df["bb_lower"], "signal"] = 1
        df.loc[df["Close"] >= df["bb_upper"], "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        latest = df.iloc[-1]
        return {
            "bb_upper": round(latest.get("bb_upper", 0), 2),
            "bb_middle": round(latest.get("bb_middle", 0), 2),
            "bb_lower": round(latest.get("bb_lower", 0), 2),
            "signal": int(latest["signal"]),
        }


class MeanReversion(BaseStrategy):
    name = "mean_reversion"
    description = "Trades on the assumption that price reverts to its rolling mean (z-score based)."

    def __init__(self, window: int = 20, z_threshold: float = 2.0):
        self.window = window
        self.z_threshold = z_threshold

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df["rolling_mean"] = df["Close"].rolling(window=self.window).mean()
        df["rolling_std"] = df["Close"].rolling(window=self.window).std()
        df["z_score"] = (df["Close"] - df["rolling_mean"]) / df["rolling_std"]
        df["signal"] = 0
        df.loc[df["z_score"] < -self.z_threshold, "signal"] = 1
        df.loc[df["z_score"] > self.z_threshold, "signal"] = -1
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        df = self.generate_signals(df)
        latest = df.iloc[-1]
        return {
            "rolling_mean": round(latest.get("rolling_mean", 0), 2),
            "z_score": round(latest.get("z_score", 0), 4),
            "z_threshold": self.z_threshold,
            "signal": int(latest["signal"]),
        }


class EnsembleStrategy(BaseStrategy):
    name = "ensemble"
    description = "Combines signals from all strategies via majority vote."

    def __init__(self):
        self.strategies = [
            SMACrossover(),
            RSIMomentum(),
            MACDSignal(),
            BollingerBands(),
            MeanReversion(),
        ]

    def generate_signals(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        signals = []
        for strat in self.strategies:
            s_df = strat.generate_signals(df)
            signals.append(s_df["signal"])

        combined = pd.concat(signals, axis=1)
        df["signal"] = combined.sum(axis=1).apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
        return df

    def get_indicators(self, df: pd.DataFrame) -> dict:
        results = {}
        for strat in self.strategies:
            indicators = strat.get_indicators(df)
            results[strat.name] = indicators
        df_signals = self.generate_signals(df)
        results["ensemble_signal"] = int(df_signals["signal"].iloc[-1])
        return results


STRATEGY_MAP = {
    "sma_crossover": SMACrossover,
    "rsi_momentum": RSIMomentum,
    "macd_signal": MACDSignal,
    "bollinger_bands": BollingerBands,
    "mean_reversion": MeanReversion,
    "ensemble": EnsembleStrategy,
}


def get_strategy(name: str) -> BaseStrategy:
    cls = STRATEGY_MAP.get(name)
    if not cls:
        raise ValueError(f"Unknown strategy: {name}")
    return cls()


def get_all_strategies() -> list[dict]:
    return [
        {
            "id": key,
            "name": key.replace("_", " ").title(),
            "description": cls().description if hasattr(cls, "description") else "",
        }
        for key, cls in STRATEGY_MAP.items()
    ]
