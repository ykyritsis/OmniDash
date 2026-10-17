# Next level: console parity review and plan

Written 2026-10-18 by Claude after reviewing branch `console-themes` at `d869684`, for DeepSeek to carry out
task by task. Read this file and `docs/HANDOVER-themes.md` before starting any task. HANDOVER covers how the
code works and the house rules; this file covers what to build next and why.

The owner's brief, in their words:
- "All the settings that we CAN actually adjust/edit, SHOULD WORK."
- The 3DS "has drifted too far from original 3DS and icons".
- The PS3 is "too small" and "missing background effects".
- "They all just feel stale at the moment, really missing stuff."
- Rename the launcher and redo the GitHub so it presents as a multi-theme launcher.

---

## 0. Rules that apply to every task

1. **The owner games on this PC.**
   - Never open a visible window, never take focus, never play sound.
   - Review only with the hidden harnesses (`scripts/theme-review.cjs`, `scripts/theme-eval.cjs`).
   - Never touch the installed app while `Xbox Preview UI.exe` runs.
   - Kill only processes whose path matches `*xbox mode 2*node_modules*`.
2. **One task, one commit.** Use `git --git-dir=.git-work --work-tree=.` on branch `console-themes`.
   - Push after each task.
   - Install the build with `scripts/install-test-build.cjs` when the launcher isn't running.
   - Update `docs/HANDOVER-themes.md` when you change how something works.
