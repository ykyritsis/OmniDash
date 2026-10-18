"""Inspect cache DB writability, journal mode, and the layout/collection JSON shapes."""
from __future__ import annotations

import json
import os
import sqlite3
import sys


def db_path() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        r"Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState\AsyncCache.db",
    )


def main() -> int:
    path = db_path()
    print(f"db exists: {os.path.exists(path)}")
    try:
        with open(path, "ab"):
            pass
        print("writable by current user: yes")
    except OSError as exc:
        print(f"writable by current user: NO ({exc})")

    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    cur = con.cursor()
    print("journal_mode:", cur.execute("pragma journal_mode").fetchone()[0])
    print("page_count/size:", cur.execute("pragma page_count").fetchone()[0],
          cur.execute("pragma page_size").fetchone()[0])

    for scope in ("collections", "collections_metadata", "layouts_metadata", "many_title_ids"):
        row = cur.execute("select value from AsyncCache where scope=? limit 1", (scope,)).fetchone()
        if not row:
            continue
        raw = row[0]
        print(f"\n===== {scope} ({len(raw):,} chars)")
        try:
            obj = json.loads(raw)
        except Exception as exc:
            print("  not json:", exc)
            continue

        def outline(node, depth=0, maxdepth=3, budget=[18]):
            pad = "  " * depth
            if budget[0] <= 0:
                return
            budget[0] -= 1
            if isinstance(node, dict):
                keys = list(node.keys())
                print(f"{pad}dict keys: {keys[:14]}")
                if depth < maxdepth:
                    for k in keys[:6]:
                        print(f"{pad}  {k}:")
                        outline(node[k], depth + 2, maxdepth, budget)
            elif isinstance(node, list):
                print(f"{pad}list[{len(node)}]")
                if node and depth < maxdepth:
                    outline(node[0], depth + 1, maxdepth, budget)
            else:
                text = str(node)
                print(f"{pad}{type(node).__name__}: {text[:100]}")

        outline(obj)
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
