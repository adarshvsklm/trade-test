const ONE_MINUTE_MS = 60_000

/**
 * Generates synthetic market candles with varying trend regimes.
 * The output is deterministic for the same seed.
 */
export function generateMarketData({
  length = 500,
  startPrice = 120,
  volatility = 0.011,
  drift = 0.00045,
  seed = 7,
} = {}) {
  const candles = []
  let price = startPrice
  let currentRegime = 1

  for (let index = 0; index < length; index += 1) {
    if (index > 0 && index % 90 === 0) {
      // Rotate between bullish, bearish, and sideways environments.
      currentRegime = ((currentRegime + 1) % 3) - 1
    }

    const noise = pseudoRandom(seed + index) - 0.5
    const regimeShift = currentRegime * drift * 1.9
    const move = regimeShift + noise * volatility
    price = Math.max(4, price * (1 + move))

    candles.push({
      index,
      timestamp: Date.now() - (length - index) * ONE_MINUTE_MS,
      price: round(price, 2),
    })
  }

  return candles
}

export function extractPrices(candles) {
  return candles.map((candle) => candle.price)
}

function pseudoRandom(seedValue) {
  const x = Math.sin(seedValue * 12.9898) * 43_758.5453
  return x - Math.floor(x)
}

function round(value, places = 2) {
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}
