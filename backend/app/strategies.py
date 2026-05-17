from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

import pandas as pd


@dataclass(frozen=True)
class StrategyMeta:
    id: str
    name: str
    description: str


class Strategy(ABC):
    meta: StrategyMeta

    @abstractmethod
    def position_target(self, df: pd.DataFrame) -> float:
        """Return desired position size in shares (0 = flat). Uses last row context."""

    def explain_last(self, df: pd.DataFrame) -> str:
        return self.meta.description


class SmaCrossoverStrategy(Strategy):
    meta = StrategyMeta(
        id="sma_crossover",
        name="SMA crossover",
        description="Goes long when a fast SMA crosses above a slow SMA; exits on cross down.",
    )

    def __init__(self, fast: int = 12, slow: int = 26):
        self.fast = fast
        self.slow = slow

    def position_target(self, df: pd.DataFrame) -> float:
        if len(df) < self.slow + 2:
            return 0.0
        close = df["close"]
        f = close.rolling(self.fast).mean()
        s = close.rolling(self.slow).mean()
        bull = f.iloc[-1] > s.iloc[-1]
        return 1.0 if bool(bull) else 0.0

    def explain_last(self, df: pd.DataFrame) -> str:
        if len(df) < self.slow + 2:
            return "Warming up (not enough bars)."
        close = df["close"]
        f = close.rolling(self.fast).mean().iloc[-1]
        s = close.rolling(self.slow).mean().iloc[-1]
        side = "long" if f > s else "flat"
        return f"Fast SMA {f:.2f} vs slow {s:.2f} → {side}."


class DonchianBreakoutStrategy(Strategy):
    meta = StrategyMeta(
        id="donchian_breakout",
        name="Donchian breakout",
        description="Goes long when price breaks above the prior N-day high; flat otherwise.",
    )

    def __init__(self, lookback: int = 20):
        self.lookback = lookback

    def position_target(self, df: pd.DataFrame) -> float:
        if len(df) < self.lookback + 2:
            return 0.0
        prior_high = df["high"].rolling(self.lookback).max().shift(1)
        breakout = float(df["close"].iloc[-1]) >= float(prior_high.iloc[-1])
        return 1.0 if breakout else 0.0

    def explain_last(self, df: pd.DataFrame) -> str:
        if len(df) < self.lookback + 2:
            return "Warming up (not enough bars)."
        prior_high = float(df["high"].rolling(self.lookback).max().shift(1).iloc[-1])
        c = float(df["close"].iloc[-1])
        return f"Close {c:.2f} vs prior {self.lookback}d high {prior_high:.2f}."


class MacdTrendStrategy(Strategy):
    meta = StrategyMeta(
        id="macd_trend",
        name="MACD trend",
        description="Long when MACD line is above its signal line.",
    )

    def __init__(self, fast: int = 12, slow: int = 26, signal: int = 9):
        self.fast = fast
        self.slow = slow
        self.signal = signal

    def position_target(self, df: pd.DataFrame) -> float:
        need = self.slow + self.signal + 2
        if len(df) < need:
            return 0.0
        close = df["close"]
        ema_fast = close.ewm(span=self.fast, adjust=False).mean()
        ema_slow = close.ewm(span=self.slow, adjust=False).mean()
        macd = ema_fast - ema_slow
        sig = macd.ewm(span=self.signal, adjust=False).mean()
        return 1.0 if float(macd.iloc[-1]) > float(sig.iloc[-1]) else 0.0

    def explain_last(self, df: pd.DataFrame) -> str:
        need = self.slow + self.signal + 2
        if len(df) < need:
            return "Warming up (not enough bars)."
        close = df["close"]
        ema_fast = close.ewm(span=self.fast, adjust=False).mean()
        ema_slow = close.ewm(span=self.slow, adjust=False).mean()
        macd = ema_fast - ema_slow
        sig = macd.ewm(span=self.signal, adjust=False).mean()
        m, s = float(macd.iloc[-1]), float(sig.iloc[-1])
        return f"MACD {m:.4f} vs signal {s:.4f} → {'long' if m > s else 'flat'}."


def get_strategy(model_id: str) -> Strategy:
    reg = {
        SmaCrossoverStrategy.meta.id: SmaCrossoverStrategy,
        DonchianBreakoutStrategy.meta.id: DonchianBreakoutStrategy,
        MacdTrendStrategy.meta.id: MacdTrendStrategy,
    }
    cls = reg.get(model_id)
    if cls is None:
        raise KeyError(model_id)
    return cls()


def list_strategies() -> list[StrategyMeta]:
    return [SmaCrossoverStrategy.meta, DonchianBreakoutStrategy.meta, MacdTrendStrategy.meta]
