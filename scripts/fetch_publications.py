#!/usr/bin/env python3
"""
fetch_publications.py — Anagh Venneti academic website
======================================================

Build data/publications.json from:
  1. Google Scholar: publication discovery, citation counts, yearly metrics.
  2. Crossref REST API: DOI, complete ordered author list, journal and
     publication metadata.
  3. Existing publications.json: trusted fallback for manually curated
     records if Crossref is temporarily unavailable or incomplete.

The script intentionally does NOT call scholarly.fill() on individual
publication pages. That parser was failing against the HTML returned by
Google Scholar. Only the author profile is filled.

Publication policy
------------------
- A new record enters the public list only if Crossref returns a matching
  published work of an allowed type AND its author metadata identifies
  Anagh Venneti.
- Explicit Scholar preprint/arXiv/unpublished records are excluded.
- Unmatched or ambiguous records go to data/publications-review.json.
- Existing manually curated records are retained as a fallback and merged
  with newly verified records. Review the cache before relying on it.
- The public JSON is replaced atomically only after a non-empty successful
  build. Network/parser errors never destroy the previous file.

Install
-------
    python -m pip install -r requirements.txt

Run
---
    python scripts/fetch_publications.py --scholar-id VMa_jXYAAAAJ --dry-run
    python scripts/fetch_publications.py --scholar-id VMa_jXYAAAAJ
    python scripts/fetch_publications.py --scholar-id VMa_jXYAAAAJ --diagnose

Optional polite-pool contact:
    python scripts/fetch_publications.py --scholar-id VMa_jXYAAAAJ \\
        --mailto your-email@example.com

Environment:
    SCHOLAR_ID=VMa_jXYAAAAJ
    CROSSREF_MAILTO=your-email@example.com

JSON output schema remains compatible with js/publications.js.
"""

from __future__ import annotations

import argparse
import datetime as dt
import difflib
import json
import os
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests

try:
    from scholarly import scholarly
except ImportError:
    print(
        "ERROR: scholarly is not installed in this environment.\n"
        "Install with: python -m pip install scholarly",
        file=sys.stderr,
    )
    raise SystemExit(1)

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUT_PATH = DATA_DIR / "publications.json"
REVIEW_PATH = DATA_DIR / "publications-review.json"

DEFAULT_SCHOLAR_ID = "VMa_jXYAAAAJ"
OWNER_GIVEN = "anagh"
OWNER_FAMILY = "venneti"

CROSSREF_API = "https://api.crossref.org/works"
CROSSREF_ROWS = 8
CROSSREF_TIMEOUT = 25
DEFAULT_DELAY = 1.0

# Crossref's work types that represent published scholarly outputs. Posted
# content/preprints are deliberately not accepted.
PUBLISHED_TYPES = {
    "journal-article",
    "proceedings-article",
    "book-chapter",
    "book",
    "monograph",
    "reference-entry",
    "report",
    "standard",
}

PREPRINT_MARKERS = (
    "arxiv preprint",
    "arxiv:",
    "preprint",
    "pre-print",
    "submitted manuscript",
    "manuscript submitted",
    "under review",
    "unpublished",
)

TOPIC_KEYWORDS = {
    "neutron stars": [
        "neutron star", "neutron-star", "pulsar", "compact object",
    ],
    "EOS": [
        "equation of state", "dense matter", "nuclear matter", "quark matter",
        "hybrid star", "hadronic", "colour-superconducting",
    ],
    "gravitational waves": [
        "gravitational wave", "gw170817", "merger", "post-merger", "tidal",
    ],
    "Bayesian inference": [
        "bayesian", "mcmc", "inference", "posterior", "prior", "sampling",
    ],
    "NICER": [
        "nicer", "mass-radius", "x-ray timing", "x-ray pulse",
    ],
    "simulations": [
        "numerical relativity", "simulation", "hydrodynamics", "magneto",
    ],
    "computational methods": [
        "sampling", "monte carlo", "machine learning", "neural network",
        "emulator", "surrogate",
    ],
}


def text(value: Any) -> str:
    """Convert a metadata value to a whitespace-normalised string."""
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return "; ".join(text(v) for v in value if text(v))
    return re.sub(r"\s+", " ", str(value)).strip()


