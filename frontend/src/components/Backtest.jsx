import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceLine, BarChart, Bar
} from "recharts";
import {
  FlaskConical, Play, TrendingUp, TrendingDown,
  BarChart3, Target, AlertTriangle
} from "lucide-react";
import { api } from "../utils/api";

export default function Backtest({ strategies }) {
  const [symbol, setSymbol] = useState("AAPL");
  const [strategy, setStrategy] = useState("sma_crossover");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2025-01-01");
  const [capital, setCapital] = useState("10000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("equity");

  const runBacktest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.runBacktest({
        symbol: symbol.toUpperCase(),
        strategy,
        start_date: startDate,
        end_date: endDate,
        initial_capital: parseFloat(capital),
      });
      setResult(data);
      setActiveTab("equity");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-16">
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <FlaskConical size={18} />
            Backtest Configuration
          </span>
        </div>

        <div className="grid-3 mb-16">
          <div className="form-group">
            <label>Symbol</label>
            <input
              className="form-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            />
          </div>
          <div className="form-group">
            <label>Strategy</label>
            <select
              className="form-select"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Initial Capital ($)</label>
            <input
              className="form-input"
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Start Date</label>
            <input
              className="form-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input
              className="form-input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ justifyContent: "flex-end" }}>
            <button
              className="btn btn-primary w-full"
              onClick={runBacktest}
              disabled={loading}
              style={{ justifyContent: "center" }}
            >
              {loading ? <span className="spinner" /> : <Play size={16} />}
              Run Backtest
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-12" style={{ color: "var(--red)" }}>
            <AlertTriangle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>

      {result && <BacktestResults result={result} activeTab={activeTab} setActiveTab={setActiveTab} />}
    </div>
  );
}

function BacktestResults({ result, activeTab, setActiveTab }) {
  const isProfit = result.total_return_pct >= 0;
  const beatsMarket = result.total_return_pct > result.buy_hold_return_pct;

  return (
    <>
      <div className="grid-4 section">
        <div className="stat-card">
          <div className="stat-label">Final Value</div>
          <div className={`stat-value ${isProfit ? "positive" : "negative"}`}>
            ${result.final_value.toLocaleString()}
          </div>
          <div className={`stat-change ${isProfit ? "positive" : "negative"}`}>
            {isProfit ? "+" : ""}{result.total_return_pct}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Win Rate</div>
          <div className="stat-value">{result.win_rate}%</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            {result.winning_trades}W / {result.losing_trades}L
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sharpe Ratio</div>
          <div className="stat-value">{result.sharpe_ratio}</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Risk-adjusted return
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Max Drawdown</div>
          <div className="stat-value negative">-{result.max_drawdown}%</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)", marginTop: 4 }}>
            Peak to trough
          </div>
        </div>
      </div>

      <div className="card section">
        <div className="grid-3 mb-16">
          <MetricRow label="Total Trades" value={result.total_trades} />
          <MetricRow label="Avg Trade P&L" value={`$${result.avg_trade_pnl}`} positive={result.avg_trade_pnl >= 0} />
          <MetricRow label="Best Trade" value={`$${result.best_trade}`} positive />
          <MetricRow label="Worst Trade" value={`$${result.worst_trade}`} positive={false} />
          <MetricRow
            label="Buy & Hold Return"
            value={`${result.buy_hold_return_pct}%`}
            positive={result.buy_hold_return_pct >= 0}
          />
          <MetricRow
            label="vs Buy & Hold"
            value={`${beatsMarket ? "+" : ""}${(result.total_return_pct - result.buy_hold_return_pct).toFixed(2)}%`}
            positive={beatsMarket}
          />
        </div>
      </div>

      <div className="card">
        <div className="result-tabs">
          <button
            className={`result-tab ${activeTab === "equity" ? "active" : ""}`}
            onClick={() => setActiveTab("equity")}
          >
            Equity Curve
          </button>
          <button
            className={`result-tab ${activeTab === "drawdown" ? "active" : ""}`}
            onClick={() => setActiveTab("drawdown")}
          >
            Drawdown
          </button>
          <button
            className={`result-tab ${activeTab === "trades" ? "active" : ""}`}
            onClick={() => setActiveTab("trades")}
          >
            Trade Log
          </button>
        </div>

        {activeTab === "equity" && (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={result.equity_curve}>
              <defs>
                <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={11}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
                formatter={(v) => [`$${Number(v).toLocaleString()}`, "Portfolio"]}
              />
              <ReferenceLine
                y={result.initial_capital}
                stroke="var(--text-muted)"
                strokeDasharray="3 3"
                label={{ value: "Initial", fill: "var(--text-muted)", fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--green)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#eqGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === "drawdown" && (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={result.equity_curve}>
              <defs>
                <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--red)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={11}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={11}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
                formatter={(v) => [`${v}%`, "Drawdown"]}
              />
              <ReferenceLine y={0} stroke="var(--text-muted)" />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="var(--red)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#ddGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeTab === "trades" && (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Total</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i}>
                    <td className="font-mono text-sm">{t.date}</td>
                    <td>
                      <span className={`badge ${t.side === "buy" ? "badge-green" : "badge-red"}`}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="font-mono">${t.price}</td>
                    <td>{t.quantity}</td>
                    <td className="font-mono">${t.total.toLocaleString()}</td>
                    <td className={`font-mono ${t.pnl != null ? (t.pnl >= 0 ? "positive" : "negative") : ""}`}>
                      {t.pnl != null ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.trades.length === 0 && (
              <div className="empty-state">No trades executed during this period.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function MetricRow({ label, value, positive }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: "8px 0" }}>
      <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className={`font-mono ${positive === true ? "positive" : positive === false ? "negative" : ""}`}>
        {value}
      </span>
    </div>
  );
}
