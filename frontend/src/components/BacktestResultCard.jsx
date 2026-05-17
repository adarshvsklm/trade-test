import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';

function MetricRow({ label, value, highlight }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className={`font-mono text-sm font-semibold ${highlight === 'pos' ? 'text-emerald-400' : highlight === 'neg' ? 'text-rose-400' : 'text-white'}`}>
        {value}
      </span>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-700 border border-white/10 rounded-lg p-2 text-xs shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: ${Number(p.value).toFixed(2)}
        </div>
      ))}
    </div>
  );
};

export default function BacktestResultCard({ result }) {
  if (!result) return null;

  const isPositive = result.total_return_pct >= 0;
  const beatsBuyHold = result.total_return_pct >= result.buy_hold_return_pct;

  const equity = result.equity_curve || [];
  const sampled = equity.length > 200 ? equity.filter((_, i) => i % Math.ceil(equity.length / 200) === 0) : equity;
  const formatted = sampled.map((d) => ({
    ...d,
    date: d.date?.slice(5) ?? d.timestamp?.slice(0, 10).slice(5),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className={`text-3xl font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isPositive ? '+' : ''}{result.total_return_pct}%
        </div>
        <div className="text-slate-500 text-sm">Total Return</div>
        {beatsBuyHold && (
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded-full font-semibold">
            Beat Buy & Hold
          </span>
        )}
      </div>

      {/* Equity Curve */}
      <div>
        <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Equity Curve</div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="btGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2844" />
            <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toLocaleString()}`}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={result.initial_capital} stroke="#475569" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="equity"
              stroke={isPositive ? '#10b981' : '#f43f5e'}
              strokeWidth={2}
              fill="url(#btGrad)"
              name="Equity"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Performance</div>
          <MetricRow label="Strategy Return" value={`${result.total_return_pct}%`} highlight={isPositive ? 'pos' : 'neg'} />
          <MetricRow label="Buy & Hold Return" value={`${result.buy_hold_return_pct}%`} />
          <MetricRow label="Initial Capital" value={`$${result.initial_capital?.toLocaleString()}`} />
          <MetricRow label="Final Equity" value={`$${result.final_equity?.toLocaleString()}`} />
          <MetricRow label="Max Drawdown" value={`-${result.max_drawdown_pct}%`} highlight="neg" />
          <MetricRow label="Sharpe Ratio" value={result.sharpe_ratio} highlight={result.sharpe_ratio > 1 ? 'pos' : result.sharpe_ratio < 0 ? 'neg' : ''} />
        </div>
        <div>
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-2">Trade Stats</div>
          <MetricRow label="Total Trades" value={result.total_trades} />
          <MetricRow label="Winning Trades" value={result.winning_trades} highlight="pos" />
          <MetricRow label="Losing Trades" value={result.losing_trades} highlight="neg" />
          <MetricRow label="Win Rate" value={`${result.win_rate_pct}%`} highlight={result.win_rate_pct >= 50 ? 'pos' : 'neg'} />
          <MetricRow label="Avg Profit" value={result.avg_profit ? `$${result.avg_profit}` : '—'} highlight="pos" />
          <MetricRow label="Avg Loss" value={result.avg_loss ? `$${result.avg_loss}` : '—'} highlight="neg" />
          <MetricRow label="Profit Factor" value={result.profit_factor} highlight={result.profit_factor >= 1 ? 'pos' : 'neg'} />
        </div>
      </div>
    </div>
  );
}
