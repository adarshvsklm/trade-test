# TradeBot — AI Trading Agent

A full-stack paper trading platform with multiple algorithmic strategies, real-time portfolio tracking, and backtesting.

> **Paper trading only** — no real money is involved. This system simulates trades using live market data.

---

## Features

- **6 Trading Strategies**: SMA Crossover, RSI, MACD, Bollinger Bands, ML (Random Forest), Mean Reversion
- **Live Paper Trading**: Start/stop an agent that runs on a configurable interval and executes trades automatically
- **Real-time Dashboard**: WebSocket-powered live updates, portfolio equity, P&L, open position info
- **Backtesting Engine**: Test any strategy against historical data, with full equity curve, trade log, and statistics
- **Strategy Comparison**: Run all strategies on the same date range and compare results side-by-side
- **Analytics**: P&L per trade bar chart, win/loss pie chart, equity progression
- **Market Data**: Live price charts, ticker info (sector, P/E ratio, 52-week high/low, etc.)

---

## Architecture

```
backend/            FastAPI + WebSockets
  main.py           REST API + WebSocket server
  trading_agent.py  Paper trading agent (async loop)
  backtester.py     Historical strategy backtester
  data_fetcher.py   yfinance market data wrapper
  strategies/
    base.py
    sma_crossover.py
    rsi_strategy.py
    macd_strategy.py
    bollinger_bands.py
    ml_strategy.py       Random Forest on technical features
    mean_reversion.py

frontend/           React + Vite + Tailwind CSS
  src/
    pages/
      Dashboard.jsx      Portfolio overview + price chart
      TradePage.jsx      Start/stop trading, strategy picker, logs
      BacktestPage.jsx   Backtest config + results + comparison
      AnalyticsPage.jsx  P&L charts, win/loss breakdown
    components/
      EquityChart.jsx
      PriceChart.jsx
      TradeTable.jsx
      BacktestResultCard.jsx
      LogConsole.jsx
      StatCard.jsx
      Badge.jsx
    hooks/
      useWebSocket.js    Auto-reconnecting WebSocket hook
    utils/
      api.js             Axios API client
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### Install & Run

```bash
# Install backend dependencies
cd backend
pip install -r requirements.txt

# Install frontend dependencies
cd ../frontend
npm install

# Start everything at once
cd ..
./start.sh
```

Then open **http://localhost:3000** in your browser.

API docs are at **http://localhost:8000/docs**.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/strategies` | List available strategies |
| POST | `/api/start` | Start trading agent |
| POST | `/api/stop` | Stop trading agent |
| GET | `/api/state` | Get agent state (polling fallback) |
| POST | `/api/backtest` | Run backtest |
| GET | `/api/market-data/{symbol}` | OHLCV data |
| GET | `/api/ticker/{symbol}` | Ticker fundamentals |
| GET | `/api/price/{symbol}` | Current price |
| WS | `/ws` | Real-time state stream |

---

## Strategies

| Strategy | Signal Logic |
|----------|-------------|
| SMA Crossover | Buy when fast SMA (10) crosses above slow SMA (30); sell on cross below |
| RSI | Buy when RSI < 30 (oversold); sell when RSI > 70 (overbought) |
| MACD | Buy when MACD line crosses above signal line; sell on cross below |
| Bollinger Bands | Buy when price crosses back above lower band; sell at upper band touch |
| ML (Random Forest) | Trained on 7 technical features; predicts BUY/HOLD/SELL 5 bars ahead |
| Mean Reversion | Buy when price is >2% below 20-day mean; sell when >2% above |
