from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.data import fetch_recent_daily, last_bar_timestamp
from app.schemas import SessionState, TradeRecord
from app.strategies import Strategy, get_strategy

logger = logging.getLogger(__name__)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TradingSession:
    session_id: str
    symbol: str
    model_id: str
    initial_cash: float
    poll_seconds: int
    cash: float = 0.0
    shares: float = 0.0
    avg_cost: float = 0.0
    status: str = "created"
    trades: list[dict] = field(default_factory=list)
    last_signal: str = ""
    last_price: float | None = None
    last_bar: datetime | None = None
    last_update: str | None = None
    error: str | None = None
    _task: asyncio.Task | None = None
    subscribers: set[asyncio.Queue] = field(default_factory=set)

    def __post_init__(self) -> None:
        self.cash = float(self.initial_cash)

    def equity(self) -> float:
        p = self.last_price or 0.0
        return float(self.cash + self.shares * p)

    def unrealized(self) -> float:
        if self.shares <= 0 or self.last_price is None:
            return 0.0
        return float(self.shares * (self.last_price - self.avg_cost))

    def realized(self) -> float:
        return float(sum(t.get("realized_delta", 0.0) for t in self.trades))

    def to_state(self) -> SessionState:
        p = self.last_price or 0.0
        mv = self.shares * p
        eq = self.cash + mv
        realized = self.realized()
        unreal = self.unrealized()
        total = eq - float(self.initial_cash)
        pct = (total / self.initial_cash * 100) if self.initial_cash else 0.0
        return SessionState(
            session_id=self.session_id,
            symbol=self.symbol,
            model_id=self.model_id,
            status=self.status,  # type: ignore[arg-type]
            initial_cash=float(self.initial_cash),
            cash=float(self.cash),
            shares=float(self.shares),
            last_price=self.last_price,
            market_value=float(mv),
            equity=float(eq),
            realized_pnl=float(realized),
            unrealized_pnl=float(unreal),
            total_pnl=float(total),
            total_pnl_pct=float(pct),
            trades=[TradeRecord(**{k: t[k] for k in ("time", "side", "price", "shares", "notional", "reason") if k in t}) for t in self.trades[-50:]],
            last_signal=self.last_signal,
            last_update=self.last_update,
            error=self.error,
            poll_seconds=self.poll_seconds,
        )


class SessionManager:
    def __init__(self) -> None:
        self._sessions: dict[str, TradingSession] = {}

    def create(self, symbol: str, model_id: str, initial_cash: float, poll_seconds: int) -> TradingSession:
        get_strategy(model_id)
        sid = str(uuid.uuid4())
        s = TradingSession(
            session_id=sid,
            symbol=symbol.strip().upper(),
            model_id=model_id,
            initial_cash=initial_cash,
            poll_seconds=poll_seconds,
        )
        self._sessions[sid] = s
        return s

    def get(self, session_id: str) -> TradingSession | None:
        return self._sessions.get(session_id)

    async def subscribe(self, session_id: str) -> tuple[TradingSession, asyncio.Queue]:
        s = self._sessions.get(session_id)
        if s is None:
            raise KeyError(session_id)
        q: asyncio.Queue = asyncio.Queue(maxsize=50)
        s.subscribers.add(q)
        await q.put({"type": "snapshot", "state": s.to_state().model_dump()})
        return s, q

    def unsubscribe(self, session_id: str, q: asyncio.Queue) -> None:
        s = self._sessions.get(session_id)
        if s is None:
            return
        s.subscribers.discard(q)

    async def _broadcast(self, s: TradingSession) -> None:
        payload = {"type": "tick", "state": s.to_state().model_dump()}
        dead: list[asyncio.Queue] = []
        for q in list(s.subscribers):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            s.subscribers.discard(q)

    async def _loop(self, session_id: str) -> None:
        s = self._sessions.get(session_id)
        if s is None:
            return
        strat: Strategy = get_strategy(s.model_id)
        last_processed_bar: datetime | None = None
        while s.status == "running":
            try:
                df = fetch_recent_daily(s.symbol, period="6mo")
                bar_ts = last_bar_timestamp(df)
                price = float(df["close"].iloc[-1])
                s.last_price = price
                s.last_update = _utc_now_iso()
                s.last_signal = strat.explain_last(df)
                tgt = strat.position_target(df)
                want_long = tgt >= 0.5

                # Only trade on new daily bar to avoid churn
                new_bar = bar_ts is not None and (last_processed_bar is None or bar_ts > last_processed_bar)
                if new_bar:
                    last_processed_bar = bar_ts
                    if want_long and s.shares <= 0 and s.cash > 0:
                        fee = 1.0005
                        sh = s.cash / (price * fee)
                        cost = sh * price * fee
                        s.cash -= cost
                        s.shares = sh
                        s.avg_cost = price
                        tr = {
                            "time": _utc_now_iso(),
                            "side": "buy",
                            "price": price,
                            "shares": float(sh),
                            "notional": float(sh * price),
                            "reason": "model_long",
                            "realized_delta": 0.0,
                        }
                        s.trades.append(tr)
                    elif not want_long and s.shares > 0:
                        notional = s.shares * price
                        fee = 0.9995
                        proceeds = notional * fee
                        pnl = proceeds - (s.shares * s.avg_cost)
                        s.cash += proceeds
                        tr = {
                            "time": _utc_now_iso(),
                            "side": "sell",
                            "price": price,
                            "shares": float(s.shares),
                            "notional": float(notional),
                            "reason": "model_flat",
                            "realized_delta": float(pnl),
                        }
                        s.trades.append(tr)
                        s.shares = 0.0
                        s.avg_cost = 0.0

                s.error = None
                await self._broadcast(s)
            except Exception as e:  # noqa: BLE001
                logger.exception("session tick failed")
                s.error = str(e)
                s.status = "error"
                await self._broadcast(s)
                break
            await asyncio.sleep(s.poll_seconds)

        if s.status == "running":
            s.status = "stopped"
        await self._broadcast(s)

    def start(self, session_id: str) -> None:
        s = self._sessions.get(session_id)
        if s is None:
            raise KeyError(session_id)
        if s.status == "running":
            return
        s.status = "running"
        s.error = None
        s._task = asyncio.create_task(self._loop(session_id))

    async def stop(self, session_id: str) -> None:
        s = self._sessions.get(session_id)
        if s is None:
            raise KeyError(session_id)
        s.status = "stopped"
        if s._task:
            s._task.cancel()
            try:
                await s._task
            except asyncio.CancelledError:
                pass
            s._task = None
        await self._broadcast(s)


manager = SessionManager()
