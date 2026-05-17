import { useEffect, useState } from "react";
import { Api, BacktestResponse, StrategyInfo, SymbolInfo } from "../api";
import EquityChart, { PriceChart } from "./EquityChart";
import Kpi from "./Kpi";
import StrategyPicker from "./StrategyPicker";

interface Props {
  strategies: StrategyInfo[];
  symbols: SymbolInfo[];
}

const INTERVAL_OPTIONS = [
  { value: "1d", label: "Daily" },
  { value: "1h", label: "Hourly" },
];

export default function Backtester({ strategies, symbols }: Props) {
  const [symbol, setSymbol] = useState("AAPL");
  const [strategy, setStrategy] = useState("sma_crossover");
  const [params, setParams] = useState<Record<string, number>>({});
  const [periodDays, setPeriodDays] = useState(365);
  const [interval, setInterval] = useState("1d");
  const [capital, setCapital] = useState(10_000);
  const [feeBps, setFeeBps] = useState(5);
  const [allowShort, setAllowShort] = useState(true);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const s = strategies.find((x) => x.key === strategy);
    if (!s) return;
    setParams((prev) => {
      const next = { ...prev };
      for (const p of s.params) if (next[p.name] === undefined) next[p.name] = p.default;
      return next;
    });
  }, [strategy, strategies]);

  const run = async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await Api.backtest({
        symbol,
        strategy,
        params,
        period_days: periodDays,
        interval,
        initial_capital: capital,
        fee_bps: feeBps,
        allow_short: allowShort,
      });
      setResult(r);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Backtest failed");
    } finally {
      setLoading(false);
    }
  };

  const positiveReturn = (result?.total_return_pct ?? 0) >= 0;
  const beatBnh = result && result.total_return_pct >= result.buy_hold_return_pct;

  return (
    <div className="container">
      <div className="panel">
        <h2>Backtest</h2>
        <p className="help" style={{ marginBottom: 14 }}>
          Run any strategy on historical data and inspect the equity curve, risk
          metrics, and trade-by-trade outcomes.
        </p>

        <div className="field">
          <label>Symbol</label>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)}>
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
          onChangeStrategy={setStrategy}
          onChangeParam={(name, value) => setParams((p) => ({ ...p, [name]: value }))}
        />

        <div className="row">
          <div className="field">
            <label>Period (days)</label>
            <input
              type="number"
              value={periodDays}
              min={30}
              max={3650}
              step={30}
              onChange={(e) => setPeriodDays(parseInt(e.target.value || "365", 10))}
            />
          </div>
          <div className="field">
            <label>Interval</label>
            <select value={interval} onChange={(e) => setInterval(e.target.value)}>
              {INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="row">
          <div className="field">
            <label>Capital ($)</label>
            <input
              type="number"
              value={capital}
              min={100}
              step={100}
              onChange={(e) => setCapital(parseFloat(e.target.value || "0"))}
            />
          </div>
          <div className="field">
            <label>Fee (bps)</label>
            <input
              type="number"
              value={feeBps}
              min={0}
              step={1}
              onChange={(e) => setFeeBps(parseFloat(e.target.value || "0"))}
            />
          </div>
        </div>

        <div className="field">
          <label>Short allowed</label>
          <select
            value={allowShort ? "yes" : "no"}
            onChange={(e) => setAllowShort(e.target.value === "yes")}
          >
            <option value="yes">Yes (long & short)</option>
            <option value="no">No (long only)</option>
          </select>
        </div>

        <button className="primary" onClick={run} disabled={loading} style={{ width: "100%" }}>
          {loading ? <span className="spinner" /> : "Run Backtest"}
        </button>
      </div>

      <div>
        {err && <div className="error">{err}</div>}

        {!result && !err && (
          <div className="panel">
            <h2>No backtest run yet</h2>
            <p className="help">
              Select a symbol, pick a model and parameters, then click <strong>Run Backtest</strong>.
              The results panel will show equity, drawdown, win rate, and a sample of trades.
            </p>
          </div>
        )}

        {result && (
          <>
            <div className="panel">
              <div className="status-strip">
                <span className="badge">
                  Symbol <strong>{result.symbol}</strong>
                </span>
                <span className="badge">
                  Model <strong>{strategies.find((s) => s.key === result.strategy)?.name || result.strategy}</strong>
                </span>
                <span className="badge">
                  Capital <strong>${result.initial_capital.toLocaleString()}</strong>
                </span>
                <span className="badge">
                  Final <strong>${result.final_equity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                </span>
              </div>

              <div className="kpi-grid">
                <Kpi
                  label="Total Return"
                  value={result.total_return_pct}
                  format="pct"
                  tone={positiveReturn ? "pos" : "neg"}
                  sub={`vs Buy&Hold ${result.buy_hold_return_pct.toFixed(2)}%`}
                />
                <Kpi
                  label="Annualized"
                  value={result.annualized_return_pct}
                  format="pct"
                  tone={result.annualized_return_pct >= 0 ? "pos" : "neg"}
                  sub={`Vol ${result.annualized_vol_pct.toFixed(2)}%`}
                />
                <Kpi
                  label="Sharpe"
                  value={result.sharpe_ratio.toFixed(2)}
                  tone={result.sharpe_ratio >= 1 ? "pos" : result.sharpe_ratio < 0 ? "neg" : "neutral"}
                  sub={`Sortino ${result.sortino_ratio.toFixed(2)}`}
                />
                <Kpi
                  label="Max Drawdown"
                  value={result.max_drawdown_pct}
                  format="pct"
                  tone="neg"
                />
                <Kpi
                  label="Win Rate"
                  value={result.win_rate_pct}
                  format="pct"
                  sub={`${result.num_trades} trades`}
                />
                <Kpi
                  label="Profit Factor"
                  value={result.profit_factor === 999 ? "∞" : result.profit_factor.toFixed(2)}
                  sub={`Avg trade ${result.avg_trade_pct.toFixed(2)}%`}
                />
                <Kpi
                  label="vs Buy & Hold"
                  value={beatBnh ? "OUTPERFORM" : "UNDERPERFORM"}
                  tone={beatBnh ? "pos" : "neg"}
                  sub={`Δ ${(result.total_return_pct - result.buy_hold_return_pct).toFixed(2)}%`}
                />
              </div>

              <div className="section">
                <h3>Equity Curve</h3>
                <EquityChart
                  data={result.equity_curve.map((p) => ({ t: p.t, equity: p.equity }))}
                  initialCapital={result.initial_capital}
                />
              </div>

              <div className="section">
                <h3>Price Series</h3>
                <PriceChart data={result.price_series} />
              </div>
            </div>

            <div className="panel" style={{ marginTop: 18 }}>
              <h3>Recent Trades</h3>
              {result.trades.length === 0 ? (
                <div className="help">No trades produced by this configuration.</div>
              ) : (
                <table className="trade-table">
                  <thead>
                    <tr>
                      <th>Entry</th>
                      <th>Exit</th>
                      <th>Side</th>
                      <th>Entry $</th>
                      <th>Exit $</th>
                      <th>Bars</th>
                      <th>PnL %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...result.trades].reverse().slice(0, 50).map((t, i) => (
                      <tr key={i}>
                        <td>{new Date(t.entry_time).toLocaleDateString()}</td>
                        <td>{new Date(t.exit_time).toLocaleDateString()}</td>
                        <td>
                          <span className={`pill ${t.side}`}>{t.side.toUpperCase()}</span>
                        </td>
                        <td>${t.entry_price.toFixed(2)}</td>
                        <td>${t.exit_price.toFixed(2)}</td>
                        <td>{t.bars_held}</td>
                        <td style={{ color: t.pnl_pct >= 0 ? "var(--green)" : "var(--red)" }}>
                          {t.pnl_pct.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
