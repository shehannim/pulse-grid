import { useEffect, useRef, useState } from "react";

/** TradingView-style dropdown: button + popover menu, closes on outside click / Esc */
export default function Drop({ label, value, options, onPick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = options.find((o) => o.k === value);

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open ]);

  return (
    <div className="drop" ref={ref}>
      <span className="droplabel">{label}</span>
      <button className={"dropbtn" + (open ? " open" : "")} onClick={() => setOpen((o) => !o)}>
        {cur?.label || value} <i>▾</i>
      </button>
      {open && (
        <div className="dropmenu">
          {options.map((o) => (
            <button
              key={o.k}
              className={"dropitem" + (o.k === value ? " active" : "")}
              onClick={() => { onPick(o.k); setOpen(false); }}
            >
              {o.k === value ? "✓ " : <span className="tick" />}
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
