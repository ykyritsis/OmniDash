"""Group the Xbox app cache by scope so we can see every data surface it keeps.

Usage: python list_scopes.py [db path]
"""
from __future__ import annotations

import json
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
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    cur = con.cursor()
    print("=== scopes ===")
    rows = cur.execute(
        "select scope, scopeVersion, count(*), max(length(value)) "
        "from AsyncCache group by scope, scopeVersion order by count(*) desc"
    ).fetchall()
    for scope, version, count, maxlen in rows:
        print(f"  {scope:<34} v{version}  rows={count:<6} maxvalue={maxlen:,}")

    print("\n=== top-level keys per scope (samples) ===")
    for scope, version, count, _ in rows:
        keys = [
            r[0]
            for r in cur.execute(
                "select key from AsyncCache where scope=? and scopeVersion=? limit 8",
                (scope, version),
            )
        ]
        joined = ", ".join(repr(k) for k in keys)
        print(f"  {scope}: {joined}")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
