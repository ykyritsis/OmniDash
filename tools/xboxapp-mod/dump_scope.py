"""Pretty-print selected cache scopes from the Xbox app's AsyncCache.db.

Usage: python dump_scope.py <scope> [key] [--bytes]
Defaults are read from argv; output is truncated per value.
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


def pretty(value: object, limit: int) -> str:
    try:
        obj = json.loads(value)  # type: ignore[arg-type]
        text = json.dumps(obj, indent=2, ensure_ascii=False)
    except Exception:
        text = str(value)
    if len(text) > limit:
        text = text[:limit] + f"\n... [{len(text):,} chars total]"
    return text


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    scope = sys.argv[1]
    key = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("--") else None
    limit = 4000
    db = default_db()
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    cur = con.cursor()
    if key:
        rows = cur.execute(
            "select key, value from AsyncCache where scope=? and key=?", (scope, key)
        ).fetchall()
    else:
        rows = cur.execute(
            "select key, value from AsyncCache where scope=? limit 2", (scope,)
        ).fetchall()
    print(f"scope={scope} rows={len(rows)} db={db}\n")
    for k, v in rows:
        print(f"===== key: {k!r} ({len(v):,} chars)")
        print(pretty(v, limit))
        print()
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
