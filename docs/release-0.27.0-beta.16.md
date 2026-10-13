# 0.27.0-beta.16

Lighter in the background while you play, instant game pages, and an accurate "Return to game".

- **Sleep mode while a game is in front.** About 1.5 seconds after the launcher loses focus, all animations and transitions pause, any playing trailer pauses and focus scrolling stops. The friends list, clock and install progress stop refreshing on their regular schedule (install progress drops to every 15 seconds), and refresh when you come back. In a measured idle run on a 1,400-game library, the window's CPU use dropped from 0.06% to 0% and its memory from 255 MB to 212 MB.
- **Game pages open ready,** as on a console or in Steam. Resting on a tile for a moment loads that game's details and warms its hero art and first gallery images, so the gallery appears in under 20 ms instead of 1–2 seconds. Details stay on disk for up to 1,500 games. A page seen in the last day opens from disk without touching the network; older copies refresh behind the page.
- **"Return to game" goes away when you close the game.** Steam games start through Steam, so the launcher used to keep offering them for 30 minutes. It now checks Steam's own running-game value.
- Trailers with no preview image show the game's first screenshot instead of an empty tile.

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.16.exe` (installer) and `Xbox-Preview-UI-Portable-0.27.0-beta.16.exe`, with checksums in `SHA256SUMS.txt`. The builds aren't code-signed, so Windows SmartScreen may warn on first run.
