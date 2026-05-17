import { useState } from "react";
import {
  LayoutDashboard, Bot, FlaskConical, History, Activity
} from "lucide-react";
import { useTrading } from "./hooks/useTrading";
import Dashboard from "./components/Dashboard";
import TradingPanel from "./components/TradingPanel";
import Backtest from "./components/Backtest";
import TradeHistory from "./components/TradeHistory";
import "./App.css";

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "trade", label: "Trade", icon: Bot },
  { id: "backtest", label: "Backtest", icon: FlaskConical },
  { id: "history", label: "History", icon: History },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const {
    strategies,
    sessions,
    loading,
    error,
    startTrading,
    stopTrading,
    refreshSessions,
  } = useTrading();

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <Activity size={24} className="header-logo" />
          <h1>Trading Agent</h1>
        </div>
        <nav className="nav-tabs">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-tab ${activeTab === id ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        {activeTab === "dashboard" && (
          <Dashboard sessions={sessions} />
        )}
        {activeTab === "trade" && (
          <TradingPanel
            strategies={strategies}
            sessions={sessions}
            onStart={startTrading}
            onStop={stopTrading}
            loading={loading}
            error={error}
          />
        )}
        {activeTab === "backtest" && (
          <Backtest strategies={strategies} />
        )}
        {activeTab === "history" && (
          <TradeHistory sessions={sessions} />
        )}
      </main>
    </div>
  );
}
