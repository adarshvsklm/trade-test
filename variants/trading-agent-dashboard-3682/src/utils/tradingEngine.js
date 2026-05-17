export const STARTING_CAPITAL = 100000;
export const WARMUP_PERIOD = 25;

export const MODEL_LIBRARY = [
  {
    id: 'momentum',
    name: 'Momentum AI',
    shortDescription: 'Rides directional strength after sustained upside or downside expansion.',
  },
  {
    id: 'meanReversion',
    name: 'Mean Reversion',
    shortDescription: 'Looks for stretched prices that are likely to snap back toward the average.',
  },
  {
    id: 'breakout',
    name: 'Breakout Hunter',
    shortDescription: 'Buys resistance breaks and exits failed range expansions.',
  },
  {
    id: 'volatility',
    name: 'Volatility Guard',
    shortDescription: 'Filters trades by realized volatility and trend stability.',
  },
];

export const RISK_PROFILES = {
  conservative: {
    label: 'Conservative',
    buyFraction: 0.11,
    sellFraction: 0.45,
    cooldown: 4,
  },
  balanced: {
    label: 'Balanced',
    buyFraction: 0.18,
    sellFraction: 0.58,
    cooldown: 3,
  },
  aggressive: {
    label: 'Aggressive',
    buyFraction: 0.27,
    sellFraction: 0.8,
    cooldown: 2,
  },
};

const HOLD = 'hold';
const BUY = 'buy';
const SELL = 'sell';

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);

  return Math.sqrt(variance);
}

function getCloses(series, index, count) {
  const start = Math.max(0, index - count + 1);
  return series.slice(start, index + 1).map((candle) => candle.close);
}

function getReturns(series, index, count) {
  const closes = getCloses(series, index, count + 1);
  const returns = [];

  for (let i = 1; i < closes.length; i += 1) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  return returns;
}

function scoreToSignal(score, threshold = 0.18) {
  if (score >= threshold) {
    return BUY;
  }

  if (score <= -threshold) {
    return SELL;
  }

  return HOLD;
}

function createAnalysis(model, score, confidence, rationale) {
  return {
    modelId: model.id,
    modelName: model.name,
    signal: scoreToSignal(score),
    score,
    confidence: Math.round(clamp(confidence, 0, 100)),
    rationale,
  };
}

function analyzeMomentum(series, index) {
  const price = series[index].close;
  const close5 = series[Math.max(0, index - 5)].close;
  const close15 = series[Math.max(0, index - 15)].close;
  const shortMomentum = price / close5 - 1;
  const longMomentum = price / close15 - 1;
  const score = shortMomentum * 3.2 + longMomentum * 2.4;
  const confidence = Math.abs(score) * 1700 + 24;
  const direction = score >= 0 ? 'buyers' : 'sellers';
  const rationale = `${direction} are in control with ${Math.abs(shortMomentum * 100).toFixed(
    2,
  )}% 5-period momentum.`;

  return createAnalysis(MODEL_LIBRARY[0], score, confidence, rationale);
}

function analyzeMeanReversion(series, index) {
  const price = series[index].close;
  const closes10 = getCloses(series, index, 10);
  const movingAverage = average(closes10);
  const deviation = movingAverage === 0 ? 0 : (price - movingAverage) / movingAverage;
  const lastReturn = getReturns(series, index, 1)[0] ?? 0;
  const score = -deviation * 5.4 - lastReturn * 1.8;
  const confidence = Math.abs(deviation) * 2500 + Math.abs(lastReturn) * 900 + 18;
  const side = deviation >= 0 ? 'above' : 'below';
  const rationale = `Price is ${Math.abs(deviation * 100).toFixed(
    2,
  )}% ${side} the 10-period mean.`;

  return createAnalysis(MODEL_LIBRARY[1], score, confidence, rationale);
}

