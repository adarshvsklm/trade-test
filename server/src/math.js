export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const createSeededRng = (seedInput = "trade-agent") => {
  let seed = 0;
  for (let i = 0; i < seedInput.length; i += 1) {
    seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0;
  }

  return () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };
};

export const maxDrawdown = (equityCurve) => {
  if (!equityCurve.length) {
    return 0;
  }

  let peak = equityCurve[0];
  let maxDd = 0;

  for (const value of equityCurve) {
    if (value > peak) {
      peak = value;
    }
    if (peak === 0) {
      continue;
    }
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDd) {
      maxDd = drawdown;
    }
  }

  return maxDd;
};

export const sharpeRatio = (returns) => {
  if (returns.length < 2) {
    return 0;
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance =
    returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) {
    return 0;
  }
  return (mean / stdDev) * Math.sqrt(returns.length);
};
