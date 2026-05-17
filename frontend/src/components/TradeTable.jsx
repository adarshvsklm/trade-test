import Badge from './Badge';

export default function TradeTable({ trades = [] }) {
  if (!trades.length) {
    return (
      <div className="text-slate-500 text-sm text-center py-8">
        No trades executed yet.
      </div>
    );
  }

  const sorted = [...trades].reverse();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-white/5">
            {['#', 'Action', 'Symbol', 'Price', 'Shares', 'Value', 'PnL', 'Time'].map((h) => (
              <th key={h} className="text-left text-slate-500 font-medium py-2 px-3 uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t, i) => {
            const isBuy = t.action === 'BUY';
            return (
              <tr key={i} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                <td className="py-2 px-3 text-slate-500 font-mono">{t.id ?? sorted.length - i}</td>
                <td className="py-2 px-3">
                  <Badge label={t.action} variant={isBuy ? 'buy' : 'sell'} />
                </td>
                <td className="py-2 px-3 font-mono text-slate-300">{t.symbol}</td>
                <td className="py-2 px-3 font-mono text-white">${Number(t.price).toFixed(4)}</td>
                <td className="py-2 px-3 font-mono text-slate-300">{Number(t.shares).toFixed(4)}</td>
                <td className="py-2 px-3 font-mono text-slate-300">${Number(t.value).toFixed(2)}</td>
                <td className={`py-2 px-3 font-mono font-semibold ${
                  t.pnl > 0 ? 'text-emerald-400' : t.pnl < 0 ? 'text-rose-400' : 'text-slate-500'
                }`}>
                  {t.action === 'SELL'
                    ? `${t.pnl > 0 ? '+' : ''}$${Number(t.pnl).toFixed(2)}`
                    : '—'}
                </td>
                <td className="py-2 px-3 text-slate-500">
                  {t.timestamp ? new Date(t.timestamp).toLocaleString() : t.date}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
