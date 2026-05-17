from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List

import pandas as pd


@dataclass
class StrategyParam:
    name: str
    type: str  # "int" | "float"
    default: float
    min: float
    max: float
    description: str = ""


@dataclass
class Strategy:
    key: str
    name: str
    description: str
    params: List[StrategyParam]
    fn: Callable[[pd.DataFrame, Dict[str, Any]], pd.Series]

    def generate_signals(self, df: pd.DataFrame, params: Dict[str, Any] | None = None) -> pd.Series:
        merged = {p.name: p.default for p in self.params}
        if params:
            merged.update({k: v for k, v in params.items() if v is not None})
        signals = self.fn(df, merged)
        signals = signals.reindex(df.index).fillna(0).astype(int)
        return signals

    def to_dict(self) -> Dict[str, Any]:
        return {
            "key": self.key,
            "name": self.name,
            "description": self.description,
            "params": [p.__dict__ for p in self.params],
        }


STRATEGY_REGISTRY: Dict[str, Strategy] = {}


def register(strategy: Strategy) -> Strategy:
    STRATEGY_REGISTRY[strategy.key] = strategy
    return strategy


def list_strategies() -> List[Dict[str, Any]]:
    return [s.to_dict() for s in STRATEGY_REGISTRY.values()]


def get_strategy(key: str) -> Strategy:
    if key not in STRATEGY_REGISTRY:
        raise KeyError(f"Unknown strategy '{key}'. Available: {list(STRATEGY_REGISTRY)}")
    return STRATEGY_REGISTRY[key]
