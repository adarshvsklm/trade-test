import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api'

const initialForm = {
  symbolId: 'BTC/USD',
  modelId: 'momentum-pulse',
  riskProfileId: 'balanced',
  capital: 10000,
  tickIntervalMs: 1500,
  backtestCandles: 220,
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`)
  }

  return response.json()
}

function formatMoney(value, symbolId = 'BTC/USD') {
  if (value == null) {
    return '--'
  }

  if (symbolId === 'EUR/USD') {
    return `$${Number(value).toFixed(5)}`
  }

  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatPercent(value) {
  if (value == null) {
    return '--'
  }

  return `${Number(value).toFixed(2)}%`
}

function formatTime(timestamp) {
  if (!timestamp) {
    return '--'
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getMetricTone(value) {
  if (value > 0) {
    return 'positive'
  }

  if (value < 0) {
    return 'negative'
  }

  return 'neutral'
}

function Card({ title, subtitle, actions, children }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{title}</p>
          {subtitle ? <h2>{subtitle}</h2> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  )
}

function MetricCard({ label, value, tone = 'neutral', helper }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  )
}

function App() {
  const [config, setConfig] = useState(null)
  const [dashboard, setDashboard] = useState(null)
  const [backtest, setBacktest] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')

  const selectedSymbol = form.symbolId
  const sessionStatus = dashboard?.session?.status ?? 'idle'

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        const data = await api('/bootstrap')

        if (cancelled) {
          return
        }

        setConfig(data.config)
        setDashboard(data.dashboard)
        setBacktest(data.dashboard)
        setForm((current) => ({
          ...current,
          ...data.config.defaults,
        }))
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError.message)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (sessionStatus !== 'running') {
      return undefined
    }

    const timer = window.setInterval(async () => {
      try {
        const nextDashboard = await api('/session')
        setDashboard(nextDashboard)
      } catch (requestError) {
        setError(requestError.message)
      }
    }, 2000)

    return () => window.clearInterval(timer)
  }, [sessionStatus])

  const chartData = useMemo(() => {
    const candles = dashboard?.market?.candles ?? []
    const equityCurve = new Map((dashboard?.equityCurve ?? []).map((point) => [point.timestamp, point.equity]))

    return candles.map((candle) => ({
      time: formatTime(candle.timestamp),
      price: candle.close,
      equity: equityCurve.get(candle.timestamp),
      regime: candle.regime,
    }))
  }, [dashboard])

  const backtestChartData = useMemo(
    () =>
      (backtest?.equityCurve ?? []).map((point) => ({
        time: formatTime(point.timestamp),
        equity: point.equity,
        price: point.price,
      })),
    [backtest],
  )

  async function handleStartTrading() {
    setBusyAction('start')
    setError('')

    try {
      const nextDashboard = await api('/trading/start', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          capital: Number(form.capital),
          tickIntervalMs: Number(form.tickIntervalMs),
        }),
      })

      setDashboard(nextDashboard)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyAction('')
    }
  }

  async function handleStopTrading() {
    setBusyAction('stop')
    setError('')

    try {
      const nextDashboard = await api('/trading/stop', {
        method: 'POST',
      })

      setDashboard(nextDashboard)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyAction('')
    }
  }

  async function handleBacktest() {
    setBusyAction('backtest')
    setError('')

    try {
      const result = await api('/backtest', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          capital: Number(form.capital),
          candles: Number(form.backtestCandles),
        }),
      })

      setBacktest(result)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyAction('')
    }
  }

  if (!config || !dashboard) {
    return (
      <main className="app-shell centered-state">
        <div className="loading-card">
          <p className="eyebrow">Bootstrapping workspace</p>
          <h1>Preparing trading dashboard...</h1>
        </div>
      </main>
    )
  }

  const performance = dashboard.performance
  const backtestPerformance = backtest?.performance

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Autonomous trading simulator</p>
          <h1>Trade with model selection, live paper execution, and backtesting.</h1>
          <p className="hero-copy">
            This workspace demonstrates a paper-trading agent with synthetic market data, technical analysis,
            live signals, recent trades, and backtest evaluation. It is designed for experimentation rather
            than guaranteed real-world profit.
          </p>
        </div>

        <div className="hero-status">
          <div>
            <span>Session status</span>
            <strong className={`status-pill ${sessionStatus}`}>{sessionStatus}</strong>
          </div>
          <div>
            <span>Active model</span>
            <strong>{dashboard.analysis.modelDecision.modelName}</strong>
          </div>
          <div>
            <span>Market regime</span>
            <strong>{dashboard.analysis.marketRegime}</strong>
          </div>
          <div>
            <span>Bias</span>
            <strong>{dashboard.analysis.bias}</strong>
          </div>
        </div>
      </header>

      {error ? <div className="error-banner">{error}</div> : null}

      <section className="layout-grid">
        <Card title="Trading controls" subtitle="Configure the simulation before you deploy capital.">
          <div className="form-grid">
            <label>
              Symbol
              <select
                value={form.symbolId}
                onChange={(event) => setForm((current) => ({ ...current, symbolId: event.target.value }))}
              >
                {config.symbols.map((symbolId) => (
                  <option key={symbolId} value={symbolId}>
                    {symbolId}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Risk profile
              <select
                value={form.riskProfileId}
                onChange={(event) => setForm((current) => ({ ...current, riskProfileId: event.target.value }))}
              >
                {config.riskProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Starting capital
              <input
                type="number"
                min="1000"
                step="500"
                value={form.capital}
                onChange={(event) => setForm((current) => ({ ...current, capital: event.target.value }))}
              />
            </label>

            <label>
              Tick interval (ms)
              <input
                type="number"
                min="500"
                step="250"
                value={form.tickIntervalMs}
                onChange={(event) => setForm((current) => ({ ...current, tickIntervalMs: event.target.value }))}
              />
            </label>

            <label>
              Backtest candles
              <input
                type="number"
                min="100"
                max="500"
                step="20"
                value={form.backtestCandles}
                onChange={(event) => setForm((current) => ({ ...current, backtestCandles: event.target.value }))}
              />
            </label>
          </div>

          <div className="model-grid">
            {config.models.map((model) => (
              <button
                key={model.id}
                type="button"
                className={`model-card ${form.modelId === model.id ? 'selected' : ''}`}
                onClick={() => setForm((current) => ({ ...current, modelId: model.id }))}
              >
                <div>
                  <span>{model.style}</span>
                  <strong>{model.name}</strong>
                </div>
                <p>{model.description}</p>
                <small>
                  Risk: {model.risk} · Holding bias: {model.holdingBias}
                </small>
              </button>
            ))}
          </div>

          <div className="action-row">
            <button type="button" className="primary-btn" onClick={handleStartTrading} disabled={busyAction !== ''}>
              {busyAction === 'start' ? 'Starting...' : 'Start trading'}
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={handleStopTrading}
              disabled={busyAction !== '' || sessionStatus !== 'running'}
            >
              {busyAction === 'stop' ? 'Stopping...' : 'Stop trading'}
            </button>
            <button type="button" className="secondary-btn" onClick={handleBacktest} disabled={busyAction !== ''}>
              {busyAction === 'backtest' ? 'Running backtest...' : 'Run backtest'}
            </button>
          </div>
        </Card>

        <Card title="Model decision" subtitle={dashboard.analysis.narrative}>
          <div className="decision-grid">
            <MetricCard label="Recommended action" value={dashboard.analysis.modelDecision.action} />
            <MetricCard label="Confidence" value={formatPercent(dashboard.analysis.modelDecision.confidence)} />
            <MetricCard label="Signal score" value={dashboard.analysis.modelDecision.signal} />
            <MetricCard label="Current price" value={formatMoney(dashboard.market.currentPrice, selectedSymbol)} />
          </div>

          <div className="decision-detail">
            <div>
              <p className="eyebrow">Reasoning</p>
              <p>{dashboard.analysis.modelDecision.reason}</p>
            </div>
            <div>
              <p className="eyebrow">Indicator snapshot</p>
              <ul className="indicator-list">
                <li>Fast EMA: {formatMoney(dashboard.analysis.indicatorSnapshot.fastEma, selectedSymbol)}</li>
                <li>Slow EMA: {formatMoney(dashboard.analysis.indicatorSnapshot.slowEma, selectedSymbol)}</li>
                <li>EMA spread: {formatPercent(dashboard.analysis.indicatorSnapshot.emaSpreadPct)}</li>
                <li>RSI: {dashboard.analysis.indicatorSnapshot.rsi}</li>
                <li>Volatility: {formatPercent(dashboard.analysis.indicatorSnapshot.volatilityPct)}</li>
              </ul>
            </div>
          </div>

          {dashboard.analysis.position ? (
            <div className="position-card">
              <div>
                <span>Open position</span>
                <strong>{dashboard.analysis.position.side}</strong>
              </div>
              <div>
                <span>Entry</span>
                <strong>{formatMoney(dashboard.analysis.position.entryPrice, selectedSymbol)}</strong>
              </div>
              <div>
                <span>Stop / target</span>
                <strong>
                  {formatMoney(dashboard.analysis.position.stopLossPrice, selectedSymbol)} /{' '}
                  {formatMoney(dashboard.analysis.position.takeProfitPrice, selectedSymbol)}
                </strong>
              </div>
              <div>
                <span>Unrealized</span>
                <strong className={getMetricTone(dashboard.analysis.position.unrealizedPnl)}>
                  {formatMoney(dashboard.analysis.position.unrealizedPnl, selectedSymbol)}
                </strong>
              </div>
            </div>
          ) : (
            <div className="empty-inline">No open position. The agent is waiting for a stronger setup.</div>
          )}
        </Card>
      </section>

      <section className="metric-grid">
        <MetricCard label="Equity" value={formatMoney(performance.equity, selectedSymbol)} tone={getMetricTone(performance.realizedPnl + performance.unrealizedPnl)} />
        <MetricCard label="Realized P/L" value={formatMoney(performance.realizedPnl, selectedSymbol)} tone={getMetricTone(performance.realizedPnl)} />
        <MetricCard label="Unrealized P/L" value={formatMoney(performance.unrealizedPnl, selectedSymbol)} tone={getMetricTone(performance.unrealizedPnl)} />
        <MetricCard label="Total return" value={formatPercent(performance.totalReturnPct)} tone={getMetricTone(performance.totalReturnPct)} />
        <MetricCard label="Win rate" value={formatPercent(performance.winRatePct)} helper={`${performance.tradeCount} trades`} />
        <MetricCard label="Max drawdown" value={formatPercent(performance.maxDrawdownPct)} tone="negative" />
      </section>

      <section className="chart-grid">
        <Card title="Market & equity" subtitle={`${dashboard.market.symbolId} live feed`}>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263041" />
                <XAxis dataKey="time" minTickGap={28} stroke="#8fa3bf" />
                <YAxis yAxisId="price" stroke="#8fa3bf" />
                <YAxis yAxisId="equity" orientation="right" stroke="#8fa3bf" />
                <Tooltip />
                <Legend />
                <Line yAxisId="price" type="monotone" dataKey="price" stroke="#7c5cff" dot={false} strokeWidth={2} />
                <Line yAxisId="equity" type="monotone" dataKey="equity" stroke="#20c997" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Backtest curve" subtitle="Evaluate the selected model over a synthetic history.">
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={backtestChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#263041" />
                <XAxis dataKey="time" minTickGap={28} stroke="#8fa3bf" />
                <YAxis stroke="#8fa3bf" />
                <Tooltip />
                <Area type="monotone" dataKey="equity" stroke="#3dd9b3" fill="rgba(61, 217, 179, 0.18)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="metric-grid compact">
            <MetricCard
              label="Ending balance"
              value={formatMoney(backtest?.backtest?.endingBalance, selectedSymbol)}
              tone={getMetricTone(backtestPerformance?.realizedPnl ?? 0)}
            />
            <MetricCard
              label="Backtest return"
              value={formatPercent(backtestPerformance?.totalReturnPct)}
              tone={getMetricTone(backtestPerformance?.totalReturnPct ?? 0)}
            />
            <MetricCard label="Sharpe" value={backtestPerformance?.sharpe ?? '--'} />
            <MetricCard label="Profit factor" value={backtestPerformance?.profitFactor ?? '--'} />
          </div>
        </Card>
      </section>

      <section className="layout-grid">
        <Card title="Recent trades" subtitle="Executed paper trades and realized outcomes.">
          {dashboard.recentTrades.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Side</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>P/L</th>
                    <th>Return</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentTrades.map((trade) => (
                    <tr key={trade.id}>
                      <td>{trade.side}</td>
                      <td>{formatMoney(trade.entryPrice, selectedSymbol)}</td>
                      <td>{formatMoney(trade.exitPrice, selectedSymbol)}</td>
                      <td className={getMetricTone(trade.pnl)}>{formatMoney(trade.pnl, selectedSymbol)}</td>
                      <td className={getMetricTone(trade.returnPct)}>{formatPercent(trade.returnPct)}</td>
                      <td>{trade.exitReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-inline">No trades have been placed yet.</div>
          )}
        </Card>

        <Card title="Signal feed" subtitle="Latest model outputs and confidence changes.">
          <div className="signal-list">
            {dashboard.recentSignals.map((signal) => (
              <div key={`${signal.timestamp}-${signal.signal}`} className="signal-item">
                <div>
                  <strong>{signal.action}</strong>
                  <span>{formatTime(signal.timestamp)}</span>
                </div>
                <div>
                  <span>Confidence {formatPercent(signal.confidence)}</span>
                  <span>Signal {signal.signal}</span>
                </div>
                <p>{signal.reason}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </main>
  )
}

export default App
