import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Grid, OrbitControls, Html, Float, Line } from '@react-three/drei'
import Markets from './Markets.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
/* ink, signal red, brass, slate blue, forest, oxblood */
const COLORS = ['#211a12', '#b0321f', '#8a6d2f', '#2f4b7c', '#3a6b4f', '#7c3f2f']
const CORES = [[4.6, 0.6, 0], [-4.6, 0.9, 0.6], [0, -1.2, -4.2], [0, 2.4, 4.2], [-2.5, -2.2, 2.5], [2.5, -2.4, -2.5]]

function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }
function ago(ts) {
  if (!ts) return 'undated'
  const m = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
function edition() {
  const d = new Date(), h = d.getHours()
  const part = h < 12 ? 'Morning' : h < 17 ? 'Midday' : 'Evening'
  return `${part} Edition · ${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
}

/* ---------------- 3D orrery ---------------- */
function StoryNode({ item, pos, color, rank, dim, selected, onSelect, onHover }) {
  const ref = useRef()
  const [hov, setHov] = useState(false)
  const size = (rank === 0 ? 0.3 : 0.15) + Math.min(item.score / 500, 1) * 0.22
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current.scale.setScalar((selected ? 1.6 : hov ? 1.35 : 1) * (dim ? 0.3 : 1))
    ref.current.position.y = pos[1] + Math.sin(t * 1.1 + pos[0] * 2) * 0.1
  })
  return (
    <group>
      <mesh ref={ref} position={pos}
        onClick={e => { e.stopPropagation(); onSelect(item) }}
        onPointerOver={e => { e.stopPropagation(); setHov(true); onHover(item); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHov(false); onHover(null); document.body.style.cursor = 'auto' }}>
        <sphereGeometry args={[size, 28, 28]} />
        <meshStandardMaterial color={rank === 0 ? '#b0321f' : color} roughness={0.85} metalness={0.05}
          transparent opacity={dim ? 0.2 : 1} />
      </mesh>
      {(hov || selected) && (
        <Html position={[pos[0], pos[1] + size + 0.35, pos[2]]} center className="tag" zIndexRange={[30, 0]}>
          <div><b>No.{rank + 1}</b> {item.title.slice(0, 70)}</div>
        </Html>
      )}
    </group>
  )
}

function Rig({ items, dimIds, selectedId, onSelect, onHover }) {
  const rig = useRef()
  useFrame((_, d) => { if (rig.current) rig.current.rotation.y += d * 0.05 })
  const laid = useMemo(() => items.map((it, rank) => {
    const c = it.cluster % CORES.length
    const core = CORES[c]
    const h = hash(String(it.id))
    const a = (h % 360) * Math.PI / 180
    const r = 1.3 + (h % 100) / 100 * 1.1
    return { it, rank, c, core, pos: [core[0] + Math.cos(a) * r, core[1] + ((h >> 3) % 140) / 100 - 0.7, core[2] + Math.sin(a) * r] }
  }), [items])
  return (
    <group ref={rig}>
      {CORES.map((p, i) => (
        <Float key={i} speed={1.4} rotationIntensity={0.8} floatIntensity={0.9}>
          <mesh position={p} rotation={[Math.PI / 2.4, 0, 0]}>
            <torusGeometry args={[0.5, 0.07, 14, 40]} />
            <meshStandardMaterial color="#8a6d2f" roughness={0.4} metalness={0.75} />
          </mesh>
          <mesh position={p}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial color="#211a12" roughness={0.8} />
          </mesh>
          <Html position={[p[0], p[1] + 0.75, p[2]]} center className="desktag" zIndexRange={[20, 0]}>
            <div>Desk {i}</div>
          </Html>
        </Float>
      ))}
      {laid.map(({ it, c, core, pos }) => (
        <Line key={'l' + it.id} points={[core, pos]} color="#8a7f68" transparent opacity={0.5} lineWidth={1} />
      ))}
      {laid.map(({ it, rank, c, pos }) => (
        <StoryNode key={it.id} item={it} pos={pos} rank={rank} color={COLORS[c % COLORS.length]}
          dim={dimIds.has(it.id)} selected={selectedId === it.id} onSelect={onSelect} onHover={onHover} />
      ))}
    </group>
  )
}

/* ---------------- App ---------------- */
const SORTS = { top: 'Top first', new: 'Newest', az: 'A–Z' }

export default function App() {
  const [data, setData] = useState({ items: [], clusters: 0, count: 0 })
  const [live, setLive] = useState(false)
  const [filter, setFilter] = useState(-1)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('top')
  const [sel, setSel] = useState(null)
  const [hov, setHov] = useState(null)
  const [view, setView] = useState('front')
  const searchRef = useRef()

  const load = () => fetch(`${API}/api/pulse?limit=18`).then(r => r.json()).then(d => {
    setData(d); setSel(s => (s ? d.items.find(x => x.id === s.id) || null : null))
  }).catch(() => {})

  useEffect(() => {
    load()
    let ws
    try {
      ws = new WebSocket(API.replace('http', 'ws') + '/ws/pulse')
      ws.onopen = () => setLive(true)
      ws.onmessage = e => setData(JSON.parse(e.data))
      ws.onclose = () => setLive(false)
    } catch { /* REST mode */ }
    const key = e => {
      if (e.key === '/' && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape') { setQuery(''); setSel(null); searchRef.current?.blur() }
    }
    window.addEventListener('keydown', key)
    return () => { ws && ws.close(); window.removeEventListener('keydown', key) }
  }, [])

  const q = query.trim().toLowerCase()
  const ranked = useMemo(() => {
    const arr = [...data.items]
    if (sort === 'new') arr.sort((a, b) => (b.published_at || 0) - (a.published_at || 0))
    else if (sort === 'az') arr.sort((a, b) => a.title.localeCompare(b.title))
    else arr.sort((a, b) => b.score - a.score)
    return arr
  }, [data.items, sort])
  const shown = ranked.filter(it =>
    (filter < 0 || it.cluster === filter) && (!q || it.title.toLowerCase().includes(q)))
  const matchIds = useMemo(() => new Set(shown.map(it => it.id)), [shown])
  const dimIds = useMemo(() => new Set(data.items.map(i => i.id).filter(id => !matchIds.has(id))), [data.items, matchIds])
  const focus = hov || sel

  return (
    <div className="stage">
      <div className="grain" />
      {view === 'front' && (
      <div className="bg3d">
        <Canvas camera={{ position: [0, 2.8, 11.5], fov: 55 }} dpr={[1, 2]}>
          <color attach="background" args={['#f2ecdf']} />
          <fog attach="fog" args={['#f2ecdf', 15, 30]} />
          <hemisphereLight intensity={0.9} groundColor="#d8cdb4" />
          <directionalLight position={[6, 10, 4]} intensity={1.1} />
          <Grid infiniteGrid cellSize={0.9} sectionSize={4.5} cellColor="#ddd2bd" sectionColor="#c9bb9c"
            fadeDistance={30} fadeStrength={2} position={[0, -3.4, 0]} />
          <Rig items={ranked} dimIds={dimIds} selectedId={sel?.id} onSelect={setSel} onHover={setHov} />
          <OrbitControls enableZoom enablePan={false} minDistance={5} maxDistance={22} autoRotate autoRotateSpeed={0.35} />
        </Canvas>
      </div>
      )}

      <div className="hud">
        <header className="masthead sheet">
          <div className="dateline">{edition()} · No. {String(data.count).padStart(2, '0')} stories on the wire</div>
          <h1 className="nameplate">The Pulse</h1>
          <div className="mastrow">
            <span className={live ? 'stamp on' : 'stamp'}>{live ? '★ Live wire' : '○ Wire resting'}</span>
            <span className="meta">{data.clusters} desks · set in Newsreader & Plex Mono</span>
            <button className="pressbtn" onClick={load}>⟳ Pull latest</button>
          </div>
        </header>

        <nav className="sections sheet">
          <button className={view === 'front' ? 'sec active' : 'sec'} onClick={() => setView('front')}>❦ Front Page</button>
          <button className={view === 'markets' ? 'sec active' : 'sec'} onClick={() => setView('markets')}>$ The Ledger — Markets</button>
        </nav>

        {view === 'front' ? (<>
        <aside className="desk sheet">
          <h3>The Newsdesk</h3>
          <input ref={searchRef} className="search" placeholder="Search the wire…  ( / )" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="sortrow">{Object.entries(SORTS).map(([k, l]) => (
            <button key={k} className={sort === k ? 'sort active' : 'sort'} onClick={() => setSort(k)}>{l}</button>))}</div>
          <div className="chips">
            <button className={filter < 0 ? 'chip active' : 'chip'} onClick={() => setFilter(-1)}>All desks</button>
            {[...Array(data.clusters).keys()].map(c => (
              <button key={c} className={filter === c ? 'chip active' : 'chip'}
                style={{ '--c': COLORS[c % COLORS.length] }} onClick={() => setFilter(c)}>Desk {c}</button>
            ))}
          </div>
          <p className="colophon">Drag the orrery to look around · hover a bead for its headline · click to spike it to the desk. Wire refreshes every 30 seconds.</p>
        </aside>

        {focus && (
          <aside className="spike sheet">
            <button className="x" onClick={() => { setSel(null); setHov(null) }}>✕</button>
            <div className="kicker">Spiked · {focus.source === 'hackernews' ? 'Hacker News' : focus.source} · {ago(focus.published_at)}</div>
            <h2>{focus.title}</h2>
            <div className="deskline">Filed under Desk {focus.cluster} · ▲{focus.score} points · No.{ranked.findIndex(x => x.id === focus.id) + 1} on the wire</div>
            <div className="tags">{(focus.keywords || []).map(k => <span key={k}>{k}</span>)}</div>
            {focus.url && <a className="readbtn" href={focus.url} target="_blank" rel="noreferrer">Read the full story ↗</a>}
          </aside>
        )}

        <footer className="wire">
          <div className="wirehead">The Wire <span>{shown.length} stories · printed on pixels</span></div>
          <div className="wirescroll">
            {shown.map((it, i) => (
              <button key={it.id} className={'clip sheet' + (sel?.id === it.id ? ' sel' : '') + (i < 3 ? ' fold' : '')} onClick={() => setSel(it)}>
                <span className="rank">{i + 1}.</span>
                <span className="ctitle">{it.title}</span>
                <span className="cmeta">{ago(it.published_at)} · ▲{it.score} · Desk {it.cluster}</span>
              </button>
            ))}
          </div>
        </footer>
        </>) : (<Markets />)}
      </div>
    </div>
  )
}
