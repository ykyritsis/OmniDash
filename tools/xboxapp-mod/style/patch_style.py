"""Patch the Xbox app's Hermes bundle to retheme its design tokens.

Route B of the modding plan: keep Microsoft's own JavaScript, rewrite only colour
literals stored in the Hermes string table. Because Hermes addresses strings by
offset, every replacement must have exactly the same byte length as the original.

Usage:
    python patch_style.py                     # dry run, reports each mapping
    python patch_style.py --write             # writes the patched bundle
    python patch_style.py --bundle <path> --out <path> --palette <json>

The patched bundle is written to %LOCALAPPDATA%\\XboxMod\\index.patched.bundle by
default; install it with install-bundle.ps1 (elevated).
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PALETTE = os.path.join(HERE, "palette.json")
HERMES_MAGIC = bytes.fromhex("c61fbc03")


def current_bundle() -> str:
    """Resolve the installed bundle path (WindowsApps itself is not enumerable)."""
    import subprocess

    cmd = [
        "powershell",
        "-NoProfile",
        "-Command",
        "(Get-AppxPackage Microsoft.GamingApp).InstallLocation",
    ]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout.strip().splitlines()
    for line in out:
        candidate = os.path.join(line.strip(), "Bundle", "index.bundle")
        if os.path.exists(candidate):
            return candidate
    try:
        from winreg import HKEY_LOCAL_MACHINE, OpenKey, QueryValueEx

        with OpenKey(
            HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Windows\CurrentVersion\Appx\AppxAllUserStore\Applications",
        ):
            pass
    except Exception:
        pass
    raise SystemExit("Xbox app bundle not found; pass --bundle explicitly")


def default_out() -> str:
    base = os.path.join(os.environ.get("LOCALAPPDATA", "."), "XboxMod")
    return os.path.join(base, "index.patched.bundle")


def load_mapping(path: str) -> list[tuple[str, str, str]]:
    with open(path, "r", encoding="utf-8") as fh:
        doc = json.load(fh)
    pairs: list[tuple[str, str, str]] = []
    for group, entries in doc.items():
        if group.startswith("_") or not isinstance(entries, dict):
            continue
        for old, new in entries.items():
            if len(old.encode()) != len(new.encode()):
                raise SystemExit(
                    f"length mismatch in group '{group}': {old!r} ({len(old)}) vs {new!r} ({len(new)})"
                )
            pairs.append((group, old, new))
    return pairs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle", default="", help="source index.bundle")
    ap.add_argument("--out", default="", help="output path")
    ap.add_argument("--palette", default=DEFAULT_PALETTE)
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    source = args.bundle or current_bundle()
    out = args.out or default_out()
    print(f"source : {source}")
    print(f"palette: {args.palette}")
    print(f"output : {out}")

    with open(source, "rb") as fh:
        data = fh.read()
    if data[:4] != HERMES_MAGIC:
        raise SystemExit("not a Hermes bytecode bundle (magic mismatch)")
    print(f"hermes bytecode version: {int.from_bytes(data[8:12], 'little')}")

    pairs = load_mapping(args.palette)
    patched = bytearray(data)
    total = 0
    groups: dict[str, int] = {}
    for group, old, new in pairs:
        needle = old.encode("ascii")
        replacement = new.encode("ascii")
        count = patched.count(needle)
        if count:
            patched = patched.replace(needle, replacement)
            total += count
            groups[group] = groups.get(group, 0) + count
            print(f"  [{group:<8}] {old} -> {new}  ({count} occurrences)")
        else:
            print(f"  [{group:<8}] {old} -> {new}  (not present)")

    print(f"\nreplacements: {total}  by group: {groups}")
    if total == 0:
        print("nothing to do")
        return 0
    if len(patched) != len(data):
        raise SystemExit("internal error: bundle length changed")

    # Hermes appends a SHA-1 of the bytecode (all bytes but the last 20). The
    # runtime and the tooling both expect it to match, so recompute the trailer.
    import hashlib

    trailer = 20
    original_trailer = data[-trailer:]
    expected = hashlib.sha1(data[:-trailer]).digest()
    print(f"\noriginal trailer matches sha1(body): {original_trailer == expected}")
    patched[-trailer:] = hashlib.sha1(bytes(patched[:-trailer])).digest()
    print(f"recomputed trailer: {patched[-trailer:].hex()}")

    if not args.write:
        print("\ndry run; re-run with --write to produce the patched bundle")
        return 0

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "wb") as fh:
        fh.write(patched)
    print(f"\nwritten: {out} ({os.path.getsize(out):,} bytes)")

    import hashlib

    info = {
        "source": source,
        "output": out,
        "source_sha256": hashlib.sha256(data).hexdigest(),
        "output_sha256": hashlib.sha256(patched).hexdigest(),
        "source_bytes": len(data),
        "replacements": total,
        "groups": groups,
        "palette": os.path.basename(args.palette),
    }
    info_path = os.path.splitext(out)[0] + ".info.json"
    with open(info_path, "w", encoding="utf-8") as fh:
        json.dump(info, fh, indent=2)
    print(f"manifest: {info_path}")
    print(f"source sha256: {info['source_sha256']}")
    print("install with:  powershell -ExecutionPolicy Bypass -File install-bundle.ps1")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