function analyzeBreakout(series, index) {
  const price = series[index].close;
  const lookback = series.slice(Math.max(0, index - 20), index);
  const priorHigh = Math.max(...lookback.map((candle) => candle.high));
  const priorLow = Math.min(...lookback.map((candle) => candle.low));
  const upsideBreak = priorHigh === 0 ? 0 : price / priorHigh - 1;
  const downsideBreak = priorLow === 0 ? 0 : priorLow / price - 1;
  const score = upsideBreak * 12 - downsideBreak * 12;
  const confidence = Math.max(Math.abs(upsideBreak), Math.abs(downsideBreak)) * 5800 + 20;
  let rationale = 'Market is still ranging inside the recent breakout band.';

  if (upsideBreak > 0) {
    rationale = `Fresh upside breakout above ${priorHigh.toFixed(2)} with follow-through buying.`;
  } else if (downsideBreak > 0) {
    rationale = `Breakdown under ${priorLow.toFixed(2)} suggests sellers are extending control.`;
  }

  return createAnalysis(MODEL_LIBRARY[2], score, confidence, rationale);
}

function analyzeVolatility(series, index) {
  const returns = getReturns(series, index, 12);
  const recentReturns = returns.slice(-4);
  const volatility = standardDeviation(returns);
  const shortDrift = average(recentReturns);
  const score =
    volatility < 0.015 ? shortDrift * 9 : shortDrift * 3 - Math.sign(shortDrift) * volatility * 4;
  const confidence = Math.abs(shortDrift) * 2600 + clamp((0.02 - volatility) * 1800, 0, 30) + 20;
  const regime =
    volatility < 0.012 ? 'calm' : volatility < 0.02 ? 'tradable' : 'high-volatility';
  const rationale = `Volatility regime is ${regime} with ${(
    volatility * 100
  ).toFixed(2)}% realized move dispersion.`;

  return createAnalysis(MODEL_LIBRARY[3], score, confidence, rationale);
}

export function getModelAnalyses(series, index, selectedModels) {
  return selectedModels.map((modelId) => {
    switch (modelId) {
      case 'momentum':
        return analyzeMomentum(series, index);
      case 'meanReversion':
        return analyzeMeanReversion(series, index);
      case 'breakout':
        return analyzeBreakout(series, index);
      case 'volatility':
        return analyzeVolatility(series, index);
      default:
        return createAnalysis(
          MODEL_LIBRARY[0],
          0,
          0,
          'Unknown model received; no trade signal generated.',
        );
    }
  });
}

export function combineAnalyses(analyses) {
  const voteTotals = analyses.reduce(
    (totals, analysis) => {
      const weight = analysis.confidence / 100;

      if (analysis.signal === BUY) {
        totals.buy += weight;
      } else if (analysis.signal === SELL) {
        totals.sell += weight;
      } else {
        totals.hold += weight;
      }

      return totals;
    },
    { buy: 0, sell: 0, hold: 0 },
  );

  const differential = voteTotals.buy - voteTotals.sell;
  const totalWeight = voteTotals.buy + voteTotals.sell + voteTotals.hold || 1;
  const signal = scoreToSignal(differential / totalWeight, 0.09);
  const confidence = clamp((Math.abs(differential) / totalWeight) * 100 + voteTotals.hold * 8, 20, 97);
  const strongestDrivers = analyses
    .filter((analysis) => analysis.signal !== HOLD)
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 2)
    .map((analysis) => analysis.modelName);

  const summary =
    strongestDrivers.length > 0
      ? `Primary drivers: ${strongestDrivers.join(' + ')}`
      : 'Models are split, so the engine is waiting for clearer confirmation.';

  return {
    signal,
    confidence: Math.round(confidence),
    differential,
    voteTotals,
    summary,
  };
}

function buildAnalysisSnapshot(analyses, ensemble, initial = false) {
  return {
    analyses,
    ensemble,
    headline: initial
      ? 'Ready to trade'
      : ensemble.signal === BUY
        ? 'Ensemble is leaning long'
        : ensemble.signal === SELL
          ? 'Ensemble is leaning defensive'
          : 'Ensemble is neutral',
  };
}

