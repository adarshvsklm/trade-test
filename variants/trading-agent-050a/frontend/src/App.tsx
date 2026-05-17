import React, { useState } from 'react';
import './App.css';
import Dashboard from './components/Dashboard';
import TradingPanel from './components/TradingPanel';
import BacktestPanel from './components/BacktestPanel';
import AnalysisPanel from './components/AnalysisPanel';
import { BarChart3, Play, FlaskConical, LineChart, Activity } from 'lucide-react';

type Tab = 'dashboard' | 'trading' | 'backtest' | 'analysis';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 size={18} /> },
    { id: 'trading', label: 'Trading', icon: <Play size={18} /> },
    { id: 'backtest', label: 'Backtest', icon: <FlaskConical size={18} /> },
    { id: 'analysis', label: 'Analysis', icon: <LineChart size={18} /> },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <Activity size={24} className="logo-icon" />
          <h1>Trading Agent</h1>
        </div>
        <nav className="header-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'trading' && <TradingPanel />}
        {activeTab === 'backtest' && <BacktestPanel />}
        {activeTab === 'analysis' && <AnalysisPanel />}
      </main>
    </div>
  );
}

export default App;
