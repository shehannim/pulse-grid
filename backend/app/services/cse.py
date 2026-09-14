"""CSE (Colombo Stock Exchange) client. Unofficial https://www.cse.lk/api/ endpoints (POST).

Endpoint map documented at:
https://github.com/GH0STH4CKER/Colombo-Stock-Exchange-CSE-API-Documentation
Base URL: https://www.cse.lk/api/  (all POST, form-encoded, no auth)
"""
from __future__ import annotations

import json
import time
import urllib.parse
from pathlib import Path

import httpx

CSE_BASE = "https://www.cse.lk/api/"
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) PulseGrid-CSE/1.0"}

TTL = 60  # seconds — CSE web portal polls ~60s during market hours
_cache: dict[str, tuple[float, object]] = {}

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
try:
    SECTOR_MAP: dict[str, str] = json.loads((DATA_DIR / "sectors.json").read_text(encoding="utf-8"))
except Exception:
    SECTOR_MAP = {}


def sector_of(symbol: str) -> str:
    if symbol in SECTOR_MAP:
        return SECTOR_MAP[symbol]
    base = symbol.split(".")[0]
    # voting-rights (X) shares inherit the ordinary-share sector
    for suffix in (".N0000", ".X0000"):
        if base + suffix in SECTOR_MAP:
            return SECTOR_MAP[base + suffix]
    return "Others"


