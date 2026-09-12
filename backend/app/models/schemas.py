from pydantic import BaseModel


class PulseItem(BaseModel):
    id: str
    title: str
    url: str = ""
    source: str = "seed"
    score: int = 0
    cluster: int = 0
    keywords: list[str] = []


class PulseResponse(BaseModel):
    count: int
    clusters: int
    items: list[PulseItem]
