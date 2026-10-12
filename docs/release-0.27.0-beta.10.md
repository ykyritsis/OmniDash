# 0.27.0-beta.10

Library setup now opens a service tile hub. Each service has one focused page with account actions, connection status, and a return to all libraries. Installed games stay automatic. Connection actions apply immediately; optional artwork keys in Library tools still use Save changes.

EA, Battle.net and Steam Family retain sign-in progress, cancellation and verified completion, with their owned sign-in windows closing when finished. Google Drive retains private Games-folder discovery, archive installation, update handling and offline launch records. A ZIP per game inside Games is the simplest layout; folders can add artwork. Google OAuth client setup is still required for this private development build.

PC Gamerscore uses verified personal Steam achievements. A full game shares 1,000 points, with rarer achievements receiving a larger share. Profile shows completion, level and per-game scores. The interactive calculator previews achievement allocations without awarding points. Earned totals are isolated by account and survive uninstalling games. Previous score records convert on successful full-catalog sync.

Validated with scoring and cache tests, publisher connection lifecycle tests, Steam Family tests, Drive discovery and safe install tests, and isolated Electron UI fixtures for connection status, calculator totals, controller modal focus and small-screen layout. Fixtures do not claim successful live sign-in to a user's account or physical controller testing.

Builds: Windows x64 installer and portable, in `dist/dashboard-027b10`.
