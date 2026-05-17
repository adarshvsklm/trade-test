const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export const api = {
  getStrategies: () => request("/api/strategies"),
  getPrice: (symbol) => request(`/api/price/${symbol}`),
  getStockInfo: (symbol) => request(`/api/stock-info/${symbol}`),
  getHistory: (symbol, period = "6mo", interval = "1d") =>
    request(`/api/history/${symbol}?period=${period}&interval=${interval}`),
  getIndicators: (symbol, strategy) =>
    request(`/api/indicators/${symbol}?strategy=${strategy}`),
  startTrading: (data) =>
    request("/api/trade/start", { method: "POST", body: JSON.stringify(data) }),
  stopTrading: (sessionId) =>
    request(`/api/trade/stop/${sessionId}`, { method: "POST" }),
  getSessions: () => request("/api/sessions"),
  getSession: (id) => request(`/api/session/${id}`),
  getSessionTrades: (id) => request(`/api/session/${id}/trades`),
  getEquityHistory: (id) => request(`/api/session/${id}/equity`),
  runBacktest: (data) =>
    request("/api/backtest", { method: "POST", body: JSON.stringify(data) }),
};

export function createWebSocket(onMessage) {
  const wsUrl = API_BASE.replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WebSocket connected");
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN)
        ws.send(JSON.stringify({ type: "ping" }));
    }, 30000);
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type !== "pong") onMessage(data);
  };

  ws.onclose = () => {
    console.log("WebSocket disconnected, reconnecting...");
    setTimeout(() => createWebSocket(onMessage), 3000);
  };

  return ws;
}
