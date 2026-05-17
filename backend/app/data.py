"""Market data provider.

Tries to use yfinance for real historical data. Falls back to a deterministic
synthetic OHLCV generator (geometric Brownian motion) when the network is
unavailable or the symbol is unknown. This keeps the system fully runnable
offline (e.g., in CI or sandboxed environments).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

import numpy as np
import pandas as pd

try:
    import yfinance as yf  # type: ignore
    _HAS_YF = True
except Exception:  # pragma: no cover
    _HAS_YF = False


# Reasonable starting prices for well-known symbols, used by the synthetic
# generator so demo data looks plausible.
_SEED_PRICES = {
    "AAPL": 180.0,
    "MSFT": 410.0,
    "GOOG": 165.0,
    "GOOGL": 165.0,
    "AMZN": 190.0,
    "TSLA": 220.0,
    "NVDA": 900.0,
    "META": 480.0,
    "SPY": 520.0,
    "QQQ": 450.0,
    "BTC-USD": 65000.0,
    "ETH-USD": 3500.0,
}


@dataclass
class DataRequest:
    symbol: str
    period_days: int = 365
    interval: str = "1d"  # "1d", "1h", "15m"


def _interval_to_timedelta(interval: str) -> timedelta:
    return {
        "1d": timedelta(days=1),
        "1h": timedelta(hours=1),
        "30m": timedelta(minutes=30),
        "15m": timedelta(minutes=15),
        "5m": timedelta(minutes=5),
    }.get(interval, timedelta(days=1))


def _synthetic_ohlcv(symbol: str, period_days: int, interval: str) -> pd.DataFrame:
    """Generate deterministic synthetic OHLCV data for a symbol."""
    step = _interval_to_timedelta(interval)
    # number of bars to produce
    total_seconds = period_days * 86400
    n_bars = max(50, int(total_seconds / step.total_seconds()))
    n_bars = min(n_bars, 5000)

    seed = abs(hash(symbol)) % (2**32)
    rng = np.random.default_rng(seed)

    start_price = _SEED_PRICES.get(symbol.upper(), 100.0)
    # Daily-equivalent drift/vol scaled by bar size.
    bar_frac = step.total_seconds() / 86400.0
    mu = 0.08 * bar_frac           # ~8% annualized drift -> per-bar
    sigma = 0.25 * math.sqrt(bar_frac)  # ~25% annualized vol -> per-bar

    returns = rng.normal(mu / 252, sigma / math.sqrt(252), size=n_bars)
    # Add a slow regime-switch component for more interesting backtests.
    regime = np.sin(np.linspace(0, 6 * math.pi, n_bars)) * 0.0005
    log_prices = np.cumsum(returns + regime)
    closes = start_price * np.exp(log_prices)

    # Build OHLC around the close path.
    opens = np.concatenate([[start_price], closes[:-1]])
    highs = np.maximum(opens, closes) * (1 + np.abs(rng.normal(0, 0.004, n_bars)))
    lows = np.minimum(opens, closes) * (1 - np.abs(rng.normal(0, 0.004, n_bars)))
    volumes = rng.integers(500_000, 5_000_000, size=n_bars)

    end = datetime.now(timezone.utc).replace(microsecond=0)
    timestamps = [end - step * (n_bars - 1 - i) for i in range(n_bars)]

    df = pd.DataFrame(
        {
            "Open": opens,
            "High": highs,
            "Low": lows,
            "Close": closes,
            "Volume": volumes,
        },
        index=pd.DatetimeIndex(timestamps, name="Date"),
    )
    return df


def get_ohlcv(symbol: str, period_days: int = 365, interval: str = "1d",
              prefer_live: bool = True) -> pd.DataFrame:
    """Return an OHLCV DataFrame indexed by datetime.

    Tries yfinance first if available; falls back to synthetic data.
    """
    if prefer_live and _HAS_YF:
        try:
            period = f"{max(period_days, 7)}d"
            df = yf.download(
                symbol,
                period=period,
                interval=interval,
                progress=False,
                auto_adjust=True,
                threads=False,
            )
            if df is not None and len(df) > 20:
                if isinstance(df.columns, pd.MultiIndex):
                    df.columns = df.columns.get_level_values(0)
                df = df[["Open", "High", "Low", "Close", "Volume"]].dropna()
                df.index.name = "Date"
                return df
        except Exception:
            pass  # fall through to synthetic

    return _synthetic_ohlcv(symbol, period_days, interval)


def latest_price(symbol: str) -> float:
    df = get_ohlcv(symbol, period_days=7, interval="1d")
    return float(df["Close"].iloc[-1])


def append_synthetic_bar(df: pd.DataFrame, symbol: str) -> pd.DataFrame:
    """Append a single synthetic next bar; used by the live paper trader."""
    last_close = float(df["Close"].iloc[-1])
    seed = abs(hash((symbol, len(df)))) % (2**32)
    rng = np.random.default_rng(seed)
    step = df.index[-1] - df.index[-2] if len(df) >= 2 else timedelta(days=1)
    ret = rng.normal(0.0003, 0.012)
    new_close = max(0.01, last_close * (1 + ret))
    new_open = last_close
    new_high = max(new_open, new_close) * (1 + abs(rng.normal(0, 0.004)))
    new_low = min(new_open, new_close) * (1 - abs(rng.normal(0, 0.004)))
    new_vol = int(rng.integers(500_000, 5_000_000))
    new_idx = df.index[-1] + step
    new_row = pd.DataFrame(
        {
            "Open": [new_open],
            "High": [new_high],
            "Low": [new_low],
            "Close": [new_close],
            "Volume": [new_vol],
        },
        index=pd.DatetimeIndex([new_idx], name="Date"),
    )
    return pd.concat([df, new_row])
