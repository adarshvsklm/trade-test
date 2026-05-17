import { useState, useEffect } from 'react';
import { Play, Square, Settings, Zap, Clock } from 'lucide-react';
import TradeTable from '../components/TradeTable';
import LogConsole from '../components/LogConsole';
import Badge from '../components/Badge';
import { getStrategies, startTrading, stopTrading } from '../utils/api';

const POPULAR_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'SPY', 'QQQ', 'BTC-USD', 'ETH-USD'];
const INTERVALS = [
  { label: '30 sec (demo)', value: 30 },
  { label: '1 min', value: 60 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '1 hour', value: 3600 },
];

export default function TradePage({ agentState, onRefresh }) {
  const [strategies, setStrategies] = useState([]);
  const [selectedStrategy, setSelectedStrategy] = useState('sma_crossover');
  const [symbol, setSymbol] = useState('AAPL');
  const [capital, setCapital] = useState(10000);
  const [interval, setInterval] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getStrategies().then(setStrategies).catch(() => {});
  }, []);

  const handleStart = async () => {
    setError('');
    setLoading(true);
    try {
      await startTrading({
        symbol: symbol.toUpperCase(),
        strategy_id: selectedStrategy,
        initial_capital: Number(capital),
        interval_seconds: Number(interval),
      });
      onRefresh?.();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to start trading.');
    }
    setLoading(false);
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await stopTrading();
      onRefresh?.();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to stop trading.');
    }
    setLoading(false);
  };

  const isRunning = agentState?.running;
  const selectedStrategyInfo = strategies.find((s) => s.id === selectedStrategy);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Trading Control</h1>
        <p className="text-slate-500 text-sm mt-0.5">Configure and control the paper trading agent</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 bg-dark-800 border border-white/5 rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Settings size={15} />
            Configuration
          </div>

          {/* Symbol */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1.5">Symbol</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                disabled={isRunning}
                placeholder="e.g. AAPL"
                className="flex-1 bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {POPULAR_SYMBOLS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  disabled={isRunning}
                  className={`text-xs px-2 py-0.5 rounded border transition-all disabled:opacity-40 ${
                    symbol === s
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-dark-700 border-white/10 text-slate-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Strategy */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1.5">Strategy</label>
            <div className="space-y-2">
              {strategies.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedStrategy === s.id
                      ? 'border-indigo-500/50 bg-indigo-500/10'
                      : 'border-white/5 bg-dark-700 hover:border-white/15'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="radio"
                    name="strategy"
                    value={s.id}
                    checked={selectedStrategy === s.id}
                    onChange={() => !isRunning && setSelectedStrategy(s.id)}
                    className="mt-0.5 accent-indigo-500"
                  />
                  <div>
                    <div className="text-white text-sm font-medium">{s.name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{s.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Capital */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1.5">Initial Capital ($)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              disabled={isRunning}
              min={100}
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
          </div>

          {/* Interval */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1.5">
              <Clock size={11} className="inline mr-1" />Check Interval
            </label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              disabled={isRunning}
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            >
              {INTERVALS.map((i) => (
                <option key={i.value} value={i.value}>{i.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isRunning ? (
              <button
                onClick={handleStart}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
              >
                <Play size={14} />
                {loading ? 'Starting...' : 'Start Trading'}
              </button>
            ) : (
              <button
                onClick={handleStop}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
              >
                <Square size={14} />
                {loading ? 'Stopping...' : 'Stop Trading'}
              </button>
            )}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-amber-400 text-xs">
            <Zap size={11} className="inline mr-1" />
            Paper trading only — no real money involved.
          </div>
        </div>

        {/* Right Panel: Status + Logs + Trades */}
        <div className="lg:col-span-2 space-y-4">
          {/* Current Status */}
          <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
            <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Current Status</div>
            {agentState?.running ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {[
                  ['Symbol', agentState.symbol, ''],
                  ['Strategy', agentState.strategy, 'text-indigo-400'],
                  ['Last Price', `$${Number(agentState.last_price).toFixed(4)}`, ''],
                  ['Signal', null, ''],
                  ['Equity', `$${Number(agentState.equity).toFixed(2)}`, ''],
                  ['Cash', `$${Number(agentState.cash).toFixed(2)}`, ''],
                  ['P&L', `${agentState.total_pnl >= 0 ? '+' : ''}$${Number(agentState.total_pnl).toFixed(2)}`, agentState.total_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'],
                  ['Trades', agentState.total_trades ?? 0, ''],
                ].map(([k, v, cls]) => (
                  <div key={k}>
                    <div className="text-slate-500 text-xs">{k}</div>
                    {k === 'Signal' ? (
                      <Badge label={agentState.last_signal} variant={agentState.last_signal?.toLowerCase() || 'hold'} />
                    ) : (
                      <div className={`font-mono font-semibold mt-0.5 ${cls || 'text-white'}`}>{v}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 text-sm">Agent is not running.</div>
            )}
          </div>

          {/* Agent Logs */}
          <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
            <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Agent Logs</div>
            <LogConsole messages={agentState?.log_messages || []} />
          </div>

          {/* Trade History */}
          <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
            <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">
              Trade History ({agentState?.trades?.length ?? 0})
            </div>
            <TradeTable trades={agentState?.trades || []} />
          </div>
        </div>
      </div>
    </div>
  );
}
