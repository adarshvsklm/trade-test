export const MARKET_SYMBOLS = [
  { symbol: 'BTC-USD', name: 'Bitcoin', seedPrice: 68450, volatility: 0.018 },
  { symbol: 'ETH-USD', name: 'Ethereum', seedPrice: 3420, volatility: 0.022 },
  { symbol: 'SOL-USD', name: 'Solana', seedPrice: 146, volatility: 0.028 },
  { symbol: 'AAPL', name: 'Apple', seedPrice: 192, volatility: 0.011 },
  { symbol: 'TSLA', name: 'Tesla', seedPrice: 184, volatility: 0.026 },
];

export const MODEL_CATALOG = [
  {
    id: 'momentum',
    name: 'Momentum Scout',
    description: 'Follows fast/slow moving-average breaks and avoids overheated RSI.',
    style: 'Trend following',
    weight: 1.15,
  },
  {
    id: 'meanReversion',
    name: 'Mean Reversion',
    description: 'Looks for stretched RSI readings and trades rebounds back to fair value.',
    style: 'Contrarian',
    weight: 1,
  },
  {
    id: 'riskBalanced',
    name: 'Risk Balanced',
    description: 'Prefers modest volatility, aligned trend, and controlled drawdown windows.',
    style: 'Risk filter',
    weight: 0.9,
  },
  {
    id: 'breakout',
    name: 'Breakout Hunter',
    description: 'Tracks range expansion and volume surges for continuation trades.',
    style: 'Volatility breakout',
    weight: 1.05,
  },
];

