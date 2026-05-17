import pandas as pd

from .base import Strategy, StrategyParam, register, STRATEGY_REGISTRY


def _signals(df: pd.DataFrame, p: dict) -> pd.Series:
    threshold = float(p["agreement"])
    keys = ["sma_crossover", "rsi_reversion", "macd_trend", "donchian_breakout", "momentum"]
    votes = []
    for k in keys:
        if k in STRATEGY_REGISTRY:
            votes.append(STRATEGY_REGISTRY[k].generate_signals(df))
    if not votes:
        return pd.Series(0, index=df.index, dtype=int)
    agg = sum(votes) / len(votes)
    sig = pd.Series(0, index=df.index, dtype=int)
    sig[agg >= threshold] = 1
    sig[agg <= -threshold] = -1
    return sig


register(Strategy(
    key="ensemble",
    name="Ensemble Voter",
    description=(
        "Polls all built-in strategies each bar and takes the average vote. "
        "Goes long when net agreement exceeds the threshold, short when below "
        "the negative threshold. More conservative — trades less, often better "
        "risk-adjusted returns."
    ),
    params=[
        StrategyParam("agreement", "float", 0.4, 0.1, 1.0, "Net vote threshold"),
    ],
    fn=_signals,
))
