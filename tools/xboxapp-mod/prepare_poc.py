"""Prepare a real product_summary as a template and list injectable home rows.

Writes: template-product_summary.json next to this script.
Prints: the editorial rows and their first few product ids with cached titles.
"""
from __future__ import annotations

import json
import os
import sqlite3


def db_path() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""),
        r"Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState\AsyncCache.db",
    )


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    con = sqlite3.connect(f"file:{db_path()}?mode=ro", uri=True)
    cur = con.cursor()

    # Pick a compact, complete summary as a structural template.
    row = cur.execute(
        "select key, value from AsyncCache where scope='product_summary' "
        "order by length(value) asc limit 1"
    ).fetchone()
    key, value = row
    obj = json.loads(value)
    with open(os.path.join(here, "template-product_summary.json"), "w", encoding="utf-8") as fh:
        json.dump(obj, fh, indent=2, ensure_ascii=False)
    print(f"template from product {key}: {len(value):,} chars, keys={sorted(obj['data'].keys())}")

    titles = {}
    for pid, val in cur.execute(
        "select key, value from AsyncCache where scope='product_summary'"
    ):
        try:
            data = json.loads(val)["data"]
        except Exception:
            continue
        titles[pid] = data.get("title") or data.get("shortTitle") or ""

    coll = json.loads(
        cur.execute("select value from AsyncCache where scope='collections'").fetchone()[0]
    )
    print("\n=== injectable rows ===")
    for name, node in coll.items():
        data = node.get("data", {})
        pids = data.get("productIds") or []
        if not pids:
            continue
        sample = [(p, titles.get(p, "<no summary>")) for p in pids[:4]]
        print(f"{name[:46]:<46} n={len(pids):<4} title={data.get('title')!r}")
        for pid, title in sample:
            print(f"      {pid}  {title[:60]}")
    con.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
