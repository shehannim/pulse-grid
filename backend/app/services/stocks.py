"""Market data via free Yahoo chart API + HN Algolia search. No keys. Quotes delayed ~15m."""
from __future__ import annotations
from datetime import datetime, timezone
import httpx

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

WATCH = [
    ("^GSPC", "S&P 500", True),
    ("^DJI", "Dow Jones", True),
    ("^NDX", "Nasdaq 100", True),
    ("AAPL", "Apple", False),
    ("MSFT", "Microsoft", False),
    ("NVDA", "NVIDIA", False),
    ("TSLA", "Tesla", False),
    ("AMZN", "Amazon", False),
    ("META", "Meta", False),
    ("GOOGL", "Alphabet", False),
    ("AMD", "AMD", False),
]


async def _quote(client: httpx.AsyncClient, sym: str) -> dict | None:
    try:
        r = await client.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{sym}",
                             params={"interval": "1d", "range": "2mo"}, timeout=12)
        res = (r.json().get("chart", {}).get("result") or [None])[0]
        if not res:
            return None
        meta = res.get("meta", {})
        stamps = res.get("timestamp", [])
        closes = (res.get("indicators", {}).get("quote") or [{}])[0].get("close", [])
        pairs = [(datetime.fromtimestamp(t, tz=timezone.utc).date().isoformat(), c)
                 for t, c in zip(stamps, closes) if c is not None][-35:]
        if len(pairs) < 2:
            return None
        price, prev = pairs[-1][1], pairs[-2][1]
        chg = price - prev
        closes_only = [p[1] for p in pairs]
        return {"price": round(price, 2), "change": round(chg, 2),
                "change_pct": round(chg / prev * 100, 2) if prev else 0,
                "as_of": pairs[-1][0], "spark": closes_only[-30:]}
    except Exception:
        return None


async def get_stocks() -> dict:
    indices, stocks = [], []
    async with httpx.AsyncClient(headers=UA) as c:
        for sym, name, is_idx in WATCH:
            q = await _quote(c, sym)
            if not q:
                continue
            entry = {"symbol": sym, "name": name, **q}
            (indices if is_idx else stocks).append(entry)
    return {"count": len(indices) + len(stocks), "indices": indices,
            "stocks": stocks, "stale": not (indices or stocks)}


async def get_market_news(query: str = "stock market", limit: int = 20) -> dict:
    try:
        async with httpx.AsyncClient(timeout=12) as c:
            d = (await c.get("https://hn.algolia.com/api/v1/search",
                 params={"query": query, "tags": "story",
                         "hitsPerPage": max(1, min(limit, 30))})).json()
            items = [{"id": f"mkt-{h.get('objectID')}", "title": h.get("title") or "",
                      "url": h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}",
                      "points": int(h.get("points") or 0), "author": h.get("author") or "",
                      "published_at": int(h.get("created_at_i") or 0)}
                     for h in d.get("hits", []) if h.get("title")]
            return {"query": query, "count": len(items), "items": items}
    except Exception:
        return {"query": query, "count": 0, "items": []}
