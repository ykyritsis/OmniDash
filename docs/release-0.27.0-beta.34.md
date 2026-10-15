# Beta 34

Remote games now have **Disconnect** and **Return to stream** on their active game page. **LB + RB + View** (hold half a second) or **Ctrl + Alt + Shift + H** switches between that page and the stream. Returning reuses the same connection.

- Disconnect directly with **LB + RB + A** or **Ctrl + Alt + Shift + Q**. The native escape path stays available during reconnects and focus failures. **Stream settings → Shortcuts** lets you record separate controller and keyboard combinations for Disconnect and Game page, with button glyphs, conflict checks and Restore defaults. Existing Moonlight four-button bindings are migrated. Shortcuts follow physical buttons regardless of gameplay face-button swaps.
- The initial stream bar still hides after five seconds. Its **Game page**, **Disconnect** and **Hide** actions work with mouse and touch while visible.
- Disconnect waits for the native player to exit. An unresponsive bridge is terminated through its process lifetime guard after 1.5 seconds. Disconnect leaves the host game open for resuming.
- Corrected the native window arrangement: the video surface is owned by the app and follows its client area, while retaining the foreground focus SDL needs. Controller background forwarding is disabled so navigating the game page does not also control the host game.

**Stream settings are shared across all games and remote PCs on this device.** Choose **Lowest Latency**, **Balanced** or **Max Visuals**, then your resolution, frame rate and HDR preference. The preset calculates bitrate and selects automatic codec/decoding, V-Sync and frame pacing. Bitrate adjusts when resolution, FPS or HDR changes. Manual bitrate or video overrides switch to **Custom**; choosing a preset restores automatic tuning. Advanced video, input, audio and statistics controls remain available. The basic controls fit on a 1024×640 handheld at normal text size.

Removed named profiles and per-game overrides. The most recently seen PC's selected settings are migrated once; old game overrides are discarded. Settings saved from any game page now apply everywhere. Custom values and **Use this display** remain available.

Australian classifications now use **G**, **PG**, **M**, **MA15+** and **R18+**, with correctly sized badges. Fixed overly broad label matching, inconsistent store age-gate values, arbitrary foreign-board fallbacks and untranslated consumer advice. Local ratings are preferred, supported fallback boards are labelled, and missing classifications remain unavailable instead of being inferred from another country's board. Rating caches refresh after the update.

Validated stream lifecycle and forced cleanup, shared settings migration, automatic bitrate, native window ownership/recreation, page/stream switching, custom shortcut dispatch and hold timing, bundled SDL controller shortcut reading/hotplug, bundled-engine launch against a local TLS fixture, classification normalization, and UI/storage/Home navigation at desktop and handheld sizes with enlarged text. The isolated test desktop cannot supply an interactive Windows foreground; physical controller/keyboard focus and real gameplay still need handheld verification. No live host pairing or real game was performed, as requested.

See [remote play controls](remote-play.md) and the [StreamLight parity audit](streamlight-parity.md).
