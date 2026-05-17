import { useEffect, useMemo, useState } from 'react';

const MODELS = [
  {
    id: 'momentum-ai',
    name: 'Momentum AI',
    type: 'Trend following',
    confidence: 78,
    risk: 'Medium',
    description: 'Looks for price strength, moving-average breakouts, and accelerating volume.',
    bias: 0.18,
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion Scout',
    type: 'Reversion',
    confidence: 72,
    risk: 'Low',
    description: 'Fades stretched moves when RSI and volatility suggest exhaustion.',
    bias: -0.1,
  },
  {
    id: 'sentiment-guard',
    name: 'Sentiment Guard',
    type: 'Risk filter',
    confidence: 84,
    risk: 'Low',
    description: 'Reduces exposure when volatility, drawdown, or low conviction appears.',
    bias: 0.04,
  },
  {
    id: 'breakout-hunter',
    name: 'Breakout Hunter',
    type: 'Volatility expansion',
    confidence: 69,
    risk: 'High',
    description: 'Targets high-beta breakouts with tighter exits and larger upside targets.',
    bias: 0.26,
  },
];

const SYMBOLS = [
  { symbol: 'BTC-USD', name: 'Bitcoin', basePrice: 67400, volatility: 0.024 },
  { symbol: 'ETH-USD', name: 'Ethereum', basePrice: 3520, volatility: 0.031 },
  { symbol: 'AAPL', name: 'Apple', basePrice: 196, volatility: 0.012 },
  { symbol: 'TSLA', name: 'Tesla', basePrice: 183, volatility: 0.026 },
  { symbol: 'NVDA', name: 'Nvidia', basePrice: 948, volatility: 0.022 },
];

const RISK_PROFILES = {
  conservative: {
    label: 'Conservative',
    tradeFraction: 0.18,
    threshold: 0.42,
    stopLoss: 0.018,
    takeProfit: 0.035,
  },
  balanced: {
    label: 'Balanced',
    tradeFraction: 0.3,
    threshold: 0.3,
    stopLoss: 0.028,
    takeProfit: 0.055,
  },
  aggressive: {
    label: 'Aggressive',
    tradeFraction: 0.45,
    threshold: 0.2,
    stopLoss: 0.045,
    takeProfit: 0.085,
  },
};

const INITIAL_CAPITAL = 10000;

function mulberry32(seed) {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function symbolSeed(symbol) {
  return symbol.split('').reduce((total, char) => total + char.charCodeAt(0), 17);
}

function formatCurrency(value, maximumFractionDigits = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
  }).format(value);
}

function formatPercent(value) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getSelectedModels(selectedModelIds) {
  return MODELS.filter((model) => selectedModelIds.includes(model.id));
}

function generateMarketSeries(symbolConfig, length = 180, seedOffset = 0) {
  const random = mulberry32(symbolSeed(symbolConfig.symbol) + seedOffset);
  const series = [];
  let price = symbolConfig.basePrice;
  let volume = 1200000 + random() * 900000;

  for (let index = 0; index < length; index += 1) {
    const cycle = Math.sin(index / 11) * symbolConfig.volatility * 0.55;
    const shock = (random() - 0.48) * symbolConfig.volatility;
    const drift = 0.0007 + cycle + shock;
    price = Math.max(price * (1 + drift), symbolConfig.basePrice * 0.35);
    volume = Math.max(volume * (1 + (random() - 0.5) * 0.18), 100000);

    series.push({
      time: index,
      price,
      volume,
    });
  }

  return series;
}

function getIndicators(series) {
  const recent = series.slice(-24);
  const fast = average(series.slice(-8).map((point) => point.price));
  const slow = average(series.slice(-32).map((point) => point.price));
  const latest = series[series.length - 1]?.price ?? 0;
  const previous = series[series.length - 2]?.price ?? latest;
  const momentum = slow ? (fast - slow) / slow : 0;
  const dayChange = previous ? (latest - previous) / previous : 0;
  const mean = average(recent.map((point) => point.price));
  const variance = average(recent.map((point) => (point.price - mean) ** 2));
  const volatility = mean ? Math.sqrt(variance) / mean : 0;
  const gains = [];
  const losses = [];

  recent.slice(1).forEach((point, index) => {
    const change = point.price - recent[index].price;
    if (change >= 0) {
      gains.push(change);
    } else {
      losses.push(Math.abs(change));
    }
  });

  const avgGain = average(gains);
  const avgLoss = average(losses) || 1;
  const rsi = 100 - 100 / (1 + avgGain / avgLoss);
  const volumeTrend =
    average(series.slice(-8).map((point) => point.volume)) /
    Math.max(average(series.slice(-32).map((point) => point.volume)), 1);

  return {
    dayChange,
    fast,
    latest,
    momentum,
    rsi,
    slow,
    volatility,
    volumeTrend,
  };
}

