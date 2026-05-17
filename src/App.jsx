import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AVAILABLE_ASSETS, generateMarketSeries } from './data/mockMarket';
import {
  MODEL_LIBRARY,
  RISK_PROFILES,
  STARTING_CAPITAL,
  advanceSimulation,
  createSimulationState,
  runBacktest,
} from './utils/tradingEngine';

const DEFAULT_SYMBOL = AVAILABLE_ASSETS[0].symbol;
const DEFAULT_MODELS = MODEL_LIBRARY.map((model) => model.id);
const CHART_COLORS = ['#7c3aed', '#16a34a', '#f97316', '#ef4444'];

function formatCurrency(value, symbol = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: symbol,
    maximumFractionDigits: value >= 100 ? 0 : 4,
  }).format(value);
}

function formatPercent(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatQuantity(value) {
  return value.toLocaleString('en-US', {
    maximumFractionDigits: 4,
  });
}

function metricClass(value) {
  if (value > 0) {
    return 'metric-positive';
  }

  if (value < 0) {
    return 'metric-negative';
  }

  return 'metric-neutral';
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <div className="tooltip-label">{label}</div>
      {payload.map((item) => (
        <div key={item.name} className="tooltip-row">
          <span>{item.name}</span>
          <strong>{formatCurrency(item.value)}</strong>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
  const [riskProfile, setRiskProfile] = useState('balanced');
  const [selectedModels, setSelectedModels] = useState(DEFAULT_MODELS);
  const [marketSeries, setMarketSeries] = useState(() => generateMarketSeries(DEFAULT_SYMBOL));
  const [session, setSession] = useState(() =>
    createSimulationState(generateMarketSeries(DEFAULT_SYMBOL), DEFAULT_MODELS),
  );
  const [isTrading, setIsTrading] = useState(false);
  const [backtestResult, setBacktestResult] = useState(null);

  useEffect(() => {
    const nextSeries = generateMarketSeries(symbol);
    setMarketSeries(nextSeries);
    setSession(createSimulationState(nextSeries, selectedModels));
    setBacktestResult(null);
    setIsTrading(false);
  }, [symbol]);

  useEffect(() => {
    if (!isTrading) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setSession((currentSession) => advanceSimulation(currentSession, selectedModels, riskProfile));
    }, 1200);

    return () => window.clearInterval(timer);
  }, [isTrading, riskProfile, selectedModels]);

  useEffect(() => {
    if (session.isComplete) {
      setIsTrading(false);
    }
  }, [session.isComplete]);

  const selectedAsset = AVAILABLE_ASSETS.find((asset) => asset.symbol === symbol) ?? AVAILABLE_ASSETS[0];
  const selectedRisk = RISK_PROFILES[riskProfile];
  const liveChartData = useMemo(
    () =>
      marketSeries
        .slice(Math.max(0, session.index - 60), session.index + 1)
        .map((candle) => ({
          label: candle.label,
          Price: candle.close,
          Volume: candle.volume,
        })),
    [marketSeries, session.index],
  );

  const equityChartData = useMemo(
    () =>
      session.equityCurve.map((point) => ({
        label: point.label,
        Equity: point.equity,
      })),
    [session.equityCurve],
  );

  const allocationData = useMemo(
    () => [
      { name: 'Cash', value: session.cash },
      { name: 'Position', value: session.positionValue },
    ],
    [session.cash, session.positionValue],
  );

  const topAnalysis = useMemo(() => {
    return [...session.lastAnalysis.analyses].sort((left, right) => right.confidence - left.confidence)[0];
  }, [session.lastAnalysis.analyses]);

  const strategyNarrative = `${session.lastAnalysis.headline}. ${
    session.lastAnalysis.ensemble.summary
  } Highest conviction comes from ${topAnalysis.modelName} with a ${topAnalysis.signal.toUpperCase()} bias at ${
    topAnalysis.confidence
  }% confidence.`;

  function resetSimulation() {
    setIsTrading(false);
    setBacktestResult(null);
    setSession(createSimulationState(marketSeries, selectedModels));
  }

  function stepSimulation() {
    setSession((currentSession) => advanceSimulation(currentSession, selectedModels, riskProfile));
  }

  function toggleModel(modelId) {
    setSelectedModels((currentModels) => {
      if (currentModels.includes(modelId)) {
        if (currentModels.length === 1) {
          return currentModels;
        }

        return currentModels.filter((item) => item !== modelId);
      }

      return [...currentModels, modelId];
    });
  }

  function handleBacktest() {
    setBacktestResult(runBacktest(marketSeries, selectedModels, riskProfile));
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <span className="eyebrow">Paper trading workspace</span>
          <h1>AlphaPulse Trader</h1>
          <p className="hero-copy">
            A simulated trading agent that analyzes synthetic market structure, executes paper trades,
            tracks performance, and lets users compare model combinations before taking any real risk.
          </p>
        </div>
        <div className="hero-badge">
          <span>Simulation only</span>
          <strong>No broker keys required</strong>
        </div>
      </header>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Strategy controls</h2>
              <p>Choose the market, the model blend, and whether the agent should trade automatically.</p>
            </div>
          </div>

          <div className="controls-grid">
            <label className="field">
              <span>Market</span>
              <select value={symbol} onChange={(event) => setSymbol(event.target.value)}>
                {AVAILABLE_ASSETS.map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Risk profile</span>
              <select value={riskProfile} onChange={(event) => setRiskProfile(event.target.value)}>
                {Object.entries(RISK_PROFILES).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="model-selector">
            <div className="section-title">
              <h3>Model stack</h3>
              <p>Enable one or more models to create the ensemble vote.</p>
            </div>

            <div className="model-grid">
              {MODEL_LIBRARY.map((model) => {
                const isSelected = selectedModels.includes(model.id);
                return (
                  <button
                    key={model.id}
                    type="button"
                    className={`model-card ${isSelected ? 'model-card-active' : ''}`}
                    onClick={() => toggleModel(model.id)}
                  >
                    <div className="model-card-head">
                      <strong>{model.name}</strong>
                      <span>{isSelected ? 'Active' : 'Inactive'}</span>
                    </div>
                    <p>{model.shortDescription}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="control-actions">
            <button type="button" className="primary-button" onClick={() => setIsTrading((value) => !value)}>
              {isTrading ? 'Pause trading' : 'Start trading'}
            </button>
            <button type="button" className="secondary-button" onClick={stepSimulation}>
              Advance one candle
            </button>
            <button type="button" className="secondary-button" onClick={resetSimulation}>
              Reset session
            </button>
            <button type="button" className="secondary-button" onClick={handleBacktest}>
              Run backtest
            </button>
          </div>

          <div className="risk-notes">
            <div>
              <span>Starting capital</span>
              <strong>{formatCurrency(STARTING_CAPITAL)}</strong>
            </div>
            <div>
              <span>Selected asset</span>
              <strong>{selectedAsset.label}</strong>
            </div>
            <div>
              <span>Execution mode</span>
              <strong>{selectedRisk.label}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Live agent summary</h2>
              <p>The engine recalculates model signals every candle and updates the paper portfolio.</p>
            </div>
            <span className={`signal-pill signal-${session.lastAnalysis.ensemble.signal}`}>
              {session.lastAnalysis.ensemble.signal.toUpperCase()}
            </span>
          </div>

          <div className="metrics-grid">
            <article className="metric-card">
              <span>Current price</span>
              <strong>{formatCurrency(session.currentPrice)}</strong>
              <small>{selectedAsset.label}</small>
            </article>
            <article className="metric-card">
              <span>Total equity</span>
              <strong>{formatCurrency(session.totalEquity)}</strong>
              <small className={metricClass(session.totalReturnPct)}>{formatPercent(session.totalReturnPct)}</small>
            </article>
            <article className="metric-card">
              <span>Realized P/L</span>
              <strong className={metricClass(session.realizedPnl)}>{formatCurrency(session.realizedPnl)}</strong>
              <small>{session.closedTrades} exits closed</small>
            </article>
            <article className="metric-card">
              <span>Unrealized P/L</span>
              <strong className={metricClass(session.unrealizedPnl)}>{formatCurrency(session.unrealizedPnl)}</strong>
              <small>{session.positionSize > 0 ? 'Open risk active' : 'No open position'}</small>
            </article>
            <article className="metric-card">
              <span>Win rate</span>
              <strong>{session.winRate.toFixed(1)}%</strong>
              <small>{session.wins} wins / {session.losses} losses</small>
            </article>
            <article className="metric-card">
              <span>Max drawdown</span>
              <strong>{session.maxDrawdown.toFixed(2)}%</strong>
              <small>{session.tradeLog.length} total fills</small>
            </article>
          </div>

          <div className="insight-banner">
            <strong>AI insight</strong>
            <p>{strategyNarrative}</p>
          </div>
        </div>
      </section>

      <section className="grid-two">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Market price</h2>
              <p>Current rolling market view for the paper trading session.</p>
            </div>
          </div>

          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={liveChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="label" minTickGap={24} stroke="#94a3b8" />
                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(value) => formatCurrency(value)}
                  width={90}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Price"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Equity curve</h2>
              <p>Tracks the portfolio value as the agent enters and exits trades.</p>
            </div>
          </div>

          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={equityChartData}>
                <defs>
                  <linearGradient id="equityGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                <XAxis dataKey="label" minTickGap={24} stroke="#94a3b8" />
                <YAxis
                  stroke="#94a3b8"
                  tickFormatter={(value) => formatCurrency(value)}
                  width={90}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="Equity"
                  stroke="#16a34a"
                  fill="url(#equityGradient)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="grid-three">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Model votes</h2>
              <p>Each model emits its own signal, confidence, and rationale.</p>
            </div>
          </div>

          <div className="analysis-stack">
            {session.lastAnalysis.analyses.map((analysis) => (
              <article key={analysis.modelId} className="analysis-card">
                <div className="analysis-header">
                  <strong>{analysis.modelName}</strong>
                  <span className={`signal-pill signal-${analysis.signal}`}>{analysis.signal.toUpperCase()}</span>
                </div>
                <p>{analysis.rationale}</p>
                <div className="analysis-meta">
                  <span>Confidence</span>
                  <strong>{analysis.confidence}%</strong>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Allocation</h2>
              <p>Portfolio split between cash and the open position.</p>
            </div>
          </div>

          <div className="allocation-layout">
            <div className="chart-frame small-chart">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={84}
                    paddingAngle={2}
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="position-card">
              <div>
                <span>Cash balance</span>
                <strong>{formatCurrency(session.cash)}</strong>
              </div>
              <div>
                <span>Position size</span>
                <strong>{formatQuantity(session.positionSize)}</strong>
              </div>
              <div>
                <span>Average entry</span>
                <strong>{session.avgEntry > 0 ? formatCurrency(session.avgEntry) : 'No entry yet'}</strong>
              </div>
              <div>
                <span>Position value</span>
                <strong>{formatCurrency(session.positionValue)}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Trade blotter</h2>
              <p>Most recent paper fills and resulting trade notes.</p>
            </div>
          </div>

          <div className="trade-list">
            {session.tradeLog.length === 0 ? (
              <div className="empty-state">No trades yet. Start the engine or step forward to generate fills.</div>
            ) : (
              session.tradeLog.slice(0, 8).map((trade) => (
                <article key={trade.id} className="trade-row">
                  <div>
                    <strong>{trade.type}</strong>
                    <span>{new Date(trade.timestamp).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span>{formatQuantity(trade.quantity)} units</span>
                    <strong>{formatCurrency(trade.notional)}</strong>
                  </div>
                  <div>
                    <span>{trade.confidence}% confidence</span>
                    <strong className={metricClass(trade.realizedPnl ?? 0)}>
                      {trade.realizedPnl == null ? 'Open' : formatCurrency(trade.realizedPnl)}
                    </strong>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Backtest console</h2>
            <p>Replay the whole synthetic dataset to inspect aggregate performance before live simulation.</p>
          </div>
        </div>

        {backtestResult ? (
          <div className="backtest-grid">
            <div className="backtest-metrics">
              <article className="metric-card">
                <span>Ending equity</span>
                <strong>{formatCurrency(backtestResult.summary.endingEquity)}</strong>
                <small className={metricClass(backtestResult.summary.totalReturnPct)}>
                  {formatPercent(backtestResult.summary.totalReturnPct)}
                </small>
              </article>
              <article className="metric-card">
                <span>Profit factor</span>
                <strong>{backtestResult.summary.profitFactor.toFixed(2)}</strong>
                <small>Gross profits / gross losses</small>
              </article>
              <article className="metric-card">
                <span>Sharpe ratio</span>
                <strong>{backtestResult.summary.sharpeRatio.toFixed(2)}</strong>
                <small>Return efficiency estimate</small>
              </article>
              <article className="metric-card">
                <span>Backtest trades</span>
                <strong>{backtestResult.summary.totalTrades}</strong>
                <small>{backtestResult.summary.winRate.toFixed(1)}% win rate</small>
              </article>
            </div>

            <div className="chart-frame">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={backtestResult.equityCurve.map((point) => ({
                    label: point.label,
                    Equity: point.equity,
                  }))}
                >
                  <defs>
                    <linearGradient id="backtestGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.18)" />
                  <XAxis dataKey="label" minTickGap={24} stroke="#94a3b8" />
                  <YAxis
                    stroke="#94a3b8"
                    tickFormatter={(value) => formatCurrency(value)}
                    width={90}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Equity"
                    stroke="#0ea5e9"
                    fill="url(#backtestGradient)"
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            No backtest has been run yet. Use the <strong>Run backtest</strong> action to calculate a full
            historical simulation for the current asset and model stack.
          </div>
        )}
      </section>
    </div>
  );
}
