import { computeDrawdown, computeSharpe, ema, formatPercent, rsi, standardDeviation, sum } from "./indicators.js";
import { getModelById, modelCatalog } from "./models.js";
import { createRng, randomBetween, randomChoice } from "./random.js";

export const supportedSymbols = [
  { id: "BTC/USD", basePrice: 68000, drift: 0.0012, volatility: 0.022 },
  { id: "ETH/USD", basePrice: 3200, drift: 0.001, volatility: 0.02 },
  { id: "SOL/USD", basePrice: 145, drift: 0.0015, volatility: 0.03 },
  { id: "EUR/USD", basePrice: 1.08, drift: 0.00008, volatility: 0.003 },
];

export const riskProfiles = {
  conservative: {
    label: "Conservative",
    maxExposure: 0.12,
    stopLossPct: 0.015,
    takeProfitPct: 0.03,
    maxHoldCandles: 10,
    entryThreshold: 0.32,
  },
  balanced: {
    label: "Balanced",
    maxExposure: 0.18,
    stopLossPct: 0.022,
    takeProfitPct: 0.045,
    maxHoldCandles: 14,
    entryThreshold: 0.27,
  },
  aggressive: {
    label: "Aggressive",
    maxExposure: 0.25,
    stopLossPct: 0.03,
    takeProfitPct: 0.065,
    maxHoldCandles: 18,
    entryThreshold: 0.22,
  },
};

const regimeConfig = {
  "trend-up": { driftMultiplier: 1.6, volatilityMultiplier: 0.75 },
  "trend-down": { driftMultiplier: -1.25, volatilityMultiplier: 0.8 },
  range: { driftMultiplier: 0.1, volatilityMultiplier: 1.1 },
  breakout: { driftMultiplier: 0.7, volatilityMultiplier: 1.6 },
};

function getSymbol(symbolId) {
  return supportedSymbols.find((symbol) => symbol.id === symbolId) ?? supportedSymbols[0];
}

function getRiskProfile(riskProfileId) {
  return riskProfiles[riskProfileId] ?? riskProfiles.balanced;
}

function formatCurrency(symbolId, value) {
  if (symbolId.includes("USD") && symbolId.startsWith("EUR")) {
    return Number(value.toFixed(5));
  }

  return Number(value.toFixed(2));
}

function buildRegimePlan(rng, length) {
  const plan = [];
  let remaining = length;
  let candleIndex = 0;

  while (remaining > 0) {
    const regime = randomChoice(rng, ["trend-up", "range", "trend-up", "breakout", "range", "trend-down"]);
    const segmentLength = Math.min(remaining, Math.floor(randomBetween(rng, 18, 42)));

    for (let index = 0; index < segmentLength; index += 1) {
      plan.push({
        regime,
        candleIndex,
      });
      candleIndex += 1;
    }

    remaining -= segmentLength;
  }

  return plan;
}

function generateSyntheticCandles({ length = 220, symbolId, seed }) {
  const symbol = getSymbol(symbolId);
  const rng = createRng(`${symbol.id}:${seed}:${length}`);
  const regimePlan = buildRegimePlan(rng, length);
  const candles = [];
  let close = symbol.basePrice;

  for (let index = 0; index < length; index += 1) {
    const regime = regimePlan[index].regime;
    const config = regimeConfig[regime];
    const noise = (rng() - 0.5) * 2;
    const trendNoise = (rng() - 0.46) * 0.5;
    const returnPct =
      symbol.drift * config.driftMultiplier +
      symbol.volatility * config.volatilityMultiplier * noise * 0.32 +
      trendNoise * 0.002;
    const nextClose = Math.max(close * (1 + returnPct), symbol.basePrice * 0.25);
    const high = Math.max(close, nextClose) * (1 + randomBetween(rng, 0.001, 0.01));
    const low = Math.min(close, nextClose) * (1 - randomBetween(rng, 0.001, 0.01));
    const open = close;

    candles.push({
      timestamp: Date.now() - (length - index) * 60_000,
      open: formatCurrency(symbol.id, open),
      high: formatCurrency(symbol.id, high),
      low: formatCurrency(symbol.id, low),
      close: formatCurrency(symbol.id, nextClose),
      volume: Math.round(randomBetween(rng, 850, 4200) * (1 + Math.abs(noise))),
      regime,
    });

    close = nextClose;
  }

  return candles;
}

