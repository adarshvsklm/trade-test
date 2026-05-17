import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  createSession,
  fetchModels,
  getSession,
  runBacktest,
  sessionWebSocketUrl,
  startSession,
  stopSession,
} from './api'
import type { BacktestResponse, ModelInfo, SessionState } from './types'

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function EquityChart({ data, dataKey }: { data: { time: string; equity: number }[]; dataKey?: string }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        t: d.time.slice(0, 10),
      })),
    [data],
  )
  const key = dataKey ?? 'equity'
  if (chartData.length === 0) return <p className="muted">No equity points yet.</p>
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3142" />
          <XAxis dataKey="t" stroke="#8b93a5" fontSize={11} />
          <YAxis stroke="#8b93a5" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: '#1c2230', border: '1px solid #2a3142', borderRadius: 8 }}
            labelStyle={{ color: '#c8cdd8' }}
            formatter={(value) => fmtMoney(Number(value))}
          />
          <Legend />
          <Line type="monotone" dataKey={key} name="Equity" stroke="#3b82f6" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<'live' | 'backtest'>('live')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [symbol, setSymbol] = useState('AAPL')
  const [modelId, setModelId] = useState('')
  const [initialCash, setInitialCash] = useState(100_000)
  const [pollSeconds, setPollSeconds] = useState(30)

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [btStart, setBtStart] = useState('2022-01-01')
  const [btEnd, setBtEnd] = useState('2025-01-01')
  const [btResult, setBtResult] = useState<BacktestResponse | null>(null)
  const [btBusy, setBtBusy] = useState(false)

  useEffect(() => {
    fetchModels()
      .then((m) => {
        setModels(m)
        setModelId((id) => id || m[0]?.id || '')
        setLoadErr(null)
      })
      .catch((e: Error) => setLoadErr(e.message))
  }, [])

  const refreshSession = useCallback(async () => {
    if (!sessionId) return
    try {
      const s = await getSession(sessionId)
      setSession(s)
    } catch {
      /* ignore */
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    const ws = new WebSocket(sessionWebSocketUrl(sessionId))
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as { type?: string; state?: SessionState }
        if (msg.state) setSession(msg.state)
      } catch {
        /* ignore */
      }
    }
    ws.onerror = () => {
      /* dev: backend may be down */
    }
    return () => {
      ws.close()
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || session?.status !== 'running') return
    const t = window.setInterval(refreshSession, Math.max(pollSeconds, 15) * 1000)
    return () => window.clearInterval(t)
  }, [sessionId, session?.status, pollSeconds, refreshSession])

  const handleInitialize = async () => {
    setActionErr(null)
    setBusy(true)
    try {
      const s = await createSession({
        symbol: symbol.trim().toUpperCase(),
        model_id: modelId,
        initial_cash: initialCash,
        poll_seconds: pollSeconds,
      })
      setSessionId(s.session_id)
      setSession(s)
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleStartTrading = async () => {
    if (!sessionId) {
      setActionErr('Create a session first.')
      return
    }
    setActionErr(null)
    setBusy(true)
    try {
      const s = await startSession(sessionId)
      setSession(s)
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleStopTrading = async () => {
    if (!sessionId) return
    setActionErr(null)
    setBusy(true)
    try {
      const s = await stopSession(sessionId)
      setSession(s)
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleBacktest = async () => {
    setActionErr(null)
    setBtBusy(true)
    setBtResult(null)
    try {
      const res = await runBacktest({
        symbol: symbol.trim().toUpperCase(),
        model_id: modelId,
        start: btStart,
        end: btEnd,
        initial_cash: initialCash,
      })
      setBtResult(res)
      setTab('backtest')
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBtBusy(false)
    }
  }

  const pnlClass = (session?.total_pnl ?? 0) >= 0 ? 'profit' : 'loss'

  return (
    <>
      <header style={{ marginBottom: '1.25rem' }}>
        <h1>Trading agent desk</h1>
        <p className="muted" style={{ maxWidth: '52rem', textAlign: 'left' }}>
          Paper-trading simulator with selectable signal models, live session updates over WebSocket, and historical
          backtests. Data via Yahoo Finance. This is a technical demo, not financial advice; real markets involve
          slippage, liquidity, and risks this stack does not model.
        </p>
      </header>

      <div className="banner">
        Simulated trading only. Past backtest results do not guarantee future performance. No broker execution or real
        capital is connected.
      </div>

      {loadErr && (
        <div className="card" style={{ borderColor: '#7f1d1d', marginBottom: '1rem' }}>
          <strong>Could not load models:</strong> {loadErr}
        </div>
      )}
      {actionErr && (
        <div className="card" style={{ borderColor: '#7f1d1d', marginBottom: '1rem' }}>
          <strong>Error:</strong> {actionErr}
        </div>
      )}

      <div className="tabs">
        <button type="button" className={`tab ${tab === 'live' ? 'active' : ''}`} onClick={() => setTab('live')}>
          Live paper trading
        </button>
        <button type="button" className={`tab ${tab === 'backtest' ? 'active' : ''}`} onClick={() => setTab('backtest')}>
          Backtest
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h2 style={{ marginBottom: '0.75rem' }}>Instrument and model</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="sym">Symbol</label>
            <input id="sym" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g. MSFT" />
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label htmlFor="model">Model (strategy)</label>
            <select id="model" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cash">Starting cash</label>
            <input
              id="cash"
              type="number"
              min={1000}
              step={1000}
              value={initialCash}
              onChange={(e) => setInitialCash(Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label htmlFor="poll">Poll interval (s)</label>
            <input
              id="poll"
              type="number"
              min={10}
              max={300}
              value={pollSeconds}
              onChange={(e) => setPollSeconds(Number(e.target.value))}
            />
          </div>
        </div>
        {modelId && (
          <p className="muted" style={{ marginTop: '0.75rem', textAlign: 'left' }}>
            {models.find((m) => m.id === modelId)?.description}
          </p>
        )}
      </div>

      {tab === 'live' && (
        <>
          <div className="row" style={{ marginBottom: '1rem' }}>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={handleInitialize}>
              Create session
            </button>
            <button type="button" className="btn btn-primary" disabled={busy || !sessionId} onClick={handleStartTrading}>
              Start trading
            </button>
            <button type="button" className="btn btn-danger" disabled={busy || !sessionId} onClick={handleStopTrading}>
              Stop trading
            </button>
          </div>

          {session && (
            <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
              <div className="card">
                <h2>Session</h2>
                <p className="mono muted" style={{ wordBreak: 'break-all', marginTop: '0.35rem' }}>
                  {session.session_id}
                </p>
                <p style={{ marginTop: '0.5rem' }}>
                  Status: <strong>{session.status}</strong>
                </p>
                <p className="muted" style={{ marginTop: '0.35rem' }}>
                  Last update: {session.last_update ?? '—'}
                </p>
                {session.error && (
                  <p className="loss" style={{ marginTop: '0.5rem' }}>
                    {session.error}
                  </p>
                )}
              </div>
              <div className="card">
                <h2>Profit and loss</h2>
                <p style={{ fontSize: '1.35rem', marginTop: '0.35rem' }} className={pnlClass}>
                  {fmtMoney(session.total_pnl)} ({fmtPct(session.total_pnl_pct)})
                </p>
                <p className="muted" style={{ marginTop: '0.5rem' }}>
                  Realized {fmtMoney(session.realized_pnl)} · Unrealized {fmtMoney(session.unrealized_pnl)}
                </p>
              </div>
            </div>
          )}

          {session && (
            <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
              {[
                ['Equity', fmtMoney(session.equity)],
                ['Cash', fmtMoney(session.cash)],
                ['Market value', fmtMoney(session.market_value)],
                ['Last price', session.last_price != null ? fmtMoney(session.last_price) : '—'],
              ].map(([k, v]) => (
                <div key={k} className="card">
                  <div className="muted" style={{ fontSize: '0.75rem' }}>
                    {k}
                  </div>
                  <div style={{ fontSize: '1.1rem', marginTop: '0.25rem', color: 'var(--heading)' }}>{v}</div>
                </div>
              ))}
            </div>
          )}

          {session && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h2>Agent readout</h2>
              <p style={{ marginTop: '0.5rem', textAlign: 'left' }}>{session.last_signal || '—'}</p>
              <p className="muted" style={{ marginTop: '0.5rem', textAlign: 'left' }}>
                Shares held: <span className="mono">{session.shares.toFixed(6)}</span> · Poll every {session.poll_seconds}s
                · Uses the latest completed daily bar so orders fire at most once per trading day.
              </p>
            </div>
          )}

          {session && session.trades.length > 0 && (
            <div className="card">
              <h2>Recent trades</h2>
              <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Side</th>
                      <th>Price</th>
                      <th>Shares</th>
                      <th>Notional</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...session.trades].reverse().map((t, i) => (
                      <tr key={`${t.time}-${i}`}>
                        <td className="mono">{t.time}</td>
                        <td className={t.side === 'buy' ? 'profit' : 'loss'}>{t.side}</td>
                        <td>{fmtMoney(t.price)}</td>
                        <td className="mono">{t.shares.toFixed(4)}</td>
                        <td>{fmtMoney(t.notional)}</td>
                        <td>{t.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'backtest' && (
        <div className="grid" style={{ gap: '1rem' }}>
          <div className="card">
            <h2>Backtest range</h2>
            <div className="row" style={{ marginTop: '0.75rem' }}>
              <div className="field">
                <label htmlFor="bts">Start</label>
                <input id="bts" type="date" value={btStart} onChange={(e) => setBtStart(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="bte">End</label>
                <input id="bte" type="date" value={btEnd} onChange={(e) => setBtEnd(e.target.value)} />
              </div>
              <button type="button" className="btn btn-primary" disabled={btBusy} onClick={handleBacktest}>
                {btBusy ? 'Running…' : 'Run backtest'}
              </button>
            </div>
          </div>

          {btResult && (
            <>
              <div className="grid grid-4">
                <div className="card">
                  <div className="muted">Total return</div>
                  <div className={btResult.metrics.total_return_pct >= 0 ? 'profit' : 'loss'} style={{ fontSize: '1.2rem', marginTop: '0.25rem' }}>
                    {fmtPct(btResult.metrics.total_return_pct)}
                  </div>
                </div>
                <div className="card">
                  <div className="muted">Max drawdown</div>
                  <div className="loss" style={{ fontSize: '1.2rem', marginTop: '0.25rem' }}>
                    {fmtPct(btResult.metrics.max_drawdown_pct)}
                  </div>
                </div>
                <div className="card">
                  <div className="muted">Round-trip win rate</div>
                  <div style={{ fontSize: '1.2rem', marginTop: '0.25rem', color: 'var(--heading)' }}>
                    {btResult.metrics.win_rate_pct != null ? fmtPct(btResult.metrics.win_rate_pct) : '—'}
                  </div>
                </div>
                <div className="card">
                  <div className="muted">Sharpe (approx.)</div>
                  <div style={{ fontSize: '1.2rem', marginTop: '0.25rem', color: 'var(--heading)' }}>
                    {btResult.metrics.sharpe_approx != null ? btResult.metrics.sharpe_approx.toFixed(2) : '—'}
                  </div>
                </div>
              </div>
              <div className="card">
                <h2>
                  Equity curve — {btResult.symbol} / {btResult.model_id}
                </h2>
                <EquityChart data={btResult.equity_curve} />
              </div>
              <div className="card">
                <h2>Backtest trades ({btResult.metrics.trades})</h2>
                <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Side</th>
                        <th>Price</th>
                        <th>Shares</th>
                        <th>Notional</th>
                      </tr>
                    </thead>
                    <tbody>
                      {btResult.trades.map((t, i) => (
                        <tr key={`${t.time}-${i}`}>
                          <td className="mono">{t.time}</td>
                          <td className={t.side === 'buy' ? 'profit' : 'loss'}>{t.side}</td>
                          <td>{fmtMoney(t.price)}</td>
                          <td className="mono">{t.shares.toFixed(4)}</td>
                          <td>{fmtMoney(t.notional)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
