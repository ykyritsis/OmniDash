# 0.27.0-beta.18

Built-in updates and a logo-only splash.

- **Updates are built in.** The launcher checks this project's GitHub releases in the background, a short while after it starts and then every six hours. A new build downloads quietly while you play, and it's checked against the release's SHA-256 checksum before anything is installed. A small card appears with **Restart to update**; if you ignore it, the update installs the next time you close the launcher. Settings → Experience has a **Check for updates** row.
- **Nothing is replaced while a game is running.** A game started from the launcher counts as running, so an update waits until it closes.
- **Both builds update.** The installer updates itself with a silent install and reopens. The portable .exe replaces its own file and restarts.
- **Logo-only splash.** The startup screen shows the Xbox mark with no text.

**One-time step:** builds before beta 18 don't have the updater, so download this version once from the Releases page. Every later update is automatic.

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.18.exe` (installer) and `Xbox-Preview-UI-Portable-0.27.0-beta.18.exe`, with checksums in `SHA256SUMS.txt`. The builds aren't code-signed, so Windows SmartScreen may warn on first run.
