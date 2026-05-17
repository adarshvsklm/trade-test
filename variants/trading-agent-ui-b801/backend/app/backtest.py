from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
import math

import numpy as np
import pandas as pd

from app.data import fetch_ohlcv
from app.strategies import Strategy, get_strategy


@dataclass
class BacktestResult:
    equity_curve: list[dict]
    trades: list[dict]
    metrics: dict


def _max_drawdown(equity: np.ndarray) -> float:
    peak = np.maximum.accumulate(equity)
    dd = (equity - peak) / peak
    return float(dd.min() * 100) if len(equity) else 0.0


def _sharpe_simple(daily_returns: np.ndarray) -> float | None:
    if len(daily_returns) < 5:
        return None
    mu = float(np.mean(daily_returns))
    sd = float(np.std(daily_returns, ddof=1))
    if sd == 0:
        return None
    return (mu / sd) * np.sqrt(252)


def run_backtest(
    symbol: str,
    model_id: str,
    start: date,
    end: date,
    initial_cash: float,
    commission_pct: float = 0.0005,
) -> BacktestResult:
    strat: Strategy = get_strategy(model_id)
    end_fetch = end + timedelta(days=1)
    df = fetch_ohlcv(symbol, start, end_fetch, interval="1d")

    cash = float(initial_cash)
    shares = 0.0
    equity_points: list[dict] = []
    trades: list[dict] = []

    targets: list[float] = []
    for i in range(len(df)):
        window = df.iloc[: i + 1]
        tgt = strat.position_target(window)
        targets.append(tgt)

    position_long = False
    for i, ts in enumerate(df.index):
        price = float(df["close"].iloc[i])
        tgt = targets[i]
        want_long = tgt >= 0.5

        if want_long and not position_long and cash > 0:
            fee = 1 + commission_pct
            buy_shares = cash / (price * fee)
            notional = buy_shares * price
            cash -= notional * fee
            shares += buy_shares
            position_long = True
            trades.append(
                {
                    "time": pd.Timestamp(ts).isoformat(),
                    "side": "buy",
                    "price": price,
                    "shares": float(buy_shares),
                    "notional": float(notional),
                    "reason": "signal",
                }
            )
        elif not want_long and position_long and shares > 0:
            notional = shares * price
            fee = 1 - commission_pct
            cash += notional * fee
            trades.append(
                {
                    "time": pd.Timestamp(ts).isoformat(),
                    "side": "sell",
                    "price": price,
                    "shares": float(shares),
                    "notional": float(notional),
                    "reason": "signal",
                }
            )
            shares = 0.0
            position_long = False

        mv = shares * price
        eq = cash + mv
        equity_points.append(
            {
                "time": pd.Timestamp(ts).isoformat(),
                "equity": float(eq),
                "cash": float(cash),
                "position_value": float(mv),
            }
        )

    eq_arr = np.array([p["equity"] for p in equity_points], dtype=float)
    ret = (eq_arr[-1] / eq_arr[0] - 1) * 100 if len(eq_arr) else 0.0
    mdd = _max_drawdown(eq_arr) if len(eq_arr) else 0.0
    rets = np.diff(eq_arr) / eq_arr[:-1]
    sharpe = _sharpe_simple(rets)
    if sharpe is not None and (math.isnan(sharpe) or math.isinf(sharpe)):
        sharpe = None

    wins = 0
    losses = 0
    # pair buy/sell for win rate on round trips
    stack = []
    for t in trades:
        if t["side"] == "buy":
            stack.append(t)
        elif t["side"] == "sell" and stack:
            b = stack.pop(0)
            pnl = t["notional"] - b["notional"]  # simplified
            if pnl >= 0:
                wins += 1
            else:
                losses += 1
    wr = None
    if wins + losses > 0:
        wr = wins / (wins + losses) * 100
        if math.isnan(wr):
            wr = None

    metrics = {
        "total_return_pct": float(ret),
        "max_drawdown_pct": float(mdd),
        "win_rate_pct": float(wr) if wr is not None else None,
        "trades": len(trades),
        "sharpe_approx": float(sharpe) if sharpe is not None else None,
    }
    return BacktestResult(equity_curve=equity_points, trades=trades, metrics=metrics)
