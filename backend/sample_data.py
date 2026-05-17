"""Generates realistic sample market data for when live APIs are unavailable."""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta


STOCK_PROFILES = {
    "AAPL": {"name": "Apple Inc.", "base_price": 195.0, "volatility": 0.018, "drift": 0.0003, "market_cap": 3.0e12},
    "GOOGL": {"name": "Alphabet Inc.", "base_price": 175.0, "volatility": 0.020, "drift": 0.0002, "market_cap": 2.1e12},
    "MSFT": {"name": "Microsoft Corp.", "base_price": 420.0, "volatility": 0.016, "drift": 0.0003, "market_cap": 3.1e12},
    "AMZN": {"name": "Amazon.com Inc.", "base_price": 185.0, "volatility": 0.022, "drift": 0.0002, "market_cap": 1.9e12},
    "TSLA": {"name": "Tesla Inc.", "base_price": 250.0, "volatility": 0.035, "drift": 0.0001, "market_cap": 0.8e12},
    "NVDA": {"name": "NVIDIA Corp.", "base_price": 130.0, "volatility": 0.030, "drift": 0.0004, "market_cap": 3.2e12},
    "META": {"name": "Meta Platforms Inc.", "base_price": 500.0, "volatility": 0.025, "drift": 0.0003, "market_cap": 1.3e12},
    "SPY": {"name": "SPDR S&P 500 ETF", "base_price": 530.0, "volatility": 0.010, "drift": 0.0002, "market_cap": 0.5e12},
}


def _get_profile(symbol: str) -> dict:
    return STOCK_PROFILES.get(symbol.upper(), {
        "name": symbol.upper(),
        "base_price": 100.0,
        "volatility": 0.020,
        "drift": 0.0002,
        "market_cap": 50e9,
    })


def generate_ohlcv(symbol: str, days: int = 180, end_date: datetime | None = None) -> pd.DataFrame:
    profile = _get_profile(symbol)
    if end_date is None:
        end_date = datetime.now()

    np.random.seed(hash(symbol) % (2**31))
    dates = pd.bdate_range(end=end_date, periods=days)

    price = profile["base_price"]
    data = []
    for d in dates:
        daily_return = np.random.normal(profile["drift"], profile["volatility"])
        price *= (1 + daily_return)

        high = price * (1 + abs(np.random.normal(0, 0.005)))
        low = price * (1 - abs(np.random.normal(0, 0.005)))
        open_price = price * (1 + np.random.normal(0, 0.003))
        volume = int(np.random.lognormal(17, 0.5))

        data.append({
            "Open": round(open_price, 2),
            "High": round(high, 2),
            "Low": round(low, 2),
            "Close": round(price, 2),
            "Volume": volume,
        })

    df = pd.DataFrame(data, index=dates)
    df.index.name = "Date"
    return df


def generate_ohlcv_range(symbol: str, start_date: str, end_date: str) -> pd.DataFrame:
    start = pd.Timestamp(start_date)
    end = pd.Timestamp(end_date)
    total_days = max(int((end - start).days * 0.7), 60)
    df = generate_ohlcv(symbol, days=total_days + 50, end_date=end)
    return df[df.index >= start]


def generate_quote(symbol: str) -> dict:
    profile = _get_profile(symbol)
    df = generate_ohlcv(symbol, days=10)
    current = df["Close"].iloc[-1]
    prev = df["Close"].iloc[-2]
    change = current - prev
    change_pct = (change / prev) * 100

    return {
        "symbol": symbol.upper(),
        "price": round(current, 2),
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "name": profile["name"],
        "market_cap": int(profile["market_cap"]),
        "volume": int(df["Volume"].iloc[-1]),
        "day_high": round(df["High"].iloc[-1], 2),
        "day_low": round(df["Low"].iloc[-1], 2),
    }
