# 0.27.0-beta.21

Fixes for the Store and Settings.

- **Store pages load their screenshots and details.** Xbox Store games that aren't in Game Pass asked Microsoft's catalog for an empty product ID, so their pages stayed blank. Pages opened from search results also couldn't find the game they were opening.
- **Updates and Support & backup are in Settings → Account.** They were placed on a Settings page the current layout never shows.

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.21.exe` (installer) and `Xbox-Preview-UI-Portable-0.27.0-beta.21.exe`, with checksums in `SHA256SUMS.txt`. Beta 18 and later update themselves. The builds aren't code-signed, so Windows SmartScreen may warn on first run.
