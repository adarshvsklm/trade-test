# Trading Agent

An AI-powered trading agent with technical analysis, paper trading, and backtesting capabilities. Features a modern React dashboard for monitoring trades, analyzing stocks, and testing strategies.

## Features

- **Technical Analysis** - SMA Crossover, RSI, MACD, Bollinger Bands, and an Ensemble (Combined) strategy
- **Paper Trading** - Simulated trading with real market data and virtual money, with stop-loss and take-profit
- **Backtesting** - Test any strategy against historical data with full performance metrics
- **Live Dashboard** - Real-time portfolio tracking, watchlist, price charts, and trade history
- **Strategy Selection** - Choose from 5 built-in models or use the ensemble for combined signals

## Architecture

```
backend/           Python FastAPI backend
├── main.py            API server with REST endpoints
├── models.py          Pydantic data models
├── strategies.py      Trading strategy implementations
├── trading_engine.py  Paper trading engine + backtester
└── requirements.txt   Python dependencies

frontend/          React TypeScript frontend
├── src/
│   ├── api.ts             API client
│   ├── App.tsx            Main app with navigation
│   ├── App.css            Global styles (dark theme)
│   └── components/
│       ├── Dashboard.tsx      Portfolio overview + watchlist
│       ├── TradingPanel.tsx   Start/stop trading, configure strategy
│       ├── BacktestPanel.tsx  Historical strategy backtesting
│       └── AnalysisPanel.tsx  Technical analysis + indicators
└── package.json
```

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+

### Run Everything

```bash
./run.sh
```

### Run Separately

**Backend:**

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Frontend:**

```bash
cd frontend
npm install
npm start
```

The frontend runs on `http://localhost:3000` and the API on `http://localhost:8000`.

## Trading Strategies

| Strategy | Description |
|----------|-------------|
| **SMA Crossover** | Buys when 20-day SMA crosses above 50-day SMA, sells on the reverse |
| **RSI** | Buys when RSI < 30 (oversold), sells when RSI > 70 (overbought) |
| **MACD** | Trades on MACD line / signal line crossovers |
| **Bollinger Bands** | Buys at lower band, sells at upper band |
| **Combined (Ensemble)** | Majority vote from all four strategies |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/strategies` | List available strategies |
| GET | `/api/quote/{symbol}` | Get stock quote |
| GET | `/api/market-data/{symbol}` | Get OHLCV price data |
| GET | `/api/analysis/{symbol}` | Technical analysis with indicators |
| POST | `/api/trading/start` | Start paper trading |
| POST | `/api/trading/stop` | Stop paper trading |
| GET | `/api/trading/status` | Get current trading status |
| POST | `/api/backtest` | Run strategy backtest |
| GET | `/api/watchlist` | Get watchlist quotes |

## UI Sections

- **Dashboard** - Portfolio value, P&L, market overview chart, watchlist with real-time prices, recent trades
- **Trading** - Configure symbol, strategy, capital, trade size, stop-loss, take-profit. Start/stop paper trading with live status
- **Backtest** - Set date range, strategy, and capital. View equity curve, win rate, Sharpe ratio, max drawdown, and full trade log
- **Analysis** - Technical analysis with indicator charts, current buy/sell/hold signals, stock fundamentals

## Disclaimer

This is a paper trading simulation for educational purposes. No real trades are executed. Past performance does not guarantee future results.
