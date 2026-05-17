import { clamp, maxDrawdown, round, sharpeRatio } from "./math.js";
import { MarketSimulator } from "./marketSimulator.js";
import { getModelById } from "./models.js";

const TRADE_FEE_RATE = 0.001;
const MAX_CANDLES = 240;
const MAX_EQUITY_POINTS = 600;
const MAX_TRADES = 200;

export class TradingEngine {
  constructor() {
    this.running = false;
    this.intervalHandle = null;
    this.intervalMs = 1000;
    this.reset({
      modelId: "momentum-ma",
      symbol: "BTC-USD",
      initialCapital: 10_000,
      riskPerTrade: 0.2,
      stopLossPct: 0.03,
      takeProfitPct: 0.07,
    });
  }

  reset(config) {
    this.config = {
      modelId: config.modelId,
      symbol: config.symbol,
      initialCapital: Number(config.initialCapital),
      riskPerTrade: clamp(Number(config.riskPerTrade), 0.01, 0.9),
      stopLossPct: clamp(Number(config.stopLossPct), 0.005, 0.2),
      takeProfitPct: clamp(Number(config.takeProfitPct), 0.01, 0.5),
    };
    this.model = getModelById(this.config.modelId);
    this.simulator = new MarketSimulator({
      symbol: this.config.symbol,
      startPrice:
        config.startPrice ??
        (this.config.symbol === "ETH-USD"
          ? 2800
          : this.config.symbol === "SOL-USD"
            ? 145
            : 42000),
      rng: config.rng ?? Math.random,
    });

    this.cash = this.config.initialCapital;
    this.positionUnits = 0;
    this.entryPrice = 0;
    this.entryFees = 0;
    this.realizedPnl = 0;
    this.closedTrades = [];
    this.candles = [];
    this.equityCurve = [];
    this.tradeLog = [];
    this.lastSignal = 0;
    this.lastSignalLabel = "HOLD";
  }

  start(config) {
    this.stop();
    this.reset(config);
    this.running = true;
    this.intervalHandle = setInterval(() => {
      this.tick();
    }, this.intervalMs);
    return this.getSnapshot();
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.running = false;
    return this.getSnapshot();
  }

  tick() {
    const candle = this.simulator.nextCandle();
    this.candles.push(candle);
    if (this.candles.length > MAX_CANDLES) {
      this.candles.shift();
    }

    const signal = this.model.signal(this.candles);
    this.lastSignal = signal;
    this.lastSignalLabel = signal === 1 ? "BUY" : signal === -1 ? "SELL" : "HOLD";

    this.evaluateRiskRules(candle);
    this.executeSignal(signal, candle);
    this.recordEquity(candle.close, candle.time);
    return candle;
  }

  getCurrentEquity(price) {
    return this.cash + this.positionUnits * price;
  }

  getUnrealizedPnl(price) {
    if (this.positionUnits === 0) {
      return 0;
    }
    if (this.positionUnits > 0) {
      return (price - this.entryPrice) * this.positionUnits;
    }
    return (this.entryPrice - price) * Math.abs(this.positionUnits);
  }

  evaluateRiskRules(candle) {
    if (this.positionUnits === 0 || this.entryPrice <= 0) {
      return;
    }

    const unrealizedPct =
      this.positionUnits > 0
        ? (candle.close - this.entryPrice) / this.entryPrice
        : (this.entryPrice - candle.close) / this.entryPrice;

    if (unrealizedPct <= -this.config.stopLossPct) {
      this.closePosition(candle.close, candle.time, "Stop Loss");
      return;
    }
    if (unrealizedPct >= this.config.takeProfitPct) {
      this.closePosition(candle.close, candle.time, "Take Profit");
    }
  }

  executeSignal(signal, candle) {
    if (signal === 0) {
      return;
    }

    const equity = this.getCurrentEquity(candle.close);
    const notional = equity * this.config.riskPerTrade;
    const units = round(notional / candle.close, 6);
    if (units <= 0) {
      return;
    }

    if (signal === 1 && this.positionUnits <= 0) {
      if (this.positionUnits < 0) {
        this.closePosition(candle.close, candle.time, "Signal Flip Long");
      }
      this.openLong(units, candle.close, candle.time, "Model BUY signal");
      return;
    }

    if (signal === -1 && this.positionUnits >= 0) {
      if (this.positionUnits > 0) {
        this.closePosition(candle.close, candle.time, "Signal Flip Short");
      }
      this.openShort(units, candle.close, candle.time, "Model SELL signal");
    }
  }

