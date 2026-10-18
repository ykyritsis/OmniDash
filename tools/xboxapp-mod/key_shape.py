"""Summarise cache keys by shape, so we can see which id spaces the app caches.

Usage: python key_shape.py [db path]
"""
from __future__ import annotations

import collections
import os
import re
import sqlite3

STORE_ID = re.compile(r"^[0-9A-Z]{12}$")
GUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def shape(key: str) -> str:
    if key.startswith("steam:"):
        return "steam:<appid>"
    if STORE_ID.match(key):
        return "store product id"
    if GUID.match(key):
        return "guid"
    if not key:
        return "(empty)"
    return "other"


def main() -> int:
    local = os.environ.get("LOCALAPPDATA", "")
    db = os.path.join(
        local, r"Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState\AsyncCache.db"
    )
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    cur = con.cursor()
    for scope in [r[0] for r in cur.execute("select distinct scope from AsyncCache")]:
        keys = [r[0] for r in cur.execute("select key from AsyncCache where scope=?", (scope,))]
        counts = collections.Counter(shape(k) for k in keys)
        if len(keys) < 4:
            continue
        print(f"{scope:<26} {dict(counts)}")
        odd = [k for k in keys if shape(k) in ("steam:<appid>", "other")][:8]
        if odd:
            print(f"    non-store keys: {odd}")

    print("\n=== rows whose VALUE mentions a third-party provider ===")
    rows = cur.execute(
        "select scope, key from AsyncCache where value like '%steam:%' or value like '%ThirdPartyProvider%' limit 20"
    ).fetchall()
    for scope, key in rows:
        print(f"  {scope:<24} {key!r}")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
