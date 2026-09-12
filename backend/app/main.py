import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.models.schemas import PulseResponse
from app.services.pulse import get_pulse

app = FastAPI(title="PulseGrid API", version="0.1.0",
              description="Realtime open-source pulse: HN live feed + TF-IDF clustering over WebSockets.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/api/pulse", response_model=PulseResponse)
async def pulse(limit: int = 16):
    return await get_pulse(limit=limit)


@app.websocket("/ws/pulse")
async def ws_pulse(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = await get_pulse(limit=16)
            await ws.send_json(data)
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        pass
