"""Give an app-registered custom game its own artwork and title.

The live manifest is
%LOCALAPPDATA%\\Packages\\Microsoft.GamingApp_8wekyb3d8bbwe\\LocalState\\
ThirdPartyLibraries\\CustomLibraryManagement\\CustomLibraryManagement.manifest
(not the sibling LocalState\\CustomLibraryManagement\\ folder, which only holds images).

Usage:
    python custom_entry_art.py --exe DeadzoneSteam.exe --title "Deadzone: Rogue" --art <url|file>
    add --apply to write, --restore to undo the newest backup
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import os
import shutil
import urllib.request

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"


def pkg(*parts: str) -> str:
    return os.path.join(os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, *parts)


MANIFEST = pkg("LocalState", "ThirdPartyLibraries", "CustomLibraryManagement",
               "CustomLibraryManagement.manifest")
IMAGES = pkg("LocalState", "CustomLibraryManagement", "Images")


def make_art(source: str, target: str, size=(600, 800)) -> None:
    from PIL import Image

    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=30) as response:
            raw = response.read()
        img = Image.open(io.BytesIO(raw))
    else:
        img = Image.open(source)
    img = img.convert("RGBA")
    want = size[0] / size[1]
    have = img.width / img.height
    if have > want:  # too wide: crop sides
        new_w = int(img.height * want)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))
    else:  # too tall: crop top/bottom
        new_h = int(img.width / want)
        top = (img.height - new_h) // 3
        img = img.crop((0, top, img.width, top + new_h))
    img = img.resize(size, Image.LANCZOS)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    img.save(target, "PNG")
    print(f"art: {target} ({os.path.getsize(target):,} bytes, {size[0]}x{size[1]})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--exe", default="DeadzoneSteam.exe")
    ap.add_argument("--title", default="Deadzone: Rogue")
    ap.add_argument("--art", default="https://cdn.akamai.steamstatic.com/steam/apps/3228590/library_600x900.jpg")
    ap.add_argument("--image-name", default="dsh-deadzone-rogue.png")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--restore", action="store_true")
    args = ap.parse_args()

    if args.restore:
        backups = sorted(
            f for f in os.listdir(os.path.dirname(MANIFEST))
            if f.startswith("CustomLibraryManagement.manifest.bak-")
        )
        if not backups:
            raise SystemExit("no backup found")
        newest = os.path.join(os.path.dirname(MANIFEST), backups[-1])
        shutil.copy2(newest, MANIFEST)
        print(f"restored from {newest}")
        return 0

    with open(MANIFEST, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    cache = doc.get("gameCache", {})
    entries = {k: v for k, v in cache.items() if k != "version" and isinstance(v, dict)}
    print(f"entries in live manifest: {len(entries)}")
    for key, entry in entries.items():
        mark = " <-- target" if entry.get("executableName") == args.exe else ""
        print(f"   {entry.get('title')!r} exe={entry.get('executableName')!r}{mark}")

    target_key = next(
        (k for k, v in entries.items() if v.get("executableName") == args.exe), None
    )
    if not target_key:
        raise SystemExit(f"no entry with executableName={args.exe!r}; add the game in the app first")

    image_path = os.path.join(IMAGES, args.image_name)
    entry = entries[target_key]
    print(f"target entry   : {target_key}")
    print(f"old title      : {entry.get('title')!r}")
    print(f"old imagePath  : {entry.get('imagePath')!r}")
    entry["title"] = args.title
    entry["imagePath"] = image_path
    print(f"new title      : {entry['title']!r}")
    print(f"new imagePath  : {entry['imagePath']}")

    if not args.apply:
        print("\ndry run; re-run with --apply to write")
        return 0

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = f"{MANIFEST}.bak-{stamp}"
    shutil.copy2(MANIFEST, backup)
    print(f"backup: {backup}")
    make_art(args.art, image_path)
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False)
    print(f"manifest written: {os.path.getsize(MANIFEST):,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
