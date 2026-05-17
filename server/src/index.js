import cors from "cors";
import express from "express";
import { runBacktest } from "./backtest.js";
import { MODEL_REGISTRY } from "./models.js";
import { TradingEngine } from "./tradingEngine.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const engine = new TradingEngine();
const app = express();

app.use(cors());
app.use(express.json());

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseStartConfig = (body = {}) => ({
  modelId: typeof body.modelId === "string" ? body.modelId : "momentum-ma",
  symbol: typeof body.symbol === "string" ? body.symbol.toUpperCase() : "BTC-USD",
  initialCapital: parseNumber(body.initialCapital, 10_000),
  riskPerTrade: parseNumber(body.riskPerTrade, 0.2),
  stopLossPct: parseNumber(body.stopLossPct, 0.03),
  takeProfitPct: parseNumber(body.takeProfitPct, 0.07),
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get("/api/models", (_req, res) => {
  res.json({
    models: MODEL_REGISTRY.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      riskProfile: model.riskProfile,
    })),
  });
});

app.get("/api/state", (_req, res) => {
  res.json(engine.getSnapshot());
});

app.post("/api/trading/start", (req, res) => {
  const config = parseStartConfig(req.body);
  const state = engine.start(config);
  res.json({
    message: "Trading session started.",
    state,
    warning:
      "This engine is a simulation and cannot guarantee profits in real-world markets.",
  });
});

app.post("/api/trading/stop", (_req, res) => {
  const state = engine.stop();
  res.json({
    message: "Trading session stopped.",
    state,
  });
});

app.post("/api/backtest/run", (req, res) => {
  const config = parseStartConfig(req.body);
  const candles = Math.max(60, Math.min(3000, parseNumber(req.body?.candles, 500)));
  const result = runBacktest({
    ...config,
    candles,
  });
  res.json(result);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Trading agent API listening on port ${PORT}`);
});
