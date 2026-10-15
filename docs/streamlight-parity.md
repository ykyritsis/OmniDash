# StreamLight parity audit — beta 36

Compared on 15 October 2026 against [StreamLight 7.0.0](https://github.com/FoggyBytes/StreamLight/tree/v7.0.0), the version bundled in this app. GitHub's release API confirmed 7.0.0 as the newest published release. This is a source and integration audit, not a handheld performance benchmark.

Beta 36 adds a final authenticated host-status check when the decoder exits before its next poll. Remote artwork updates preserve Home nodes and focus, downloads share bounded queues, page prefetch includes remote games, and inactive clients pause background status checks. These launcher optimizations do not change the native decoding pipeline. Detached host launch shortcuts still require correct process tracking on the host.

## Implemented and inherited

| Area | Current integration |
| --- | --- |
| Streaming core | The unmodified StreamLight executable and its native dependencies decode and present video. Electron does not receive or copy decoded frames. |
| Host compatibility | Sunshine, Apollo and Vibepollo pairing, discovery, saved libraries, availability, resume, host-reported game exit, explicit authenticated host-session termination, stale-ID handling and pinned TLS identity. StreamTweak is optional upstream and is not required here. |
| Library and recent games | Shared local artwork cache, square cards and normal game pages. Successful remote sessions join Home's Jump back in with a cloud icon. History survives restart and regenerated app IDs when the host UUID or app name remains stable. |
| Video options | Presets and custom resolution, 10–480 FPS, 0.5–500 Mbps, display resolution/refresh matching, H.264/HEVC/AV1, automatic/hardware/software decoding, HDR and 4:4:4 requests. Actual support depends on host, GPU and display. |
| Frame delivery | V-Sync, software frame pacing and fractional V-Sync. Fractional pacing requires both switches and an exact display-refresh multiple; the engine makes the final capability decision. |
| Shared settings | One configuration for all games and PCs on this device. Lowest Latency / Balanced / Max Visuals calculate bitrate for resolution, FPS and HDR and set codec/decoder/pacing. Manual overrides select Custom. Old profiles migrate once. |
| Live video changes | Native StreamLight overlay: LB + RB + B or Ctrl + Alt + Shift + O. Resolution, FPS, bitrate, HDR and pacing changes use the engine's resume path. The wrapper now allows window recreation and gates each replacement on fresh decoded video. These live changes are session-only. |
| Input | Native SDL controller mapping, hotplug, multiple controllers, rumble, controller mouse mode, swapped face buttons, direct/trackpad touch, captured/absolute mouse, swapped mouse buttons, scroll inversion and system-key capture. Advanced controller capabilities remain dependent on hardware and host support. |
| Audio | Stereo, 5.1, 7.1 and optional host speaker playback. |
| Statistics | Native Standard/Full statistics, corner and text size. Ctrl + Alt + Shift + S or LB + RB + X toggles the overlay during play. |
| Exit controls | Five-second initial hint, active game-page Disconnect / Return to stream / End session, and Resume game / End session after disconnecting. Host termination is confirmed, authenticated and checked afterwards. Custom keyboard/controller escape shortcuts use glyphs and conflict checks. Native shortcut handling survives reconnects and decoder focus loss. The mapped SDL observer handles physical controller chords; XInput is a fallback. Shutdown waits for actual process exit with a 1.5-second lifetime-guard fallback. |
| Runtime efficiency | Window enumeration moved from every 15 ms to a periodic fallback behind native window events. Chromium's gamepad animation-frame polling stops during active streaming and restarts on return. Host status polling remains bounded and does not replace the native video/input pipeline. |

Shortcuts retain physical button positions when gameplay face buttons are swapped. Game page defaults to LB + RB + View; both Game page and Disconnect can be rebound. Controller recording requires three buttons including a system/shoulder button, following upstream’s safety rule.

Source checks: [CLI options and limits](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/cli/commandlineparser.cpp), [preferences and overlay fields](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/settings/streamingpreferences.cpp), [presentation and reconnect decisions](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/streaming/session.cpp), [live overlay](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/streaming/video/streamsettingsoverlay.cpp), [reconnect segue](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/gui/StreamSegue.qml), and [default shortcuts](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/settings/shortcutmanager.cpp).

## Remaining differences

These are outstanding work, not features this release claims to support:

| Gap | Work or dependency |
| --- | --- |
| Experimental VRR | Upstream forces a borderless top-level presentation path. The player now uses a borderless owned popup to preserve SDL focus; VRR still stays disabled until that presentation path is validated on hardware. A switch alone would not establish support. |
| PyroWave and its network/decoder test | Not exposed. Requires its own codec limits, capability detection and testing against a compatible Vibepollo/Vibeshine host. |
| Detailed overlay customization | Individual metric selection, colour and transparency controls remain unexposed. Standard/Full, corner and size are available. |
| Remote library organization | Games/Apps classification, remote pins, total streamed hours and per-field reset indicators are not implemented. |
| Host networking and power | Wake-on-LAN, multiple saved addresses per host and automatic LAN/VPN failover are not implemented. Manual reachable VPN addresses work. |
| Companion integrations | Exact host-window readiness, Windows PIN unlock, host telemetry/power/update commands, link matching, shared clipboard and automatic Tailscale integration need an optional companion integration. They cannot be promised for every unmodified host. |
| Native overlay appearance | Live video settings use StreamLight's native overlay inside the video. Saved settings use this app's current UI. |
| Touch-only control recovery | Touch can use the visible bar; returning to the app after the hint hides currently requires a keyboard/controller shortcut. A touch-only gesture is not implemented. |

The [upstream feature inventory](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/README.md) separates core streaming from companion-dependent features. The integration deliberately preserves normal game streaming without a companion requirement.

## Verification and performance acceptance

Automated checks cover the actual bundled engine's launch command against a local TLS fixture, native owned-window recreation after a 1.2-second interruption, first-frame gating, actual SDL background input using a virtual controller, history persistence, shared settings migration and automatic preset calculation, custom keyboard/controller recording and dispatch, settings, and UI timing/navigation at 1920×1080, 1280×800 and 1024×640. Layout checks include enlarged text. Fixture artwork and hosts are test data.

The isolated test desktop has no interactive Windows foreground; focused physical input still needs handheld verification. No live host pairing or real game was performed, as requested. Physical HDR output, controller rumble/haptics, live quality changes against a gaming host and end-to-end efficiency remain device-validation items.

To establish performance parity, compare this build and standalone StreamLight 7.0.0 on the same handheld, host, display mode, game scene, network, resolution, FPS, bitrate, codec and decoder. Warm both runs, then alternate several matched sessions. Record native incoming/decoded/rendered FPS, drops, RTT, jitter, decode/queue/render timing, client CPU/GPU/memory and battery power. Test full-screen video with the banner hidden and statistics configured identically. Include controller input, rumble, hotplug, a live settings reconnect and game-exit return. Report measured differences and variability; sharing a decoder alone does not establish equivalent latency, power use or frame pacing.
