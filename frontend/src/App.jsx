import { useEffect, useMemo, useRef, useState } from "react";
import { api, fmtMoney, fmtNum, fmtInt } from "./api.js";
import Heatmap from "./Heatmap.jsx";
import Drop from "./Drop.jsx";
import TopBar from "./TopBar.jsx";
import Detail from "./Detail.jsx";

const SIZE_OPTS = [
  { k: "market_cap", label: "Market cap" },
  { k: "turnover", label: "Turnover" },
  { k: "volume", label: "Volume" },
];
const COLOR_OPTS = [
  { k: "pct", label: "Day change %" },
  { k: "abs", label: "Day change Rs" },
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

function Movers({ movers, onPick }) {
  const cols = [
    ["Top gainers", movers.gainers],
    ["Top losers", movers.losers],
    ["Most active", movers.most_active],
  ];
  return (
    <div className="movergrid">
      {cols.map(([title, arr]) => (
        <section key={title} className="panel">
          <h3>{title}</h3>
          {(arr || []).map((m, i) => (
            <button key={m.symbol} className="mrow" onClick={() => onPick(m.symbol)}>
              <span className="rank">{i + 1}</span>
              <span className="mbody">
                <b>{m.short} <em>{m.name.slice(0, 28)}</em></b>
                <span>Rs {fmtNum(m.price)} · Vol {fmtInt(m.volume)}</span>
              </span>
              <span className={m.change_pct >= 0 ? "up" : "down"}>
                {m.change_pct >= 0 ? "+" : ""}{fmtNum(m.change_pct)}%
              </span>
            </button>
          ))}
          {(!arr || !arr.length) && <p className="fine">No data.</p>}
        </section>
      ))}
    </div>
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
  const [colorBy, setColorBy] = useState("pct");
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
      <TopBar query={query} setQuery={setQuery} status={ov} live={live} tab={tab} setTab={setTab} searchRef={searchRef} />

      <section className="stats">
        <IndexCard name="ASPI — All Share" q={ov?.aspi} />
        <IndexCard name="S&P SL20" q={ov?.sl20} />
        <div className="idx"><small>Turnover</small><b>Rs {fmtMoney(ov?.turnover)}</b><span className="fine">{fmtInt(ov?.share_volume)} shares · {fmtInt(ov?.trades)} trades</span></div>
        <div className="idx"><small>Market breadth</small><b><span className="up">{ov?.advances ?? 0} ▲</span> / <span className="down">{ov?.declines ?? 0} ▼</span></b><span className="fine">{ov?.listed_traded ?? 0} securities traded</span></div>
        <button className="refresh idxbtn" onClick={load}>⟳ Refresh</button>
      </section>

      {err && <p className="warn">{err}</p>}

      {tab === "map" && (<>
        <div className="tvtoolbar">
          <Drop label="Block size" value={sizeBy} options={SIZE_OPTS} onPick={setSizeBy} />
          <Drop label="Block color" value={colorBy} options={COLOR_OPTS} onPick={setColorBy} />
          <Drop label="Grouping" value={sector} options={[{ k: "All", label: "Sector" }, ...sectorNames.filter((s) => s !== "All").map((s) => ({ k: s, label: s }))]} onPick={setSector} />
          <Drop label="Symbols" value={String(topN)} options={[60, 100, 150, 250, 300].map((n) => ({ k: String(n), label: `Top ${n}` }))} onPick={(v) => setTopN(Number(v))} />
          <span className="fine right">{hm.count} symbols · {filtered.length} shown</span>
        </div>
        <Heatmap tiles={filtered} sizeBy={sizeBy} colorBy={colorBy} onPick={(t) => setSel(t.symbol)} selected={sel} />
      </>)}

      {tab === "movers" && <Movers movers={movers} onPick={setSel} />}

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

      <Detail symbol={sel} onClose={() => setSel(null)} />

      <footer className="tvstatus">
        <span><i className="dot" /> CSE · Delayed data · educational only, not investment advice</span>
        <span>Source: unofficial <a href="https://www.cse.lk" target="_blank" rel="noreferrer">cse.lk</a> API · <a href="https://github.com/GH0STH4CKER/Colombo-Stock-Exchange-CSE-API-Documentation" target="_blank" rel="noreferrer">endpoint docs</a></span>
      </footer>
    </div>
  );
}
