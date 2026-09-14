import asyncio

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.models.schemas import (
    ChartResponse,
    HeatmapResponse,
    MoversResponse,
    OverviewResponse,
    QuoteResponse,
    SectorsResponse,
)
from app.services import cse

app = FastAPI(
    title="CSE Heatmap API",
    version="1.0.0",
    description="Colombo Stock Exchange heatmap — live CSE data over REST + WebSocket. "
    "Upstream: unofficial https://www.cse.lk/api/ (see GH0STH4CKER/CSE-API-Documentation).",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "source": "cse.lk"}


@app.get("/api/cse/overview", response_model=OverviewResponse)
async def overview():
    return await cse.get_overview()


@app.get("/api/cse/heatmap", response_model=HeatmapResponse)
async def heatmap(limit: int = 200, min_mcap: float = 0):
    return await cse.get_heatmap(limit=limit, min_mcap=min_mcap)


@app.get("/api/cse/movers", response_model=MoversResponse)
async def movers(limit: int = 12):
    return await cse.get_movers(limit=limit)


@app.get("/api/cse/sectors", response_model=SectorsResponse)
async def sectors():
    return await cse.get_sectors()


@app.get("/api/cse/quote/{symbol}", response_model=QuoteResponse)
async def quote(symbol: str):
    q = await cse.get_quote(symbol)
    if not q:
        raise HTTPException(status_code=404, detail=f"Symbol not found: {symbol}")
    return q


@app.get("/api/cse/chart/{symbol}", response_model=ChartResponse)
async def chart(symbol: str, period: str = "1Y"):
    c = await cse.get_chart(symbol, period)
    if not c:
        raise HTTPException(status_code=404, detail=f"No chart data: {symbol} {period}")
    return c


@app.websocket("/ws/cse")
async def ws_cse(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            overview_data, heat_data = await asyncio.gather(
                cse.get_overview(), cse.get_heatmap(limit=200)
            )
            await ws.send_json({"type": "cse", "overview": overview_data, "heatmap": heat_data})
            await asyncio.sleep(60)
    except WebSocketDisconnect:
        pass