function recordSnapshot(session, series, index, analyses, ensemble) {
  const currentPrice = series[index].close;
  const positionValue = session.positionSize * currentPrice;
  const unrealizedPnl =
    session.positionSize > 0 ? (currentPrice - session.avgEntry) * session.positionSize : 0;
  const totalEquity = session.cash + positionValue;
  const maxEquity = Math.max(session.maxEquity, totalEquity);
  const drawdown = maxEquity === 0 ? 0 : ((maxEquity - totalEquity) / maxEquity) * 100;

  return {
    ...session,
    currentPrice,
    positionValue,
    unrealizedPnl,
    totalEquity,
    totalReturnPct: ((totalEquity - STARTING_CAPITAL) / STARTING_CAPITAL) * 100,
    winRate: session.closedTrades > 0 ? (session.wins / session.closedTrades) * 100 : 0,
    maxEquity,
    maxDrawdown: Math.max(session.maxDrawdown, drawdown),
    lastAnalysis: buildAnalysisSnapshot(analyses, ensemble),
    equityCurve: [
      ...session.equityCurve,
      {
        label: series[index].label,
        equity: totalEquity,
        price: currentPrice,
      },
    ],
  };
}

function buyPosition(session, notional, price, timestamp, ensemble) {
  const quantity = notional / price;
  const nextPosition = session.positionSize + quantity;
  const avgEntry =
    nextPosition === 0
      ? 0
      : (session.avgEntry * session.positionSize + notional) / nextPosition;

  return {
    ...session,
    cash: session.cash - notional,
    positionSize: nextPosition,
    avgEntry,
    lastTradeIndex: session.index,
    tradeLog: [
      {
        id: `${timestamp}-buy-${session.tradeLog.length}`,
        timestamp,
        type: 'BUY',
        price,
        quantity,
        notional,
        confidence: ensemble.confidence,
        note: ensemble.summary,
      },
      ...session.tradeLog,
    ],
  };
}

function sellPosition(session, quantity, price, timestamp, ensemble) {
  const notional = quantity * price;
  const realizedPnl = (price - session.avgEntry) * quantity;
  const nextPosition = Math.max(0, session.positionSize - quantity);

  return {
    ...session,
    cash: session.cash + notional,
    positionSize: nextPosition,
    avgEntry: nextPosition > 0 ? session.avgEntry : 0,
    realizedPnl: session.realizedPnl + realizedPnl,
    closedTrades: session.closedTrades + 1,
    wins: session.wins + (realizedPnl >= 0 ? 1 : 0),
    losses: session.losses + (realizedPnl < 0 ? 1 : 0),
    lastTradeIndex: session.index,
    tradeLog: [
      {
        id: `${timestamp}-sell-${session.tradeLog.length}`,
        timestamp,
        type: 'SELL',
        price,
        quantity,
        notional,
        realizedPnl,
        confidence: ensemble.confidence,
        note: ensemble.summary,
      },
      ...session.tradeLog,
    ],
  };
}

function maybeTrade(session, series, index, ensemble, riskProfile) {
  const currentPrice = series[index].close;
  const risk = RISK_PROFILES[riskProfile] ?? RISK_PROFILES.balanced;
  const candlesSinceTrade = index - session.lastTradeIndex;

  if (candlesSinceTrade < risk.cooldown) {
    return session;
  }

  if (ensemble.signal === BUY && session.cash > currentPrice) {
    const notional = session.cash * (risk.buyFraction + ensemble.confidence / 700);
    const boundedNotional = clamp(notional, currentPrice, session.cash);
    return buyPosition(session, boundedNotional, currentPrice, series[index].timestamp, ensemble);
  }

  if (ensemble.signal === SELL && session.positionSize > 0) {
    const quantity = clamp(
      session.positionSize * (risk.sellFraction + ensemble.confidence / 220),
      session.positionSize * 0.25,
      session.positionSize,
    );
    return sellPosition(session, quantity, currentPrice, series[index].timestamp, ensemble);
  }

  return session;
}

