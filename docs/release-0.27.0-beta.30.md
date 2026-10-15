# Beta 30

Remote play now lives in the normal Library and game-page flow, with discovery and a corrected bundled-engine launch path.

- **Find a PC** scans for Sunshine, Apollo and Vibepollo using mDNS and a bounded local subnet check. Manual addresses and custom ports remain available. Rediscovering a saved PC at a new address reuses its library and pairing.
- **Library → Remote PCs** retains paired PCs and saved games. PC cards show Ready to play, Game running, Offline or Pairing required. Game artwork is square; selecting a tile opens the normal game page, where Play remotely starts the session.
- **Stream settings** are accessible from the PC and game page. Resolution, frame rate, bitrate, codec and decoder preferences are saved per host. Choices include handheld 16:10 sizes and 90/120 fps.
- **Launch fix:** StreamLight 7's hidden Qt entrance animation no longer blocks the launch request. Short-lived SDL capability-test windows are excluded from the embedded game surface. Host errors appear in a retry/settings dialog.
- **Video readiness:** the launch curtain waits for the engine's decoded-picture reveal signal, an attached native surface and the selected host app. Format negotiation alone cannot dismiss it. Host-reported game exit still ends the stream.
- **Library freshness:** refresh replaces the saved app list, removes unpublished/explicitly uninstalled entries and honours artwork revisions. Hosts that publish only shortcuts require their own installed-game integration; the app no longer claims those shortcuts are verified installations. Individual shortcuts can be hidden and restored.
- **Bundled engine:** Setup and Portable include the pinned StreamLight runtime and native bridge. No separate StreamLight installation or StreamTweak host component is needed.

## Keeping the host list accurate

Vibepollo users should enable **Steam auto-sync → Remove uninstalled games** (`steam_autosync_remove_uninstalled = true`). Playnite has a separate equivalent. Sunshine/Apollo users should remove obsolete manually published applications. The standard streaming app list does not expose a complete disk inventory. See [remote play setup](remote-play.md).

## Validation

- Automatic discovery found a real Vibepollo host on the local network without an entered address.
- The actual bundled StreamLight executable completed host lookup and sent `/launch` against a local TLS fixture with all of its own UI hidden. A deliberate host error reached the app and ended the attempted session.
- Native tests covered ignored SDL probe windows, child parenting, hidden/revealed surfaces, focus, resizing, shutdown, portable identity, client TLS certificates and host certificate pinning.
- UI checks covered 1920×1080, 1280×800 and 1024×640, enlarged text, controller navigation, back-to-tile restoration, normal game pages, saved quality settings, offline state, pairing, errors, storage and install sizing.
- Protocol tests covered mDNS parsing, malformed packets, custom ports, discovery deduplication, address changes, library replacement, hidden-game persistence, preferences, launch cancellation, first-picture readiness and host-reported game closure.

Live gameplay on a paired host was not tested for this release. Exact game-window readiness and game-exit detection depend on the host tracking the game's actual lifetime; desktop and detached-launcher sessions may require manual disconnection. Remote play remains a preview.
