# 0.27.0-beta.15

Library and Game Pass fixes.

- **The Library opens on Installed,** as in the Xbox app, whenever you press the Library button.
- **Scrolling back up the library works.** Moving up from the first row of games into the filter bar now scrolls the page back to the top. Before, focus moved into the filter, source chips and tabs while they stayed hidden under the header, and the next press jumped to the header.
- **Game Pass tiles show their titles and input icons,** like library tiles. Games that also run on Xbox consoles show controller plus mouse and keyboard; PC-only games show mouse and keyboard. This comes from the Xbox catalog's platform data, so the Game Pass list refreshes once to pick it up.

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.15.exe` (installer) and `Xbox-Preview-UI-Portable-0.27.0-beta.15.exe`, with checksums in `SHA256SUMS.txt`. The builds aren't code-signed, so Windows SmartScreen may warn on first run.
