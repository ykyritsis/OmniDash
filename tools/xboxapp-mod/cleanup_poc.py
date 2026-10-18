"""Remove the proof-of-concept artifacts created by this session.

- deletes the synthetic product_summary row (steam:3228590)
- drops custom-library entries that point at our generated card
- deletes the generated card image
Leaves every pre-existing entry (for example "SP Football Life 2026") untouched.
"""
from __future__ import annotations

import json
import os
import sqlite3

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"
PRODUCT_ID = "steam:3228590"
OUR_IMAGE = "dsh-deadzone-rogue.png"


def local(*parts: str) -> str:
    return os.path.join(os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, *parts)


def main() -> int:
    db = local("LocalState", "AsyncCache.db")
    con = sqlite3.connect(db)
    with con:
        row = con.execute(
            "select count(*) from AsyncCache where scope='product_summary' and key=?",
            (PRODUCT_ID,),
        ).fetchone()[0]
        con.execute(
            "delete from AsyncCache where scope='product_summary' and key=?", (PRODUCT_ID,)
        )
        rv = con.execute(
            "select value from AsyncCache where scope='recently_viewed_products' and key='items'"
        ).fetchone()
        if rv:
            items = [i for i in json.loads(rv[0]) if i.get("productId") != PRODUCT_ID]
            con.execute(
                "update AsyncCache set value=? where scope='recently_viewed_products' and key='items'",
                (json.dumps(items),),
            )
    con.close()
    print(f"product_summary rows removed: {row}")

    manifest = local("LocalState", "CustomLibraryManagement", "CustomLibraryManagement.manifest")
    removed = []
    if os.path.exists(manifest) and os.path.getsize(manifest) > 0:
        with open(manifest, "r", encoding="utf-8") as fh:
            doc = json.load(fh)
        cache = doc.get("gameCache", {})
        for pid in list(cache):
            if pid == "version" or not isinstance(cache[pid], dict):
                continue
            entry = cache[pid]
            if os.path.basename(entry.get("imagePath", "")) == OUR_IMAGE:
                removed.append(entry.get("title", pid))
                cache.pop(pid)
        with open(manifest, "w", encoding="utf-8") as fh:
            json.dump(doc, fh, ensure_ascii=False)
        print(f"custom entries removed: {removed}; kept {len([k for k in cache if k != 'version'])}")
    else:
        print("custom manifest empty or missing")

    image = local("LocalState", "CustomLibraryManagement", "Images", OUR_IMAGE)
    if os.path.exists(image):
        os.remove(image)
        print(f"image removed: {image}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
