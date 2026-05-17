import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE || "";
export const api = axios.create({ baseURL, timeout: 30_000 });

export interface StrategyParam {
  name: string;
  type: "int" | "float";
  default: number;
  min: number;
  max: number;
  description: string;
}

export interface StrategyInfo {
  key: string;
  name: string;
  description: string;
  params: StrategyParam[];
}

export interface SymbolInfo {
  symbol: string;
  name: string;
}

export interface Trade {
  entry_time: string;
  exit_time: string;
  side: "long" | "short";
  entry_price: number;
  exit_price: number;
  pnl: number;
  pnl_pct: number;
  bars_held: number;
}

export interface BacktestResponse {
  symbol: string;
  strategy: string;
  params: Record<string, number>;
  initial_capital: number;
  final_equity: number;
  total_return_pct: number;
  annualized_return_pct: number;
  annualized_vol_pct: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown_pct: number;
  win_rate_pct: number;
  profit_factor: number;
  num_trades: number;
  avg_trade_pct: number;
  buy_hold_return_pct: number;
  equity_curve: { t: string; equity: number }[];
  price_series: { t: string; close: number }[];
  trades: Trade[];
}

export interface TradeLog {
  time: string;
  symbol: string;
  action: "BUY" | "SELL" | "SHORT" | "COVER";
  price: number;
  qty: number;
  pnl: number;
  note: string;
}

export interface TraderState {
  running: boolean;
  symbol: string;
  strategy: string;
  params: Record<string, number>;
  interval_sec: number;
  initial_capital: number;
  cash: number;
  equity: number;
  position: {
    symbol: string;
    side: number;
    qty: number;
    entry_price: number;
    entry_time: string;
  } | null;
  last_price: number;
  last_signal: number;
  allow_short: boolean;
  fee_bps: number;
  started_at: string | null;
  trades: TradeLog[];
  equity_curve: { t: string; equity: number; price: number }[];
  pnl: number;
  pnl_pct: number;
  error: string | null;
}

export const Api = {
  health: () => api.get<{ status: string }>("/api/health").then((r) => r.data),
  strategies: () => api.get<StrategyInfo[]>("/api/strategies").then((r) => r.data),
  symbols: () => api.get<SymbolInfo[]>("/api/symbols").then((r) => r.data),
  quote: (symbol: string) =>
    api.get<{ symbol: string; price: number }>(`/api/quote/${symbol}`).then((r) => r.data),
  backtest: (payload: {
    symbol: string;
    strategy: string;
    params: Record<string, number>;
    period_days: number;
    interval: string;
    initial_capital: number;
    fee_bps: number;
    allow_short: boolean;
  }) => api.post<BacktestResponse>("/api/backtest", payload).then((r) => r.data),
  traderState: () => api.get<TraderState>("/api/trader/state").then((r) => r.data),
  traderStart: (cfg: Partial<TraderState>) =>
    api.post<TraderState>("/api/trader/start", cfg).then((r) => r.data),
  traderStop: () => api.post<TraderState>("/api/trader/stop").then((r) => r.data),
  traderReset: () => api.post<TraderState>("/api/trader/reset").then((r) => r.data),
};