async def _post(client: httpx.AsyncClient, endpoint: str, data: dict | None = None) -> object | None:
    try:
        r = await client.post(
            CSE_BASE + endpoint,
            content=urllib.parse.urlencode(data or {}),
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


async def _cached(key: str, fetcher):
    now = time.time()
    if key in _cache and now - _cache[key][0] < TTL:
        return _cache[key][1]
    val = await fetcher()
    if val is not None:
        _cache[key] = (now, val)
    elif key in _cache:
        return _cache[key][1]  # stale on upstream failure
    return val


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(headers=UA)


# ---------- raw fetchers ----------

async def fetch_trade_summary() -> list[dict]:
    async def go():
        async with await _client() as c:
            d = await _post(c, "tradeSummary")
            if isinstance(d, dict):
                rows = d.get("reqTradeSummery") or []
                return rows if isinstance(rows, list) else None
            return None

    return await _cached("tradeSummary", go) or []


async def fetch_overview() -> dict:
    async def go():
        async with await _client() as c:
            status = await _post(c, "marketStatus")
            summ = await _post(c, "marketSummery")
            aspi = await _post(c, "aspiData")
            snp = await _post(c, "snpData")
            daily = await _post(c, "dailyMarketSummery")
            return {"status": status, "summary": summ, "aspi": aspi, "snp": snp, "daily": daily}

    return await _cached("overview", go) or {}


async def fetch_movers_raw() -> dict:
    async def go():
        async with await _client() as c:
            g = await _post(c, "topGainers")
            l = await _post(c, "topLooses")  # note CSE spelling: "Looses"
            a = await _post(c, "mostActiveTrades")
            return {"gainers": g or [], "losers": l or [], "active": a or []}

    return await _cached("movers", go) or {"gainers": [], "losers": [], "active": []}


async def fetch_sectors_raw() -> list[dict]:
    async def go():
        async with await _client() as c:
            d = await _post(c, "allSectors")
            return d if isinstance(d, list) else None

    return await _cached("sectors", go) or []


async def stock_id_map() -> dict[str, int]:
    """CSE tradeSummary `id` doubles as the chart-API stockId."""
    rows = await fetch_trade_summary()
    return {str(x.get("symbol")): int(x.get("id")) for x in rows if x.get("symbol") and x.get("id")}


CHART_PERIODS = {"1D": "1", "1W": "2", "1M": "3", "3M": "4", "1Y": "5"}


async def get_chart(symbol: str, period: str = "1Y") -> dict | None:
    code = CHART_PERIODS.get(period.upper(), "5")
    sym = symbol.strip().upper()
    if "." not in sym:
        sym += ".N0000"
    ids = await stock_id_map()
    sid = ids.get(sym)
    if not sid:
        # voting-rights fallback: try the .N0000 twin
        sid = ids.get(sym.split(".")[0] + ".N0000")
    if not sid:
        return None
    async with await _client() as c:
        d = await _post(c, "companyChartDataByStock", {"stockId": str(sid), "period": code})
    if not isinstance(d, dict):
        return None
    rows = d.get("chartData") or []
    pts = []
    for r in rows:
        try:
            p = float(r.get("p") or 0)
            if p <= 0:
                continue
            pt = {"t": int(r.get("t") or 0), "close": p, "volume": int(float(r.get("q") or 0))}
            if code != "1":
                pt["high"] = float(r.get("h") or p)
                pt["low"] = float(r.get("l") or p)
            pts.append(pt)
        except (TypeError, ValueError):
            continue
    if not pts:
        return None
    return {"symbol": sym, "period": period.upper(), "count": len(pts), "points": pts}


# ---------- normalized views ----------

def _tile(x: dict) -> dict:
    sym = str(x.get("symbol", ""))
    px = float(x.get("price") or 0)
    chg = float(x.get("change") or 0)
    pct = float(x.get("percentageChange") or 0)
    prev = float(x.get("previousClose") or (px - chg))
    return {
        "symbol": sym,
        "short": sym.split(".")[0],
        "name": str(x.get("name", "")),
        "price": round(px, 2),
        "change": round(chg, 2),
        "change_pct": round(pct, 2),
        "prev_close": round(prev, 2),
        "open": float(x.get("open") or 0),
        "high": float(x.get("high") or 0),
        "low": float(x.get("low") or 0),
        "volume": int(float(x.get("sharevolume") or 0)),
        "turnover": float(x.get("turnover") or 0),
        "trades": int(x.get("tradevolume") or 0),
        "market_cap": float(x.get("marketCap") or 0),
        "sector": sector_of(sym),
    }


async def get_heatmap(limit: int = 300, min_mcap: float = 0) -> dict:
    rows = await fetch_trade_summary()
    tiles = [_tile(x) for x in rows if (x.get("symbol") and float(x.get("marketCap") or 0) >= min_mcap)]
    tiles.sort(key=lambda t: t["market_cap"], reverse=True)
    tiles = tiles[: max(1, min(limit, 500))]
    sectors: dict[str, dict] = {}
    for t in tiles:
        s = sectors.setdefault(t["sector"], {"name": t["sector"], "count": 0, "market_cap": 0.0, "turnover": 0.0})
        s["count"] += 1
        s["market_cap"] += t["market_cap"]
        s["turnover"] += t["turnover"]
    adv = sum(1 for t in tiles if t["change"] > 0)
    dec = sum(1 for t in tiles if t["change"] < 0)
    flat = len(tiles) - adv - dec
    return {
        "count": len(tiles),
        "advances": adv,
        "declines": dec,
        "unchanged": flat,
        "sectors": sorted(sectors.values(), key=lambda s: s["market_cap"], reverse=True),
        "tiles": tiles,
        "stale": not bool(rows),
    }


async def get_overview() -> dict:
    raw = await fetch_overview()
    status = raw.get("status")
    st = ""
    if isinstance(status, dict):
        st = str(status.get("status", ""))
    elif isinstance(status, str):
        st = status
    summ = raw.get("summary") or {}
    aspi = raw.get("aspi") or {}
    snp = raw.get("snp") or {}
    rows = await fetch_trade_summary()
    adv = sum(1 for x in rows if float(x.get("change") or 0) > 0)
    dec = sum(1 for x in rows if float(x.get("change") or 0) < 0)
    return {
        "market_status": st or "Unknown",
        "is_open": "open" in st.lower(),
        "aspi": {
            "value": float(aspi.get("value") or 0),
            "change": float(aspi.get("change") or 0),
            "change_pct": round(float(aspi.get("percentage") or 0), 3),
            "high": float(aspi.get("highValue") or 0),
            "low": float(aspi.get("lowValue") or 0),
        },
        "sl20": {
            "value": float(snp.get("value") or 0),
            "change": float(snp.get("change") or 0),
            "change_pct": round(float(snp.get("percentage") or 0), 3),
            "high": float(snp.get("highValue") or 0),
            "low": float(snp.get("lowValue") or 0),
        },
        "turnover": float(summ.get("tradeVolume") or 0),
        "share_volume": int(float(summ.get("shareVolume") or 0)),
        "trades": int(summ.get("trades") or 0),
        "listed_traded": len(rows),
        "advances": adv,
        "declines": dec,
        "stale": not bool(rows),
    }


async def get_movers(limit: int = 15) -> dict:
    raw = await fetch_movers_raw()
    rows = await fetch_trade_summary()
    by_sym = {str(x.get("symbol")): x for x in rows if x.get("symbol")}

    def enrich(items: list[dict], key: str) -> list[dict]:
        out = []
        for m in items[: max(1, min(limit, 30))]:
            sym = str(m.get("symbol", ""))
            base = by_sym.get(sym, {})
            out.append(
                {
                    "symbol": sym,
                    "short": sym.split(".")[0],
                    "name": str(base.get("name", "")),
                    "price": float(m.get("price") or base.get("price") or 0),
                    "change": float(m.get("change") or base.get("change") or 0),
                    "change_pct": round(float(m.get("changePercentage") or m.get("percentageShareVolume") or base.get("percentageChange") or 0), 2),
                    "volume": int(float(m.get("shareVolume") or base.get("sharevolume") or 0)),
                    "turnover": float(m.get("turnover") or base.get("turnover") or 0),
                    "sector": sector_of(sym),
                }
            )
        return out

    return {
        "gainers": enrich(raw.get("gainers") or [], "gainers"),
        "losers": enrich(raw.get("losers") or [], "losers"),
        "most_active": enrich(raw.get("active") or [], "active"),
        "stale": not bool(rows),
    }


async def get_sectors() -> dict:
    raw = await fetch_sectors_raw()
    out = []
    for s in raw:
        out.append(
            {
                "name": str(s.get("name", "")),
                "symbol": str(s.get("symbol", "")),
                "index": float(s.get("indexValue") or 0),
                "change": float(s.get("change") or 0),
                "change_pct": round(float(s.get("percentage") or 0), 3),
                "turnover": float(s.get("sectorTurnoverToday") or 0),
                "volume": int(float(s.get("sectorVolumeToday") or 0)),
                "trades": int(float(s.get("sectorTradeToday") or 0)),
            }
        )
    out.sort(key=lambda s: abs(s["turnover"]), reverse=True)
    return {"count": len(out), "sectors": out, "stale": not bool(raw)}


async def get_quote(symbol: str) -> dict | None:
    sym = symbol.strip().upper()
    if "." not in sym:
        sym += ".N0000"
    async with await _client() as c:
        d = await _post(c, "companyInfoSummery", {"symbol": sym})
    if not isinstance(d, dict):
        return None
    info = d.get("reqSymbolInfo") or {}
    if not info:
        return None
    beta = d.get("reqSymbolBetaInfo") or {}
    return {
        "symbol": str(info.get("symbol", sym)),
        "short": str(info.get("symbol", sym)).split(".")[0],
        "name": str(info.get("name", "")),
        "price": float(info.get("lastTradedPrice") or info.get("closingPrice") or 0),
        "change": float(info.get("change") or 0),
        "change_pct": round(float(info.get("changePercentage") or 0), 3),
        "prev_close": float(info.get("previousClose") or 0),
        "open": None,
        "high_day": float(info.get("hiTrade") or 0),
        "low_day": float(info.get("lowTrade") or 0),
        "high_52w": float(info.get("p12HiPrice") or 0),
        "low_52w": float(info.get("p12LowPrice") or 0),
        "volume": int(float(info.get("tdyShareVolume") or 0)),
        "turnover": float(info.get("tdyTurnover") or 0),
        "trades": int(float(info.get("tdyTradeVolume") or 0)),
        "market_cap": float(info.get("marketCap") or 0),
        "market_cap_pct": float(info.get("marketCapPercentage") or 0),
        "beta_sl20": float(beta.get("betaValueSPSL") or 0),
        "sector": sector_of(str(info.get("symbol", sym))),
    }
