import { useState } from "react";
import {
  Play, Square, Settings, AlertCircle, CheckCircle2
} from "lucide-react";

export default function TradingPanel({
  strategies,
  sessions,
  onStart,
  onStop,
  loading,
  error,
}) {
  const [symbol, setSymbol] = useState("AAPL");
  const [strategy, setStrategy] = useState("sma_crossover");
  const [capital, setCapital] = useState("10000");
  const [risk, setRisk] = useState("0.02");
  const [success, setSuccess] = useState(null);

  const handleStart = async () => {
    try {
      const result = await onStart({
        symbol: symbol.toUpperCase(),
        strategy,
        initial_capital: parseFloat(capital),
        risk_per_trade: parseFloat(risk),
      });
      setSuccess(`Session ${result.session_id} started`);
      setTimeout(() => setSuccess(null), 4000);
    } catch {
      // error is handled in parent
    }
  };

  return (
    <div className="flex flex-col gap-16">
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Settings size={18} />
            New Trading Session
          </span>
        </div>

        <div className="grid-2 mb-16">
          <div className="form-group">
            <label>Symbol</label>
            <input
              className="form-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL, TSLA, MSFT"
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
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Initial Capital ($)</label>
            <input
              className="form-input"
              type="number"
              min="100"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Risk per Trade (%)</label>
            <input
              className="form-input"
              type="number"
              min="0.1"
              max="10"
              step="0.1"
              value={(parseFloat(risk) * 100).toFixed(1)}
              onChange={(e) => setRisk((parseFloat(e.target.value) / 100).toString())}
            />
          </div>
        </div>

        {strategies.find((s) => s.id === strategy)?.description && (
          <p className="text-sm mb-16" style={{ color: "var(--text-secondary)" }}>
            {strategies.find((s) => s.id === strategy).description}
          </p>
        )}

        {error && (
          <div className="flex items-center gap-12 mb-16" style={{ color: "var(--red)" }}>
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-12 mb-16" style={{ color: "var(--green)" }}>
            <CheckCircle2 size={16} />
            <span className="text-sm">{success}</span>
          </div>
        )}

        <button
          className="btn btn-primary w-full"
          onClick={handleStart}
          disabled={loading || !symbol}
          style={{ justifyContent: "center" }}
        >
          {loading ? <span className="spinner" /> : <Play size={16} />}
          Start Trading
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Strategy Models</span>
        </div>
        <div className="strategy-grid">
          {strategies.map((s) => (
            <div
              key={s.id}
              className={`strategy-card ${strategy === s.id ? "selected" : ""}`}
              onClick={() => setStrategy(s.id)}
            >
              <h3>{s.name}</h3>
              <p>{s.description}</p>
            </div>
          ))}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Running Sessions</span>
          </div>
          <div className="flex flex-col gap-12">
            {sessions.map((s) => (
              <SessionRow key={s.session_id} session={s} onStop={onStop} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionRow({ session, onStop }) {
  const p = session.portfolio || {};
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: "14px 16px",
        background: "var(--bg-primary)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-16">
        <div>
          <div style={{ fontWeight: 600 }}>{session.symbol}</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {session.strategy.replace(/_/g, " ")} &middot;{" "}
            <span className="font-mono">{session.session_id}</span>
          </div>
        </div>
        <span className={`badge ${session.running ? "badge-green" : "badge-red"}`}>
          {session.running ? "Live" : "Stopped"}
        </span>
      </div>
      <div className="flex items-center gap-16">
        <div style={{ textAlign: "right" }}>
          <div className={`font-mono ${p.total_pnl >= 0 ? "positive" : "negative"}`}>
            {p.total_pnl >= 0 ? "+" : ""}${(p.total_pnl || 0).toFixed(2)}
          </div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {p.trade_count || 0} trades
          </div>
        </div>
        {session.running && (
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onStop(session.session_id)}
          >
            <Square size={14} />
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
