"""Vectorized backtester.

Trades on the next bar's open after a signal change to avoid look-ahead bias.
Applies per-trade transaction cost (bps) and produces an equity curve plus
risk/return metrics.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from .strategies import get_strategy


@dataclass
class Trade:
    entry_time: str
    exit_time: str
    side: str       # "long" or "short"
    entry_price: float
    exit_price: float
    pnl: float
    pnl_pct: float
    bars_held: int


@dataclass
class BacktestResult:
    symbol: str
    strategy: str
    params: Dict[str, Any]
    initial_capital: float
    final_equity: float
    total_return_pct: float
    annualized_return_pct: float
    annualized_vol_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown_pct: float
    win_rate_pct: float
    profit_factor: float
    num_trades: int
    avg_trade_pct: float
    equity_curve: List[Dict[str, Any]]
    price_series: List[Dict[str, Any]]
    trades: List[Trade]
    buy_hold_return_pct: float

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["trades"] = [asdict(t) if not isinstance(t, dict) else t for t in self.trades]
        return d


def _bars_per_year(index: pd.DatetimeIndex) -> float:
    if len(index) < 2:
        return 252.0
    dt = (index[-1] - index[0]).total_seconds() / max(1, len(index) - 1)
    if dt <= 0:
        return 252.0
    return 365.25 * 24 * 3600 / dt


def _extract_trades(df: pd.DataFrame, exec_pos: pd.Series) -> List[Trade]:
    trades: List[Trade] = []
    pos = exec_pos.values
    closes = df["Close"].values
    times = df.index
    current_side = 0
    entry_idx = -1
    entry_price = 0.0
    for i in range(len(pos)):
        if pos[i] != current_side:
            # Close prior position if any.
            if current_side != 0 and entry_idx >= 0:
                exit_price = float(closes[i])
                pnl_pct = (exit_price / entry_price - 1.0) * (1 if current_side > 0 else -1)
                trades.append(Trade(
                    entry_time=times[entry_idx].isoformat(),
                    exit_time=times[i].isoformat(),
                    side="long" if current_side > 0 else "short",
                    entry_price=entry_price,
                    exit_price=exit_price,
                    pnl=(exit_price - entry_price) * (1 if current_side > 0 else -1),
                    pnl_pct=pnl_pct * 100.0,
                    bars_held=i - entry_idx,
                ))
            # Open new position if non-zero.
            if pos[i] != 0:
                entry_idx = i
                entry_price = float(closes[i])
            else:
                entry_idx = -1
                entry_price = 0.0
            current_side = int(pos[i])
    # Close any open trade at the last bar.
    if current_side != 0 and entry_idx >= 0 and entry_idx < len(closes) - 1:
        exit_price = float(closes[-1])
        pnl_pct = (exit_price / entry_price - 1.0) * (1 if current_side > 0 else -1)
        trades.append(Trade(
            entry_time=times[entry_idx].isoformat(),
            exit_time=times[-1].isoformat(),
            side="long" if current_side > 0 else "short",
            entry_price=entry_price,
            exit_price=exit_price,
            pnl=(exit_price - entry_price) * (1 if current_side > 0 else -1),
            pnl_pct=pnl_pct * 100.0,
            bars_held=len(closes) - 1 - entry_idx,
        ))
    return trades


def run_backtest(
    df: pd.DataFrame,
    symbol: str,
    strategy_key: str,
    params: Dict[str, Any] | None = None,
    initial_capital: float = 10_000.0,
    fee_bps: float = 5.0,
    allow_short: bool = True,
) -> BacktestResult:
    if len(df) < 30:
        raise ValueError("Not enough data to backtest (need >= 30 bars).")

    strat = get_strategy(strategy_key)
    signals = strat.generate_signals(df, params)
    if not allow_short:
        signals = signals.clip(lower=0)

    # Execute on next bar: position effective from the bar after the signal.
    exec_pos = signals.shift(1).fillna(0).astype(int)

    close = df["Close"].astype(float)
    rets = close.pct_change().fillna(0.0)

    # Trade cost when position changes.
    pos_change = exec_pos.diff().abs().fillna(exec_pos.abs())
    cost = pos_change * (fee_bps / 10_000.0)

    strat_rets = exec_pos * rets - cost
    equity = (1 + strat_rets).cumprod() * initial_capital

    bars_yr = _bars_per_year(df.index)
    ann_return = (equity.iloc[-1] / initial_capital) ** (bars_yr / max(1, len(df))) - 1
    ann_vol = strat_rets.std() * np.sqrt(bars_yr)
    sharpe = (strat_rets.mean() * bars_yr) / (ann_vol + 1e-12)
    downside = strat_rets[strat_rets < 0].std() * np.sqrt(bars_yr)
    sortino = (strat_rets.mean() * bars_yr) / (downside + 1e-12)

    running_max = equity.cummax()
    drawdown = equity / running_max - 1
    max_dd = float(drawdown.min())

    trades = _extract_trades(df, exec_pos)
    wins = [t for t in trades if t.pnl_pct > 0]
    losses = [t for t in trades if t.pnl_pct <= 0]
    gross_win = sum(t.pnl_pct for t in wins)
    gross_loss = abs(sum(t.pnl_pct for t in losses))
    profit_factor = float(gross_win / gross_loss) if gross_loss > 1e-9 else float("inf") if gross_win > 0 else 0.0
    win_rate = 100.0 * len(wins) / len(trades) if trades else 0.0
    avg_trade = float(np.mean([t.pnl_pct for t in trades])) if trades else 0.0

    # Downsample equity/price curves for chart payload (cap to ~400 points).
    n = len(df)
    step = max(1, n // 400)
    idx = list(range(0, n, step))
    if idx[-1] != n - 1:
        idx.append(n - 1)

    equity_curve = [
        {"t": df.index[i].isoformat(), "equity": float(equity.iloc[i])} for i in idx
    ]
    price_series = [
        {"t": df.index[i].isoformat(), "close": float(close.iloc[i])} for i in idx
    ]

    buy_hold = float(close.iloc[-1] / close.iloc[0] - 1.0) * 100.0

    return BacktestResult(
        symbol=symbol,
        strategy=strategy_key,
        params=params or {},
        initial_capital=initial_capital,
        final_equity=float(equity.iloc[-1]),
        total_return_pct=float(equity.iloc[-1] / initial_capital - 1.0) * 100.0,
        annualized_return_pct=float(ann_return) * 100.0,
        annualized_vol_pct=float(ann_vol) * 100.0,
        sharpe_ratio=float(sharpe),
        sortino_ratio=float(sortino),
        max_drawdown_pct=float(max_dd) * 100.0,
        win_rate_pct=float(win_rate),
        profit_factor=float(profit_factor) if np.isfinite(profit_factor) else 999.0,
        num_trades=len(trades),
        avg_trade_pct=float(avg_trade),
        equity_curve=equity_curve,
        price_series=price_series,
        trades=trades[-100:],  # last 100 trades, plenty for UI
        buy_hold_return_pct=buy_hold,
    )
