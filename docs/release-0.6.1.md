# OmniDash 0.6.1

The first release under the OmniDash name on [github.com/ykyritsis/OmniDash](https://github.com/ykyritsis/OmniDash). It adds one-click console packs, the 2025 Xbox Series home, settings that are real in every theme, and a long polish and bug-fix pass.

## New

- **One-click console packs.** Settings → Appearance → Console packs now has **Install** for PlayStation 3, PlayStation 4, Wii and Xbox 360.
  - Each pack downloads from its original public project, straight into your pack folder. The source and licence are shown first.
  - The theme reloads with the real icons, fonts, sounds and music.
  - OmniDash never hosts or ships these files. Every theme is still complete without them.
- **Xbox Series home, 2025 dashboard.** Profile corner, the five round buttons (My games, Store, Game Pass, Search, Settings), a battery when you have one and the console's clock, and the low row of square tiles. The selected game grows and is titled over its art, on full-screen key art.
  - Steam's 3840-wide key art is used, so the background stays sharp on 1440p and 4K screens.
- **Settings that do something, in every theme.** Each console's Settings screen is built from one registry of real options: volume, brightness, power plan, screen and text size, sounds and menu music, the clock format, the screen saver, notifications, the enter button, Nintendo button layout, vibration, theme, packs, accounts and updates. The decorative rows are gone.
- **PlayStation 5 theme** (first version): the games row, activity cards and Control Center.
- **3DS redone as the console's two light screens.** Stacked, side by side or large top screen; HOME Menu toolbar, icon grid and system icons.
- **One audio engine with menu music**, and **one motion system** with each console's boot, launch and return sequences.
- **Console button glyphs.** ✕ ○ △ □ on PlayStation and A B X Y on Nintendo and Xbox, in every prompt.

## Fixed

- **PS5:** the library layout (counts, storage ring, a duplicate toolbar).
- **Xbox 360:** hints no longer cover the game page.
- **Positions and overlaps:**
  - PS3 and PS4 notifications are back in their corners; the PS4 one was off the screen.
  - PS3 settings in the XMB no longer overlap the category icons or their own pop-up.
  - The game options menu opens beside the selected game in every theme.
  - Xbox boot screens are centred.
- **Light themes:** the Wii and 3DS Store and launch screens are readable.
- **Slow launches:** the console flash on launch lifts after a moment, so a slow PC launch shows its status and Cancel instead of a blank screen.
- **Series:**
  - Pressing Up from the row lands on the first top-bar button.
  - Icons show one label.
  - The gamerpic fills its circle.
  - The row is centred when it's short.
- **Main-process hardening and performance** from the 0.5.1 audit:
  - navigation and permission guards;
  - sender checks on privileged requests;
  - crash reporting;
  - faster search, scans and storage measurement.

## Performance

- Close to 0% CPU while a game is in front. Animations pause when OmniDash isn't focused.
- The Wii channel drift and other continuous effects run on the compositor instead of repainting every frame.
- The 3DS controller poll only runs with that theme, a focused window and a connected pad.

## Updating

The built-in updater installs this over 0.6.0. The repository was renamed: old links and update checks follow GitHub's redirect, and new builds use the new name. Your settings, library caches and packs stay in `%APPDATA%\xbox-preview-ui`.

`SHA256SUMS.txt` is attached for verifying the downloads. Builds aren't code-signed, so SmartScreen may warn on first run: choose **More info → Run anyway**.
