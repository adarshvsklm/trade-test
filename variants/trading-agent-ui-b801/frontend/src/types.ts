export type ModelInfo = {
  id: string
  name: string
  description: string
}

export type TradeRecord = {
  time: string
  side: 'buy' | 'sell'
  price: number
  shares: number
  notional: number
  reason: string
}

export type SessionState = {
  session_id: string
  symbol: string
  model_id: string
  status: 'created' | 'running' | 'stopped' | 'error'
  initial_cash: number
  cash: number
  shares: number
  last_price: number | null
  market_value: number
  equity: number
  realized_pnl: number
  unrealized_pnl: number
  total_pnl: number
  total_pnl_pct: number
  trades: TradeRecord[]
  last_signal: string
  last_update: string | null
  error: string | null
  poll_seconds: number
}

export type BacktestMetrics = {
  total_return_pct: number
  max_drawdown_pct: number
  win_rate_pct: number | null
  trades: number
  sharpe_approx: number | null
}

export type EquityPoint = {
  time: string
  equity: number
  cash: number
  position_value: number
}

export type BacktestResponse = {
  symbol: string
  model_id: string
  metrics: BacktestMetrics
  equity_curve: EquityPoint[]
  trades: TradeRecord[]
}
