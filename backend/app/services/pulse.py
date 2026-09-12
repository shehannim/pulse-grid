"""Fetch + cluster live signals. No API keys. Falls back to seed data offline."""
from __future__ import annotations
import re
import httpx
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import KMeans

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
                                    "score": int(d.get("score", 0))})
                except Exception:
                    continue
            if out:
                return out
    except Exception:
        pass
    return []


def clusterize(items: list[dict], k: int = 4) -> list[dict]:
    if not items:
        return items
    titles = [x["title"] for x in items]
    k = max(1, min(k, len(items)))
    try:
        X = TfidfVectorizer(stop_words="english", max_features=200).fit_transform(titles)
        labels = KMeans(n_clusters=k, n_init=10, random_state=7).fit_predict(X)
    except Exception:
        labels = [i % k for i in range(len(items))]
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
