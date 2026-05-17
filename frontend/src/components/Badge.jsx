export default function Badge({ label, variant = 'neutral' }) {
  const variants = {
    buy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    sell: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    hold: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    neutral: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    running: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    stopped: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${variants[variant] || variants.neutral}`}>
      {label}
    </span>
  );
}
