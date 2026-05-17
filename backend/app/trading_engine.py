import asyncio
import uuid
import logging
from datetime import datetime
from typing import Callable
from .strategies import get_strategy
from .data_fetcher import get_historical_data, get_current_price
from .models import Trade, OrderSide, PortfolioState

logger = logging.getLogger(__name__)


class TradingEngine:
    def __init__(self):
        self.sessions: dict[str, "TradingSession"] = {}

    def create_session(
        self,
        symbol: str,
        strategy_name: str,
        initial_capital: float,
        risk_per_trade: float,
        on_update: Callable | None = None,
    ) -> str:
        session_id = str(uuid.uuid4())[:8]
        session = TradingSession(
            session_id=session_id,
            symbol=symbol,
            strategy_name=strategy_name,
            initial_capital=initial_capital,
            risk_per_trade=risk_per_trade,
            on_update=on_update,
        )
        self.sessions[session_id] = session
        return session_id

    def get_session(self, session_id: str) -> "TradingSession | None":
        return self.sessions.get(session_id)

    def get_all_sessions(self) -> list[dict]:
        return [s.to_dict() for s in self.sessions.values()]

    async def start_session(self, session_id: str):
        session = self.sessions.get(session_id)
        if session and not session.running:
            await session.start()

    def stop_session(self, session_id: str):
        session = self.sessions.get(session_id)
        if session:
            session.stop()


class TradingSession:
    def __init__(
        self,
        session_id: str,
        symbol: str,
        strategy_name: str,
        initial_capital: float,
        risk_per_trade: float,
        on_update: Callable | None = None,
    ):
        self.session_id = session_id
        self.symbol = symbol
        self.strategy_name = strategy_name
        self.strategy = get_strategy(strategy_name)
        self.initial_capital = initial_capital
        self.cash = initial_capital
        self.risk_per_trade = risk_per_trade
        self.positions: dict[str, dict] = {}
        self.trades: list[Trade] = []
        self.running = False
        self.on_update = on_update
        self._task: asyncio.Task | None = None
        self.created_at = datetime.now().isoformat()
        self.equity_history: list[dict] = []

    @property
    def total_value(self) -> float:
        pos_value = sum(
            p["quantity"] * p.get("current_price", p["entry_price"])
            for p in self.positions.values()
        )
        return self.cash + pos_value

    @property
    def total_pnl(self) -> float:
        return self.total_value - self.initial_capital

    @property
    def total_pnl_pct(self) -> float:
        return (self.total_pnl / self.initial_capital) * 100 if self.initial_capital else 0

    @property
    def win_rate(self) -> float:
        completed = [t for t in self.trades if t.pnl is not None]
        if not completed:
            return 0
        wins = sum(1 for t in completed if t.pnl > 0)
        return (wins / len(completed)) * 100

    def get_portfolio_state(self) -> PortfolioState:
        pnls = [t.pnl for t in self.trades if t.pnl is not None]
        import numpy as np

        sharpe = 0.0
        if len(pnls) > 1:
            arr = np.array(pnls)
            sharpe = float((arr.mean() / arr.std()) * (252 ** 0.5)) if arr.std() > 0 else 0

        max_dd = 0.0
        if self.equity_history:
            values = [e["value"] for e in self.equity_history]
            peak = values[0]
            for v in values:
                peak = max(peak, v)
                dd = (peak - v) / peak * 100 if peak > 0 else 0
                max_dd = max(max_dd, dd)

        return PortfolioState(
            cash=round(self.cash, 2),
            positions={k: v for k, v in self.positions.items()},
            total_value=round(self.total_value, 2),
            total_pnl=round(self.total_pnl, 2),
            total_pnl_pct=round(self.total_pnl_pct, 2),
            trade_count=len(self.trades),
            win_rate=round(self.win_rate, 2),
            sharpe_ratio=round(sharpe, 4),
            max_drawdown=round(max_dd, 2),
        )

    async def start(self):
        self.running = True
        self._task = asyncio.create_task(self._run_loop())

    def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()

    async def _run_loop(self):
        try:
            while self.running:
                await self._tick()
                await asyncio.sleep(30)
        except asyncio.CancelledError:
            logger.info(f"Session {self.session_id} cancelled")
        except Exception as e:
            logger.error(f"Session {self.session_id} error: {e}")
            self.running = False

    async def _tick(self):
        try:
            df = get_historical_data(self.symbol, period="3mo", interval="1d")
            price_info = get_current_price(self.symbol)
            current_price = price_info["price"]

            for pos in self.positions.values():
                pos["current_price"] = current_price

            df_signals = self.strategy.generate_signals(df)
            latest_signal = int(df_signals["signal"].iloc[-1])
            indicators = self.strategy.get_indicators(df)

            if latest_signal == 1 and self.symbol not in self.positions:
                position_size = self.cash * self.risk_per_trade
                quantity = int(position_size / current_price)
                if quantity > 0:
                    self._execute_buy(current_price, quantity)

            elif latest_signal == -1 and self.symbol in self.positions:
                pos = self.positions[self.symbol]
                self._execute_sell(current_price, pos["quantity"])

            self.equity_history.append({
                "timestamp": datetime.now().isoformat(),
                "value": round(self.total_value, 2),
            })

            if self.on_update:
                await self.on_update({
                    "type": "tick",
                    "session_id": self.session_id,
                    "price": current_price,
                    "signal": latest_signal,
                    "indicators": indicators,
                    "portfolio": self.get_portfolio_state().model_dump(),
                    "timestamp": datetime.now().isoformat(),
                })

        except Exception as e:
            logger.error(f"Tick error for {self.session_id}: {e}")

    def _execute_buy(self, price: float, quantity: int):
        cost = price * quantity
        if cost > self.cash:
            quantity = int(self.cash / price)
            cost = price * quantity
        if quantity <= 0:
            return

        self.cash -= cost
        self.positions[self.symbol] = {
            "entry_price": price,
            "quantity": quantity,
            "current_price": price,
        }
        trade = Trade(
            id=str(uuid.uuid4())[:8],
            timestamp=datetime.now().isoformat(),
            symbol=self.symbol,
            side=OrderSide.BUY,
            price=round(price, 2),
            quantity=quantity,
            total=round(cost, 2),
            strategy=self.strategy_name,
        )
        self.trades.append(trade)
        logger.info(f"BUY {quantity} {self.symbol} @ {price}")

    def _execute_sell(self, price: float, quantity: int):
        if self.symbol not in self.positions:
            return

        pos = self.positions[self.symbol]
        revenue = price * quantity
        pnl = (price - pos["entry_price"]) * quantity

        self.cash += revenue
        del self.positions[self.symbol]

        trade = Trade(
            id=str(uuid.uuid4())[:8],
            timestamp=datetime.now().isoformat(),
            symbol=self.symbol,
            side=OrderSide.SELL,
            price=round(price, 2),
            quantity=quantity,
            total=round(revenue, 2),
            strategy=self.strategy_name,
            pnl=round(pnl, 2),
        )
        self.trades.append(trade)
        logger.info(f"SELL {quantity} {self.symbol} @ {price} PnL: {pnl:.2f}")

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "symbol": self.symbol,
            "strategy": self.strategy_name,
            "running": self.running,
            "initial_capital": self.initial_capital,
            "portfolio": self.get_portfolio_state().model_dump(),
            "trade_count": len(self.trades),
            "created_at": self.created_at,
        }


engine = TradingEngine()
