import { extractPrices } from './marketData'

function average(values) {
  if (!values.length) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function movingAverage(values, period) {
  if (values.length < period) {
    return average(values)
  }
  return average(values.slice(values.length - period))
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0
  }
  const mean = average(values)
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

export const TRADING_MODELS = [
  {
    id: 'trend-rider',
    name: 'Trend Rider',
    description: 'Buys when short-term trend moves above long trend.',
    decide(candles) {
      const prices = extractPrices(candles)
      const shortMa = movingAverage(prices, 8)
      const longMa = movingAverage(prices, 21)

      if (shortMa > longMa * 1.002) {
        return {
          action: 'buy',
          confidence: clamp((shortMa / longMa - 1) * 90),
          reason: 'Short moving average crossed above long moving average.',
        }
      }

      if (shortMa < longMa * 0.998) {
        return {
          action: 'sell',
          confidence: clamp((1 - shortMa / longMa) * 90),
          reason: 'Trend weakness detected by moving average crossover.',
        }
      }

      return {
        action: 'hold',
        confidence: 0.35,
        reason: 'Trend signal neutral.',
      }
    },
  },
  {
    id: 'mean-reverter',
    name: 'Mean Reverter',
    description: 'Sells overbought spikes and buys oversold dips.',
    decide(candles) {
      const prices = extractPrices(candles)
      const lookback = prices.slice(-30)
      const currentPrice = prices.at(-1)
      const mean = average(lookback)
      const deviation = standardDeviation(lookback) || 1
      const zScore = (currentPrice - mean) / deviation

      if (zScore < -1.05) {
        return {
          action: 'buy',
          confidence: clamp(Math.abs(zScore) / 2.2),
          reason: `Price is ${Math.abs(zScore).toFixed(2)}σ below the mean.`,
        }
      }

      if (zScore > 1.05) {
        return {
          action: 'sell',
          confidence: clamp(Math.abs(zScore) / 2.2),
          reason: `Price is ${Math.abs(zScore).toFixed(2)}σ above the mean.`,
        }
      }

      return {
        action: 'hold',
        confidence: 0.4,
        reason: 'Price is close to its short-term mean.',
      }
    },
  },
  {
    id: 'breakout-scout',
    name: 'Breakout Scout',
    description: 'Trades breakouts from recent highs and lows.',
    decide(candles) {
      const prices = extractPrices(candles)
      const lookback = prices.slice(-20)
      const currentPrice = prices.at(-1)
      const high = Math.max(...lookback)
      const low = Math.min(...lookback)

      if (currentPrice >= high * 0.999) {
        return {
          action: 'buy',
          confidence: clamp((currentPrice / high - 0.997) * 22),
          reason: 'Price is breaking above recent resistance.',
        }
      }

      if (currentPrice <= low * 1.001) {
        return {
          action: 'sell',
          confidence: clamp((1.003 - currentPrice / low) * 22),
          reason: 'Price is falling below recent support.',
        }
      }

      return {
        action: 'hold',
        confidence: 0.3,
        reason: 'No breakout confirmed.',
      }
    },
  },
]

export function getModelsById(modelIds) {
  const allowedIds = new Set(modelIds)
  return TRADING_MODELS.filter((model) => allowedIds.has(model.id))
}

export function evaluateEnsemble(models, candles) {
  const breakdown = models.map((model) => ({
    modelId: model.id,
    modelName: model.name,
    ...model.decide(candles),
  }))

  let buyScore = 0
  let sellScore = 0

  for (const vote of breakdown) {
    if (vote.action === 'buy') {
      buyScore += vote.confidence
    } else if (vote.action === 'sell') {
      sellScore += vote.confidence
    }
  }

  const netScore = buyScore - sellScore
  const confidence = clamp(Math.abs(netScore), 0, 1)
  let action = 'hold'
  let reason = 'Selected models are mixed, so the engine waits.'

  if (netScore > 0.12) {
    action = 'buy'
    reason = 'Ensemble vote favors a long position.'
  } else if (netScore < -0.12) {
    action = 'sell'
    reason = 'Ensemble vote favors reducing exposure.'
  }

  return {
    ensemble: {
      action,
      confidence,
      reason,
      buyScore,
      sellScore,
      netScore,
    },
    breakdown,
  }
}
