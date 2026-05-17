# AlphaPulse Trader

A React-based trading simulator that lets users:

- analyze synthetic market data with multiple trading models
- start and pause automated paper trading
- switch between model combinations and risk profiles
- monitor portfolio value, open exposure, win rate, and profit/loss
- review recent trade fills and model rationale
- run a full backtest against the current market and strategy settings

## Tech stack

- React
- Vite
- Recharts

## Run locally

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
```

## Notes

- The app uses generated market data so it runs without broker or exchange credentials.
- Trading is simulated only. It does not connect to a live venue or guarantee profits.
