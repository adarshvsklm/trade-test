#!/usr/bin/env bash
set -e

echo "=== TradeBot — AI Trading Agent ==="
echo ""

# Backend
echo "[1/2] Starting backend (FastAPI) on http://localhost:8000 ..."
cd "$(dirname "$0")/backend"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "      Backend PID: $BACKEND_PID"

sleep 2

# Frontend
echo "[2/2] Starting frontend (Vite) on http://localhost:3000 ..."
cd "$(dirname "$0")/frontend"
npm run dev -- --host 0.0.0.0 --port 3000 &
FRONTEND_PID=$!
echo "      Frontend PID: $FRONTEND_PID"

echo ""
echo "======================================"
echo "  Backend  : http://localhost:8000"
echo "  Frontend : http://localhost:3000"
echo "  API Docs : http://localhost:8000/docs"
echo "======================================"
echo ""
echo "Press Ctrl+C to stop all services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
