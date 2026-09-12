# ⚡ PulseGrid — Realtime Open-Source Pulse

Live Hacker News feed + TF-IDF / KMeans clustering, pushed over **WebSockets**. No API keys. Works offline with seed data.

![stack](https://img.shields.io/badge/FastAPI-009688?style=flat&logo=fastapi&logoColor=white)
![ws](https://img.shields.io/badge/WebSocket-00D4FF?style=flat)
![react](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)
![sklearn](https://img.shields.io/badge/sklearn-F7931E?style=flat&logo=scikit-learn&logoColor=white)

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

- `GET /health` → `{status: ok}`
- `GET /api/pulse?limit=16` → `{count, clusters, items[]}`
- `WS /ws/pulse` → pushes full pulse every 30s

Each item: `id, title, url, source, score, cluster, keywords[]`.

## Deploy

- Backend → Railway (uses `backend/Dockerfile`)
- Frontend → Vercel (uses `frontend/vercel.json`)

## Next

- [ ] GitHub trending source, search `?q=`, cluster drill-down graph
- [ ] Star it if useful ⭐