def safe_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def normalise_title(value: str) -> str:
    value = unicodedata.normalize("NFKD", text(value))
    value = "".join(c for c in value if not unicodedata.combining(c))
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def title_similarity(a: str, b: str) -> float:
    na, nb = normalise_title(a), normalise_title(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    seq = difflib.SequenceMatcher(None, na, nb).ratio()
    ta, tb = set(na.split()), set(nb.split())
    overlap = len(ta & tb) / max(1, len(ta | tb))
    return max(seq, overlap)


def infer_topics(title: str, abstract: str = "", subjects: Any = None) -> list[str]:
    content = f"{title} {abstract} {text(subjects)}".lower()
    found = [
        topic for topic, keywords in TOPIC_KEYWORDS.items()
        if any(keyword in content for keyword in keywords)
    ]
    return found or ["astrophysics"]


def scholar_profile(scholar_id: str) -> dict[str, Any]:
    print(f"[scholar] Fetching author profile: {scholar_id}")
    profile = scholarly.search_author_id(scholar_id)
    profile = scholarly.fill(
        profile,
        sections=["basics", "indices", "publications", "counts"],
    )
    if not isinstance(profile, dict):
        raise RuntimeError("Google Scholar returned an invalid author profile.")
    if not isinstance(profile.get("publications"), list):
        raise RuntimeError("Google Scholar profile has no publication list.")
    return profile


def scholar_publication_fields(pub: dict[str, Any]) -> dict[str, Any]:
    bib = pub.get("bib") or {}
    if not isinstance(bib, dict):
        bib = {}
    return {
        "title": text(bib.get("title")),
        "year": safe_int(bib.get("pub_year") or bib.get("year")),
        "citation": text(bib.get("citation")),
        "citations": safe_int(pub.get("num_citations")) or 0,
        "scholar_id": text(pub.get("author_pub_id")),
        "bib": bib,
    }


def is_explicit_preprint(record: dict[str, Any]) -> bool:
    citation = text(record.get("citation")).lower()
    title = text(record.get("title")).lower()
    return any(marker in citation for marker in PREPRINT_MARKERS) or any(
        marker in title for marker in ("[preprint]", "(preprint)")
    )


def crossref_session(mailto: str = "") -> requests.Session:
    session = requests.Session()
    agent = "AnaghVennetiAcademicWebsite/1.0 (publication metadata retrieval)"
    if mailto:
        agent += f" mailto:{mailto}"
    session.headers.update({
        "User-Agent": agent,
        "Accept": "application/json",
    })
    return session


def crossref_get(
    session: requests.Session,
    url: str,
    params: dict[str, Any] | None = None,
    retries: int = 3,
) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = session.get(
                url,
                params=params,
                timeout=CROSSREF_TIMEOUT,
            )
            if response.status_code in (429, 500, 502, 503, 504):
                raise requests.HTTPError(
                    f"Crossref HTTP {response.status_code}", response=response
                )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Crossref returned non-object JSON.")
            return payload
        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"Crossref request failed: {last_error}")


def crossref_by_doi(
    session: requests.Session,
    doi: str,
) -> dict[str, Any] | None:
    doi = text(doi)
    if not doi:
        return None
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi, flags=re.I)
    url = f"{CROSSREF_API}/{quote(doi, safe='')}"
    try:
        payload = crossref_get(session, url)
        message = payload.get("message")
        return message if isinstance(message, dict) else None
    except Exception as exc:
        print(f"[crossref] DOI lookup failed for {doi}: {exc}", file=sys.stderr)
        return None


def crossref_title_search(
    session: requests.Session,
    title: str,
) -> list[dict[str, Any]]:
    payload = crossref_get(
        session,
        CROSSREF_API,
        params={
            "query.title": title,
            "rows": CROSSREF_ROWS,
        },
    )
    message = payload.get("message") or {}
    items = message.get("items") or []
    return [item for item in items if isinstance(item, dict)]


