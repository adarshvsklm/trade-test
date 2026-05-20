"""Vercel serverless entrypoint for the FastAPI backend."""

from __future__ import annotations

import sys
from pathlib import Path

# Make `backend/app` importable as the `app` package (same layout as uvicorn).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402
