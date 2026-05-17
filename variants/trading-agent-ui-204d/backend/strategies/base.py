from abc import ABC, abstractmethod
import pandas as pd
from typing import Literal

Signal = Literal["BUY", "SELL", "HOLD"]


class BaseStrategy(ABC):
    name: str = "Base"
    description: str = ""

    @abstractmethod
    def generate_signal(self, df: pd.DataFrame) -> Signal:
        """Given OHLCV dataframe, return a trading signal."""
        ...

    def get_info(self) -> dict:
        return {"name": self.name, "description": self.description}
