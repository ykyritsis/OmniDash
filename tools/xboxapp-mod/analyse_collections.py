"""Analyse the Xbox app's collection id spaces (all PC GAFD products vs Store ids)."""
from __future__ import annotations

import collections
import json
import os
import sqlite3


def db_path() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        r"Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState\AsyncCache.db",
    )


def prefix_of(pid: str) -> str:
    if pid.startswith("steam:"):
        return "steam:"
    if ":" in pid:
        return pid.split(":", 1)[0] + ":"
    return "store12"


def main() -> int:
    con = sqlite3.connect(f"file:{db_path()}?mode=ro", uri=True)
    cur = con.cursor()
    meta = json.loads(
        cur.execute("select value from AsyncCache where scope='collections_metadata'").fetchone()[0]
    )
    allp = meta.get("allPCGAProducts", {})
    print("allPCGAProducts metadata:", json.dumps(allp, indent=2)[:400])

    coll = json.loads(
        cur.execute("select value from AsyncCache where scope='collections'").fetchone()[0]
    )
    node = coll["allPCGAProducts"]["data"]
    ids = node.get("productIds") or []
    print(f"\nallPCGAProducts: title={node.get('title')!r} totalCount={node.get('totalCount')} "
          f"ids_in_cache={len(ids)}")
    print("prefix histogram:", dict(collections.Counter(prefix_of(i) for i in ids)))
    print("first 12:", ids[:12])
    steam = [i for i in ids if i.startswith("steam:")]
    print(f"steam ids: {len(steam)}; sample: {steam[:12]}")

    msix = coll["allMsixvcGames"]["data"]
    mids = msix.get("productIds") or []
    print(f"\nallMsixvcGames: title={msix.get('title')!r} totalCount={msix.get('totalCount')} "
          f"ids_in_cache={len(mids)}")
    print("prefix histogram:", dict(collections.Counter(prefix_of(i) for i in mids)))

    print("\n=== editorial rows (home shelves) ===")
    for key, val in coll.items():
        if not key.startswith("SiglV3Editorial"):
            continue
        data = val.get("data", {})
        pids = data.get("productIds") or []
        print(f"{key[:52]:<52} title={data.get('title')!r} n={len(pids)} "
              f"hist={dict(collections.Counter(prefix_of(i) for i in pids))}")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
