import { heatColor, fmtMoney, fmtNum } from "./api.js";

/**
 * Sector-grouped heatmap. Each sector is a block; tiles inside scale
 * with sqrt(sizeMetric) so mega-caps (DIAL, JKH) dominate honestly
 * without crushing small caps to zero pixels.
 */
export default function Heatmap({ tiles, sizeBy, onPick, selected }) {
  const groups = {};
  for (const t of tiles) {
    (groups[t.sector] ||= []).push(t);
  }
  const ordered = Object.entries(groups).sort(
    (a, b) => sum(b[1]) - sum(a[1])
  );

  function val(t) {
    if (sizeBy === "turnover") return t.turnover || 1;
    if (sizeBy === "volume") return t.volume || 1;
    return t.market_cap || 1;
  }
  function sum(arr) {
    return arr.reduce((s, t) => s + val(t), 0);
  }

  if (!tiles.length) return <p className="empty">No symbols match this filter.</p>;

  return (
    <div className="mapwrap">
      {ordered.map(([sector, arr]) => (
        <section key={sector} className="sector">
          <header className="sectorhead">
            <b>{sector}</b>
            <span>{arr.length} cos · {fmtMoney(sum(arr))}</span>
          </header>
          <div className="tiles">
            {[...arr]
              .sort((a, b) => val(b) - val(a))
              .map((t) => {
                const w = 70 + Math.sqrt(val(t) / sum(arr)) * 420;
                return (
                  <button
                    key={t.symbol}
                    onClick={() => onPick(t)}
                    className={"tile" + (selected === t.symbol ? " sel" : "")}
                    style={{ background: heatColor(t.change_pct), flexGrow: Math.round(Math.sqrt(val(t))), flexBasis: `${Math.round(Math.min(260, Math.max(86, w)))}px` }}
                    title={`${t.name}\nRs ${fmtNum(t.price)} (${t.change >= 0 ? "+" : ""}${fmtNum(t.change)} / ${t.change_pct}%)\nVol ${t.volume.toLocaleString()} · MCap Rs ${fmtMoney(t.market_cap)}`}
                  >
                    <span className="tsym">{t.short}</span>
                    <span className="tprice">Rs {fmtNum(t.price)}</span>
                    <span className="tpct">{t.change_pct >= 0 ? "+" : ""}{fmtNum(t.change_pct)}%</span>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
