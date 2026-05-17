import React, { useEffect, useState, useCallback } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Activity,
  RefreshCw,
} from 'lucide-react';
import { getTradingStatus, getWatchlist, getMarketData, Quote, TradingStatus, MarketDataPoint } from '../api';

const Dashboard: React.FC = () => {
  const [status, setStatus] = useState<TradingStatus | null>(null);
  const [watchlist, setWatchlist] = useState<Quote[]>([]);
  const [chartData, setChartData] = useState<MarketDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState('SPY');

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, watchlistRes, chartRes] = await Promise.all([
        getTradingStatus(),
        getWatchlist(),
        getMarketData(selectedSymbol, '3mo'),
      ]);
      setStatus(statusRes.data);
      setWatchlist(watchlistRes.data);
      setChartData(chartRes.data.data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading dashboard...
      </div>
    );
  }

  const portfolio = status?.portfolio;
  const totalPnl = (portfolio?.realized_pnl || 0) + (portfolio?.unrealized_pnl || 0);
  const returnPct = portfolio?.total_value && status?.config?.initial_capital
    ? ((portfolio.total_value - status.config.initial_capital) / status.config.initial_capital * 100)
    : 0;

  return (
    <div>
      <div className="section">
        <div className="grid-4">
          <div className="stat-card">
            <div className="stat-label">Portfolio Value</div>
            <div className="stat-value">
              ${(portfolio?.total_value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className={`stat-change ${returnPct >= 0 ? 'positive' : 'negative'}`}>
              {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(2)}% return
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total P&L</div>
            <div className={`stat-value ${totalPnl >= 0 ? 'positive' : 'negative'}`}>
              {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className="stat-change">
              Realized: ${(portfolio?.realized_pnl || 0).toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Cash Available</div>
            <div className="stat-value">
              ${(portfolio?.cash || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Trading Status</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              <span className={`badge ${status?.is_running ? 'badge-running' : 'badge-stopped'}`}>
                {status?.is_running ? 'RUNNING' : 'STOPPED'}
              </span>
            </div>
            {status?.is_running && (
              <div className="stat-change">
                {status.strategy?.replace('_', ' ').toUpperCase()} on {status.symbol}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Activity size={16} />
              Market Overview ({selectedSymbol})
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['SPY', 'AAPL', 'MSFT', 'TSLA'].map(sym => (
                <button
                  key={sym}
                  className={`btn btn-outline ${selectedSymbol === sym ? 'btn-primary' : ''}`}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                  onClick={() => setSelectedSymbol(sym)}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9aa0b2', fontSize: 11 }}
                tickFormatter={(v) => v.slice(5)}
              />
              <YAxis
                tick={{ fill: '#9aa0b2', fontSize: 11 }}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{
                  background: '#1e2130',
                  border: '1px solid #2d3148',
                  borderRadius: 8,
                  color: '#e8eaed',
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke="#6366f1"
                fill="url(#colorPrice)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <DollarSign size={16} />
              Watchlist
            </span>
            <button className="btn btn-outline" style={{ padding: '4px 8px' }} onClick={fetchData}>
              <RefreshCw size={14} />
            </button>
          </div>
          <div>
            {watchlist.map((item) => (
              <div key={item.symbol} className="watchlist-item">
                <div>
                  <div className="watchlist-symbol">{item.symbol}</div>
                  <div className="watchlist-name">{item.name || item.symbol}</div>
                </div>
                <div className="watchlist-price">
                  <div className="price">${item.price.toFixed(2)}</div>
                  <div className={`stat-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
                    {item.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                    {' '}{item.change >= 0 ? '+' : ''}{item.change_pct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
            {watchlist.length === 0 && (
              <div className="empty-state">
                <p>No watchlist data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {status?.recent_trades && status.recent_trades.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Trades</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Symbol</th>
                  <th>Action</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>P&L</th>
                  <th>Portfolio Value</th>
                </tr>
              </thead>
              <tbody>
                {status.recent_trades.slice().reverse().map((trade, i) => (
                  <tr key={i}>
                    <td>{new Date(trade.timestamp).toLocaleString()}</td>
                    <td style={{ fontWeight: 600 }}>{trade.symbol}</td>
                    <td>
                      <span className={`badge badge-${trade.action}`}>
                        {trade.action.toUpperCase()}
                      </span>
                    </td>
                    <td>${trade.price.toFixed(2)}</td>
                    <td>{trade.quantity.toFixed(4)}</td>
                    <td className={trade.pnl >= 0 ? 'positive' : 'negative'} style={{ color: trade.pnl > 0 ? 'var(--green)' : trade.pnl < 0 ? 'var(--red)' : 'inherit' }}>
                      {trade.pnl !== 0 ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '-'}
                    </td>
                    <td>${trade.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
