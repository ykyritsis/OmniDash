# 0.27.0-beta.17

Launching fixes.

- **Stay on the launch screen until the game is running.** Losing focus to Steam's launch window no longer counts as "started". Steam games now hand over only when Steam reports that the game is running. Other launchers need focus to stay away for four seconds, instead of one and a half.
- **Starting Steam when it's closed.** Launching a Steam game with Steam closed now starts Steam silently in the background (tray only, no window), waits until you're signed in, then starts the game. Before, the launch screen could wait on a Steam that never started.

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.17.exe` (installer) and `Xbox-Preview-UI-Portable-0.27.0-beta.17.exe`, with checksums in `SHA256SUMS.txt`. The builds aren't code-signed, so Windows SmartScreen may warn on first run.
