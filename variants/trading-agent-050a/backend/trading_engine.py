import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional

import numpy as np
import pandas as pd

from models import (
    BacktestRequest,
    BacktestResult,
    PortfolioState,
    StrategyType,
    Trade,
    TradeAction,
    TradingConfig,
)
from strategies import STRATEGY_MAP
from sample_data import generate_ohlcv, generate_ohlcv_range, generate_quote as sample_quote

logger = logging.getLogger(__name__)

USE_LIVE_DATA = True

try:
    import yfinance as yf
except ImportError:
    USE_LIVE_DATA = False


def fetch_market_data(symbol: str, period: str = "6mo", interval: str = "1d") -> pd.DataFrame:
    if USE_LIVE_DATA:
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period=period, interval=interval)
            if not df.empty:
                return df
        except Exception as e:
            logger.warning(f"Live data failed for {symbol}: {e}")

    period_days = {"1mo": 30, "3mo": 90, "6mo": 180, "1y": 365, "2y": 730}.get(period, 180)
    logger.info(f"Using sample data for {symbol} ({period_days} days)")
    return generate_ohlcv(symbol, days=period_days)


def fetch_market_data_range(symbol: str, start: str, end: str) -> pd.DataFrame:
    if USE_LIVE_DATA:
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(start=start, end=end)
            if not df.empty:
                return df
        except Exception as e:
            logger.warning(f"Live data failed for {symbol}: {e}")

    logger.info(f"Using sample data for {symbol} ({start} to {end})")
    return generate_ohlcv_range(symbol, start, end)


def get_quote(symbol: str) -> dict:
    if USE_LIVE_DATA:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            hist = ticker.history(period="5d")
            if not hist.empty:
                current = hist["Close"].iloc[-1]
                prev = hist["Close"].iloc[-2] if len(hist) > 1 else current
                change = current - prev
                change_pct = (change / prev) * 100 if prev else 0
                return {
                    "symbol": symbol,
                    "price": round(current, 2),
                    "change": round(change, 2),
                    "change_pct": round(change_pct, 2),
                    "name": info.get("shortName", symbol),
                    "market_cap": info.get("marketCap"),
                    "volume": int(hist["Volume"].iloc[-1]) if pd.notna(hist["Volume"].iloc[-1]) else 0,
                    "day_high": round(hist["High"].iloc[-1], 2),
                    "day_low": round(hist["Low"].iloc[-1], 2),
                }
        except Exception as e:
            logger.warning(f"Live quote failed for {symbol}: {e}")

    return sample_quote(symbol)


class Backtester:
    def run(self, request: BacktestRequest) -> BacktestResult:
        df = fetch_market_data_range(request.symbol, request.start_date, request.end_date)
        strategy = STRATEGY_MAP[request.strategy]()
        df = strategy.generate_signals(df)

        cash = request.initial_capital
        holdings = 0.0
        trades: list[Trade] = []
        equity_curve = []
        entry_price = 0.0

        for i, (idx, row) in enumerate(df.iterrows()):
            price = row["Close"]
            signal = row.get("signal", TradeAction.HOLD.value)
            portfolio_value = cash + holdings * price

            if signal == TradeAction.BUY.value and cash > 0:
                trade_amount = cash * request.trade_size_pct
                qty = trade_amount / price
                cash -= qty * price
                holdings += qty
                entry_price = price
                trades.append(Trade(
                    timestamp=idx.to_pydatetime(),
                    symbol=request.symbol,
                    action=TradeAction.BUY,
                    price=round(price, 2),
                    quantity=round(qty, 4),
                    strategy=request.strategy,
                    portfolio_value=round(cash + holdings * price, 2),
                ))
            elif signal == TradeAction.SELL.value and holdings > 0:
                pnl = (price - entry_price) * holdings
                cash += holdings * price
                trades.append(Trade(
                    timestamp=idx.to_pydatetime(),
                    symbol=request.symbol,
                    action=TradeAction.SELL,
                    price=round(price, 2),
                    quantity=round(holdings, 4),
                    strategy=request.strategy,
                    pnl=round(pnl, 2),
                    portfolio_value=round(cash, 2),
                ))
                holdings = 0.0
                entry_price = 0.0

            equity_curve.append({
                "date": idx.strftime("%Y-%m-%d"),
                "value": round(cash + holdings * price, 2),
                "price": round(price, 2),
            })

        final_value = cash + holdings * df["Close"].iloc[-1]
        total_return = ((final_value - request.initial_capital) / request.initial_capital) * 100

        equity_values = [e["value"] for e in equity_curve]
        peak = equity_values[0]
        max_dd = 0.0
        for v in equity_values:
            if v > peak:
                peak = v
            dd = (peak - v) / peak * 100
            if dd > max_dd:
                max_dd = dd

        returns = pd.Series(equity_values).pct_change().dropna()
        sharpe = (returns.mean() / returns.std() * np.sqrt(252)) if returns.std() > 0 else 0.0

        winning = [t for t in trades if t.action == TradeAction.SELL and t.pnl > 0]
        losing = [t for t in trades if t.action == TradeAction.SELL and t.pnl <= 0]

        return BacktestResult(
            total_trades=len(trades),
            winning_trades=len(winning),
            losing_trades=len(losing),
            total_return_pct=round(total_return, 2),
            max_drawdown_pct=round(max_dd, 2),
            sharpe_ratio=round(sharpe, 2),
            final_portfolio_value=round(final_value, 2),
            initial_capital=request.initial_capital,
            trades=trades,
            equity_curve=equity_curve,
            strategy=request.strategy,
            symbol=request.symbol,
        )


