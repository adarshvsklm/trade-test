import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-700 border border-white/10 rounded-lg p-3 shadow-xl text-xs">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex gap-2 items-center">
          <span style={{ color: p.color }}>{p.name}:</span>
          <span className="text-white font-mono">
            {p.name === 'Volume' ? Number(p.value).toLocaleString() : `$${Number(p.value).toFixed(4)}`}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function PriceChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Loading market data...
      </div>
    );
  }

  const sampled = data.length > 90 ? data.slice(-90) : data;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={sampled} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c2844" />
        <XAxis
          dataKey="date"
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => v?.slice(5)}
        />
        <YAxis
          yAxisId="price"
          orientation="right"
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v}`}
          width={60}
        />
        <YAxis
          yAxisId="vol"
          orientation="left"
          tick={{ fill: '#64748b', fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : v)}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
        <Bar yAxisId="vol" dataKey="volume" name="Volume" fill="#1c2844" opacity={0.6} />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="close"
          name="Close"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="high"
          name="High"
          stroke="#10b981"
          strokeWidth={1}
          dot={false}
          strokeDasharray="3 3"
        />
        <Line
          yAxisId="price"
          type="monotone"
          dataKey="low"
          name="Low"
          stroke="#f43f5e"
          strokeWidth={1}
          dot={false}
          strokeDasharray="3 3"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
