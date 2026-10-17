# Handover: console themes (0.6.0 work in progress)

Status as of 2026-10-17. This covers the console theme system added on top of the 0.5.1 launcher.
The work is on branch `console-themes`. It hasn't been released yet.

## Git

- Use the work git dir: `git --git-dir=.git-work --work-tree=.`. Remote `origin` is github.com/ykyritsis/xbox-cloud-preview-on-pc.
- The plain `.git` folder is an empty repo, and `.public-git` is old. Ignore both.
- These files are deliberately **not** committed:
  - `docs/xbox-app-mod/`: screenshots of the official Xbox app.
  - `docs/xbox-app-modding.md`.

## Running and testing without Node

- There's no Node on PATH. Run scripts with `ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe <script>`.
- Review screenshots run in hidden demo windows. Output goes to `.visual-review/themes/<theme>-<screen>.png`.
  - Command: `THEMES=ps3,ps4 SCREENS=home,library node_modules/electron/dist/electron.exe scripts/theme-review.cjs`
  - Screens: home, library, detail, settings, apps, appearance, boot, toast, saver, options, store, launch, halo, onboarding, and `hub-<id>`.
- `scripts/theme-eval.cjs` evaluates the expression in `EXPR_FILE`.
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
- Art rule: wide art goes only in wide slots and square covers only in square slots.
  - Wide slots carry `data-g-wide-art="<gameId>"`. `garrison-theme-art.js` (`window.gWideArt`) resolves verified wide art with ratio ≥1.5 and width ≥900. The Steam `library_hero` image is tried first.
  - If no wide art is found, the slot falls back to the cover on a blurred background.
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
| garrison-theme-settings.js | Settings sidebar relabelled and grouped per era |
| garrison-theme-screens.css | Keyboard, settings groups, profile, achievements, search and power menu per console |
| garrison-theme-retro.js/.css | PS3 XMB, PS4 home, Wii Menu, 3DS HOME Menu |

## Theme packs (local only, never in the repo or releases)

Packs live in `%APPDATA%\xbox-preview-ui\theme-packs\`. They're for the owner's personal use. Several contain Microsoft, Sony or Nintendo assets, so never copy them into the repo.

- `dashx360/`: github.com/ZivvoZ/dashx360. Read by the main-process IPC `theme:pack` and `theme:pack-sound`.
- `ps4/Ps4-UI-master/`: github.com/d4v1-sudo/Ps4-UI (MIT). Includes the SST font, wave background, icons and mp3 sounds.
- `ps3/PS3-Simulator-main/`: github.com/CorruptionVR/PS3-Simulator (Unlicense). XMB icons in `icons/`, font `fonts/SCE-PS3-RD-R-LATIN2.woff`.
- `ps3/XMB-PS3-Icons-Sounds-Pack--main/pack/`: github.com/JMRDev0/XMB-PS3-Icons-Sounds-Pack- (MIT). Sounds in `oggs/` (up, down, ok, cancel, launch, notice).
- `wii/Wii.JS-gh-pages/`: github.com/andrewplus/Wii.JS (GPL-3). Channel frames, bottom bar, buttons, cursor and sounds in `assets/audio`.
- `wii/Liink-main/`: github.com/aica7/Liink (GPL-2). Rodin fonts.
- `*/ref/`: reference screenshots from Wikipedia, used to match layouts.

## Retro themes: what's next

The owner said the PS3, PS4, Wii and 3DS themes are "nowhere near close enough". Next steps:

1. Done: main IPC `theme:retro-pack` and `theme:retro-sound` (src/main.cjs RETRO_PACKS whitelist). The renderer builds file URLs for icons and fonts, and sounds are decoded through WebAudio.
2. PS3: real XMB layout from `ps3/ref/xmb.jpg`.
   - The category row sits at about 25% height with the selected category left of centre.
   - Items above the selection stack upward, above the row.
   - The ribbon wave crosses the middle.
   - The clock box sits top right.
   - Use the real icons, the SCE font and the ogg sounds.
3. PS4: from `ps4/ref/home.png`.
   - Top function bar: notifications, friends, party, profile, trophies, clock.
   - Square tiles. The selected tile grows and shows "Start".
   - Content row below, blue wave background, SST font.
4. Wii: from `wii/ref/menu.png`.
   - 4×3 rounded channels on white stripes.
   - Grey bottom bar with the curved dip, the time above it and the date inside it.
   - Wii and mail round buttons. Rodin font. Pack sounds.
5. 3DS: from `3ds/ref/home.jpg`.
   - Top screen: status bar (signal, Play Coins, date, time, battery) and the selected software's banner.
   - Bottom screen: toolbar row (settings, Game Notes, Friend List, Notifications, browser, Miiverse) and a grid of rounded icons with the cyan corner selector.

## Known gaps

- Not tested on real hardware: controller, sound, boot video, and achievements on return.
- Avatars are partial: gamerpics only, no full-body avatar.
- Release 0.6.0 is drafted in `docs/release-0.6.0.md` but hasn't been built or published.
