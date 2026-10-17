# 0.5.1 — launcher audit pass

Five parallel audits covered the main process, the two large renderer files and their helpers, all 26
stylesheets, and the repository structure. This release fixes the confirmed defects from that audit.
Measurements are from this workstation, not handheld hardware.

## Security and robustness (main process)

- **The launcher window could be navigated away while it still held the privileged bridge.**
  `window.launcher` exposes ~130 channels including launching executables, power actions and settings
  writes, and it is bound to the window rather than the origin. The Steam sign-in and Store windows
  already blocked navigation; the main window did not, so a dropped link or any accidental navigation
  loaded a remote origin with the whole bridge attached. The main window now refuses any navigation
  that is not the bundled page, opens external `https:` links in the default browser instead of a new
  window, and refuses permission requests other than media playback, fullscreen and pointer lock.
- **Async failures in the main process were invisible.** There was no `unhandledRejection` or
  `uncaughtException` handler anywhere in the project, so one rejected promise outside an awaited
  chain ended the session with nothing in the log. Both are now reported through the existing log that
  the diagnostics report reads.
- **Twelve privileged IPC handlers accepted requests from any renderer.** The sender is now checked on
  the handlers that spawn processes, write files or change the machine: `app:power`, `app:quit`,
  `game:launch`, `game:add`, `game:custom:save`, `library:scan`, `settings:save`, `settings:reset-all`,
  `steam:native-install`, `steam:set-download-controls`, `xbox-mode:register` and `app:read-gamerpic`.
  The store view keeps its own preload, so it is unaffected.
- **Cleared credentials could come back from the backup.** Every settings save copied the previous file
  to `settings.json.bak` before replacing it, and a missing or damaged `settings.json` was read from
  that copy. "Disconnect Steam" and "Reset launcher data" therefore left the API key on disk and could
  silently restore it. Backups no longer carry keys, and the backup is removed when either key is
  cleared.

## Performance

- **A full-screen blur ran under a 14-second animation.** `.launch-vignette` had
  `backdrop-filter: blur(1.4px)` layered above `.launch-art`, which runs a 14-second scale animation, so
  the compositor re-read and re-blurred the whole viewport every frame for the entire launch screen.
  The two gradients on that element already provide the effect. This is the single largest GPU saving in
  this pass on integrated graphics.
- **Progress measurement could stall the main thread.** `measureFolderSize` queued one `fs.stat` promise
  per directory entry, so a single game folder with six figures of files flooded the thread pool in one
  turn of the event loop. It now walks in batches of 32.
- **A partial folder measurement was cached as the real size for a week.** `measureFolderSize` gives up
  at 400,000 files or 60 seconds and reports `complete: false`, but `measureInstallSizes` ignored the
  flag. A truncated total became the size shown in the library grid while Settings → Storage reported
  differently, because that path does check the flag. Incomplete measurements are no longer cached.
- **The install-size cache file was rewritten once per game.** For a large library that is quadratic
  work while measurements run (each can take up to a minute). It is written once per run, and only when
  something changed.
- **Overlapping library scans raced.** The renderer requests a scan from a dozen places, and each run
  repeated the full discovery walk and the network artwork loop; an older run finishing last could
  overwrite the newer library. Concurrent callers now share one run.
- **The gallery thumbnail strip downloaded full screenshots.** Every tile asked for the raw Steam URL,
  which is a 1920×1080 JPEG, for a row of thumbnails — hundreds of MB of decoded bitmaps for a 5–20
  image strip. The strip now uses the same 600×338 variant the detail shelf already used, and decodes
  asynchronously.
- **Typing in search rebuilt the whole result list per keystroke.** Each rebuild re-collapsed duplicate
  games across the library before replacing up to 60 cards. Input is now debounced by 140 ms, and
  lower-cased titles are cached per game object instead of re-normalising the library on every
  keystroke.
- **Held arrow keys ran an unthrottled layout scan.** Keyboard auto-repeat is roughly 30/s, and one step
  measures every focusable element in the document. Held keys now share the tightest gamepad repeat
  interval (65 ms), so key repeat and D-pad repeat behave the same.
- **Selecting a game re-queried the document twice.** Every focus change ran two whole-document
  `querySelectorAll` scans over `.game-card`. The previously selected card is now tracked, so a focus
  change patches at most two nodes.

## Settings that did not work

