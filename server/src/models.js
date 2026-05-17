const average = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;

const getClosePrices = (candles, window) => {
  if (candles.length < window) {
    return [];
  }
  return candles.slice(-window).map((candle) => candle.close);
};

const getMomentumSignal = (candles) => {
  const shortWindow = 8;
  const longWindow = 21;
  const shortPrices = getClosePrices(candles, shortWindow);
  const longPrices = getClosePrices(candles, longWindow);
  if (!shortPrices.length || !longPrices.length) {
    return 0;
  }

  const shortAverage = average(shortPrices);
  const longAverage = average(longPrices);

  if (shortAverage > longAverage * 1.002) {
    return 1;
  }
  if (shortAverage < longAverage * 0.998) {
    return -1;
  }
  return 0;
};

const getMeanReversionSignal = (candles) => {
  const window = 20;
  const threshold = 0.016;
  const prices = getClosePrices(candles, window);
  if (!prices.length) {
    return 0;
  }

  const movingAverage = average(prices);
  const latestClose = candles[candles.length - 1].close;

  if (latestClose < movingAverage * (1 - threshold)) {
    return 1;
  }
  if (latestClose > movingAverage * (1 + threshold)) {
    return -1;
  }
  return 0;
};

const getBreakoutSignal = (candles) => {
  const window = 24;
  if (candles.length < window + 1) {
    return 0;
  }

  const current = candles[candles.length - 1];
  const previousCandles = candles.slice(-window - 1, -1);
  const recentHigh = Math.max(...previousCandles.map((candle) => candle.high));
  const recentLow = Math.min(...previousCandles.map((candle) => candle.low));

  if (current.close > recentHigh * 1.001) {
    return 1;
  }
  if (current.close < recentLow * 0.999) {
    return -1;
  }
  return 0;
};

export const MODEL_REGISTRY = [
  {
    id: "momentum-ma",
    name: "Momentum MA Cross",
    description: "Follows trend direction using fast/slow moving-average crossover.",
    riskProfile: "Medium",
    signal: getMomentumSignal,
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    description: "Buys dips and sells rallies around rolling fair-value estimate.",
    riskProfile: "Medium-High",
    signal: getMeanReversionSignal,
  },
  {
    id: "breakout",
    name: "Breakout",
    description: "Enters when price escapes recent high/low range with momentum.",
    riskProfile: "High",
    signal: getBreakoutSignal,
  },
];

export const getModelById = (modelId) =>
  MODEL_REGISTRY.find((model) => model.id === modelId) ?? MODEL_REGISTRY[0];
