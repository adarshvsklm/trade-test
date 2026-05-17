import { useEffect, useState } from "react";
import { Api, StrategyInfo, SymbolInfo } from "./api";
import Backtester from "./components/Backtester";
import LiveTrader from "./components/LiveTrader";

type Tab = "live" | "backtest";

export default function App() {
  const [tab, setTab] = useState<Tab>("live");
  const [strategies, setStrategies] = useState<StrategyInfo[]>([]);
  const [symbols, setSymbols] = useState<SymbolInfo[]>([]);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await Api.health();
        setHealthy(true);
        const [strats, syms] = await Promise.all([Api.strategies(), Api.symbols()]);
        setStrategies(strats);
        setSymbols(syms);
      } catch (e: any) {
        setHealthy(false);
        setBootErr(e?.message || "Cannot reach API");
      }
    })();
  }, []);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="logo" />
          <div>
            Quant Trading Agent
            <small>multi-model · backtest · paper-trade</small>
          </div>
        </div>
        <div className="tabs">
          <button className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>
            Live Trader
          </button>
          <button className={tab === "backtest" ? "active" : ""} onClick={() => setTab("backtest")}>
            Backtest
          </button>
        </div>
        <div className="health">
          <span className={`dot ${healthy === true ? "ok" : healthy === false ? "bad" : ""}`} />
          {healthy === true ? "API connected" : healthy === false ? "API offline" : "checking..."}
        </div>
      </div>

      {bootErr && (
        <div style={{ padding: 18 }}>
          <div className="error">
            Backend unreachable: {bootErr}. Start the FastAPI server (see the README) and reload.
          </div>
        </div>
      )}

      {strategies.length > 0 && symbols.length > 0 && (
        <>
          {tab === "live" && <LiveTrader strategies={strategies} symbols={symbols} />}
          {tab === "backtest" && <Backtester strategies={strategies} symbols={symbols} />}
        </>
      )}
    </div>
  );
}