export function createSimulationState(series, selectedModels) {
  const index = Math.min(WARMUP_PERIOD, series.length - 1);
  const analyses = getModelAnalyses(series, index, selectedModels);
  const ensemble = combineAnalyses(analyses);

  return {
    series,
    index,
    currentPrice: series[index].close,
    cash: STARTING_CAPITAL,
    positionSize: 0,
    avgEntry: 0,
    positionValue: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalEquity: STARTING_CAPITAL,
    totalReturnPct: 0,
    lastTradeIndex: -999,
    tradeLog: [],
    closedTrades: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    maxEquity: STARTING_CAPITAL,
    maxDrawdown: 0,
    equityCurve: [
      {
        label: series[index].label,
        equity: STARTING_CAPITAL,
        price: series[index].close,
      },
    ],
    lastAnalysis: buildAnalysisSnapshot(analyses, ensemble, true),
    isComplete: index >= series.length - 1,
    selectedModels,
  };
}

export function refreshSessionAnalysis(session, selectedModels) {
  const analyses = getModelAnalyses(session.series, session.index, selectedModels);
  const ensemble = combineAnalyses(analyses);

  return {
    ...session,
    selectedModels,
    lastAnalysis: buildAnalysisSnapshot(analyses, ensemble, session.tradeLog.length === 0),
  };
}

export function advanceSimulation(session, selectedModels, riskProfile) {
  if (session.isComplete) {
    return session;
  }

  const nextIndex = session.index + 1;

  if (nextIndex >= session.series.length) {
    return {
      ...session,
      isComplete: true,
    };
  }

  const analyses = getModelAnalyses(session.series, nextIndex, selectedModels);
  const ensemble = combineAnalyses(analyses);
  const updatedSession = maybeTrade(
    {
      ...session,
      index: nextIndex,
      selectedModels,
    },
    session.series,
    nextIndex,
    ensemble,
    riskProfile,
  );

  const snapshot = recordSnapshot(updatedSession, session.series, nextIndex, analyses, ensemble);

  return {
    ...snapshot,
    isComplete: nextIndex >= session.series.length - 1,
  };
}

export function runBacktest(series, selectedModels, riskProfile) {
  let session = createSimulationState(series, selectedModels);

  while (!session.isComplete) {
    session = advanceSimulation(session, selectedModels, riskProfile);
  }

  const realizedTrades = session.tradeLog.filter((trade) => trade.type === 'SELL');
  const grossProfit = realizedTrades
    .filter((trade) => (trade.realizedPnl ?? 0) > 0)
    .reduce((total, trade) => total + trade.realizedPnl, 0);
  const grossLoss = Math.abs(
    realizedTrades
      .filter((trade) => (trade.realizedPnl ?? 0) < 0)
      .reduce((total, trade) => total + trade.realizedPnl, 0),
  );
  const returns = [];

  for (let index = 1; index < session.equityCurve.length; index += 1) {
    const priorEquity = session.equityCurve[index - 1].equity;
    const currentEquity = session.equityCurve[index].equity;

    returns.push((currentEquity - priorEquity) / priorEquity);
  }

  const sharpe =
    standardDeviation(returns) === 0 ? 0 : (average(returns) / standardDeviation(returns)) * Math.sqrt(252);

  return {
    summary: {
      endingEquity: session.totalEquity,
      totalReturnPct: session.totalReturnPct,
      realizedPnl: session.realizedPnl,
      maxDrawdown: session.maxDrawdown,
      winRate: session.winRate,
      totalTrades: session.tradeLog.length,
      profitFactor: grossLoss === 0 ? grossProfit : grossProfit / grossLoss,
      sharpeRatio: sharpe,
    },
    tradeLog: session.tradeLog,
    equityCurve: session.equityCurve,
  };
}
