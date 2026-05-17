# Trading Agent Dashboard

A self-contained paper-trading application with:

- a Node/Express simulation API
- a React dashboard built with Vite
- selectable trading models
- live paper-trading controls
- recent trade and signal visibility
- profit/loss and equity analytics
- synthetic backtesting

## Important note

This project simulates trading decisions on generated market data. It is suitable for experimentation, UI demos, and strategy iteration, but it does **not** guarantee real-world profits and should not be treated as financial advice.

## Features

- **Model selection** for three strategies:
  - Momentum Pulse
  - Mean Reversion AI
  - Hybrid Ensemble
- **Live paper trading** with start/stop controls
- **Risk profile selection** with conservative, balanced, and aggressive modes
- **Market analysis panel** showing EMA, RSI, volatility, regime, and current model bias
- **Performance cards** for equity, realized P/L, unrealized P/L, win rate, and drawdown
- **Trade log and signal feed**
- **Backtesting** over synthetic candle history with an equity curve and summary metrics

## Project structure

```text
.
├── client/   # React UI
├── server/   # Express API and trading simulator
└── README.md
```

## Run locally

Install dependencies:

```bash
npm install
cd client && npm install
cd ../server && npm install
```

Start the app from the repository root:

```bash
npm run dev
```

That starts:

- the API on `http://localhost:4000`
- the React UI on Vite's default local port

## Useful scripts

From the repository root:

```bash
npm run dev
npm run build
npm run lint
```

## API overview

- `GET /api/bootstrap` - returns UI config plus the current dashboard snapshot
- `GET /api/session` - returns the current live trading snapshot
- `POST /api/trading/start` - starts a paper-trading session
- `POST /api/trading/stop` - stops the active paper-trading session
- `POST /api/backtest` - runs a backtest using the selected model and settings

## Backend notes

The trading engine uses:

- deterministic synthetic market generation
- EMA, RSI, volatility, and slope-based analysis
- one active simulated position at a time
- stop loss, take profit, and max holding-period exits

## Frontend notes

The React dashboard includes:

- control forms for symbol, capital, tick speed, model, and risk profile
- a live market/equity chart
- a backtest equity chart
- status and reasoning panels
- trade and signal tables for operator visibility
