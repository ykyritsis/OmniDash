# 0.27.0-beta.13

This release fixes controller navigation and finishes the Xbox-style menus.

- **Navigation is responsive again.** Beta 12's new scrolling clashed with the stylesheet's built-in smooth scrolling: every frame started a separate browser animation, so the page crawled and focus got stuck. Scrolling now runs entirely in the launcher, stops as soon as you use the wheel or touch, and each page starts fresh. Every press now responds in under 10 ms on a 1,400-game library.
- **Game pages open at the top.** Down and Up move one section at a time. Up only reaches the top bar from the top of the page, instead of jumping there from halfway down.
- **Queue navigation works in rows,** as in the Xbox app. Left and right move between a download and its pause and "…" buttons; up and down move between downloads, keeping the same button.
- **Sort** is now an Xbox-style flyout instead of the Windows dropdown.
- **Apps** use the same Start-button menu as games (Open, Hide app).

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.13.exe` (installer) and `Xbox-Preview-UI-Portable-0.27.0-beta.13.exe`. Checksums are in `SHA256SUMS.txt`. The builds aren't code-signed, so Windows SmartScreen may warn on first run.

See [beta 12](release-0.27.0-beta.12.md) for the Store search, Steam-synced hidden games, Queue controls and the rest of the Xbox full screen mode work.
