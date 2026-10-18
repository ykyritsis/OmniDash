# Handover: console themes (0.6.0 work in progress)

> **2026-10-18, Claude: the work queue is now `docs/NEXT-LEVEL-PLAN.md`** (parity review, settings registry,
> per-console specs, rename and GitHub relaunch, ordered prompts). Start with its Phase 1 (real settings).
> Correction to the art rule below: **PS3 game icons are wide ICON0 (320:176)**, not square slots.

> **2026-10-18 handover to Claude — read this first.** Branch `console-themes`, HEAD `6525c36`.
> The installed copy at `%LOCALAPPDATA%\Programs\Xbox Preview UI` is current (`backup-0.6.0-test22` is the
> previous build). Install with
> `node_modules\electron\dist\electron.exe scripts\install-test-build.cjs` (needs `ELECTRON_RUN_AS_NODE=1` in
> the shell); it refuses while `Xbox Preview UI.exe` runs.
>
> State: seven of the eight themes have had a console-accuracy pass. **Helix is intentionally untouched** (the
> owner wants it to stay the modern PC look). **The Wii pass is unfinished** — its motion and channel details
> were started and committed mid-way; treat the Wii section of `garrison-theme-retro.js/.css` as in progress.
>
> Done recently: 3DS rebuilt as a single full-bleed iiSU-style screen; per-console Settings option blocks
> (84 blocks / 297 decorative rows in `garrison-theme-settings.js` plus the "Console options" section of
> `garrison-theme-screens.css`) and per-console Settings shells; PS3 XMB scaled up (128x90 categories, 104
> item icons, 48px titles, 560x78 clock); PS4 rebuilt to the reference measurements with the backdrop
> crossfade and content-card fixes; Series wide tiles + four-card shelf; One pins wall on screen + focus
> frames; 360 band centred (294/597/294); play time on every dashboard; 16:9 fit for non-16:9 screens; type
> scaling to 4K via `calc(N * var(--g-vp) / 1728)` (never multiply px by a length-valued custom property —
> that is what broke the Home gutter); `page-<id>` review screens for any Settings page.
>
> Next, in order: finish Wii (motion and the bar/clock against `wii/ref/menu.png`); make the PS3 option band
> run edge to edge; check the Xbox settings blocks on pages other than Appearance; PS3's item column clipping
> its last entry; then a full 720p/1080p/4K sweep of all eight themes and a fresh set of review captures.

Status as of 2026-10-17 (evening). This covers the console theme system added on top of the 0.5.1 launcher.
The work is on branch `console-themes`. It hasn't been released yet.

## Git

- Use the work git dir: `git --git-dir=.git-work --work-tree=.`. Remote `origin` is github.com/ykyritsis/xbox-cloud-preview-on-pc.
- The plain `.git` folder is an empty repo, and `.public-git` is old. Ignore both.
- These files are deliberately **not** committed:
  - `docs/xbox-app-mod/`: screenshots of the official Xbox app.
  - `docs/xbox-app-modding.md`.

## Running and testing without Node

- There's no Node on PATH. Run plain node scripts with `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe <script>`,
  and the Electron apps below **without** that variable. DSH shells set `ELECTRON_RUN_AS_NODE=1` by default, so
  `Remove-Item Env:ELECTRON_RUN_AS_NODE` first, or the review runs as Node and dies on `app.on`.
