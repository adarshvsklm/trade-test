import pandas as pd
import numpy as np
from typing import Any
from strategies.base import BaseStrategy


class Backtester:
    def __init__(
        self,
        strategy: BaseStrategy,
        initial_capital: float = 10_000.0,
        commission: float = 0.001,
    ):
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.commission = commission

    def run(self, df: pd.DataFrame) -> dict[str, Any]:
        cash = self.initial_capital
        position = 0.0
        entry_price = 0.0
        trades: list[dict] = []
        equity_curve: list[dict] = []

        for i in range(1, len(df)):
            window = df.iloc[: i + 1]
            signal = self.strategy.generate_signal(window)
            price = float(df["Close"].iloc[i])
            ts = str(df.index[i])

            equity = cash + position * price
            equity_curve.append({"date": ts, "equity": round(equity, 2), "price": round(price, 4)})

            if signal == "BUY" and position == 0 and cash > 0:
                shares = (cash * (1 - self.commission)) / price
                position = shares
                entry_price = price
                cash = 0.0
                trades.append(
                    {
                        "date": ts,
                        "action": "BUY",
                        "price": round(price, 4),
                        "shares": round(shares, 6),
                        "value": round(shares * price, 2),
                        "pnl": 0.0,
                    }
                )

            elif signal == "SELL" and position > 0:
                proceeds = position * price * (1 - self.commission)
                pnl = proceeds - (position * entry_price)
                cash = proceeds
                trades.append(
                    {
                        "date": ts,
                        "action": "SELL",
                        "price": round(price, 4),
                        "shares": round(position, 6),
                        "value": round(proceeds, 2),
                        "pnl": round(pnl, 2),
                    }
                )
                position = 0.0
                entry_price = 0.0

        final_price = float(df["Close"].iloc[-1])
        final_equity = cash + position * final_price

        total_return = (final_equity - self.initial_capital) / self.initial_capital * 100
        buy_hold_return = (
            (final_price - float(df["Close"].iloc[0])) / float(df["Close"].iloc[0]) * 100
        )

        winning = [t for t in trades if t["action"] == "SELL" and t["pnl"] > 0]
        losing = [t for t in trades if t["action"] == "SELL" and t["pnl"] <= 0]
        sell_trades = [t for t in trades if t["action"] == "SELL"]
        win_rate = len(winning) / len(sell_trades) * 100 if sell_trades else 0.0

        pnls = [t["pnl"] for t in sell_trades]
        avg_profit = np.mean([p for p in pnls if p > 0]) if winning else 0.0
        avg_loss = np.mean([p for p in pnls if p <= 0]) if losing else 0.0
        profit_factor = (
            abs(sum(p for p in pnls if p > 0) / sum(p for p in pnls if p <= 0))
            if losing and sum(p for p in pnls if p <= 0) != 0
            else float("inf")
        )

        equity_vals = [e["equity"] for e in equity_curve]
        max_equity = equity_vals[0]
        max_drawdown = 0.0
        for eq in equity_vals:
            if eq > max_equity:
                max_equity = eq
            dd = (max_equity - eq) / max_equity * 100 if max_equity > 0 else 0.0
            if dd > max_drawdown:
                max_drawdown = dd

        daily_returns = pd.Series(equity_vals).pct_change().dropna()
        sharpe = (
            (daily_returns.mean() / daily_returns.std()) * np.sqrt(252)
            if daily_returns.std() > 0
            else 0.0
        )

        return {
            "strategy": self.strategy.name,
            "initial_capital": self.initial_capital,
            "final_equity": round(final_equity, 2),
            "total_return_pct": round(total_return, 2),
            "buy_hold_return_pct": round(buy_hold_return, 2),
            "total_trades": len(sell_trades),
            "winning_trades": len(winning),
            "losing_trades": len(losing),
            "win_rate_pct": round(win_rate, 2),
            "avg_profit": round(avg_profit, 2),
            "avg_loss": round(avg_loss, 2),
            "profit_factor": round(profit_factor, 4) if profit_factor != float("inf") else 999.0,
            "max_drawdown_pct": round(max_drawdown, 2),
            "sharpe_ratio": round(sharpe, 4),
            "trades": trades[-50:],
            "equity_curve": equity_curve,
        }
