import React, { useEffect, useState } from 'react';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, ReferenceLine,
  ComposedChart,
} from 'recharts';
import { FlaskConical, TrendingUp, BarChart3, Target } from 'lucide-react';
import { getStrategies, runBacktest, Strategy, BacktestResult } from '../api';

const BacktestPanel: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const [symbol, setSymbol] = useState('AAPL');
  const [strategy, setStrategy] = useState('sma_crossover');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2025-01-01');
  const [capital, setCapital] = useState(100000);
  const [tradeSize, setTradeSize] = useState(0.1);

  useEffect(() => {
    getStrategies().then(res => setStrategies(res.data)).catch(console.error);
  }, []);

  const handleBacktest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await runBacktest({
        symbol: symbol.toUpperCase(),
        strategy,
        start_date: startDate,
        end_date: endDate,
        initial_capital: capital,
        trade_size_pct: tradeSize,
      });
      setResult(res.data);
    } catch (err: any) {
      console.error('Backtest failed:', err);
      alert(err.response?.data?.detail || 'Backtest failed');
    } finally {
      setLoading(false);
    }
  };

  const winRate = result && (result.winning_trades + result.losing_trades) > 0
    ? (result.winning_trades / (result.winning_trades + result.losing_trades) * 100)
    : 0;

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">
            <FlaskConical size={16} />
            Backtest Configuration
          </span>
        </div>

        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Symbol</label>
            <input
              type="text"
              className="form-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Strategy</label>
            <select
              className="form-select"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value)}
            >
              {strategies.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Initial Capital ($)</label>
            <input
              type="number"
              className="form-input"
              value={capital}
              onChange={(e) => setCapital(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Trade Size (%)</label>
            <input
              type="number"
              className="form-input"
              value={tradeSize * 100}
              onChange={(e) => setTradeSize(Number(e.target.value) / 100)}
              step={1}
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleBacktest}
          disabled={loading || !symbol}
        >
          {loading ? (
            <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} /> Running Backtest...</>
          ) : (
            <><FlaskConical size={14} /> Run Backtest</>
          )}
        </button>
      </div>

      {result && (
        <>
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Total Return</div>
              <div className={`stat-value ${result.total_return_pct >= 0 ? 'positive' : 'negative'}`}>
                {result.total_return_pct >= 0 ? '+' : ''}{result.total_return_pct.toFixed(2)}%
              </div>
              <div className="stat-change">
                ${result.initial_capital.toLocaleString()} → ${result.final_portfolio_value.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Win Rate</div>
              <div className={`stat-value ${winRate >= 50 ? 'positive' : 'negative'}`}>
                {winRate.toFixed(1)}%
              </div>
              <div className="stat-change">
                {result.winning_trades}W / {result.losing_trades}L of {result.total_trades} trades
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Max Drawdown</div>
              <div className="stat-value negative">
                -{result.max_drawdown_pct.toFixed(2)}%
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Sharpe Ratio</div>
              <div className={`stat-value ${result.sharpe_ratio >= 1 ? 'positive' : result.sharpe_ratio >= 0 ? '' : 'negative'}`}>
                {result.sharpe_ratio.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 24 }}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <TrendingUp size={16} />
                  Equity Curve
                </span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={result.equity_curve}>
                  <defs>
                    <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={result.total_return_pct >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={result.total_return_pct >= 0 ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
                  <XAxis dataKey="date" tick={{ fill: '#9aa0b2', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fill: '#9aa0b2', fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, color: '#e8eaed' }}
                    formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Portfolio']}
                  />
                  <ReferenceLine y={result.initial_capital} stroke="#6b7280" strokeDasharray="3 3" />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={result.total_return_pct >= 0 ? '#22c55e' : '#ef4444'}
                    fill="url(#colorEquity)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  <BarChart3 size={16} />
                  Price & Equity
                </span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={result.equity_curve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
                  <XAxis dataKey="date" tick={{ fill: '#9aa0b2', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
                  <YAxis yAxisId="left" tick={{ fill: '#9aa0b2', fontSize: 11 }} domain={['auto', 'auto']} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9aa0b2', fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, color: '#e8eaed' }}
                  />
                  <Line yAxisId="left" type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={2} dot={false} name="Price" />
                  <Line yAxisId="right" type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={false} name="Portfolio" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">
                <Target size={16} />
                Trade Log ({result.total_trades} trades)
              </span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Action</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>P&L</th>
                    <th>Portfolio Value</th>
                  </tr>
                </thead>
                <tbody>
                  {result.trades.map((trade, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{new Date(trade.timestamp).toLocaleDateString()}</td>
                      <td>
                        <span className={`badge badge-${trade.action}`}>
                          {trade.action.toUpperCase()}
                        </span>
                      </td>
                      <td>${trade.price.toFixed(2)}</td>
                      <td>{trade.quantity.toFixed(4)}</td>
                      <td style={{ color: trade.pnl > 0 ? 'var(--green)' : trade.pnl < 0 ? 'var(--red)' : 'inherit', fontWeight: trade.pnl !== 0 ? 600 : 400 }}>
                        {trade.pnl !== 0 ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '-'}
                      </td>
                      <td>${trade.portfolio_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!result && !loading && (
        <div className="card">
          <div className="empty-state">
            <FlaskConical size={40} style={{ marginBottom: 16, color: 'var(--text-muted)' }} />
            <h3>Run a Backtest</h3>
            <p>Configure your parameters above and click "Run Backtest" to see historical performance of your chosen strategy.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BacktestPanel;
