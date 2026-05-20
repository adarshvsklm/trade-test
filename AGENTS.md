# AGENTS.md

## Project layout

- `backend/` — FastAPI API (`uvicorn app.main:app` from `backend/`)
- `frontend/` — React + Vite + TypeScript dashboard
- `api/index.py` — Vercel serverless entrypoint (imports `backend/app`)
- `vercel.json` — Vercel build, rewrites, and function settings

## Local development

**Backend** (Python 3.10+):

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend** (Node 18+):

```bash
cd frontend
npm install
npm run dev
```

Dev server: `http://127.0.0.1:5173` (proxies `/api` to port 8000).

## Vercel

Deploy from the repo root; `vercel.json` handles install/build/output. Root
`requirements.txt` is for the Python function (keep aligned with
`backend/requirements.txt`).

## Variants

`variants/` holds archived alternate implementations; not part of the primary app.
