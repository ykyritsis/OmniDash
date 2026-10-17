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
  - Screens: home, library, detail, settings, apps, appearance, boot, toast, saver, options, store, launch, halo, onboarding, and `hub-<id>`. Controller steps (`navR`, `navL`, `navU`, `navD`, `press`, `back`) chain from `home` in the same list.
  - The window is 1920×1080 at DPR 1.5, so the PNGs are 2880×1620.
  - The process often stays alive after the last capture. Check the newest PNG, then kill only processes whose path
    matches `*xbox mode 2*node_modules*`.
  - If a run is killed or crashes, the demo profile counts a failed start and later runs come up in **safe mode**
    (prefetch and update checks off; art can come out blank). Reset it before capturing:
    `Set-Content .visual-review/themes/profile/startup-state.json '{"failedStarts":0,"pending":false}'`.
- `scripts/theme-eval.cjs` evaluates `EXPR_FILE` in the same demo window and writes `.visual-review/theme-eval.txt`.
  - `EVAL_SIZE=1920,1080` matches the review window. `DEMO_ART=1` paints the same stand-in artwork the captures use.
  - Handy for checking computed sizes: the expression can read `getComputedStyle`, `getBoundingClientRect` and `state`.
- `scripts/launch-hang-check.cjs` checks for a freeze after a game launches.
- **The owner games on this PC.** Never open visible or focus-taking windows and never play sound.
  - Never touch the installed app while `Xbox Preview UI.exe` is running.
  - Only kill processes whose path matches `*xbox mode 2*node_modules*`.

## Installing a test build into the owner's copy

1. Copy the installed `%LOCALAPPDATA%\Programs\Xbox Preview UI\resources\app.asar` and `app.asar.unpacked` to `resources\backup-<name>`.
2. Extract the asar, overlay `src/`, set the version, and repack. Use `@electron/asar` from `node_modules/.pnpm/@electron+asar@3.4.1`.
3. Copy `app.asar` and `app.asar.unpacked` back.

The latest backup is `backup-0.6.0-test11`.

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

## Known gaps

- Not tested on real hardware: controller, sound, boot video, and achievements on return.
- Avatars are partial: gamerpics only, no full-body avatar.
- The One theme's Pins wall starts partly off-screen and its selected tile's focus outline only shows on two edges;
  the Series dashboard fades to the page colour slightly early under the last row. Both are cosmetic and untouched.
- Release 0.6.0 is drafted in `docs/release-0.6.0.md` and now lists all eight themes. It hasn't been built or published.
