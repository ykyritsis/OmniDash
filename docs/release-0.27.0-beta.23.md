# 0.27.0-beta.23

- Home game cards are 20% wider and taller in Jump back in and the other shelves. Installed-game rows show artwork and titles without the redundant Play footer.
- Friends come exclusively from Steam's verified friends list. Cached player names no longer appear as friends when that list is empty or unavailable. Steam account linking is required; account and credential changes invalidate the cache.
- Friends' activity is one horizontal shelf with the current game, Steam name and avatar, only for friends currently in a game. Presence refreshes every 20 seconds while the launcher is in front. The row disappears when nobody is playing.
- Updating uses a windowless Windows Script Host helper instead of an unbounded cmd/find loop. The launcher verifies that the helper started before closing, starts it once, and exits after four seconds if normal shutdown is blocked. File replacement has bounded retries and preserves a rollback copy.

If an older version is already stuck on a `find` terminal tab, close that updater tab and the launcher, then run this installer manually once. The old updater cannot repair itself before installing this build. Portable users can close the launcher and replace their old portable executable with this build.

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.23.exe` and `Xbox-Preview-UI-Portable-0.27.0-beta.23.exe`. Checksums are in `SHA256SUMS.txt`.
