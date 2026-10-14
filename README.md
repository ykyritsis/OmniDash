# Xbox Preview UI

**A controller-first launcher for every game on your PC, styled after the Xbox PC app's full screen mode.**

Xbox Preview UI brings a console-style home screen, a full-screen library and artwork-led game pages to the games you already have, from Steam, Epic, Xbox PC, and other launchers. Steam fills the gaps the Xbox app leaves: Steam's own downloads, hidden games, news and achievements all work from inside the launcher.

> **Development preview.** An unofficial, fan-made project. It is not affiliated with Microsoft, Sony, Valve, ASUS, or any game publisher. See [Legal and attribution](#legal-and-attribution).

<p align="center">
  <img src="docs/screenshots/console-home.png" alt="Home screen with a focused game and recently played row" width="92%">
</p>

## Download

Get the latest build from the **[Releases page](https://github.com/ykyritsis/xbox-cloud-preview-on-pc/releases)**.

| File | Use it for |
| --- | --- |
| `Xbox-Preview-UI-Setup-x.y.z.exe` | A normal installed copy with a Start menu entry and uninstaller. |
| `Xbox-Preview-UI-Portable-x.y.z.exe` | No installation. Replace the old file with the new one to update; your settings stay in Windows app data. |
| `SHA256SUMS.txt` | Checksums, so you can confirm the download wasn't altered. |

Builds are not code-signed yet, so Windows SmartScreen may warn on first run. Choose **More info → Run anyway** if you trust the source.

To run from source, install Node.js 20 or newer:

```powershell
npm install
npm start
```

## Features

### Home

- **Jump back in:** recently played games, with the last game you launched first.
- **Play together:** games in your library with local or party multiplayer.
- **Browse by publisher and series:** rows of covers you can scroll with a controller, with logos where they're available.
- **News for the selected game:** Steam news with its own art, labelled as patch notes or news, official posts first.
- Wide backdrops and a focused tile that enlarges as you move through the shelf.

### Library

- **Installed, Recently played, Queue and My games** tabs, like the Xbox app.
- **Filter** (install state, launcher, collection, and **Show hidden games**) and **Sort** (last played, alphabetical, source, Steam hours, size) menus that match the Xbox app.
- **Grid or list view**, with input icons on each tile: controller, keyboard and mouse, or both.
- Launcher chips for quick switching between Steam, Epic, Xbox PC and others.
- **Favorites** and custom collections.
- **Hidden games** follow Steam's own Hidden list. Hiding a Steam game hides it in Steam too. Hidden games stay out of search until you choose Show hidden games.
- The **Library button always opens Installed**, with no filters and at the top of the page.

### Game pages

- Screenshots, a trailer where one is available, description, rating, supported languages and controller support.
- **Play, Install** or **Buy** on the main button, with the Steam price for games you don't own.
- A **Manage game** panel for artwork, files, shortcuts, collections, Favorites, Hide and Uninstall.
- Launching shows a progress screen until the game is actually running, then returns you to the game page with **Return to game** available while it runs.
- Steam achievements (public catalog, with unlock progress when your Steam account is linked).

### Queue and downloads

- Steam's download queue, laid out like the Xbox app's Queue page.
- **Pause, resume, move to top,** and **Pause all / Resume all**, using Steam's own download controls.
- **Remove from queue cancels the download.** A game that never finished installing has its partial files removed too, through Steam's uninstall.
- Time left and speed for the current download, and a notification when a game finishes.

### Store

- **Xbox Store** browse lists (popular, new releases, free to play) with prices, ratings and trailers.
- **Search** the Xbox Store for PC games, with **More on Steam** results for games Xbox doesn't sell. Steam results show real covers and prices.
- **Game Pass** catalog, with titles and input icons.
- Any game can open a full page, owned or not.
- **Play with friends → View game** opens the game's page even if you don't own it.

### Controller and keyboard

- Full controller navigation with smooth, responsive scrolling. The selection and the page move together, so the item you're on is never left off screen.
- Works with mouse and keyboard too.
- The launcher goes to sleep when a game is in front: animations pause and nothing refreshes in the background, so it costs almost nothing while you play.

### Artwork and metadata

- Covers, backdrops and logos come from the Xbox Store, IGN, PlayStation and, optionally, SteamGridDB. You can replace any of them yourself.
- Artwork and game details are saved locally, so returning to a library you've already seen is quick and works offline.
- Game pages load their details and screenshots in the background as you move over a tile, so they open ready.

### Settings

- **Manage games** holds your launchers, the **Artwork** section for your SteamGridDB key, and library options.
- Interface scale, reduced motion and high-contrast focus.
- Optional interface sounds, with the option to load your own sound pack.
- Power menu with confirmed sleep, restart and shutdown.
- Built-in updates: the launcher checks in the background, downloads and verifies new builds, and installs them when you choose "Restart to update" or next close the launcher. Settings → Experience has a manual check.

### Steam and other launchers

- Finds installed Steam games, plus Epic, Xbox PC, Ubisoft Connect, EA, Battle.net, GOG and Amazon where they're installed locally.
- Steam sign-in and cart pages open in a separate, sandboxed in-app session.
- Steam Family shared games can be added to your library.
- A Steam profile with playtime and **PC Gamerscore**: a local score from verified Steam achievements.

## Setup

1. **Install or unpack** the build you downloaded.
2. **Choose a profile**, then connect your libraries. Optional connections are collapsed until you need them.
3. **Add a SteamGridDB key** (optional) in **Settings → Manage games → Artwork**. It fills in artwork for games other stores don't have. Get a free key at steamgriddb.com under Preferences → API.
4. **Steam downloads from the Queue:** to pause and resume, turn on Steam download controls once from the Queue page. The launcher then talks to Steam on this PC only (127.0.0.1).

Installed games, recorded Steam playtime and Steam's hidden-game list need no key. A **Steam Web API key** adds uninstalled Steam games, personal achievement progress and live friend presence. Add it in Settings with your Steam profile's game details visible to that key.

## Controller controls

| Input | Action |
| --- | --- |
| D-pad / left stick | Move focus |
| A | Open a game, or play from its page |
| B | Back. From the Library, return Home |
| X | Rescan library |
| Y | Search |
| Menu | Options for the focused game |
| View | My games & apps, or Home |
| Xbox button | Opens Windows Game Bar; the launcher doesn't handle it |

## Build from source

```powershell
npm run dist:portable
npm run dist
```

Both write to `dist/`. The installer doesn't change Windows' Full Screen Experience Home app or install a certificate. For the optional Xbox Mode home app, see [Xbox Mode setup](docs/xbox-mode.md).

## Limits of this preview

- Launcher discovery reads local manifests and installed-game folders. It isn't a sync with every store's account.
- Uninstalled Steam games, personal playtime and achievement progress depend on Steam's API and your profile's visibility.
- For a game that isn't on Steam, a matching Steam achievement list is shown for reference only; it doesn't show your unlocks.
- Artwork and metadata come from public endpoints that can rate-limit, change, or have no match. A missing cover shows the game's title until one is found, or you can choose one yourself.
- SteamDB offers no API and doesn't permit automated scraping, so it isn't used. Game Options lets you enter a Steam App ID to match a game by hand.
- Steam may show its own launch popups; the launcher asks Steam to start quietly but can't always suppress them.
- Epic uninstalled-game support needs a separately installed and signed-in Legendary helper. See [library connections](docs/library-connections.md) for setup and limits.

## Release notes

| Release | Highlights |
| --- | --- |
| [0.27.0-beta.16](docs/release-0.27.0-beta.16.md) | Sleep in the background, instant game pages, accurate Return to game. |
| [0.27.0-beta.15](docs/release-0.27.0-beta.15.md) | Library scrolling fix, Game Pass titles and input icons. |
| [0.27.0-beta.14](docs/release-0.27.0-beta.14.md) | Smoother movement, Library reset, crash-safe settings. |
| [0.27.0-beta.13](docs/release-0.27.0-beta.13.md) | Controller navigation fixes, Xbox-style Sort and app menus. |
| [0.27.0-beta.12](docs/release-0.27.0-beta.12.md) | Store search, pages for games you don't own, Steam-synced hidden games, Queue controls. |
| [0.27.0-beta.11](docs/release-0.27.0-beta.11.md) | Steam Family connection, PC Gamerscore. |

Older notes are in [docs/](docs).

## Legal and attribution

This is a purely fan-made, unofficial launcher. Xbox, Xbox Game Pass, Microsoft, PlayStation, Steam, SteamGridDB, ASUS, game names, logos, and artwork belong to their respective owners. Nothing here implies their sponsorship, approval, or affiliation. The app does not bundle games, grant licenses, bypass DRM, or provide content you do not own. Artwork, news, screenshots, achievements, and metadata remain subject to their source services' rights and terms.

Console layout reference: [DashX by saVantCZ](https://github.com/saVantCZ/DashX). DashX theme code and media are not bundled with this project. System icons use the Segoe MDL2 Assets font supplied by Windows. In Settings → General → Volume & audio, you can load a personal sound folder containing `navigation.wav` and `activation.wav`, with optional `back.wav` and `launch.wav`. Imported sounds stay in your local profile and are not included in builds or uploads.

The optional startup animation uses the Xbox mark with an original synthesized chime, not Microsoft's console sound recording. Interface sounds can be muted and the animation disabled in Settings → General → Volume & audio. Reduced motion is respected. Personal sound packs can include `startup.wav` alongside `navigation.wav` and `activation.wav`; those user-provided files are not distributed with the app.

Ubisoft, EA, Battle.net and Epic Games SVG symbols are from [Simple Icons](https://github.com/simple-icons/simple-icons), distributed under CC0. The brands themselves remain trademarks of their respective owners. The Steam Family service shape was checked against [Valve's client protocol definitions](https://github.com/SteamTracking/Protobufs/blob/master/steam/steammessages_familygroups.steamclient.proto) and [steam-family-library](https://github.com/salah153/steam-family-library).

**Branding caution:** [Microsoft's published app-branding guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks) restrict unlicensed use of its names and logos in app names, icons, and promotional material. This fan disclaimer does not grant permission. The project may need rebranding or asset changes if requested by a rights holder.
