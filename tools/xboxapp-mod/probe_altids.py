"""Show how the Xbox app maps alternative ids (title id / package family name) to products."""
from __future__ import annotations

import os
import sqlite3

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"


def db() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, "LocalState", "AsyncCache.db"
    )


def main() -> int:
    con = sqlite3.connect(f"file:{db()}?mode=ro", uri=True)
    for scope in ("product_altid_titleid", "product_altid_pfn"):
        print(f"=== {scope}")
        for key, value in con.execute(
            "select key, value from AsyncCache where scope=? limit 5", (scope,)
        ):
            print(f"   {key} -> {value}")
        # is there an entry for our steam id?
        row = con.execute(
            "select key, value from AsyncCache where scope=? and value like '%3228590%' limit 3",
            (scope,),
        ).fetchall()
        print(f"   rows whose value mentions 3228590: {row}")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
