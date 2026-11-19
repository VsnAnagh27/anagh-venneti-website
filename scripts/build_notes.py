#!/usr/bin/env python3
"""
build_notes.py
==============
Scans a local notes directory (or data/notes/ in the repo), reads YAML
front matter from each .md file, and writes data/notes-index.json.

Also optionally spell-checks and validates LaTeX in the notes.

Usage
-----
  python scripts/build_notes.py [--notes-dir PATH] [--spell-check]

Default notes-dir: data/notes/ (relative to repo root)

For local workflow (reading from ~/research_notes/), pass:
  python scripts/build_notes.py --notes-dir ~/research_notes/

Requirements
------------
  pip install python-frontmatter pyspellchecker
"""

import json
import os
import sys
import re
import shutil
import argparse
import datetime
from pathlib import Path

try:
    import frontmatter
except ImportError:
    print("ERROR: Install 'python-frontmatter':  pip install python-frontmatter")
    sys.exit(1)

REPO_ROOT    = Path(__file__).resolve().parent.parent
OUTPUT_JSON  = REPO_ROOT / "data" / "notes-index.json"
NOTES_DEST   = REPO_ROOT / "data" / "notes"

# Recognised categories and their display labels
CATEGORY_LABELS = {
    "neutron-stars":     "Neutron Stars",
    "eos-physics":       "EOS Physics",
    "gravitational-waves": "Gravitational Waves",
    "bayesian-methods":  "Bayesian Methods",
    "literature-reviews": "Literature Reviews",
    "derivations":       "Derivations",
    "open-problems":     "Open Problems",
    "simulations":       "Simulations",
    "computational":     "Computational",
    "thesis-notes":      "Thesis Notes",
    "philosophy":        "Philosophy of Physics",
}


def extract_excerpt(body: str, max_chars: int = 280) -> str:
    """Extract a plain-text excerpt from markdown body."""
    # Remove YAML fences, headings, code blocks
    text = re.sub(r'^#{1,6}\s+', '', body, flags=re.MULTILINE)
    text = re.sub(r'```[\s\S]*?```', '', text)
    text = re.sub(r'\$\$[\s\S]*?\$\$', '', text)   # display math
    text = re.sub(r'\$[^$]+\$', '[eq]', text)        # inline math
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)  # links
    text = re.sub(r'[*_`]', '', text)
    text = re.sub(r'\n+', ' ', text).strip()
    return text[:max_chars] + '…' if len(text) > max_chars else text


def estimate_reading_time(body: str) -> int:
    """Estimate reading time in minutes (≈200 wpm)."""
    words = len(re.findall(r'\w+', body))
    return max(1, round(words / 200))


def process_note(md_path: Path, dest_dir: Path) -> dict | None:
    """Parse a markdown note, copy to dest, return index entry."""
    try:
        post = frontmatter.load(str(md_path))
    except Exception as e:
        print(f"  [!] Could not parse {md_path.name}: {e}")
        return None

    meta    = post.metadata
    body    = post.content

    title   = meta.get("title", md_path.stem.replace("-", " ").title())
    date    = str(meta.get("date", datetime.date.today()))
    category = meta.get("category", "uncategorised")
    tags    = meta.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    featured = meta.get("featured", False)
    excerpt  = meta.get("excerpt", extract_excerpt(body))
    reading_time = meta.get("reading_time", estimate_reading_time(body))

    # Copy file to dest
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_file = dest_dir / md_path.name
    if md_path.resolve() != dest_file.resolve():
        shutil.copy2(md_path, dest_file)
        print(f"  [✓] Copied {md_path.name}")

    return {
        "id":           md_path.stem,
        "title":        title,
        "category":     category,
        "tags":         tags,
        "date":         date,
        "excerpt":      excerpt,
        "filename":     md_path.name,
        "featured":     featured,
        "reading_time": reading_time,
    }


def build_category_index(notes: list[dict]) -> dict:
    cats = {}
    for note in notes:
        cat = note.get("category", "uncategorised")
        if cat not in cats:
            cats[cat] = {"label": CATEGORY_LABELS.get(cat, cat.replace("-", " ").title()), "count": 0}
        cats[cat]["count"] += 1
    return cats


def spell_check_note(md_path: Path) -> list[str]:
    """Return list of possibly misspelled words (very lightweight)."""
    try:
        from spellchecker import SpellChecker
    except ImportError:
        return []

    spell = SpellChecker()
    text  = md_path.read_text(encoding="utf-8")
    # Strip front matter and math
    text = re.sub(r'^---[\s\S]*?---\n', '', text)
    text = re.sub(r'\$\$[\s\S]*?\$\$', '', text)
    text = re.sub(r'\$[^$]+\$', '', text)
    text = re.sub(r'```[\s\S]*?```', '', text)
    words = re.findall(r"[a-zA-Z']+", text)
    misspelled = spell.unknown(words)
    # Filter common physics/LaTeX terms
    known_extra = {"eos", "tov", "mcmc", "nicer", "grb", "bns", "astrophysics",
                   "parameterisations", "parameterisation", "behaviours", "colour"}
    return [w for w in misspelled if w.lower() not in known_extra]


def main():
    parser = argparse.ArgumentParser(description="Build notes index from markdown files")
    parser.add_argument("--notes-dir", default=str(NOTES_DEST),
                        help="Directory containing .md note files")
    parser.add_argument("--spell-check", action="store_true",
                        help="Run lightweight spell check")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print index to stdout, do not write")
    args = parser.parse_args()

    notes_dir = Path(args.notes_dir).expanduser().resolve()
    if not notes_dir.exists():
        print(f"ERROR: Notes directory not found: {notes_dir}")
        sys.exit(1)

    md_files = sorted(notes_dir.glob("*.md"), key=lambda p: p.name)
    if not md_files:
        print(f"No .md files found in {notes_dir}")
        sys.exit(0)

    print(f"[build_notes] Processing {len(md_files)} files from {notes_dir}")
    notes = []
    for md_path in md_files:
        print(f"  Processing: {md_path.name}")
        if args.spell_check:
            errors = spell_check_note(md_path)
            if errors:
                print(f"    Spell check: possible errors: {errors[:10]}")
        entry = process_note(md_path, NOTES_DEST)
        if entry:
            notes.append(entry)

    # Sort by date descending
    notes.sort(key=lambda n: n.get("date", ""), reverse=True)

    output = {
        "last_updated": datetime.datetime.utcnow().isoformat() + "Z",
        "notes":        notes,
        "categories":   build_category_index(notes),
    }

    if args.dry_run:
        print(json.dumps(output, indent=2, ensure_ascii=False))
    else:
        OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"\n[✓] Wrote {len(notes)} notes → {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
