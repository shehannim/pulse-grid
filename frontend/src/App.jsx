import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, OrbitControls, Html, Float, Line } from '@react-three/drei'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const COLORS = ['#00D4FF', '#A78BFA', '#34D399', '#FBBF24', '#FB7185', '#FACC15']
const CORES = [[4.6, 0.6, 0], [-4.6, 0.9, 0.6], [0, -1.2, -4.2], [0, 2.4, 4.2], [-2.5, -2.2, 2.5], [2.5, -2.4, -2.5]]

function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) }

/* ---------------- 3D nodes ---------------- */
function StoryNode({ item, pos, color, dim, selected, onSelect, onHover }) {
  const ref = useRef()
  const [hov, setHov] = useState(false)
  const size = 0.16 + Math.min(item.score / 400, 1) * 0.28
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const s = (selected ? 1.6 : hov ? 1.35 : 1) * (dim ? 0.35 : 1)
    ref.current.scale.setScalar(s)
    ref.current.position.y = pos[1] + Math.sin(t * 1.4 + pos[0]) * 0.12
  })
  return (
    <mesh ref={ref} position={pos}
      onClick={e => { e.stopPropagation(); onSelect(item) }}
      onPointerOver={e => { e.stopPropagation(); setHov(true); onHover(item); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHov(false); onHover(null); document.body.style.cursor = 'auto' }}>
      <sphereGeometry args={[size, 28, 28]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={selected || hov ? 1.6 : 0.55}
        transparent opacity={dim ? 0.25 : 1} roughness={0.25} metalness={0.6} />
      {(hov || selected) && (
        <Html distanceFactor={9} center className="node-tip" occlude={false}>
          <div style={{ borderColor: color }}>{item.title.slice(0, 64)}</div>
        </Html>
      )}
    </mesh>
  )
}

function Rig({ items, dimIds, selectedId, onSelect, onHover }) {
  const rig = useRef()
  const [paused, setPaused] = useState(false)
  useFrame((_, d) => { if (!paused && rig.current) rig.current.rotation.y += d * 0.06 })
  const laid = useMemo(() => items.map(it => {
    const c = it.cluster % CORES.length
    const core = CORES[c]
    const h = hash(String(it.id))
    const a = (h % 360) * Math.PI / 180
    const r = 1.3 + (h % 100) / 100 * 1.1
    const pos = [core[0] + Math.cos(a) * r, core[1] + ((h >> 3) % 140) / 100 - 0.7, core[2] + Math.sin(a) * r]
    return { it, c, core, pos }
  }), [items])
  return (
    <group ref={rig} onPointerOver={() => setPaused(true)} onPointerOut={() => setPaused(false)}>
      {CORES.map((p, i) => (
        <Float key={i} speed={2} rotationIntensity={1.2} floatIntensity={1.4}>
          <mesh position={p}>
            <octahedronGeometry args={[0.42, 0]} />
            <meshStandardMaterial color={COLORS[i % COLORS.length]} emissive={COLORS[i % COLORS.length]}
              emissiveIntensity={1.1} wireframe transparent opacity={0.9} />
          </mesh>
          <Html distanceFactor={11} center className="core-tag"><div>C{i}</div></Html>
        </Float>
      ))}
      {laid.map(({ it, c, core, pos }) => (
        <Line key={'l' + it.id} points={[core, pos]} color={COLORS[c % COLORS.length]} transparent opacity={0.35} lineWidth={1} />
      ))}
      {laid.map(({ it, c, pos }) => (
        <StoryNode key={it.id} item={it} pos={pos} color={COLORS[c % COLORS.length]}
          dim={dimIds.has(it.id)} selected={selectedId === it.id} onSelect={onSelect} onHover={onHover} />
      ))}
    </group>
  )
}

