"""Probe the Xbox app's ImageCache.db and its cached AppConfig JSON."""
from __future__ import annotations

import json
import os
import sqlite3

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"


def pkg(*parts: str) -> str:
    return os.path.join(os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, *parts)


def image_cache() -> None:
    path = pkg("LocalCache", "ImageCache", "ImageCache.db")
    print(f"=== ImageCache.db ({os.path.getsize(path):,} bytes)")
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    for kind, name in con.execute("select type, name from sqlite_master"):
        print(f"  [{kind}] {name}")
    tables = [r[0] for r in con.execute("select name from sqlite_master where type='table'")]
    for table in tables:
        cols = [r[1] for r in con.execute(f'pragma table_info("{table}")')]
        count = con.execute(f'select count(*) from "{table}"').fetchone()[0]
        print(f"\n--- {table}: {count:,} rows, columns={cols}")
        for row in con.execute(f'select * from "{table}" limit 3'):
            print("   ", [str(v)[:120] for v in row])
        textcols = [c for c in cols if c.lower() in ("url", "uri", "key", "source", "path")]
        if textcols:
            col = textcols[0]
            hits = con.execute(
                f'select {col} from "{table}" where {col} like "%steam%" limit 5'
            ).fetchall()
            print(f"   rows mentioning steam in {col}: {hits}")
    con.close()


def app_config() -> None:
    folder = pkg("LocalCache", "AppConfig")
    if not os.path.isdir(folder):
        return
    for name in os.listdir(folder):
        if not name.endswith(".json"):
            continue
        path = os.path.join(folder, name)
        print(f"\n=== {name} ({os.path.getsize(path):,} bytes)")
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            try:
                obj = json.load(fh)
            except Exception as exc:
                print("   not json:", exc)
                continue
        print("   top-level:", list(obj.keys())[:20])
        flights = obj.get("experimentation", {}).get("activeFlights", [])
        third = [f for f in flights if "provider" in f or "3p" in f or "library" in f or "owned" in f]
        print(f"   flights={len(flights)} third-party-ish={third}")
        for key, value in obj.items():
            if key == "experimentation":
                continue
            text = json.dumps(value)[:400]
            print(f"   {key}: {text}")


if __name__ == "__main__":
    image_cache()
    app_config()
