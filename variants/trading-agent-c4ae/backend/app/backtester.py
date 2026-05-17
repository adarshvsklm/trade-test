import pandas as pd
import numpy as np
from .strategies import get_strategy
from .data_fetcher import get_historical_data
from .models import BacktestResult
import logging

logger = logging.getLogger(__name__)


def run_backtest(
    symbol: str,
    strategy_name: str,
    start_date: str,
    end_date: str,
    initial_capital: float = 10000.0,
) -> BacktestResult:
    df = get_historical_data(symbol, start=start_date, end=end_date)
    if len(df) < 60:
        raise ValueError("Not enough data for backtesting. Try a longer date range.")

    strategy = get_strategy(strategy_name)
    df = strategy.generate_signals(df)

    cash = initial_capital
    shares = 0
    position_entry_price = 0.0
    trades = []
    equity_curve = []
    trade_pnls = []
    peak_equity = initial_capital

    for i in range(len(df)):
        row = df.iloc[i]
        price = row["Close"]
        signal = row["signal"]
        date_str = df.index[i].strftime("%Y-%m-%d")
        portfolio_value = cash + shares * price

        if signal == 1 and shares == 0:
            shares_to_buy = int(cash * 0.95 / price)
            if shares_to_buy > 0:
                cost = shares_to_buy * price
                cash -= cost
                shares = shares_to_buy
                position_entry_price = price
                trades.append({
                    "date": date_str,
                    "side": "buy",
                    "price": round(price, 2),
                    "quantity": shares_to_buy,
                    "total": round(cost, 2),
                    "pnl": None,
                })

        elif signal == -1 and shares > 0:
            revenue = shares * price
            pnl = (price - position_entry_price) * shares
            trade_pnls.append(pnl)
            cash += revenue
            trades.append({
                "date": date_str,
                "side": "sell",
                "price": round(price, 2),
                "quantity": shares,
                "total": round(revenue, 2),
                "pnl": round(pnl, 2),
            })
            shares = 0

        portfolio_value = cash + shares * price
        peak_equity = max(peak_equity, portfolio_value)

        equity_curve.append({
            "date": date_str,
            "value": round(portfolio_value, 2),
            "drawdown": round((portfolio_value - peak_equity) / peak_equity * 100, 2) if peak_equity > 0 else 0,
        })

    final_value = cash + shares * df.iloc[-1]["Close"]
    total_return_pct = ((final_value - initial_capital) / initial_capital) * 100

    winning = [p for p in trade_pnls if p > 0]
    losing = [p for p in trade_pnls if p <= 0]
    win_rate = len(winning) / len(trade_pnls) * 100 if trade_pnls else 0

    equity_values = [e["value"] for e in equity_curve]
    if len(equity_values) > 1:
        returns = pd.Series(equity_values).pct_change().dropna()
        sharpe = (returns.mean() / returns.std()) * np.sqrt(252) if returns.std() > 0 else 0
    else:
        sharpe = 0

    drawdowns = [e["drawdown"] for e in equity_curve]
    max_drawdown = abs(min(drawdowns)) if drawdowns else 0

    buy_hold_return = ((df.iloc[-1]["Close"] - df.iloc[0]["Close"]) / df.iloc[0]["Close"]) * 100

    return BacktestResult(
        strategy=strategy_name,
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        initial_capital=initial_capital,
        final_value=round(final_value, 2),
        total_return_pct=round(total_return_pct, 2),
        total_trades=len(trades),
        winning_trades=len(winning),
        losing_trades=len(losing),
        win_rate=round(win_rate, 2),
        sharpe_ratio=round(sharpe, 4),
        max_drawdown=round(max_drawdown, 2),
        avg_trade_pnl=round(np.mean(trade_pnls), 2) if trade_pnls else 0,
        best_trade=round(max(trade_pnls), 2) if trade_pnls else 0,
        worst_trade=round(min(trade_pnls), 2) if trade_pnls else 0,
        equity_curve=equity_curve,
        trades=trades,
        buy_hold_return_pct=round(buy_hold_return, 2),
    )
