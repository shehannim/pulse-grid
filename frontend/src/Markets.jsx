import { useEffect, useMemo, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const QUERIES = ['stock market', 'S&P 500', 'Nvidia', 'interest rates', 'IPO']

function ago(ts) {
  if (!ts) return 'undated'
  const m = Math.max(1, Math.round((Date.now() / 1000 - ts) / 60))
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function Spark({ data, w = 130, h = 36 }) {
  if (!data || data.length < 2) return <span className="nospark">—</span>
  const min = Math.min(...data), max = Math.max(...data), rg = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1) * w).toFixed(1)},${(h - 3 - ((v - min) / rg) * (h - 9)).toFixed(1)}`).join(' ')
  const up = data[data.length - 1] >= data[0]
  return (
    <svg width={w} height={h} className="spark">
      <polyline points={pts} fill="none" stroke={up ? '#3a6b4f' : '#b0321f'} strokeWidth="1.7" />
      <circle cx={w - 2} cy={h - 3 - ((data[data.length - 1] - min) / rg) * (h - 9)} r="2.6" fill={up ? '#3a6b4f' : '#b0321f'} />
    </svg>
  )
}

function fmt(n, d = 2) { return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) }

export default function Markets() {
  const [q, setQ] = useState({ indices: [], stocks: [], stale: false, as_of: '' })
  const [news, setNews] = useState({ items: [], count: 0 })
  const [query, setQuery] = useState(QUERIES[0])
  const [sort, setSort] = useState({ k: 'symbol', dir: 1 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/stocks`).then(r => r.json()).then(d => {
      setQ(d); setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch(`${API}/api/market-news?query=${encodeURIComponent(query)}&limit=15`)
      .then(r => r.json()).then(setNews).catch(() => {})
  }, [query])

  const rows = useMemo(() => {
    const arr = [...q.stocks]
    const { k, dir } = sort
    arr.sort((a, b) => (a[k] > b[k] ? 1 : -1) * dir)
    return arr
  }, [q.stocks, sort])

  const th = k => () => setSort(s => ({ k, dir: s.k === k ? -s.dir : 1 }))
  const tape = [...q.indices, ...[...q.stocks].sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct)).slice(0, 5)]

  return (
    <div className="ledger">
      {tape.length > 0 && (
        <div className="tape sheet">
          <div className="tapetrack">
            {[...tape, ...tape].map((s, i) => (
              <span key={i} className={s.change >= 0 ? 'tk up' : 'tk down'}>
                {s.symbol} {fmt(s.price)} <b>{s.change >= 0 ? '▲' : '▼'} {fmt(Math.abs(s.change_pct))}%</b>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="ledgergrid">
        <section className="sheet ledgersec">
          <h3>Closing Prices <span className="fine">delayed ~15m · Yahoo</span></h3>
          {loading && <p className="fine">Fetching the tape…</p>}
          {q.stale && !loading && <p className="warn">Market feed unreachable — showing nothing rather than stale ink.</p>}
          <div className="idxrow">
            {q.indices.map(s => (
              <div key={s.symbol} className="idxcard">
                <small>{s.name}</small>
                <b>{fmt(s.price)}</b>
                <span className={s.change >= 0 ? 'up' : 'down'}>{s.change >= 0 ? '▲' : '▼'} {fmt(s.change)} ({fmt(Math.abs(s.change_pct))}%)</span>
                <Spark data={s.spark} />
              </div>
            ))}
          </div>
          <table className="board">
            <thead><tr>
              <th onClick={th('symbol')}>Company ↕</th>
              <th onClick={th('price')}>Price ↕</th>
              <th onClick={th('change')}>Chg ↕</th>
              <th onClick={th('change_pct')}>Chg% ↕</th>
              <th>30 sessions</th>
            </tr></thead>
            <tbody>{rows.map(s => (
              <tr key={s.symbol}>
                <td><b>{s.symbol}</b> <span className="fine">{s.name}</span></td>
                <td className="num">{fmt(s.price)}</td>
                <td className={'num ' + (s.change >= 0 ? 'up' : 'down')}>{s.change >= 0 ? '+' : ''}{fmt(s.change)}</td>
                <td className={'num ' + (s.change >= 0 ? 'up' : 'down')}>{s.change >= 0 ? '▲' : '▼'} {fmt(Math.abs(s.change_pct))}%</td>
                <td><Spark data={s.spark} /></td>
              </tr>))}
            </tbody>
          </table>
        </section>

        <section className="sheet ledgersec">
          <h3>Market Talk <span className="fine">Hacker News · {news.count} stories</span></h3>
          <div className="qrow">{QUERIES.map(x => (
            <button key={x} className={query === x ? 'qbtn active' : 'qbtn'} onClick={() => setQuery(x)}>{x}</button>))}</div>
          <div className="mktnews">
            {news.items.map((n, i) => (
              <a key={n.id} className="mktclip" href={n.url} target="_blank" rel="noreferrer">
                <span className="rank">{i + 1}.</span>
                <span>
                  <span className="ctitle">{n.title}</span>
                  <span className="cmeta">{ago(n.published_at)} · ▲{n.points}{n.author ? ` · by ${n.author}` : ''}</span>
                </span>
              </a>
            ))}
            {news.count === 0 && <p className="fine">Nothing filed under “{query}” yet.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
