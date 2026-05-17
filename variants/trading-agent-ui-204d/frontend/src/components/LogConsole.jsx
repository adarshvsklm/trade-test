import { useEffect, useRef } from 'react';

export default function LogConsole({ messages = [] }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  return (
    <div className="bg-dark-900 border border-white/5 rounded-xl p-3 h-48 overflow-y-auto font-mono text-xs">
      {messages.length === 0 ? (
        <span className="text-slate-600">Waiting for agent logs...</span>
      ) : (
        messages.map((m, i) => {
          const isError = m.toLowerCase().includes('error');
          const isBuy = m.includes('BUY');
          const isSell = m.includes('SELL');
          const color = isError
            ? 'text-rose-400'
            : isBuy
            ? 'text-emerald-400'
            : isSell
            ? 'text-amber-400'
            : 'text-slate-400';
          return (
            <div key={i} className={`${color} leading-5`}>
              {m}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
