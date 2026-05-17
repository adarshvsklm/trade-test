import { useState, useEffect } from 'react';
import { LayoutDashboard, TrendingUp, FlaskConical, BarChart3, Wifi, WifiOff, Bot } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import TradePage from './pages/TradePage';
import BacktestPage from './pages/BacktestPage';
import AnalyticsPage from './pages/AnalyticsPage';
import { useWebSocket } from './hooks/useWebSocket';
import { getState } from './utils/api';

const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'trade', label: 'Trade', Icon: TrendingUp },
  { id: 'backtest', label: 'Backtest', Icon: FlaskConical },
  { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
];

export default function App() {
  const [page, setPage] = useState('dashboard');
  const { agentState: wsState, connected } = useWebSocket();
  const [agentState, setAgentState] = useState(null);

  useEffect(() => {
    if (wsState) setAgentState(wsState);
  }, [wsState]);

  const refreshState = async () => {
    try {
      const s = await getState();
      setAgentState(s);
    } catch (_) {}
  };

  useEffect(() => {
    refreshState();
  }, []);

  return (
    <div className="min-h-screen bg-dark-900 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-dark-800 border-r border-white/5 flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-none">TradeBot</div>
              <div className="text-slate-500 text-xs mt-0.5">AI Trading Agent</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                page === id
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'text-slate-400 hover:bg-dark-700 hover:text-white'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Bottom: Connection Status */}
        <div className="p-4 border-t border-white/5">
          <div className={`flex items-center gap-2 text-xs ${connected ? 'text-emerald-400' : 'text-slate-500'}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Connected' : 'Reconnecting...'}
          </div>
          {agentState?.running && (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">
                {agentState.symbol} · {agentState.strategy?.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-6">
          {page === 'dashboard' && <Dashboard agentState={agentState} />}
          {page === 'trade' && <TradePage agentState={agentState} onRefresh={refreshState} />}
          {page === 'backtest' && <BacktestPage />}
          {page === 'analytics' && <AnalyticsPage agentState={agentState} />}
        </div>
      </main>
    </div>
  );
}
