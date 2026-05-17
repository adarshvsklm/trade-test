import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta


def fetch_ohlcv(symbol: str, period: str = "1mo", interval: str = "1d") -> pd.DataFrame:
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval, auto_adjust=True)
    df.dropna(inplace=True)
    return df


def fetch_ohlcv_range(
    symbol: str,
    start: str,
    end: str,
    interval: str = "1d",
) -> pd.DataFrame:
    ticker = yf.Ticker(symbol)
    df = ticker.history(start=start, end=end, interval=interval, auto_adjust=True)
    df.dropna(inplace=True)
    return df


def fetch_current_price(symbol: str) -> float:
    ticker = yf.Ticker(symbol)
    info = ticker.fast_info
    return float(info.last_price or info.previous_close or 0.0)


def fetch_ticker_info(symbol: str) -> dict:
    ticker = yf.Ticker(symbol)
    info = ticker.info
    fast = ticker.fast_info
    return {
        "symbol": symbol.upper(),
        "name": info.get("longName", symbol.upper()),
        "sector": info.get("sector", "N/A"),
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE"),
        "52w_high": fast.year_high,
        "52w_low": fast.year_low,
        "avg_volume": fast.three_month_average_volume,
        "current_price": float(fast.last_price or fast.previous_close or 0.0),
    }
