"""Add a custom (non-Xbox) game with custom artwork to the official Xbox app.

The app keeps user-added games in
%LOCALAPPDATA%\\Packages\\Microsoft.GamingApp_8wekyb3d8bbwe\\LocalState\\
CustomLibraryManagement\\CustomLibraryManagement.manifest

Each entry carries: id (guid), title, imagePath, installLocation, executableName,
executableCommandArgs, addedDate, lastPlayedDate. This tool writes one entry and
prepares a 512x512 PNG capsule for it, backing up the manifest first.

Usage:
    python add_custom_entry.py             # dry run
    python add_custom_entry.py --apply
    python add_custom_entry.py --restore
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import time
import urllib.request
import uuid

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"

GAME = {
    "title": "Deadzone: Rogue",
    "installLocation": r"C:\Program Files (x86)\Steam\steamapps\common\Deadzone Rogue" + "\\",
    "executableName": "DeadzoneSteam.exe",
    "art": "https://cdn.akamai.steamstatic.com/steam/apps/3228590/library_600x900.jpg",
    "image_name": "dsh-deadzone-rogue.png",
}

# The entry that was in the manifest before the app cleared it (restored as-is).
PREVIOUS_ENTRY = {
    "id": "166b5d59-cf07-49e6-9609-a23037d81322",
    "lastPlayedDate": "1791540352118",
    "addedDate": "1791540306169",
    "imagePath": r"C:\Users\ykyri\AppData\Local\Packages\Microsoft.GamingApp_8wekyb3d8bbwe\LocalState\CustomLibraryManagement\Images\3220284469658167772.png",
    "title": "SP Football Life 2026",
    "installLocation": r"D:\Games\SP Football Life 2026" + "\\",
    "executableName": "FL 2026 start.exe",
    "executableCommandArgs": "",
}


def base_dir() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, "LocalState", "CustomLibraryManagement"
    )


def manifest_path() -> str:
    return os.path.join(base_dir(), "CustomLibraryManagement.manifest")


def make_image(target: str) -> None:
    """Download the Steam capsule and centre-crop it into a 512x512 PNG."""
    from PIL import Image  # bundled Pillow
    import io

    with urllib.request.urlopen(GAME["art"], timeout=30) as response:
        raw = response.read()
    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    side = min(img.width, img.height)
    left = (img.width - side) // 2
    top = (img.height - side) // 3
    img = img.crop((left, top, left + side, top + side)).resize((512, 512), Image.LANCZOS)
    img.save(target, "PNG")
    print(f"image written: {target} ({os.path.getsize(target):,} bytes, 512x512)")


def make_card(target: str, label: str, title: str) -> None:
    """Generate a 512x512 card with drawn text, to prove the art is ours."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGBA", (512, 512), (14, 18, 24, 255))
    draw = ImageDraw.Draw(img)
    for y in range(512):
        shade = int(24 + (y / 512) * 40)
        draw.line([(0, y), (512, y)], fill=(shade // 2, shade, shade - 6, 255))
    draw.rectangle([24, 380, 488, 492], fill=(10, 120, 90, 235))
    font_big = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 44)
    font_small = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 24)
    lines = [title[:22]] + [label[i : i + 26] for i in range(0, len(label), 26)]
    y = 388
    for index, line in enumerate(lines):
        draw.text((40, y), line, font=font_big if index == 0 else font_small, fill=(255, 255, 255, 255))
        y += 44 if index == 0 else 30
    img.save(target, "PNG")
    print(f"card written: {target} ({os.path.getsize(target):,} bytes, 512x512)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--restore", action="store_true")
    ap.add_argument("--title", default=GAME["title"], help="display title for the entry")
    ap.add_argument(
        "--label",
        default="",
        help="draw this text on a generated 512x512 card instead of downloading Steam art",
    )
    args = ap.parse_args()

    path = manifest_path()
    print(f"manifest: {path}")
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")

    if args.restore:
        backups = sorted(
            (f for f in os.listdir(base_dir()) if f.startswith("CustomLibraryManagement.manifest.bak-"))
        )
        if not backups:
            raise SystemExit("no backup found")
        newest = os.path.join(base_dir(), backups[-1])
        shutil.copy2(newest, path)
        print(f"restored from {newest}")
        return 0

    now_ms = str(int(time.time() * 1000))
    new_id = str(uuid.uuid4())
    image_target = os.path.join(base_dir(), "Images", GAME["image_name"])
    entry = {
        "id": new_id,
        "lastPlayedDate": now_ms,
        "addedDate": now_ms,
        "imagePath": image_target,
        "title": args.title,
        "installLocation": GAME["installLocation"],
        "executableName": GAME["executableName"],
        "executableCommandArgs": "",
    }

    cache: dict[str, dict] = {}
    if os.path.exists(path) and os.path.getsize(path) > 0:
        try:
            with open(path, "r", encoding="utf-8") as fh:
                cache = json.load(fh).get("gameCache", {})
            cache.pop("version", None)
            print(f"existing entries kept: {len(cache)}")
        except Exception as exc:
            print(f"existing manifest unreadable ({exc}); starting fresh")
    cache[PREVIOUS_ENTRY["id"]] = PREVIOUS_ENTRY
    # Reuse one existing entry for the same executable and drop any duplicates.
    matches = [
        pid
        for pid, existing in cache.items()
        if isinstance(existing, dict)
        and existing.get("executableName") == GAME["executableName"]
        and existing.get("installLocation") == GAME["installLocation"]
    ]
    if matches:
        new_id = matches[0]
        entry["id"] = new_id
        for pid in matches:
            cache.pop(pid, None)
    cache[new_id] = entry
    doc = {
        "version": 1,
        "provider": {"version": 1, "enabled": True},
        "gameCache": {"version": 1, **cache},
    }

    print(f"new entry id : {new_id}")
    print(f"title        : {entry['title']}")
    print(f"exe          : {entry['installLocation']}{entry['executableName']}")
    print(f"image        : {image_target}")
    print(f"entries      : {len(cache)}")

    if not args.apply:
        print("\ndry run only; re-run with --apply to write")
        return 0

    os.makedirs(os.path.join(base_dir(), "Images"), exist_ok=True)
    backup = f"{path}.bak-{stamp}"
    if os.path.exists(path):
        shutil.copy2(path, backup)
        print(f"backup: {backup} ({os.path.getsize(path):,} bytes)")
    if args.label:
        make_card(image_target, args.label, args.title)
    else:
        make_image(image_target)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False)
    print(f"manifest written: {os.path.getsize(path):,} bytes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