function buildFeatures(candles) {
  const closes = candles.map((candle) => candle.close);
  const latest = candles[candles.length - 1];
  const fastEma = ema(closes.slice(-16), 8);
  const slowEma = ema(closes.slice(-36), 21);
  const returns = closes.slice(-20).map((value, index, values) => {
    if (index === 0) {
      return 0;
    }

    return (value - values[index - 1]) / values[index - 1];
  });
  const shortSlopeBase = closes[Math.max(closes.length - 6, 0)] ?? latest.close;
  const shortSlope = shortSlopeBase === 0 ? 0 : (latest.close - shortSlopeBase) / shortSlopeBase;

  return {
    close: latest.close,
    fastEma,
    slowEma,
    rsi: rsi(closes, 14),
    volatility: standardDeviation(returns),
    shortSlope,
    emaSpread: latest.close === 0 ? 0 : (fastEma - slowEma) / latest.close,
    distanceFromSlowEma: latest.close === 0 ? 0 : (latest.close - slowEma) / latest.close,
    regime: latest.regime,
  };
}

function createEmptyState({ symbolId, modelId, capital, riskProfileId }) {
  return {
    symbolId,
    modelId,
    riskProfileId,
    startingBalance: capital,
    balance: capital,
    equity: capital,
    realizedPnl: 0,
    unrealizedPnl: 0,
    openPosition: null,
    trades: [],
    equityCurve: [],
    signalHistory: [],
  };
}

function maybeExitPosition(state, candle, decision, profile, features) {
  const position = state.openPosition;
  if (!position) {
    return;
  }

  const movePct = ((candle.close - position.entryPrice) / position.entryPrice) * position.direction;
  const unrealizedPnl = position.notional * movePct;
  const reachedStop = movePct <= -position.stopLossPct;
  const reachedTarget = movePct >= position.takeProfitPct;
  const timedOut = position.holdingCandles >= profile.maxHoldCandles;
  const signalFlip =
    (position.direction === 1 && decision.action === "sell" && decision.confidence > 0.35) ||
    (position.direction === -1 && decision.action === "buy" && decision.confidence > 0.35);

  position.holdingCandles += 1;
  state.unrealizedPnl = unrealizedPnl;
  state.equity = state.balance + unrealizedPnl;

  if (!reachedStop && !reachedTarget && !timedOut && !signalFlip) {
    return;
  }

  const exitReason = reachedTarget
    ? "Take profit"
    : reachedStop
      ? "Stop loss"
      : timedOut
        ? "Max hold reached"
        : `Signal flipped to ${decision.action}`;

  state.balance += unrealizedPnl;
  state.realizedPnl = state.balance - state.startingBalance;
  state.unrealizedPnl = 0;
  state.equity = state.balance;
  state.trades.push({
    id: `${position.entryTimestamp}-${candle.timestamp}`,
    side: position.direction === 1 ? "Long" : "Short",
    entryPrice: position.entryPrice,
    exitPrice: candle.close,
    entryTimestamp: position.entryTimestamp,
    exitTimestamp: candle.timestamp,
    confidence: position.confidence,
    pnl: Number(unrealizedPnl.toFixed(2)),
    returnPct: formatPercent(movePct),
    duration: position.holdingCandles,
    notional: Number(position.notional.toFixed(2)),
    exitReason,
    regime: features.regime,
  });
  state.openPosition = null;
}

function maybeEnterPosition(state, candle, decision, profile) {
  if (state.openPosition || decision.action === "hold" || decision.confidence < profile.entryThreshold) {
    return;
  }

  const direction = decision.action === "buy" ? 1 : -1;
  const exposureMultiplier = 0.45 + decision.confidence * 0.75;
  const notional = state.balance * profile.maxExposure * exposureMultiplier;

  state.openPosition = {
    side: decision.action,
    direction,
    entryPrice: candle.close,
    entryTimestamp: candle.timestamp,
    holdingCandles: 0,
    confidence: decision.confidence,
    signal: decision.signal,
    notional,
    stopLossPct: profile.stopLossPct,
    takeProfitPct: profile.takeProfitPct * (0.85 + decision.confidence * 0.35),
  };
}

function stepSimulation(state, candles, model, profile) {
  const candle = candles[candles.length - 1];
  const features = buildFeatures(candles);
  const decision = model.evaluate(features);

  state.signalHistory.push({
    timestamp: candle.timestamp,
    action: decision.action,
    confidence: Number(decision.confidence.toFixed(2)),
    signal: Number(decision.signal.toFixed(2)),
    reason: decision.reason,
    regime: features.regime,
  });

  if (state.signalHistory.length > 36) {
    state.signalHistory.shift();
  }

  maybeExitPosition(state, candle, decision, profile, features);
  maybeEnterPosition(state, candle, decision, profile);

  if (state.openPosition) {
    const movePct = ((candle.close - state.openPosition.entryPrice) / state.openPosition.entryPrice) * state.openPosition.direction;
    state.unrealizedPnl = state.openPosition.notional * movePct;
    state.equity = state.balance + state.unrealizedPnl;
  } else {
    state.unrealizedPnl = 0;
    state.equity = state.balance;
  }

  state.equityCurve.push({
    timestamp: candle.timestamp,
    price: candle.close,
    equity: Number(state.equity.toFixed(2)),
  });

  return {
    features,
    decision,
  };
}

