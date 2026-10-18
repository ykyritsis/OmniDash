"""Show which backend requests the Xbox app made (and their error status) for a product id."""
from __future__ import annotations

import json
import os
import sqlite3

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"


def db() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, "LocalState", "AsyncCache.db"
    )


def main() -> int:
    con = sqlite3.connect(f"file:{db()}?mode=ro", uri=True)
    for scope in ("http_error_counts", "http_error_timestamp"):
        row = con.execute("select key, value from AsyncCache where scope=?", (scope,)).fetchone()
        print(f"=== {scope}")
        if not row:
            print("   (none)")
            continue
        try:
            data = json.loads(row[1])
        except Exception:
            data = row[1]
        text = json.dumps(data, indent=1) if not isinstance(data, str) else data
        print(text[:2500])

    print("\n=== cache keys containing pcgafd / steam / productdetails")
    for scope, key in con.execute("select scope, key from AsyncCache"):
        if "pcgafd" in key or "productdetails" in key or "steam:" in key:
            print(f"   {scope:<24} {key[:160]}")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
