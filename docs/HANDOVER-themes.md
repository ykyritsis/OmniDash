# Handover: console themes (0.6.0 work in progress)

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

The latest backup is `backup-0.6.0-test13` (it holds the build installed before the 2026-10-17 evening theme work).

## Theme system

- `body[data-g-theme]` is one of `helix | series | one | x360 | ps3 | ps4 | wii | 3ds`. `body[data-g-console]` is set for every theme except Helix.
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