class PaperTradingEngine:
    """Simulated trading engine that uses real market data but virtual money."""

    def __init__(self, config: TradingConfig):
        self.config = config
        self.cash = config.initial_capital
        self.holdings: dict[str, float] = {}
        self.entry_prices: dict[str, float] = {}
        self.trades: list[Trade] = []
        self.is_running = False
        self.strategy = STRATEGY_MAP[config.strategy]()
        self._task: Optional[asyncio.Task] = None
        self.current_signals: dict = {}
        self.current_price: float = 0.0
        self.realized_pnl: float = 0.0

    @property
    def portfolio_value(self) -> float:
        stock_value = sum(
            qty * self.current_price
            for sym, qty in self.holdings.items()
        )
        return self.cash + stock_value

    @property
    def unrealized_pnl(self) -> float:
        total = 0.0
        for sym, qty in self.holdings.items():
            entry = self.entry_prices.get(sym, self.current_price)
            total += (self.current_price - entry) * qty
        return total

    def get_portfolio_state(self) -> PortfolioState:
        return PortfolioState(
            cash=round(self.cash, 2),
            holdings={k: round(v, 4) for k, v in self.holdings.items()},
            total_value=round(self.portfolio_value, 2),
            unrealized_pnl=round(self.unrealized_pnl, 2),
            realized_pnl=round(self.realized_pnl, 2),
        )

    def get_status(self) -> dict:
        return {
            "is_running": self.is_running,
            "symbol": self.config.symbol,
            "strategy": self.config.strategy.value,
            "portfolio": self.get_portfolio_state().model_dump(),
            "recent_trades": [t.model_dump() for t in self.trades[-20:]],
            "signals": self.current_signals,
            "current_price": self.current_price,
            "config": {
                "initial_capital": self.config.initial_capital,
                "trade_size_pct": self.config.trade_size_pct,
                "stop_loss_pct": self.config.stop_loss_pct,
                "take_profit_pct": self.config.take_profit_pct,
            },
        }

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info(f"Started paper trading {self.config.symbol} with {self.strategy.name}")

    async def stop(self):
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Paper trading stopped")

    async def _run_loop(self):
        while self.is_running:
            try:
                await self._tick()
            except Exception as e:
                logger.error(f"Trading tick error: {e}")
            await asyncio.sleep(30)

    async def _tick(self):
        df = fetch_market_data(self.config.symbol, period="3mo", interval="1d")
        self.current_price = round(df["Close"].iloc[-1], 2)
        self.current_signals = self.strategy.get_current_signal(df)

        action = self.current_signals.get("action", TradeAction.HOLD.value)
        sym = self.config.symbol

        if action == TradeAction.BUY.value and self.cash > 0:
            trade_amount = self.cash * self.config.trade_size_pct
            qty = trade_amount / self.current_price
            self.cash -= qty * self.current_price
            self.holdings[sym] = self.holdings.get(sym, 0) + qty
            if sym not in self.entry_prices:
                self.entry_prices[sym] = self.current_price

            self.trades.append(Trade(
                timestamp=datetime.now(),
                symbol=sym,
                action=TradeAction.BUY,
                price=self.current_price,
                quantity=round(qty, 4),
                strategy=self.config.strategy,
                portfolio_value=round(self.portfolio_value, 2),
            ))
            logger.info(f"BUY {qty:.4f} {sym} @ {self.current_price}")

        elif action == TradeAction.SELL.value and self.holdings.get(sym, 0) > 0:
            qty = self.holdings[sym]
            entry = self.entry_prices.get(sym, self.current_price)
            pnl = (self.current_price - entry) * qty
            self.realized_pnl += pnl
            self.cash += qty * self.current_price
            self.holdings[sym] = 0
            self.entry_prices.pop(sym, None)

            self.trades.append(Trade(
                timestamp=datetime.now(),
                symbol=sym,
                action=TradeAction.SELL,
                price=self.current_price,
                quantity=round(qty, 4),
                strategy=self.config.strategy,
                pnl=round(pnl, 2),
                portfolio_value=round(self.portfolio_value, 2),
            ))
            logger.info(f"SELL {qty:.4f} {sym} @ {self.current_price}, PnL: {pnl:.2f}")

        if self.holdings.get(sym, 0) > 0:
            entry = self.entry_prices.get(sym, self.current_price)
            change_pct = (self.current_price - entry) / entry

            if change_pct <= -self.config.stop_loss_pct:
                qty = self.holdings[sym]
                pnl = (self.current_price - entry) * qty
                self.realized_pnl += pnl
                self.cash += qty * self.current_price
                self.holdings[sym] = 0
                self.entry_prices.pop(sym, None)
                self.trades.append(Trade(
                    timestamp=datetime.now(),
                    symbol=sym,
                    action=TradeAction.SELL,
                    price=self.current_price,
                    quantity=round(qty, 4),
                    strategy=self.config.strategy,
                    pnl=round(pnl, 2),
                    portfolio_value=round(self.portfolio_value, 2),
                ))
                logger.info(f"STOP-LOSS triggered for {sym}")

            elif change_pct >= self.config.take_profit_pct:
                qty = self.holdings[sym]
                pnl = (self.current_price - entry) * qty
                self.realized_pnl += pnl
                self.cash += qty * self.current_price
                self.holdings[sym] = 0
                self.entry_prices.pop(sym, None)
                self.trades.append(Trade(
                    timestamp=datetime.now(),
                    symbol=sym,
                    action=TradeAction.SELL,
                    price=self.current_price,
                    quantity=round(qty, 4),
                    strategy=self.config.strategy,
                    pnl=round(pnl, 2),
                    portfolio_value=round(self.portfolio_value, 2),
                ))
                logger.info(f"TAKE-PROFIT triggered for {sym}")
