const createGaussianNoise = (rng = Math.random) => {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export class MarketSimulator {
  constructor({ symbol = "BTC-USD", startPrice = 42000, rng = Math.random } = {}) {
    this.symbol = symbol;
    this.currentPrice = startPrice;
    this.rng = rng;
    this.timestamp = Date.now();
  }

  nextCandle() {
    const open = this.currentPrice;
    const trend = this.currentPrice * 0.00025;
    const noise = createGaussianNoise(this.rng) * this.currentPrice * 0.0045;
    const close = Math.max(1, open + trend + noise);

    const wickUp = Math.abs(createGaussianNoise(this.rng)) * this.currentPrice * 0.0018;
    const wickDown = Math.abs(createGaussianNoise(this.rng)) * this.currentPrice * 0.0018;

    const high = Math.max(open, close) + wickUp;
    const low = Math.max(1, Math.min(open, close) - wickDown);
    const volume = 50 + this.rng() * 100;
    this.currentPrice = close;
    this.timestamp += 60_000;

    return {
      symbol: this.symbol,
      time: new Date(this.timestamp).toISOString(),
      open,
      high,
      low,
      close,
      volume,
    };
  }
}