- Review screenshots run in hidden demo windows. Output goes to `.visual-review/themes/<theme>-<screen>.png`.
  - Command: `THEMES=ps3,ps4 SCREENS=home,library node_modules/electron/dist/electron.exe scripts/theme-review.cjs`
  - Screens: home, library, detail, settings, apps, appearance, boot, toast, saver, options, store, launch, halo, onboarding, keyboard, and `hub-<id>`. Controller steps (`navR`, `navL`, `navU`, `navD`, `press`, `back`) chain from `home` in the same list.
  - `switchps3`, `switchwii` and `switchback` pick a theme in Settings → Appearance and then close it (the last one with the controller's Back), which is the path that used to leave the focus behind. `probe` logs view/theme/selection to `errors.json`. `manygames` inflates the demo library so paging, grid scrolling and long XMB columns can be seen.
  - `REVIEW_SIZE=1706,960` matches the owner's display (2560×1440 at 150% DPI, so the page lays out at 1706×960). The default 1920×1080 gives 2880×1620 PNGs.
  - The script waits for the demo import (`state.libraryInitialShown`) before painting its stand-in artwork, and paints it again for every theme, because the demo library can replace the game list part-way through.
  - The process often stays alive after the last capture. Check the newest PNG, then kill only processes whose path
    matches `*xbox mode 2*node_modules*`.
  - If a run is killed or crashes, the demo profile counts a failed start and later runs come up in **safe mode**
    (prefetch and update checks off; art can come out blank). Reset it before capturing:
    `Set-Content .visual-review/themes/profile/startup-state.json '{"failedStarts":0,"pending":false}'`.
- `scripts/theme-eval.cjs` evaluates `EXPR_FILE` in the same demo window and writes `.visual-review/theme-eval.txt`.
  - `EVAL_SIZE=1920,1080` matches the review window. `DEMO_ART=1` paints the same stand-in artwork the captures use.
  - Handy for checking computed sizes and timings: the expression can read `getComputedStyle`, `getBoundingClientRect`,
    `state` and `performance.now()`. It must return a value (a promise is awaited).
- `scripts/launch-hang-check.cjs` checks for a freeze after a game launches.
- **The owner games on this PC.** Never open visible or focus-taking windows and never play sound.
  - Never touch the installed app while `Xbox Preview UI.exe` is running.
  - Only kill processes whose path matches `*xbox mode 2*node_modules*`.

## Installing a test build into the owner's copy

**The owner wants the latest working tree installed every time, so this is part of finishing a change, not an
optional extra.** Run the script (it does the whole procedure, including the backup and the unpacked bridge):

```
cd "C:\Users\ykyri\OneDrive\Documents\ChatGPT\xbox mode 2"
node_modules\electron\dist\electron.exe scripts\install-test-build.cjs
```

- It refuses while `Xbox Preview UI.exe` is running, so ask the owner to close it (or wait) instead of forcing it.
- It copies the current `resources\app.asar` and `app.asar.unpacked` to `resources\backup-<version>-test<N>` first
  and picks the next number itself.
- It extracts the installed asar, overlays this repo's `src/` and `build/` icons, keeps the stripped packaged
  `package.json` (so the version stays the release version), repacks with `src/xbox-mode-bridge` unpacked, and
  copies the result back.
- `@electron/asar` is resolved from `node_modules/.pnpm/@electron+asar@*`; the bridge files must stay in
  `app.asar.unpacked` because the home-app helper is launched by path.

To check an install, extract the asar and look for the change, or start the app hidden in demo mode:
`NEBULA_DEMO=1 NEBULA_REVIEW=1 NEBULA_DEMO_USER_DATA=<temp> "…\Xbox Preview UI.exe"` (shells here set
`ELECTRON_RUN_AS_NODE=1`, which starts Electron as node and exits at once — remove it first). Kill the whole tree
when done: `taskkill /IM "Xbox Preview UI.exe" /T /F`.

The latest backup is `backup-0.6.0-test25` (it holds the build installed before the S3 settings shells, 2026-10-18 11:46; test24 held the PS3 S2 build).

## Theme system

- `body[data-g-theme]` is one of `helix | series | one | x360 | ps3 | ps4 | wii | 3ds`. `body[data-g-console]` is set for every theme except Helix.
- `body.home-active` marks the Home view, and every console dashboard's visibility (and the Series backdrop) is
  keyed on it. `showView()` is what sets it, but the app opens on Home *before* any `showView()` call, so `app.js`
  adds the class at start-up and the retro renderer keeps it in step. Without that the first frame shows the
  launcher's own Home with the console's background and chrome hidden — a stuck, half-drawn screen.
- The setting is pref `theme`:
  - It's whitelisted in `PREF_KEYS` in `src/main.cjs`.
  - It's mirrored to `localStorage['g-theme']`.
  - It's backed up via `src/support.cjs`.
- Sizes use console pixels: `--cpx = 100vh/1080` (scaled by `--g-scale`). Write `calc(N * var(--cpx))` with N measured at 1080p.
  - The 3DS adds `--k = 2.48 * --cpx`: its screens are 400×240 and 320×240 native, so everything inside them is
    written in native pixels times `--k`.
- Art rule: wide art goes only in wide slots and square covers only in square slots.
  - Wide slots carry `data-g-wide-art="<gameId>"`. `garrison-theme-art.js` (`window.gWideArt`) resolves verified wide art with ratio ≥1.5 and width ≥900. The Steam `library_hero` image is tried first.
  - If no wide art is found, the slot falls back to the cover on a blurred background.
  - The XMB item icons and the 3DS grid icons are **square slots**: they use `--cover`, never `data-g-wide-art`.
- Garrison scripts are wrapped by later scripts that reassign globals: `renderRecentGames`, `showView`, `navigateConsoleHome`, `navigateBack`, `openNativeKeyboard`, `launchSelectedGame`, `showToast`, `gIcon`, `interfaceAudio.play`, `window.gPageScroll`.
- Script order at the end of `index.html` matters: themes, library, motion, home, life, live, store, 360, backgrounds, hubs, art, extras, keyboard, settings, retro.

**Settings registry (2026-10-18, task S1).** `src/renderer/garrison-settings-registry.js` loads after `garrison-prefs.js` and exposes `window.gSettings`: 50 entries (`slider`, `toggle`, `choice`, `action`, `info`) wrapping only real capabilities — quick:get/set for volume, mute, brightness and power plan; the Settings form inputs plus `saveSettingsForm` for personalisation; `setPref` for saved prefs; and the launcher's existing buttons for updates, backup, reset, profile and account setup. Each entry has `get`/`set`/`available`, per-console wording through `label(id, console)`, and `gSettings.layouts` names each console's pages and row order by registry id; `set()` fires `g-setting-change` on `document`, and `formatClock`/`formatDate` are shared by the console clocks. The S2–S5 shells must render rows from `gSettings.layout(console)`, `options(id)` and `label(id, console)` and skip any row whose `available()` is false — no hand-written settings rows. New prefs live in `SETTINGS_DEFAULTS` and `PREF_KEYS` in `src/main.cjs`; menu music (A1) and the 3DS screen layout (D1) report `available() === false` until their consumers land. `scripts/settings-registry-test.cjs` checks the entries and layouts in plain node.

**PS3 settings in the XMB (2026-10-18, task S2).** The Settings column lists `gSettings.layout('ps3')`: one item per page (Display, Sound, Theme, Date and Time, System, Accessory, Network, Notification, Game, Account, then Advanced (launcher)), all rendered from the registry. Choosing a page slides the column left 280px (the XMB's own `.34s cubic-bezier(.22,1,.36,1)`) and opens the page's rows in a translucent right-hand panel; rows whose `available()` is false are skipped, so menu music is absent until A1 and a desktop loses brightness. Choosing a row opens the XMB option pop-up: `gSettings.options(id)` for a choice, On/Off for a toggle, the PS3 horizontal bar for a slider (left/right adjust, ✕ sets, ○ cancels), and `gSettings.set()` runs actions at once; info rows show the read-only value. ✕/○ follow the Enter Button pref. Everything refreshes on `g-setting-change` and `g-settings-ready`; `html.reduce-motion` keeps the layout but drops the slide. Form-backed rows first call `ps3SyncLauncherForm()` so `saveSettingsForm` cannot save its unopened defaults over real accounts, region or display settings. Advanced (launcher) closes the sub-list and opens the launcher's own Settings dialog; its decorative PS3 block is hidden on this theme (S5 deletes it). To review it: five `navL` steps reach the Settings column, then `press` opens a page and `navD`/`press` opens rows and the pop-up.

**PS4 settings (2026-10-18, task S3).** The Settings function opens a full-screen registry screen instead of the launcher dialog: `gSettings.layout('ps4')` pages as a category list with icons and a blue focus bar, the layout's last page (Advanced (launcher)) at the bottom of the list. Choosing a page slides the list left and brings its rows in from the right; rows skip `available() === false` (menu music is absent until A1, brightness on a desktop). Toggles are check boxes that change in place, choices open the PS4 option dialog and apply on ✕, sliders get the horizontal bar in that dialog, actions run through `gSettings.set()`, and read-only rows show the real value. The Enter Button pref picks ✕/○ for the hints. Rows reload on `g-setting-change`/`g-settings-ready` and the page list re-checks availability; `html.reduce-motion` keeps the panes but drops the slide. The shell is not the launcher dialog: to review it, `navU` then five `navR` reaches Settings and `press` opens it, or `THEMES=ps4 SCREENS=home,navU,navR,navR,navR,navR,navR,press`.

**Wii Settings (2026-10-18, task S3).** The Wii button opens a full-screen Wii Settings app built from `gSettings.layout('wii')`: the three Wii Settings pages first, then the layout's Internet, Message Board, Wii System and Advanced (launcher) pages, each as large rounded pill buttons on the striped wall with the pack's own pill textures. Blue page arrows (or left/right at the edge of the grid) turn pages with the pack's zip sound; every pill press uses the pack's navigate/select sounds through the existing `play()`. Pills whose `available()` is false never render, so menu music is absent until A1 and a desktop loses brightness. Choosing a value opens a sub-screen: On/Off for a toggle, `gSettings.options(id)` as pill choices, the Wii bar for a slider, and Back / Confirm along the bottom (A selects, B backs out); actions run through `gSettings.set()`, info rows show their real value, and Advanced (launcher) closes the Wii screen and opens the launcher's own dialog. Rows reload on `g-setting-change`/`g-settings-ready` and after a dialog closes; `html.reduce-motion` keeps the layout and drops the movement. To review it: three `navD` steps from the channel grid reach the Wii button, then `press` opens it; `navR` from the first pill walks the grid and turns the page at the edge, and `press` opens the focused pill's sub-screen.

**3DS System Settings (2026-10-18, task S3).** The toolbar's System Settings tab and the System Settings HOME icon open the console's two-screen app: the top screen describes the focused option (kicker, title, description, and a value pill for rows) and the bottom screen holds large white buttons. Its root has the four buttons the console grouped there — Internet Settings, Data Management, Other Settings and Advanced (launcher). Parental Controls is deliberately absent: the launcher has no parental-control capability, so the registry cannot back it and S3 must not fake it. Other Settings lists the remaining `gSettings.layout('3ds')` pages (Profile, Date & Time, Sound, Display, Theme, Controls, Notifications, System); a page's rows come from the registry and skip `available() === false`, so menu music is absent until A1 and Screen Layout is absent until D1. Toggles are green checks that change in place, choices and sliders open the bottom-screen sub-screen with Back / OK, actions run through `gSettings.set()`, and read-only rows show their real value. The A/B/D-pad focus model uses two columns for root and rows, four for Other Settings; B backs out one level at a time and the on-screen Back/Close button does the same. Rows reload on `g-setting-change`/`g-settings-ready` and after a dialog closes; `html.reduce-motion` keeps the layout and drops the movement. Review: three `navD` steps from the HOME grid reach the settings toolbar tab, `press` opens the app, `navD`/`press` reaches Other Settings and its pages.

### Files (src/renderer)

| File | What it does |
|---|---|
| garrison-themes.js/.css | Theme list and picker (Appearance and onboarding), apply(), shared console rules, splash, toasts, saver, logos, MDL2 era icons |
| garrison-theme-series.css | Xbox Series X\|S layout |
| garrison-theme-one.css | Xbox One 2013 Metro layout |
| garrison-theme-360.js/.css | Xbox 360 Metro: home band, featured tile, status, gamercard, pack sounds, boot video (plays only when focused) |
| garrison-theme-hubs.js/.css | Pivot hubs for One and 360. LB/RB switch hubs inside the dashboard and never open full-screen pages (`window.gHub`) |
| garrison-theme-library.js | Full-screen console "My games & apps" (sections per theme) |
| garrison-theme-home.js | Series backdrop finder, One Spotlight and panorama, A on a tile boots the game |
| garrison-theme-motion.js | Theme sounds, launch splash with cover and logo |
| garrison-theme-life.js / -live.js | Screen saver, profile corner, live tiles, Gamerscore, toast animation |
| garrison-theme-store.js | Store featured banner |
| garrison-theme-backgrounds.js | Per-theme backgrounds (default, game, DashX360 pack, custom image) |
| garrison-theme-art.js | Wide-art resolver (see the art rule) |
| garrison-theme-extras.js | Accent colours, friend and download toasts, welcome back, achievements on return, controller-lost screen, Quick Resume |
| garrison-theme-keyboard.js | On-screen keyboard per console |
| garrison-theme-settings.js | Settings sidebar relabelled and grouped per era: Xbox eras, the XMB's Settings column, the three Wii Settings pages, 3DS System Settings |
| garrison-theme-screens.css | Keyboard, settings groups, profile, achievements, search and power menu per console |
| garrison-theme-retro.js/.css | PS3 XMB, PS4 home, Wii Menu, 3DS HOME Menu, plus their library, boot, toast and splash rules |

## Theme packs (local only, never in the repo or releases)

Packs live in `%APPDATA%\xbox-preview-ui\theme-packs\`. They're for the owner's personal use. Several contain Microsoft, Sony or Nintendo assets, so never copy them into the repo.

- `dashx360/`: github.com/ZivvoZ/dashx360. Read by the main-process IPC `theme:pack` and `theme:pack-sound`.
- `ps4/Ps4-UI-master/`: github.com/d4v1-sudo/Ps4-UI (MIT). Includes the SST font, wave background, icons and mp3 sounds.
- `ps3/PS3-Simulator-main/`: github.com/CorruptionVR/PS3-Simulator (Unlicense). XMB icons in `icons/`, font `fonts/SCE-PS3-RD-R-LATIN2.woff`.
- `ps3/XMB-PS3-Icons-Sounds-Pack--main/pack/`: github.com/JMRDev0/XMB-PS3-Icons-Sounds-Pack- (MIT). Sounds in `oggs/` (up, down, ok, cancel, launch, notice).
- `wii/Wii.JS-gh-pages/`: github.com/andrewplus/Wii.JS (GPL-3). Channel frames, bottom bar, buttons, cursor and sounds in `assets/audio`.
- `wii/Liink-main/`: github.com/aica7/Liink (GPL-2). Rodin fonts.
- `*/ref/`: reference screenshots from Wikipedia, used to match layouts.

## Retro themes: current state

The owner said the PS3, PS4, Wii and 3DS themes were "nowhere near close enough". They were rebuilt from the
reference screenshots on 2026-10-17 and now measure up to them. The numbers below are 1080p console pixels.

1. Main IPC `theme:retro-pack` and `theme:retro-sound` (src/main.cjs RETRO_PACKS whitelist). The renderer builds file URLs for icons and fonts, and sounds are decoded through WebAudio.
2. PS3: real XMB layout from `ps3/ref/xmb.jpg`.
   - Category row at y 292, the selected category at x 560 and 210 apart; unselected icons 88×62 at 40% opacity, the selected one scaled 1.16 with its label under it.
   - The selected item sits at y 468 with a triangle cursor to its left and its name at 40px. Items above stack up from y 124 in steps of 82; items below run from y 604 in steps of 94. Item icons are 74×74 squares.
   - The wave is a canvas of three ribbon bands (crests near 50% height, fanning to the right) over the month's colour. The selected game's PIC1 art is a 58%-opacity layer *behind* it, so the wave never disappears.
   - Clock panel top right (510×58 at right 88, top 80).
   - Real icons, SCE font and ogg sounds from the pack.
3. PS4: from `ps4/ref/home.png`.
   - Status strip to y 166, icons at y 99, the note with its count badge, avatar and a 36px clock.
   - Tiles 237×237 from x 730 at a 260 pitch, the selected one 356×424 from x 337 with a Start bar. Content row at y 624 with the menu column and 250-tall cards. Hint bar 114 tall.
   - SST font, blue wave background from the pack.
4. Wii: from `wii/ref/menu.png`.
   - 4×3 channels of 393×229 at (165, 91) on a 420×256 pitch, sitting on three white trays, plus a peeking fifth column.
   - Bottom bar 229 tall with the cyan-outlined dip from x 500 to 1420; the seven-segment clock above the dip, the date inside it, 190px Wii and Message Board buttons at the ends.
   - Rodin font, channel frames, cursor and pack sounds.
5. 3DS: from `3ds/ref/home.jpg`, **adapted to one 16:9 display**: the two screens stand side by side at the same
   height with the wide screen first, on a dimmed copy of the selected game's art. Stacked, they could only fill
   half the frame. `--k` is 2.48, so the pair measures 1825 of the 1920 width.
   - Top: status bar (signal, Internet pill, Play Coins, date, time, battery), the drifting empty-slot pattern, the
     selected software's banner and its white name plate, plus the camera and L+R hints.
   - Bottom: toolbar (Home tab, Game Notes, Friend List, Notifications, browser, Miiverse, size toggle), the 4×3
     icon grid with the cyan corner selector, and the scroll bar.
6. Shared screens: the library's section list (flex column, counts, storage ring, sort line), Settings named per
   console, and the boot screen showing each console's wordmark instead of the Xbox sphere.
7. Kept in step with the library: the console screens build their own icons from cover art, so they re-render
   (coalesced, 300 ms, never over a dialog) when `library:artwork` or `library:initial` arrives. Without this,
   switching to PS3 while the library was still importing showed empty squares and an empty Game column.
   A dialog closing on Home re-renders so the focus lands back on the console screen, and a theme screen that
   throws drops `g-retro` and leaves the launcher's own Home in place instead of a black screen.
8. Console touches on the launcher's screens: the on-screen keyboard is themed per console, Play and install
   buttons take the console accent (`--g-xbox-green`) instead of Xbox green, and Wii/3DS keep light text on the
   dark library and settings screens while setting their own colours on their light Home screens.
9. The XMB wave draws its crest as three stacked strokes rather than a canvas shadow, and pauses whenever the
   window is hidden or unfocused; a full XMB rebuild with 8 games measured 6.7 ms.

## Known gaps

- Not tested on real hardware: controller, sound, boot video, and achievements on return.
- Avatars are partial: gamerpics only, no full-body avatar.
- The One theme's Pins wall starts partly off-screen and its selected tile's focus ring is weak against bright art;
  the Series dashboard fades to the page colour slightly early under the last row. Both are cosmetic and untouched.
- In demo mode (not the real app) the "Importing your library" screen can stay at 100%: the demo delivers the
  library through `library:initial` instead of the `scanLibrary` result that normally closes it.
- Release 0.6.0 is drafted in `docs/release-0.6.0.md` and now lists all eight themes. It hasn't been built or published.
