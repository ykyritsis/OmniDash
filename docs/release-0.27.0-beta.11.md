# 0.27.0-beta.11

Fixed Steam Family connection completion. The launcher now reads the authenticated Steam account from the signed-in session cookie when Steam's account config endpoint omits its web API token. It closes the login window once authentication is confirmed and reports a clear error if Steam still withholds the Family access token.

Steam Family now saves its linked Steam account separately from the desktop client's detected account. Signing into a different Steam account no longer leaves the sign-in window waiting for an account change. Reconnecting refreshes that account's shared games; disconnect removes its saved Family library.

Windows x64 installer and portable build are in `dist/dashboard-027b11`.

## Unreleased source fixes

- Controller focus scrolls the gallery strip without moving the game page horizontally, including rapid direction changes.
- Artwork matching distinguishes sequel numbers, roman numerals, years and remasters. Older automatic matches for ambiguous titles are refreshed; failed refreshes remain eligible for retry.
- The Steam install picker shows one destination per drive and keeps a saved library preference on that drive.
- Installing opens Queue. Live Steam counters take priority over stale manifest counts; content-log estimates are marked with ≈. Completed and cancelled downloads leave local tracking correctly.
- The Play label scales with its button. Description and supported devices use separate panels, followed by More info, with readable typography at larger window sizes.

Validation: all 18 `scripts/*-test.cjs` scripts pass. `scripts/game-details-review.cjs` checks gallery navigation, responsive typography, queue navigation and completion in an isolated Electron demo at widths from 1024 to 2560 pixels. Live Steam download comparison still requires a running download; the review uses fixtures. Existing installers above predate these source fixes and need rebuilding.
