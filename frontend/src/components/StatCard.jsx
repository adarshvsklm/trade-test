export default function StatCard({ label, value, sub, positive, negative, icon: Icon, accent }) {
  const valueColor =
    positive === true
      ? 'text-emerald-400'
      : positive === false
      ? 'text-rose-400'
      : 'text-white';

  return (
    <div className={`bg-dark-800 border rounded-xl p-4 flex flex-col gap-1 ${accent ? 'border-indigo-500/40' : 'border-white/5'}`}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</span>
        {Icon && <Icon size={14} className="text-slate-500" />}
      </div>
      <div className={`text-2xl font-bold font-mono ${valueColor}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
