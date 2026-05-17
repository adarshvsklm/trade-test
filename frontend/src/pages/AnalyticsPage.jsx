import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-700 border border-white/10 rounded-lg p-2 text-xs shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
        </div>
      ))}
    </div>
  );
};

export default function AnalyticsPage({ agentState }) {
  const trades = (agentState?.trades || []).filter((t) => t.action === 'SELL');

  const pnlByTrade = trades.map((t, i) => ({
    trade: `T${i + 1}`,
    pnl: t.pnl,
  }));

  const winning = trades.filter((t) => t.pnl > 0).length;
  const losing = trades.filter((t) => t.pnl <= 0).length;
  const pieData = [
    { name: 'Winning', value: winning },
    { name: 'Losing', value: losing },
  ];

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const avgPnl = trades.length > 0 ? totalPnl / trades.length : 0;
  const bestTrade = trades.reduce((best, t) => (t.pnl > best ? t.pnl : best), 0);
  const worstTrade = trades.reduce((worst, t) => (t.pnl < worst ? t.pnl : worst), 0);
  const winRate = trades.length > 0 ? (winning / trades.length) * 100 : 0;

  const equityHistory = agentState?.equity_history || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Analytics</h1>
        <p className="text-slate-500 text-sm mt-0.5">Deep dive into trading performance</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Closed Trades', value: trades.length, color: 'text-white' },
          { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, color: winRate >= 50 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'Total P&L', value: `${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'Avg Trade P&L', value: `${avgPnl >= 0 ? '+' : ''}$${avgPnl.toFixed(2)}`, color: avgPnl >= 0 ? 'text-emerald-400' : 'text-rose-400' },
          { label: 'Best Trade', value: `+$${bestTrade.toFixed(2)}`, color: 'text-emerald-400' },
          { label: 'Worst Trade', value: `$${worstTrade.toFixed(2)}`, color: 'text-rose-400' },
          { label: 'Winning Trades', value: winning, color: 'text-emerald-400' },
          { label: 'Losing Trades', value: losing, color: 'text-rose-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-dark-800 border border-white/5 rounded-xl p-4">
            <div className="text-slate-500 text-xs mb-1">{label}</div>
            <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P&L Per Trade Bar Chart */}
        <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">P&L Per Trade</div>
          {pnlByTrade.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pnlByTrade} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c2844" />
                <XAxis dataKey="trade" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fill: '#64748b', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="pnl"
                  name="P&L"
                  radius={[3, 3, 0, 0]}
                  fill="#6366f1"
                  label={false}
                >
                  {pnlByTrade.map((entry, index) => (
                    <Cell key={index} fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No trades yet</div>
          )}
        </div>

        {/* Win/Loss Pie */}
        <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Win / Loss Ratio</div>
          {trades.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={index === 0 ? '#10b981' : '#f43f5e'} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-500 text-sm">No trades yet</div>
          )}
        </div>
      </div>

      {/* Equity Progression */}
      {equityHistory.length > 0 && (
        <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Portfolio Equity Over Time</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={equityHistory.slice(-30).map((d, i) => ({
                t: i + 1,
                equity: d.equity,
              }))}
              margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2844" />
              <XAxis dataKey="t" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v.toLocaleString()}`}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="equity" name="Equity" fill="#6366f1" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Trade Details */}
      {trades.length > 0 && (
        <div className="bg-dark-800 border border-white/5 rounded-xl p-4">
          <div className="text-slate-400 text-xs uppercase tracking-wider mb-3">Closed Trade Details</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['#', 'Price', 'Shares', 'Value', 'P&L', 'Time'].map((h) => (
                    <th key={h} className="text-left text-slate-500 font-medium py-2 px-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                    <td className="py-2 px-3 font-mono">${t.price}</td>
                    <td className="py-2 px-3 font-mono">{t.shares}</td>
                    <td className="py-2 px-3 font-mono">${t.value}</td>
                    <td className={`py-2 px-3 font-mono font-semibold ${t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{t.timestamp ? new Date(t.timestamp).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
