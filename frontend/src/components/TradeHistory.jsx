import { useState, useEffect } from "react";
import { History, Download, Filter } from "lucide-react";
import { api } from "../utils/api";

export default function TradeHistory({ sessions }) {
  const [selectedSession, setSelectedSession] = useState("all");
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTrades();
  }, [selectedSession, sessions]);

  const loadTrades = async () => {
    if (sessions.length === 0) return;
    setLoading(true);
    try {
      if (selectedSession === "all") {
        const allTrades = [];
        for (const s of sessions) {
          const t = await api.getSessionTrades(s.session_id);
          allTrades.push(...t.map((tr) => ({ ...tr, session: s.session_id })));
        }
        allTrades.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTrades(allTrades);
      } else {
        const t = await api.getSessionTrades(selectedSession);
        setTrades(t.map((tr) => ({ ...tr, session: selectedSession })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const totalPnl = trades
    .filter((t) => t.pnl != null)
    .reduce((acc, t) => acc + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl != null && t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl != null && t.pnl <= 0).length;

  const exportCSV = () => {
    const headers = "Timestamp,Session,Symbol,Side,Price,Quantity,Total,P&L,Strategy\n";
    const rows = trades
      .map(
        (t) =>
          `${t.timestamp},${t.session},${t.symbol},${t.side},${t.price},${t.quantity},${t.total},${t.pnl ?? ""},${t.strategy}`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-16">
      <div className="grid-3 section">
        <div className="stat-card">
          <div className="stat-label">Total Trades</div>
          <div className="stat-value">{trades.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Realized P&L</div>
          <div className={`stat-value ${totalPnl >= 0 ? "positive" : "negative"}`}>
            {totalPnl >= 0 ? "+" : ""}${totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Win / Loss</div>
          <div className="stat-value">
            <span className="positive">{wins}</span>
            {" / "}
            <span className="negative">{losses}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <History size={18} />
            Trade Log
          </span>
          <div className="flex items-center gap-12">
            <div className="flex items-center gap-8">
              <Filter size={14} style={{ color: "var(--text-secondary)" }} />
              <select
                className="form-select"
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                style={{ minWidth: 140 }}
              >
                <option value="all">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s.session_id} value={s.session_id}>
                    {s.symbol} - {s.session_id}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-outline btn-sm" onClick={exportCSV}>
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <span className="spinner" />
          </div>
        ) : trades.length === 0 ? (
          <div className="empty-state">
            <History size={40} />
            <p>No trades yet. Start a trading session to see trade history.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Session</th>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Total</th>
                  <th>Strategy</th>
                  <th>P&L</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i}>
                    <td className="font-mono text-xs">
                      {new Date(t.timestamp).toLocaleString()}
                    </td>
                    <td className="font-mono text-xs">{t.session}</td>
                    <td style={{ fontWeight: 600 }}>{t.symbol}</td>
                    <td>
                      <span
                        className={`badge ${t.side === "buy" ? "badge-green" : "badge-red"}`}
                      >
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="font-mono">${t.price}</td>
                    <td>{t.quantity}</td>
                    <td className="font-mono">${t.total.toLocaleString()}</td>
                    <td className="text-xs">{t.strategy.replace(/_/g, " ")}</td>
                    <td
                      className={`font-mono ${
                        t.pnl != null
                          ? t.pnl >= 0
                            ? "positive"
                            : "negative"
                          : ""
                      }`}
                    >
                      {t.pnl != null
                        ? `${t.pnl >= 0 ? "+" : ""}$${t.pnl.toFixed(2)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
