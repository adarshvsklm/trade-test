import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL });

export const getStrategies = () => api.get('/api/strategies').then(r => r.data);
export const startTrading = (payload) => api.post('/api/start', payload).then(r => r.data);
export const stopTrading = () => api.post('/api/stop').then(r => r.data);
export const getState = () => api.get('/api/state').then(r => r.data);
export const runBacktest = (payload) => api.post('/api/backtest', payload).then(r => r.data);
export const getMarketData = (symbol, period = '1mo', interval = '1d') =>
  api.get(`/api/market-data/${symbol}`, { params: { period, interval } }).then(r => r.data);
export const getTickerInfo = (symbol) => api.get(`/api/ticker/${symbol}`).then(r => r.data);

export const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws';

export default api;
