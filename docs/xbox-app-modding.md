# Modding the official Xbox app (metadata for non-Xbox games)

Findings from a first hands-on attempt on Windows 11 25H2 (build 26200.9711),
Xbox app `Microsoft.GamingApp 2610.1001.16.0`, Xbox Insider "External Delta".

Goal: see whether the official app can carry metadata for games it did not install
(Steam titles, etc.) without touching signed Microsoft binaries.

## Short answer

Yes, partially — and better than expected, because the app already integrates
third-party launchers. Its state lives in user-writable JSON and SQLite files under
`%LOCALAPPDATA%\Packages\Microsoft.GamingApp_8wekyb3d8bbwe\`, so no file in
`C:\Program Files\WindowsApps` needs to change (which would need elevation and break
the package signature anyway).

## What the app already does

- `My games` lists Steam titles with provider badge and install state.
- Home → `Jump back in` renders Steam titles **with artwork**.
- Feature flights on this account include `enablesteamprovider`, `enableepicprovider`,
  `enablegogprovider`, `enablebattlenetprovider`, `enable_ea_provider`,
  `enableubisoftprovider`, `enable_3p_in_owned`.
- The app lists Steam games with no Store mapping, so there is no page-level metadata
  (description, publisher, categories) for them.

## Local data surfaces (all user-writable)

| Path (under the package's `LocalState`/`LocalCache`) | Format | Role | Survives restart |
| --- | --- | --- | --- |
| `LocalState\AsyncCache.db` | SQLite, 1 table `AsyncCache(scope, scopeVersion, key, value)` | Xbox/Store catalog cache: `product_summary`, `collections`, `recently_viewed_products`, `achievements`, … | yes, unknown keys are kept |
| `LocalState\ThirdPartyLibraries\steam\steam.manifest` | JSON | Steam library cache (`gameCache` → `steam:<appid>`, `lastPlayedDate`, `addedDate`) | rewritten by app |
| `LocalState\ThirdPartyLibraries\steam\steam_<appid>.png` | PNG, app writes **182×184** | Per-game artwork used by Home tiles | yes (not regenerated) |
| `LocalState\CustomLibraryManagement\CustomLibraryManagement.manifest` | JSON | User-added games: `title`, `imagePath`, `installLocation`, `executableName`, `executableCommandArgs` | yes, app merges external entries |
| `LocalState\CustomLibraryManagement\Images\*.png` | PNG | Artwork for custom entries (512×512 used successfully) | yes |
| `LocalCache\ImageCache\ImageCache.db` + numeric files | SQLite + blobs | Newer hashed image cache (221 entries here) | yes |
| `LocalCache\AppConfig\cache_XboxPcApp_<xuid>.json` | JSON | Resolved experiment flights | rewritten by app |

## Experiments run

1. **Synthetic product metadata.** Inserted a `product_summary` row keyed
   `steam:3228590` (Deadzone: Rogue) with our own title, description, developer,
   categories, rating and four artwork URIs (Steam CDN capsules). The row persists
   across app restarts; the app does not purge unknown keys.
2. **Collection membership.** The same id was prepended to all 13 cached home
   collections, with `lastFetchedMS` pushed ten years into the future. The app
   refetched and **replaced** the collections anyway — membership is service-owned.
3. **Custom library entry.** Wrote a new GUID entry pointing at
   `...\Steam\steamapps\common\Deadzone Rogue\DeadzoneSteam.exe` with a 512×512
   PNG. The app rewrote the manifest on next launch **and kept the entry**,
   normalising the path. External entries are merged, not discarded.

## What this means for metadata

- **Artwork and title for existing Steam titles:** supported through
  `steam_<appid>.png` and the custom-library `imagePath`. Replace the PNG and the
  Home tile shows your art (the app itself writes 182×184; the ~60
  `*.png.pcc-original` backups here are evidence of earlier replacements).
- **Free-text metadata** (description, publisher, categories): only through
  `product_summary`, and only if the UI asks for that product id. Home tiles render
  from the provider model, not from `product_summary`, so this is not yet proven to
  surface. A game page opened for a `steam:` product would be the test.
- **Collection placement** (forcing a third-party game into a Store shelf) is not
  stable: the service refresh wins.
- **Service-level integration** would need intercepting
  `https://beige.xboxservices.com/pcgafd/...` (requests such as
  `pcgafd/actions/steam:42700` currently return 404), i.e. a local proxy plus a
  trusted certificate. Powerful, but heavyweight.

