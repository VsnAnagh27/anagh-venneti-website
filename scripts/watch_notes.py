#!/usr/bin/env python3
"""
watch_notes.py
==============
Watches a local research_notes directory for new/modified Markdown files,
runs the build pipeline, and auto-commits + pushes to GitHub.

Run once when you sit down to write:
  python scripts/watch_notes.py

Or as a background daemon:
  nohup python scripts/watch_notes.py &

Requirements
------------
  pip install watchdog python-frontmatter pyspellchecker

Configuration
-------------
Set in .env or pass as env vars:
  NOTES_SOURCE_DIR  — local directory to watch (default: ~/research_notes)
  REPO_ROOT         — path to the git repo (default: auto-detected)
  AUTO_COMMIT       — "true" to auto-git-push (default: true)
  COMMIT_DELAY      — seconds to wait after last change before committing (default: 30)
"""

import os
import sys
import time
import subprocess
import threading
from pathlib import Path
from datetime import datetime

try:
    from watchdog.observers import Observer
    from watchdog.events import FileSystemEventHandler
except ImportError:
    print("ERROR: Install watchdog:  pip install watchdog")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── Config ────────────────────────────────────────────────────
REPO_ROOT        = Path(__file__).resolve().parent.parent
NOTES_SOURCE     = Path(os.getenv("NOTES_SOURCE_DIR", "~/research_notes")).expanduser()
AUTO_COMMIT      = os.getenv("AUTO_COMMIT", "true").lower() == "true"
COMMIT_DELAY     = int(os.getenv("COMMIT_DELAY", "30"))  # seconds

BUILD_SCRIPT     = REPO_ROOT / "scripts" / "build_notes.py"

# ── Debounced commit ──────────────────────────────────────────
class DebouncedCommitter:
    """Waits COMMIT_DELAY seconds after the last change, then commits."""
    def __init__(self, delay: int):
        self.delay   = delay
        self._timer  = None
        self._lock   = threading.Lock()
        self.pending_files: set[Path] = set()

    def schedule(self, path: Path):
        with self._lock:
            self.pending_files.add(path)
            if self._timer:
                self._timer.cancel()
            self._timer = threading.Timer(self.delay, self._fire)
            self._timer.start()
        print(f"  [watch] Scheduled rebuild in {self.delay}s…")

    def _fire(self):
        files = list(self.pending_files)
        self.pending_files.clear()
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Processing {len(files)} changed file(s)…")
        self._run_pipeline(files)

    def _run_pipeline(self, files: list[Path]):
        # 1. Build notes index
        result = subprocess.run(
            [sys.executable, str(BUILD_SCRIPT),
             "--notes-dir", str(NOTES_SOURCE),
             "--spell-check"],
            capture_output=True, text=True
        )
        print(result.stdout)
        if result.returncode != 0:
            print("  [!] Build script error:")
            print(result.stderr)
            return

        if AUTO_COMMIT:
            self._git_commit(files)

    def _git_commit(self, files: list[Path]):
        try:
            # Stage relevant files
            subprocess.run(
                ["git", "-C", str(REPO_ROOT), "add",
                 "data/notes/", "data/notes-index.json"],
                check=True, capture_output=True
            )
            # Check if there's anything to commit
            diff = subprocess.run(
                ["git", "-C", str(REPO_ROOT), "diff", "--cached", "--name-only"],
                capture_output=True, text=True
            )
            if not diff.stdout.strip():
                print("  [git] Nothing new to commit.")
                return

            note_names = ", ".join(p.stem for p in files[:3])
            if len(files) > 3:
                note_names += f" (+{len(files)-3} more)"
            msg = f"notes: add/update {note_names}"

            subprocess.run(
                ["git", "-C", str(REPO_ROOT), "commit", "-m", msg],
                check=True, capture_output=True
            )
            subprocess.run(
                ["git", "-C", str(REPO_ROOT), "push"],
                check=True, capture_output=True
            )
            print(f"  [git] Pushed: {msg}")
        except subprocess.CalledProcessError as e:
            print(f"  [git] Error: {e.stderr.decode() if e.stderr else e}")


# ── Watchdog handler ──────────────────────────────────────────
class NotesHandler(FileSystemEventHandler):
    def __init__(self, committer: DebouncedCommitter):
        self.committer = committer

    def _handle(self, event):
        if event.is_directory:
            return
        path = Path(event.src_path)
        if path.suffix.lower() in ('.md', '.tex', '.txt'):
            print(f"  [watch] Changed: {path.name}")
            self.committer.schedule(path)

    def on_created(self, event): self._handle(event)
    def on_modified(self, event): self._handle(event)


# ── Main ──────────────────────────────────────────────────────
def main():
    if not NOTES_SOURCE.exists():
        NOTES_SOURCE.mkdir(parents=True)
        print(f"Created notes directory: {NOTES_SOURCE}")

    print(f"""
╔═══════════════════════════════════════════════════╗
║  Research Notes Watcher — Anagh Venneti           ║
╠═══════════════════════════════════════════════════╣
║  Watching:   {str(NOTES_SOURCE):<35} ║
║  Repo:       {str(REPO_ROOT):<35} ║
║  Auto-push:  {str(AUTO_COMMIT):<35} ║
║  Delay:      {f'{COMMIT_DELAY}s after last change':<35} ║
╠═══════════════════════════════════════════════════╣
║  Write .md files to the watched directory.        ║
║  Changes are auto-indexed and pushed to GitHub.   ║
║  Press Ctrl+C to stop.                            ║
╚═══════════════════════════════════════════════════╝
""")

    committer = DebouncedCommitter(COMMIT_DELAY)
    handler   = NotesHandler(committer)
    observer  = Observer()
    observer.schedule(handler, str(NOTES_SOURCE), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n[watch] Stopping…")
        observer.stop()
    observer.join()


if __name__ == "__main__":
    main()