function analyzeMarket(series, selectedModelIds, riskProfileKey) {
  const selectedModels = getSelectedModels(selectedModelIds);
  const indicators = getIndicators(series);
  const riskProfile = RISK_PROFILES[riskProfileKey];
  const modelBias = average(selectedModels.map((model) => model.bias));
  const trendSignal = clamp(indicators.momentum * 28, -1, 1);
  const rsiSignal = clamp((50 - indicators.rsi) / 42, -1, 1);
  const volumeSignal = clamp((indicators.volumeTrend - 1) * 2.8, -0.35, 0.35);
  const volatilityPenalty = indicators.volatility > 0.038 ? -0.22 : 0;
  const score = clamp(
    trendSignal * 0.46 + rsiSignal * 0.22 + volumeSignal + modelBias + volatilityPenalty,
    -1,
    1,
  );
  const conviction = clamp(Math.abs(score) * 100 + average(selectedModels.map((m) => m.confidence)) * 0.22, 0, 99);
  let action = 'Hold';

  if (score > riskProfile.threshold) {
    action = 'Buy';
  } else if (score < -riskProfile.threshold) {
    action = 'Sell';
  }

  return {
    action,
    conviction,
    indicators,
    rationale: buildRationale(action, indicators, selectedModels, riskProfile),
    score,
  };
}

function buildRationale(action, indicators, selectedModels, riskProfile) {
  const modelNames = selectedModels.map((model) => model.name).join(', ');
  const trend = indicators.momentum >= 0 ? 'positive trend pressure' : 'negative trend pressure';
  const volume =
    indicators.volumeTrend >= 1 ? 'volume is confirming the move' : 'volume confirmation is weak';
  const risk = `${riskProfile.label.toLowerCase()} risk profile requires ${Math.round(
    riskProfile.threshold * 100,
  )}% signal strength`;

  if (action === 'Buy') {
    return `${modelNames} see ${trend}; ${volume}; ${risk}.`;
  }

  if (action === 'Sell') {
    return `${modelNames} detect downside or overextension; ${volume}; ${risk}.`;
  }

  return `${modelNames} do not have enough edge yet; ${trend}; ${risk}.`;
}

function runBacktest({ symbolConfig, selectedModelIds, riskProfileKey, capital }) {
  const series = generateMarketSeries(symbolConfig, 240, 4096);
  const riskProfile = RISK_PROFILES[riskProfileKey];
  let cash = capital;
  let units = 0;
  let entryPrice = 0;
  let wins = 0;
  let closedTrades = 0;
  let peakEquity = capital;
  let maxDrawdown = 0;
  const trades = [];
  const equityCurve = [];

  series.forEach((point, index) => {
    if (index < 36) {
      equityCurve.push(capital);
      return;
    }

    const slice = series.slice(0, index + 1);
    const analysis = analyzeMarket(slice, selectedModelIds, riskProfileKey);
    const equity = cash + units * point.price;
    const positionReturn = entryPrice ? (point.price - entryPrice) / entryPrice : 0;
    const shouldExit =
      units > 0 &&
      (analysis.action === 'Sell' ||
        positionReturn <= -riskProfile.stopLoss ||
        positionReturn >= riskProfile.takeProfit);

    if (shouldExit) {
      cash += units * point.price;
      closedTrades += 1;
      if (point.price > entryPrice) wins += 1;
      trades.push({
        action: 'Sell',
        price: point.price,
        returnPct: positionReturn * 100,
        time: index,
      });
      units = 0;
      entryPrice = 0;
    }

    if (analysis.action === 'Buy' && units === 0) {
      const allocation = cash * riskProfile.tradeFraction;
      units = allocation / point.price;
      cash -= allocation;
      entryPrice = point.price;
      trades.push({
        action: 'Buy',
        price: point.price,
        returnPct: 0,
        time: index,
      });
    }

    const nextEquity = cash + units * point.price;
    peakEquity = Math.max(peakEquity, nextEquity);
    maxDrawdown = Math.max(maxDrawdown, peakEquity ? (peakEquity - nextEquity) / peakEquity : 0);
    equityCurve.push(nextEquity);
  });

  const finalPrice = series[series.length - 1].price;
  const finalEquity = cash + units * finalPrice;
  const profitLoss = finalEquity - capital;

  return {
    equityCurve,
    finalEquity,
    maxDrawdown: maxDrawdown * 100,
    profitLoss,
    profitLossPct: (profitLoss / capital) * 100,
    trades,
    winRate: closedTrades ? (wins / closedTrades) * 100 : 0,
  };
}

