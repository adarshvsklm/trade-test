export function average(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

export function ema(values, period) {
  if (!values.length) {
    return 0;
  }

  const smoothing = 2 / (period + 1);
  let current = values[0];

  for (let index = 1; index < values.length; index += 1) {
    current = values[index] * smoothing + current * (1 - smoothing);
  }

  return current;
}

export function rsi(values, period = 14) {
  if (values.length < period + 1) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let index = values.length - period; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];

    if (delta >= 0) {
      gains += delta;
    } else {
      losses += Math.abs(delta);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

export function standardDeviation(values) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

export function computeDrawdown(equityCurve) {
  let peak = equityCurve[0] ?? 0;
  let maxDrawdown = 0;

  for (const point of equityCurve) {
    peak = Math.max(peak, point.equity);

    if (peak > 0) {
      const drawdown = (peak - point.equity) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }

  return maxDrawdown;
}

export function computeSharpe(returns) {
  if (returns.length < 2) {
    return 0;
  }

  const mean = average(returns);
  const volatility = standardDeviation(returns);

  if (volatility === 0) {
    return 0;
  }

  return (mean / volatility) * Math.sqrt(returns.length);
}

export function formatPercent(value) {
  return Number((value * 100).toFixed(2));
}
