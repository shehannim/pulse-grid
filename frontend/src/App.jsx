import { useEffect, useMemo, useRef, useState } from "react";
import { api, fmtMoney, fmtNum, fmtInt } from "./api.js";
import Heatmap from "./Heatmap.jsx";

const SIZE_OPTS = [
  { k: "market_cap", label: "Market cap" },
  { k: "turnover", label: "Turnover" },
  { k: "volume", label: "Volume" },
];

function IndexCard({ name, q }) {
  const up = (q?.change || 0) >= 0;
  return (
    <div className="idx">
      <small>{name}</small>
      <b>{fmtNum(q?.value)}</b>
      <span className={up ? "up" : "down"}>
        {up ? "▲" : "▼"} {fmtNum(Math.abs(q?.change || 0))} ({fmtNum(Math.abs(q?.change_pct || 0))}%)
      </span>
    </div>
  );
}

function Movers({ movers }) {
  const cols = [
    ["Top gainers", movers.gainers, true],
    ["Top losers", movers.losers, false],
    ["Most active", movers.most_active, null],
  ];
  return (
    <div className="movergrid">
      {cols.map(([title, arr, happy]) => (
        <section key={title} className="panel">
          <h3>{title}</h3>
          {(arr || []).map((m, i) => (
            <a key={m.symbol} className="mrow" href={`https://www.cse.lk/pages/company-profile/company-profile.component.html?symbol=${m.symbol}`} target="_blank" rel="noreferrer">
              <span className="rank">{i + 1}</span>
              <span className="mbody">
                <b>{m.short} <em>{m.name.slice(0, 28)}</em></b>
                <span>Rs {fmtNum(m.price)} · Vol {fmtInt(m.volume)}</span>
              </span>
              <span className={happy == null ? "flat" : (m.change_pct >= 0 ? "up" : "down")}>
                {m.change_pct >= 0 ? "+" : ""}{fmtNum(m.change_pct)}%
              </span>
            </a>
          ))}
          {(!arr || !arr.length) && <p className="fine">No data.</p>}
        </section>
      ))}
    </div>
  );
}

function QuoteDrawer({ symbol, onClose }) {
  const [q, setQ] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!symbol) return;
    setQ(null); setErr("");
    api.quote(symbol).then(setQ).catch(() => setErr("Quote unavailable."));
  }, [symbol]);
  if (!symbol) return null;
  return (
    <aside className="drawer">
      <button className="x" onClick={onClose}>✕</button>
      {q ? (<>
        <small>{q.sector} · {q.symbol}</small>
        <h2>{q.name}</h2>
        <div className="qprice">Rs {fmtNum(q.price)} <span className={q.change >= 0 ? "up" : "down"}>{q.change >= 0 ? "▲" : "▼"} {fmtNum(Math.abs(q.change))} ({fmtNum(Math.abs(q.change_pct))}%)</span></div>
        <div className="qgrid">
          <div><small>Prev close</small><b>Rs {fmtNum(q.prev_close)}</b></div>
          <div><small>Day range</small><b>{fmtNum(q.low_day)} – {fmtNum(q.high_day)}</b></div>
          <div><small>52w range</small><b>{fmtNum(q.low_52w)} – {fmtNum(q.high_52w)}</b></div>
          <div><small>Volume</small><b>{fmtInt(q.volume)}</b></div>
          <div><small>Turnover</small><b>Rs {fmtMoney(q.turnover)}</b></div>
          <div><small>Trades</small><b>{fmtInt(q.trades)}</b></div>
          <div><small>Market cap</small><b>Rs {fmtMoney(q.market_cap)} ({fmtNum(q.market_cap_pct)}%)</b></div>
          <div><small>Beta vs S&P SL20</small><b>{fmtNum(q.beta_sl20)}</b></div>
        </div>
        <a className="readbtn" target="_blank" rel="noreferrer" href={`https://www.cse.lk/pages/company-profile/company-profile.component.html?symbol=${q.symbol}`}>Open on cse.lk ↗</a>
      </>) : err ? <p className="empty">{err}</p> : <p className="fine">Loading {symbol}…</p>}
    </aside>
  );
}

