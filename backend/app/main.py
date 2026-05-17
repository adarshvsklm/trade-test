from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.backtest import run_backtest
from app.schemas import (
    BacktestMetrics,
    BacktestRequest,
    BacktestResponse,
    CreateSessionRequest,
    EquityPoint,
    ModelInfo,
    SessionState,
    TradeRecord,
)
from app.session_manager import manager
from app.strategies import list_strategies

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title="Trading Agent API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/models", response_model=list[ModelInfo])
def api_models() -> list[ModelInfo]:
    return [ModelInfo(**m.__dict__) for m in list_strategies()]


@app.post("/api/backtest", response_model=BacktestResponse)
def api_backtest(body: BacktestRequest) -> BacktestResponse:
    if body.start >= body.end:
        raise HTTPException(status_code=400, detail="start must be before end")
    try:
        res = run_backtest(
            body.symbol,
            body.model_id,
            body.start,
            body.end,
            body.initial_cash,
        )
    except KeyError:
        raise HTTPException(status_code=400, detail="unknown model_id") from None
    except Exception as e:  # noqa: BLE001
        logger.exception("backtest failed")
        raise HTTPException(status_code=400, detail=str(e)) from e
    return BacktestResponse(
        symbol=body.symbol.strip().upper(),
        model_id=body.model_id,
        metrics=BacktestMetrics(**res.metrics),
        equity_curve=[EquityPoint(**row) for row in res.equity_curve],
        trades=[
            TradeRecord(
                time=t["time"],
                side=t["side"],
                price=t["price"],
                shares=t["shares"],
                notional=t["notional"],
                reason=t["reason"],
            )
            for t in res.trades
        ],
    )


@app.post("/api/sessions", response_model=SessionState)
def create_session(body: CreateSessionRequest) -> SessionState:
    try:
        s = manager.create(body.symbol, body.model_id, body.initial_cash, body.poll_seconds)
    except KeyError:
        raise HTTPException(status_code=400, detail="unknown model_id") from None
    return s.to_state()


@app.get("/api/sessions/{session_id}", response_model=SessionState)
def get_session(session_id: str) -> SessionState:
    s = manager.get(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="session not found")
    return s.to_state()


@app.post("/api/sessions/{session_id}/start", response_model=SessionState)
def start_session(session_id: str) -> SessionState:
    s = manager.get(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="session not found")
    try:
        if s.status in ("error", "stopped"):
            s.error = None
        manager.start(session_id)
    except KeyError:
        raise HTTPException(status_code=400, detail="unknown model") from None
    return s.to_state()


@app.post("/api/sessions/{session_id}/stop", response_model=SessionState)
async def stop_session(session_id: str) -> SessionState:
    s = manager.get(session_id)
    if s is None:
        raise HTTPException(status_code=404, detail="session not found")
    await manager.stop(session_id)
    s2 = manager.get(session_id)
    assert s2 is not None
    return s2.to_state()


@app.websocket("/ws/sessions/{session_id}")
async def ws_session(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    try:
        _, q = await manager.subscribe(session_id)
    except KeyError:
        await websocket.close(code=4404)
        return
    try:
        while True:
            msg = await q.get()
            await websocket.send_json(msg)
    except WebSocketDisconnect:
        manager.unsubscribe(session_id, q)
