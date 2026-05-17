import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  name?: string;
  market_cap?: number;
  volume?: number;
  day_high?: number;
  day_low?: number;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
}

export interface Trade {
  timestamp: string;
  symbol: string;
  action: 'buy' | 'sell' | 'hold';
  price: number;
  quantity: number;
  strategy: string;
  pnl: number;
  portfolio_value: number;
}

export interface Portfolio {
  cash: number;
  holdings: Record<string, number>;
  total_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
}

export interface TradingStatus {
  is_running: boolean;
  symbol: string;
  strategy: string;
  portfolio: Portfolio;
  recent_trades: Trade[];
  signals: Record<string, any>;
  current_price: number;
  config?: {
    initial_capital: number;
    trade_size_pct: number;
    stop_loss_pct: number;
    take_profit_pct: number;
  };
}

export interface BacktestRequest {
  symbol: string;
  strategy: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  trade_size_pct: number;
}

export interface BacktestResult {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  final_portfolio_value: number;
  initial_capital: number;
  trades: Trade[];
  equity_curve: { date: string; value: number; price: number }[];
  strategy: string;
  symbol: string;
}

export interface MarketDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AnalysisResult {
  symbol: string;
  strategy: string;
  current_signal: Record<string, any>;
  indicator_data: Record<string, any>[];
}

export const getStrategies = () => api.get<Strategy[]>('/api/strategies');
export const getQuote = (symbol: string) => api.get<Quote>(`/api/quote/${symbol}`);
export const getMarketData = (symbol: string, period: string = '6mo') =>
  api.get<{ symbol: string; data: MarketDataPoint[] }>(`/api/market-data/${symbol}?period=${period}`);
export const getAnalysis = (symbol: string, strategy: string) =>
  api.get<AnalysisResult>(`/api/analysis/${symbol}?strategy=${strategy}`);
export const startTrading = (config: {
  symbol: string;
  strategy: string;
  initial_capital: number;
  trade_size_pct: number;
  stop_loss_pct: number;
  take_profit_pct: number;
}) => api.post('/api/trading/start', config);
export const stopTrading = () => api.post('/api/trading/stop');
export const getTradingStatus = () => api.get<TradingStatus>('/api/trading/status');
export const runBacktest = (request: BacktestRequest) =>
  api.post<BacktestResult>('/api/backtest', request);
export const getWatchlist = () => api.get<Quote[]>('/api/watchlist');
