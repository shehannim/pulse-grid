import { useEffect, useMemo, useRef, useState } from "react";
import { api, fmtMoney, fmtNum, fmtInt } from "./api.js";

const TFS = ["1D", "1W", "1M", "3M", "1Y"];
const UP = "#089981", DOWN = "#F23645";

/** TV-style chart with hover crosshair */
function TvChart({ points, up, tf }) {
  const ref = useRef(null);
  const [hov, setHov] = useState(null);
  const W = 360, H = 150, P = 6;
  const color = up ? UP : DOWN;

  const geom = useMemo(() => {
    if (!points.length) return null;
    const vs = points.map((p) => p.close);
    let mn = Math.min(...vs), mx = Math.max(...vs);
    if (mx - mn < 1e-9) { mn -= 1; mx += 1; }
    const X = (i) => P + (i / Math.max(1, points.length - 1)) * (W - 2 * P);
    const Y = (v) => P + (1 - (v - mn) / (mx - mn)) * (H - 2 * P);
    const line = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.close).toFixed(1)}`).join(" ");
    return { X, Y, line, mn, mx };
  }, [points]);

  if (!geom) return <p className="fine">No chart data.</p>;
  const gid = "tvg" + (up ? "u" : "d");

  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - P) / (W - 2 * P)) * (points.length - 1));
    if (i >= 0 && i < points.length) setHov(i);
  };

  const hp = hov != null ? points[hov] : null;
  const dt = hp ? new Date(hp.t) : null;

  return (
    <div>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="tvchart" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${geom.line} L${W - P},${H - P} L${P},${H - P} Z`} fill={`url(#${gid})`} />
        <path d={geom.line} fill="none" stroke={color} strokeWidth="1.8" />
        {hov != null && (
          <g>
            <line x1={geom.X(hov)} y1="0" x2={geom.X(hov)} y2={H} stroke="#787B86" strokeDasharray="3 3" strokeWidth="1" />
            <circle cx={geom.X(hov)} cy={geom.Y(hp.close)} r="3.5" fill={color} stroke="#fff" strokeWidth="1" />
          </g>
        )}
      </svg>
      <div className="tvchartfoot">
        <span>{new Date(points[0].t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        {hp && <b>Rs {fmtNum(hp.close)} · {dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{tf === "1D" ? ` ${dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : ""}</b>}
        <span>{new Date(points[points.length - 1].t).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
      </div>
    </div>
  );
}

/** TradingView-style symbol detail panel */
export default function Detail({ symbol, onClose }) {
  const [q, setQ] = useState(null);
  const [tf, setTf] = useState("1Y");
  const [chart, setChart] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setQ(null); setChart(null);
    api.quote(symbol).then(setQ).catch(() => {});
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    api.chart(symbol, tf).then((c) => setChart(c)).catch(() => setChart(null)).finally(() => setLoading(false));
  }, [symbol, tf]);

  if (!symbol) return null;
  const up = (q?.change ?? 0) >= 0;
  const pts = chart?.points || [];
  const first = pts[0]?.close, last = pts[pts.length - 1]?.close;
  const tfChg = first && last ? ((last - first) / first) * 100 : null;

  return (
    <aside className="tvdetail">
      <button className="x" onClick={onClose}>✕</button>
      <div className="tvdsym">
        <span className="tvavatar">{(q?.short || symbol).slice(0, 1)}</span>
        <div>
          <b>{q?.short || symbol}</b>
          <span className="fine"> · Colombo Stock Exchange · {q?.sector}</span>
          <div className="tipname">{q?.name}</div>
        </div>
      </div>
      {q && (
        <div className="tvdprice">
          <b>Rs {fmtNum(q.price)}</b>
          <span className={up ? "up" : "down"}>{up ? "+" : ""}{fmtNum(q.change)} ({up ? "+" : ""}{fmtNum(q.change_pct)}%)</span>
          <span className="fine">Today</span>
        </div>
      )}
      <div className="tvtf">
        {TFS.map((t) => (
          <button key={t} className={tf === t ? "active" : ""} onClick={() => setTf(t)}>{t}</button>
        ))}
        {tfChg != null && <span className={tfChg >= 0 ? "up" : "down"}>{tfChg >= 0 ? "+" : ""}{fmtNum(tfChg)}%</span>}
      </div>
      {loading ? <p className="fine">Loading chart…</p> : <TvChart points={pts} up={(last ?? 0) >= (first ?? 0)} tf={tf} />}
      {q && (
        <div className="tvdgrid">
          {[["Prev close", `Rs ${fmtNum(q.prev_close)}`], ["Open", q.open ? `Rs ${fmtNum(q.open)}` : "—"],
            ["Day range", `${fmtNum(q.low_day)} – ${fmtNum(q.high_day)}`],
            ["52w range", `${fmtNum(q.low_52w)} – ${fmtNum(q.high_52w)}`],
            ["Volume", fmtInt(q.volume)], ["Turnover", `Rs ${fmtMoney(q.turnover)}`],
            ["Trades", fmtInt(q.trades)], ["Market cap", `Rs ${fmtMoney(q.market_cap)}`],
            ["% of market", `${fmtNum(q.market_cap_pct)}%`], ["Beta vs SL20", fmtNum(q.beta_sl20)],
          ].map(([k, v]) => <div key={k} className="tvdrow"><span>{k}</span><b>{v}</b></div>)}
        </div>
      )}
      <div className="tvdact">
        <a className="tvbuy" target="_blank" rel="noreferrer" href={`https://www.cse.lk/pages/company-profile/company-profile.component.html?symbol=${symbol}`}>View on cse.lk ↗</a>
      </div>
      <p className="fine">Delayed data · educational only, not investment advice.</p>
    </aside>
  );
}
