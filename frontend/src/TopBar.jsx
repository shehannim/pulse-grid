/** TradingView-style top navigation */
export default function TopBar({ query, setQuery, status, live, tab, setTab, searchRef }) {
  const tabs = [
    ["map", "Stock Heatmap"],
    ["movers", "Movers"],
    ["sectors", "Sectors"],
  ];
  return (
    <>
      <div className="tvnav">
        <div className="tvbrand">
          <span className="tvlogo">C</span>
          <b>CSE Pulse</b>
          <span className="tvsub">Colombo Stock Exchange</span>
        </div>
        <div className="tvnavlinks">
          <span>Markets</span><span>Brokers</span><span>News</span><span>Screener</span><span>More</span>
        </div>
        <input
          ref={searchRef}
          className="tvnavsearch"
          placeholder="Search symbols or companies…  ( / )"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className={"pill small" + (status?.is_open ? " open" : "")}>{status ? status.market_status : "…"}</span>
        <span className={live ? "live on" : "live"}>{live ? "● Live" : "○ Delayed"}</span>
        <a className="tvcta" href="https://www.cse.lk" target="_blank" rel="noreferrer">cse.lk ↗</a>
      </div>
      <div className="tvtabs">
        {tabs.map(([k, l]) => (
          <button key={k} className={tab === k ? "tvtab active" : "tvtab"} onClick={() => setTab(k)}>{l}</button>
        ))}
        <span className="fine right">LKR · Delayed · Educational only</span>
      </div>
    </>
  );
}
