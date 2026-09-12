import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const COLORS = ['#00D4FF', '#A78BFA', '#34D399', '#FBBF24']

export default function App() {
  const [data, setData] = useState({ items: [], clusters: 0, count: 0 })
  const [live, setLive] = useState(false)
  const [filter, setFilter] = useState(-1)

  useEffect(() => {
    fetch(`${API}/api/pulse`).then(r => r.json()).then(setData).catch(() => {})
    const wsUrl = API.replace('http', 'ws') + '/ws/pulse'
    let ws
    try {
      ws = new WebSocket(wsUrl)
      ws.onopen = () => setLive(true)
      ws.onmessage = e => setData(JSON.parse(e.data))
      ws.onclose = () => setLive(false)
    } catch { /* offline */ }
    return () => ws && ws.close()
  }, [])

  const shown = filter < 0 ? data.items : data.items.filter(x => x.cluster === filter)

  return (
    <div className="wrap">
      <header>
        <h1>⚡ PulseGrid</h1>
        <p>Realtime open-source pulse · Hacker News live + TF-IDF clustering · no keys</p>
        <div className="row">
          <span className={live ? 'dot on' : 'dot'} />{live ? 'LIVE via WebSocket' : 'REST mode'}
          <span className="pill">{data.count} stories</span>
          <span className="pill">{data.clusters} clusters</span>
        </div>
        <div className="row">
          <button className={filter < 0 ? 'btn active' : 'btn'} onClick={() => setFilter(-1)}>All</button>
          {[...Array(data.clusters).keys()].map(c => (
            <button key={c} className={filter === c ? 'btn active' : 'btn'}
              style={{ borderColor: COLORS[c % 4] }} onClick={() => setFilter(c)}>◉ C{c}</button>
          ))}
        </div>
      </header>
      <main className="grid">
        {shown.map(it => (
          <a key={it.id} className="card" href={it.url || '#'} target="_blank" rel="noreferrer"
            style={{ borderTopColor: COLORS[it.cluster % 4] }}>
            <small>{it.source} · ▲{it.score} · cluster {it.cluster}</small>
            <h3>{it.title}</h3>
            <div className="tags">{(it.keywords || []).map(k => <span key={k}>#{k}</span>)}</div>
          </a>
        ))}
      </main>
      <footer>FastAPI WebSocket /ws/pulse refreshes every 30s · backend: <code>uvicorn app.main:app --reload</code></footer>
    </div>
  )
}