## Tools in this folder

- `probe_cache.py` – schema and sample rows of `AsyncCache.db`.
- `list_scopes.py` / `key_shape.py` – every cache scope, and which id spaces it uses.
- `dump_scope.py <scope> [key]` – pretty-print one cached value.
- `analyse_collections.py` – home collections and their product-id spaces.
- `inject_metadata.py [--apply|--restore]` – writes the synthetic `steam:` product
  summary (backs up the database first).
- `add_custom_entry.py [--apply|--restore]` – adds a custom-library entry with a
  512×512 capsule (backs up the manifest first).
- `verify_injection.py` – reports what survived the app's refresh.
- `capture-window.ps1 -ProcessId <pid> [-TitleLike XBOX]` – captures the app
  window without taking focus (the window may be hosted by `ApplicationFrameHost`).

## Working file-only recipe (verified)

Custom (imported) games can be added and given a title plus artwork with no UI and
no administrator rights. Two files matter, and both live in the package's
`LocalState`:

| File | Purpose |
| --- | --- |
| `ThirdPartyLibraries\CustomLibraryManagement\CustomLibraryManagement.manifest` | the live store of custom games (the sibling `LocalState\CustomLibraryManagement\` folder only holds images) |
| `CustomLibraryManagement\Images\<name>.png` | artwork referenced by `imagePath`; the app reads the file at render time, so swapping it is enough to change a tile |

Entry shape the app itself writes:

```json
"{97b61799-12b9-4fa4-b35a-714aa7650fa7}": {
  "id": "{97b61799-12b9-4fa4-b35a-714aa7650fa7}",
  "addedDate": "1792216340928",
  "imagePath": "ms-appx:///Assets/CustomLibraryFallback.png",
  "title": "Deadzone Rogue",
  "installLocation": "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Deadzone Rogue\\",
  "executableName": "DeadzoneSteam.exe",
  "executableCommandArgs": ""
}
```

Three details decide whether it works:

1. **The id is a braced GUID** (`{...}`). A bare GUID is accepted into the file but
   never listed.
2. **Every Xbox process must be closed while writing.** `XboxPcTray.exe`,
   `XboxPcAppFT.exe` and `XboxGameBarWidgets.exe` keep the entries in memory and
   rewrite the manifest at the next start, silently reverting edits. `XboxPcAppFT`
   restarts on demand, so the kill has to be repeated until none remain.
3. **`imagePath` must point at a real file.** `ms-appx:///Assets/CustomLibraryFallback.png`
   is the app's placeholder; anything else is loaded as-is.

Verified end state: the library lists `Deadzone: Rogue` with our square Steam capsule
art next to the untouched `Deadzone: Rogue / Steam` provider tile
(`library-custom-entry.png`). A second game (`Yoku's Island Express`) was added purely
by writing files, with no UI at all (`library-file-only-add.png`), then removed again.

Reproduce with:

```powershell
# add or update by file only (stops the app, writes the manifest and the art)
python tools/xboxapp-mod/custom_library.py add --exe "C:\...\Deadzone Rogue\DeadzoneSteam.exe" `
    --title "Deadzone: Rogue" --art "C:\...\steam_3228590.png" --apply --kill

# change only the artwork of an existing entry
python tools/xboxapp-mod/custom_library.py set-art --exe-name DeadzoneSteam.exe --art <png|url> --apply --kill

python tools/xboxapp-mod/custom_library.py list
python tools/xboxapp-mod/custom_library.py remove --exe-name DeadzoneSteam.exe --apply --kill
```

Limits of this surface: a custom entry carries `title`, `imagePath`, `installLocation`,
`executableName` and `executableCommandArgs` only. There is no description, publisher,
category or rating field, and the app's product page for `steam:<appid>` still needs the
`pcgafd` responses described above. The tile label of the *provider* Steam entry cannot
be changed this way (it comes from Steam's manifest), which is why the custom entry is
the lever.

The app auto-updated from `2610.1001.16.0` to `2610.1001.20.0` mid-session and this
recipe kept working, but treat the format as version-specific.

## Route B implemented: retheming the app by patching its token bundle

Goal: keep Microsoft's own JavaScript (every screen, every feature intact) and change
how it looks. The palette turned out to live in plain string literals inside the
Hermes bundle, so this is a byte-level patch, not a rebuild.

### What is patchable

The JS defines its design tokens as object literals, for example:

```js
'containerSolidAppBackground': '#1a1b1eff'
'containerSolidContainer':     '#101114ff'
'containerSolidContainerLight':'#24262aff'
'backplateSolidAccentRest':    '#008746ff'
'contentAccent':               '#008746ff'
'productXboxGreen':            '#107c10ff'
'contentSecondary':            '#ffffffa6'
'FluentBackground':            '#1A1B1E'   // 6-digit variants exist too
```

Measured inventory of the bundle: 141 distinct hex literals, 86 `rgba()` values,
and named palettes (`PrimaryAppColor`, `FluentBackground`, `CustomGreen5/6`,
`CustomBlue9/10`, `userAccent`, `controllerAbxy`). Native default-component colours
come from `PlatformColor(...)` (XAML theme resources) and are not touched by this.

### Two hard requirements

1. **Equal byte length.** Hermes addresses strings by offset in a shared storage
   blob, so `#008746ff` may become `#107c10ff` but never a longer or shorter string.
   `patch_style.py` refuses mismatched pairs.
2. **Repair the SHA-1 trailer.** The file ends with a SHA-1 of all preceding bytes.
   After patching it must be recomputed or the bundle fails to parse/load.

### Pipeline

```
palette.json                     # grouped old->new hex pairs (equal length)
  -> patch_style.py --write      # writes %LOCALAPPDATA%\XboxMod\index.patched.bundle
                                 # + index.patched.info.json (sha256 manifest)
  -> install-bundle.ps1          # elevated: backup, swap, restore TrustedInstaller ACL
     install-bundle.ps1 -Restore # put the original bundle back
```

The installer verifies that the installed bundle's SHA-256 matches the one the patch
was built from, so a Store update cannot silently produce a broken mix; rebuild with
`patch_style.py --write` after an update.

First palette ("deeper + Xbox green"): 47 replacements across three groups.

| Group | Effect |
| --- | --- |
| `accent` | moves the app's teal-green accent (`#008746`) to Xbox green (`#107C10`), with matching hover/focus/press/disabled steps |
| `surfaces` | app background and containers go near-black (`#0b0b0d`, `#050506`), panels to `#17191d`, secondary/primary solids raised for contrast |
| `content` | secondary text and dividers get a little more presence (`#ffffffa6` → `#ffffffb8`, dividers `1f` → `26`) |

### What this route cannot do

- No layout change: rows, tile sizes, spacing and radii are numeric constants, not
  strings. Changing them means patching doubles in the constant pool (possible, but
  broad-brush: every `4` is the same constant) or replacing the bundle outright.
- No font-family switch worth doing: the only literals are `SegoeUI`/`Segoe UI`,
  which are already what a console UI would use.
- Native XAML pieces (title bar, splash, some dialogs) keep their own theme.
- Store updates overwrite the patched bundle; the installer detects the drift and
  refuses until the patch is rebuilt.

## Route A demo: replacing the app's UI bundle (implemented)

The app's whole interface is one file: `Bundle\index.bundle`, Hermes bytecode **v96**,
built from React Native Windows **0.76.5**. `react-native@0.76.5` ships a hermesc that
emits exactly v96, so a bytecode-compatible replacement UI is buildable.

Demo project: `tools/xboxapp-mod/bundle-demo` (source) with the working copy in
`%LOCALAPPDATA%\XboxMod\bundle-demo` (outside this repo, because the repo's
`pnpm-workspace.yaml` would otherwise swallow `pnpm install`).

Pipeline (`build.ps1`):

```
index.js  --metro (platform windows, release)-->  910 KB js bundle
          --hermesc 0.76.5 (win64)--> 1.37 MB HBC, version 96, SHA-1 trailer valid
          --> %LOCALAPPDATA%\XboxMod\index.demo.bundle (+ info.json)
```

Install (elevated, one command):

```powershell
# what is installed right now (no admin needed)
powershell -ExecutionPolicy Bypass -File tools\xboxapp-mod\style\install-bundle.ps1 -Status

# install the demo bundle
powershell -ExecutionPolicy Bypass -File tools\xboxapp-mod\style\install-bundle.ps1 `
    -Bundle "$env:LOCALAPPDATA\XboxMod\index.demo.bundle"

# revert to the newest backup
powershell -ExecutionPolicy Bypass -File tools\xboxapp-mod\style\install-bundle.ps1 -Restore
```

The script relaunches itself elevated, logs every step to
`%LOCALAPPDATA%\XboxMod\install.log`, keeps its window open at the end, and reports
"nothing to restore" instead of failing silently when no backup exists.

The demo registers the same component under 15 candidate names (`App`, `XboxPcApp`,
`Microsoft.Xbox.App`, `Microsoft.Xbox.AppL`, `Microsoft.GamingApp`, `GarrisonApp`, …)
because the name the native host launches is compiled into `XboxPcApp.exe` and is not
known yet. Reading the result tells us which way to go:

| What appears | Meaning |
| --- | --- |
| Dark "XBOX APP MOD / Custom bundle running" card | route A is proven; start the dashboard |
| Blank window | bundle loaded, host launched a name we did not register |
| Normal app UI | bundle not loaded (path/permission/restore issue) |
| Crash | host rejected the bundle; revert, then read the app log |

## Risks and undo

- Everything is reversible: each write is preceded by a `.bak-<timestamp>` copy in
  the same folder, and `--restore` puts the newest backup back.
- The app owns `steam.manifest`, the collections and the flight config; expect those
  to be rewritten.
- Nothing in `C:\Program Files\WindowsApps` was modified, no signature check was
  bypassed, and no elevation was used.
- Xbox updates may migrate caches (the new `ImageCache.db` is such a migration), so
  treat any file format here as version-specific.

## Second session: attempting a full product page for a Steam import

Target: give `steam:3228590` (Deadzone: Rogue) a real product page with our metadata.

### What the app actually asks for

Navigating `msxbox://game/?productId=steam:3228590` (the same route that renders a
normal Store page) produced the "We were unable to load the content" card
(`product-page-error.png`) and recorded these requests in `http_error_counts`:

```
https://beige.xboxservices.com/pcgafd/productdetailspage/3228590?market=AU&...&productKind=Game
https://beige.xboxservices.com/pcgafd/productdetailspage/3228590/tabs/detailsTabLayout?market=AU&...
https://beige.xboxservices.com/pcgafd/actions/steam:3228590?...&productKind=Game
```

All three 404 because Microsoft has no catalog entry for the game. The page is
rendered from those live responses, not from `AsyncCache`.

### Negative results (useful)

- A `product_summary` row keyed `steam:3228590` **persists** across restarts but does
  not change the library tile label: injecting the title `Deadzone: Rogue (LOCAL)`
  left the tile reading `Deadzone: Rogue` (`Steam`), because tile text comes from the
  provider model.
- The product page ignores that row entirely and fails on the network call.
- Deleting the synthetic row and the custom entry proved the app follows the files:
  after a restart neither came back.

### Positive results

- Library artwork works: `My games` renders every Steam title with its
  `ThirdPartyLibraries\steam\steam_<appid>.png` (`my-games-artwork.png`). The blank
  grid seen earlier was slow image loading, not a missing feature.
- The app ships an official custom-game flow: `Add a game to your library`
  (`add-a-game-dialog.png`, via `[Button] Add a game to your library` in UI
  Automation). It lists Start-menu-discoverable executables, has a `Browse` picker
  for anything else, and adds the entry with `title` / `imagePath` /
  `installLocation` / `executableName`. Entries support a per-game image, and the
  library offers `Edit in library` for the title.
