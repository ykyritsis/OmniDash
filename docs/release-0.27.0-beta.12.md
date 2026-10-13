# 0.27.0-beta.12

The full screen interface now follows the Xbox PC app's full screen mode, called "Garrison" here. Steam fills in what the Xbox app doesn't cover.

## Library and Queue

- **Remove from queue cancels the download.** If a game was never fully installed, Steam's own uninstall also deletes the partial files. A queued update only leaves the queue; the installed game stays.
- **Pause and resume** use the calls behind Steam's own Downloads page (`EnableAllDownloads`, `ResumeAppUpdate`), with the client ID Steam requires.
- **Queue page:** a back arrow beside the title, and B › Back in the controller hints.
- **Hidden games match Steam.** Hiding or unhiding a Steam game updates Steam's Hidden collection too, and games hidden in Steam are listed under Hidden. Hidden games only appear after you choose Filter › Show hidden games, as in Steam, and never appear in search.
- **Filter menu:** a flyout like the Xbox app's (Show, Launcher, Collection, Hidden games). The launcher chips are plain text: the selected one is bold white and the rest are grey.
- **Great with a controller** and **Play together** use Steam's store categories: Full controller support, and local and party play (shared/split screen, LAN, Remote Play Together). Steam's old multi-app `appdetails` lookup no longer returns data, so categories now come from `IStoreBrowseService/GetItems`.

## Store and game pages

- **Store search:** PC games from the Xbox Store with prices, plus Steam games Xbox doesn't sell (games only, with Steam's real covers).
- **Any game has a page.** Store results and friends' games open a full game page with the price. Buy opens Steam's store.
- **Play with friends:** View game opens the game's page, whether you own it or not.
- **Start-button menu** copied from the Xbox app: the title, then Play, Manage game and Uninstall. Favorites, Hide and artwork are in Manage game.
- Game pages keep the game's own hero art behind them, as the Xbox app does. The screenshot-shuffle settings and the tile corners setting are removed.
- Steam news cards use each post's own art, are labelled Patch notes or News, and put official posts first.

## Feel and fixes

- Controller scrolling follows the selection smoothly and keeps up with a held stick. The selected item is never left off screen.
- Publisher logos load reliably. Wikidata rate limits are retried and no longer cached as "no logo".
- A SteamGridDB key can be set in Settings › Manage games › Artwork, or from an optional tile during setup.
- Network errors show a plain message instead of "Error invoking remote method … fetch failed". SteamGridDB searches retry dropped connections.

Validation: every `scripts/*-test.cjs` script passes, and `scripts/garrison-review.cjs` reports no console errors. The new pages were checked in demo captures. Removing a real download from the queue wasn't tested, to avoid deleting the developer's queued games.