/* ---------------- App ---------------- */
export default function App() {
  const [data, setData] = useState({ items: [], clusters: 0, count: 0 })
  const [live, setLive] = useState(false)
  const [filter, setFilter] = useState(-1)
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(null)
  const [hov, setHov] = useState(null)

  const load = () => fetch(`${API}/api/pulse?limit=18`).then(r => r.json()).then(d => {
    setData(d); setSel(s => (s ? d.items.find(x => x.id === s.id) || null : null))
  }).catch(() => {})

  useEffect(() => {
    load()
    let ws
    try {
      ws = new WebSocket(API.replace('http', 'ws') + '/ws/pulse')
      ws.onopen = () => setLive(true)
      ws.onmessage = e => { const d = JSON.parse(e.data); setData(d) }
      ws.onclose = () => setLive(false)
    } catch { /* REST mode */ }
    return () => ws && ws.close()
  }, [])

  const q = query.trim().toLowerCase()
  const matchIds = useMemo(() => new Set(
    data.items.filter(it =>
      (filter < 0 || it.cluster === filter) &&
      (!q || it.title.toLowerCase().includes(q))).map(it => it.id)
  ), [data.items, filter, q])
  const dimIds = useMemo(() => new Set(data.items.map(i => i.id).filter(id => !matchIds.has(id))), [data.items, matchIds])
  const shown = data.items.filter(it => matchIds.has(it.id))
  const focus = hov || sel

  return (
    <div className="stage">
      <div className="bg3d">
        <Canvas camera={{ position: [0, 2.6, 11.5], fov: 55 }} dpr={[1, 2]}>
          <ambientLight intensity={0.7} />
          <pointLight position={[10, 10, 10]} intensity={1.2} />
          <pointLight position={[-10, -4, -6]} intensity={0.6} color="#A78BFA" />
          <Stars radius={60} depth={40} count={2200} factor={3.2} saturation={0.4} fade speed={1.2} />
          <Rig items={data.items} dimIds={dimIds} selectedId={sel?.id} onSelect={setSel} onHover={setHov} />
          <OrbitControls enableZoom enablePan={false} minDistance={5} maxDistance={22} autoRotate autoRotateSpeed={0.4} />
        </Canvas>
      </div>

      <div className="hud">
        <header className="top glass">
          <div>
            <h1 className="logo">⚡ Pulse<span>Grid</span></h1>
            <p className="sub">Realtime open-source pulse · HN live + clustering · drag to orbit · scroll to zoom</p>
          </div>
          <div className="stats">
            <span className={live ? 'live on' : 'live'}><i />{live ? 'LIVE · WS' : 'REST MODE'}</span>
            <span className="pill"><b>{data.count}</b> stories</span>
            <span className="pill"><b>{data.clusters}</b> clusters</span>
            <button className="btn" onClick={load}>⟳ refresh</button>
          </div>
        </header>

        <aside className="deck glass">
          <input className="search" placeholder="⌕ search stories…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="chips">
            <button className={filter < 0 ? 'chip active' : 'chip'} onClick={() => setFilter(-1)}>✦ All</button>
            {[...Array(data.clusters).keys()].map(c => (
              <button key={c} className={filter === c ? 'chip active' : 'chip'}
                style={{ '--c': COLORS[c % COLORS.length] }} onClick={() => setFilter(c)}>◉ C{c}</button>
            ))}
          </div>
          <div className="legend">{COLORS.slice(0, Math.max(data.clusters, 1)).map((c, i) => (
            <span key={i}><i style={{ background: c }} />C{i}</span>))}</div>
          <p className="hint">Hover a node for its title · click to inspect · {shown.length} in view</p>
        </aside>

        {focus && (
          <aside className="inspector glass" style={{ '--c': COLORS[(focus.cluster || 0) % COLORS.length] }}>
            <button className="x" onClick={() => { setSel(null); setHov(null) }}>✕</button>
            <small>{focus.source} · ▲{focus.score} · cluster {focus.cluster}</small>
            <h2>{focus.title}</h2>
            <div className="tags">{(focus.keywords || []).map(k => <span key={k}>#{k}</span>)}</div>
            {focus.url && <a className="cta" href={focus.url} target="_blank" rel="noreferrer">Open story ↗</a>}
          </aside>
        )}

        <footer className="feed">
          {shown.map(it => (
            <button key={it.id} className={'fcard glass' + (sel?.id === it.id ? ' sel' : '')}
              style={{ '--c': COLORS[it.cluster % COLORS.length] }} onClick={() => setSel(it)}>
              <small>C{it.cluster} · ▲{it.score}</small>
              <span>{it.title}</span>
            </button>
          ))}
        </footer>
      </div>
    </div>
  )
}