function Sparkline({ values, color = '#66e3ff' }) {
  const width = 340;
  const height = 92;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Performance chart">
      <polyline fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" points={points} />
    </svg>
  );
}

function MetricCard({ label, value, detail, tone = 'neutral' }) {
  return (
    <article className={`metric-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export default function App() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC-USD');
  const [selectedModelIds, setSelectedModelIds] = useState(['momentum-ai', 'sentiment-guard']);
  const [riskProfileKey, setRiskProfileKey] = useState('balanced');
  const [capital, setCapital] = useState(INITIAL_CAPITAL);
  const [series, setSeries] = useState(() => generateMarketSeries(SYMBOLS[0], 90, 100));
  const [account, setAccount] = useState({ cash: INITIAL_CAPITAL, units: 0, realizedPnl: 0, entryPrice: 0 });
  const [isTrading, setIsTrading] = useState(false);
  const [tradeLog, setTradeLog] = useState([
    {
      message: 'Agent ready in paper trading mode. Select models and start when ready.',
      time: new Date().toLocaleTimeString(),
      type: 'info',
    },
  ]);
  const [backtestResult, setBacktestResult] = useState(null);

  const symbolConfig = useMemo(
    () => SYMBOLS.find((item) => item.symbol === selectedSymbol) ?? SYMBOLS[0],
    [selectedSymbol],
  );
  const analysis = useMemo(
    () => analyzeMarket(series, selectedModelIds, riskProfileKey),
    [riskProfileKey, selectedModelIds, series],
  );
  const lastPrice = series[series.length - 1]?.price ?? symbolConfig.basePrice;
  const positionValue = account.units * lastPrice;
  const accountEquity = account.cash + positionValue;
  const openPnl = account.entryPrice ? (lastPrice - account.entryPrice) * account.units : 0;
  const totalPnl = accountEquity - capital;
  const selectedModels = getSelectedModels(selectedModelIds);

  useEffect(() => {
    const newSeries = generateMarketSeries(symbolConfig, 90, 100);
    setSeries(newSeries);
    setIsTrading(false);
    setAccount({ cash: capital, units: 0, realizedPnl: 0, entryPrice: 0 });
    setBacktestResult(null);
    setTradeLog((current) => [
      {
        message: `Loaded ${symbolConfig.name} market data and reset paper account.`,
        time: new Date().toLocaleTimeString(),
        type: 'info',
      },
      ...current.slice(0, 5),
    ]);
  }, [capital, symbolConfig]);

  useEffect(() => {
    if (!isTrading) return undefined;

    const interval = window.setInterval(() => {
      setSeries((currentSeries) => {
        const random = Math.random();
        const previous = currentSeries[currentSeries.length - 1];
        const drift = (random - 0.47) * symbolConfig.volatility + analysis.score * 0.0018;
        const price = Math.max(previous.price * (1 + drift), symbolConfig.basePrice * 0.35);
        const volume = Math.max(previous.volume * (1 + (Math.random() - 0.5) * 0.14), 100000);
        return [...currentSeries.slice(-119), { time: previous.time + 1, price, volume }];
      });
    }, 1400);

    return () => window.clearInterval(interval);
  }, [analysis.score, isTrading, symbolConfig]);

  useEffect(() => {
    if (!isTrading) return;

    const riskProfile = RISK_PROFILES[riskProfileKey];
    const latestEquity = account.cash + account.units * lastPrice;
    const positionReturn = account.entryPrice ? (lastPrice - account.entryPrice) / account.entryPrice : 0;
    const shouldSell =
      account.units > 0 &&
      (analysis.action === 'Sell' ||
        positionReturn <= -riskProfile.stopLoss ||
        positionReturn >= riskProfile.takeProfit);

    if (shouldSell) {
      const saleValue = account.units * lastPrice;
      const realizedPnl = account.realizedPnl + (lastPrice - account.entryPrice) * account.units;
      setAccount({
        cash: account.cash + saleValue,
        entryPrice: 0,
        realizedPnl,
        units: 0,
      });
      appendTradeLog(
        `Closed ${selectedSymbol} at ${formatCurrency(lastPrice)} (${formatPercent(positionReturn * 100)}).`,
        positionReturn >= 0 ? 'success' : 'danger',
      );
      return;
    }

    if (analysis.action === 'Buy' && account.units === 0) {
      const allocation = latestEquity * riskProfile.tradeFraction;
      const units = allocation / lastPrice;
      setAccount({
        ...account,
        cash: account.cash - allocation,
        entryPrice: lastPrice,
        units,
      });
      appendTradeLog(
        `Opened ${selectedSymbol} paper position at ${formatCurrency(lastPrice)} with ${Math.round(
          analysis.conviction,
        )}% conviction.`,
        'success',
      );
    }
  }, [account, analysis.action, analysis.conviction, isTrading, lastPrice, riskProfileKey, selectedSymbol]);

  function appendTradeLog(message, type = 'info') {
    setTradeLog((current) => [
      {
        message,
        time: new Date().toLocaleTimeString(),
        type,
      },
      ...current.slice(0, 8),
    ]);
  }

  function toggleModel(modelId) {
    setSelectedModelIds((current) => {
      if (current.includes(modelId)) {
        return current.length === 1 ? current : current.filter((id) => id !== modelId);
      }

      return [...current, modelId];
    });
  }

  function handleStartStop() {
    setIsTrading((current) => {
      const next = !current;
      appendTradeLog(next ? 'Paper trading started.' : 'Paper trading paused.', next ? 'success' : 'info');
      return next;
    });
  }

  function handleBacktest() {
    const result = runBacktest({
      capital,
      riskProfileKey,
      selectedModelIds,
      symbolConfig,
    });
    setBacktestResult(result);
    appendTradeLog(
      `Backtest complete: ${formatCurrency(result.profitLoss)} (${formatPercent(result.profitLossPct)}).`,
      result.profitLoss >= 0 ? 'success' : 'danger',
    );
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Autonomous paper trading workspace</p>
          <h1>Trading Agent Control Center</h1>
          <p className="hero-copy">
            Analyze markets, select AI-style trading models, run a paper trading agent, and backtest strategy behavior
            before connecting real capital.
          </p>
        </div>
        <div className="agent-status">
          <span className={isTrading ? 'pulse active' : 'pulse'} />
          <div>
            <strong>{isTrading ? 'Agent trading' : 'Agent paused'}</strong>
            <small>{analysis.action} signal · {Math.round(analysis.conviction)}% conviction</small>
          </div>
        </div>
      </section>

      <section className="risk-banner">
        <strong>Paper trading mode:</strong> this app simulates analysis, orders, and P/L for product validation. Real
        trading requires broker integration, exchange permissions, audited risk controls, and no system can guarantee
        profit.
      </section>

      <section className="dashboard-grid">
        <aside className="panel controls-panel">
          <div className="panel-heading">
            <p className="eyebrow">Setup</p>
            <h2>Trading controls</h2>
          </div>

          <label className="field">
            Market
            <select value={selectedSymbol} onChange={(event) => setSelectedSymbol(event.target.value)}>
              {SYMBOLS.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} · {item.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            Starting capital
            <input
              min="1000"
              step="500"
              type="number"
              value={capital}
              onChange={(event) => setCapital(Number(event.target.value) || INITIAL_CAPITAL)}
            />
          </label>

          <label className="field">
            Risk profile
            <select value={riskProfileKey} onChange={(event) => setRiskProfileKey(event.target.value)}>
              {Object.entries(RISK_PROFILES).map(([key, profile]) => (
                <option key={key} value={key}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>

          <div className="button-row">
            <button className={isTrading ? 'secondary-button' : 'primary-button'} onClick={handleStartStop}>
              {isTrading ? 'Pause trading' : 'Start trading'}
            </button>
            <button className="ghost-button" onClick={handleBacktest}>
              Run backtest
            </button>
          </div>
        </aside>

        <section className="panel market-panel">
          <div className="panel-heading inline">
            <div>
              <p className="eyebrow">Live market</p>
              <h2>{selectedSymbol}</h2>
            </div>
            <strong className={analysis.indicators.dayChange >= 0 ? 'price positive' : 'price negative'}>
              {formatCurrency(lastPrice, selectedSymbol.includes('USD') ? 0 : 2)}
            </strong>
          </div>
          <Sparkline values={series.slice(-60).map((point) => point.price)} />
          <div className="signal-card">
            <span className={`signal-pill ${analysis.action.toLowerCase()}`}>{analysis.action}</span>
            <div>
              <strong>{Math.round(analysis.conviction)}% conviction</strong>
              <p>{analysis.rationale}</p>
            </div>
          </div>
          <div className="mini-grid">
            <MetricCard label="Momentum" value={formatPercent(analysis.indicators.momentum * 100)} />
            <MetricCard label="RSI" value={analysis.indicators.rsi.toFixed(1)} />
            <MetricCard label="Volatility" value={formatPercent(analysis.indicators.volatility * 100)} />
          </div>
        </section>

        <section className="panel models-panel">
          <div className="panel-heading">
            <p className="eyebrow">Models</p>
            <h2>Select trading models</h2>
          </div>
          <div className="model-list">
            {MODELS.map((model) => {
              const active = selectedModelIds.includes(model.id);
              return (
                <button
                  className={active ? 'model-card selected' : 'model-card'}
                  key={model.id}
                  onClick={() => toggleModel(model.id)}
                  type="button"
                >
                  <span>{model.type}</span>
                  <strong>{model.name}</strong>
                  <small>{model.description}</small>
                  <em>{model.confidence}% confidence · {model.risk} risk</em>
                </button>
              );
            })}
          </div>
        </section>

        <section className="panel account-panel">
          <div className="panel-heading">
            <p className="eyebrow">Portfolio</p>
            <h2>Profit / loss</h2>
          </div>
          <div className="metric-grid">
            <MetricCard
              detail={`${formatPercent((totalPnl / capital) * 100)} vs start`}
              label="Equity"
              tone={totalPnl >= 0 ? 'positive' : 'negative'}
              value={formatCurrency(accountEquity)}
            />
            <MetricCard label="Cash" value={formatCurrency(account.cash)} />
            <MetricCard label="Open position" value={formatCurrency(positionValue)} />
            <MetricCard
              label="Open P/L"
              tone={openPnl >= 0 ? 'positive' : 'negative'}
              value={formatCurrency(openPnl)}
            />
          </div>
          <div className="position-summary">
            <span>Position size</span>
            <strong>{account.units.toFixed(5)} units</strong>
            <small>
              Entry: {account.entryPrice ? formatCurrency(account.entryPrice) : 'No open trade'} · Models:{' '}
              {selectedModels.map((model) => model.name).join(', ')}
            </small>
          </div>
        </section>

        <section className="panel backtest-panel">
          <div className="panel-heading inline">
            <div>
              <p className="eyebrow">Backtest</p>
              <h2>Strategy replay</h2>
            </div>
            <button className="ghost-button compact" onClick={handleBacktest}>
              Re-run
            </button>
          </div>
          {backtestResult ? (
            <>
              <Sparkline
                color={backtestResult.profitLoss >= 0 ? '#65f2a9' : '#ff6b8a'}
                values={backtestResult.equityCurve}
              />
              <div className="metric-grid compact-grid">
                <MetricCard
                  label="Net P/L"
                  tone={backtestResult.profitLoss >= 0 ? 'positive' : 'negative'}
                  value={formatCurrency(backtestResult.profitLoss)}
                />
                <MetricCard label="Return" value={formatPercent(backtestResult.profitLossPct)} />
                <MetricCard label="Win rate" value={`${backtestResult.winRate.toFixed(1)}%`} />
                <MetricCard label="Max drawdown" value={`${backtestResult.maxDrawdown.toFixed(1)}%`} />
              </div>
              <div className="trade-strip">
                {backtestResult.trades.slice(-8).map((trade) => (
                  <span className={trade.action === 'Buy' ? 'buy-dot' : 'sell-dot'} key={`${trade.time}-${trade.action}`}>
                    {trade.action} {formatCurrency(trade.price, 0)}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <strong>No backtest yet</strong>
              <p>Run a replay to compare the selected models, risk profile, and market over historical simulated data.</p>
            </div>
          )}
        </section>

        <section className="panel log-panel">
          <div className="panel-heading">
            <p className="eyebrow">Activity</p>
            <h2>Agent log</h2>
          </div>
          <div className="log-list">
            {tradeLog.map((item, index) => (
              <div className={`log-item ${item.type}`} key={`${item.time}-${index}`}>
                <span>{item.time}</span>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