3. **No console assets in the repo or in releases.**
   - Sony, Nintendo and Microsoft icons, fonts, sounds and music live only in `%APPDATA%\xbox-preview-ui\theme-packs\`.
   - The app must look complete without them, using drawn fallbacks.
4. **Measure, don't eyeball.** Every layout number comes from a reference frame at 1080p (see §6).
   - Put the measurements in a comment next to the CSS that uses them.
   - Compare a hidden capture against the reference side by side before you call a task done.
5. **No decorative controls.** Never add a row, button or toggle that doesn't do something.
   - If the launcher can't back a console option, leave it out, or show it as read-only real information.
6. **Performance.** Every animation, canvas, WebGL or audio loop pauses when the window is hidden or unfocused.
   - The owner leaves the launcher open while gaming.
   - Budget: under 2% CPU when idle and focused, about 0% when unfocused.

---

## 1. Review: where each theme stands

These scores rate how close each theme is to its real console, out of 10. They come from fresh captures of
every theme's Home and Settings (hidden window, 1920×1080, 2026-10-18).

| Theme | Home | Settings | Motion | Sound | Biggest problems |
|---|---|---|---|---|---|
| Helix | n/a | n/a | n/a | n/a | Intentionally the modern PC look. Leave it alone. |
| Series X\|S | 7 | 3 | 5 | 4 | Settings is the launcher's list with a fake console block on top. No dynamic backgrounds, no Guide. |
| One (2013) | 6 | 3 | 4 | 4 | Pins wall starts off-screen. A demo import overlay stays stuck over Home. Settings are fake. |
| 360 Metro | 7 | 3 | 5 | 6 (pack) | The band and hubs work. Settings are fake. No avatar. The boot video only plays when focused. |
| PS3 XMB | 5 | 2 | 4 | 5 (pack) | Too small for a TV. Game icons are squares when they should be wide ICON0. The wave is buried under the PIC1 tint. No Options or Information panel. Settings aren't in the XMB. |
| PS4 | 6 | 2 | 4 | 4 (pack) | Close to the reference layout. No theme particles, no home music, no Quick Menu, no trophy pop-up. Settings are fake. |
| Wii | 6 | 2 | 3 | 4 (pack) | The pass is unfinished. Channels don't animate, there's no Wii Menu music, no Health and Safety boot, no HOME Menu overlay. Settings are fake. |
| 3DS | 2 | 2 | 2 | 2 | Rebuilt as a dark "iiSU-style" single screen, which isn't a 3DS. The icons are generic. It has to be redone (see §3.4). |

### 1.1 Settings are the biggest single gap

`garrison-theme-settings.js` adds one block per page with 297 rows. They're `aria-hidden`, `pointer-events: none`
and hard-coded: "HDMI", "Dolby Digital", "4.90", "12.4 GB Free", "Mint" and so on. The real controls sit underneath
in the launcher's own Garrison list. On every console, two lists show at once, and the console one is fake. That's
the "settings don't do stuff" complaint.

**What the launcher can actually change today** is the only set that console settings may expose:

| Capability | Where it lives |
|---|---|
| Master volume, mute | `launcher.setQuickSetting('volume' \| 'mute', v)` (quick-settings.cjs, Core Audio) |
| Screen brightness (laptops and handhelds) | `setQuickSetting('brightness', v)` (WMI; absent on desktops, so hide it) |
| Windows power plan | `setQuickSetting('plan', guid)` |
| UI scale, text size, tile radius, reduced motion, high-contrast focus | settings.json via `saveSettings` (#ui-scale, #text-size, #tile-radius, #reduced-motion-toggle, #high-contrast-focus-toggle) |
| Interface sounds on/off | `soundEffects` (#sound-toggle) |
| Fullscreen, start with Windows | #fullscreen-toggle, #startup-toggle |
| Controller vibration, pause downloads while playing | `setPref('controllerVibration' \| 'pauseDownloadsWhilePlaying', bool)` |
| Theme, accent colour, background | `setPref('theme')`, `g-accent:<theme>`, `g-bg:<theme>` (garrison-theme-extras/backgrounds) |
| Show uninstalled Steam and Epic games, screenshot backgrounds | #show-uninstalled-toggle, #show-uninstalled-epic-toggle, #shuffle-home-screenshots-toggle, #random-screenshot-background-toggle |
| Profile name, gamerpic, Steam/Epic/SteamGridDB accounts | profile dialog, #steam-api-key, #steam-id64, #legendary-path, #sgdb-key |
| Updates, diagnostics, backup and restore, reset | g-update-check, g-support-export/import, reset-launcher-data |
| Controller status | controller-status |
| Real read-only facts | Wi-Fi/battery (quick:get), app version, free disk space, library counts, friends online |

**New settings worth adding, because the consoles had them and they're cheap to honour everywhere:**
- Clock format: 12h or 24h, and date order. Every console clock reads them.
- Enter button: ✕ or ○ on PlayStation, which swaps confirm and back. Nintendo layout swaps A and B, since
  Nintendo's A sits where Xbox's B is. A real PS4 setting, so this one counts.
- Menu music on/off and volume, for the Wii, PS4 and 3DS theme music from packs.
- Screen saver delay. `gThemeSaver` exists; give it a timeout.
- Notification toggles for friends online, downloads and achievements. These are toasts already in garrison-theme-extras.
- 3DS screen layout: stacked, side by side, or large top screen (see §3.4).
- PS3 theme colour: by month, or a fixed colour; and background: wave, PIC1 or custom.

---

## 2. Systems to build first (shared by all themes)

### 2.1 Settings registry (task S1)

Build one source of truth, `src/renderer/garrison-settings-registry.js`, exposing `window.gSettings`. Every entry:

```js
{ id: 'volume', kind: 'slider' | 'toggle' | 'choice' | 'action' | 'info', min, max, step, options: [{ value, label }],
  get: async () => value, set: async value => {}, available: async () => bool, label: { default, ps3, ps4, wii, '3ds', series, one, x360 } }
