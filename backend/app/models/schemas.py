from pydantic import BaseModel


class IndexQuote(BaseModel):
    value: float = 0
    change: float = 0
    change_pct: float = 0
    high: float = 0
    low: float = 0


class OverviewResponse(BaseModel):
    market_status: str = "Unknown"
    is_open: bool = False
    aspi: IndexQuote = IndexQuote()
    sl20: IndexQuote = IndexQuote()
    turnover: float = 0
    share_volume: int = 0
    trades: int = 0
    listed_traded: int = 0
    advances: int = 0
    declines: int = 0
    stale: bool = False


class HeatmapTile(BaseModel):
    symbol: str
    short: str = ""
    name: str = ""
    price: float = 0
    change: float = 0
    change_pct: float = 0
    prev_close: float = 0
    open: float = 0
    high: float = 0
    low: float = 0
    volume: int = 0
    turnover: float = 0
    trades: int = 0
    market_cap: float = 0
    sector: str = "Others"


class SectorAgg(BaseModel):
    name: str
    count: int = 0
    market_cap: float = 0
    turnover: float = 0


class HeatmapResponse(BaseModel):
    count: int = 0
    advances: int = 0
    declines: int = 0
    unchanged: int = 0
    sectors: list[SectorAgg] = []
    tiles: list[HeatmapTile] = []
    stale: bool = False


class MoverItem(BaseModel):
    symbol: str
    short: str = ""
    name: str = ""
    price: float = 0
    change: float = 0
    change_pct: float = 0
    volume: int = 0
    turnover: float = 0
    sector: str = "Others"


class MoversResponse(BaseModel):
    gainers: list[MoverItem] = []
    losers: list[MoverItem] = []
    most_active: list[MoverItem] = []
    stale: bool = False


class SectorIndex(BaseModel):
    name: str = ""
    symbol: str = ""
    index: float = 0
    change: float = 0
    change_pct: float = 0
    turnover: float = 0
    volume: int = 0
    trades: int = 0


class SectorsResponse(BaseModel):
    count: int = 0
    sectors: list[SectorIndex] = []
    stale: bool = False


class QuoteResponse(BaseModel):
    symbol: str
    short: str = ""
    name: str = ""
    price: float = 0
    change: float = 0
    change_pct: float = 0
    prev_close: float = 0
    open: float | None = None
    high_day: float = 0
    low_day: float = 0
    high_52w: float = 0
    low_52w: float = 0
    volume: int = 0
    turnover: float = 0
    trades: int = 0
    market_cap: float = 0
    market_cap_pct: float = 0
    beta_sl20: float = 0
    sector: str = "Others"


class ChartPoint(BaseModel):
    t: int = 0  # epoch ms
    close: float = 0
    high: float | None = None
    low: float | None = None
    volume: int = 0


class ChartResponse(BaseModel):
    symbol: str
    period: str = "1Y"
    count: int = 0
    points: list[ChartPoint] = []
