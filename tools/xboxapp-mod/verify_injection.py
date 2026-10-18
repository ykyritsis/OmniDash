"""Report whether the injected metadata survived the app's own cache refresh."""
from __future__ import annotations

import json
import os
import sqlite3

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"
GUID = "cfa0f342-90d5-46c7-a6c4-6f0761101203"


def db() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, "LocalState", "AsyncCache.db"
    )


def main() -> int:
    con = sqlite3.connect(f"file:{db()}?mode=ro", uri=True)
    row = con.execute(
        "select value from AsyncCache where scope='product_summary' and key='steam:3228590'"
    ).fetchone()
    if row:
        data = json.loads(row[0])["data"]
        print("injected product_summary: PRESENT")
        print(f"  title={data.get('title')!r} dev={data.get('developer')!r}")
        print(f"  categories={data.get('categories')} artwork={len(data.get('artwork', []))} images")
    else:
        print("injected product_summary: GONE (app overwrote it)")

    hits = [
        (scope, key)
        for scope, key in con.execute("select scope, key from AsyncCache")
        if GUID in key or GUID in (con.execute(
            "select value from AsyncCache where scope=? and key=?", (scope, key)
        ).fetchone() or [""])[0][:4000]
    ]
    print(f"rows mentioning the custom entry: {hits}")

    coll = con.execute("select value from AsyncCache where scope='collections'").fetchone()[0]
    n = coll.count("steam:3228590")
    print(f"collections references to steam:3228590: {n}")
    total = con.execute("select count(*) from AsyncCache").fetchone()[0]
    print(f"total cache rows: {total}")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
