const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function momentumPulse(features) {
  const trendScore = clamp(features.emaSpread * 16, -1, 1);
  const rsiBias = clamp((features.rsi - 50) / 25, -1, 1);
  const slopeBias = clamp(features.shortSlope * 45, -1, 1);
  const volatilityPenalty = clamp(features.volatility * 3.5, 0, 0.45);

  const signal = trendScore * 0.45 + rsiBias * 0.35 + slopeBias * 0.2;
  const confidence = clamp(Math.abs(signal) - volatilityPenalty + 0.2, 0.1, 0.98);

  let action = "hold";
  if (signal > 0.3) {
    action = "buy";
  } else if (signal < -0.3) {
    action = "sell";
  }

  return {
    action,
    signal,
    confidence,
    reason: "Follows EMA trend strength with RSI and slope confirmation.",
  };
}

function meanReversionAI(features) {
  const distanceFromMean = clamp(features.distanceFromSlowEma * 18, -1.2, 1.2);
  const oversoldBias = clamp((40 - features.rsi) / 20, -1, 1);
  const overboughtBias = clamp((features.rsi - 60) / 20, -1, 1);
  const meanSignal = -distanceFromMean * 0.55 + oversoldBias * 0.3 - overboughtBias * 0.3;
  const volatilityBoost = clamp(features.volatility * 4, 0, 0.4);
  const confidence = clamp(Math.abs(meanSignal) + volatilityBoost, 0.12, 0.95);

  let action = "hold";
  if (meanSignal > 0.25) {
    action = "buy";
  } else if (meanSignal < -0.25) {
    action = "sell";
  }

  return {
    action,
    signal: meanSignal,
    confidence,
    reason: "Buys weakness and fades stretched moves back toward the slow EMA.",
  };
}

function hybridEnsemble(features) {
  const trendWeight = features.regime === "trend-up" || features.regime === "trend-down" ? 0.7 : 0.4;
  const reversionWeight = 1 - trendWeight;

  const momentumSignal =
    clamp(features.emaSpread * 14, -1, 1) * 0.6 + clamp((features.rsi - 50) / 30, -1, 1) * 0.4;
  const reversionSignal =
    clamp(-features.distanceFromSlowEma * 15, -1, 1) * 0.7 + clamp((50 - features.rsi) / 25, -1, 1) * 0.3;

  const signal = momentumSignal * trendWeight + reversionSignal * reversionWeight;
  const confidence = clamp(Math.abs(signal) + (features.regime === "range" ? 0.12 : 0.2), 0.15, 0.99);

  let action = "hold";
  if (signal > 0.22) {
    action = "buy";
  } else if (signal < -0.22) {
    action = "sell";
  }

  return {
    action,
    signal,
    confidence,
    reason: "Blends momentum and mean-reversion, adapting to the current market regime.",
  };
}

export const modelCatalog = [
  {
    id: "momentum-pulse",
    name: "Momentum Pulse",
    style: "Trend following",
    risk: "Medium",
    holdingBias: "Intraday swings",
    description: "Rides strong directional moves using EMA spread, slope, and RSI confirmation.",
    evaluate: momentumPulse,
  },
  {
    id: "mean-reversion-ai",
    name: "Mean Reversion AI",
    style: "Counter trend",
    risk: "Medium / High",
    holdingBias: "Fast reversals",
    description: "Looks for oversold or overbought conditions and fades extensions back to equilibrium.",
    evaluate: meanReversionAI,
  },
  {
    id: "hybrid-ensemble",
    name: "Hybrid Ensemble",
    style: "Adaptive",
    risk: "Balanced",
    holdingBias: "Mixed regimes",
    description: "Switches emphasis between momentum and reversion depending on the detected regime.",
    evaluate: hybridEnsemble,
  },
];

export function getModelById(modelId) {
  return modelCatalog.find((model) => model.id === modelId) ?? modelCatalog[0];
}
