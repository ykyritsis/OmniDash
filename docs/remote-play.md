# Remote play preview

The app uses StreamLight's native streaming runtime with Sunshine, Apollo and Vibepollo hosts. StreamTweak is not required. Pairing, host libraries, search, launch progress and return navigation use the app's own interface. The native video surface is owned by and covers the launcher’s client area; StreamLight's separate launcher interface stays hidden.

![Remote PC pairing screen](remote-play-pairing.png)

UI capture with a sample host and test PIN.

## Connect a PC

1. Run Sunshine, Apollo or Vibepollo on your gaming PC and publish the games you want to stream in its app list.
2. Open **Library → Remote PCs → Find a PC** (also available in Remote play settings). Nearby PCs are discovered automatically. Select a result, or use **Enter address manually** for a hostname, VPN address or custom HTTP port such as `192.168.1.20:48000`. The default port is 47989.
3. Enter the displayed four-digit PIN in the host's pairing page. The client waits for approval and saves the PC and its published games.
4. Return to **Library → Remote PCs** to see saved PCs, their connection status and square game cards. Selecting a game opens its normal game page; choose **Play remotely** to start it.
5. Open **Stream settings** from Remote play settings, Library or a remote game’s options. These settings apply to every remote game and PC on this device. Choose Lowest Latency, Balanced or Max Visuals, then resolution, frame rate and HDR. The preset sets bitrate, codec, decoder and frame delivery automatically. **Shortcuts** lets you record your own controller and keyboard combinations. **Advanced settings** contains manual video, audio and input controls. Changes apply to the next stream.

Discovery listens for both multicast and unicast mDNS replies on each LAN adapter. Saved addresses and advertised custom ports are checked first. The fallback checks the attached /24 (or smaller) on up to eight adapters, with independent 800 ms probe deadlines and a 28-second overall limit. Results appear as they arrive; virtual adapters cannot consume the entire scan before Wi-Fi/Ethernet is checked.

Both devices must be able to reach each other. Remote play does not open router ports or configure a VPN. A reachable VPN hostname/address can be entered like any other host address.

## Starting and ending a session

The existing game launch animation remains visible while the client connects. The native surface is revealed once the host reports the selected app running, the engine reports that its first decoded picture is ready to reveal, and Windows has attached the video window to the launcher. Video-format negotiation alone does not dismiss the animation. Controller navigation in the launcher is suspended during play. Connection failures show an error with retry and stream-settings actions.

When the host reports that app has stopped, the client ends its stream and returns to the game page. Back returns to the selected Library tile. Two successful state checks confirm the exit; a failed request is not treated as a closed game. A replacement app on the host also ends this client's stream without stopping the replacement app.

The active remote game page has **Disconnect**, **Return to stream** and **End session**. Return uses the existing connection. After disconnecting, **Resume game** and **End session** remain available while the host session is open. **End session** asks for confirmation, sends the authenticated Moonlight quit request and verifies the PC is free. It may close the game, so save first. A different game or a session the host refuses to let this client end is left alone; failures remain visible for retry. Hosts reporting FREE are treated as finished even if they retain the previous game ID. The initial video bar also has Disconnect, Game page and Hide, and hides automatically after five seconds unless you interact with it.

Default shortcuts:

| Action | Controller | Keyboard |
| --- | --- | --- |
| Disconnect | LB + RB + A | Ctrl + Alt + Shift + Q |
| Game page / return to stream | LB + RB + View | Ctrl + Alt + Shift + H |
| Live video settings | LB + RB + B | Ctrl + Alt + Shift + O |
| Statistics | LB + RB + X | Ctrl + Alt + Shift + S |
| Release captured mouse | Hold Menu / Start for controller mouse mode | Ctrl + Alt + Shift + Z |

Hold a controller escape combination for half a second. **Stream settings → Shortcuts** lets you record the Disconnect and Game page combinations, see button glyphs and restore defaults. Controller bindings require at least three buttons, including a shoulder/View/Menu button; keyboard bindings require at least two of Ctrl/Alt/Shift plus a letter, number or F key. Conflicting bindings are rejected. Button swapping only changes gameplay input; shortcut glyphs continue to describe physical buttons. Existing Moonlight four-button disconnect settings migrate automatically.

