import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  MARKET_SYMBOLS,
  MODEL_CATALOG,
  advancePortfolio,
  analyzeMarket,
  createInitialPortfolio,
  formatCurrency,
  formatPercent,
  generateInitialCandles,
  generateNextCandle,
  getPortfolioSnapshot,
  runBacktest,
} from './tradingEngine.js';

const numberInput = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function MetricCard({ label, value, helper, tone = 'neutral' }) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

function LineChart({ points, valueKey, label, accent = 'var(--accent)' }) {
  const values = points.map((point) => point[valueKey]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const width = 660;
  const height = 220;
  const coordinates = points
    .map((point, index) => {
      const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
      const y = height - ((point[valueKey] - min) / spread) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <div className="chart-card">
      <div className="chart-card__header">
        <span>{label}</span>
        <div>
          <small>Low {formatCurrency(min)}</small>
          <small>High {formatCurrency(max)}</small>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`gradient-${valueKey}`} x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.35" />
            <stop offset="100%" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={`0,${height} ${coordinates} ${width},${height}`}
          fill={`url(#gradient-${valueKey})`}
          stroke="none"
        />
        <polyline points={coordinates} fill="none" stroke={accent} strokeLinecap="round" strokeWidth="4" />
      </svg>
    </div>
  );
}

function ModelSelector({ selectedModels, onToggle }) {
  return (
    <div className="model-grid">
      {MODEL_CATALOG.map((model) => {
        const isSelected = selectedModels.includes(model.id);

        return (
          <button
            className={`model-card ${isSelected ? 'model-card--active' : ''}`}
            key={model.id}
            onClick={() => onToggle(model.id)}
            type="button"
          >
            <span>{model.style}</span>
            <strong>{model.name}</strong>
            <small>{model.description}</small>
          </button>
        );
      })}
    </div>
  );
}

function SettingsPanel({ settings, setSettings }) {
  const updateSetting = (key, value) => {
    setSettings((current) => ({
      ...current,
      [key]: numberInput(value, current[key]),
    }));
  };

  return (
    <div className="settings-grid">
      <label>
        Starting capital
        <input
          min="1000"
          onChange={(event) => updateSetting('initialCapital', event.target.value)}
          step="500"
          type="number"
          value={settings.initialCapital}
        />
      </label>
      <label>
        Allocation per trade (%)
        <input
          max="100"
          min="1"
          onChange={(event) => updateSetting('riskPerTrade', event.target.value)}
          step="1"
          type="number"
          value={settings.riskPerTrade}
        />
      </label>
      <label>
        Stop loss (%)
        <input
          max="30"
          min="0.5"
          onChange={(event) => updateSetting('stopLoss', event.target.value)}
          step="0.5"
          type="number"
          value={settings.stopLoss}
        />
      </label>
      <label>
        Take profit (%)
        <input
          max="60"
          min="1"
          onChange={(event) => updateSetting('takeProfit', event.target.value)}
          step="0.5"
          type="number"
          value={settings.takeProfit}
        />
      </label>
    </div>
  );
}

function TradeLog({ trades }) {
  if (trades.length === 0) {
    return <p className="empty-state">No trades yet. Start the paper trader to let the agent act on signals.</p>;
  }

  return (
    <div className="trade-list">
      {trades.slice(0, 8).map((trade) => (
        <div className="trade-row" key={trade.id}>
          <span className={`pill pill--${trade.side.toLowerCase()}`}>{trade.side}</span>
          <div>
            <strong>{trade.units.toFixed(5)} units</strong>
            <small>
              Step {trade.step} at {formatCurrency(trade.price)} | Fee {formatCurrency(trade.fee)}
            </small>
            <small>{trade.reason}</small>
          </div>
          <strong className={trade.pnl >= 0 ? 'positive' : 'negative'}>{formatCurrency(trade.pnl)}</strong>
        </div>
      ))}
    </div>
  );
}

function BacktestPanel({ symbol, selectedModels, settings }) {
  const [candles, setCandles] = useState(240);
  const [result, setResult] = useState(null);

  const runSimulation = () => {
    setResult(
      runBacktest({
        symbol,
        modelIds: selectedModels,
        candles,
        initialCapital: settings.initialCapital,
        riskPerTrade: settings.riskPerTrade,
        stopLoss: settings.stopLoss,
        takeProfit: settings.takeProfit,
      }),
    );
  };

  return (
    <section className="panel panel--wide">
      <div className="section-heading">
        <div>
          <span>Backtest</span>
          <h2>Replay the selected agent models</h2>
        </div>
        <div className="backtest-controls">
          <label>
            Candles
            <input
              max="720"
              min="90"
              onChange={(event) => setCandles(numberInput(event.target.value, 240))}
              step="30"
              type="number"
              value={candles}
            />
          </label>
          <button className="button button--primary" onClick={runSimulation} type="button">
            Run backtest
          </button>
        </div>
      </div>

      {result ? (
        <>
          <div className="metrics-grid metrics-grid--compact">
            <MetricCard
              label="Final equity"
              value={formatCurrency(result.finalEquity)}
              helper={`${formatPercent(result.totalReturn)} total return`}
              tone={result.totalReturn >= 0 ? 'positive' : 'negative'}
            />
            <MetricCard label="Win rate" value={formatPercent(result.winRate)} helper={`${result.wins} wins / ${result.losses} losses`} />
            <MetricCard label="Max drawdown" value={formatPercent(result.maxDrawdown)} helper="Peak-to-trough equity" tone="negative" />
            <MetricCard label="Trades" value={result.tradeCount} helper={`Realized ${formatCurrency(result.realizedPnl)}`} />
          </div>
          <LineChart
            accent="var(--purple)"
            label={`${result.symbol} backtest equity curve`}
            points={result.equityCurve}
            valueKey="equity"
          />
          <div className="backtest-summary">
            <p>
              Best trade:{' '}
              <strong>{result.bestTrade ? formatCurrency(result.bestTrade.pnl) : formatCurrency(0)}</strong>
            </p>
            <p>
              Worst trade:{' '}
              <strong>{result.worstTrade ? formatCurrency(result.worstTrade.pnl) : formatCurrency(0)}</strong>
            </p>
          </div>
        </>
      ) : (
        <p className="empty-state">Run a backtest to compare the selected models against a deterministic synthetic market path.</p>
      )}
    </section>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState(MARKET_SYMBOLS[0].symbol);
  const [selectedModels, setSelectedModels] = useState(MODEL_CATALOG.map((model) => model.id));
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState(() => generateInitialCandles(MARKET_SYMBOLS[0].symbol));
  const [portfolio, setPortfolio] = useState(() => createInitialPortfolio(DEFAULT_SETTINGS.initialCapital));
  const [isRunning, setIsRunning] = useState(false);
  const [lastDecision, setLastDecision] = useState(() => analyzeMarket(history, selectedModels));

  const decision = useMemo(() => analyzeMarket(history, selectedModels), [history, selectedModels]);
  const latestCandle = history.at(-1);
  const snapshot = useMemo(
    () => getPortfolioSnapshot(portfolio, latestCandle.close, settings.initialCapital),
    [latestCandle.close, portfolio, settings.initialCapital],
  );

  useEffect(() => {
    const nextHistory = generateInitialCandles(symbol);
    setHistory(nextHistory);
    setPortfolio(createInitialPortfolio(settings.initialCapital));
    setLastDecision(analyzeMarket(nextHistory, selectedModels));
    setIsRunning(false);
  }, [settings.initialCapital, symbol]);

  const toggleModel = (modelId) => {
    setSelectedModels((current) =>
      current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId],
    );
  };

  const runTradingTick = useCallback(() => {
    setHistory((currentHistory) => {
      const nextCandle = generateNextCandle(currentHistory, symbol);
      const nextHistory = [...currentHistory.slice(-180), nextCandle];
      const nextDecision = analyzeMarket(nextHistory, selectedModels);
      setLastDecision(nextDecision);
      setPortfolio((currentPortfolio) => advancePortfolio(currentPortfolio, nextCandle, nextDecision, settings));
      return nextHistory;
    });
  }, [selectedModels, settings, symbol]);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const intervalId = window.setInterval(runTradingTick, 1300);
    return () => window.clearInterval(intervalId);
  }, [isRunning, runTradingTick]);

  const resetSession = () => {
    const nextHistory = generateInitialCandles(symbol, 90, `reset:${Date.now()}`);
    setHistory(nextHistory);
    setPortfolio(createInitialPortfolio(settings.initialCapital));
    setLastDecision(analyzeMarket(nextHistory, selectedModels));
    setIsRunning(false);
  };

  const actionTone = lastDecision.action === 'BUY' ? 'positive' : lastDecision.action === 'SELL' ? 'negative' : 'neutral';

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Autonomous paper-trading workspace</p>
          <h1>Trading agent dashboard</h1>
          <p>
            Analyze simulated markets, select strategy models, run a paper-trading agent, and compare performance with
            built-in backtests.
          </p>
        </div>
        <div className="hero-card">
          <span className={`status-dot ${isRunning ? 'status-dot--live' : ''}`} />
          <div>
            <strong>{isRunning ? 'Agent running' : 'Agent paused'}</strong>
            <small>Paper trading only. Profit is not guaranteed.</small>
          </div>
        </div>
      </section>

      <section className="disclaimer">
        This app is an educational simulator and does not connect to a broker or exchange. Use real-market validation,
        compliance review, and risk controls before considering live trading.
      </section>

      <section className="control-bar">
        <label>
          Market
          <select onChange={(event) => setSymbol(event.target.value)} value={symbol}>
            {MARKET_SYMBOLS.map((market) => (
              <option key={market.symbol} value={market.symbol}>
                {market.symbol} - {market.name}
              </option>
            ))}
          </select>
        </label>
        <div className="button-group">
          <button className="button button--primary" onClick={() => setIsRunning((running) => !running)} type="button">
            {isRunning ? 'Pause trading' : 'Start trading'}
          </button>
          <button className="button" onClick={runTradingTick} type="button">
            Step once
          </button>
          <button className="button button--ghost" onClick={resetSession} type="button">
            Reset
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard
          helper={`${formatPercent(snapshot.totalReturn)} all-in return`}
          label="Portfolio equity"
          tone={snapshot.totalReturn >= 0 ? 'positive' : 'negative'}
          value={formatCurrency(snapshot.equity)}
        />
        <MetricCard label="Cash" value={formatCurrency(snapshot.cash)} helper="Available buying power" />
        <MetricCard
          helper={`Realized ${formatCurrency(snapshot.realizedPnl)}`}
          label="Open P/L"
          tone={snapshot.unrealizedPnl >= 0 ? 'positive' : 'negative'}
          value={formatCurrency(snapshot.unrealizedPnl)}
        />
        <MetricCard
          helper={`${snapshot.units.toFixed(5)} units at ${formatCurrency(snapshot.avgEntry)}`}
          label="Position value"
          value={formatCurrency(snapshot.positionValue)}
        />
      </section>

      <section className="dashboard-grid">
        <section className="panel panel--wide">
          <div className="section-heading">
            <div>
              <span>Market</span>
              <h2>{symbol} live paper feed</h2>
            </div>
            <strong className={latestCandle.close >= latestCandle.open ? 'positive' : 'negative'}>
              {formatCurrency(latestCandle.close)} ({formatPercent(decision.indicators.change)})
            </strong>
          </div>
          <LineChart label={`${symbol} price chart`} points={history} valueKey="close" />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span>Agent signal</span>
              <h2 className={`signal signal--${actionTone}`}>{lastDecision.action}</h2>
            </div>
            <strong>{formatPercent(lastDecision.confidence)} confidence</strong>
          </div>
          <p>{lastDecision.summary}</p>
          <div className="indicator-list">
            <span>RSI <strong>{lastDecision.indicators.rsi.toFixed(1)}</strong></span>
            <span>Trend <strong>{formatPercent(lastDecision.indicators.trendStrength)}</strong></span>
            <span>Volatility <strong>{lastDecision.indicators.volatility.toFixed(2)}</strong></span>
            <span>Volume <strong>{lastDecision.indicators.volumeRatio.toFixed(2)}x</strong></span>
          </div>
        </section>

        <section className="panel panel--wide">
          <div className="section-heading">
            <div>
              <span>Models</span>
              <h2>Select models used by the agent</h2>
            </div>
            <small>{selectedModels.length || 1} active</small>
          </div>
          <ModelSelector onToggle={toggleModel} selectedModels={selectedModels} />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span>Risk</span>
              <h2>Trading controls</h2>
            </div>
          </div>
          <SettingsPanel setSettings={setSettings} settings={settings} />
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span>Model analysis</span>
              <h2>Current votes</h2>
            </div>
          </div>
          <div className="vote-list">
            {lastDecision.modelOutputs.map((model) => (
              <div className="vote-row" key={model.id}>
                <span className={`pill pill--${model.action.toLowerCase()}`}>{model.action}</span>
                <div>
                  <strong>{model.name}</strong>
                  <small>{model.rationale}</small>
                </div>
                <strong>{formatPercent(model.score * 100)}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <span>Execution</span>
              <h2>Trade log</h2>
            </div>
            <small>Fees paid {formatCurrency(snapshot.feesPaid)}</small>
          </div>
          <TradeLog trades={portfolio.trades} />
        </section>

        <BacktestPanel selectedModels={selectedModels} settings={settings} symbol={symbol} />
      </section>
    </main>
  );
}
