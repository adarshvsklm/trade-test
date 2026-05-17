const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000/api";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  return response.json();
};

export const getModels = () => request("/models");
export const getState = () => request("/state");
export const startTrading = (payload) =>
  request("/trading/start", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const stopTrading = () =>
  request("/trading/stop", {
    method: "POST",
  });
export const runBacktest = (payload) =>
  request("/backtest/run", {
    method: "POST",
    body: JSON.stringify(payload),
  });
