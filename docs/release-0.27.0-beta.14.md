# 0.27.0-beta.14

Smoother controller movement, a Library button that resets, layout polish, and crash-safe settings.

- **Smoother scrolling that still keeps up.** Scrolling now uses a spring: it moves on the first frame, reaches halfway in about 70 ms and settles by about 300 ms, keeping its speed through quick presses. In beta 13, most of a single press's scroll was an instant jump (a safety step meant only for held directions), which made movement feel snappy.
- **Focus highlight eases in** (120 ms) instead of jumping between items.
- **The Library button always opens the Library fresh:** first tab, no filters, at the top. Back from a game page still returns you to the exact spot.
- **Top bar:** the notification bell sits closer to the Xbox pill, and Settings sits next to your profile picture.
- **Game page:** the title is 15% smaller, and the heart and "…" icons are larger in their buttons.
- **Settings can't be lost to a crash.** Saves now go to a temporary file that replaces the old one in one step, with the previous copy kept as `settings.json.bak`. Before, a save interrupted by a crash or shutdown could truncate the file. The app would then load defaults and the next save would erase your artwork choices, keys and hidden games.

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.14.exe` (installer) and `Xbox-Preview-UI-Portable-0.27.0-beta.14.exe`, with checksums in `SHA256SUMS.txt`. The builds aren't code-signed, so Windows SmartScreen may warn on first run.
