const ASSET_MAP = {
  BTCUSD: {
    symbol: 'BTCUSD',
    label: 'BTC / USD',
    basePrice: 64250,
    amplitude: 2100,
    volatility: 0.018,
    seed: 11,
  },
  ETHUSD: {
    symbol: 'ETHUSD',
    label: 'ETH / USD',
    basePrice: 3120,
    amplitude: 190,
    volatility: 0.022,
    seed: 23,
  },
  SOLUSD: {
    symbol: 'SOLUSD',
    label: 'SOL / USD',
    basePrice: 148,
    amplitude: 16,
    volatility: 0.028,
    seed: 37,
  },
  EURUSD: {
    symbol: 'EURUSD',
    label: 'EUR / USD',
    basePrice: 1.084,
    amplitude: 0.026,
    volatility: 0.004,
    seed: 41,
  },
};

function createSeededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }

  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function formatLabel(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function createVolume(random, basePrice, index) {
  const seasonal = 0.75 + Math.sin(index / 9) * 0.18;
  const randomBoost = 0.7 + random() * 0.6;
  return Math.round(basePrice * 18 * seasonal * randomBoost);
}

export const AVAILABLE_ASSETS = Object.values(ASSET_MAP);

export function generateMarketSeries(symbol, candles = 180) {
  const config = ASSET_MAP[symbol] ?? ASSET_MAP.BTCUSD;
  const random = createSeededRandom(config.seed + candles);
  const startDate = new Date(Date.UTC(2025, 0, 1));
  const series = [];

  let price = config.basePrice;

  for (let index = 0; index < candles; index += 1) {
    const open = price;
    const cyclicalTrend =
      Math.sin(index / 6.2) * config.amplitude * 0.55 +
      Math.cos(index / 13.5) * config.amplitude * 0.35;
    const directionalBias =
      (index / candles) * config.amplitude * 0.8 -
      ((candles - index) / candles) * config.amplitude * 0.25;
    const noise = (random() - 0.5) * config.basePrice * config.volatility;
    const close = Math.max(0.0001, open + cyclicalTrend * 0.08 + directionalBias * 0.03 + noise);
    const intradayNoise = Math.abs(noise) * (0.8 + random() * 0.6);
    const high = Math.max(open, close) + intradayNoise;
    const low = Math.max(0.0001, Math.min(open, close) - intradayNoise * 0.9);
    const volume = createVolume(random, config.basePrice, index);
    const timestamp = new Date(startDate.getTime() + index * 24 * 60 * 60 * 1000);

    price = close;

    series.push({
      index,
      symbol: config.symbol,
      label: formatLabel(timestamp),
      timestamp: timestamp.toISOString(),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return series;
}
