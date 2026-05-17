import { createSession, processCandle } from './tradingEngine'
import { evaluateEnsemble } from './tradingModels'

export function runBacktest({
  marketData,
  models,
  initialCapital,
  riskPercent,
  warmupPeriod = 35,
}) {
  if (!marketData.length) {
    return null
  }

  const startIndex = Math.min(warmupPeriod, marketData.length - 1)
  let session = createSession(initialCapital, marketData[startIndex])
  let latestDecision = null
  let latestBreakdown = []

  for (let index = startIndex + 1; index < marketData.length; index += 1) {
    const candle = marketData[index]
    const history = marketData.slice(0, index + 1)
    const { ensemble, breakdown } = evaluateEnsemble(models, history)
    const step = processCandle({
      session,
      candle,
      decision: ensemble,
      riskPercent,
    })
    session = step.session
    latestDecision = ensemble
    latestBreakdown = breakdown
  }

  const metrics = calculateMetrics(session)

  return {
    session,
    metrics,
    latestDecision,
    latestBreakdown,
  }
}

function calculateMetrics(session) {
  const equityValues = session.equityCurve.map((point) => point.equity)
  const returns = []

  for (let index = 1; index < equityValues.length; index += 1) {
    const previous = equityValues[index - 1]
    if (previous > 0) {
      returns.push((equityValues[index] - previous) / previous)
    }
  }

  const meanReturn = mean(returns)
  const volatility = standardDeviation(returns)
  const sharpe = volatility > 0 ? (meanReturn / volatility) * Math.sqrt(252) : 0

  const sellTrades = session.trades.filter((trade) => trade.side === 'SELL')
  const grossProfit = sellTrades
    .filter((trade) => trade.realizedPnl > 0)
    .reduce((sum, trade) => sum + trade.realizedPnl, 0)
  const grossLoss = Math.abs(
    sellTrades
      .filter((trade) => trade.realizedPnl < 0)
      .reduce((sum, trade) => sum + trade.realizedPnl, 0),
  )

  return {
    winRate: session.portfolio.tradeCount
      ? session.portfolio.wins / Math.max(1, session.portfolio.wins + session.portfolio.losses)
      : 0,
    profitFactor: grossLoss ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    sharpeRatio: sharpe,
    grossProfit,
    grossLoss,
  }
}

function mean(values) {
  if (!values.length) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values) {
  if (values.length < 2) {
    return 0
  }
  const avg = mean(values)
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length
  return Math.sqrt(variance)
}
