# Beta 38

Large libraries refresh faster. Home and Library now update their own visible page; the other page catches up when opened. Extra Library card pages are released when moving to Home or Store, while opening a game's details preserves the selected card and position for Back. The current Home no longer builds hidden legacy shortcut cards or loads their hero images.

Preferred-copy grouping is reused until a relevant game or preference changes. Installs, title edits, launcher changes and per-game overrides invalidate it immediately. Play history is read once instead of accessing and parsing browser storage repeatedly during sorting; launches and changes from another window update the cached history.

Local artwork updates replace only changed artwork, including collection cards and the **My games** collage. Buttons, row positions, controller focus and unchanged decoded images remain in place. Already-cached covers no longer send redundant artwork notifications or rewrite their settings. Changed downloads are sent in batches and only changed entries are saved. Controller-support metadata still updates the appropriate Home collections.

Measured in the real renderer on this development PC at 1280 × 800, using 1,500 synthetic games across two launchers and preferred-copy mode. Each figure is the median of nine warm samples of synchronous renderer work; these are fixture measurements, not handheld frame-rate or game-launch claims.

| Operation | Beta 37 | Beta 38 |
| --- | ---: | ---: |
| Home library refresh | 32.0 ms | 14.3 ms |
| Library refresh | 29.0 ms | 10.0 ms |
| 100 preferred-library lookups | 151.1 ms | 2.0 ms |

Regression checks cover cached startup and background refresh, deferred page updates, deep-library Back navigation, local/remote artwork, controller focus, duplicate selection after changes, play-history storage, remote controls, installation sizes and Storage. The startup fixture now uses an expired snapshot to exercise the existing delayed background-refresh policy. No live host pairing or real game launch was performed.

Includes the white focus glow and corrected Australian MA15+ badge from [beta 37](release-0.27.0-beta.37.md). Automatic stream completion still depends on the host tracking the game process; see [host game tracking](host-game-tracking.md).