export default function App() {
  const [ov, setOv] = useState(null);
  const [hm, setHm] = useState({ tiles: [], sectors: [], count: 0 });
  const [movers, setMovers] = useState({ gainers: [], losers: [], most_active: [] });
  const [sectors, setSectors] = useState([]);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("map");
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("All");
  const [sizeBy, setSizeBy] = useState("market_cap");
  const [topN, setTopN] = useState(150);
  const [sel, setSel] = useState(null);
  const searchRef = useRef();

  const load = async () => {
    try {
      const [o, h, m, s] = await Promise.all([
        api.overview(), api.heatmap(300), api.movers(12), api.sectors(),
      ]);
      setOv(o); setHm(h); setMovers(m); setSectors(s.sectors || []);
      setErr(h.stale ? "CSE feed unreachable — showing last cached snapshot." : "");
    } catch {
      setErr("Backend unreachable. Start it: cd backend && uvicorn app.main:app --port 8000");
    }
  };

  useEffect(() => {
    load();
    let ws;
    try {
      ws = new WebSocket(api.wsURL());
      ws.onopen = () => setLive(true);
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.overview) setOv(d.overview);
          if (d.heatmap) setHm(d.heatmap);
        } catch { /* ignore */ }
      };
      ws.onclose = () => setLive(false);
    } catch { /* REST mode */ }
    const poll = setInterval(load, 120000);
    return () => { clearInterval(poll); ws && ws.close(); };
  }, []);

  useEffect(() => {
    const key = (e) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") { setQuery(""); setSel(null); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    let arr = [...(hm.tiles || [])];
    if (sector !== "All") arr = arr.filter((t) => t.sector === sector);
    if (q) arr = arr.filter((t) => t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || t.short.toLowerCase().includes(q));
    arr.sort((a, b) => b.market_cap - a.market_cap);
    return arr.slice(0, topN);
  }, [hm.tiles, sector, q, topN]);

  const sectorNames = useMemo(() => ["All", ...(hm.sectors || []).map((s) => s.name)], [hm]);

  return (
    <div className="cse">
      <header className="topbar">
        <div>
          <small className="kicker">Colombo Stock Exchange · cse.lk feed</small>
          <h1>CSE Heatmap <span>🇱🇰</span></h1>
        </div>
        <div className="statusrow">
          <span className={"pill" + (ov?.is_open ? " open" : "")}>{ov ? ov.market_status : "connecting…"}</span>
          <span className={live ? "live on" : "live"}>{live ? "● live (WS)" : "○ polling"}</span>
          <button className="refresh" onClick={load}>⟳ Refresh</button>
        </div>
      </header>

      <section className="stats">
        <IndexCard name="ASPI — All Share" q={ov?.aspi} />
        <IndexCard name="S&P SL20" q={ov?.sl20} />
        <div className="idx"><small>Turnover</small><b>Rs {fmtMoney(ov?.turnover)}</b><span className="fine">{fmtInt(ov?.share_volume)} shares · {fmtInt(ov?.trades)} trades</span></div>
        <div className="idx"><small>Market breadth</small><b><span className="up">{ov?.advances ?? 0} ▲</span> / <span className="down">{ov?.declines ?? 0} ▼</span></b><span className="fine">{ov?.listed_traded ?? 0} securities traded</span></div>
      </section>

      {err && <p className="warn">{err}</p>}

      <nav className="tabs">
        {[["map", "◧ Heatmap"], ["movers", "▲▼ Movers"], ["sectors", "◩ Sectors"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "tab active" : "tab"} onClick={() => setTab(k)}>{l}</button>
        ))}
        <span className="fine right">LKR · {hm.count} symbols · {filtered.length} shown</span>
      </nav>

      {tab === "map" && (<>
        <div className="tvtoolbar">
          <input ref={searchRef} className="search" placeholder="Search symbol or company…  ( / )" value={query} onChange={(e) => setQuery(e.target.value)} />
          <label>Block size
            <select value={sizeBy} onChange={(e) => setSizeBy(e.target.value)}>
              {SIZE_OPTS.map((o) => <option key={o.k} value={o.k}>{o.label}</option>)}
            </select>
          </label>
          <label>Block color
            <select value="change"><option value="change">Day change</option></select>
          </label>
          <label>Grouping
            <select value={sector} onChange={(e) => setSector(e.target.value)}>
              <option value="All">Sector</option>
              {sectorNames.filter((s) => s !== "All").map((s) => <option key={s} value={s}>{s} only</option>)}
            </select>
          </label>
          <select value={topN} onChange={(e) => setTopN(Number(e.target.value))}>
            {[60, 100, 150, 250, 300].map((n) => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </div>
        <Heatmap tiles={filtered} sizeBy={sizeBy} onPick={(t) => setSel(t.symbol)} selected={sel} />
      </>)}

      {tab === "movers" && <Movers movers={movers} />}

      {tab === "sectors" && (
        <section className="panel">
          <h3>CSE sector indices <span className="fine">cse.lk · allSectors</span></h3>
          <table className="board">
            <thead><tr><th>Sector</th><th className="num">Index</th><th className="num">Chg%</th><th className="num">Turnover</th><th className="num">Trades</th></tr></thead>
            <tbody>{sectors.map((s) => (
              <tr key={s.symbol || s.name}>
                <td><b>{s.name}</b> <span className="fine">{s.symbol}</span></td>
                <td className="num">{fmtNum(s.index)}</td>
                <td className={"num " + (s.change >= 0 ? "up" : "down")}>{s.change >= 0 ? "+" : ""}{fmtNum(s.change_pct)}%</td>
                <td className="num">Rs {fmtMoney(s.turnover)}</td>
                <td className="num">{fmtInt(s.trades)}</td>
              </tr>))}
            </tbody>
          </table>
        </section>
      )}

      <QuoteDrawer symbol={sel} onClose={() => setSel(null)} />

      <footer className="foot">
        Data: unofficial <a href="https://www.cse.lk" target="_blank" rel="noreferrer">cse.lk</a> API
        (docs: <a href="https://github.com/GH0STH4CKER/Colombo-Stock-Exchange-CSE-API-Documentation" target="_blank" rel="noreferrer">GH0STH4CKER/CSE-API-Documentation</a>).
        Delayed · educational only, not investment advice.
      </footer>
    </div>
  );
}
