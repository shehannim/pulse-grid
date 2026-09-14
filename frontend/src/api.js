const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
}

export const api = {
  base: API,
  overview: () => get("/api/cse/overview"),
  heatmap: (limit = 200) => get(`/api/cse/heatmap?limit=${limit}`),
  movers: (limit = 12) => get(`/api/cse/movers?limit=${limit}`),
  sectors: () => get("/api/cse/sectors"),
  quote: (symbol) => get(`/api/cse/quote/${encodeURIComponent(symbol)}`),
  wsURL: () => api.base.replace(/^http/, "ws") + "/ws/cse",
};

export function fmtMoney(n) {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export function fmtNum(n, d = 2) {
  if (n == null || isNaN(n)) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtInt(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US");
}

/** tile background by % change */
export function heatColor(pct) {
  if (pct == null || isNaN(pct)) return "#2a2f3a";
  const p = Number(pct);
  if (p <= -5) return "#7a0e0e";
  if (p <= -3) return "#a31515";
  if (p <= -1.5) return "#c02a2a";
  if (p <= -0.5) return "#d35f5f";
  if (p < -0.05) return "#e08a8a";
  if (p <= 0.05) return "#3a3f4b";
  if (p < 0.5) return "#6faf7f";
  if (p < 1.5) return "#3f9e5f";
  if (p < 3) return "#1e7d46";
  if (p < 5) return "#0f6b38";
  return "#0a5a2e";
}