The native bridge registers keyboard shortcuts for the stream’s lifetime and observes controller combinations using the bundled SDL mappings, independently of decoder focus. XInput is a fallback if that observer cannot initialize. SDL’s native quit binding also remains available. Holding the Game page combination toggles once until released. The mouse-release and other native keyboard controls follow the [Moonlight setup guide](https://github.com/moonlight-stream/moonlight-docs/wiki/Setup-Guide).

When visible, the initial bar is outside the video and resizes with text scaling. Touch can use its buttons directly. Game page hides the native surface and restores the app’s normal navigation. Disconnect waits for the player to exit; an unresponsive bridge is terminated through its process lifetime guard after 1.5 seconds. It does not send a host-game quit request, so the game can stay open for resuming. Cancelling launch or closing the launcher also closes its streaming process.

The native video is a borderless owned window, so SDL can receive foreground input. Background gameplay forwarding is disabled: navigating the app does not keep sending controller input to the game. StreamLight handles gameplay mapping, hotplug, rumble and forwarding. Multiple controllers are enabled by default.

## Artwork

Successful remote sessions also appear in **Home → Jump back in**, ordered with local games and marked by a cloud icon. Selecting one opens its normal game page with the PC's status. Failed launches do not enter history. History is saved per PC and game UUID/name; hidden or removed games do not appear in Home.

Remote cards use the same square tiles, cover fallbacks and optional logo overlays as local games. The client first reuses manual selections and artwork from its saved local library, cached Xbox catalog and available Steam discovery results. A known Steam identity takes priority; otherwise matching uses a conservative normalized title and never treats the host's opaque app ID as a Steam ID.

Missing artwork uses the app's normal Xbox, IGN, PlayStation, SteamGridDB and Steam lookup and image cache. Only when that produces no cover does the client use the host's published image. Full artwork metadata, including heroes and logos, is retained for game pages and the launch animation. Shared requests are coalesced across PCs, successful lookups are reused, and local artwork remains available when a host is offline.

## Stream settings

A single saved configuration applies to every remote game and PC on this device. Older PC profiles migrate once from the most recently seen PC; per-game overrides are removed. **Use this display** fills in the current display’s physical resolution and refresh rate. Resolution, FPS and bitrate pickers also accept custom values.

Presets control bitrate, automatic codec selection, hardware-preferred automatic decoding, V-Sync and frame pacing. Balanced uses StreamLight/Moonlight’s screen-size and frame-rate bitrate curve; Lowest Latency uses 75% of that rate with V-Sync/pacing off; Max Visuals uses 160% with V-Sync/pacing on. HDR adds 15% to the recommendation. These are starting settings, not a network speed test. Changing resolution, FPS or HDR recalculates the rate. Manual bitrate/video overrides select Custom; selecting a preset restores automatic tuning.

Advanced settings include H.264/HEVC/AV1, hardware/software decoding, 4:4:4 colour, fractional V-Sync, audio layout, host speakers, controller/mouse/touch behaviour, system-key capture and statistics. Fractional pacing requires V-Sync, frame pacing and a display refresh that is an exact multiple of stream FPS. Host, GPU and display capabilities determine HDR and colour support.

During play, native live video settings use the shortcut above. Applying changes briefly reconnects to the same game; the launch curtain waits for fresh video. These changes last for that session; the shared saved settings apply on the next launch. The live overlay retains StreamLight’s appearance; saved settings use the app’s current UI.

See the [parity audit](streamlight-parity.md) for verified integration behavior, remaining features and performance validation requirements.

## Keeping the game list accurate

Refreshing replaces the saved list with the host's current published apps, removes apps the host explicitly marks uninstalled, and refreshes artwork when its revision changes. Standard Sunshine/Apollo app lists do not include a complete installed-game inventory: a stale shortcut can still be published after its game is removed.

For Vibepollo's Steam integration, enable **Steam auto-sync → Remove uninstalled games** (`steam_autosync_remove_uninstalled = true`) and reload the host configuration. Its Playnite integration has a separate cleanup setting. For manually published Sunshine/Apollo games, remove obsolete shortcuts on the host. The client also offers **Hide from this library** and **Restore hidden games** without changing the host's configuration.

## Host behaviour and preview limits

- This browser shows the host's **published apps**, not an inventory of everything installed on its disk. Configure the host's game library or its existing library integration to publish additional games.
- The standard protocol exposes app/session state, not a universal game-window-ready signal. Some games can show a host desktop, splash screen or launcher after the stream becomes ready. Exact window detection cannot be guaranteed across unmodified Sunshine/Apollo/Vibepollo hosts.
- Automatic termination depends on the host tracking the actual game. Desktop sessions or detached launcher commands can remain active after the game exits. Configure those apps to track their game's lifetime, or use **End session**. An optional [Windows Steam tracking wrapper](host-game-tracking.md) is included for detached shortcuts; it requires a host shortcut change.
- StreamLight's CLI selects apps by name. Give apps unique names on the host; ambiguous duplicates are reported before launch. Invisible ordering prefixes are retained for launching while labels are cleaned for display.
- A host already running a different app is left alone. Close that app before launching another game. Selecting the same running app resumes it.
- Cached libraries remain browsable while a PC is offline. Starting or refreshing needs a reachable, paired host. Artwork downloads are limited to cards as they become visible.
- This preview has automated UI, state, discovery, native-window recreation and identity/TLS checks. The bundled engine's hidden-window launch path is tested against a local protocol fixture. Its actual SDL library is tested with virtual controllers for background buttons, sticks, triggers and hotplug. Native custom/default shortcut registration, dispatch, hold timing and mapped SDL controller hotplug are checked separately. The test desktop has no interactive Windows foreground, so focused physical gameplay input still needs handheld verification. Live gameplay, physical HDR output and controller/decoder combinations still need device verification. VRR, PyroWave and host power controls remain unexposed; see the parity audit for the complete gap list.

## Pairing data

The app keeps an isolated StreamLight portable profile under its own user-data `remote-play/engine` directory. It does not reuse or change a separate StreamLight installation. Private client credentials stay in the main process; the renderer receives host names, library records and public artwork only. HTTPS requests verify the saved host certificate. If a host identity changes, remove the entry and pair again.

Removing a PC removes it from this app's browser. To revoke this client on the host as well, remove it from the host's paired devices. Re-adding the same PC can reuse its existing local pairing until it is revoked on the host.

## Streaming component and source

- Engine: [FoggyBytes/StreamLight, v7.0.0](https://github.com/FoggyBytes/StreamLight/tree/v7.0.0), using Moonlight's streaming core, FFmpeg, SDL and the upstream decoder/runtime dependencies.
- License: [GPL v3](../src/remote-play/LICENSE.StreamLight), also included next to the bundled runtime.
- Engine source: the linked release tag and its recorded submodules; the app does not modify StreamLight's binary or source.
- Integration source: [remote-play.cjs](../src/remote-play.cjs), [remote-artwork.cjs](../src/remote-artwork.cjs), [remote-discovery.cjs](../src/remote-discovery.cjs), [WindowBridge.cs](../src/remote-play/WindowBridge.cs), and [remote-play-ui.js](../src/renderer/remote-play-ui.js).
- Build preparation: run `npm run prepare:streaming` on Windows. [prepare-streaming.cjs](../scripts/prepare-streaming.cjs) verifies a pinned official installer, extracts its files without running setup, and compiles the native bridge using Windows' .NET Framework C# compiler. The unpacker is used only during preparation and is not bundled.
- Each build includes a `runtime-manifest.json` with the pinned engine source/version and hashes of its runtime files. Build staging and private pairing data are ignored by Git.

The native bridge uses a Windows job object to own the decoder process and a borderless owned popup for its SDL surface. It follows the parent client's physical pixel dimensions and keeps the engine's other windows hidden. Temporary SDL decoder-probe windows are ignored. The isolated engine profile disables its Qt entrance animation so hidden UI cannot stall the launch request. This avoids moving decoded frames through JavaScript or Chromium's video pipeline.
