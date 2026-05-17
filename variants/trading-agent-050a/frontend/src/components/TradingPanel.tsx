import React, { useEffect, useState, useCallback } from 'react';
import { Play, Square, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  getStrategies, getTradingStatus, startTrading, stopTrading,
  Strategy, TradingStatus,
} from '../api';

const TradingPanel: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const [symbol, setSymbol] = useState('AAPL');
  const [selectedStrategy, setSelectedStrategy] = useState('sma_crossover');
  const [capital, setCapital] = useState(100000);
  const [tradeSize, setTradeSize] = useState(0.1);
  const [stopLoss, setStopLoss] = useState(0.05);
  const [takeProfit, setTakeProfit] = useState(0.10);

  const fetchStatus = useCallback(async () => {
    try {
      const [stratRes, statusRes] = await Promise.all([
        getStrategies(),
        getTradingStatus(),
      ]);
      setStrategies(stratRes.data);
      setStatus(statusRes.data);
    } catch (err) {
      console.error('Failed to fetch trading data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(async () => {
      try {
        const res = await getTradingStatus();
        setStatus(res.data);
      } catch {}
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startTrading({
        symbol: symbol.toUpperCase(),
        strategy: selectedStrategy,
        initial_capital: capital,
        trade_size_pct: tradeSize,
        stop_loss_pct: stopLoss,
        take_profit_pct: takeProfit,
      });
      await fetchStatus();
    } catch (err) {
      console.error('Failed to start trading:', err);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    try {
      await stopTrading();
      await fetchStatus();
    } catch (err) {
      console.error('Failed to stop trading:', err);
    }
  };

  if (loading) {
    return <div className="loading"><div className="spinner" />Loading...</div>;
  }

  const isRunning = status?.is_running || false;

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Play size={16} />
              Paper Trading Configuration
            </span>
            <span className={`badge ${isRunning ? 'badge-running' : 'badge-stopped'}`}>
              {isRunning ? 'LIVE' : 'STOPPED'}
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Symbol</label>
            <input
              type="text"
              className="form-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              disabled={isRunning}
              placeholder="e.g. AAPL, MSFT, TSLA"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Strategy / Model</label>
            <select
              className="form-select"
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              disabled={isRunning}
            >
              {strategies.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Initial Capital ($)</label>
              <input
                type="number"
                className="form-input"
                value={capital}
                onChange={(e) => setCapital(Number(e.target.value))}
                disabled={isRunning}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Trade Size (%)</label>
              <input
                type="number"
                className="form-input"
                value={tradeSize * 100}
                onChange={(e) => setTradeSize(Number(e.target.value) / 100)}
                disabled={isRunning}
                step={1}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Stop Loss (%)</label>
              <input
                type="number"
                className="form-input"
                value={stopLoss * 100}
                onChange={(e) => setStopLoss(Number(e.target.value) / 100)}
                disabled={isRunning}
                step={1}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Take Profit (%)</label>
              <input
                type="number"
                className="form-input"
                value={takeProfit * 100}
                onChange={(e) => setTakeProfit(Number(e.target.value) / 100)}
                disabled={isRunning}
                step={1}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {!isRunning ? (
              <button
                className="btn btn-success"
                onClick={handleStart}
                disabled={starting || !symbol}
              >
                {starting ? (
                  <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} /> Starting...</>
                ) : (
                  <><Play size={14} /> Start Paper Trading</>
                )}
              </button>
            ) : (
              <button className="btn btn-danger" onClick={handleStop}>
                <Square size={14} /> Stop Trading
              </button>
            )}
            <button className="btn btn-outline" onClick={fetchStatus}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 8, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <AlertTriangle size={14} style={{ color: 'var(--yellow)', marginTop: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Paper trading uses real market data with virtual money. No real trades are executed.
            </span>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Select Strategy / Model</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {strategies.map(s => (
                <div
                  key={s.id}
                  className={`strategy-card ${selectedStrategy === s.id ? 'selected' : ''}`}
                  onClick={() => !isRunning && setSelectedStrategy(s.id)}
                  style={{ opacity: isRunning ? 0.6 : 1 }}
                >
                  <h3>{s.name}</h3>
                  <p>{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isRunning && status && (
        <div className="section">
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <div className="stat-card">
              <div className="stat-label">Current Price</div>
              <div className="stat-value">${status.current_price?.toFixed(2) || '0.00'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Portfolio Value</div>
              <div className="stat-value">
                ${status.portfolio.total_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Unrealized P&L</div>
              <div className={`stat-value ${status.portfolio.unrealized_pnl >= 0 ? 'positive' : 'negative'}`}>
                {status.portfolio.unrealized_pnl >= 0 ? '+' : ''}${status.portfolio.unrealized_pnl.toFixed(2)}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Realized P&L</div>
              <div className={`stat-value ${status.portfolio.realized_pnl >= 0 ? 'positive' : 'negative'}`}>
                {status.portfolio.realized_pnl >= 0 ? '+' : ''}${status.portfolio.realized_pnl.toFixed(2)}
              </div>
            </div>
          </div>

          {status.signals && Object.keys(status.signals).length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Current Signal</span>
              </div>
              <div className={`signal-indicator ${status.signals.action}`}>
                {status.signals.action === 'buy' ? '▲ BUY' :
                 status.signals.action === 'sell' ? '▼ SELL' : '● HOLD'}
                {' '}Signal at ${status.signals.price}
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {Object.entries(status.signals)
                  .filter(([k]) => !['action', 'price', 'strategy', 'sub_signals'].includes(k))
                  .map(([key, value]) => (
                    <div key={key} style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{key.replace(/_/g, ' ').toUpperCase()}: </span>
                      <span style={{ fontWeight: 600 }}>{typeof value === 'number' ? value.toFixed(2) : String(value)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {status.recent_trades.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Trade History ({status.recent_trades.length} trades)</span>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Price</th>
                      <th>Qty</th>
                      <th>P&L</th>
                      <th>Portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.recent_trades.slice().reverse().map((t, i) => (
                      <tr key={i}>
                        <td>{new Date(t.timestamp).toLocaleString()}</td>
                        <td><span className={`badge badge-${t.action}`}>{t.action.toUpperCase()}</span></td>
                        <td>${t.price.toFixed(2)}</td>
                        <td>{t.quantity.toFixed(4)}</td>
                        <td style={{ color: t.pnl > 0 ? 'var(--green)' : t.pnl < 0 ? 'var(--red)' : 'inherit' }}>
                          {t.pnl !== 0 ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '-'}
                        </td>
                        <td>${t.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TradingPanel;
