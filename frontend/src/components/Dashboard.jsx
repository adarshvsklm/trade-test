import { useState, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area
} from "recharts";
import {
  TrendingUp, TrendingDown, DollarSign, Activity,
  BarChart3, Zap, RefreshCw
} from "lucide-react";
import { api } from "../utils/api";

export default function Dashboard({ sessions }) {
  const [priceData, setPriceData] = useState([]);
  const [stockInfo, setStockInfo] = useState(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [loading, setLoading] = useState(false);

  const fetchData = async (sym) => {
    setLoading(true);
    try {
      const [history, info] = await Promise.all([
        api.getHistory(sym, "3mo"),
        api.getStockInfo(sym),
      ]);
      setPriceData(history);
      setStockInfo(info);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(symbol);
  }, [symbol]);

  const activeSessions = sessions.filter((s) => s.running);
  const totalPnl = sessions.reduce(
    (acc, s) => acc + (s.portfolio?.total_pnl || 0), 0
  );
  const totalValue = sessions.reduce(
    (acc, s) => acc + (s.portfolio?.total_value || 0), 0
  );
  const totalTrades = sessions.reduce(
    (acc, s) => acc + (s.portfolio?.trade_count || 0), 0
  );

  return (
    <div className="flex flex-col gap-16">
      <div className="section">
        <div className="grid-4">
          <StatCard
            label="Portfolio Value"
            value={`$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            icon={<DollarSign size={18} />}
            change={null}
          />
          <StatCard
            label="Total P&L"
            value={`$${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            icon={totalPnl >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
            change={totalPnl}
            isChange
          />
          <StatCard
            label="Active Sessions"
            value={activeSessions.length}
            icon={<Zap size={18} />}
            change={null}
          />
          <StatCard
            label="Total Trades"
            value={totalTrades}
            icon={<BarChart3 size={18} />}
            change={null}
          />
        </div>
      </div>

      <div className="card section">
        <div className="card-header">
          <span className="card-title">
            <Activity size={18} />
            Market Overview
          </span>
          <div className="flex items-center gap-12">
            <input
              className="form-input"
              style={{ width: 120 }}
              placeholder="Symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && fetchData(symbol)}
            />
            <button
              className="btn btn-outline btn-sm"
              onClick={() => fetchData(symbol)}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "spinner" : ""} />
            </button>
          </div>
        </div>

        {stockInfo && (
          <div className="flex items-center gap-16 mb-16">
            <div>
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {stockInfo.name}
              </span>
              <span className="text-xs" style={{ marginLeft: 8, color: "var(--text-muted)" }}>
                {stockInfo.sector}
              </span>
            </div>
          </div>
        )}

        {priceData.length > 0 && (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={priceData}>
              <defs>
                <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
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
                domain={["auto", "auto"]}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text-primary)",
                  fontSize: 13,
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="var(--accent)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorClose)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {sessions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Activity size={18} />
              Active Sessions
            </span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Symbol</th>
                  <th>Strategy</th>
                  <th>Status</th>
                  <th>P&L</th>
                  <th>Trades</th>
                  <th>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session_id}>
                    <td className="font-mono text-sm">{s.session_id}</td>
                    <td style={{ fontWeight: 600 }}>{s.symbol}</td>
                    <td>{s.strategy.replace(/_/g, " ")}</td>
                    <td>
                      <span className={`badge ${s.running ? "badge-green" : "badge-red"}`}>
                        {s.running ? "Running" : "Stopped"}
                      </span>
                    </td>
                    <td className={s.portfolio?.total_pnl >= 0 ? "positive" : "negative"}>
                      ${(s.portfolio?.total_pnl || 0).toFixed(2)}
                    </td>
                    <td>{s.portfolio?.trade_count || 0}</td>
                    <td>{(s.portfolio?.win_rate || 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, change, isChange }) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        <span style={{ color: "var(--accent)" }}>{icon}</span>
      </div>
      <div className={`stat-value ${isChange ? (change >= 0 ? "positive" : "negative") : ""}`}>
        {value}
      </div>
    </div>
  );
}