function buildPerformance(state) {
  const winningTrades = state.trades.filter((trade) => trade.pnl > 0);
  const losingTrades = state.trades.filter((trade) => trade.pnl < 0);
  const grossProfit = sum(winningTrades.map((trade) => trade.pnl));
  const grossLoss = Math.abs(sum(losingTrades.map((trade) => trade.pnl)));
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? grossProfit : 0) : grossProfit / grossLoss;
  const returns = state.equityCurve.map((point, index, curve) => {
    if (index === 0) {
      return 0;
    }

    return (point.equity - curve[index - 1].equity) / curve[index - 1].equity;
  });

  return {
    startingBalance: Number(state.startingBalance.toFixed(2)),
    balance: Number(state.balance.toFixed(2)),
    equity: Number(state.equity.toFixed(2)),
    realizedPnl: Number(state.realizedPnl.toFixed(2)),
    unrealizedPnl: Number(state.unrealizedPnl.toFixed(2)),
    totalReturnPct: formatPercent((state.equity - state.startingBalance) / state.startingBalance),
    winRatePct: state.trades.length ? formatPercent(winningTrades.length / state.trades.length) : 0,
    maxDrawdownPct: formatPercent(computeDrawdown(state.equityCurve)),
    tradeCount: state.trades.length,
    profitFactor: Number(profitFactor.toFixed(2)),
    sharpe: Number(computeSharpe(returns).toFixed(2)),
  };
}

function buildAnalysis({ features, decision, candle, state, model }) {
  const positionBias = decision.signal > 0.2 ? "bullish" : decision.signal < -0.2 ? "bearish" : "neutral";
  const position = state.openPosition
    ? {
        side: state.openPosition.direction === 1 ? "Long" : "Short",
        entryPrice: state.openPosition.entryPrice,
        currentPrice: candle.close,
        notional: Number(state.openPosition.notional.toFixed(2)),
        stopLossPrice: formatCurrency(
          state.symbolId,
          state.openPosition.entryPrice * (1 - state.openPosition.direction * state.openPosition.stopLossPct),
        ),
        takeProfitPrice: formatCurrency(
          state.symbolId,
          state.openPosition.entryPrice * (1 + state.openPosition.direction * state.openPosition.takeProfitPct),
        ),
        holdingCandles: state.openPosition.holdingCandles,
        unrealizedPnl: Number(state.unrealizedPnl.toFixed(2)),
      }
    : null;

  return {
    marketRegime: features.regime,
    bias: positionBias,
    indicatorSnapshot: {
      fastEma: formatCurrency(state.symbolId, features.fastEma),
      slowEma: formatCurrency(state.symbolId, features.slowEma),
      emaSpreadPct: formatPercent(features.emaSpread),
      rsi: Number(features.rsi.toFixed(2)),
      volatilityPct: formatPercent(features.volatility),
    },
    modelDecision: {
      modelId: model.id,
      modelName: model.name,
      action: decision.action,
      confidence: formatPercent(decision.confidence),
      signal: Number(decision.signal.toFixed(2)),
      reason: decision.reason,
    },
    narrative: `${model.name} is ${positionBias} on ${state.symbolId} while the market is in ${features.regime} mode.`,
    position,
  };
}

function summarizeRun({ state, candles, lastStep, model, sessionInfo }) {
  const latestCandle = candles[candles.length - 1];
  const performance = buildPerformance(state);
  const analysis = buildAnalysis({
    features: lastStep.features,
    decision: lastStep.decision,
    candle: latestCandle,
    state,
    model,
  });

  return {
    session: sessionInfo,
    market: {
      symbolId: state.symbolId,
      currentPrice: latestCandle.close,
      lastUpdated: latestCandle.timestamp,
      candles: candles.slice(-80),
    },
    analysis,
    performance,
    recentTrades: state.trades.slice(-8).reverse(),
    recentSignals: state.signalHistory.slice(-8).reverse(),
    equityCurve: state.equityCurve.slice(-80),
  };
}

export function getAppConfig() {
  return {
    models: modelCatalog.map(({ evaluate, ...model }) => model),
    symbols: supportedSymbols.map(({ id }) => id),
    riskProfiles: Object.entries(riskProfiles).map(([id, profile]) => ({ id, ...profile })),
    defaults: {
      symbolId: supportedSymbols[0].id,
      modelId: modelCatalog[0].id,
      riskProfileId: "balanced",
      capital: 10000,
      tickIntervalMs: 1500,
      backtestCandles: 220,
    },
  };
}

