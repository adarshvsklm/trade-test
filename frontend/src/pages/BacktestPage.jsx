import { useState, useEffect } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import BacktestResultCard from '../components/BacktestResultCard';
import TradeTable from '../components/TradeTable';
import { getStrategies, runBacktest } from '../utils/api';

const PRESET_RANGES = [
  { label: '1 Year', start: () => offset(-365), end: () => today() },
  { label: '2 Years', start: () => offset(-730), end: () => today() },
  { label: '3 Years', start: () => offset(-1095), end: () => today() },
  { label: '5 Years', start: () => offset(-1825), end: () => today() },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}
function offset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const INTERVALS = [
  { label: 'Daily', value: '1d' },
  { label: 'Weekly', value: '1wk' },
];

const POPULAR_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'SPY', 'QQQ', 'BTC-USD'];

export default function BacktestPage() {
  const [strategies, setStrategies] = useState([]);
  const [symbol, setSymbol] = useState('AAPL');
  const [strategyId, setStrategyId] = useState('sma_crossover');
  const [startDate, setStartDate] = useState(offset(-365));
  const [endDate, setEndDate] = useState(today());
  const [capital, setCapital] = useState(10000);
  const [interval, setInterval] = useState('1d');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [compareResults, setCompareResults] = useState([]);

  useEffect(() => {
    getStrategies().then(setStrategies).catch(() => {});
  }, []);

  const handleRun = async () => {
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await runBacktest({
        symbol: symbol.toUpperCase(),
        strategy_id: strategyId,
        start_date: startDate,
        end_date: endDate,
        initial_capital: Number(capital),
        interval,
      });
      setResult(res);
    } catch (e) {
      setError(e.response?.data?.detail || 'Backtest failed. Check symbol and date range.');
    }
    setLoading(false);
  };

  const handleCompareAll = async () => {
    setError('');
    setLoading(true);
    setCompareResults([]);
    const results = [];
    for (const s of strategies) {
      try {
        const res = await runBacktest({
          symbol: symbol.toUpperCase(),
          strategy_id: s.id,
          start_date: startDate,
          end_date: endDate,
          initial_capital: Number(capital),
          interval,
        });
        results.push({ ...res, strategy_id: s.id });
      } catch (_) {}
    }
    setCompareResults(results);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Backtesting</h1>
        <p className="text-slate-500 text-sm mt-0.5">Test strategies against historical data</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <div className="bg-dark-800 border border-white/5 rounded-xl p-5 space-y-5">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <FlaskConical size={15} />
            Backtest Setup
          </div>

          {/* Symbol */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1.5">Symbol</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mb-2"
            />
            <div className="flex flex-wrap gap-1">
              {POPULAR_SYMBOLS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={`text-xs px-2 py-0.5 rounded border transition-all ${
                    symbol === s
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-dark-700 border-white/10 text-slate-400 hover:text-white'
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
            <select
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1.5">Date Range</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {PRESET_RANGES.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setStartDate(p.start()); setEndDate(p.end()); }}
                  className="text-xs px-2 py-0.5 rounded border bg-dark-700 border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-slate-500 text-xs">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mt-0.5"
                />
              </div>
              <div className="flex-1">
                <label className="text-slate-500 text-xs">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500 mt-0.5"
                />
              </div>
            </div>
          </div>

          {/* Capital */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1.5">Initial Capital ($)</label>
            <input
              type="number"
              value={capital}
              onChange={(e) => setCapital(e.target.value)}
              min={100}
              className="w-full bg-dark-700 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Interval */}
          <div>
            <label className="block text-slate-400 text-xs uppercase tracking-wider mb-1.5">Data Interval</label>
            <div className="flex gap-2">
              {INTERVALS.map((i) => (
                <button
                  key={i.value}
                  onClick={() => setInterval(i.value)}
                  className={`flex-1 text-sm py-2 rounded-lg border transition-all ${
                    interval === i.value
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-dark-700 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg p-3">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button
              onClick={handleRun}
              disabled={loading}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
              {loading ? 'Running...' : 'Run Backtest'}
            </button>
            <button
              onClick={handleCompareAll}
              disabled={loading || strategies.length === 0}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-dark-600 hover:bg-dark-500 border border-white/10 text-slate-300 font-medium text-sm transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : null}
              Compare All Strategies
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="lg:col-span-2 space-y-4">
          {loading && (
            <div className="bg-dark-800 border border-white/5 rounded-xl p-12 flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={32} className="animate-spin text-indigo-400 mx-auto mb-3" />
                <div className="text-slate-400 text-sm">Running backtest...</div>
              </div>
            </div>
          )}

          {result && !loading && (
            <>
              <div className="bg-dark-800 border border-white/5 rounded-xl p-5">
                <div className="text-slate-400 text-xs uppercase tracking-wider mb-4">
                  Results — {result.strategy} on {symbol} ({startDate} → {endDate})
                </div>
                <BacktestResultCard result={result} />
              </div>

              {result.trades?.length > 0 && (
                <div className="bg-dark-800 border border-white/5 rounded-xl p-5">
                  <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">
                    Trade Log (last {result.trades.length})
                  </div>
                  <TradeTable trades={result.trades} />
                </div>
              )}
            </>
          )}

          {/* Compare All Results */}
          {compareResults.length > 0 && !loading && (
            <div className="bg-dark-800 border border-white/5 rounded-xl p-5">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-4">Strategy Comparison</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Strategy', 'Return', 'Buy & Hold', 'Trades', 'Win Rate', 'Sharpe', 'Max DD', 'Final Equity'].map((h) => (
                        <th key={h} className="text-left text-slate-500 font-medium py-2 px-3 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareResults
                      .sort((a, b) => b.total_return_pct - a.total_return_pct)
                      .map((r, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/2">
                          <td className="py-2 px-3 text-white font-medium">{r.strategy}</td>
                          <td className={`py-2 px-3 font-mono font-semibold ${r.total_return_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {r.total_return_pct >= 0 ? '+' : ''}{r.total_return_pct}%
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-400">{r.buy_hold_return_pct}%</td>
                          <td className="py-2 px-3 text-slate-300">{r.total_trades}</td>
                          <td className={`py-2 px-3 font-mono ${r.win_rate_pct >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {r.win_rate_pct}%
                          </td>
                          <td className={`py-2 px-3 font-mono ${r.sharpe_ratio > 1 ? 'text-emerald-400' : r.sharpe_ratio < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {r.sharpe_ratio}
                          </td>
                          <td className="py-2 px-3 font-mono text-rose-400">-{r.max_drawdown_pct}%</td>
                          <td className={`py-2 px-3 font-mono ${r.final_equity >= r.initial_capital ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ${Number(r.final_equity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!result && compareResults.length === 0 && !loading && (
            <div className="bg-dark-800 border border-white/5 rounded-xl p-12 flex items-center justify-center">
              <div className="text-center">
                <FlaskConical size={40} className="text-slate-600 mx-auto mb-3" />
                <div className="text-slate-400 text-sm">Configure and run a backtest to see results</div>
                <div className="text-slate-600 text-xs mt-1">Select a symbol, strategy, and date range</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
