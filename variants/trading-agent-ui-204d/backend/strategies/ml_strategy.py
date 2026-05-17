import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from .base import BaseStrategy, Signal


class MLStrategy(BaseStrategy):
    name = "ML (Random Forest)"
    description = "Uses Random Forest trained on technical indicators to predict signals."

    def __init__(self, lookback: int = 20, n_estimators: int = 100):
        self.lookback = lookback
        self.n_estimators = n_estimators
        self._model: RandomForestClassifier | None = None
        self._scaler = StandardScaler()
        self._trained = False

    def _build_features(self, df: pd.DataFrame) -> pd.DataFrame:
        close = df["Close"]
        volume = df.get("Volume", pd.Series(index=df.index, data=1.0))

        feats = pd.DataFrame(index=df.index)
        feats["ret_1"] = close.pct_change(1)
        feats["ret_5"] = close.pct_change(5)
        feats["ret_10"] = close.pct_change(10)

        feats["sma_10"] = close.rolling(10).mean() / close - 1
        feats["sma_20"] = close.rolling(20).mean() / close - 1

        delta = close.diff()
        gain = delta.clip(lower=0).ewm(com=13, min_periods=14).mean()
        loss = (-delta.clip(upper=0)).ewm(com=13, min_periods=14).mean()
        rs = gain / loss.replace(0, float("inf"))
        feats["rsi"] = 100 - 100 / (1 + rs)

        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        feats["macd"] = (ema12 - ema26) / close

        std20 = close.rolling(20).std()
        feats["bb_width"] = std20 * 4 / close

        feats["vol_change"] = volume.pct_change(5)

        return feats

    def _train(self, df: pd.DataFrame):
        if len(df) < 60:
            return

        feats = self._build_features(df).dropna()
        close = df["Close"].reindex(feats.index)

        future_ret = close.pct_change(5).shift(-5)
        labels = pd.cut(
            future_ret,
            bins=[-np.inf, -0.005, 0.005, np.inf],
            labels=["SELL", "HOLD", "BUY"],
        )

        mask = labels.notna()
        X = feats[mask].values
        y = labels[mask].values

        if len(X) < 20:
            return

        X_scaled = self._scaler.fit_transform(X)
        self._model = RandomForestClassifier(
            n_estimators=self.n_estimators, random_state=42, n_jobs=-1
        )
        self._model.fit(X_scaled, y)
        self._trained = True

    def generate_signal(self, df: pd.DataFrame) -> Signal:
        if not self._trained:
            self._train(df)

        if not self._trained or self._model is None:
            return "HOLD"

        feats = self._build_features(df)
        last = feats.iloc[-1:].values
        if pd.isna(last).any():
            return "HOLD"

        last_scaled = self._scaler.transform(last)
        pred = self._model.predict(last_scaled)[0]
        return pred  # type: ignore
