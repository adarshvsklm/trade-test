import { useEffect, useRef, useState } from "react";
import { Api, StrategyInfo, SymbolInfo, TraderState } from "../api";
import EquityChart from "./EquityChart";
import Kpi from "./Kpi";
import StrategyPicker from "./StrategyPicker";

interface Props {
  strategies: StrategyInfo[];
  symbols: SymbolInfo[];
}

export default function LiveTrader({ strategies, symbols }: Props) {
  const [state, setState] = useState<TraderState | null>(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [strategy, setStrategy] = useState("sma_crossover");
  const [params, setParams] = useState<Record<string, number>>({});
  const [capital, setCapital] = useState(10_000);
  const [intervalSec, setIntervalSec] = useState(1);
  const [feeBps, setFeeBps] = useState(5);
  const [allowShort, setAllowShort] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const refresh = async () => {
    try {
      const s = await Api.traderState();
      setState(s);
      setErr(s.error);
    } catch (e: any) {
      setErr(e?.message || "Failed to fetch trader state");
    }
  };

  useEffect(() => {
    refresh();
    pollRef.current = window.setInterval(refresh, 1500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    const s = strategies.find((x) => x.key === strategy);
    if (!s) return;
    setParams((prev) => {
      const next = { ...prev };
      for (const p of s.params) if (next[p.name] === undefined) next[p.name] = p.default;
      return next;
    });
  }, [strategy, strategies]);

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const s = await Api.traderStart({
        symbol,
        strategy,
        params,
        initial_capital: capital,
        interval_sec: intervalSec,
        fee_bps: feeBps,
        allow_short: allowShort,
      } as any);
      setState(s);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to start trader");
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const s = await Api.traderStop();
      setState(s);
    } catch (e: any) {
      setErr(e?.message || "Failed to stop trader");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      const s = await Api.traderReset();
      setState(s);
    } catch (e: any) {
      setErr(e?.message || "Failed to reset trader");
    } finally {
      setBusy(false);
    }
  };

  const running = !!state?.running;
  const pnl = state?.pnl ?? 0;
  const pnlPct = state?.pnl_pct ?? 0;
  const positionLabel = !state?.position
    ? "FLAT"
    : state.position.side > 0
    ? "LONG"
    : "SHORT";
  const positionClass =
    !state?.position ? "pill flat" : state.position.side > 0 ? "pill long" : "pill short";

  return (
    <div className="container">
      <div className="panel">
        <h2>Trading Console</h2>
        <p className="help" style={{ marginBottom: 14 }}>
          Configure the symbol, pick a model, then start the paper-trading agent.
          The agent evaluates the latest signal each tick and executes virtual
          orders against a simulated next-bar feed.
        </p>

        <div className="field">
          <label>Symbol</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} disabled={running}>
            {symbols.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.name}
              </option>
            ))}
          </select>
        </div>

        <StrategyPicker
          strategies={strategies}
          selected={strategy}
          params={params}
          onChangeStrategy={(k) => !running && setStrategy(k)}
          onChangeParam={(name, value) =>
            !running && setParams((p) => ({ ...p, [name]: value }))
          }
        />

        <div className="row">
          <div className="field">
            <label>Capital ($)</label>
            <input
              type="number"
              value={capital}
              min={100}
              step={100}
              disabled={running}
              onChange={(e) => setCapital(parseFloat(e.target.value || "0"))}
            />
          </div>
          <div className="field">
            <label>Tick (sec)</label>
            <input
              type="number"
              value={intervalSec}
              min={0.3}
              step={0.1}
              disabled={running}
              onChange={(e) => setIntervalSec(parseFloat(e.target.value || "1"))}
            />
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Fee (bps)</label>
            <input
              type="number"
              value={feeBps}
              min={0}
              step={1}
              disabled={running}
              onChange={(e) => setFeeBps(parseFloat(e.target.value || "0"))}
            />
          </div>
          <div className="field">
            <label>Short allowed</label>
            <select
              value={allowShort ? "yes" : "no"}
              disabled={running}
              onChange={(e) => setAllowShort(e.target.value === "yes")}
            >
              <option value="yes">Yes</option>
              <option value="no">No (long only)</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          {!running ? (
            <button className="primary" onClick={start} disabled={busy} style={{ flex: 1 }}>
              {busy ? <span className="spinner" /> : "Start Trading"}
            </button>
          ) : (
            <button className="danger" onClick={stop} disabled={busy} style={{ flex: 1 }}>
              {busy ? <span className="spinner" /> : "Stop Trading"}
            </button>
          )}
          <button className="ghost" onClick={reset} disabled={busy || running}>
            Reset
          </button>
        </div>
      </div>

      <div>
        {err && <div className="error">{err}</div>}

        <div className="panel">
          <div className="status-strip">
            <span className="badge">
              Status <strong>{running ? "RUNNING" : "IDLE"}</strong>
            </span>
            <span className="badge">
              Symbol <strong>{state?.symbol}</strong>
            </span>
            <span className="badge">
              Model <strong>{strategies.find((s) => s.key === state?.strategy)?.name || state?.strategy}</strong>
            </span>
            <span className="badge">
              Position <span className={positionClass}>{positionLabel}</span>
            </span>
            <span className="badge">
              Signal{" "}
              <strong style={{ color: state?.last_signal === 1 ? "var(--green)" : state?.last_signal === -1 ? "var(--red)" : "var(--muted)" }}>
                {state?.last_signal === 1 ? "LONG" : state?.last_signal === -1 ? "SHORT" : "FLAT"}
              </strong>
            </span>
          </div>

          <div className="kpi-grid">
            <Kpi label="Equity" value={state?.equity ?? 0} format="money" />
            <Kpi
              label="PnL"
              value={pnl}
              format="money"
              tone={pnl >= 0 ? "pos" : "neg"}
              sub={`${pnlPct.toFixed(2)}%`}
            />
            <Kpi
              label="Last Price"
              value={state?.last_price ?? 0}
              format="money"
            />
            <Kpi
              label="Cash"
              value={state?.cash ?? 0}
              format="money"
            />
            <Kpi
              label="Position Qty"
              value={state?.position ? state.position.qty.toFixed(4) : "—"}
            />
            <Kpi label="Trades" value={state?.trades?.length ?? 0} />
          </div>

          <div className="section">
            <h3>Equity vs. Price</h3>
            <EquityChart
              data={(state?.equity_curve ?? []) as any}
              showPrice
              initialCapital={state?.initial_capital}
            />
          </div>
        </div>

        <div className="panel" style={{ marginTop: 18 }}>
          <h3>Trade Log</h3>
          {state?.trades && state.trades.length > 0 ? (
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>PnL</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {[...state.trades].reverse().map((t, i) => {
                  const isBuy = t.action === "BUY" || t.action === "COVER";
                  return (
                    <tr key={i}>
                      <td>{new Date(t.time).toLocaleTimeString()}</td>
                      <td>
                        <span className={`pill ${isBuy ? "buy" : "sell"}`}>{t.action}</span>
                      </td>
                      <td>${t.price.toFixed(2)}</td>
                      <td>{t.qty.toFixed(4)}</td>
                      <td style={{ color: t.pnl >= 0 ? "var(--green)" : "var(--red)" }}>
                        {t.pnl ? `$${t.pnl.toFixed(2)}` : "—"}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{t.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="help">No trades yet. Start the agent to see live activity.</div>
          )}
        </div>
      </div>
    </div>
  );
}
