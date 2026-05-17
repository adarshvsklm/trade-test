const DEFAULT_FEE_RATE = 0.001
const DEFAULT_SLIPPAGE_BPS = 5
const MIN_NOTIONAL = 25

export function createPortfolio(initialCapital) {
  return {
    initialCapital,
    cash: initialCapital,
    positionQty: 0,
    positionCost: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    totalPnl: 0,
    equity: initialCapital,
    peakEquity: initialCapital,
    maxDrawdown: 0,
    tradeCount: 0,
    wins: 0,
    losses: 0,
  }
}

export function createSession(initialCapital, firstCandle) {
  const portfolio = createPortfolio(initialCapital)
  const session = {
    portfolio: markToMarket(portfolio, firstCandle.price),
    trades: [],
    decisions: [],
    equityCurve: [
      {
        index: firstCandle.index,
        timestamp: firstCandle.timestamp,
        price: firstCandle.price,
        equity: initialCapital,
      },
    ],
  }
  return session
}

export function processCandle({
  session,
  candle,
  decision,
  riskPercent,
  feeRate = DEFAULT_FEE_RATE,
  slippageBps = DEFAULT_SLIPPAGE_BPS,
}) {
  const nextPortfolio = { ...session.portfolio }
  let executedTrade = null

  if (decision.action === 'buy') {
    executedTrade = buy(nextPortfolio, candle, riskPercent, feeRate, slippageBps)
  } else if (decision.action === 'sell') {
    executedTrade = sell(nextPortfolio, candle, riskPercent, feeRate, slippageBps)
  }

  const markedPortfolio = markToMarket(nextPortfolio, candle.price)

  return {
    session: {
      portfolio: markedPortfolio,
      trades: executedTrade
        ? [...session.trades, executedTrade]
        : [...session.trades],
      decisions: [
        ...session.decisions,
        {
          index: candle.index,
          timestamp: candle.timestamp,
          action: decision.action,
          confidence: decision.confidence,
          reason: decision.reason,
        },
      ],
      equityCurve: [
        ...session.equityCurve,
        {
          index: candle.index,
          timestamp: candle.timestamp,
          price: candle.price,
          equity: markedPortfolio.equity,
        },
      ],
    },
    executedTrade,
  }
}

function buy(portfolio, candle, riskPercent, feeRate, slippageBps) {
  const allocation = portfolio.cash * (riskPercent / 100)
  if (allocation < MIN_NOTIONAL) {
    return null
  }

  const spend = allocation / (1 + feeRate)
  const executionPrice = candle.price * (1 + slippageBps / 10_000)
  const quantity = spend / executionPrice
  const fee = spend * feeRate

  if (quantity <= 0) {
    return null
  }

  portfolio.cash -= spend + fee
  portfolio.positionQty += quantity
  portfolio.positionCost += spend + fee
  portfolio.tradeCount += 1

  return {
    side: 'BUY',
    timestamp: candle.timestamp,
    index: candle.index,
    price: executionPrice,
    quantity,
    notional: spend,
    fee,
    realizedPnl: 0,
  }
}

function sell(portfolio, candle, riskPercent, feeRate, slippageBps) {
  if (portfolio.positionQty <= 0) {
    return null
  }

  const quantity = portfolio.positionQty * (riskPercent / 100)
  const executionPrice = candle.price * (1 - slippageBps / 10_000)
  const grossProceeds = quantity * executionPrice

  if (grossProceeds < MIN_NOTIONAL) {
    return null
  }

  const fee = grossProceeds * feeRate
  const averageCost = portfolio.positionCost / portfolio.positionQty
  const releasedCost = averageCost * quantity
  const realizedPnl = grossProceeds - fee - releasedCost

  portfolio.positionQty -= quantity
  portfolio.positionCost -= releasedCost
  portfolio.cash += grossProceeds - fee
  portfolio.realizedPnl += realizedPnl
  portfolio.tradeCount += 1

  if (realizedPnl >= 0) {
    portfolio.wins += 1
  } else {
    portfolio.losses += 1
  }

  if (portfolio.positionQty < 1e-8) {
    portfolio.positionQty = 0
    portfolio.positionCost = 0
  }

  return {
    side: 'SELL',
    timestamp: candle.timestamp,
    index: candle.index,
    price: executionPrice,
    quantity,
    notional: grossProceeds,
    fee,
    realizedPnl,
  }
}

function markToMarket(portfolio, price) {
  const positionValue = portfolio.positionQty * price
  const unrealized = positionValue - portfolio.positionCost
  const equity = portfolio.cash + positionValue
  const peakEquity = Math.max(portfolio.peakEquity, equity)
  const drawdown = peakEquity > 0 ? (peakEquity - equity) / peakEquity : 0

  return {
    ...portfolio,
    unrealizedPnl: unrealized,
    totalPnl: equity - portfolio.initialCapital,
    equity,
    peakEquity,
    maxDrawdown: Math.max(portfolio.maxDrawdown, drawdown),
  }
}
