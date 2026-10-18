"""Inject custom metadata for a non-Xbox (Steam) game into the official Xbox app.

The Xbox app keeps its UI data in a plain SQLite cache
(%LOCALAPPDATA%\\Packages\\Microsoft.GamingApp_8wekyb3d8bbwe\\LocalState\\AsyncCache.db).
This tool writes one synthetic product entry and links it into the cached home
collections, so the app has metadata for a game Microsoft's catalog does not know.

Usage:
    python inject_metadata.py            # dry run, prints what would change
    python inject_metadata.py --apply    # backup + write
    python inject_metadata.py --restore  # restore newest backup

Everything is reversible: the untouched database is copied next to the original.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import sqlite3
import sys
import time

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"
HERE = os.path.dirname(os.path.abspath(__file__))

STEAM_APPID = "3228590"          # Deadzone: Rogue (installed in the Steam library)
PRODUCT_ID = f"steam:{STEAM_APPID}"
TITLE = "Deadzone: Rogue"
DEV = "Local metadata (injected)"
DESC = (
    "A Steam game that Microsoft's catalog has no entry for. This text, the "
    "artwork and the category list were injected locally into the Xbox app's "
    "own cache, with no signed file modified."
)
ART = [
    ("https://cdn.akamai.steamstatic.com/steam/apps/3228590/library_600x900.jpg", 900, 600, "POSTER"),
    ("https://cdn.akamai.steamstatic.com/steam/apps/3228590/library_600x900_2x.jpg", 1800, 1200, "BOXART"),
    ("https://cdn.akamai.steamstatic.com/steam/apps/3228590/library_hero.jpg", 3840, 1240, "SUPERHEROART"),
    ("https://cdn.akamai.steamstatic.com/steam/apps/3228590/logo.png", 800, 584, "BRANDEDKEYART"),
]
FUTURE = int((time.time() + 10 * 365 * 24 * 3600) * 1000)  # ms, keeps caches "fresh"
FOREVER = 1.7976931348623157e308


def db_path() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, "LocalState", "AsyncCache.db"
    )


def load_template(con: sqlite3.Connection) -> dict:
    """Use the richest cached product summary as a structural template."""
    best = None
    for value, in con.execute("select value from AsyncCache where scope='product_summary'"):
        try:
            data = json.loads(value)["data"]
        except Exception:
            continue
        score = sum(
            k in data for k in ("artwork", "shortDescription", "developer", "categories", "capabilities")
        )
        if best is None or score > best[0]:
            best = (score, data)
    if not best:
        raise SystemExit("no product_summary rows to use as a template")
    return json.loads(json.dumps(best[1]))  # deep copy


def build_summary(template: dict, title: str = TITLE, desc: str = DESC) -> dict:
    data = template
    data["title"] = title
    data["shortTitle"] = title
    data["developer"] = DEV
    data["publisher"] = DEV
    data["shortDescription"] = desc
    data["description"] = desc
    data["categories"] = ["Action", "Roguelike"]
    data["productKind"] = "GAME"
    data["availablePlatforms"] = ["PC"]
    data["averageRating"] = 4.4
    data["ratingCount"] = 1337
    data["releaseDate"] = "2026-01-01T00:00:00Z"
    data["artwork"] = [
        {"uri": uri, "height": h, "width": w, "purpose": purpose} for uri, h, w, purpose in ART
    ]
    data["alternateIds"] = [{"idType": "STEAMAPPID", "id": STEAM_APPID}]
    data.pop("contentRating", None)
    return {"type": 2, "data": data}


def patch_collection(node: dict, add_first: bool = True) -> bool:
    data = node.setdefault("data", {})
    ids = data.get("productIds")
    if ids is None:
        return False
    if PRODUCT_ID in ids:
        ids.remove(PRODUCT_ID)
    if add_first:
        ids.insert(0, PRODUCT_ID)
    else:
        ids.append(PRODUCT_ID)
    data["totalCount"] = (data.get("totalCount") or len(ids)) + 1
    node["lastFetchedMS"] = FUTURE
    node["cacheTimeInMS"] = int(FOREVER)
    life = data.get("lifeCycle")
    if isinstance(life, dict):
        life["timeToRefresh"] = 0
        life["timeToExpire"] = FOREVER
        life["timeToLive"] = FOREVER
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write changes (default: dry run)")
    ap.add_argument("--restore", action="store_true", help="restore the newest backup")
    ap.add_argument("--title", default=TITLE, help="override the injected title")
    ap.add_argument("--desc", default=DESC, help="override the injected description")
    args = ap.parse_args()

    path = db_path()
    if not os.path.exists(path):
        raise SystemExit(f"cache db not found: {path}")
    print(f"db: {path}")

    if args.restore:
        backups = sorted(
            (f for f in os.listdir(os.path.dirname(path)) if f.startswith("AsyncCache.db.bak-")),
        )
        if not backups:
            raise SystemExit("no backup found")
        newest = os.path.join(os.path.dirname(path), backups[-1])
        shutil.copy2(newest, path)
        print(f"restored from {newest}")
        return 0

    con = sqlite3.connect(path)
    cur = con.cursor()
    template = load_template(con)
    summary = build_summary(template, args.title, args.desc)
    summary_json = json.dumps(summary, ensure_ascii=False)
    print(f"product id      : {PRODUCT_ID}")
    print(f"summary payload : {len(summary_json):,} chars, title={summary['data']['title']!r}")
    print(f"artwork         : {[a['purpose'] for a in summary['data']['artwork']]}")

    changes: list[str] = []

    # 1. the product summary itself
    exists = cur.execute(
        "select count(*) from AsyncCache where scope='product_summary' and key=?", (PRODUCT_ID,)
    ).fetchone()[0]
    changes.append(f"product_summary row for {PRODUCT_ID} ({'replace' if exists else 'insert'})")

    # 2. every cached home collection gets the id prepended
    touched = []
    for scope in ("collections",):
        row = cur.execute("select value from AsyncCache where scope=?", (scope,)).fetchone()
        if not row:
            continue
        coll = json.loads(row[0])
        for name, node in coll.items():
            if patch_collection(node):
                touched.append(name)
        changes.append(f"{scope}: id added to {len(touched)} collections")
        for name in touched:
            print(f"    + {name[:52]}")

    # 3. the "recently viewed" list (this id space already uses steam: ids)
    rv_row = cur.execute(
        "select value from AsyncCache where scope='recently_viewed_products' and key='items'"
    ).fetchone()
    if rv_row:
        items = json.loads(rv_row[0])
        items = [i for i in items if i.get("productId") != PRODUCT_ID]
        items.insert(0, {"productId": PRODUCT_ID, "timestamp": int(time.time() * 1000)})
        changes.append(f"recently_viewed_products: prepended {PRODUCT_ID}")

    print("\nplanned changes:")
    for change in changes:
        print(f"  - {change}")

    if not args.apply:
        print("\ndry run only; re-run with --apply to write")
        con.close()
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = f"{path}.bak-{stamp}"
    con.close()
    shutil.copy2(path, backup)
    print(f"\nbackup: {backup}")

    con = sqlite3.connect(path)
    cur = con.cursor()
    with con:
        cur.execute(
            "insert or replace into AsyncCache (scope, scopeVersion, key, value) "
            "values ('product_summary', 1, ?, ?)",
            (PRODUCT_ID, summary_json),
        )
        if touched:
            cur.execute(
                "update AsyncCache set value=? where scope='collections'",
                (json.dumps(coll, ensure_ascii=False),),
            )
        if rv_row:
            cur.execute(
                "insert or replace into AsyncCache (scope, scopeVersion, key, value) "
                "values ('recently_viewed_products', 1, 'items', ?)",
                (json.dumps(items, ensure_ascii=False),),
            )
    con.commit()
    con.close()
    print("written. restore with: python inject_metadata.py --restore")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