- **Tile corners had no effect on the tiles it names.** `body.garrison .game-card` sets
  `border-radius: var(--g-radius)` and outranks the `.game-card` rule that used `--tile-radius` from the
  slider, so the recent row and library grid stayed at ~11 px for every value. Verified now: 4 px ↔ 24 px.
- **Text size did not reach what it names.** `dashboard.css` loads after `console.css` and restates
  `font-size` for the same selectors, so headings, the library count, option buttons and the game
  description ignored the slider. `garrison.css` outranked it again for Home shelf headings with a
  three-class `font` shorthand. A new `text-scale.css`, loaded last, restores the setting with the same
  realised sizes. Verified now: 20.16 px → 26.208 px on the headings.
- **"Show hidden games" did nothing from the default Library path.** The top-bar Library button selects
  Installed, which made the hidden view's guard false, so the switch flipped with no visible result.
  Verified now: the library leaves the Installed tab and renders the hidden banner.

## Fixes

- **Focus was lost after every queue refresh.** `gRefreshQueue` tested whether the focused row was still
  in the grid *after* replacing the grid's markup, so the test could only ever be false and focus was
  never restored; navigation state pointed at a removed button. The check now happens before the
  re-render.
- **Turning on Steam download controls could fail silently for 45 seconds.** The call had no error
  handling and was reached from the click dispatcher that did not catch either, so a failure produced an
  unhandled rejection and left the "Turning on…" toast standing. It is now caught, reports the failure,
  and ignores a second press while it is running.
- **Failed actions produced dead buttons.** `performAction` is async and several branches await IPC
  without their own error handling, and the click dispatcher never caught the result. Failures now show
  the error instead of doing nothing.
- **A failed update download leaked its file handle.** A mid-download error rejected the promise without
  destroying the partial write stream, leaving an open descriptor and a `.partial` file behind.
- **The achievement cache grew without bound.** Entries hold a complete achievement list per game and
  were never evicted, unlike every other cache in the app. Bounded to 64.
- Removed dead CSS: an unused `.loading-card` shimmer (no markup or script ever created the class) and a
  `transition` shorthand on `.toast` that animated layout properties because it defaulted to
  `transition-property: all`.

## Test and review tooling

- `npm test` runs every `scripts/*-test.cjs` suite, choosing plain Node or the bundled Electron binary
  per file. `npm run test:unit` and `npm run test:electron` narrow it; `npm test -- <text>` filters.
  Thirty unit suites and the Electron suites pass.
- `npm run audit:static` checks the renderer/main boundary: duplicate DOM ids, ids referenced by script
  but absent from the markup, preload channels with no handler, handlers never exposed, and unescaped
  HTML interpolation. All clean at this revision.
- `npm run profile:startup` and the `scripts/startup-*-profile.cjs` scripts measure start-up. Cold
  start reaches first paint at ~208 ms, is interactive at ~310 ms, and reports **zero** main-thread long
  tasks over 50 ms; the load event is delayed only by remote artwork.
- `scripts/optimisation-checks-test.cjs` is a new regression test asserting each fix above against the
  real renderer.
- `remote-input-review.cjs` no longer fails for an environmental reason. It asserted that the fixture
  window held keyboard focus whenever *any* foreground window existed, which is false when another
  application is in the foreground, so it failed while a game was running. It now requires the
  foreground window to be its own and reports the skip.

## Known remaining items (not changed in this pass, each needs a product decision)

- **Controller Y is documented as Search but the code binds search to X.** `README.md` says Y, the
  in-app hint bar says X (`index.html`), and `app.js` handles X. One of the three must change.
- **Home's Steam-chart and category shelves are unreachable.** `garrison.js` replaces
  `renderHomeCollections` without capturing the original, so `app.js`'s version and
  `renderCollectionBands` never run, and those containers are hidden. Re-enabling them restores a
  feature that has been off, so it is a design decision rather than a fix.
- **The PC Gamerscore calculator dialog is unreachable.** `pc-gamerscore.js` and `garrison.js` both
  assign `.onclick` to the same button; `garrison.js` loads later and wins. Either the console
  calculator should be wired up, or the dialog and its ~20 lines should be deleted.
- **`README.md` still describes two Settings paths that do not exist** (a "Manage games → Artwork" tab
  and "Audio & Video") and a grid/list layout toggle that was never implemented.
