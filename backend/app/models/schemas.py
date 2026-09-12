from pydantic import BaseModel


class PulseItem(BaseModel):
    id: str
    title: str
    url: str = ""
    source: str = "seed"
    score: int = 0
    cluster: int = 0
    keywords: list[str] = []
    published_at: int = 0


class PulseResponse(BaseModel):
    count: int
    clusters: int
    items: list[PulseItem]


class StockQuote(BaseModel):
    symbol: str
    name: str
    price: float = 0
    change: float = 0
    change_pct: float = 0
    as_of: str = ""
    spark: list[float] = []


class StocksResponse(BaseModel):
    count: int = 0
    indices: list[StockQuote] = []
    stocks: list[StockQuote] = []
    stale: bool = False


class MarketNewsItem(BaseModel):
    id: str
    title: str
    url: str = ""
    points: int = 0
    author: str = ""
    published_at: int = 0


class MarketNewsResponse(BaseModel):
    query: str = ""
    count: int = 0
    items: list[MarketNewsItem] = []