  openLong(units, price, time, reason) {
    const fee = units * price * TRADE_FEE_RATE;
    this.cash -= units * price + fee;
    this.positionUnits = units;
    this.entryPrice = price;
    this.entryFees = fee;
    this.logTrade({
      time,
      side: "BUY",
      units,
      price,
      fee,
      reason,
      realizedPnl: this.realizedPnl,
      positionAfter: this.positionUnits,
    });
  }

  openShort(units, price, time, reason) {
    const fee = units * price * TRADE_FEE_RATE;
    this.cash += units * price - fee;
    this.positionUnits = -units;
    this.entryPrice = price;
    this.entryFees = fee;
    this.logTrade({
      time,
      side: "SELL",
      units,
      price,
      fee,
      reason,
      realizedPnl: this.realizedPnl,
      positionAfter: this.positionUnits,
    });
  }

  closePosition(price, time, reason) {
    if (this.positionUnits === 0) {
      return;
    }

    const units = Math.abs(this.positionUnits);
    const closingFee = units * price * TRADE_FEE_RATE;
    let grossPnl = 0;
    let side = "SELL";

    if (this.positionUnits > 0) {
      this.cash += units * price - closingFee;
      grossPnl = (price - this.entryPrice) * units;
      side = "SELL";
    } else {
      this.cash -= units * price + closingFee;
      grossPnl = (this.entryPrice - price) * units;
      side = "BUY";
    }

    const netPnl = grossPnl - this.entryFees - closingFee;
    this.realizedPnl += netPnl;
    this.closedTrades.push(netPnl);

    this.logTrade({
      time,
      side,
      units,
      price,
      fee: closingFee,
      reason,
      pnl: netPnl,
      realizedPnl: this.realizedPnl,
      positionAfter: 0,
    });

    this.positionUnits = 0;
    this.entryPrice = 0;
    this.entryFees = 0;
  }

  logTrade(trade) {
    this.tradeLog.unshift({
      ...trade,
      price: round(trade.price, 2),
      fee: round(trade.fee, 2),
      units: round(trade.units, 6),
      realizedPnl: round(trade.realizedPnl, 2),
      pnl: round(trade.pnl ?? 0, 2),
    });
    if (this.tradeLog.length > MAX_TRADES) {
      this.tradeLog.pop();
    }
  }

  recordEquity(price, time) {
    const equity = this.getCurrentEquity(price);
    this.equityCurve.push({ time, equity: round(equity, 2), price: round(price, 2) });
    if (this.equityCurve.length > MAX_EQUITY_POINTS) {
      this.equityCurve.shift();
    }
  }

  getSnapshot() {
    const latestPrice = this.candles.length
      ? this.candles[this.candles.length - 1].close
      : this.simulator.currentPrice;
    const equity = this.getCurrentEquity(latestPrice);
    const unrealizedPnl = this.getUnrealizedPnl(latestPrice);
    const totalPnl = equity - this.config.initialCapital;
    const wins = this.closedTrades.filter((value) => value > 0).length;
    const losses = this.closedTrades.filter((value) => value <= 0).length;
    const returns = [];

    for (let i = 1; i < this.equityCurve.length; i += 1) {
      const prev = this.equityCurve[i - 1].equity;
      const curr = this.equityCurve[i].equity;
      if (prev !== 0) {
        returns.push((curr - prev) / prev);
      }
    }

    return {
      running: this.running,
      model: {
        id: this.model.id,
        name: this.model.name,
        description: this.model.description,
        riskProfile: this.model.riskProfile,
      },
      config: this.config,
      market: {
        symbol: this.config.symbol,
        latestPrice: round(latestPrice, 2),
        candles: this.candles,
      },
      portfolio: {
        cash: round(this.cash, 2),
        positionUnits: round(this.positionUnits, 6),
        entryPrice: round(this.entryPrice, 2),
        equity: round(equity, 2),
        realizedPnl: round(this.realizedPnl, 2),
        unrealizedPnl: round(unrealizedPnl, 2),
        totalPnl: round(totalPnl, 2),
        totalReturnPct: round((totalPnl / this.config.initialCapital) * 100, 2),
      },
      stats: {
        totalSignals: this.candles.length,
        lastSignal: this.lastSignalLabel,
        closedTrades: this.closedTrades.length,
        wins,
        losses,
        winRate: this.closedTrades.length ? round((wins / this.closedTrades.length) * 100, 2) : 0,
        maxDrawdownPct: round(maxDrawdown(this.equityCurve.map((point) => point.equity)) * 100, 2),
        sharpeRatio: round(sharpeRatio(returns), 2),
      },
      equityCurve: this.equityCurve,
      recentTrades: this.tradeLog.slice(0, 20),
      updatedAt: new Date().toISOString(),
    };
  }
}
