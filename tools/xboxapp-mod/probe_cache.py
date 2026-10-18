"""Read-only probe of the Xbox app's local SQLite cache.

Usage: python probe_cache.py [db path]
Prints the schema, row counts and a few sample rows so we can see what
surfaces (titles, artwork, app entries) the official app keeps on disk.
"""
from __future__ import annotations

import os
import sqlite3
import sys


def default_db() -> str:
    local = os.environ.get("LOCALAPPDATA", "")
    return os.path.join(
        local, r"Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState\AsyncCache.db"
    )


def main() -> int:
    db = sys.argv[1] if len(sys.argv) > 1 else default_db()
    print(f"db: {db}")
    print(f"size: {os.path.getsize(db):,} bytes")
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    cur = con.cursor()

    objs = cur.execute(
        "select type, name from sqlite_master where type in ('table','view') order by type, name"
    ).fetchall()
    print(f"\nobjects: {len(objs)}")
    for kind, name in objs:
        try:
            count = cur.execute(f'select count(*) from "{name}"').fetchone()[0]
        except sqlite3.Error as exc:  # pragma: no cover - diagnostic path
            print(f"  [{kind}] {name}: <{exc}>")
            continue
        cols = []
        try:
            cols = [r[1] for r in cur.execute(f'pragma table_info("{name}")')]
        except sqlite3.Error:
            pass
        print(f"  [{kind}] {name}: {count:,} rows")
        if cols:
            print(f"      columns: {', '.join(cols)}")

    print("\n=== samples ===")
    for _, name in objs:
        try:
            cols = [r[1] for r in cur.execute(f'pragma table_info("{name}")')]
            rows = cur.execute(f'select * from "{name}" limit 3').fetchall()
        except sqlite3.Error:
            continue
        print(f"\n--- {name}")
        for row in rows:
            for col, val in zip(cols, row):
                text = val
                if isinstance(text, bytes):
                    text = f"<{len(val)} bytes>"
                text = str(text)
                if len(text) > 220:
                    text = text[:220] + "..."
                print(f"    {col}: {text}")
            print("    .")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
