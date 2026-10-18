# Handover: console themes (0.6.0 work in progress)

> **2026-10-18, Claude: the work queue is now `docs/NEXT-LEVEL-PLAN.md`** (parity review, settings registry,
> per-console specs, rename and GitHub relaunch, ordered prompts). Start with its Phase 1 (real settings).
> Correction to the art rule below: **PS3 game icons are wide ICON0 (320:176)**, not square slots.

> **2026-10-18 handover to Claude — read this first.** Branch `console-themes`, HEAD `6525c36`.
> The installed copy at `%LOCALAPPDATA%\Programs\Xbox Preview UI` is current (`backup-0.6.0-test37`, the D1/D2
> two-screen 3DS build). Install with
> `node_modules\electron\dist\electron.exe scripts\install-test-build.cjs` (needs `ELECTRON_RUN_AS_NODE=1` in
> the shell); it refuses while `Xbox Preview UI.exe` runs.
>
> State: seven of the eight themes have had a console-accuracy pass. **Helix is intentionally untouched** (the
> owner wants it to stay the modern PC look). **The Wii pass is unfinished** — its motion and channel details
> were started and committed mid-way; treat the Wii section of `garrison-theme-retro.js/.css` as in progress.
>
> Done recently: 3DS rebuilt as the console's two light screens (D1/D2: stacked, side-by-side and large-top
> layouts from the Screen Layout setting); per-console Settings option blocks
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

The latest backup is `backup-0.6.0-test37` (the 3DS D1/D2 two-screen build, installed 2026-10-18 16:13; the previous was `backup-0.6.0-test36`, the G1 button-glyph build). The installed copy has this build.

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
- Script order at the end of `index.html` matters: themes, library, motion, home, life, live, store, 360, backgrounds, hubs, art, extras, keyboard, settings registry, **settings shell**, prefs-era settings labels/packs, retro.

**Settings registry (2026-10-18, task S1).** `src/renderer/garrison-settings-registry.js` loads after `garrison-prefs.js` and exposes `window.gSettings`: 51 entries (`slider`, `toggle`, `choice`, `action`, `info`) wrapping only real capabilities — quick:get/set for volume, mute, brightness and power plan; the Settings form inputs plus `saveSettingsForm` for personalisation; `setPref` for saved prefs; and the launcher's existing buttons for updates, backup, reset, profile and account setup. Each entry has `get`/`set`/`available`, per-console wording through `label(id, console)`, and `gSettings.layouts` names each console's pages and row order by registry id; `set()` fires `g-setting-change` on `document`, and `formatClock`/`formatDate` are shared by the console clocks. The S2–S5 shells must render rows from `gSettings.layout(console)`, `options(id)` and `label(id, console)` and skip any row whose `available()` is false — no hand-written settings rows. New prefs live in `SETTINGS_DEFAULTS` and `PREF_KEYS` in `src/main.cjs`; menu music (A1) and the 3DS screen layout (D1) are wired to their consumers now — `window.gAudio` exists, and `window.g3dsLayout` in `garrison-theme-retro.js` reads and applies the layout, so `screenLayout3ds` is available in 3DS → Other Settings → Display. `scripts/settings-registry-test.cjs` checks the entries and layouts in plain node.

