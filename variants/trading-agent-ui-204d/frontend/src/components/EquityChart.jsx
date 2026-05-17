import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-700 border border-white/10 rounded-lg p-3 shadow-xl text-xs">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex gap-2">
          <span style={{ color: p.color }}>{p.name}:</span>
          <span className="text-white font-mono">${Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export default function EquityChart({ data, initialCapital }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        No equity data yet — start trading to see your curve.
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    time: d.timestamp
      ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.date,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c2844" />
        <XAxis dataKey="time" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v.toLocaleString()}`}
          width={70}
        />
        <Tooltip content={<CustomTooltip />} />
        {initialCapital && (
          <ReferenceLine y={initialCapital} stroke="#475569" strokeDasharray="4 4" label="" />
        )}
        <Area
          type="monotone"
          dataKey="equity"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#equityGrad)"
          name="Equity"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
