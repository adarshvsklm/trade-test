"""Live paper-trading engine.

Runs a strategy on a symbol in a background loop, evaluating the latest
signal each tick and updating a virtual portfolio. Uses synthetic next-bar
generation so the simulation continues even when markets are closed or no
live data is available — perfect for demos and offline use.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List, Optional

import pandas as pd

from .data import append_synthetic_bar, get_ohlcv
from .strategies import get_strategy


@dataclass
class Position:
    symbol: str
    side: int          # 1 long, -1 short, 0 flat
    qty: float
    entry_price: float
    entry_time: str


@dataclass
class TradeLog:
    time: str
    symbol: str
    action: str        # "BUY", "SELL", "SHORT", "COVER"
    price: float
    qty: float
    pnl: float = 0.0
    note: str = ""


@dataclass
class TraderState:
    running: bool = False
    symbol: str = "AAPL"
    strategy: str = "sma_crossover"
    params: Dict[str, Any] = field(default_factory=dict)
    interval_sec: float = 2.0
    initial_capital: float = 10_000.0
    cash: float = 10_000.0
    equity: float = 10_000.0
    position: Optional[Position] = None
    last_price: float = 0.0
    last_signal: int = 0
    allow_short: bool = True
    fee_bps: float = 5.0
    started_at: Optional[str] = None
    trades: List[TradeLog] = field(default_factory=list)
    equity_curve: Deque[Dict[str, Any]] = field(default_factory=lambda: deque(maxlen=500))
    error: Optional[str] = None

    def snapshot(self) -> Dict[str, Any]:
        d = {
            "running": self.running,
            "symbol": self.symbol,
            "strategy": self.strategy,
            "params": self.params,
            "interval_sec": self.interval_sec,
            "initial_capital": self.initial_capital,
            "cash": self.cash,
            "equity": self.equity,
            "position": asdict(self.position) if self.position else None,
            "last_price": self.last_price,
            "last_signal": self.last_signal,
            "allow_short": self.allow_short,
            "fee_bps": self.fee_bps,
            "started_at": self.started_at,
            "trades": [asdict(t) for t in self.trades[-50:]],
            "equity_curve": list(self.equity_curve),
            "pnl": self.equity - self.initial_capital,
            "pnl_pct": (self.equity / self.initial_capital - 1.0) * 100.0
            if self.initial_capital else 0.0,
            "error": self.error,
        }
        return d


class PaperTrader:
    """Single-symbol paper trader running in a background thread."""

    def __init__(self) -> None:
        self.state = TraderState()
        self._lock = threading.Lock()
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._df: Optional[pd.DataFrame] = None

    # ---------- public API ----------

    def configure(self, **kwargs: Any) -> None:
        with self._lock:
            for k, v in kwargs.items():
                if hasattr(self.state, k) and v is not None:
                    setattr(self.state, k, v)
            # Reset capital if not started.
            if not self.state.running:
                self.state.cash = self.state.initial_capital
                self.state.equity = self.state.initial_capital
                self.state.position = None
                self.state.trades = []
                self.state.equity_curve.clear()

    def start(self) -> Dict[str, Any]:
        with self._lock:
            if self.state.running:
                return self.state.snapshot()
            self.state.error = None
            try:
                self._df = get_ohlcv(self.state.symbol, period_days=120, interval="1d")
            except Exception as e:
                self.state.error = f"Failed to fetch data: {e}"
                return self.state.snapshot()
            self.state.last_price = float(self._df["Close"].iloc[-1])
            self.state.cash = self.state.initial_capital
            self.state.equity = self.state.initial_capital
            self.state.position = None
            self.state.trades = []
            self.state.equity_curve.clear()
            self.state.equity_curve.append({
                "t": datetime.now(timezone.utc).isoformat(),
                "equity": self.state.equity,
                "price": self.state.last_price,
            })
            self.state.started_at = datetime.now(timezone.utc).isoformat()
            self.state.running = True
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()
        return self.snapshot()

    def stop(self) -> Dict[str, Any]:
        with self._lock:
            if not self.state.running:
                return self.state.snapshot()
            self._stop_event.set()
            self.state.running = False
        if self._thread is not None:
            self._thread.join(timeout=3.0)
        # Flatten any open position on stop, marked to last price.
        with self._lock:
            if self.state.position is not None:
                self._close_position(self.state.last_price, note="Stopped trader")
            return self.state.snapshot()

    def reset(self) -> Dict[str, Any]:
        self.stop()
        with self._lock:
            self.state.cash = self.state.initial_capital
            self.state.equity = self.state.initial_capital
            self.state.position = None
            self.state.trades = []
            self.state.equity_curve.clear()
            self.state.last_signal = 0
            self.state.started_at = None
            self.state.error = None
        return self.snapshot()

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return self.state.snapshot()

    # ---------- internals ----------

    def _run(self) -> None:
        try:
            strat = get_strategy(self.state.strategy)
        except Exception as e:
            with self._lock:
                self.state.error = str(e)
                self.state.running = False
            return

        while not self._stop_event.is_set():
            try:
                with self._lock:
                    self._df = append_synthetic_bar(self._df, self.state.symbol)  # type: ignore[arg-type]
                    df = self._df
                    params = dict(self.state.params)
                    allow_short = self.state.allow_short
                signals = strat.generate_signals(df, params)
                if not allow_short:
                    signals = signals.clip(lower=0)
                signal = int(signals.iloc[-1])
                price = float(df["Close"].iloc[-1])
                with self._lock:
                    self.state.last_price = price
                    self.state.last_signal = signal
                    self._apply_signal(signal, price)
                    # Mark-to-market equity
                    self.state.equity = self._mark_equity(price)
                    self.state.equity_curve.append({
                        "t": datetime.now(timezone.utc).isoformat(),
                        "equity": self.state.equity,
                        "price": price,
                    })
            except Exception as e:
                with self._lock:
                    self.state.error = f"Loop error: {e}"
            self._stop_event.wait(max(0.2, self.state.interval_sec))

    def _apply_signal(self, signal: int, price: float) -> None:
        pos = self.state.position
        current_side = pos.side if pos else 0
        if signal == current_side:
            return
        # Close existing position first.
        if pos is not None:
            self._close_position(price, note=f"Flip to {signal}")
        # Open new position with all available cash if signal != 0.
        if signal != 0 and self.state.cash > 1.0:
            fee = self.state.cash * (self.state.fee_bps / 10_000.0)
            invest = self.state.cash - fee
            qty = invest / price if price > 0 else 0
            self.state.cash = 0.0
            self.state.position = Position(
                symbol=self.state.symbol,
                side=signal,
                qty=qty,
                entry_price=price,
                entry_time=datetime.now(timezone.utc).isoformat(),
            )
            action = "BUY" if signal > 0 else "SHORT"
            self.state.trades.append(TradeLog(
                time=datetime.now(timezone.utc).isoformat(),
                symbol=self.state.symbol,
                action=action,
                price=price,
                qty=qty,
                note=f"Open {('LONG' if signal>0 else 'SHORT')}",
            ))

    def _close_position(self, price: float, note: str = "") -> None:
        pos = self.state.position
        if pos is None:
            return
        # PnL based on side.
        gross = pos.qty * price if pos.side > 0 else pos.qty * (2 * pos.entry_price - price)
        fee = gross * (self.state.fee_bps / 10_000.0)
        proceeds = gross - fee
        pnl = proceeds - pos.qty * pos.entry_price
        self.state.cash = proceeds if pos.side > 0 else pos.qty * pos.entry_price + pnl
        action = "SELL" if pos.side > 0 else "COVER"
        self.state.trades.append(TradeLog(
            time=datetime.now(timezone.utc).isoformat(),
            symbol=pos.symbol,
            action=action,
            price=price,
            qty=pos.qty,
            pnl=pnl,
            note=note,
        ))
        self.state.position = None

    def _mark_equity(self, price: float) -> float:
        pos = self.state.position
        if pos is None:
            return self.state.cash
        if pos.side > 0:
            return self.state.cash + pos.qty * price
        # Short: profit when price falls.
        return self.state.cash + pos.qty * (2 * pos.entry_price - price)


# Singleton instance used by the API.
TRADER = PaperTrader()
