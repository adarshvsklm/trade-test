# Quant Trading Agent

A full-stack trading agent that can **analyse**, **paper-trade**, and
**backtest** strategies, with a modern React dashboard for control and
monitoring.

The system is intentionally educational and risk-free: all live trading is
**simulated** ("paper trading") against a synthetic next-bar feed. The same
strategy code can be pointed at real broker APIs later — the interfaces are
broker-agnostic.

## Features

**Backend (Python / FastAPI)**
- Pluggable strategy framework — add a new model by dropping a file into
  `backend/app/strategies/`.
- Six built-in models:
  - `sma_crossover` — fast/slow simple moving-average trend.
  - `rsi_reversion` — RSI mean reversion.
  - `macd_trend` — MACD trend following.
  - `donchian_breakout` — N-bar high/low breakout.
  - `momentum` — N-bar return-sign momentum with threshold.
  - `ensemble` — votes across all strategies for higher quality entries.
- Vectorized backtester with next-bar execution, transaction costs,
  long/short, Sharpe, Sortino, max drawdown, win rate, profit factor,
  trade-by-trade output, and Buy & Hold comparison.
- Threaded **live paper-trading engine** that ticks a strategy on a chosen
  interval, marks the portfolio to market, and emits a trade log.
- Market data via `yfinance` when network is available, with an automatic
  fallback to deterministic synthetic OHLCV so the system always runs.
- Clean JSON API, CORS-enabled.

**Frontend (React + TypeScript + Vite)**
- Dark, polished dashboard with two tabs: **Live Trader** and **Backtest**.
- Pick the symbol, the model, tune parameters, set capital / fees / shorting.
- Live PnL, equity curve, position state, latest signal, full trade log.
- Backtest panel shows KPIs (Sharpe, Sortino, drawdown, win rate, profit
  factor, vs. Buy & Hold) plus equity curve, price series, and trades.
- Charts via Recharts; responsive layout.

## Repository layout

```
backend/        FastAPI service, strategies, backtester, paper trader
frontend/       React + Vite + TypeScript dashboard
```

## Quick start

You need Python 3.10+ and Node 18+.

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API serves on `http://127.0.0.1:8000` and exposes `GET /api/health`,
`GET /api/strategies`, `POST /api/backtest`, `POST /api/trader/start`, etc.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The dev server proxies `/api` to the backend on
port `8000`, so no further configuration is needed.

For a production build:

```bash
npm run build
# Serve frontend/dist with any static host.
# Point it at a remote API by setting VITE_API_BASE before building.
```

## Using the UI

**Live Trader tab**
1. Choose a symbol and a model.
2. Tune parameters, capital, tick interval, and whether shorting is allowed.
3. Click **Start Trading**. The agent runs in the background, executing
   simulated orders every tick. Stop or reset at any time.
4. Watch the **Equity vs. Price** chart, the **KPI grid**, and the live
   **Trade Log** for trade-by-trade detail.

**Backtest tab**
1. Pick a symbol, model, parameters, period, interval, capital, fees.
2. Click **Run Backtest**.
3. Inspect total / annualized return, Sharpe & Sortino, drawdown, win rate,
   profit factor, the equity curve, the price chart, and the last 50 trades.
4. Compare against the Buy & Hold benchmark shown alongside.

## Adding a new strategy

Create `backend/app/strategies/my_model.py`:

```python
import pandas as pd
from .base import Strategy, StrategyParam, register

def _signals(df: pd.DataFrame, p: dict) -> pd.Series:
    # return a pd.Series of {-1, 0, 1} aligned with df.index
    ...

register(Strategy(
    key="my_model",
    name="My Model",
    description="What it does, in one sentence.",
    params=[StrategyParam("lookback", "int", 20, 2, 200, "Lookback bars")],
    fn=_signals,
))
```

Import it in `backend/app/strategies/__init__.py` and it appears in the UI
dropdown automatically.

## API reference (selected endpoints)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET    | `/api/health`            | Liveness probe. |
| GET    | `/api/strategies`        | All registered models with their parameter schemas. |
| GET    | `/api/symbols`           | Demo list of supported symbols. |
| GET    | `/api/history/{symbol}`  | OHLCV time series for charts. |
| POST   | `/api/backtest`          | Run a backtest, returns metrics + curves + trades. |
| POST   | `/api/trader/start`      | Start (or restart) the paper trader. |
| POST   | `/api/trader/stop`       | Stop the paper trader and flatten. |
| POST   | `/api/trader/reset`      | Reset capital and trade log. |
| GET    | `/api/trader/state`      | Poll current state (equity, PnL, position, recent trades). |

## Deploy on Vercel

The repo includes a root [`vercel.json`](vercel.json) that builds the React app and
routes `/api/*` to the FastAPI backend as a Python serverless function.

**One-click / dashboard**

1. Import the repository in [Vercel](https://vercel.com/new).
2. Leave the root directory as `.` (defaults from `vercel.json` apply).
3. Deploy. No extra env vars are required for same-origin API calls
   (`VITE_API_BASE` is set to an empty string in `vercel.json`).

**CLI**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

**Frontend only**

To host only the UI on Vercel and run the API elsewhere (Railway, Render, a VPS,
etc.), remove or adjust the `/api` rewrite in `vercel.json`, set
`VITE_API_BASE` in the Vercel project settings to your API origin (see
`frontend/.env.example`), and redeploy.

**Serverless limitations**

Backtests and read-only endpoints work well on Vercel. The **live paper trader**
uses an in-process background thread and in-memory state, which does not persist
across serverless invocations — use a long-running host for `uvicorn` if you need
continuous paper trading.

## Static landing page (GitHub Pages)

This repo also ships a small static landing page at the root (`index.html`,
`styles.css`, `app.js`) that is auto-deployed by
`.github/workflows/deploy.yml` to GitHub Pages on every push to `main`.

To enable it once, go to **Settings → Pages → Build and deployment** and choose
**GitHub Actions** as the source. The page becomes available at
`https://<owner>.github.io/<repo>/`.

## Variants

The `variants/` directory archives alternative implementations of the trading
agent that were developed on other branches. They are kept side-by-side so no
work is lost; the primary, supported app remains the one in `backend/` and
`frontend/` at the repo root.

## Notes & disclaimer

This project is for research / education. None of the included models constitute
financial advice. Past simulated performance is **not** indicative of future
results. Live trading requires connecting a real broker and proper risk
management — the strategy interface is designed for that, but no real-money
trading is wired up by default.
