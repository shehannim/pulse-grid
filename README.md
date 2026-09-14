# 🇱🇰 CSE Heatmap — Colombo Stock Exchange

Live stock-market heatmap for Sri Lanka's CSE, powered by the unofficial `cse.lk` API
(documented at [GH0STH4CKER/Colombo-Stock-Exchange-CSE-API-Documentation](https://github.com/GH0STH4CKER/Colombo-Stock-Exchange-CSE-API-Documentation)).
No API keys. Tiles sized by market cap / turnover / volume, coloured by day % change.

## Run

```bash
# backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# docs: http://localhost:8000/docs

# frontend (new terminal)
cd frontend
npm install
npm run dev
# app: http://localhost:5173
```

Set `VITE_API_URL` in `frontend/.env` for prod, e.g. `VITE_API_URL=https://your-api.railway.app`.

## API

- `GET /health`
- `GET /api/cse/overview` → market status, ASPI, S&P SL20, turnover, breadth
- `GET /api/cse/heatmap?limit=200&min_mcap=0` → tiles + sector aggregates
- `GET /api/cse/movers?limit=12` → gainers / losers / most active
- `GET /api/cse/sectors` → CSE sector indices
- `GET /api/cse/quote/{symbol}` → e.g. `JKH`, `JKH.N0000`, `COMB.X0000`
- `GET /api/cse/chart/{symbol}?period=1Y` → 1D ticks, 1W / 1M / 3M / 1Y daily OHLC + volume
- `WS /ws/cse` → pushes `{overview, heatmap}` every 60s

Upstream base: `POST https://www.cse.lk/api/{tradeSummary,todaySharePrice,marketStatus,marketSummery,aspiData,snpData,topGainers,topLooses,mostActiveTrades,allSectors,companyInfoSummery,…}`.
Responses cached 60s server-side; stale snapshot served if CSE is unreachable.

`backend/app/data/sectors.json` maps CSE symbols → heatmap groups (Banks, Diversified, Consumer, …).
Unknown symbols fall back to `Others` — extend the file to improve grouping.

## Deploy

- Backend → Railway (uses `backend/Dockerfile`)
- Frontend → Vercel (uses `frontend/vercel.json`)

## Disclaimer

Delayed, unofficial data for education only — not investment advice. Verify against cse.lk.
