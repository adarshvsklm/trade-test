from __future__ import annotations

import logging
from datetime import date, datetime

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)


def fetch_ohlcv(symbol: str, start: date, end: date, interval: str = "1d") -> pd.DataFrame:
    """Download OHLCV. End date is exclusive in yfinance; we add one day for inclusivity."""
    t = yf.Ticker(symbol.strip().upper())
    # yfinance end is exclusive
    df = t.history(start=start.isoformat(), end=(end.isoformat() if isinstance(end, date) else end), interval=interval)
    if df is None or df.empty:
        raise ValueError(f"No data for {symbol} between {start} and {end}")
    df = df.rename(columns=str.lower)
    df = df[["open", "high", "low", "close", "volume"]].copy()
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df


def fetch_recent_daily(symbol: str, period: str = "3mo") -> pd.DataFrame:
    t = yf.Ticker(symbol.strip().upper())
    df = t.history(period=period, interval="1d", auto_adjust=True)
    if df is None or df.empty:
        raise ValueError(f"No recent data for {symbol}")
    df = df.rename(columns=str.lower)
    df = df[["open", "high", "low", "close", "volume"]].copy()
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df


def last_bar_timestamp(df: pd.DataFrame) -> datetime | None:
    if df is None or df.empty:
        return None
    ts = df.index[-1]
    if isinstance(ts, pd.Timestamp):
        return ts.to_pydatetime()
    return datetime.utcnow()