def is_owner_author_name(name: str) -> bool:
    """Recognise the owner in full-name and initial-plus-family formats."""
    value = text(name).lower()
    value = re.sub(r"[^a-z ]", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    if OWNER_FAMILY not in value:
        return False
    return OWNER_GIVEN in value or bool(
        re.search(r"\ba\s+venneti\b", value)
    )


def crossref_has_owner(item: dict[str, Any]) -> bool:
    """Require Anagh Venneti in the Crossref author list."""
    for author in item.get("author") or []:
        if not isinstance(author, dict):
            continue
        family = text(author.get("family")).lower()
        given = text(author.get("given")).lower()
        given_compact = re.sub(r"[^a-z]", "", given)
        if family == OWNER_FAMILY and (
            given_compact.startswith(OWNER_GIVEN)
            or given_compact == "a"
            or not given_compact
        ):
            return True
    return False


def crossref_is_published(item: dict[str, Any]) -> bool:
    work_type = text(item.get("type")).lower()
    if work_type not in PUBLISHED_TYPES:
        return False

    # A posted/preprint title or subtype should never be included.
    subtype = text(item.get("subtype")).lower()
    title = " ".join(text(t) for t in (item.get("title") or [])).lower()
    if "preprint" in subtype or any(
        marker in title for marker in ("[preprint]", "(preprint)")
    ):
        return False

    # Require a publication date or an established container/publisher.
    has_date = bool(
        item.get("published-print")
        or item.get("published-online")
        or item.get("published")
        or item.get("issued")
    )
    has_container = bool(item.get("container-title") or item.get("publisher"))
    return has_date and has_container


def choose_crossref_match(
    title: str,
    candidates: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, float, str]:
    """
    Select only a high-confidence title match with Anagh Venneti in the
    Crossref author list and an allowed published-work type.
    """
    ranked: list[tuple[float, dict[str, Any]]] = []
    for item in candidates:
        candidate_titles = item.get("title") or []
        candidate_title = text(candidate_titles[0] if candidate_titles else "")
        score = title_similarity(title, candidate_title)
        ranked.append((score, item))

    ranked.sort(key=lambda pair: pair[0], reverse=True)

    for score, item in ranked:
        if score < 0.90:
            continue
        if not crossref_is_published(item):
            continue
        if not crossref_has_owner(item):
            continue
        return item, score, "matched"

    best_score = ranked[0][0] if ranked else 0.0
    if not ranked:
        return None, 0.0, "no Crossref results"
    if best_score < 0.90:
        return None, best_score, "title match below 0.90 threshold"
    if not any(crossref_is_published(i) for s, i in ranked if s >= 0.90):
        return None, best_score, "no matching published Crossref work"
    return None, best_score, "Crossref author list did not identify Anagh Venneti"


def crossref_year(item: dict[str, Any]) -> int | None:
    for key in ("published-print", "published-online", "published", "issued"):
        date_parts = (item.get(key) or {}).get("date-parts") or []
        if date_parts and date_parts[0]:
            year = safe_int(date_parts[0][0])
            if year:
                return year
    return None


def crossref_authors(item: dict[str, Any]) -> list[str]:
    names = []
    for author in item.get("author") or []:
        if not isinstance(author, dict):
            continue
        given = text(author.get("given"))
        family = text(author.get("family"))
        name = " ".join(part for part in (given, family) if part).strip()
        if name:
            names.append(name)
    return names


def cached_records() -> dict[str, dict[str, Any]]:
    """Read the existing JSON as a trusted fallback/manual curation cache."""
    if not OUTPUT_PATH.exists():
        return {}
    try:
        data = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[cache] Could not read existing publications.json: {exc}")
        return {}

    result: dict[str, dict[str, Any]] = {}
    for pub in data.get("publications", []):
        if not isinstance(pub, dict) or not text(pub.get("title")):
            continue
        result[normalise_title(text(pub["title"]))] = pub
    return result


def build_record(
    scholar_record: dict[str, Any],
    crossref_item: dict[str, Any],
    cached: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Combine Scholar citation counts, Crossref metadata and cache fallbacks."""
    cached = cached or {}
    title_list = crossref_item.get("title") or []
    title = text(title_list[0] if title_list else "") or scholar_record["title"]

    authors = crossref_authors(crossref_item)
    container = crossref_item.get("container-title") or []
    journal = text(container[0] if container else "")
    year = crossref_year(crossref_item) or scholar_record.get("year")
    doi = text(crossref_item.get("DOI")) or text(cached.get("doi"))
    abstract = text(crossref_item.get("abstract")) or text(cached.get("abstract"))

    if not authors and cached.get("authors"):
        authors = cached["authors"]
    if not journal:
        journal = text(cached.get("journal"))
    if not year:
        year = safe_int(cached.get("year"))

    first_author = bool(authors and is_owner_author_name(authors[0]))

    doi_url = f"https://doi.org/{doi}" if doi else ""
    pub_id = text(scholar_record.get("scholar_id")).replace(":", "_")
    if not pub_id:
        pub_id = text(cached.get("id"))
    if not pub_id:
        pub_id = re.sub(r"[^a-z0-9]+", "-", normalise_title(title)).strip("-")

    volume = text(crossref_item.get("volume")) or text(cached.get("volume"))
    issue = text(crossref_item.get("issue")) or text(cached.get("issue"))
    pages = (
        text(crossref_item.get("page"))
        or text(crossref_item.get("article-number"))
        or text(cached.get("pages"))
    )

    return {
        "id": pub_id,
        "title": title,
        "authors": authors,
        "first_author": first_author,
        "year": year,
        "journal": journal,
        "volume": volume,
        "issue": issue,
        "pages": pages,
        "arxiv_id": text(cached.get("arxiv_id")),
        "ads_id": text(cached.get("ads_id")),
        "doi": doi,
        "doi_url": doi_url,
        "citations": scholar_record.get("citations", 0),
        "topics": cached.get("topics") or infer_topics(
            title, abstract, crossref_item.get("subject")
        ),
        "abstract": abstract,
        "featured": bool(cached.get("featured")) or (
            first_author and scholar_record.get("citations", 0) >= 5
        ),
        "metadata_source": "Crossref + Google Scholar",
    }


def load_profile_metrics(profile: dict[str, Any]) -> dict[str, Any]:
    counts = profile.get("counts") or {}
    by_year = counts.get("by_year") or {}
    citations_by_year = (
        {str(year): count for year, count in by_year.items()}
        if isinstance(by_year, dict) else {}
    )
    return {
        "total_citations": safe_int(profile.get("citedby")) or 0,
        "h_index": safe_int(profile.get("hindex")) or 0,
        "i10_index": safe_int(profile.get("i10index")) or 0,
        "citations_by_year": citations_by_year,
    }


def atomic_json_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    try:
        temporary.write_text(
            json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build the published-paper list from Google Scholar and Crossref."
    )
    parser.add_argument(
        "--scholar-id",
        default=os.getenv("SCHOLAR_ID", DEFAULT_SCHOLAR_ID),
        help="Google Scholar author ID.",
    )
    parser.add_argument(
        "--mailto",
        default=os.getenv("CROSSREF_MAILTO", ""),
        help="Email address for Crossref's polite pool (optional).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print results without changing either JSON file.",
    )
    parser.add_argument(
        "--diagnose",
        action="store_true",
        help="Print Scholar's raw profile-level metadata and exit.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY,
        help="Delay between Crossref title searches in seconds (default: 1.0).",
    )
    parser.add_argument(
        "--no-cache-fallback",
        action="store_true",
        help="Do not use existing publications.json as a metadata fallback.",
    )
    args = parser.parse_args()

    if not args.scholar_id.strip():
        parser.error("A Google Scholar ID is required.")
    if args.delay < 0:
        parser.error("--delay cannot be negative.")

    try:
        profile = scholar_profile(args.scholar_id.strip())

        scholar_records = [
            scholar_publication_fields(pub)
            for pub in profile.get("publications", [])
            if isinstance(pub, dict)
        ]

        if args.diagnose:
            print("\n[diagnose] Scholar profile-level records:")
            for i, record in enumerate(scholar_records, start=1):
                print(
                    f"{i:02d}. {record['title']}\n"
                    f"    year={record['year']} | "
                    f"citation={record['citation']!r}"
                )
            print("\n[diagnose] No output files changed.")
            return 0

        cache = {} if args.no_cache_fallback else cached_records()
        session = crossref_session(args.mailto)

        output_publications: list[dict[str, Any]] = []
        review_records: list[dict[str, Any]] = []
        seen_titles: set[str] = set()
        counts = {
            "scholar_records": len(scholar_records),
            "verified_crossref": 0,
            "retained_from_cache": 0,
            "excluded_preprints": 0,
            "needs_review": 0,
        }

        for index, record in enumerate(scholar_records, start=1):
            title = record["title"]
            if not title:
                continue

            norm_title = normalise_title(title)
            if norm_title in seen_titles:
                continue
            seen_titles.add(norm_title)

            if is_explicit_preprint(record):
                counts["excluded_preprints"] += 1
                print(f"[exclude] Explicit preprint: {title}")
                continue

            cached = cache.get(norm_title)
            crossref_item = None
            match_score = 0.0
            match_reason = ""

            # If the existing curated record has a DOI, use exact lookup first.
            cached_doi = text(cached.get("doi")) if cached else ""
            if cached_doi:
                crossref_item = crossref_by_doi(session, cached_doi)
                if crossref_item and (
                    title_similarity(
                        title,
                        text((crossref_item.get("title") or [""])[0]),
                    ) < 0.90
                    or not crossref_has_owner(crossref_item)
                    or not crossref_is_published(crossref_item)
                ):
                    crossref_item = None

            if crossref_item is None:
                try:
                    candidates = crossref_title_search(session, title)
                    crossref_item, match_score, match_reason = choose_crossref_match(
                        title, candidates
                    )
                except Exception as exc:
                    match_reason = f"Crossref request error: {exc}"

            if crossref_item:
                built = build_record(record, crossref_item, cached)
                output_publications.append(built)
                counts["verified_crossref"] += 1
                print(
                    f"[verified] {built['year'] or 'n.d.'} | "
                    f"{built['journal']} | {built['title']}"
                )
            elif cached and cached.get("authors") and cached.get("journal"):
                # Existing hand-curated record is safer than dropping a known
                # published paper because Crossref is temporarily incomplete.
                retained = dict(cached)
                retained["citations"] = record.get("citations", 0)
                retained["metadata_source"] = "Existing curated website record"
                retained["first_author"] = bool(
                    retained.get("authors")
                    and OWNER_FAMILY in text(retained["authors"][0]).lower()
                )
                output_publications.append(retained)
                counts["retained_from_cache"] += 1
                print(f"[cache] Retained existing curated record: {title}")
            else:
                counts["needs_review"] += 1
                review_records.append({
                    "title": title,
                    "scholar_year": record.get("year"),
                    "scholar_citation": record.get("citation"),
                    "scholar_citations": record.get("citations", 0),
                    "reason": match_reason or "No verified Crossref match",
                    "best_title_similarity": round(match_score, 3),
                    "instruction": (
                        "Verify publication status and author list manually. "
                        "Do not add to public publications.json until verified."
                    ),
                })
                print(f"[review] {title} — {match_reason}")

            if args.delay:
                time.sleep(args.delay)

        if not output_publications:
            raise RuntimeError(
                "No verified or cached published records were produced. "
                "Existing publications.json was not changed."
            )

        # Deduplicate by DOI when possible, otherwise by normalised title.
        deduplicated: dict[str, dict[str, Any]] = {}
        for pub in output_publications:
            key = text(pub.get("doi")).lower() or normalise_title(pub.get("title", ""))
            deduplicated[key] = pub
        output_publications = list(deduplicated.values())

        output_publications.sort(
            key=lambda p: (
                safe_int(p.get("year")) or 0,
                text(p.get("title")).lower(),
            ),
            reverse=True,
        )

        unique_coauthors = {
            text(name)
            for pub in output_publications
            for name in (pub.get("authors") or [])
            if OWNER_FAMILY not in text(name).lower()
        }

        metrics = load_profile_metrics(profile)
        metrics.update({
            "total_papers": len(output_publications),
            "first_author_papers": sum(
                1 for p in output_publications if p.get("first_author")
            ),
            "coauthors": len(unique_coauthors),
        })

        output = {
            "last_updated": dt.datetime.now(dt.timezone.utc).isoformat().replace(
                "+00:00", "Z"
            ),
            "scholar_id": args.scholar_id.strip(),
            "researcher": {
                "name": "Anagh Venneti",
                "affiliation": "Birla Institute of Technology and Science, Hyderabad",
                "field": (
                    "Nuclear Astrophysics, Neutron Stars, Dense Matter Equation "
                    "of State, Bayesian Inference"
                ),
            },
            "metrics": metrics,
            "publications": output_publications,
            "citations_by_year": metrics.pop("citations_by_year"),
        }

        review_output = {
            "last_updated": output["last_updated"],
            "scholar_id": args.scholar_id.strip(),
            "summary": counts,
            "records_requiring_manual_review": review_records,
        }

        print("\n[summary]")
        for key, value in counts.items():
            print(f"  {key}: {value}")
        print(f"  public_papers: {len(output_publications)}")
        print(
            "  first_author_papers: "
            f"{output['metrics']['first_author_papers']}"
        )

        if args.dry_run:
            print("\n[dry-run] publications.json preview:")
            print(json.dumps(output, indent=2, ensure_ascii=False))
            print("\n[dry-run] review file preview:")
            print(json.dumps(review_output, indent=2, ensure_ascii=False))
            print("\n[dry-run] No files were changed.")
        else:
            atomic_json_write(OUTPUT_PATH, output)
            atomic_json_write(REVIEW_PATH, review_output)
            print(f"\n[ok] Wrote {OUTPUT_PATH}")
            print(f"[ok] Wrote {REVIEW_PATH}")
            if review_records:
                print(
                    f"[attention] {len(review_records)} record(s) need manual "
                    f"review. They were NOT added to the public list."
                )

        return 0

    except KeyboardInterrupt:
        print("\n[error] Interrupted. Existing data files were not changed.")
        return 130
    except Exception as exc:
        print(
            f"[error] Publication update failed: {exc}\n"
            "Existing publications.json was not overwritten.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
