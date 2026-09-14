import { useEffect, useMemo, useRef, useState } from "react";
import { fmtMoney, fmtNum, fmtInt } from "./api.js";

/* TradingView-style heatmap: ONE squarified treemap, sectors laid out first,
   tiles squarified inside their sector rect. Continuous red->green scale. */

const BG = [19, 23, 34]; // #131722
const RED = [242, 54, 69];
const GREEN = [8, 153, 129];
const FLAT = "#2A2E39";
const GAP = 3;
const HEAD_H = 24;

function mix(a, b, t) {
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
}

export function tvColor(pct, scale) {
  if (pct == null || isNaN(pct)) return FLAT;
  const p = Number(pct);
  if (Math.abs(p) < 0.051) return FLAT;
  const t = Math.min(1, Math.abs(p) / (scale || 3));
  return mix(BG, p < 0 ? RED : GREEN, 0.2 + 0.8 * t);
}

/* ---- squarified treemap (Bruls et al.) ---- */
function worst(row, sum, side) {
  let mx = -Infinity, mn = Infinity;
  for (const r of row) { if (r.v > mx) mx = r.v; if (r.v < mn) mn = r.v; }
  const s2 = sum * sum, side2 = side * side;
  return Math.max((side2 * mx) / s2, s2 / (side2 * mn));
}

function squarify(items, x, y, w, h) {
  // items: [{v, ...}] v > 0. returns [{..., x, y, w, h}]
  const total = items.reduce((s, d) => s + d.v, 0);
  if (!total || w <= 0 || h <= 0) return [];
  const scale = (w * h) / total;
  const nodes = items.map((d) => ({ ...d, v: Math.max(d.v * scale, 0.01) }));
  const out = [];
  let cx = x, cy = y, cw = w, ch = h, i = 0;
  while (i < nodes.length && cw > 0 && ch > 0) {
    const side = Math.min(cw, ch);
    const row = [];
    let sum = 0, best = Infinity;
    while (i < nodes.length) {
      row.push(nodes[i]); sum += nodes[i].v;
      const wv = worst(row, sum, side);
      if (wv <= best) { best = wv; i++; }
      else { sum -= row.pop().v; break; }
    }
    if (!row.length) { row.push(nodes[i]); sum = nodes[i].v; i++; }
    if (cw <= ch) {
      // horizontal band across full width
      const bh = sum / cw;
      let bx = cx;
      for (const r of row) {
        const bw = r.v / sum * cw;
        out.push({ ...r, x: bx, y: cy, w: bw, h: bh });
        bx += bw;
      }
      cy += bh; ch -= bh;
    } else {
      // vertical band down full height
      const bw = sum / ch;
      let by = cy;
      for (const r of row) {
        const bh = r.v / sum * ch;
        out.push({ ...r, x: cx, y: by, w: bw, h: bh });
        by += bh;
      }
      cx += bw; cw -= bw;
    }
  }
  return out;
}

function p95Scale(tiles) {
  const a = tiles.map((t) => Math.abs(t.change_pct || 0)).sort((x, y) => x - y);
  if (!a.length) return 3;
  const v = a[Math.min(a.length - 1, Math.floor(a.length * 0.95))];
  return Math.max(1, v || 1);
}

export default function Heatmap({ tiles, sizeBy, onPick, selected }) {
  const ref = useRef(null);
  const [box, setBox] = useState({ w: 1000, h: 620 });
  const [tip, setTip] = useState(null); // {t, x, y}

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setBox({ w: el.clientWidth || 1000, h: el.clientHeight || 620 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const val = (t) => {
    if (sizeBy === "turnover") return t.turnover || 1;
    if (sizeBy === "volume") return t.volume || 1;
    return t.market_cap || 1;
  };

  const layout = useMemo(() => {
    const groups = new Map();
    for (const t of tiles) {
      const g = groups.get(t.sector) || { name: t.sector, items: [], v: 0 };
      g.items.push(t); g.v += val(t);
      groups.set(t.sector, g);
    }
    const secs = [...groups.values()].sort((a, b) => b.v - a.v);
    const placed = squarify(secs, 0, 0, box.w, box.h);
    const out = [];
    for (const s of placed) {
      const hasHead = s.h > 64;
      const ix = s.x + GAP / 2, iy = s.y + GAP / 2 + (hasHead ? HEAD_H : 0);
      const iw = Math.max(0, s.w - GAP), ih = Math.max(0, s.h - GAP - (hasHead ? HEAD_H : 0));
      const kids = s.items
        .map((t) => ({ ...t, v: val(t) }))
        .sort((a, b) => b.v - a.v);
      const laid = squarify(kids, ix, iy, iw, ih);
      out.push({ sector: s, tiles: laid, hasHead });
    }
    return out;
  }, [tiles, sizeBy, box]);

  const scale = useMemo(() => p95Scale(tiles), [tiles]);

  if (!tiles.length) return <p className="empty">No symbols match this filter.</p>;

  return (
    <>
      <div ref={ref} className="tvmap" onMouseLeave={() => setTip(null)}>
        {layout.map(({ sector: s, tiles: kids, hasHead }) => (
          <div key={s.name}>
            {hasHead && (
              <div className="tvseclabel" style={{ left: s.x + 6, top: s.y + 4, width: s.w - 12 }}>
                {s.name}
              </div>
            )}
            {kids.map((t) => {
              const big = t.w >= 110 && t.h >= 64;
              const med = t.w >= 58 && t.h >= 42;
              const tiny = t.w >= 32 && t.h >= 26;
              return (
                <button
                  key={t.symbol}
                  className={"tvtile" + (selected === t.symbol ? " sel" : "")}
                  style={{ left: t.x, top: t.y, width: t.w, height: t.h, background: tvColor(t.change_pct, scale) }}
                  onClick={() => onPick(t)}
                  onMouseMove={(e) => setTip({ t, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setTip(null)}
                >
                  {tiny && <span className="tvshort">{t.short}</span>}
                  {med && <span className="tvpct">{t.change_pct >= 0 ? "+" : ""}{fmtNum(t.change_pct)}%</span>}
                  {big && <span className="tvsub">Rs {fmtNum(t.price)}</span>}
                </button>
              );
            })}
          </div>
        ))}
        {tip && (
          <div className="tvtip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 250), top: Math.min(tip.y + 14, window.innerHeight - 190) }}>
            <b>{tip.t.short} <em>{tip.t.sector}</em></b>
            <span className="tipname">{tip.t.name}</span>
            <span>Rs {fmtNum(tip.t.price)} <i className={tip.t.change >= 0 ? "up" : "down"}>{tip.t.change >= 0 ? "+" : ""}{fmtNum(tip.t.change)} ({tip.t.change_pct >= 0 ? "+" : ""}{fmtNum(tip.t.change_pct)}%)</i></span>
            <span>MCap Rs {fmtMoney(tip.t.market_cap)} · Vol {fmtInt(tip.t.volume)}</span>
            <span>Turnover Rs {fmtMoney(tip.t.turnover)} · {fmtInt(tip.t.trades)} trades</span>
          </div>
        )}
      </div>
      <div className="tvscale">
        <span>-{fmtNum(scale)}%</span>
        <div className="tvgrad" />
        <span>+{fmtNum(scale)}%</span>
        <em>Day change · block size: {sizeBy === "market_cap" ? "market cap" : sizeBy} · {tiles.length} symbols</em>
      </div>
    </>
  );
}
