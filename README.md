# Trading Agent

A full-stack trading agent with strategy-based analysis, live trading simulation, backtesting, and a modern React dashboard.

## Architecture

```
backend/          Python FastAPI server
├── app/
│   ├── main.py           REST API + WebSocket server
│   ├── models.py          Pydantic schemas
│   ├── strategies.py      Trading strategy models
│   ├── trading_engine.py  Live trading engine
│   ├── backtester.py      Historical backtesting
│   └── data_fetcher.py    Market data via yfinance

frontend/         React (Vite) dashboard
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx      Portfolio overview + charts
│   │   ├── TradingPanel.jsx   Start/stop sessions, model selection
│   │   ├── Backtest.jsx       Historical backtest runner
│   │   └── TradeHistory.jsx   Trade log with export
│   ├── hooks/useTrading.js    State + WebSocket hook
│   └── utils/api.js           API client
```

## Trading Strategies

| Strategy | Description |
|---|---|
| **SMA Crossover** | Buy/sell on short/long moving average crossovers |
| **RSI Momentum** | Trade oversold/overbought RSI levels |
| **MACD Signal** | Trade MACD/signal line crossovers |
| **Bollinger Bands** | Mean-reversion at band boundaries |
| **Mean Reversion** | Z-score based mean reversion |
| **Ensemble** | Majority-vote combination of all strategies |

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Features

- **Dashboard** — Portfolio value, P&L, active session monitoring, market price charts
- **Trade** — Select strategy model, configure capital/risk, start/stop live trading sessions
- **Backtest** — Run historical backtests with equity curves, drawdown charts, and trade logs
- **History** — Full trade log with filtering, CSV export
- **Real-time** — WebSocket-powered live updates during trading

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/strategies` | List available strategies |
| GET | `/api/price/{symbol}` | Current price quote |
| GET | `/api/history/{symbol}` | OHLCV price history |
| GET | `/api/indicators/{symbol}` | Strategy indicator values |
| POST | `/api/trade/start` | Start a trading session |
| POST | `/api/trade/stop/{id}` | Stop a trading session |
| GET | `/api/sessions` | List all sessions |
| POST | `/api/backtest` | Run a backtest |
| WS | `/ws` | Real-time trade updates |

## Disclaimer

This is a simulation/educational tool. It uses paper trading only — no real money is at risk. Past performance in backtests does not guarantee future results.