- A manifest entry written by hand is accepted into the file on the app's next
  write, but does not appear in `My games`; the app's own add flow registers
  something extra the tile list depends on. (Superseded: the real cause was editing
  the stale `LocalState\CustomLibraryManagement\` copy while the tray process was
  running. See the working recipe below.)

### What a real implementation needs

To make `steam:<appid>` a first-class product in the official app, the two `pcgafd`
responses have to succeed. That means intercepting HTTPS for
`beige.xboxservices.com`, which needs a hosts entry plus a trusted root certificate
(both administrator actions), or a same-user process hook. Until then the app can
only show provider-level data: title, launcher, install state and artwork.

Untested idea worth a try before that: enable the app's offline mode (flight
`enableofflinemode`, UI `Toggle app offline mode`) and open the game page; if the
page falls back to cached `product_summary`, the injection becomes visible without
any network interception.

### Verification tooling added

- `probe_network.py` – the recorded backend URLs and their error states.
- `probe_altids.py` – how title ids / package family names map to product ids.
- `uia-dump.ps1` – dump the app's UI Automation tree, optionally invoke a button.
- `uia-combo.ps1` – expand a filter combo box and list its options.
- `uia-addgame.ps1` / `uia-picker.ps1` – drive the `Add a game` dialog and file
  picker.
- `cleanup_poc.py` – remove the synthetic product row, custom entry and card image.

