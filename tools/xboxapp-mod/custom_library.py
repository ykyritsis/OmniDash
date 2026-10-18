"""Add or update a custom game in the official Xbox app using files only.

Live store
    %LOCALAPPDATA%\\Packages\\Microsoft.GamingApp_8wekyb3d8bbwe\\LocalState\\
    ThirdPartyLibraries\\CustomLibraryManagement\\CustomLibraryManagement.manifest
Artwork
    %LOCALAPPDATA%\\Packages\\Microsoft.GamingApp_8wekyb3d8bbwe\\LocalState\\
    CustomLibraryManagement\\Images\\<name>.png

The app rewrites that manifest from its own state at start-up, so every Xbox
process (XboxPcApp, XboxPcAppFT, XboxPcTray, XboxGameBarWidgets) must be closed
before writing, otherwise the edit is reverted. This tool enforces that.

Entry shape the app itself writes:
    "{<guid>}": {
      "id": "{<guid>}",
      "addedDate": "1792216340928",
      "imagePath": "ms-appx:///Assets/CustomLibraryFallback.png",
      "title": "Deadzone Rogue",
      "installLocation": "C:\\...\\Deadzone Rogue\\",
      "executableName": "DeadzoneSteam.exe",
      "executableCommandArgs": ""
    }

Usage:
    python custom_library.py add --exe "<path to game.exe>" --title "Game" [--art <png|url>]
    python custom_library.py set-art --exe-name DeadzoneSteam.exe --art <png|url>
    python custom_library.py list
    python custom_library.py remove --exe-name DeadzoneSteam.exe
    add --apply / --restore to actually write
"""
from __future__ import annotations

import argparse
import datetime as dt
import io
import json
import os
import shutil
import subprocess
import urllib.request
import uuid

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"
PROCESS_NAMES = ("XboxPcApp.exe", "XboxPcAppCE.exe", "XboxPcAppFT.exe", "XboxPcTray.exe",
                 "XboxGameBarWidgets.exe", "GameBar.exe", "GameBarFTServer.exe")


def pkg(*parts: str) -> str:
    return os.path.join(os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, *parts)


MANIFEST = pkg("LocalState", "ThirdPartyLibraries", "CustomLibraryManagement",
               "CustomLibraryManagement.manifest")
IMAGES = pkg("LocalState", "CustomLibraryManagement", "Images")


def running() -> list[str]:
    out = subprocess.run(["tasklist", "/fo", "csv", "/nh"], capture_output=True, text=True).stdout
    names = {line.split('","')[0].strip('"').lower() for line in out.splitlines() if line}
    return [n for n in PROCESS_NAMES if n.lower() in names]


def load() -> dict:
    if not os.path.exists(MANIFEST):
        return {"version": 1, "provider": {"version": 1, "enabled": True},
                "gameCache": {"version": 1}}
    with open(MANIFEST, "r", encoding="utf-8") as fh:
        return json.load(fh)


def entries(doc: dict) -> list[dict]:
    return [v for k, v in doc["gameCache"].items() if k != "version" and isinstance(v, dict)]


def make_art(source: str, target: str, size: int = 512) -> None:
    from PIL import Image

    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=30) as response:
            img = Image.open(io.BytesIO(response.read()))
    else:
        img = Image.open(source)
    img = img.convert("RGBA")
    side = min(img.width, img.height)
    left = (img.width - side) // 2
    img = img.crop((left, 0, left + side, side)).resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(target), exist_ok=True)
    img.save(target, "PNG")
    print(f"art: {target} ({os.path.getsize(target):,} bytes, {size}x{size})")


def write(doc: dict) -> None:
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    if os.path.exists(MANIFEST):
        shutil.copy2(MANIFEST, f"{MANIFEST}.bak-{stamp}")
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False)
    print(f"manifest written: {os.path.getsize(MANIFEST):,} bytes")


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add")
    p_add.add_argument("--exe", required=True)
    p_add.add_argument("--title", required=True)
    p_add.add_argument("--art", default="")
    p_add.add_argument("--arg", default="", help="command line arguments for the executable")
    p_add.add_argument("--apply", action="store_true")
    p_add.add_argument("--kill", action="store_true")

    p_art = sub.add_parser("set-art")
    p_art.add_argument("--exe-name", required=True)
    p_art.add_argument("--art", required=True)
    p_art.add_argument("--apply", action="store_true")
    p_art.add_argument("--kill", action="store_true")

    p_rem = sub.add_parser("remove")
    p_rem.add_argument("--exe-name", required=True)
    p_rem.add_argument("--apply", action="store_true")
    p_rem.add_argument("--kill", action="store_true")

    sub.add_parser("list")

    args = ap.parse_args()
    if args.cmd == "list":
        for entry in entries(load()):
            print(f"{entry.get('title')!r} exe={entry.get('executableName')!r} "
                  f"image={os.path.basename(entry.get('imagePath', ''))}")
        return 0

    busy = running()
    if busy:
        if args.kill:
            import time
            for attempt in range(6):
                print(f"stopping (attempt {attempt + 1}): {', '.join(busy)}")
                for name in busy:
                    subprocess.run(["taskkill", "/f", "/im", name], capture_output=True)
                time.sleep(1)
                busy = running()
                if not busy:
                    break
        if busy:
            raise SystemExit(
                f"these processes must be closed or the edit is reverted: {', '.join(busy)}\n"
                "re-run with --kill to let this tool stop them"
            )

    doc = load()
    cache = doc["gameCache"]

    if args.cmd == "add":
        exe = args.exe
        if not os.path.exists(exe):
            raise SystemExit(f"executable not found: {exe}")
        name = os.path.basename(exe)
        folder = os.path.dirname(exe) + "\\"
        existing = next((k for k, v in cache.items()
                         if isinstance(v, dict) and v.get("executableName") == name
                         and v.get("installLocation") == folder
                         and v.get("title") == args.title), None)
        guid = existing or "{" + str(uuid.uuid4()) + "}"
        entry = cache.get(guid, {"id": guid, "addedDate": str(int(__import__("time").time() * 1000)),
                                 "imagePath": "ms-appx:///Assets/CustomLibraryFallback.png"})
        entry.update({"title": args.title, "installLocation": folder, "executableName": name,
                      "executableCommandArgs": (args.arg or "").strip()})
        if args.art:
            slug = "".join(c if c.isalnum() else "-" for c in args.title).strip("-").lower()[:40]
            image = os.path.join(IMAGES, f"{slug}.png")
            entry["imagePath"] = image
        cache[guid] = entry
        print(f"{'updated' if existing else 'added'}: {guid} {args.title!r}")
        print(f"launch: {folder}{name} {entry['executableCommandArgs']}")
        if not args.apply:
            print("dry run; re-run with --apply")
            return 0
        write(doc)
        if args.art:
            make_art(args.art, image)
        return 0

    if args.cmd == "set-art":
        target = next((v for v in entries(doc) if v.get("executableName") == args.exe_name), None)
        if not target:
            raise SystemExit(f"no entry with executableName={args.exe_name!r}")
        image = os.path.join(IMAGES, os.path.splitext(args.exe_name)[0] + ".png")
        target["imagePath"] = image
        print(f"imagePath -> {image}")
        if not args.apply:
            print("dry run; re-run with --apply")
            return 0
        write(doc)
        make_art(args.art, image)
        return 0

    if args.cmd == "remove":
        for key in [k for k, v in cache.items()
                    if isinstance(v, dict) and v.get("executableName") == args.exe_name]:
            cache.pop(key)
            print(f"removed {key}")
        if not args.apply:
            print("dry run; re-run with --apply")
            return 0
        write(doc)
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
