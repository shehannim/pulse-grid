"""Fetch + cluster live signals. No API keys. Falls back to seed data offline."""
from __future__ import annotations
import re
import httpx

STOP = set("the a an and or of to in on for with is are was as by at from this that it".split())

SEED = [
    ("FastAPI releases background WebSocket patterns", "https://fastapi.tiangolo.com", 320),
    ("React 19 actions simplify form mutations", "https://react.dev", 410),
    ("XGBoost vs LightGBM credit scoring bake-off", "https://github.com", 180),
    ("Supabase realtime Postgres changes go GA", "https://supabase.com", 260),
    ("NetworkX PageRank for repo navigation", "https://networkx.org", 140),
    ("SQLite WAL mode for multi-user SaaS", "https://sqlite.org", 120),
    ("Tailwind v4 oxide engine deep dive", "https://tailwindcss.com", 200),
    ("LangChain chunking strategies compared", "https://python.langchain.com", 170),
]


def keywords(title: str, n: int = 3) -> list[str]:
    words = re.findall(r"[a-zA-Z]{4,}", title.lower())
    freq: dict[str, int] = {}
    for w in words:
        if w not in STOP:
            freq[w] = freq.get(w, 0) + 1
    return sorted(freq, key=freq.get, reverse=True)[:n]  # type: ignore


async def fetch_hn(limit: int = 12) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            ids = (await c.get("https://hacker-news.firebaseio.com/v0/topstories.json")).json()[:limit]
            out = []
            for i in ids:
                try:
                    d = (await c.get(f"https://hacker-news.firebaseio.com/v0/item/{i}.json")).json()
                    if d and d.get("title"):
                        out.append({"id": f"hn-{i}", "title": d["title"],
                                    "url": d.get("url", ""), "source": "hackernews",
                                    "score": int(d.get("score", 0)),
                                    "published_at": int(d.get("time", 0))})
                except Exception:
                    continue
            if out:
                return out
    except Exception:
        pass
    return []


def tokens(title: str) -> set[str]:
    return {w for w in re.findall(r"[a-zA-Z]{4,}", title.lower()) if w not in STOP}


def clusterize(items: list[dict], k: int = 4) -> list[dict]:
    """Lightweight greedy Jaccard clustering — no numpy/sklearn needed."""
    if not items:
        return items
    k = max(1, min(k, len(items)))
    tokenized = [tokens(x["title"]) for x in items]
    centers: list[set[str]] = []
    labels: list[int] = []
    for toks in tokenized:
        best, best_sim = -1, 0.0
        for ci, c in enumerate(centers):
            union = toks | c
            sim = len(toks & c) / len(union) if union else 0.0
            if sim > best_sim:
                best, best_sim = ci, sim
        if best >= 0 and best_sim >= 0.15:
            labels.append(best)
        elif len(centers) < k:
            centers.append(toks)
            labels.append(len(centers) - 1)
        else:
            labels.append(len(toks) % k if toks else 0)
    for item, lab in zip(items, labels):
        item["cluster"] = int(lab)
        item["keywords"] = keywords(item["title"])
    return sorted(items, key=lambda x: x.get("score", 0), reverse=True)


async def get_pulse(limit: int = 16) -> dict:
    live = await fetch_hn(limit=limit)
    if not live:
        live = [{"id": f"seed-{i}", "title": t, "url": u, "source": "seed", "score": s}
                for i, (t, u, s) in enumerate(SEED)]
    items = clusterize(live[:limit], k=4)
    return {"count": len(items), "clusters": len({x["cluster"] for x in items}), "items": items}
