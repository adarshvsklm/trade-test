#!/bin/bash
set -e

echo "=== Trading Agent ==="
echo ""

# Install backend dependencies
echo "[1/3] Installing backend dependencies..."
cd backend
pip3 install -r requirements.txt -q
cd ..

# Install frontend dependencies
echo "[2/3] Installing frontend dependencies..."
cd frontend
npm install --silent
cd ..

# Start both servers
echo "[3/3] Starting servers..."
echo ""
echo "  Backend API:  http://localhost:8000"
echo "  Frontend UI:  http://localhost:3000"
echo "  API Docs:     http://localhost:8000/docs"
echo ""

# Start backend in background
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Start frontend
cd frontend
BROWSER=none npm start &
FRONTEND_PID=$!
cd ..

# Trap to kill both on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