export const DEFAULT_SETTINGS = {
  initialCapital: 10000,
  riskPerTrade: 25,
  stopLoss: 3.5,
  takeProfit: 7,
  feeRate: 0.001,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const roundCurrency = (value) => Number(value.toFixed(2));

const hashString = (input) => {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed) => {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const getMarket = (symbol) => MARKET_SYMBOLS.find((market) => market.symbol === symbol) ?? MARKET_SYMBOLS[0];

const average = (values) => {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const standardDeviation = (values) => {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
};

const calculateRsi = (closes, period = 14) => {
  if (closes.length <= period) {
    return 50;
  }

  const slice = closes.slice(-period - 1);
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < slice.length; index += 1) {
    const change = slice[index] - slice[index - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
};

const movingAverage = (values, period) => average(values.slice(-period));

export const formatCurrency = (value, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);

export const formatPercent = (value) =>
  `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}%`;

export const createInitialPortfolio = (initialCapital = DEFAULT_SETTINGS.initialCapital) => ({
  cash: initialCapital,
  units: 0,
  avgEntry: 0,
  realizedPnl: 0,
  feesPaid: 0,
  trades: [],
  equityCurve: [{ step: 0, equity: initialCapital }],
});

export const generateInitialCandles = (symbol, length = 90, seedSuffix = 'live') => {
  const market = getMarket(symbol);
  const random = mulberry32(hashString(`${symbol}:${seedSuffix}`));
  const candles = [];
  let close = market.seedPrice;

  for (let index = 0; index < length; index += 1) {
    const cycle = Math.sin(index / 9) * market.volatility * 0.55;
    const noise = (random() - 0.48) * market.volatility * 2.2;
    const drift = 0.00035 + cycle + noise;
    const open = close;
    close = Math.max(open * (1 + drift), market.seedPrice * 0.2);
    const high = Math.max(open, close) * (1 + random() * market.volatility);
    const low = Math.min(open, close) * (1 - random() * market.volatility);
    const volume = Math.round(900 + random() * 1800 + Math.abs(drift) * 90000);

    candles.push({
      step: index,
      open: roundCurrency(open),
      high: roundCurrency(high),
      low: roundCurrency(low),
      close: roundCurrency(close),
      volume,
    });
  }

  return candles;
};

export const generateNextCandle = (history, symbol) => {
  const market = getMarket(symbol);
  const previous = history.at(-1);
  const step = previous.step + 1;
  const lastReturns = history.slice(-10).map((candle, index, slice) => {
    if (index === 0) {
      return 0;
    }
    return (candle.close - slice[index - 1].close) / slice[index - 1].close;
  });
  const shortMomentum = average(lastReturns);
  const randomShock = (Math.random() - 0.49) * market.volatility * 2;
  const cycle = Math.sin(step / 12) * market.volatility * 0.35;
  const drift = clamp(0.0002 + shortMomentum * 0.24 + cycle + randomShock, -0.085, 0.085);
  const open = previous.close;
  const close = Math.max(open * (1 + drift), market.seedPrice * 0.12);
  const high = Math.max(open, close) * (1 + Math.random() * market.volatility * 0.75);
  const low = Math.min(open, close) * (1 - Math.random() * market.volatility * 0.75);
  const volume = Math.round(900 + Math.random() * 2200 + Math.abs(drift) * 110000);

  return {
    step,
    open: roundCurrency(open),
    high: roundCurrency(high),
    low: roundCurrency(low),
    close: roundCurrency(close),
    volume,
  };
};

export const calculateIndicators = (history) => {
  const closes = history.map((candle) => candle.close);
  const volumes = history.map((candle) => candle.volume);
  const current = history.at(-1);
  const previous = history.at(-2) ?? current;
  const smaFast = movingAverage(closes, Math.min(8, closes.length));
  const smaSlow = movingAverage(closes, Math.min(24, closes.length));
  const recentCloses = closes.slice(-20);
  const recentReturns = recentCloses.map((close, index, values) => {
    if (index === 0) {
      return 0;
    }
    return ((close - values[index - 1]) / values[index - 1]) * 100;
  });
  const volatility = standardDeviation(recentReturns);
  const rangeHigh = Math.max(...history.slice(-18).map((candle) => candle.high));
  const rangeLow = Math.min(...history.slice(-18).map((candle) => candle.low));
  const rsi = calculateRsi(closes);
  const change = ((current.close - previous.close) / previous.close) * 100;
  const trendStrength = ((smaFast - smaSlow) / smaSlow) * 100;
  const averageVolume = movingAverage(volumes, Math.min(20, volumes.length));
  const volumeRatio = averageVolume === 0 ? 1 : current.volume / averageVolume;

  return {
    price: current.close,
    change,
    smaFast,
    smaSlow,
    rsi,
    volatility,
    rangeHigh,
    rangeLow,
    trendStrength,
    volumeRatio,
  };
};

const modelSignal = (id, indicators) => {
  const { price, rsi, smaFast, smaSlow, trendStrength, volatility, rangeHigh, rangeLow, volumeRatio } = indicators;
  const rangePosition = (price - rangeLow) / Math.max(rangeHigh - rangeLow, 1);

  if (id === 'momentum') {
    const rawScore = clamp(trendStrength / 2.2 + (smaFast > smaSlow ? 0.18 : -0.18), -1, 1);
    const rsiPenalty = rsi > 76 ? -0.45 : rsi < 38 ? 0.18 : 0;
    const score = clamp(rawScore + rsiPenalty, -1, 1);
    return {
      score,
      confidence: clamp(Math.abs(score) * 72 + 18, 10, 94),
      rationale: smaFast >= smaSlow ? 'Fast average is leading the slow average.' : 'Fast average is below the slow average.',
    };
  }

  if (id === 'meanReversion') {
    const stretchedLow = rsi < 38 || rangePosition < 0.22;
    const stretchedHigh = rsi > 66 || rangePosition > 0.82;
    const score = stretchedLow ? 0.72 : stretchedHigh ? -0.68 : clamp((50 - rsi) / 70, -0.35, 0.35);
    return {
      score,
      confidence: clamp(Math.abs(score) * 78 + 12, 8, 92),
      rationale: stretchedLow
        ? 'Price is stretched near the lower range.'
        : stretchedHigh
          ? 'Price is stretched near the upper range.'
          : 'Price is close to its recent fair-value band.',
    };
  }

  if (id === 'riskBalanced') {
    const volatilityPenalty = volatility > 3.6 ? -0.5 : volatility < 1.4 ? 0.2 : 0;
    const score = clamp(trendStrength / 3 + volatilityPenalty, -0.9, 0.9);
    return {
      score,
      confidence: clamp((1 / Math.max(volatility, 0.5)) * 42 + Math.abs(score) * 35, 14, 88),
      rationale: volatility > 3.6 ? 'Volatility is elevated, reducing risk appetite.' : 'Volatility is inside the preferred risk band.',
    };
  }

  const breakoutPressure = rangePosition > 0.78 && volumeRatio > 1.05;
  const breakdownPressure = rangePosition < 0.18 && volumeRatio > 1.05;
  const score = breakoutPressure ? 0.82 : breakdownPressure ? -0.74 : clamp((volumeRatio - 1) * trendStrength, -0.42, 0.42);
  return {
    score,
    confidence: clamp(Math.abs(score) * 70 + volumeRatio * 12, 12, 90),
    rationale: breakoutPressure
      ? 'Price is pressing range highs with expanding volume.'
      : breakdownPressure
        ? 'Price is losing range lows with expanding volume.'
        : 'No confirmed range expansion yet.',
  };
};

export const analyzeMarket = (history, selectedModelIds) => {
  const indicators = calculateIndicators(history);
  const activeModelIds = selectedModelIds.length > 0 ? selectedModelIds : ['riskBalanced'];
  const modelOutputs = activeModelIds.map((id) => {
    const model = MODEL_CATALOG.find((entry) => entry.id === id);
    const signal = modelSignal(id, indicators);

    return {
      ...model,
      ...signal,
      action: signal.score > 0.28 ? 'BUY' : signal.score < -0.28 ? 'SELL' : 'HOLD',
    };
  });

  const weightedScore =
    modelOutputs.reduce((sum, model) => sum + model.score * model.weight, 0) /
    modelOutputs.reduce((sum, model) => sum + model.weight, 0);
  const confidence = average(modelOutputs.map((model) => model.confidence));
  const action = weightedScore > 0.28 ? 'BUY' : weightedScore < -0.28 ? 'SELL' : 'HOLD';

  return {
    action,
    score: weightedScore,
    confidence,
    indicators,
    modelOutputs,
    summary:
      action === 'BUY'
        ? 'Models favor opening or adding long exposure.'
        : action === 'SELL'
          ? 'Models favor reducing long exposure or staying defensive.'
          : 'Models are mixed, so the agent is waiting for confirmation.',
  };
};

const equityAtPrice = (portfolio, price) => portfolio.cash + portfolio.units * price;

const createTrade = ({ side, price, units, fee, pnl, reason, step }) => ({
  id: `${step}-${side}-${Math.random().toString(16).slice(2)}`,
  step,
  side,
  price,
  units,
  fee,
  pnl,
  reason,
});

export const advancePortfolio = (portfolio, candle, decision, settings = DEFAULT_SETTINGS) => {
  const next = {
    ...portfolio,
    trades: [...portfolio.trades],
    equityCurve: [...portfolio.equityCurve],
  };
  const price = candle.close;
  const currentEquity = equityAtPrice(next, price);
  const openPnlPercent = next.units > 0 ? ((price - next.avgEntry) / next.avgEntry) * 100 : 0;
  let action = decision.action;
  let reason = decision.summary;

  if (next.units > 0 && openPnlPercent <= -settings.stopLoss) {
    action = 'SELL';
    reason = `Stop loss triggered at ${formatPercent(openPnlPercent)}.`;
  }

  if (next.units > 0 && openPnlPercent >= settings.takeProfit) {
    action = 'SELL';
    reason = `Take profit triggered at ${formatPercent(openPnlPercent)}.`;
  }

  if (action === 'BUY' && next.units === 0 && next.cash > 0) {
    const allocation = Math.min(next.cash, currentEquity * (settings.riskPerTrade / 100));
    const fee = allocation * settings.feeRate;
    const units = (allocation - fee) / price;
    next.cash = roundCurrency(next.cash - allocation);
    next.units = units;
    next.avgEntry = price;
    next.feesPaid = roundCurrency(next.feesPaid + fee);
    next.trades.unshift(
      createTrade({
        side: 'BUY',
        price,
        units,
        fee,
        pnl: 0,
        reason,
        step: candle.step,
      }),
    );
  }

  if (action === 'SELL' && next.units > 0) {
    const gross = next.units * price;
    const fee = gross * settings.feeRate;
    const pnl = (price - next.avgEntry) * next.units - fee;
    next.cash = roundCurrency(next.cash + gross - fee);
    next.realizedPnl = roundCurrency(next.realizedPnl + pnl);
    next.feesPaid = roundCurrency(next.feesPaid + fee);
    next.trades.unshift(
      createTrade({
        side: 'SELL',
        price,
        units: next.units,
        fee,
        pnl,
        reason,
        step: candle.step,
      }),
    );
    next.units = 0;
    next.avgEntry = 0;
  }

  next.equityCurve.push({
    step: candle.step,
    equity: roundCurrency(equityAtPrice(next, price)),
  });

  return next;
};

export const getPortfolioSnapshot = (portfolio, price, initialCapital = DEFAULT_SETTINGS.initialCapital) => {
  const positionValue = portfolio.units * price;
  const unrealizedPnl = portfolio.units > 0 ? (price - portfolio.avgEntry) * portfolio.units : 0;
  const equity = portfolio.cash + positionValue;
  const totalReturn = ((equity - initialCapital) / initialCapital) * 100;

  return {
    cash: portfolio.cash,
    units: portfolio.units,
    avgEntry: portfolio.avgEntry,
    positionValue,
    unrealizedPnl,
    realizedPnl: portfolio.realizedPnl,
    equity,
    totalReturn,
    feesPaid: portfolio.feesPaid,
  };
};

const maxDrawdown = (curve) => {
  let peak = curve[0]?.equity ?? 0;
  let drawdown = 0;

  curve.forEach((point) => {
    peak = Math.max(peak, point.equity);
    if (peak > 0) {
      drawdown = Math.min(drawdown, ((point.equity - peak) / peak) * 100);
    }
  });

  return drawdown;
};

export const runBacktest = ({
  symbol,
  modelIds,
  candles = 240,
  initialCapital = DEFAULT_SETTINGS.initialCapital,
  riskPerTrade = DEFAULT_SETTINGS.riskPerTrade,
  stopLoss = DEFAULT_SETTINGS.stopLoss,
  takeProfit = DEFAULT_SETTINGS.takeProfit,
}) => {
  const history = generateInitialCandles(symbol, candles, `backtest:${candles}:${modelIds.join(',')}`);
  let portfolio = createInitialPortfolio(initialCapital);

  for (let index = 30; index < history.length; index += 1) {
    const slice = history.slice(0, index + 1);
    const candle = slice.at(-1);
    const decision = analyzeMarket(slice, modelIds);
    portfolio = advancePortfolio(portfolio, candle, decision, {
      ...DEFAULT_SETTINGS,
      initialCapital,
      riskPerTrade,
      stopLoss,
      takeProfit,
    });
  }

  const finalCandle = history.at(-1);
  if (portfolio.units > 0) {
    portfolio = advancePortfolio(
      portfolio,
      finalCandle,
      { action: 'SELL', summary: 'Backtest closed remaining position at final candle.' },
      { ...DEFAULT_SETTINGS, initialCapital, riskPerTrade, stopLoss, takeProfit },
    );
  }

  const snapshot = getPortfolioSnapshot(portfolio, finalCandle.close, initialCapital);
  const exits = portfolio.trades.filter((trade) => trade.side === 'SELL');
  const wins = exits.filter((trade) => trade.pnl > 0).length;
  const losses = exits.filter((trade) => trade.pnl <= 0).length;
  const bestTrade = exits.reduce((best, trade) => (trade.pnl > (best?.pnl ?? -Infinity) ? trade : best), null);
  const worstTrade = exits.reduce((worst, trade) => (trade.pnl < (worst?.pnl ?? Infinity) ? trade : worst), null);

  return {
    symbol,
    candles,
    finalEquity: snapshot.equity,
    totalReturn: snapshot.totalReturn,
    realizedPnl: portfolio.realizedPnl,
    maxDrawdown: maxDrawdown(portfolio.equityCurve),
    tradeCount: portfolio.trades.length,
    wins,
    losses,
    winRate: exits.length > 0 ? (wins / exits.length) * 100 : 0,
    equityCurve: portfolio.equityCurve,
    trades: portfolio.trades,
    bestTrade,
    worstTrade,
  };
};
