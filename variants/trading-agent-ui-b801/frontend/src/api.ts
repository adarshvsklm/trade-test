import type { BacktestResponse, ModelInfo, SessionState } from './types'

async function parseError(res: Response): Promise<string> {
  try {
    const j = await res.json()
    if (j && typeof j.detail === 'string') return j.detail
    if (Array.isArray(j?.detail)) return j.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
    return JSON.stringify(j)
  } catch {
    return res.statusText
  }
}

export async function fetchModels(): Promise<ModelInfo[]> {
  const r = await fetch('/api/models')
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function createSession(body: {
  symbol: string
  model_id: string
  initial_cash: number
  poll_seconds: number
}): Promise<SessionState> {
  const r = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function startSession(sessionId: string): Promise<SessionState> {
  const r = await fetch(`/api/sessions/${sessionId}/start`, { method: 'POST' })
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function stopSession(sessionId: string): Promise<SessionState> {
  const r = await fetch(`/api/sessions/${sessionId}/stop`, { method: 'POST' })
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function getSession(sessionId: string): Promise<SessionState> {
  const r = await fetch(`/api/sessions/${sessionId}`)
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export async function runBacktest(body: {
  symbol: string
  model_id: string
  start: string
  end: string
  initial_cash: number
}): Promise<BacktestResponse> {
  const r = await fetch('/api/backtest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await parseError(r))
  return r.json()
}

export function sessionWebSocketUrl(sessionId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/sessions/${sessionId}`
}
