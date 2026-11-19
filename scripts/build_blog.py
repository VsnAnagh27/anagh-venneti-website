#!/usr/bin/env python3
"""Build a JSON index (including Markdown body) from blog/posts/*.md."""
from pathlib import Path
import json
ROOT = Path(__file__).resolve().parents[1]
POSTS = ROOT / "blog" / "posts"
items = []
for path in sorted(POSTS.glob("*.md")):
    raw = path.read_text(encoding="utf-8")
    if not raw.startswith("---\n"): continue
    parts = raw.split("---", 2)
    if len(parts) != 3: continue
    _, front, body = parts
    meta = {}
    for line in front.splitlines():
        if ":" in line:
            key, value = line.split(":", 1)
            meta[key.strip()] = value.strip().strip("\"'")
    if meta.get("draft", "true").lower() == "true": continue
    items.append({"slug": path.stem, "title": meta.get("title", path.stem), "date": meta.get("date", ""), "category": meta.get("category", "General"), "summary": meta.get("summary", ""), "content": body.strip()})
items.sort(key=lambda item: item.get("date", ""), reverse=True)
(ROOT / "data" / "blog-index.json").write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Indexed {len(items)} published blog post(s).")
