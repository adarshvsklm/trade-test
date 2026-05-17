import React, { useEffect, useState } from 'react';
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from 'recharts';
import { LineChart as LineChartIcon, Search, TrendingUp, TrendingDown } from 'lucide-react';
import { getStrategies, getAnalysis, getQuote, Strategy, AnalysisResult, Quote } from '../api';

const INDICATOR_COLORS: Record<string, string> = {
  sma_short: '#f59e0b',
  sma_long: '#3b82f6',
  rsi: '#8b5cf6',
  macd: '#22c55e',
  macd_signal: '#ef4444',
  macd_histogram: '#6366f1',
  bb_upper: '#f59e0b',
  bb_middle: '#6366f1',
  bb_lower: '#f59e0b',
  bb_pct: '#3b82f6',
  close: '#e8eaed',
};

const AnalysisPanel: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [symbol, setSymbol] = useState('AAPL');
  const [strategy, setStrategy] = useState('sma_crossover');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getStrategies().then(res => setStrategies(res.data)).catch(console.error);
  }, []);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const [analysisRes, quoteRes] = await Promise.all([
        getAnalysis(symbol, strategy),
        getQuote(symbol),
      ]);
      setAnalysis(analysisRes.data);
      setQuote(quoteRes.data);
    } catch (err: any) {
      console.error('Analysis failed:', err);
      alert(err.response?.data?.detail || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const signal = analysis?.current_signal;
  const indicatorKeys = analysis?.indicator_data?.length
    ? Object.keys(analysis.indicator_data[0]).filter(k => k !== 'date' && k !== 'close')
    : [];

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">
            <LineChartIcon size={16} />
            Technical Analysis
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 120 }}>
            <label className="form-label">Symbol</label>
            <input
              type="text"
              className="form-input"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL"
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 180 }}>
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
          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={loading || !symbol}
            style={{ marginBottom: 0 }}
          >
            {loading ? (
              <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, margin: 0 }} /> Analyzing...</>
            ) : (
              <><Search size={14} /> Analyze</>
            )}
          </button>
        </div>
      </div>

      {quote && (
        <div className="grid-4" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-label">{quote.name || quote.symbol}</div>
            <div className="stat-value">${quote.price.toFixed(2)}</div>
            <div className={`stat-change ${quote.change >= 0 ? 'positive' : 'negative'}`}>
              {quote.change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {' '}{quote.change >= 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.change_pct.toFixed(2)}%)
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Day Range</div>
            <div className="stat-value" style={{ fontSize: 16 }}>
              ${quote.day_low?.toFixed(2)} - ${quote.day_high?.toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Volume</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {quote.volume ? (quote.volume / 1e6).toFixed(2) + 'M' : 'N/A'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Market Cap</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {quote.market_cap ? (quote.market_cap / 1e9).toFixed(1) + 'B' : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {signal && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Current Signal</span>
            <span className="card-title" style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
              {strategy.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <div className={`signal-indicator ${signal.action}`}>
            {signal.action === 'buy' ? '▲ BUY' :
             signal.action === 'sell' ? '▼ SELL' : '● HOLD'}
            {' '}at ${signal.price}
          </div>
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {Object.entries(signal)
              .filter(([k]) => !['action', 'price', 'strategy', 'sub_signals'].includes(k))
              .map(([key, value]) => (
                <div key={key} style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </div>
                </div>
              ))}
          </div>

          {signal.sub_signals && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                Sub-Strategy Signals
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                {Object.entries(signal.sub_signals).map(([name, sub]: [string, any]) => (
                  <div key={name} style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{name}</div>
                    <span className={`badge badge-${sub.action}`} style={{ fontSize: 10 }}>
                      {sub.action?.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {analysis?.indicator_data && analysis.indicator_data.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <LineChartIcon size={16} />
              Technical Indicators (60 Days)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={analysis.indicator_data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3148" />
              <XAxis dataKey="date" tick={{ fill: '#9aa0b2', fontSize: 10 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fill: '#9aa0b2', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#1e2130', border: '1px solid #2d3148', borderRadius: 8, color: '#e8eaed' }}
              />
              <Line type="monotone" dataKey="close" stroke="#e8eaed" strokeWidth={2} dot={false} name="Price" />
              {indicatorKeys.map(key => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={INDICATOR_COLORS[key] || '#888'}
                  strokeWidth={1.5}
                  dot={false}
                  name={key.replace(/_/g, ' ').toUpperCase()}
                  strokeDasharray={key.includes('signal') ? '5 5' : undefined}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{ marginTop: 12, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <div style={{ width: 12, height: 3, background: '#e8eaed', borderRadius: 2 }} />
              <span style={{ color: 'var(--text-secondary)' }}>Price</span>
            </div>
            {indicatorKeys.map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <div style={{ width: 12, height: 3, background: INDICATOR_COLORS[key] || '#888', borderRadius: 2 }} />
                <span style={{ color: 'var(--text-secondary)' }}>{key.replace(/_/g, ' ').toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!analysis && !loading && (
        <div className="card">
          <div className="empty-state">
            <Search size={40} style={{ marginBottom: 16, color: 'var(--text-muted)' }} />
            <h3>Analyze a Stock</h3>
            <p>Enter a symbol and select a strategy above to see technical analysis, indicators, and trading signals.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisPanel;
