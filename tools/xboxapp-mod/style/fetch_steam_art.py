"""Fetch Steam artwork and drop it where the Xbox app's Steam provider expects it.

The app only lists Steam games for which it has art in
%LOCALAPPDATA%\\Packages\\Microsoft.GamingApp_8wekyb3d8bbwe\\LocalState\\
ThirdPartyLibraries\\steam\\steam_<appid>.png

It fetches that art itself, but for some appids the fetch fails (new-style Steam
asset URLs, pre-release titles) and the game is then silently missing from
"My games". This script fills the gap with artwork from the Steam store API.

Usage:
    python fetch_steam_art.py 4080220 1238860 1846380 2922410
    python fetch_steam_art.py --all-missing
"""
from __future__ import annotations

import io
import json
import os
import sys
import urllib.request

PKG = "Microsoft.GamingApp_8wekyb3d8bbwe"
API = "https://store.steampowered.com/api/appdetails?appids={appid}&l=english"


def art_dir() -> str:
    return os.path.join(
        os.environ.get("LOCALAPPDATA", ""), "Packages", PKG, "LocalState",
        "ThirdPartyLibraries", "steam",
    )


def missing_appids() -> list[str]:
    """Appids present in the provider manifest but without an art file."""
    base = art_dir()
    manifest = os.path.join(base, "steam.manifest")
    if not os.path.exists(manifest):
        return []
    with open(manifest, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    ids = [k.split(":", 1)[1] for k in doc.get("gameCache", {}) if k.startswith("steam:")]
    have = {
        name[len("steam_"):-4]
        for name in os.listdir(base)
        if name.startswith("steam_") and name.endswith(".png") and name[6:-4].isdigit()
    }
    return [i for i in ids if i not in have]


def app_info(appid: str) -> dict | None:
    with urllib.request.urlopen(API.format(appid=appid), timeout=30) as response:
        payload = json.loads(response.read())
    entry = payload.get(appid) or {}
    return entry.get("data") if entry.get("success") else None


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def make_square(raw: bytes, size: int = 512) -> bytes:
    from PIL import Image, ImageFilter

    img = Image.open(io.BytesIO(raw)).convert("RGBA")
    # blurred backdrop so the wide header art can fill a square tile
    bg = img.resize((size, size), Image.LANCZOS).filter(ImageFilter.GaussianBlur(24))
    scale = size / img.width
    fg_h = max(1, int(img.height * scale))
    fg = img.resize((size, fg_h), Image.LANCZOS)
    canvas = bg.copy()
    canvas.paste(fg, (0, (size - fg_h) // 2), fg)
    out = io.BytesIO()
    canvas.convert("RGB").save(out, "PNG")
    return out.getvalue()


def main() -> int:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return 2
    if args[0] == "--all-missing":
        appids = missing_appids()
        print(f"missing art for: {', '.join(appids) or '(none)'}")
    else:
        appids = args

    base = art_dir()
    for appid in appids:
        try:
            data = app_info(appid)
            if not data:
                print(f"{appid}: no store data (not a store app?) - skipped")
                continue
            url = data.get("header_image") or data.get("capsule_image")
            if not url:
                print(f"{appid}: no image url - skipped")
                continue
            png = make_square(fetch(url))
            target = os.path.join(base, f"steam_{appid}.png")
            with open(target, "wb") as fh:
                fh.write(png)
            print(f"{appid}: {data.get('name')} -> {target} ({len(png):,} bytes)")
        except Exception as exc:  # noqa: BLE001 - diagnostic path
            print(f"{appid}: FAILED {exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
