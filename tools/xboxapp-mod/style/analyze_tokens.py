"""Inventory the style-ish string tokens inside the Xbox app's Hermes bundle.

Hermes stores literals in a string storage blob, so hex colours, rgba() values and
font family names can be read (and later replaced, byte-for-byte) directly from the
file. This script only reads.

Usage:
    python analyze_tokens.py [bundle] [--top N]
"""
from __future__ import annotations

import argparse
import collections
import os
import re

DEFAULT_BUNDLE = (
    r"C:\Program Files\WindowsApps\Microsoft.GamingApp_2610.1001.20.0_x64__8wekyb3d8bbwe"
    r"\Bundle\index.bundle"
)

HEX = re.compile(rb"#[0-9a-fA-F]{6}\b")
RGBA = re.compile(rb"rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}[^)]{0,24}\)")
FONT = re.compile(rb"(Segoe[ A-Za-z]*|Bahnschrift[ A-Za-z]*|Arial|Consolas|Tahoma|Verdana|Calibri)")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("bundle", nargs="?", default=DEFAULT_BUNDLE)
    ap.add_argument("--top", type=int, default=25)
    args = ap.parse_args()

    print(f"bundle: {args.bundle}")
    print(f"size  : {os.path.getsize(args.bundle):,} bytes")
    with open(args.bundle, "rb") as fh:
        data = fh.read()

    for name, pattern in (("hex colours", HEX), ("rgba()", RGBA), ("fonts", FONT)):
        hits = collections.Counter(m.group(0).decode("ascii", "replace") for m in pattern.finditer(data))
        print(f"\n=== {name}: {len(hits)} distinct, {sum(hits.values())} occurrences")
        for token, count in hits.most_common(args.top):
            print(f"  {count:>5}  {token}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
