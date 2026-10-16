# 0.5.0

This release reduces background work, preserves navigation during updates, and brings the support links and Windows integration up to date.

- Unchanged friends shelves retain their existing cards, decoded artwork, scroll position and controller focus. Hidden shelves wait until Home opens before updating. Steam ownership is indexed once per shelf instead of searching the entire library for every friend.
- Keyboard/touch sessions check for controllers four times per second instead of every display frame. Connecting a controller immediately restores per-frame polling; background windows stop polling.
- Moving focus updates the previous and next control directly, avoiding a whole-document search on every movement.
- Leaving a game page invalidates its pending UI work, so late details, achievements, news and add-ons cannot redraw that hidden page. Metadata remains cached for your next visit.
- Screenshot history and news caches have bounded working sets. Artwork prefetch skips gallery downloads when you have moved to another game, repairs legacy Steam trailer previews, and allows offline fallbacks to retry sooner.
- Overlapping Steam status refreshes share a request rather than repeating disk/IPC work when focus and visibility events arrive together.
- **Give feedback**, **Request a feature** and **Get help** all lead to this project's GitHub. The old setup link and DashX reference are removed. The Xbox mode guide now describes the bundled home-app bridge.
- The Xbox button now uses a bundled native Windows helper with application activation, a Win+G fallback, duplicate-click protection and visible-overlay checks. Errors are shown instead of silently claiming success. **Settings → Input → Windows Game Bar settings** opens Windows' configuration.

## Measurements and validation

In the same isolated 1,500-game/60-friend fixture at 1280 × 800, the median unchanged friends refresh dropped from **8.0 ms to 0.3 ms** over nine warm calls. Idle controller polling fell from **65 to 4 checks** over 1.1 seconds. These are local synthetic measurements, not handheld frame-rate claims.

Verified Home and Store controller navigation, focus preservation, deferred friends updates, stale game-page responses, cache bounds, Steam status request sharing, support destinations, regional metadata and trailer regressions. Packaged source/runtime hashes and Home/Library/game-page smoke captures are checked before publication.

**Game Bar verification remains incomplete:** the native helper and IPC/error paths pass automated checks, but live tests on the development PC did not confirm a visible overlay; the latest attempt had no interactive foreground window. Please retest the Xbox button on an active desktop or handheld. No Game Bar settings, Windows policies or installed packages were changed.

Updates from **0.4.0** are automatic. If you still use **0.27.0-beta**, install a current release manually once because the old updater treats that number as higher than the new series.
