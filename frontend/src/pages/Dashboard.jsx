import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart2, AlertCircle, RefreshCw } from 'lucide-react';
import StatCard from '../components/StatCard';
import EquityChart from '../components/EquityChart';
import PriceChart from '../components/PriceChart';
import Badge from '../components/Badge';
import { getMarketData, getTickerInfo } from '../utils/api';

const WATCHLIST = ['AAPL', 'TSLA', 'NVDA', 'SPY', 'BTC-USD'];

export default function Dashboard({ agentState }) {
  const [marketData, setMarketData] = useState([]);
  const [tickerInfo, setTickerInfo] = useState(null);
  const [watchPrices, setWatchPrices] = useState({});
  const [loading, setLoading] = useState(false);

  const symbol = agentState?.symbol || 'AAPL';

  useEffect(() => {
    loadData(symbol);
  }, [symbol]);

  const loadData = async (sym) => {
    setLoading(true);
    try {
      const [md, info] = await Promise.all([
        getMarketData(sym, '3mo', '1d'),
        getTickerInfo(sym),
      ]);
      setMarketData(md.data || []);
      setTickerInfo(info);
    } catch (_) {}
    setLoading(false);
  };

  const equity = agentState?.equity ?? agentState?.initial_capital ?? 10000;
  const pnl = agentState?.total_pnl ?? 0;
  const pnlPct = agentState?.total_pnl_pct ?? 0;
  const isUp = pnl >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Live portfolio overview</p>
        </div>
        <div className="flex items-center gap-3">
          {agentState?.running && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-sm font-medium">Live Trading</span>
            </div>
          )}
          <button
            onClick={() => loadData(symbol)}
            disabled={loading}
            className="p-2 rounded-lg bg-dark-700 hover:bg-dark-600 border border-white/5 text-slate-400 hover:text-white transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Portfolio Value"
          value={`$${Number(equity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`Initial: $${Number(agentState?.initial_capital ?? 10000).toLocaleString()}`}
          icon={DollarSign}
          accent
        />
        <StatCard
          label="Total P&L"
          value={`${isUp ? '+' : ''}$${Math.abs(pnl).toFixed(2)}`}
          sub={`${isUp ? '+' : ''}${pnlPct.toFixed(2)}%`}
          positive={isUp}
          negative={!isUp}
          icon={isUp ? TrendingUp : TrendingDown}
        />
        <StatCard
          label="Realized P&L"
          value={`$${Number(agentState?.realized_pnl ?? 0).toFixed(2)}`}
          sub="Closed positions"
          positive={(agentState?.realized_pnl ?? 0) >= 0}
          icon={BarChart2}
        />
        <StatCard
          label="Unrealized P&L"
          value={`$${Number(agentState?.unrealized_pnl ?? 0).toFixed(2)}`}
          sub="Open position"
          positive={(agentState?.unrealized_pnl ?? 0) >= 0}
          icon={Activity}
        />
      </div>

      {/* Agent Info + Ticker Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent Status */}
        <div className="bg-dark-800 border border-white/5 rounded-xl p-4 space-y-3">
          <div className="text-slate-400 text-xs uppercase tracking-wider">Agent Status</div>
          {agentState ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <Badge label={agentState.running ? 'Running' : 'Stopped'} variant={agentState.running ? 'running' : 'stopped'} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Symbol</span>
                <span className="text-white font-mono">{agentState.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Strategy</span>
                <span className="text-indigo-400 font-medium text-xs">{agentState.strategy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Price</span>
                <span className="text-white font-mono">${Number(agentState.last_price).toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Signal</span>
                <Badge
                  label={agentState.last_signal}
                  variant={agentState.last_signal?.toLowerCase() || 'hold'}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cash</span>
                <span className="text-white font-mono">${Number(agentState.cash).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Trades Done</span>
                <span className="text-white">{agentState.total_trades ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Win Rate</span>
                <span className="text-emerald-400">
                  {agentState.total_trades > 0
                    ? `${Math.round((agentState.winning_trades / agentState.total_trades) * 100)}%`
                    : '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <AlertCircle size={14} /> No agent running. Go to Trade tab to start.
            </div>
          )}
        </div>

        {/* Ticker Info */}
        <div className="bg-dark-800 border border-white/5 rounded-xl p-4 space-y-3 col-span-2">
          <div className="text-slate-400 text-xs uppercase tracking-wider">
            {symbol} — Market Info
          </div>
          {tickerInfo ? (
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {[
                ['Name', tickerInfo.name],
                ['Sector', tickerInfo.sector],
                ['Current Price', `$${Number(tickerInfo.current_price).toFixed(4)}`],
                ['Market Cap', tickerInfo.market_cap ? `$${(tickerInfo.market_cap / 1e9).toFixed(2)}B` : 'N/A'],
                ['P/E Ratio', tickerInfo.pe_ratio ? Number(tickerInfo.pe_ratio).toFixed(2) : 'N/A'],
                ['52W High', tickerInfo['52w_high'] ? `$${Number(tickerInfo['52w_high']).toFixed(2)}` : 'N/A'],
                ['52W Low', tickerInfo['52w_low'] ? `$${Number(tickerInfo['52w_low']).toFixed(2)}` : 'N/A'],
                ['Avg Volume', tickerInfo.avg_volume ? `${(tickerInfo.avg_volume / 1e6).toFixed(1)}M` : 'N/A'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-white/5 py-1.5">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-white font-mono text-xs">{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-sm">Loading ticker info...</div>
          )}
        </div>
      </div>

      {/* Equity Chart */}
      {agentState && (
        <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Equity Curve</div>
          <EquityChart data={agentState.equity_history} initialCapital={agentState.initial_capital} />
        </div>
      )}

      {/* Price Chart */}
      <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-slate-400 text-xs uppercase tracking-wider">{symbol} Price (3 Months)</div>
        </div>
        <PriceChart data={marketData} />
      </div>

      {/* Open Position */}
      {agentState?.position && (
        <div className="bg-dark-800 border border-indigo-500/30 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Open Position</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ['Symbol', agentState.position.symbol],
              ['Shares', agentState.position.shares],
              ['Entry Price', `$${agentState.position.entry_price}`],
              ['Current Price', `$${agentState.position.current_price}`],
              ['Market Value', `$${agentState.position.market_value}`],
              ['Unrealized P&L', `$${agentState.position.unrealized_pnl}`, agentState.position.unrealized_pnl >= 0 ? 'pos' : 'neg'],
              ['P&L %', `${agentState.position.unrealized_pnl_pct}%`, agentState.position.unrealized_pnl_pct >= 0 ? 'pos' : 'neg'],
              ['Entry Time', new Date(agentState.position.entry_time).toLocaleString()],
            ].map(([k, v, highlight]) => (
              <div key={k}>
                <div className="text-slate-500 text-xs">{k}</div>
                <div className={`font-mono text-sm font-semibold ${highlight === 'pos' ? 'text-emerald-400' : highlight === 'neg' ? 'text-rose-400' : 'text-white'}`}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
