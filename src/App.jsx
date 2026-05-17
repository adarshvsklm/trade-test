import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { runBacktest } from './lib/backtest'
import { generateMarketData } from './lib/marketData'
import { createSession, processCandle } from './lib/tradingEngine'
import {
  evaluateEnsemble,
  getModelsById,
  TRADING_MODELS,
} from './lib/tradingModels'

const WARMUP_PERIOD = 35
const DEFAULT_INITIAL_CAPITAL = 10_000
const DEFAULT_RISK = 25
const DEFAULT_SPEED = 650
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function createSimulationState({ marketData, initialCapital }) {
  const startIndex = Math.min(WARMUP_PERIOD, marketData.length - 1)
  const startCandle = marketData[startIndex]
  const session = createSession(initialCapital, startCandle)

  return {
    cursor: startIndex,
    session,
    latestDecision: {
      action: 'hold',
      confidence: 0,
      reason: 'Waiting for simulation start.',
    },
    modelBreakdown: [],
  }
}

function formatCurrency(value) {
  return CURRENCY_FORMATTER.format(value)
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`
}

function formatTime(timestamp) {
  return DATE_FORMATTER.format(new Date(timestamp))
}

function App() {
  const [marketData, setMarketData] = useState(() =>
    generateMarketData({ length: 500, seed: 7 }),
  )
  const [initialCapital, setInitialCapital] = useState(DEFAULT_INITIAL_CAPITAL)
  const [riskPercent, setRiskPercent] = useState(DEFAULT_RISK)
  const [speedMs, setSpeedMs] = useState(DEFAULT_SPEED)
  const [selectedModelIds, setSelectedModelIds] = useState([
    'trend-rider',
    'mean-reverter',
  ])
  const [isTrading, setIsTrading] = useState(false)
  const [simState, setSimState] = useState(() =>
    createSimulationState({
      marketData,
      initialCapital: DEFAULT_INITIAL_CAPITAL,
    }),
  )
  const [backtestResult, setBacktestResult] = useState(null)

  const selectedModels = useMemo(
    () => getModelsById(selectedModelIds),
    [selectedModelIds],
  )

  const currentCandle = marketData[simState.cursor]
  const currentPrice = currentCandle?.price ?? marketData.at(-1).price
  const canRun = selectedModels.length > 0
  const hasRemainingTicks = simState.cursor < marketData.length - 1
  const portfolio = simState.session.portfolio
  const visibleTrades = simState.session.trades.slice(-12).reverse()

  useEffect(() => {
    if (!isTrading || !canRun) {
      return undefined
    }

    if (!hasRemainingTicks) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      let reachedEnd = false
      setSimState((previous) => {
        const nextCursor = previous.cursor + 1
        if (nextCursor >= marketData.length) {
          return previous
        }

        const nextCandle = marketData[nextCursor]
        const history = marketData.slice(0, nextCursor + 1)
        const evaluation = evaluateEnsemble(selectedModels, history)
        const result = processCandle({
          session: previous.session,
          candle: nextCandle,
          decision: evaluation.ensemble,
          riskPercent,
        })

        if (nextCursor >= marketData.length - 1) {
          reachedEnd = true
        }

        return {
          cursor: nextCursor,
          session: result.session,
          latestDecision: evaluation.ensemble,
          modelBreakdown: evaluation.breakdown,
        }
      })
      if (reachedEnd) {
        setIsTrading(false)
      }
    }, speedMs)

    return () => window.clearTimeout(timer)
  }, [
    canRun,
    isTrading,
    marketData,
    riskPercent,
    selectedModels,
    hasRemainingTicks,
    simState.cursor,
    speedMs,
  ])

  function handleModelToggle(modelId) {
    setSelectedModelIds((previous) => {
      if (previous.includes(modelId)) {
        return previous.filter((id) => id !== modelId)
      }
      return [...previous, modelId]
    })
  }

  function handleReset() {
    setIsTrading(false)
    setBacktestResult(null)
    setSimState(
      createSimulationState({
        marketData,
        initialCapital,
      }),
    )
  }

  function handleRegenerateMarket() {
    const seed = Math.floor(Math.random() * 9_000) + 100
    const freshMarket = generateMarketData({ length: 500, seed })
    setIsTrading(false)
    setBacktestResult(null)
    setMarketData(freshMarket)
    setSimState(
      createSimulationState({
        marketData: freshMarket,
        initialCapital,
      }),
    )
  }

  function handleRunBacktest() {
    if (!canRun) {
      return
    }

    const result = runBacktest({
      marketData,
      models: selectedModels,
      initialCapital,
      riskPercent,
      warmupPeriod: WARMUP_PERIOD,
    })
    setBacktestResult(result)
  }

  return (
    <main className="app">
      <header className="header">
        <div>
          <h1>Trading Agent Simulator</h1>
          <p>
            Analyze market flow, execute simulated trades, and evaluate strategy
            performance in real time.
          </p>
        </div>
        <div className="market-meta">
          <span>Price: {formatCurrency(currentPrice)}</span>
          <span>Tick: {simState.cursor + 1} / {marketData.length}</span>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard title="Portfolio Equity" value={formatCurrency(portfolio.equity)} />
        <StatCard title="Total P/L" value={formatCurrency(portfolio.totalPnl)} />
        <StatCard title="Cash" value={formatCurrency(portfolio.cash)} />
        <StatCard
          title="Position Size"
          value={`${portfolio.positionQty.toFixed(4)} units`}
        />
        <StatCard
          title="Unrealized P/L"
          value={formatCurrency(portfolio.unrealizedPnl)}
        />
        <StatCard
          title="Max Drawdown"
          value={formatPercent(portfolio.maxDrawdown)}
        />
      </section>

      <section className="layout">
        <article className="panel controls">
          <h2>Trading Controls</h2>
          <div className="field">
            <label htmlFor="capital">Initial capital (USD)</label>
            <input
              id="capital"
              type="number"
              min="500"
              step="500"
              value={initialCapital}
              onChange={(event) => setInitialCapital(Number(event.target.value))}
              disabled={isTrading}
            />
          </div>

          <div className="field">
            <label htmlFor="risk">Risk per trade: {riskPercent}%</label>
            <input
              id="risk"
              type="range"
              min="5"
              max="60"
              value={riskPercent}
              onChange={(event) => setRiskPercent(Number(event.target.value))}
            />
          </div>

          <div className="field">
            <label htmlFor="speed">Speed: {speedMs}ms / tick</label>
            <input
              id="speed"
              type="range"
              min="150"
              max="1200"
              step="50"
              value={speedMs}
              onChange={(event) => setSpeedMs(Number(event.target.value))}
            />
          </div>

          <fieldset className="models">
            <legend>Models to use for trading</legend>
            {TRADING_MODELS.map((model) => (
              <label key={model.id} className="model-option">
                <input
                  type="checkbox"
                  checked={selectedModelIds.includes(model.id)}
                  onChange={() => handleModelToggle(model.id)}
                />
                <span>
                  <strong>{model.name}</strong>
                  <small>{model.description}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="actions">
            <button
              type="button"
              onClick={() => setIsTrading((value) => !value)}
              disabled={!canRun || !hasRemainingTicks}
            >
              {isTrading ? 'Pause Trading' : 'Start Trading'}
            </button>
            <button type="button" onClick={handleReset}>
              Reset Session
            </button>
            <button type="button" onClick={handleRegenerateMarket}>
              New Market Scenario
            </button>
          </div>
        </article>

        <article className="panel">
          <h2>Live Performance</h2>
          <div className="chart-stack">
            <ChartCard
              title="Price path"
              data={marketData.slice(0, simState.cursor + 1).map((point) => point.price)}
              color="#60a5fa"
            />
            <ChartCard
              title="Equity curve"
              data={simState.session.equityCurve.map((point) => point.equity)}
              color="#34d399"
            />
          </div>

          <div className="signal-box">
            <h3>Current Ensemble Signal</h3>
            <p>
              <strong>{simState.latestDecision.action.toUpperCase()}</strong> | confidence{' '}
              {(simState.latestDecision.confidence * 100).toFixed(1)}%
            </p>
            <p>{simState.latestDecision.reason}</p>
          </div>

          <div className="signal-table">
            <h3>Model votes</h3>
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Action</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {simState.modelBreakdown.map((entry) => (
                  <tr key={entry.modelId}>
                    <td>{entry.modelName}</td>
                    <td>{entry.action.toUpperCase()}</td>
                    <td>{(entry.confidence * 100).toFixed(1)}%</td>
                  </tr>
                ))}
                {!simState.modelBreakdown.length && (
                  <tr>
                    <td colSpan="3">Signals appear when trading starts.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="layout">
        <article className="panel">
          <h2>Trade Log</h2>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Side</th>
                <th>Price</th>
                <th>Quantity</th>
                <th>Realized P/L</th>
              </tr>
            </thead>
            <tbody>
              {visibleTrades.map((trade) => (
                <tr key={`${trade.index}-${trade.side}`}>
                  <td>{formatTime(trade.timestamp)}</td>
                  <td>{trade.side}</td>
                  <td>{formatCurrency(trade.price)}</td>
                  <td>{trade.quantity.toFixed(4)}</td>
                  <td>{formatCurrency(trade.realizedPnl)}</td>
                </tr>
              ))}
              {!visibleTrades.length && (
                <tr>
                  <td colSpan="5">No trades yet. Start trading to populate this feed.</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>

        <article className="panel backtest">
          <h2>Backtest</h2>
          <p>
            Run selected models across the full market history to compare returns
            and risk before going live.
          </p>
          <button type="button" onClick={handleRunBacktest} disabled={!canRun}>
            Run Backtest
          </button>

          {backtestResult && (
            <div className="backtest-result">
              <div className="mini-stats">
                <StatCard
                  title="Backtest Total P/L"
                  value={formatCurrency(backtestResult.session.portfolio.totalPnl)}
                />
                <StatCard
                  title="Sharpe Ratio"
                  value={backtestResult.metrics.sharpeRatio.toFixed(2)}
                />
                <StatCard
                  title="Profit Factor"
                  value={backtestResult.metrics.profitFactor.toFixed(2)}
                />
                <StatCard
                  title="Win Rate"
                  value={formatPercent(backtestResult.metrics.winRate)}
                />
              </div>
              <ChartCard
                title="Backtest equity"
                data={backtestResult.session.equityCurve.map((point) => point.equity)}
                color="#f59e0b"
              />
            </div>
          )}
        </article>
      </section>
    </main>
  )
}

function StatCard({ title, value }) {
  return (
    <article className="stat-card">
      <h3>{title}</h3>
      <strong>{value}</strong>
    </article>
  )
}

function ChartCard({ title, data, color }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3>{title}</h3>
      </div>
      <LineChart data={data} color={color} />
    </div>
  )
}

function LineChart({ data, color = '#60a5fa' }) {
  if (data.length < 2) {
    return <div className="empty-chart">Not enough points</div>
  }

  const width = 520
  const height = 160
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      className="line-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="line chart"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  )
}

export default App
