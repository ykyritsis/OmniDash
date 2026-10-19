#!/usr/bin/env python3
"""Build the README screenshot set from the hidden theme-review captures.

Input : .visual-review/themes/<theme>-home.png and <theme>-page-personalization.png (3840x2160)
Output: docs/screenshots/hero.png, <theme>-home.png, <theme>-settings.png, themes.png

The review harness captures 4K frames with a 2x device scale factor. README images are 1280 px wide
and saved as 8-bit PNG, except the settings screens which are flat UI and compress better in truecolour.
The frames used here were taken after seeding the demo profile with the games' official Steam library
artwork (review-only), not with the stand-in painter, and with SCREEN_WAIT_MS=6000 so late cover repaints
have landed. Run from the repo root with the bundled Python (which has Pillow):

    python scripts/compose-readme-shots.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".visual-review" / "themes"
OUT = ROOT / "docs" / "screenshots"

# README order: PC look first, then the Xbox, PlayStation and Nintendo dashboards.
THEMES = [
    ("helix", "Helix"),
    ("series", "Xbox Series X|S"),
    ("one", "Xbox One 2013"),
    ("x360", "Xbox 360 Metro"),
    ("ps3", "PlayStation 3 XMB"),
    ("ps4", "PlayStation 4"),
    ("wii", "Wii"),
    ("3ds", "Nintendo 3DS"),
]
RETRO = ["x360", "ps3", "wii", "3ds"]

BG = (5, 7, 10)
GAP = 6
WIDTH = 1280
HEIGHT = 720


def load(theme: str, screen: str) -> Image.Image:
    path = SRC / f"{theme}-{screen}.png"
    if not path.exists():
        raise SystemExit(f"missing capture: {path}")
    image = Image.open(path).convert("RGB")
    if image.size != (3840, 2160):
        raise SystemExit(f"unexpected size for {path}: {image.size}")
    return image


def resize(image: Image.Image, width: int = WIDTH) -> Image.Image:
    height = round(width * image.height / image.width)
    return image.resize((width, height), Image.LANCZOS)


def save_png(image: Image.Image, path: Path, palette: bool) -> int:
    if palette:
        image = image.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.Dither.NONE)
    image.save(path, format="PNG", optimize=True)
    return path.stat().st_size


def tile(image: Image.Image, width: int) -> Image.Image:
    return image.resize((width, round(width * 9 / 16)), Image.LANCZOS)


def montage(cells: list[list[Image.Image]], cell_w: int, row_gap: int, col_gap: int) -> Image.Image:
    """Paste a rectangular grid of equally sized images onto a dark background."""
    cell_h = cells[0][0].height
    columns, rows = len(cells[0]), len(cells)
    width = columns * cell_w + (columns - 1) * col_gap
    height = rows * cell_h + (rows - 1) * row_gap
    canvas = Image.new("RGB", (width + 2, height + 2), BG)
    for row, images in enumerate(cells):
        for col, image in enumerate(images):
            canvas.paste(image, (1 + col * (cell_w + col_gap), 1 + row * (cell_h + row_gap)))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    written: list[tuple[str, int, tuple[int, int]]] = []

    def record(path: Path) -> None:
        with Image.open(path) as image:
            written.append((path.name, path.stat().st_size, image.size))

    # --- Per-theme dashboard and settings images ------------------------------------------------
    for theme, _label in THEMES:
        home = resize(load(theme, "home"))
        settings = resize(load(theme, "page-personalization"))

        # Dashboards are photographic: a 256-colour palette is the difference between ~1.5 MB
        # truecolour PNGs and ~0.3 MB ones, and it is what the README-size budget allows.
        home_path = OUT / f"{theme}-home.png"
        save_png(home, home_path, palette=True)
        record(home_path)

        # Settings are flat UI and benefit from exact colour: keep them truecolour while they fit.
        settings_path = OUT / f"{theme}-settings.png"
        size = save_png(settings, settings_path, palette=False)
        if size > 300_000:
            size = save_png(settings, settings_path, palette=True)
        record(settings_path)

    # --- Hero: the eight Home screens, two rows of four, no text --------------------------------
    cell_w = 395
    homes = [tile(load(theme, "home"), cell_w) for theme, _ in THEMES]
    hero = montage([homes[:4], homes[4:]], cell_w, row_gap=GAP, col_gap=GAP)
    hero_path = OUT / "hero.png"
    hero_size = save_png(hero, hero_path, palette=False)
    if hero_size > 1_500_000:
        hero_size = save_png(hero, hero_path, palette=True)
    record(hero_path)

    # --- Retro gallery: home over settings for the four retro consoles --------------------------
    strip = montage(
        [
            [tile(load(theme, "home"), cell_w) for theme in RETRO],
            [tile(load(theme, "page-personalization"), cell_w) for theme in RETRO],
        ],
        cell_w,
        row_gap=4,
        col_gap=GAP,
    )
    strip_path = OUT / "themes.png"
    save_png(strip, strip_path, palette=True)
    record(strip_path)

    print(f"{'file':38} {'size':>10}  dimensions")
    for name, size, dimensions in written:
        print(f"{name:38} {size / 1024:9.1f}K  {dimensions[0]}x{dimensions[1]}")
    total = sum(size for _name, size, _dimensions in written)
    print(f"\n{len(written)} files, {total / 1024 / 1024:.2f} MB total")
    if total > 6 * 1024 * 1024:
        raise SystemExit("over the 6 MB screenshot budget")


if __name__ == "__main__":
    main()
