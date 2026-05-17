import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from functools import lru_cache
import logging

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[datetime, pd.DataFrame]] = {}
CACHE_TTL = timedelta(minutes=5)

USE_DEMO = True


def _generate_demo_data(
    symbol: str,
    start: str | None = None,
    end: str | None = None,
    days: int = 252,
) -> pd.DataFrame:
    seed_map = {
        "AAPL": (180, 42), "TSLA": (250, 99), "MSFT": (400, 77),
        "GOOGL": (160, 33), "AMZN": (180, 55), "NVDA": (800, 66),
        "META": (500, 88), "SPY": (520, 11),
    }
    base_price, seed = seed_map.get(symbol.upper(), (100, hash(symbol) % 1000))
    rng = np.random.RandomState(seed)

    if start and end:
        date_range = pd.date_range(start=start, end=end, freq="B")
    else:
        date_range = pd.date_range(end=datetime.now(), periods=days, freq="B")

    n = len(date_range)
    returns = rng.normal(0.0004, 0.018, n)
    prices = base_price * np.cumprod(1 + returns)

    high_mult = 1 + rng.uniform(0.002, 0.025, n)
    low_mult = 1 - rng.uniform(0.002, 0.025, n)
    open_offset = rng.normal(0, 0.005, n)

    df = pd.DataFrame({
        "Open": prices * (1 + open_offset),
        "High": prices * high_mult,
        "Low": prices * low_mult,
        "Close": prices,
        "Volume": (rng.lognormal(17, 0.5, n)).astype(int),
    }, index=date_range)

    df.index.name = "Date"
    return df


def get_historical_data(
    symbol: str,
    period: str = "1y",
    interval: str = "1d",
    start: str | None = None,
    end: str | None = None,
) -> pd.DataFrame:
    cache_key = f"{symbol}_{period}_{interval}_{start}_{end}"
    now = datetime.now()

    if cache_key in _cache:
        cached_time, cached_df = _cache[cache_key]
        if now - cached_time < CACHE_TTL:
            return cached_df.copy()

    try:
        if not USE_DEMO:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            if start and end:
                df = ticker.history(start=start, end=end, interval=interval)
            else:
                df = ticker.history(period=period, interval=interval)

            if df.empty:
                raise ValueError(f"No data from API for {symbol}, falling back to demo")

            df.index = pd.to_datetime(df.index)
            if df.index.tz is not None:
                df.index = df.index.tz_localize(None)
        else:
            raise ValueError("Using demo mode")

    except Exception as e:
        logger.info(f"Using demo data for {symbol}: {e}")
        period_days = {
            "1mo": 22, "3mo": 66, "6mo": 132,
            "1y": 252, "2y": 504, "5y": 1260,
        }
        days = period_days.get(period, 252)
        df = _generate_demo_data(symbol, start=start, end=end, days=days)

    _cache[cache_key] = (now, df.copy())
    return df


def get_current_price(symbol: str) -> dict:
    try:
        df = get_historical_data(symbol, period="1mo")
        if df.empty:
            raise ValueError(f"No price data for {symbol}")

        current = float(df["Close"].iloc[-1])
        prev_close = float(df["Close"].iloc[-2]) if len(df) >= 2 else current
        change = current - prev_close
        change_pct = (change / prev_close) * 100 if prev_close else 0

        return {
            "symbol": symbol,
            "price": round(current, 2),
            "change": round(change, 2),
            "change_pct": round(change_pct, 2),
            "volume": int(df["Volume"].iloc[-1]),
            "high": round(float(df["High"].iloc[-1]), 2),
            "low": round(float(df["Low"].iloc[-1]), 2),
            "open": round(float(df["Open"].iloc[-1]), 2),
        }
    except Exception as e:
        logger.error(f"Error getting price for {symbol}: {e}")
        raise


def get_stock_info(symbol: str) -> dict:
    demo_info = {
        "AAPL": {"name": "Apple Inc.", "sector": "Technology", "industry": "Consumer Electronics"},
        "TSLA": {"name": "Tesla Inc.", "sector": "Consumer Cyclical", "industry": "Auto Manufacturers"},
        "MSFT": {"name": "Microsoft Corp.", "sector": "Technology", "industry": "Software"},
        "GOOGL": {"name": "Alphabet Inc.", "sector": "Technology", "industry": "Internet Services"},
        "AMZN": {"name": "Amazon.com Inc.", "sector": "Consumer Cyclical", "industry": "Internet Retail"},
        "NVDA": {"name": "NVIDIA Corp.", "sector": "Technology", "industry": "Semiconductors"},
        "META": {"name": "Meta Platforms Inc.", "sector": "Technology", "industry": "Social Media"},
        "SPY": {"name": "SPDR S&P 500 ETF", "sector": "ETF", "industry": "Index Fund"},
    }

    try:
        if not USE_DEMO:
            import yfinance as yf
            ticker = yf.Ticker(symbol)
            info = ticker.info
            return {
                "symbol": symbol,
                "name": info.get("shortName", symbol),
                "sector": info.get("sector", "N/A"),
                "industry": info.get("industry", "N/A"),
                "market_cap": info.get("marketCap", 0),
                "pe_ratio": info.get("trailingPE", 0),
                "dividend_yield": info.get("dividendYield", 0),
                "52w_high": info.get("fiftyTwoWeekHigh", 0),
                "52w_low": info.get("fiftyTwoWeekLow", 0),
            }
    except Exception:
        pass

    info = demo_info.get(symbol.upper(), {"name": symbol, "sector": "N/A", "industry": "N/A"})
    price_data = get_current_price(symbol)
    return {
        "symbol": symbol,
        "name": info["name"],
        "sector": info["sector"],
        "industry": info["industry"],
        "market_cap": 0,
        "pe_ratio": 0,
        "dividend_yield": 0,
        "52w_high": round(price_data["price"] * 1.3, 2),
        "52w_low": round(price_data["price"] * 0.7, 2),
    }