export function createTradingSession({
  symbolId = supportedSymbols[0].id,
  modelId = modelCatalog[0].id,
  riskProfileId = "balanced",
  capital = 10000,
  tickIntervalMs = 1500,
} = {}) {
  const candles = generateSyntheticCandles({
    length: 420,
    symbolId,
    seed: `live-${modelId}-${riskProfileId}-${Date.now()}`,
  });
  const warmupLength = 60;
  const initialCandles = candles.slice(0, warmupLength);
  const model = getModelById(modelId);
  const profile = getRiskProfile(riskProfileId);
  const state = createEmptyState({ symbolId, modelId, capital, riskProfileId });

  let lastStep = {
    features: buildFeatures(initialCandles),
    decision: model.evaluate(buildFeatures(initialCandles)),
  };

  for (let index = 25; index < warmupLength; index += 1) {
    lastStep = stepSimulation(state, initialCandles.slice(0, index + 1), model, profile);
  }

  return {
    id: `session-${Date.now()}`,
    isRunning: true,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    tickIntervalMs,
    cursor: warmupLength,
    candles,
    state,
    model,
    profile,
    lastStep,
  };
}

export function advanceTradingSession(session) {
  if (!session?.isRunning) {
    return session;
  }

  if (session.cursor >= session.candles.length) {
    session.isRunning = false;
    session.updatedAt = Date.now();
    return session;
  }

  session.cursor += 1;
  const visibleCandles = session.candles.slice(0, session.cursor);
  session.lastStep = stepSimulation(session.state, visibleCandles, session.model, session.profile);
  session.updatedAt = Date.now();

  return session;
}

export function stopTradingSession(session) {
  if (!session) {
    return null;
  }

  session.isRunning = false;
  session.updatedAt = Date.now();
  return session;
}

export function getSessionSnapshot(session) {
  if (!session) {
    const config = getAppConfig();
    const seedRun = runBacktest({
      symbolId: config.defaults.symbolId,
      modelId: config.defaults.modelId,
      riskProfileId: config.defaults.riskProfileId,
      capital: config.defaults.capital,
      candles: 180,
      seed: "preview",
    });

    return {
      ...seedRun,
      session: {
        status: "idle",
        id: null,
        startedAt: null,
        tickIntervalMs: config.defaults.tickIntervalMs,
      },
    };
  }

  return summarizeRun({
    state: session.state,
    candles: session.candles.slice(0, session.cursor),
    lastStep: session.lastStep,
    model: session.model,
    sessionInfo: {
      status: session.isRunning ? "running" : "stopped",
      id: session.id,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      tickIntervalMs: session.tickIntervalMs,
      modelId: session.model.id,
      riskProfileId: session.state.riskProfileId,
    },
  });
}

export function runBacktest({
  symbolId = supportedSymbols[0].id,
  modelId = modelCatalog[0].id,
  riskProfileId = "balanced",
  capital = 10000,
  candles = 220,
  seed = "backtest",
} = {}) {
  const marketData = generateSyntheticCandles({
    length: Math.max(Number(candles) || 220, 100),
    symbolId,
    seed: `${seed}-${modelId}-${riskProfileId}`,
  });
  const model = getModelById(modelId);
  const profile = getRiskProfile(riskProfileId);
  const state = createEmptyState({ symbolId, modelId, capital, riskProfileId });

  let lastStep = {
    features: buildFeatures(marketData.slice(0, 30)),
    decision: model.evaluate(buildFeatures(marketData.slice(0, 30))),
  };

  for (let index = 25; index < marketData.length; index += 1) {
    lastStep = stepSimulation(state, marketData.slice(0, index + 1), model, profile);
  }

  return {
    ...summarizeRun({
      state,
      candles: marketData,
      lastStep,
      model,
      sessionInfo: {
        status: "backtest",
        id: null,
        startedAt: null,
        updatedAt: Date.now(),
        tickIntervalMs: null,
        modelId,
        riskProfileId,
      },
    }),
    backtest: {
      periodCandles: marketData.length,
      endingBalance: Number(state.equity.toFixed(2)),
      totalTrades: state.trades.length,
      bestTrade: state.trades.reduce((best, trade) => (trade.pnl > (best?.pnl ?? -Infinity) ? trade : best), null),
      worstTrade: state.trades.reduce((worst, trade) => (trade.pnl < (worst?.pnl ?? Infinity) ? trade : worst), null),
    },
  };
}
