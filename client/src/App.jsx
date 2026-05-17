import { useEffect, useMemo, useState } from "react";
import { getModels, getState, runBacktest, startTrading, stopTrading } from "./api";

const SYMBOLS = ["BTC-USD", "ETH-USD", "SOL-USD"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const formatPercent = (value) => `${Number(value ?? 0).toFixed(2)}%`;

const LineChart = ({ title, data, field, stroke = "#4f46e5" }) => {
  if (!data?.length) {
    return (
      <div className="chart-card">
        <h3>{title}</h3>
        <div className="empty-state">Waiting for data...</div>
      </div>
    );
  }

  const values = data.map((point) => Number(point[field]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 100 - ((value - min) / spread) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="2.2" />
      </svg>
      <div className="chart-range">
        <span>{formatCurrency(min)}</span>
        <span>{formatCurrency(max)}</span>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, hint, trend }) => (
  <div className={`metric-card ${trend ?? ""}`}>
    <p className="metric-label">{label}</p>
    <p className="metric-value">{value}</p>
    {hint ? <p className="metric-hint">{hint}</p> : null}
  </div>
);

const TradeTable = ({ trades }) => (
  <div className="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Side</th>
          <th>Units</th>
          <th>Price</th>
          <th>Reason</th>
          <th>Trade P/L</th>
        </tr>
      </thead>
      <tbody>
        {trades?.length ? (
          trades.map((trade, index) => (
            <tr key={`${trade.time}-${index}`}>
              <td>{new Date(trade.time).toLocaleTimeString()}</td>
              <td>{trade.side}</td>
              <td>{trade.units}</td>
              <td>{formatCurrency(trade.price)}</td>
              <td>{trade.reason}</td>
              <td className={trade.pnl > 0 ? "positive" : trade.pnl < 0 ? "negative" : ""}>
                {formatCurrency(trade.pnl)}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={6} className="empty-row">
              Trades will appear after the agent executes orders.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

function App() {
  const [models, setModels] = useState([]);
  const [liveState, setLiveState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [backtestBusy, setBacktestBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [backtestResult, setBacktestResult] = useState(null);
  const [tradeConfig, setTradeConfig] = useState({
    modelId: "momentum-ma",
    symbol: "BTC-USD",
    initialCapital: 10000,
    riskPerTrade: 0.2,
    stopLossPct: 0.03,
    takeProfitPct: 0.07,
  });
  const [backtestConfig, setBacktestConfig] = useState({
    modelId: "momentum-ma",
    symbol: "BTC-USD",
    initialCapital: 10000,
    candles: 500,
    riskPerTrade: 0.2,
    stopLossPct: 0.03,
    takeProfitPct: 0.07,
  });

  useEffect(() => {
    const initialize = async () => {
      try {
        const [modelResponse, stateResponse] = await Promise.all([getModels(), getState()]);
        setModels(modelResponse.models);
        setLiveState(stateResponse);
        const modelId = stateResponse?.model?.id ?? modelResponse.models[0]?.id ?? "momentum-ma";
        setTradeConfig((prev) => ({ ...prev, modelId }));
        setBacktestConfig((prev) => ({ ...prev, modelId }));
      } catch (requestError) {
        setError(requestError.message);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    const pollInterval = liveState?.running ? 1400 : 3500;
    const poll = setInterval(async () => {
      try {
        const data = await getState();
        setLiveState(data);
      } catch (requestError) {
        setError(requestError.message);
      }
    }, pollInterval);

    return () => clearInterval(poll);
  }, [liveState?.running]);

  const updateConfigField = (setter) => (event) => {
    const { name, value } = event.target;
    const parsed =
      name === "symbol" || name === "modelId"
        ? value
        : Number.isNaN(Number(value))
          ? 0
          : Number(value);
    setter((prev) => ({ ...prev, [name]: parsed }));
  };

  const handleStart = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await startTrading(tradeConfig);
      setWarning(response.warning ?? "");
      setLiveState(response.state);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await stopTrading();
      setLiveState(response.state);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleBacktest = async () => {
    setBacktestBusy(true);
    setError("");
    try {
      const result = await runBacktest(backtestConfig);
      setBacktestResult(result);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBacktestBusy(false);
    }
  };

  const pnlTrend = useMemo(() => {
    const totalPnl = liveState?.portfolio?.totalPnl ?? 0;
    return totalPnl > 0 ? "positive" : totalPnl < 0 ? "negative" : "";
  }, [liveState?.portfolio?.totalPnl]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>AI Trading Agent Console</h1>
          <p>
            Analyze synthetic market data, run strategy-based execution, track P/L and evaluate
            model behavior with backtesting.
          </p>
        </div>
        <span className={`status-chip ${liveState?.running ? "running" : "stopped"}`}>
          {liveState?.running ? "LIVE RUNNING" : "IDLE"}
        </span>
      </header>

      {warning ? <div className="notice warning">{warning}</div> : null}
      {error ? <div className="notice error">{error}</div> : null}

      <section className="panel">
        <h2>Live Trading Controls</h2>
        <div className="form-grid">
          <label>
            Model
            <select
              name="modelId"
              value={tradeConfig.modelId}
              onChange={updateConfigField(setTradeConfig)}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.riskProfile})
                </option>
              ))}
            </select>
          </label>

          <label>
            Symbol
            <select name="symbol" value={tradeConfig.symbol} onChange={updateConfigField(setTradeConfig)}>
              {SYMBOLS.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>

          <label>
            Initial Capital ($)
            <input
              type="number"
              name="initialCapital"
              min="1000"
              step="100"
              value={tradeConfig.initialCapital}
              onChange={updateConfigField(setTradeConfig)}
            />
          </label>

          <label>
            Risk Per Trade (0-1)
            <input
              type="number"
              name="riskPerTrade"
              min="0.01"
              max="0.9"
              step="0.01"
              value={tradeConfig.riskPerTrade}
              onChange={updateConfigField(setTradeConfig)}
            />
          </label>

          <label>
            Stop Loss %
            <input
              type="number"
              name="stopLossPct"
              min="0.005"
              max="0.2"
              step="0.005"
              value={tradeConfig.stopLossPct}
              onChange={updateConfigField(setTradeConfig)}
            />
          </label>

          <label>
            Take Profit %
            <input
              type="number"
              name="takeProfitPct"
              min="0.01"
              max="0.5"
              step="0.01"
              value={tradeConfig.takeProfitPct}
              onChange={updateConfigField(setTradeConfig)}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="primary" onClick={handleStart} disabled={busy}>
            {busy ? "Starting..." : "Start Trading"}
          </button>
          <button className="danger" onClick={handleStop} disabled={busy || !liveState?.running}>
            Stop Trading
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="Latest Price" value={formatCurrency(liveState?.market?.latestPrice)} />
        <MetricCard label="Portfolio Equity" value={formatCurrency(liveState?.portfolio?.equity)} />
        <MetricCard label="Realized P/L" value={formatCurrency(liveState?.portfolio?.realizedPnl)} />
        <MetricCard
          label="Total P/L"
          value={formatCurrency(liveState?.portfolio?.totalPnl)}
          hint={formatPercent(liveState?.portfolio?.totalReturnPct)}
          trend={pnlTrend}
        />
        <MetricCard
          label="Win Rate"
          value={formatPercent(liveState?.stats?.winRate)}
          hint={`${liveState?.stats?.wins ?? 0} wins / ${liveState?.stats?.losses ?? 0} losses`}
        />
        <MetricCard
          label="Risk & Quality"
          value={`DD ${formatPercent(liveState?.stats?.maxDrawdownPct)}`}
          hint={`Sharpe ${liveState?.stats?.sharpeRatio ?? 0}`}
        />
      </section>

      <section className="charts-grid">
        <LineChart title="Price Trend" data={liveState?.market?.candles} field="close" stroke="#0ea5e9" />
        <LineChart title="Equity Curve" data={liveState?.equityCurve} field="equity" stroke="#22c55e" />
      </section>

      <section className="panel">
        <h2>Recent Trades</h2>
        <TradeTable trades={liveState?.recentTrades} />
      </section>

      <section className="panel">
        <h2>Backtest</h2>
        <div className="form-grid">
          <label>
            Model
            <select
              name="modelId"
              value={backtestConfig.modelId}
              onChange={updateConfigField(setBacktestConfig)}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Symbol
            <select
              name="symbol"
              value={backtestConfig.symbol}
              onChange={updateConfigField(setBacktestConfig)}
            >
              {SYMBOLS.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </label>

          <label>
            Historical Candles
            <input
              type="number"
              name="candles"
              min="60"
              max="3000"
              step="10"
              value={backtestConfig.candles}
              onChange={updateConfigField(setBacktestConfig)}
            />
          </label>

          <label>
            Initial Capital ($)
            <input
              type="number"
              name="initialCapital"
              min="1000"
              step="100"
              value={backtestConfig.initialCapital}
              onChange={updateConfigField(setBacktestConfig)}
            />
          </label>

          <label>
            Risk Per Trade (0-1)
            <input
              type="number"
              name="riskPerTrade"
              min="0.01"
              max="0.9"
              step="0.01"
              value={backtestConfig.riskPerTrade}
              onChange={updateConfigField(setBacktestConfig)}
            />
          </label>

          <label>
            Stop Loss %
            <input
              type="number"
              name="stopLossPct"
              min="0.005"
              max="0.2"
              step="0.005"
              value={backtestConfig.stopLossPct}
              onChange={updateConfigField(setBacktestConfig)}
            />
          </label>
        </div>

        <div className="button-row">
          <button className="primary" onClick={handleBacktest} disabled={backtestBusy}>
            {backtestBusy ? "Running..." : "Run Backtest"}
          </button>
        </div>

        {backtestResult ? (
          <div className="backtest-results">
            <p className="backtest-note">{backtestResult.disclaimer}</p>
            <div className="metrics-grid compact">
              <MetricCard
                label="Backtest Return"
                value={formatPercent(backtestResult.portfolio?.totalReturnPct)}
                trend={(backtestResult.portfolio?.totalPnl ?? 0) > 0 ? "positive" : "negative"}
              />
              <MetricCard
                label="Backtest P/L"
                value={formatCurrency(backtestResult.portfolio?.totalPnl)}
              />
              <MetricCard
                label="Market Move"
                value={formatPercent(backtestResult.market?.movePct)}
              />
              <MetricCard label="Win Rate" value={formatPercent(backtestResult.stats?.winRate)} />
            </div>
            <LineChart
              title="Backtest Equity Curve"
              data={backtestResult.equityCurve}
              field="equity"
              stroke="#a855f7"
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default App;
