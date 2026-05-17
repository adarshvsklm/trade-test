import { createSeededRng } from "./math.js";
import { TradingEngine } from "./tradingEngine.js";

export const runBacktest = ({
  modelId,
  symbol,
  candles = 400,
  initialCapital = 10_000,
  riskPerTrade = 0.2,
  stopLossPct = 0.03,
  takeProfitPct = 0.07,
}) => {
  const seededRng = createSeededRng(`${modelId}-${symbol}-${candles}-${initialCapital}`);
  const engine = new TradingEngine();
  engine.reset({
    modelId,
    symbol,
    initialCapital: Number(initialCapital),
    riskPerTrade: Number(riskPerTrade),
    stopLossPct: Number(stopLossPct),
    takeProfitPct: Number(takeProfitPct),
    rng: seededRng,
  });

  for (let i = 0; i < Number(candles); i += 1) {
    engine.tick();
  }

  const snapshot = engine.getSnapshot();
  return {
    model: snapshot.model,
    config: snapshot.config,
    market: {
      symbol: snapshot.market.symbol,
      startPrice: snapshot.market.candles[0]?.open ?? 0,
      endPrice: snapshot.market.latestPrice,
      movePct:
        snapshot.market.candles[0]?.open
          ? Number(
              (
                ((snapshot.market.latestPrice - snapshot.market.candles[0].open) /
                  snapshot.market.candles[0].open) *
                100
              ).toFixed(2),
            )
          : 0,
    },
    portfolio: snapshot.portfolio,
    stats: snapshot.stats,
    equityCurve: snapshot.equityCurve,
    trades: snapshot.recentTrades,
    disclaimer:
      "Backtest uses synthetic historical data for demonstration only and does not guarantee future profitability.",
  };
};
