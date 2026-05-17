import asyncio
import time
import logging
from datetime import datetime
from typing import Any
from strategies.base import BaseStrategy, Signal
from data_fetcher import fetch_ohlcv, fetch_current_price

logger = logging.getLogger(__name__)


class Position:
    def __init__(self, symbol: str, shares: float, entry_price: float, entry_time: str):
        self.symbol = symbol
        self.shares = shares
        self.entry_price = entry_price
        self.entry_time = entry_time

    def unrealized_pnl(self, current_price: float) -> float:
        return (current_price - self.entry_price) * self.shares

    def unrealized_pnl_pct(self, current_price: float) -> float:
        return (current_price - self.entry_price) / self.entry_price * 100

    def to_dict(self, current_price: float) -> dict:
        return {
            "symbol": self.symbol,
            "shares": round(self.shares, 6),
            "entry_price": round(self.entry_price, 4),
            "current_price": round(current_price, 4),
            "entry_time": self.entry_time,
            "unrealized_pnl": round(self.unrealized_pnl(current_price), 2),
            "unrealized_pnl_pct": round(self.unrealized_pnl_pct(current_price), 2),
            "market_value": round(self.shares * current_price, 2),
        }


class TradingAgent:
    def __init__(
        self,
        symbol: str,
        strategy: BaseStrategy,
        initial_capital: float = 10_000.0,
        interval_seconds: int = 60,
        commission: float = 0.001,
    ):
        self.symbol = symbol
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.interval_seconds = interval_seconds
        self.commission = commission

        self.position: Position | None = None
        self.trades: list[dict] = []
        self.equity_history: list[dict] = []
        self.running = False
        self._task: asyncio.Task | None = None
        self.last_signal: Signal = "HOLD"
        self.last_price: float = 0.0
        self.started_at: str = ""
        self.log_messages: list[str] = []

    def _log(self, msg: str):
        ts = datetime.utcnow().strftime("%H:%M:%S")
        entry = f"[{ts}] {msg}"
        self.log_messages.append(entry)
        if len(self.log_messages) > 200:
            self.log_messages = self.log_messages[-200:]
        logger.info(msg)

    async def start(self):
        if self.running:
            return
        self.running = True
        self.started_at = datetime.utcnow().isoformat()
        self._log(f"Agent started | Symbol={self.symbol} | Strategy={self.strategy.name}")
        self._task = asyncio.create_task(self._loop())

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._log("Agent stopped.")

    async def _loop(self):
        while self.running:
            try:
                await self._tick()
            except Exception as e:
                self._log(f"Error during tick: {e}")
            await asyncio.sleep(self.interval_seconds)

    async def _tick(self):
        loop = asyncio.get_event_loop()
        df = await loop.run_in_executor(None, lambda: fetch_ohlcv(self.symbol, period="3mo", interval="1d"))

        if df.empty:
            self._log("No data received.")
            return

        self.last_price = float(df["Close"].iloc[-1])
        signal = self.strategy.generate_signal(df)
        self.last_signal = signal

        self._log(f"Price={self.last_price:.4f} | Signal={signal}")

        if signal == "BUY" and self.position is None and self.cash > 0:
            self._execute_buy(self.last_price)
        elif signal == "SELL" and self.position is not None:
            self._execute_sell(self.last_price)

        self._record_equity()

    def _execute_buy(self, price: float):
        commission_cost = self.cash * self.commission
        invest = self.cash - commission_cost
        shares = invest / price
        self.position = Position(
            symbol=self.symbol,
            shares=shares,
            entry_price=price,
            entry_time=datetime.utcnow().isoformat(),
        )
        self.cash = 0.0
        trade = {
            "id": len(self.trades) + 1,
            "action": "BUY",
            "symbol": self.symbol,
            "price": round(price, 4),
            "shares": round(shares, 6),
            "value": round(shares * price, 2),
            "pnl": 0.0,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.trades.append(trade)
        self._log(f"BUY {shares:.4f} shares @ {price:.4f}")

    def _execute_sell(self, price: float):
        if self.position is None:
            return
        proceeds = self.position.shares * price * (1 - self.commission)
        pnl = proceeds - (self.position.shares * self.position.entry_price)
        trade = {
            "id": len(self.trades) + 1,
            "action": "SELL",
            "symbol": self.symbol,
            "price": round(price, 4),
            "shares": round(self.position.shares, 6),
            "value": round(proceeds, 2),
            "pnl": round(pnl, 2),
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.trades.append(trade)
        self.cash = proceeds
        self._log(f"SELL {self.position.shares:.4f} shares @ {price:.4f} | PnL={pnl:.2f}")
        self.position = None

    def _record_equity(self):
        equity = self.cash + (self.position.shares * self.last_price if self.position else 0.0)
        self.equity_history.append(
            {
                "timestamp": datetime.utcnow().isoformat(),
                "equity": round(equity, 2),
                "price": round(self.last_price, 4),
            }
        )
        if len(self.equity_history) > 1000:
            self.equity_history = self.equity_history[-1000:]

    def get_state(self) -> dict[str, Any]:
        equity = self.cash + (
            self.position.shares * self.last_price if self.position else 0.0
        )
        pnl = equity - self.initial_capital
        pnl_pct = pnl / self.initial_capital * 100

        realized_pnl = sum(t["pnl"] for t in self.trades if t["action"] == "SELL")

        return {
            "running": self.running,
            "symbol": self.symbol,
            "strategy": self.strategy.name,
            "last_price": round(self.last_price, 4),
            "last_signal": self.last_signal,
            "cash": round(self.cash, 2),
            "equity": round(equity, 2),
            "initial_capital": self.initial_capital,
            "total_pnl": round(pnl, 2),
            "total_pnl_pct": round(pnl_pct, 2),
            "realized_pnl": round(realized_pnl, 2),
            "unrealized_pnl": round(
                self.position.unrealized_pnl(self.last_price) if self.position else 0.0, 2
            ),
            "position": self.position.to_dict(self.last_price) if self.position else None,
            "trades": self.trades[-50:],
            "equity_history": self.equity_history[-200:],
            "log_messages": self.log_messages[-50:],
            "started_at": self.started_at,
            "total_trades": len([t for t in self.trades if t["action"] == "SELL"]),
            "winning_trades": len([t for t in self.trades if t["action"] == "SELL" and t["pnl"] > 0]),
        }
