import cors from "cors";
import express from "express";
import {
  advanceTradingSession,
  createTradingSession,
  getAppConfig,
  getSessionSnapshot,
  runBacktest,
  stopTradingSession,
} from "./src/simulator.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

let activeSession = null;
let timer = null;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function syncTimer() {
  clearTimer();

  if (!activeSession?.isRunning) {
    return;
  }

  timer = setInterval(() => {
    if (!activeSession?.isRunning) {
      clearTimer();
      return;
    }

    advanceTradingSession(activeSession);

    if (!activeSession.isRunning) {
      clearTimer();
    }
  }, activeSession.tickIntervalMs);
}

app.get("/api/bootstrap", (_request, response) => {
  response.json({
    config: getAppConfig(),
    dashboard: getSessionSnapshot(activeSession),
  });
});

app.get("/api/session", (_request, response) => {
  response.json(getSessionSnapshot(activeSession));
});

app.post("/api/trading/start", (request, response) => {
  clearTimer();

  activeSession = createTradingSession(request.body ?? {});
  syncTimer();

  response.status(201).json(getSessionSnapshot(activeSession));
});

app.post("/api/trading/stop", (_request, response) => {
  clearTimer();
  activeSession = stopTradingSession(activeSession);
  response.json(getSessionSnapshot(activeSession));
});

app.post("/api/backtest", (request, response) => {
  response.json(
    runBacktest({
      ...request.body,
      seed: `${request.body?.symbolId ?? "BTC/USD"}-${Date.now()}`,
    }),
  );
});

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Trading simulation API listening on port ${port}`);
});