**PS3 settings in the XMB (2026-10-18, task S2).** The Settings column lists `gSettings.layout('ps3')`: one item per page (Display, Sound, Theme, Date and Time, System, Accessory, Network, Notification, Game, Account, then Advanced (launcher)), all rendered from the registry. Choosing a page slides the column left 280px (the XMB's own `.34s cubic-bezier(.22,1,.36,1)`) and opens the page's rows in a translucent right-hand panel; rows whose `available()` is false are skipped, so menu music is absent until A1 and a desktop loses brightness. Choosing a row opens the XMB option pop-up: `gSettings.options(id)` for a choice, On/Off for a toggle, the PS3 horizontal bar for a slider (left/right adjust, ✕ sets, ○ cancels), and `gSettings.set()` runs actions at once; info rows show the read-only value. ✕/○ follow the Enter Button pref. Everything refreshes on `g-setting-change` and `g-settings-ready`; `html.reduce-motion` keeps the layout but drops the slide. Form-backed rows first call `ps3SyncLauncherForm()` so `saveSettingsForm` cannot save its unopened defaults over real accounts, region or display settings. Advanced (launcher) closes the sub-list and opens the launcher's own Settings dialog; its decorative PS3 block is hidden on this theme (S5 deletes it). To review it: five `navL` steps reach the Settings column, then `press` opens a page and `navD`/`press` opens rows and the pop-up.

**PS4 settings (2026-10-18, task S3).** The Settings function opens a full-screen registry screen instead of the launcher dialog: `gSettings.layout('ps4')` pages as a category list with icons and a blue focus bar, the layout's last page (Advanced (launcher)) at the bottom of the list. Choosing a page slides the list left and brings its rows in from the right; rows skip `available() === false` (menu music is absent until A1, brightness on a desktop). Toggles are check boxes that change in place, choices open the PS4 option dialog and apply on ✕, sliders get the horizontal bar in that dialog, actions run through `gSettings.set()`, and read-only rows show the real value. The Enter Button pref picks ✕/○ for the hints. Rows reload on `g-setting-change`/`g-settings-ready` and the page list re-checks availability; `html.reduce-motion` keeps the panes but drops the slide. The shell is not the launcher dialog: to review it, `navU` then five `navR` reaches Settings and `press` opens it, or `THEMES=ps4 SCREENS=home,navU,navR,navR,navR,navR,navR,press`.

**Wii Settings (2026-10-18, task S3).** The Wii button opens a full-screen Wii Settings app built from `gSettings.layout('wii')`: the three Wii Settings pages first, then the layout's Internet, Message Board, Wii System and Advanced (launcher) pages, each as large rounded pill buttons on the striped wall with the pack's own pill textures. Blue page arrows (or left/right at the edge of the grid) turn pages with the pack's zip sound; every pill press uses the pack's navigate/select sounds through the existing `play()`. Pills whose `available()` is false never render, so menu music is absent until A1 and a desktop loses brightness. Choosing a value opens a sub-screen: On/Off for a toggle, `gSettings.options(id)` as pill choices, the Wii bar for a slider, and Back / Confirm along the bottom (A selects, B backs out); actions run through `gSettings.set()`, info rows show their real value, and Advanced (launcher) closes the Wii screen and opens the launcher's own dialog. Rows reload on `g-setting-change`/`g-settings-ready` and after a dialog closes; `html.reduce-motion` keeps the layout and drops the movement. To review it: three `navD` steps from the channel grid reach the Wii button, then `press` opens it; `navR` from the first pill walks the grid and turns the page at the edge, and `press` opens the focused pill's sub-screen.

**Console account overlays (2026-10-18, Phase 3 item 12).** `garrison-theme-overlays.js/.css` replace the shared Garrison account flyout on PS3, PS4 and Wii: a PS3 XMB right-hand panel, a PS4 left Quick Menu, and a Wii HOME Menu. Every row is real — avatar editor, launcher Settings, power dialog, `gSettings` volume/mute/controller-vibration, real notifications and battery. The shared power dialog is themed per console from the same stylesheet. Keyboard, controller, click and reduce-motion are handled; the module closes on a theme change. It opens from the existing `g-account` action, so the three shells did not need to change.

**OmniDash rename (2026-10-18, task R1).** The product is **OmniDash** in `productName`, the window title, splash, Settings, onboarding and import screens, the Windows Xbox-mode bridge display name, installer artifact names, update/power/support copy and the 360/One gamercard labels. `appId`, the `%APPDATA%\xbox-preview-ui` data folder and every `NEBULA_*` name are unchanged; `main.cjs` pins `userData` to the old folder so the rename cannot orphan settings or theme packs. The Xbox-mode bridge folder (`%LOCALAPPDATA%\Xbox Preview UI`) and its package `Identity` are also kept so existing Windows registrations keep working. `build/icon.svg/.png` are a new drawn OmniDash mark; there is no system tray and no About panel in this app, so there was nothing to rename there. The updater's release URL is untouched (R2). Existing players see a one-time "Now called OmniDash" toast; the fresh-profile onboarding keeps its existing 8-theme "Choose your dashboard" picker. `theme-packs/` in the repo root is a git-ignored junction to the owner's pack folder; `docs/theme-packs.md` maps the packs and the app's own assets.

**3DS System Settings (2026-10-18, task S3; Screen Layout wired by D1).** The toolbar's HOME Menu settings tab and the System Settings HOME icon open the console's two-screen app: the top screen describes the focused option (kicker, title, description, and a value pill for rows) and the bottom screen holds large white buttons. Its root has the four buttons the console grouped there — Internet Settings, Data Management, Other Settings and Advanced (launcher). Parental Controls is deliberately absent: the launcher has no parental-control capability, so the registry cannot back it and S3 must not fake it. Other Settings lists the remaining `gSettings.layout('3ds')` pages (Profile, Date & Time, Sound, Display, Theme, Controls, Notifications, System); a page's rows come from the registry and skip `available() === false`, so menu music is absent only while `gAudio` is missing. **Display → Screen Layout** is the real D1 row: Stacked / Side by side / Large top screen, applied live to the HOME Menu and persisted. Toggles are green checks that change in place, choices and sliders open the bottom-screen sub-screen with Back / OK, actions run through `gSettings.set()`, and read-only rows show their real value. Toggles are green checks that change in place, choices and sliders open the bottom-screen sub-screen with Back / OK, actions run through `gSettings.set()`, and read-only rows show their real value. The A/B/D-pad focus model uses two columns for root and rows, four for Other Settings; B backs out one level at a time and the on-screen Back/Close button does the same. Rows reload on `g-setting-change`/`g-settings-ready` and after a dialog closes; `html.reduce-motion` keeps the layout and drops the movement. Review: three `navD` steps from the HOME grid reach the settings toolbar tab, `press` opens the app, `navD`/`press` reaches Other Settings and its pages.

**Xbox era settings (2026-10-18, task S4; moved into the shared shell later the same day).** The Series, One and 360 Settings entries open a full-screen console screen instead of the launcher dialog. `openSettings()` for those three themes now reaches the shared shell below; the screen is still `#g-xset` and its CSS lives in `garrison-theme-screens.css` (all sizes in `--cpx`, fitting 1706x960 and 1280x720 with the rows scrolling inside the body). Series and One keep the launcher's two-pane Garrison list: the console's page rail on the left with the layout's era titles, and the page's registry rows on the right. The 360 gets the blade-free Metro "System Settings" screen instead: one light grey list of pages, then that page's rows. A row is only drawn while `gSettings.available(id)` is true. Toggles change in place (Series draws a switch, One and 360 print On/Off), sliders open the console's horizontal bar dialog with Set/Cancel, choices open the option list and apply on A, actions run through `gSettings.set()`, and read-only rows show their real value. The layout's last page, Advanced (launcher), opens the launcher's own Settings dialog through the registry action and closes the shell; the 360 hub's settings tiles open the shell on the matching page (Profile/System/Preferences and so on). Xbox keeps the standard A/B layout — `app.js`'s `swapsConfirmBack()` applies the Enter Button pref only to PS3/PS4 and the Nintendo layout to Wii/3DS — so the hint bar prints A Select / B Back rather than a PlayStation glyph the pad cannot send. `html.reduce-motion` keeps the layout and drops the open/page animations. To review a shell hidden, click the top-bar gear (Series/One) or the 360 Settings button, or call `gShell.open('series'|'one'|'x360')` from `theme-eval`; captures are `.visual-review/settings-shell/xbox-*.png`.

**One shared settings shell (2026-10-18, owner's streamlining brief).** All seven console settings screens now run on one model in **`src/renderer/garrison-settings-shell.js`** (`window.gShell`), loaded after the registry and before `garrison-theme-retro.js`. The model is `open(console)`, `pages(console)`, `rows(pageId)`, `focus`, `move(direction)`, `activate()`, `back()`, `close()` and `refresh()`; `focus` is a getter returning `{ console, level, index, id, kind, pageId, value, overlay, loading }`. It owns:
- page and row loading from `gSettings.layout/available/label/get/options`, including choice lists and live values;
- the console grammar: confirm = A/Enter/✕ and back = B/Esc/○ (the skin prints the console's own glyphs, and the Enter Button pref is read live);
- availability filtering (a row whose `available()` is false is never rendered), form sync before a form-backed row is read or written, and optimistic value changes that revert with a toast on failure;
- value dialogs (choice list, On/Off, slider, read-only info), commit/cancel, action rows, and Advanced (launcher);
- live reload on `g-setting-change`/`g-settings-ready`, after a dialog opened from a row closes, and after a theme switch (closing a shell that belongs to another console);
- focus trap (Tab stays in the shell), focus restore to the opener, and no focus left inside a closed shell.

One wrapper per launcher route is installed once: `openSettings` (a console's Settings affordance opens the shell, not the launcher dialog), `showSettingsPage` (Xbox hub tiles map to the console's page), `performAction` (`gsh-*` controls), `navigateConsoleHome` and `navigateBack`. Skins never call `gSettings.set` and never handle Back.

Each console is a **skin** (`gShell.define(console, skin)`) that supplies only its chrome, class names, icons, hints and navigation shape:
| Console | Skin surface | Skin-only pieces |
|---|---|---|
| PS3 | XMB Settings column (registry pages as XMB items), right-hand sub-list, option pop-up, horizontal slider bar | `PS3_PAGE_ICONS`, `PS3_ROW_ICONS`, `renderPs3Sub/Pop`, XMB column movement |
| PS4 | full-screen page list with icons and blue focus bar, rows sliding in, check-box toggles, option dialog/slider | page glyph map, PS4 layout markup |
| Wii | three-plus pill pages with blue arrows, light sub-screen, Back/Confirm, pack pill textures | pill parts, dots/arrows, page copy |
| 3DS | two-screen app, four root buttons incl. Other Settings, top-screen description, bottom tiles | `DS_SET_ICONS/COPY`, root grouping |
| Series/One | `#g-xset` rail + rows, switch/On-Off | `XSET_BRAND/PAGE_GLYPHS`, launcher-page map |
| 360 | `#g-xset` Metro page list then rows | same shell screen, no rail |

The old duplicated state machines were deleted: ~1,240 lines from `garrison-theme-retro.js` (PS3's `ps3Open/ps3Popup`, PS4/Wii/3DS page/row/dialog/scan/reload code) and the whole `#g-xset` implementation from `garrison-theme-settings.js` (now the era label map and the console pack manager only; `XSET_*`/`xsetEscape` are gone). `scripts/settings-registry-test.cjs` now proves the shell is loaded before the skins, reads every part of the registry, exposes the eight model calls, keeps `data-setting-id` on rendered rows in all five templates, registers all seven skins, and that the old state names, `scanShellLayout`/`loadShellRows` and the Xbox shell code in the label file stay deleted.

**Streamlining results (2026-10-18).** A page lists its rows immediately (Wii opens on page 1, Series/One on their first page; no extra level the console did not have). The focused row always shows its current value, and every screen has a hint line with the console's own buttons. One activation from the console's Settings affordance opens the root (PS4 Settings function, Wii button, 3DS toolbar tab, Xbox gear); on PS3 selecting the Settings column already shows the root and one press opens a page. Toggle changed from Home, counting confirms only: **PS3 3, PS4 3, Wii 3, 3DS 4**. Choices add the option press (PS4 4; 3DS 5 because Other Settings is a real console level); sliders add an adjust plus Set. Back always goes up one level and closes at the root. The hidden eval `.visual-review/settings-shell-eval.js` (`EXPR_FILE`, `EVAL_SIZE=1706,960`, 2026-10-18 14:35) returned `ok: true`, `errors: []`: page counts 11/9/7/11 match `gSettings.layout`; `fullscreen`, `notifyFriends` and `soundEffects` toggled and read back; `clockFormat` set and read back; Back closed and focus returned to Display Settings (PS3), Settings (PS4), Wii Options (Wii) and System Settings (3DS); a hidden `mute` row was absent and came back; reduced motion had `anim: ''`, 0 running animations and a `0s`/`1e-06s` transition. Captures at 1706x960 and 1280x720 live in `.visual-review/settings-shell/<size>/` (PS3/PS4/Wii/3DS + `*-errors.json: []`), with Xbox root/page captures alongside. The task's `SCREENS=home,press,page-personalization` review at both sizes also ends with `errors.json: []`.

**Still shared-but-not-quite.** The skins still own their row markup (the shared shell owns the row's state, value and `data-setting-id`; the test guards the id). Icon-name maps remain per console because a PS3 row must resolve to a pack file while a PS4 row uses a drawn glyph. The 3DS root grouping (Internet/Data/Other/Advanced) is encoded in its skin rather than the registry, and a 3DS choice inside Other Settings needs five confirms (root → Other → page → row → option), one more than the four-press aim. `pages()` deliberately keeps every layout page so the page count always matches `gSettings.layout`; a page whose rows are all unavailable shows its empty note instead of disappearing. On PS3, if a library/artwork refresh rebuilt the XMB list while Settings was open, closing after a rebuild restores the focus to the same page's XMB item (same `data-page`) rather than the original node; normal runs restore node identity. Xbox Advanced closes the shell before opening the launcher dialog, so after that dialog closes the pad lands on the dashboard's default control rather than the gear.

**Button glyphs and prompts (2026-10-18, task G1).** `src/renderer/garrison-glyphs.js` is the single source of truth for every on-screen button picture. It loads after the registry and before the settings shell (`index.html`, one script tag), exposes `window.gGlyphs`, and draws **original inline SVG** because no console art is shipped:
- **PlayStation (`ps3`, `ps4`):** `cross`, `circle`, `triangle`, `square`, `l1/r1`, `l2/r2`, `options`, `share`, `ps`, `touchpad`, the D-pad and arrows. They are the bare symbols, not buttons in a ring.
- **Nintendo (`wii`, `3ds`):** `a/b/x/y`, `plus`, `minus`, `home`, `l/r`, `zl/zr`, the D-pad and arrows.
- **Xbox (`series`, `one`, `x360`):** coloured `a/b/x/y`, `lb/rb`, `view`, `menu`, `lt/rt`, `guide`, the D-pad and arrows.

Every console owns a complete independent set, so `has(console, name)` can never borrow another skin's glyph. `gGlyphs.icon(console, name)` returns the picture and `gGlyphs.row(console, [{ button, label }])` returns a hint row; rows carry their spec and repaint themselves on `g-setting-change`. `gGlyphs.prompts[console].home` is the canonical wording/order:
- PS3 `✕ Enter  ○ Back  △ Options`; PS4 `✕ Enter  ○ Back  OPTIONS Options` (one `OPTIONS` glyph then the word).
- Wii `A Select  B Back  +/− Page`; 3DS `A OK  B Back  X Options`.
- Series/One `A Select  B Back  [Y Search]  Menu Options`; 360 `A Select  B Back  Menu Options  Y Search`.
The words are labels; the glyphs are buttons. Never print a display letter for a button in a console skin.

**Live mapping.** `gGlyphs.face(console)` reads the registry prefs the same way `pollGamepad` does: PlayStation's `enterButton` (`x`/`o`) swaps cross/circle (and physical pad buttons 0/1), Nintendo's `nintendoLayout` swaps A/B (and pad buttons 0/1). A `@confirm`/`@back` token in a prompt resolves through `face()`, so the glyph and the pad can never disagree; flipping either setting repaints the hints in place (tested: PS3 row becomes `○ Enter ✕ Back`; Wii row becomes `B Select A Back`). Xbox keeps the standard layout.

**Where the glyphs are used.** The retro skins use `row()` for the XMB bottom bar (new), PS4 hint bar, Wii menu bar (new), 3DS bottom screen, PS3 sub-list/pop-up and PS4/Wii/3DS settings hint lines. The 360's `#g-360-hints` is a glyph row. Series and One show the shared `#controller-prompts` bar as their bottom-left footprint on Home (styled in `garrison-theme-series.css`/`-one.css`, forced visible for A and B there); `app.js` still owns which prompts are live, so a view that cannot go back does not show Back. For the files this task could not edit, the helper upgrades them from the DOM: the on-screen keyboard (Done → the console's back glyph), dialog close hints, the shared hint bar, the shell's `.g-xset-hints`/`.g-xset-action` footer, and the PS3/PS4/Wii account overlays. It reads `[data-g-role]` markers and known containers; the old Xbox `B` chip becomes PlayStation's circle or Nintendo's B in Wii/3DS automatically.

**Input paths added with the prompts.** A PS3 triangle and a 3DS X are that console's Options button: they now open the focused game's real options dialog (PS3 via the no-source `toggle-search` redirect, 3DS via a focused 40 ms pad poll for button 2; a keyboard `x` does the same). The 3DS Y and L+R were reassigned by D1 to the two shortcuts the top screen prints: Y opens the Camera capture (`.ds-hint-l`), L+R switches the icon size (`.ds-hint-r`), on pad and keyboard; the no-source `toggle-search` redirect now chooses between PS3 Options and 3DS Camera by theme. Wii keyboard `+`/`−` (and `=`/`_`) turn channel pages. The prompts are not decorative: every one has a real action behind it. The settings shells already expose the Controller rows — PS3 Accessory Settings (`controllerStatus`, `controllerVibration`, `enterButton`), PS4 Devices (same three), Wii Settings page 3 (`nintendoLayout`, `controllerVibration`, `controllerStatus`), 3DS Other Settings → Controls (same three), Series/One Devices & connections and 360 Controllers (`controllerStatus`, `controllerVibration`). No new settings were invented.

**Pack override.** A pack opts in with `gGlyphs.usePack({ glyphs: { ps3: { cross: 'file:///…/cross.png', … } } })` or `gGlyphs.setPackBase(console, folderUrl)`. The helper never guesses at pack files: a pack that says nothing costs zero requests and never writes a failed-load error into `errors.json`. The drawn set is always the fallback. (Automatic discovery of a pack's `glyphs/` folder needs a manifest field from `theme:retro-pack`/`theme:pack`, which lives in `main.cjs`; until then a pack with glyph pictures needs that explicit map.)

**G1 verification (2026-10-18).** Hidden captures `THEMES=series,one,x360,ps3,ps4,wii,3ds SCREENS=home,keyboard,toast` at `1706,960` and `1280,720`; `errors.json: []` at both sizes. Hidden eval `.visual-review/glyph-eval.js` (`EXPR_FILE`, `EVAL_SIZE=1706,960`) returned `ok: true`, `errors: []`: every theme's Home row read `cross:Enter/circle:Back/triangle:Options` (PS3), `cross:Enter/circle:Back/options:Options` (PS4), `a:Select/b:Back/plus+minus:Page` (Wii), `a:OK/b:Back/x:Options` (3DS), `a:Select/b:Back/y:Search/menu:Options` (Series/One), `a:Select/b:Back/menu:Options/y:Search` (360); `enterButton=o` changed the PS3 row to `circle:Enter/cross:Back` and `face('ps3').confirmIndex` from 0 to 1; `nintendoLayout=true` changed the Wii row to `b:Select/a:Back` and the pad's confirm index to 1; every settings-shell hint carried only its own console's glyphs and every console layout reaches `controllerStatus`/`controllerVibration` (plus `enterButton` on PS3/PS4 and `nintendoLayout` on Wii/3DS); the PS4 keyboard flipped ○→✕ live. `scripts/settings-registry-test.cjs` now fails if any console lacks a required glyph, if a canonical prompt names a missing glyph, or if a skin's `gRow()` names an unknown console.


**3DS: two light screens again (2026-10-18, tasks D1 and D2).** The iiSU-style full-bleed grid is gone. The HOME Menu is the console again: a light **400×240 top screen** (5:3) above a light **320×240 bottom screen** (4:3) inside a dark body, centred on a dark surround. The geometry lives in `garrison-theme-retro.css` as design-pixel variables on `#g-retro[data-ds-layout]`; `garrison-theme-retro.js` sets that attribute from the registry's `screenLayout3ds` pref through **`window.g3dsLayout`** (the pref's consumer, which is why the row is `available()`). Every screen's contents are written in its own native pixels times `--kt` / `--kb` (the `--u` length inside each screen), so changing the layout never rebuilds the screens.
- **stacked** (default, the console): 960×1048 body, 800×480 top over 640×480 bottom (`--kt = --kb = 2`), 30px hinge, 34/24px bezels. At 1706×960 the device is 853×931 (top 711×427, bottom 569×427) and at 1280×720 it is 640×699 (top 533×320, bottom 427×320); the device fills 97% of the frame height.
- **side-by-side**: 1868×672 body, 1000×600 top and 800×600 bottom at the same height (`k = 2.5`), 24px pad and a 20px gap. At 1706×960 it is 1660×597 with the top screen left of the bottom; at 1280×720 it is 1245×448.
- **large-top** (Citra-style): 1720×1056 body, 1660×996 top (`kt = 4.15`) with the 480×360 bottom screen (`kb = 1.5`) over the bottom-right corner, ringed and shadowed so it reads as a second screen. At 1706×960 the device is 1528×938; at 1280×720 it is 1147×704. The right-hand top-screen hint shifts left so the overlay never covers it.
All three fit both sizes with `scrollWidth === innerWidth` and `scrollHeight === innerHeight`. Changing Screen Layout applies live (the root's `data-ds-layout` and the CSS variables change; the mounted device is not rebuilt) and persists via `setPref`. The setting is in **System Settings → Other Settings → Display** and reads back as Stacked / Side by side / Large top screen. System Settings itself is unchanged: it keeps its own larger 54/46 two-screen app, so Screen Layout is a HOME Menu setting (as on the console, where the physical screens never move).

**Top screen (D1).** The light default-theme pattern (a drawn rounded-square SVG tile), then the status bar — signal bars, the blue **Internet** pill, Play Coins with a gold coin, the date and weekday, the clock with its blinking colon, and the battery — followed by the selected software's banner (wide art, square-cover fallback on a blurred frame until it resolves) with a pointer-driven parallax drift, the **white title plate** with the app icon, name and publisher/play time, and the two hint groups along the bottom: a drawn camera + `Y Camera` and `L R Icon size`, both from `gGlyphs.row('3ds', …)`. System apps get their own drawn icon on a light banner and their real sub-line. The plate and clock update with the selection and the minute.

**Bottom screen (D1).** The toolbar is the console's: a white **HOME Menu settings tab** (the blue house/wrench), Game Notes, Friend List, Notifications, Internet Browser, Miiverse, then the two **icon-size buttons** — all real actions (settings shell, library, friends, notifications flyout, search, account overlay) and all in the controller rail (`dsMove`'s toolbar row now has eight entries). The white rounded cells hold square covers or icon art; the selected cell gets the pulsing light-blue corner bracket. **Folders** are real launcher collections (`state.customCollections`): a cell with up to four mini covers that opens the collection in the library. The rail shows five 44px columns × three rows at Small and four 52px columns × three rows at Large; the two size buttons (and pad/keyboard **L+R**) change it live and remember the choice in `localStorage['g-3ds-zoom']`. The slider bar under the rail shows the column position. `html.reduce-motion` (and `ds-still`) removes the rail/cursor/art transitions and the cursor pulse and colon blink; the layout still changes.

**System icons (D2).** The `3ds` pack on this machine has only `ref/` (two reference captures), so nothing real is available to load and the theme requests no pack file. Every system app uses a **drawn original SVG** in the console's colours and 48×48 shape: Health and Safety (warning triangle), Nintendo 3DS Camera, Nintendo 3DS Sound, Mii Maker, StreetPass Mii Plaza, Nintendo eShop, System Settings (cream wrench), Download Play, Activity Log, Notifications, Friend List, plus the HOME settings tab, Game Notes, Internet Browser, Miiverse, folder and the two zoom glyphs. Each maps to a real action: Health and Safety → System Settings → System, Camera → newest capture (`g-retro-captures`), Sound → System Settings → Sound, Mii Maker → account/profile, StreetPass and Friend List → friends, eShop → Store, System Settings → the console settings shell, Download Play → the library's queue, Activity Log → the library, Notifications → the notifications flyout. The grid is folders + up to 24 library games + these apps, so every rail cell does something (checked by eval: 11/11 app labels present, no cell without a `data-action`).

**Two engine fixes that came with D1.** The 3DS banner now resolves wide art only **after the window load event** (`dsArtReady`). `app.js`'s `preloadAmbientImage` clears a failed probe with `image.src = ''`, and Electron 39's `logSecurityWarnings` then calls `new URL('')` on the empty performance entry and throws `Failed to construct 'URL': Invalid URL` into `errors.json`; with the deferred resolve, the layout and the rest of the app report `[]` again. `cssUrl()` in this file also returns `none` for an empty value instead of `url("")`, for the same reason.

**3DS verification (2026-10-18, D1/D2).** `THEMES=3ds SCREENS=home,navR,navD,press REVIEW_SIZE=1706,960` → `errors.json: []`; the same at `1280,720` → `[]`. Captures are `.visual-review/3ds/1706/` and `.visual-review/3ds/1280/`, with `side-1706`, `side-1280`, `large-1706`, `large-1280` for the two alternative layouts (each `errors.json: []`). Hidden eval `.visual-review/ds-eval.js` (`EXPR_FILE`, `EVAL_SIZE=1706,960`, `DEMO_ART=1`) returned `ok: true`: `screenLayout3ds` available, options `stacked/side-by-side/large-top`, `window.g3dsLayout` a function; stacked top ratio `1.667`, bottom `1.333`, above, centred, device `853×931` at `(426.5, 14.4)` filling `0.97` of the height; side by side top `888.5×533.1` at `(44.4, 213.4)` and bottom `710.8×533.1` at `(950.7, 213.4)`, same height, top left of bottom; large top `1475×885` with bottom `426.5×319.9` at `(1164, 602.6)` in the corner; all fit with no scroll overflow; setting switches read back and the root attribute changes each time; selection changed `Forza Horizon 5` → `Lies of P` on `navR`; zoom `44 → 52 → 44` with `aria-pressed` and storage; the selected game cell kept `select-game`/`data-retro-boot` and called `launchSelectedGame` once; `html.reduce-motion` gave `animationName: none` on the cursor and clock colon, `transitionDuration: 0s` on rail/cursor/art, and the layout still switched. `.visual-review/ds-settings-eval.js` walked the real app: System Settings → Other Settings → Display listed `brightness`, `uiScale`, `screenLayout3ds`; the row read "Screen Layout / Stacked" (kind `choice`, aria "Screen Layout, Stacked"); choosing **Side by side** committed, `gSettings.get('screenLayout3ds')` and `#g-retro.dataset.dsLayout` both read `side-by-side` while the shell was still open, and after close the top screen was at `(44, 213)` with the bottom at `(951, 213)` — the real side-by-side geometry. `.visual-review/ds-apps-eval.js` checked the 11 app icons/actions and a temporary custom collection: the folder cell opened `view: library` with `collectionFilter: custom:review-folder`; eShop gave `view: store`; System Settings opened the shell; Activity Log gave `view: library`; Sound opened the shell on `pageId: sound`. `scripts/settings-registry-test.cjs` and `scripts/pack-manager-test.cjs` still pass. **Not console-accurate:** the body is a drawn dark slab, not the 3DS shell (no hinge rings, speakers, stylus or physical buttons); the screens are the true 5:3/4:3 ratios but the device is centred in a 16:9 window rather than filling a handheld's outline; the fonts are the Wii pack's Rodin (or Segoe) rather than the 3DS system font; the clock/date and Play Coin count are the launcher's real values and an approximation (10 + library size, capped at 300), not the console's coins; the icons are drawn, because the pack has no icon files; the banner parallax is pointer-driven, not stereoscopic 3D; the title plate's wording and the Game Notes/Miiverse destinations are launcher adaptations; and Screen Layout does not restyle the separate System Settings app.

**Shared audio engine (2026-10-18, task A1).** `garrison-theme-retro.js` now exposes `window.gAudio`: one Web Audio graph for Series, One, 360, PS3, PS4, Wii and 3DS. Helix keeps the launcher's original `interfaceAudio` sounds, and a player-installed custom sound pack still wins for every theme. `gAudio.play(kind)` maps `navigate`, `category`, `confirm`, `back`, `error`, `launch`, `notify`, `achievement`, `boot` and `powerOff` (plus the aliases the launcher already uses — `startup`, `select`, `pageLeft/pageRight`, `trophy`), choosing the theme's pack recording where one exists and an original synthesised cue otherwise. Every cue and all menu music feed one **master GainNode** connected to the destination; its value is the registry's Windows `volume` percent, or 0 when `mute` is on. `g-setting-change` applies Volume and Mute live (including while the context is suspended, by setting the AudioParam's intrinsic value), and `menuMusic`/`menuMusicVolume` are now `available() === true`: the registry's `enabled` predicate only checks that `gAudio.menuMusic`/`gAudio.gameAudio` exist. `gAudio.setOutputSilenced(true)` pins the master to 0 without changing settings — that is how the hidden harness tests the graph without any sound reaching the speakers.

Menu music loops one track per theme. It fades in after the first pointer/key/controller action while the window is focused, never starts while the document is hidden or unfocused, fades out on game launch and on blur, and fades back in when the window returns. PS3, PS4 and Wii use their pack's track; Series, One, 360 and 3DS play an 8-second drawn loop built from periodic partials (so it loops without a click) unless a drop-in track exists. `docs/theme-packs.md` lists every file name. Music is independent of the interface-sounds switch: only Volume and Mute gate it. Theme switches stop the old loop and start the new one; `gAudio.themeChanged()` is called from the existing theme MutationObserver.

On `blur`/`visibilitychange` the engine stops every oscillator and buffer voice, fades and stops the music source, and suspends the AudioContext 160 ms later; on focus/visible it resumes and restarts the music where it left off. Only one-shot timers are used (the 160 ms suspend and the PS3 rest delay). Measured in the hidden harness with PS3 music playing and the master silenced: **0.72% renderer CPU focused, 0.04% blurred**, against the §0.6 budget of 2% / ~0%. The hidden eval (`EXPR_FILE` assertions in the task) checks the single master gain, live volume/mute changes, settings round-trips, a source stopped by blur and by hiding, music starting/stopping with the setting and the blur, no sources left running, and a 10-kind map for every theme.

**PS3 SND0 (2026-10-18, task A1).** `ps3GameAudio` is a new saved pref (default **off**) with the row "Game Audio (SND0)" in the XMB Sound Settings page. With it on, resting on a game in the XMB for 1.5 s asks `getGameDetails()` for the game's trailer stream, then plays that HLS stream's audio through a gain of 0.3 and the master gain, with the video element off-screen (`createMediaElementSource`; no picture). Moving off the game, leaving Home, blurring, hiding or launching cancels the wait and tears the stream down; a token guard stops a late details response from reviving audio after the player moved on. The demo library has no playable trailer streams, so the hidden harness can only verify the gate (disabled → `reason: 'disabled'`; enabled with a game that has no trailer → `no-trailer-audio`) — audible SND0 needs a real Steam/Xbox trailer on a normal run.

**One motion system (2026-10-18, tasks M1 and M2).** `garrison-theme-motion.js` now owns every console duration and every boot/launch/return sequence. Use **`window.gMotion`** only: the bare name `gMotion` in `garrison-motion.js` is that file's scroll-spring `Map`, a separate global binding, so a bare `gMotion.enter` would throw.
- **The table.** One entry per console, the single source of truth for CSS and JS: PS3 **180 ms** `cubic-bezier(.22,1,.36,1)`, PS4 **250 ms**, Wii **300 ms** springy `cubic-bezier(.2,.9,.3,1.15)`, 3DS **120 ms**, Series **200 ms**, One **200 ms**, 360 **160 ms**. `gMotion.table(id)` returns `{ duration, easing, springEase, page, enter, fast, slow, fade, boot, launch, return }`; `fast = .65×`, `slow = 1.8×`, `fade = 3.6×` the base. `gMotion.ms('page'|'fast'|'slow'|'fade')` is what JS timers read (the XMB/PS4 swap timers and the `retro-enter` removal in retro.js no longer carry hand-typed milliseconds). Helix has no table and keeps every original transition.
- **CSS variables.** On load the file writes `--m-dur`, `--m-dur-fast`, `--m-dur-slow`, `--m-dur-page`, `--m-fade`, `--m-ease`, `--m-ease-page` and `--m-spring` onto `body[data-g-theme="…"]` from that table; a fallback copy sits at the top of the appended block in `garrison-theme-retro.css`. All four retro/Xbox stylesheets now use those tokens for their interactive transitions and entrance animations (the long ambience — the 18–38 s wave/drift loops — is deliberately left alone). The per-console page animations that series/one/360 used to declare were dead (they were overridden by `garrison-themes.css`'s reduce/console rule) and are removed.
- **Page grammar.** `showView()` is wrapped: a page change places a console-coloured curtain (`#g-m-curtain`, `z-index: 8500`) that wipes away over the base duration, while the incoming `#home-view`/`#library-view`/`#game-detail-view`/`#store-view` enters with the console's grammar — PS3 **column slide**, PS4 **depth push** (scale + blur), Wii **zoom from the focused channel** (transform-origin from the pressed tile), 3DS **screen wipe** (clip-path), Series/One **crossfade**, 360 **Metro slide**. On retro themes the separate `#g-retro-chrome` (clock/hints) moves with `#home-view`, so Home travels as one picture. `gMotion.enter(el, kind)` / `.exit(el, kind)` expose the same primitives (`page`, `fade`, `slide`, `zoom`, `wipe`, `depth`, `pop`). `html.reduce-motion` skips all of it (CSS `transition-duration:.01ms` and the WAAPI guard), and a hidden document returns no animation; running animations are also paused on `visibilitychange`.
- **Boot (M2).** `runStartupSequence` is wrapped for console themes: PS3 **2700 ms** coldboot (a drawn canvas wave forming under the "PlayStation 3" wordmark), PS4 **2500 ms** "PS" splash with the `gAudio` boot chime, Wii **2750 ms** Health and Safety screen with "Press A" (any key or pad button advances) then the Wii Menu, 3DS **2200 ms** HOME Menu slide-in, Series/One/360 **2300/2300/2200 ms** branded splash (`assets/xbox.svg` + wordmark). Every one is under 4 s, any key/pointer/pad press skips it, `.g-m-booting` is the screen state, and the original OmniDash boot markup is restored afterwards (Helix still uses it untouched). Reduced motion shows a still frame and dismisses after 250 ms. A theme switch during a boot tears the old splash down immediately instead of letting its hide timer fight the new one.
- **Launch (M2).** The existing `#launch-overlay` still owns the wait; the sequence is drawn on top and the overlay stays up until the game starts, exactly as before. PS3 the icon holds **620 ms** then fades to black with the launch sound retimed to the hold (the `playUiSound` wrapper intercepts it only on PS3); PS4 the tile grows **520 ms** then fades; Wii the channel zooms to fill **540 ms** then the screen goes white; 3DS zooms **460 ms** then white **320 ms**; Series/One/360 tiles scale up then fade. `#launch-overlay[data-g-launch="…"]` and `.g-m-flash` are the hooks; animations are cancelled when the overlay hides so the next launch opens clean. `gMotion.stats.launch` counts real starts.
- **Return (M2).** A focused launcher polls `state.activeGameSession` every 2 s (no extra IPC); when the game closes, the console's own layer fades back in over the same view — PS3 wave crest, PS4 blue depth, Wii/3DS white flash, Series/One fade, 360 Metro slide — with `gAudio.play('back')`. It never re-renders and never moves focus, so the player lands where they left off. `gMotion.return()` is the test hook.
- **Verification.** Hidden captures (`THEMES=series,one,x360,ps3,ps4,wii,3ds`, `SCREENS=boot,home,press,launch`, `REVIEW_SIZE=1706,960`, 2026-10-18 13:35:27–13:36:26, `errors.json: []`): `node_modules\electron\dist\electron.exe scripts\theme-review.cjs`. Hidden eval (`EXPR_FILE=… theme-eval.cjs`, 2026-10-18 13:34) reported: the tables and CSS variables above; computed `transitionDuration` on the themed element equal to the table (`ps3 .18s`, `ps4 .25s`, `wii .3s`, `3ds .12s`, `series/one .2s`, `x360 .16s`); `html.reduce-motion` → `enter`/`exit` return `null`, `getAnimations()` is empty and a real `showView('library')` creates no animation and no curtain; a shadowed `document.hidden` does the same; a normal page change creates 2 animations plus the curtain, and the curtain is gone 450 ms later; two boot calls produce **1** start, a key skips it, Wii's key opens the Wii Menu stage; two launch calls produce **1** start with the overlay still visible; `return()` creates its layer once; `scrollWidth`/`scrollHeight` equal the viewport on all seven Hones at 1706×960. `errors.json` was `[]`.

**Console pack manager (2026-10-18, task P1).** Settings → Appearance now has a **Console packs** section. It lives in the launcher's own Settings dialog, so the same screen appears under Helix's Appearance and every console's Advanced (launcher) entry. It lists the seven pack folders the theme engines read — `ps3`, `ps4`, `wii`, `3ds`, `dashx360` (Xbox 360), and `series`/`one` (music-only drop-in slots) — from one registry in `src/support.cjs` (`PACK_REGISTRY`), never from hand-written rows. Each row shows:

- **Found / No pack files / Not installed.** "Found" means at least one file the theme can read. `*/ref/` and DashX360's `References/` are reference captures, not assets, and are skipped, so `3ds/` (which holds only `ref/` on this machine) correctly reads as no pack files.
- **Credit.** The first credit line in the pack's own `README*`/`CREDITS*`/`AUTHORS*` file (explicit "credit:" line, a GitHub repository link, a "created by" line, or the line under a Credits/Thanks heading), shown with the file it came from; otherwise the credit documented in `docs/theme-packs.md`.
- **What is inside**, counted from the files actually present: icons, fonts, sounds, music, wallpapers and video. Music is audio under a `music` folder or named `bgm`/`menu`/`all.mp3`; wallpapers are background-shaped images; other images are icons.
- **Looks for**, a short grouped list of the exact names the theme engine requests (the generated README carries the folder for each).
- **Open folder** (`theme:pack-open` → `shell.openPath`) reveals the pack. A missing pack opens its parent `theme-packs` folder (created on first use), so the player can add the folder there.
- **Add README** only when the pack root has no README. `theme:pack-readme` writes `OMNIDASH-README.md` with the credit and every exact relative path, using a create-only `wx` write, so a README the player wrote is never overwritten. Packs with an upstream README one level down (PS3/PS4/Wii) still offer it because the OmniDash guide belongs at the pack root.

The Appearance section restyles itself in `--cpx` on PS3/PS4/Wii/3DS (`calc(21 * var(--cpx))`, `calc(19 * var(--cpx))`) and stays a light card on the Wii/3DS settings screens; cards wrap instead of overflowing at both 1706×960 and 1280×720. Both IPC actions are no-ops under `NEBULA_DEMO=1`, so the hidden harness never opens Explorer or writes into a real pack folder. `scripts/pack-manager-test.cjs` checks the registry against `RETRO_PACKS`/`RETRO_MUSIC` in `main.cjs`, checks every renderer row has an action, and runs the real scan/credit/README path against a temporary folder (including the no-overwrite rule).

**Pack manager verification (2026-10-18).** `THEMES=helix SCREENS=page-g-storage,page-personalization REVIEW_SIZE=1706,960` → `errors.json: []`, 13:38:48–13:38:57. `THEMES=ps3 SCREENS=page-personalization REVIEW_SIZE=1706,960` → `[]`, 13:38:59–13:39:06. Note: the task's `SCREENS=page-g-personalization` is not a real Settings page id — it opens the dialog with every page hidden (blank "General" page), so use `page-personalization`. Scrolled pack captures at 1706×960 (Helix and PS3) and 1280×720 (Wii) show the rows. The hidden eval (`EXPR_FILE=.visual-review/pack-eval.js`, `EVAL_SIZE=1706,960`, 13:39:10–13:39:19) reported `ok: true`: 7 rows, each with `data-state` found/missing, six numeric counts, a credit and a "Looks for" list; Open folder completed through IPC on `ps3` (found) and `3ds` (missing) with no error note; Add README answered in demo mode without writing; the section fit inside the dialog at 1706×960 and 1280×720 (`scrollWidth === clientWidth`). A concurrency note for future reviews: two `theme-review.cjs` runs sharing `.visual-review/themes/profile` at once can make Electron's own `logSecurityWarnings` throw `Failed to construct 'URL': Invalid URL` into `errors.json`; the same command run alone returns `[]`.

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
| garrison-theme-motion.js | `window.gMotion` (timing tables, enter/exit, CSS tokens), page transitions, boot/launch/return sequences, theme sounds, launch splash with cover and logo |
| garrison-theme-life.js / -live.js | Screen saver, profile corner, live tiles, Gamerscore, toast animation |
| garrison-theme-store.js | Store featured banner |
| garrison-theme-backgrounds.js | Per-theme backgrounds (default, game, DashX360 pack, custom image) |
| garrison-theme-art.js | Wide-art resolver (see the art rule) |
| garrison-theme-extras.js | Accent colours, friend and download toasts, welcome back, achievements on return, controller-lost screen, Quick Resume |
| garrison-theme-keyboard.js | On-screen keyboard per console |
| garrison-settings-registry.js | `window.gSettings`: entries wrapping every real capability, per-console labels, layouts, clocks/dates (do not edit for skin work) |
| garrison-settings-shell.js | `window.gShell`: one settings model + focus/value/back grammar for all seven consoles; Series/One/360 skins and `#g-xset` |
| garrison-theme-settings.js | Launcher Settings era labels + the Appearance → Console packs manager; no console shell code |
| garrison-theme-screens.css | Keyboard, settings groups, the pack manager cards, Xbox settings shells (still used by the shell's Xbox skins), profile, achievements, search and power menu per console |
| garrison-theme-retro.js/.css | PS3 XMB, PS4, Wii, 3DS Home screens and their four settings skins (chrome only), plus their library, boot, toast and splash rules |

`src/support.cjs` owns `PACK_REGISTRY` and the pack scan/credit/README helpers (directly testable in plain node);
`src/main.cjs` serves them as `theme:packs`, `theme:pack-open` and `theme:pack-readme`; `src/preload.cjs` maps those
to `getThemePacks`, `openThemePack` and `writeThemePackReadme`.

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
5. 3DS: from `3ds/ref/home.jpg`, two light screens in a dark body (D1). Screen Layout chooses the arrangement;
   the console's own is stacked (top 400×240 over bottom 320×240, scaled 800×480 / 640×480 at 1080p). See
   "3DS: two light screens again" above for the three geometries, the icons (D2) and the verification.
   - Top: light rounded-square pattern, status bar (signal, Internet pill, Play Coins, date, time with blinking
     colon, battery), the selected software's wide banner with pointer parallax and its white title plate, and
     Camera/Y + L+R hints.
   - Bottom: toolbar (HOME settings tab, Game Notes, Friend List, Notifications, browser, Miiverse, icon-size
     buttons), a 5×3 or 4×3 rail of white cells with square covers, the light-blue corner cursor, folder cells,
     and the slider bar.
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
- Audio was verified by reading the Web Audio graph with the master gain at 0 (never by listening, because the
  owner games on this PC): pack files decode, sources are created and stopped, music starts/stops, and the CPU
  figures above were measured. **Nobody has heard the fallback loops or the SND0 trailer at normal volume yet.**
  The UI flows that would exercise the cues were reviewed as compiled code, not by ear.
- PS3 SND0 could not be played end-to-end in the hidden harness: the demo library has no trailer stream, so
  only the setting gate and the "no trailer" path are covered.
- Release 0.6.0 is drafted in `docs/release-0.6.0.md` and now lists all eight themes. It hasn't been built or published.