```

- Wrap the existing controls listed in §1.1. Never duplicate their logic: call the same IPC, or set the same
  input's value and dispatch `input`/`change`.
- Fire a `g-setting-change` event so open console screens refresh.
- Each console then defines only a layout: the console's own page and row order, each row naming a registry `id`
  plus that console's wording.
- **Delete the decorative `CONSOLES` blocks** in garrison-theme-settings.js once every page is backed by the registry.
- Test it in `scripts/settings-registry-test.cjs` (node mode): every `id` in every console layout exists in the
  registry, and no console layout row lacks an `id`.

### 2.2 Console-native settings shells (tasks S2 to S5)

Each console's settings should be its own full-screen screen, not the Garrison dialog with a different sidebar.
Rows render from the registry:
- **PS3:** settings are XMB items. Selecting "Display Settings" slides the column left and opens a sub-list.
  Selecting a row opens the XMB's right-hand option pop-up (a translucent black panel listing values; ✕ to set,
  ○ to cancel). Sliders become the PS3's horizontal bar dialog.
- **PS4:** a full-screen list with icons on the left and a blue focus bar. Rows go deeper with a slide. Toggles
  are check boxes. Values open the PS4 option dialog.
- **Wii:** "Wii Settings" pages 1–3 with large rounded pill buttons, blue page arrows, and the Wii sound per press.
  A value opens a sub-screen with pill choices and "Back" / "Confirm" at the bottom.
- **3DS:** the System Settings app. Bottom screen with large white buttons (Internet Settings, Parental Controls,
  Data Management, Other Settings), and the top screen describing the focused option.
- **Series / One / 360:** Series and One keep the Garrison-style list with real era labels. The 360 uses the
  blade-free Metro "System Settings" list on the light grey panel.

Keep the launcher's own dialog for Helix, and as an "Advanced (launcher)" entry at the bottom of every console
shell, so nothing becomes unreachable.

### 2.3 Audio engine (task A1)

Extend the `play()` in garrison-theme-retro.js into a shared `window.gAudio` used by every theme:
- Per-theme sound maps covering navigate, category/page, confirm, back, error, launch, notify, trophy/achievement,
  boot, and power-off.
- Menu background music (BGM): a looping track per theme from its pack. It fades out on game launch and when the
  window blurs, and fades back in on return. It honours the new music setting and starts only after the first
  input when focused, never while hidden.
- The PS3 SND0 equivalent: after 1.5 s on a game, play the game's trailer audio quietly. The app already has HLS
  trailers through hls.js; mute the video and route the audio at 30%. Off by default; behind a setting.
- Every sound goes through one gain node, scaled by an "Interface volume" registry slider.

### 2.4 Motion system (task M1)

- One easing and timing table per console: XMB 180 ms ease-out slides, PS4 250 ms, Wii 300 ms springy zoom,
  3DS 120 ms snappy. Put it in garrison-theme-motion.js. No ad-hoc transitions.
- Page enter and exit transitions per console: XMB column slide, PS4 depth push, Wii zoom-from-channel,
  3DS screen wipe.
- **Launch, return and boot sequences** per console (task M2):
  - PS3: the coldboot wave forming, then the XMB. Launch: the icon holds, the screen fades to black, then the launch sound.
  - PS4: the "PS" splash with the boot chime, then the user-select tile.
  - Wii: the Health and Safety screen ("Press A"), then the Wii Menu with music. Launch: the channel zooms to its
    preview, then Start, then fade to white.
  - 3DS: the HOME Menu slides in. Launch: the icon zooms to fill, then fade to white.

### 2.5 Button glyphs and layout (task G1)

Hint bars, the keyboard and dialogs must show each console's glyphs:
- PlayStation: ✕ ○ △ □, L1, R1, OPTIONS.
- Nintendo: A B X Y, + −, HOME.
- Xbox: A B X Y, LB, RB, View, Menu.

Apply the Enter-button and Nintendo-layout settings from §1.1 in the input layer, so the physical button
feels right per console.

### 2.6 Pack manager (task P1)

Settings → Appearance → "Console packs" lists each pack folder:
- Whether it's found, its credit line, and what it adds (icons, fonts, sounds, music).
- An "Open folder" button.
- Expected file names, plus a short readme per pack written to the folder.

This replaces knowing paths by heart, and it's needed for public users after the rename (§4).

---

## 3. Per-console parity specs

### 3.1 PS3 XMB (tasks X1 to X5)

The owner says "too small" and "missing background effects". Both are right. The ICON0 point below is the main
cause.

- **Scale (X1).** Lay out from a real **1080p** XMB frame, not the 421 px Wikipedia thumbnail (see §6).
  - PS3 game icons are **ICON0, 320×176 (wide)**. At 1080p the selected one is about 1.4× that, roughly 440×242,
    and unselected ones are smaller. The handover's rule "XMB item icons are square slots" is **wrong for games**.
  - Use `data-g-wide-art`. Fall back to a cover centred on a blurred strip of the same 320:176 box.
  - Category icons and labels, item titles (about 40 px) and the info line (last played, size) all scale from
    the 1080p frame.
- **Wave (X2).**
  - Replace the canvas ribbons with a WebGL fragment shader: several translucent sine sheets with a bright crest,
    a soft glow, slow drift, and twinkling particles over the month colour gradient. Darken it with the time of day.
  - Licence: Shadertoy shaders default to CC BY-NC-SA. Write our own, or use an MIT source such as
    [fchavonet's XMB wave](https://raw.githubusercontent.com/fchavonet/creative_coding-xmb_wave_background/main/README.md).
  - When PIC1 shows, crossfade it in **over** the wave at full strength, as the PS3 does: the wave hides, and
    there's no purple wash over the art.
  - When the selection moves off the game, PIC1 fades out and the wave returns.
- **Panels (X3).**
  - △ opens the right-side Options panel: Delete, Information, Start, Add to Favourites. Map these to real
    actions: game options, details, launch, favourite.
  - Information shows the game's size, last played and play time.
  - Turn Off System gets the real dialog.
- **Settings in the XMB (X4).** See §2.2.
- **Feel (X5).**
  - Hold a direction to repeat with acceleration.
  - Bounce at the column ends.
  - Category labels fade, and the clock box shows a mail icon when there are notifications.
  - Notifications come from the top right with an icon.
  - A trophy unlock plays the pack's `unlock.ogg`.

### 3.2 PS4 (tasks Y1 to Y3)

- **Theme (Y1).** The default blue theme's particles: soft bokeh and light streaks drifting slowly. The selected
  game's background art crossfades in, as it does now. Home BGM comes from the pack.
- **Overlays (Y2).**
  - Quick Menu: hold the guide or Menu key for a left-side panel with Sound/Devices, Power and Notifications, all
    from the registry.
  - The trophy pop-up sits at the top left (icon, "You've earned a trophy", name) with `reward.mp3`.
  - Notifications are a top-left blue-black box with a slide.
- **Boot and user select (Y3).** The PS logo, then "Press the PS button to use the controller", then a user tile
  with the gamerpic.

### 3.3 Wii (tasks W1 to W4)

DeepSeek's Wii pass is unfinished. Finish it first, then:
- **Channels (W1).**
  - Each channel loops a gentle banner animation: Ken Burns pan on wide art, a spinning disc on the Disc Channel,
    Miis walking on the Mii Channel, weather moving on Forecast.
  - Hover gives a slight scale, the glow frame and the pack's hover sound. Pages slide with the "zip" sound.
- **Music and boot (W2).**
  - The Wii Menu BGM loops from the pack. It ducks on the channel preview, which plays a short banner jingle.
  - The Health and Safety warning shows at start-up, then "Press A", then the startup sound.
- **HOME Menu overlay (W3).** On the guide or Home key, a dark overlay slides down with "Wii Menu" and "Reset",
  plus the bottom Wii Remote panel with battery bars, Volume and Rumble. Volume and Rumble are real registry
  settings (volume and controller vibration).
- **Settings (W4).** See §2.2: Wii Settings pages with pills, and the Wii Message Board for notifications, laid
  out as a calendar.

### 3.4 3DS (tasks D1 to D4): redo

The single dark screen has to go. A 3DS is two light screens.
- **Layout (D1).** A 3DS screen-layout setting:
  - **Stacked** (the default): the top screen over the bottom, as on the console, centred on a dark device
    surround that fills the height.
  - **Side by side.**
  - **Large top** (Citra-style): a big top screen with a small bottom one at the corner.
- **Top screen.** It's not decoration.
  - The status bar: signal, the "Internet" pill, Play Coins, date, time with a blinking colon, battery.
  - The default theme's light pattern, the selected software's banner (wide art with a parallax "3D" depth
    effect), and its white title plate.
  - Camera / Y and L+R hints along the bottom.
- **Bottom screen.**
  - Toolbar: settings tab, Game Notes, Friend List, Notifications, Internet Browser, Miiverse, and the
    icon-size buttons.
  - Grid of 48 px white rounded icon cells with square covers, the pulsing light-blue corner cursor, folders,
    the slider bar, and the zoom levels from the icon-size buttons.
- **Icons (D2).** Real system app icons from a pack (§6): Health and Safety, Camera, Sound, Mii Maker, StreetPass
  Mii Plaza, eShop, System Settings, Download Play, Activity Log, Notifications, Friend List and so on. Today's
  drawn SVGs are the fallback.
- **Themes (D3).** The 3DS HOME Menu themes: basic colours (white, black, pink, light blue, yellow and so on)
  picked from the registry. Optional theme BGM from the pack.
- **Feel (D4).** The 3DS click sounds per move. Opening an app zooms its icon. Suspend shows "Close" / "Resume".

### 3.5 Xbox themes (tasks B1 to B3)

- **Series.** Dynamic backgrounds (slow parallax art, or the animated Series backgrounds as a pack option),
  real Series sounds from a pack, the Guide panel (registry-backed volume, notifications, power), and Quick
  Resume tags on tiles.
- **One.**
  - Fix the Pins wall starting off-screen, and the weak focus ring on bright art.
  - Fix the stuck "Importing your library" overlay; in demo mode it needs `library:initial` to close it.
  - Add the 2013 snap-style transitions and sounds.
- **360.** Make the boot video and sounds respect the music and sound settings. Add the 360 Guide (blades-free
  2011 Guide) with registry-backed settings. Avatars stay gamerpic-only unless a pack supplies more.

---

## 4. Rename and GitHub relaunch (tasks R1 to R3)

The app is now a multi-console, multi-theme launcher for PC. The name "Xbox Preview UI" and the repo
"xbox-cloud-preview-on-pc" no longer fit. Keep platform trademarks out of the product name; say "inspired by"
in the description.

**Name: chosen. The product is now OmniDash.** The owner picked it on 2026-10-18, so R1 to R3 are
unblocked. Before the public rename, check it against existing apps on GitHub, Steam and the Microsoft Store
(there may be an unrelated "OmniDash" — if so, keep the name but make the repo description and the app's
first-run text distinct, e.g. "OmniDash — a multi-theme PC game launcher").

| Name | Why |
|---|---|
| **OmniDash** (chosen) | Short, says "every dashboard". No platform trademark. |
| Console Shell | Plain and descriptive. Pairs with "Xbox mode" or shell-replacement features. |
| Couchside | Living-room feel. Neutral. |
| Homescreen | Simple; may be hard to search for. |
| RetroDash | Fits the retro themes but undersells the Series and One looks. |

Check each against existing apps on GitHub, Steam and the Microsoft Store before deciding.

**R1: rename the app** (after the owner picks):
- `package.json` `productName`, window title, splash, About and the tray name.
- The installer's display name and Start menu shortcut.
- `build/` icons: a new mark that isn't the Xbox sphere.
- **Keep the old IDs where changing them breaks things:**
  - Keep the `appId`, or the installer treats it as a new app.
  - Keep the `%APPDATA%\xbox-preview-ui` folder, or migrate it on first run. It holds the settings, caches and
    theme packs.
  - Keep `NEBULA_*` environment names.
- Add a one-time "now called X" toast.

**R2: rename the GitHub repo**, for example `ykyritsis/omnidash`. GitHub redirects the old URL, but:
- Update the updater's release URL in `src/updater.cjs` to the new name.
- Make sure the shipped build still finds releases through the redirect.
- Test with the beta-18 updater flow described in the memory notes.

**R3: rewrite the README and repo page:**
- Hero GIF of switching themes (from the hidden harness), with one screenshot per theme.
- "What it does": a library across Steam, Epic, GOG, Amazon, Xbox and custom games; launching; downloads;
  achievements; friends.
- "Themes": Helix, Series, One, 360, PS3, PS4, Wii, 3DS.
- "Console packs": what they add, and that users supply them (§2.6).
- Install, update, controls, privacy, FAQ.
- Topics: game-launcher, electron, big-picture, couch-gaming, controller, steam, windows.
- Release `0.6.0` (or `1.0.0` with the new name) with notes from `docs/release-0.6.0.md`.

---

## 5. Order of work, with prompts for DeepSeek

Do the tasks in this order. Each block is a self-contained prompt; paste it into DeepSeek as is. Each ends with
the same finish routine:

> **Finish routine:** run the hidden review for the affected themes and screens, compare with the reference
> frames, commit with a clear message, push, install (if the launcher is closed), and update
> `docs/HANDOVER-themes.md`.

**Phase 1: make settings real** (the owner's first complaint)
1. **S1, registry.** "Read docs/NEXT-LEVEL-PLAN.md §1.1 and §2.1. Build `src/renderer/garrison-settings-registry.js`
   (`window.gSettings`) wrapping every capability in the §1.1 table, plus the new settings listed there. Load it
   before garrison-theme-settings.js in index.html. Add `scripts/settings-registry-test.cjs`. No UI yet."
2. **S2, PS3 settings in the XMB.** "Read §2.2 and §3.1. Make the XMB Settings column open real sub-lists and the
   right-hand option pop-up, driven by `gSettings`. Every row must change something real. Verify with the
   theme-review steps `home,navL…,press` and with `theme-eval` reading the setting back."
3. **S3, PS4, Wii and 3DS settings shells.** Same pattern; one commit per console.
4. **S4, Xbox era settings.** Back the Series, One and 360 lists with the registry.
5. **S5, delete the decorative blocks.** Remove the `CONSOLES` rows from garrison-theme-settings.js and their CSS.
   Add a test that fails if any settings row lacks a registry id.

**Phase 2: fix the drift**

6. **D1 and D2, 3DS redo.** "Read §3.4. Rebuild the 3DS as two light screens with the screen-layout setting. Use
   `3ds/ref/home.jpg` and the reference frames from §6. Remove the iiSU-style screen."
7. **X1 and X2, PS3 scale and wave.** "Read §3.1. Measure from a 1080p XMB frame. Make game icons wide ICON0.
   Write the WebGL wave with pause-on-blur. Make PIC1 replace the wave."
8. **Wii finish.** Finish the bar and clock against `wii/ref/menu.png`, then W1.

**Phase 3: make it feel alive**

9. **A1, audio engine with BGM.**
10. **M1 and M2, motion tables and boot, launch and return sequences.**
11. **G1, button glyphs and layout.**
12. **X3, Y2 and W3, console overlays:** the PS3 Options panel, the PS4 Quick Menu, the Wii HOME Menu.
13. **Y1, Y3, W2, D3, D4, X5 and B1–B3:** the remaining per-console polish.

**Phase 4: relaunch**

14. **P1, pack manager.**
15. **R1, R2 and R3, rename and GitHub,** only after the owner picks a name.
16. A full 720p/1080p/4K sweep of all eight themes. Then cut the release.

---

## 6. References and assets

**Reference frames (1080p) for measuring.**
- The `*/ref/` screenshots are small (421 px). Use them only for proportions.
- Get 1080p frames from YouTube captures of each dashboard: "PS3 XMB 4.90 1080p", "PS4 home screen 2013 1080p",
  "Wii Menu 4.3 HD capture", "3DS HOME Menu direct capture".
- Pull frames without playing video, using YouTube storyboard sprites (the method used before for the Xbox app):
  1. Read the watch page's `playerStoryboardSpecRenderer` spec.
  2. Build the L2/L3 sheet URLs from it.
  3. Crop the frames.
- Save the frames to `theme-packs/<console>/ref/`, never to the repo.

**Asset sources** (personal use; packs only, never the repo). Some sites block scripted downloads (HTTP 403), so
the owner may need to download from a browser and drop the files into the pack folder.
- **Sounds and music:**
  - [The Sounds Resource](https://sounds.spriters-resource.com/): Wii Menu, 3DS HOME Menu and PS3 system sound
    sections. It's the source Mario Wiki credits for its
    [3DS HOME Menu clips](https://www.mariowiki.com/File:LM3DS_Home_Menu_Banner_Jingle.wav).
- **Icons and textures:**
  - [The Spriters Resource](https://www.spriters-resource.com/): system menus.
  - The [Dolphin Wii Menu 4K texture pack](https://forums.dolphin-emu.org/Thread-wii-menu-4k-texture-pack) and
    the [HD Wii Menu texture pack](https://forums.dolphin-emu.org/Thread-hd-wii-menu-texture-pack): channel
    frames, layout and fonts, at high resolution.
  - [MenuDump](https://github.com/Arch9SK7/MenuDump) for 3DS menu assets, if the owner has a 3DS.
- **Already installed packs:** see HANDOVER, "Theme packs".
- **The PS3 coldboot** is a logo plus an orchestral sound of about 8 s ([ConsoleMods: PS3 coldboots](https://consolemods.org/wiki/PS3:Coldboots)).
  Drawn fallback: the wave forming, then "PlayStation 3" in the XMB font.
- **3DS HOME Menu themes** change the BGM, sound effects and background, per
  [Nintendo's theme page](https://www.nintendo.co.uk/Nintendo-3DS-Family/Download-Content/HOME-Menu-Themes/HOME-Menu-Themes-923157.html).
  That's the model for D3.
- **Wave shaders:** [Godot "Playstation Waves"](https://godotshaders.com/shader/playstation-waves/) is a port of
  a Shadertoy shader (CC BY-NC-SA unless stated), so use it as a reference only. Base our own on an MIT source.
