# StreamLight parity audit — beta 33

Compared on 15 October 2026 against [StreamLight 7.0.0](https://github.com/FoggyBytes/StreamLight/tree/v7.0.0), the version bundled in this app. GitHub's release API confirmed 7.0.0 as the newest published release. This is a source and integration audit, not a handheld performance benchmark.

## Implemented and inherited

| Area | Current integration |
| --- | --- |
| Streaming core | The unmodified StreamLight executable and its native dependencies decode and present video. Electron does not receive or copy decoded frames. |
| Host compatibility | Sunshine, Apollo and Vibepollo pairing, discovery, saved libraries, availability, resume, host-reported game exit and pinned TLS identity. StreamTweak is optional upstream and is not required here. |
| Library and recent games | Shared local artwork cache, square cards and normal game pages. Successful remote sessions join Home's Jump back in with a cloud icon. History survives restart and regenerated app IDs when the host UUID or app name remains stable. |
| Video options | Presets and custom resolution, 10–480 FPS, 0.5–500 Mbps, display resolution/refresh matching, H.264/HEVC/AV1, automatic/hardware/software decoding, HDR and 4:4:4 requests. Actual support depends on host, GPU and display. |
| Frame delivery | V-Sync, software frame pacing and fractional V-Sync. Fractional pacing requires both switches and an exact display-refresh multiple; the engine makes the final capability decision. |
| Profiles | Three named profiles per PC. Games store only differing values over the active profile; resetting a game restores inheritance. Profile selection and changes take effect when saved. |
| Live video changes | Native StreamLight overlay: LB + RB + B or Ctrl + Alt + Shift + O. Resolution, FPS, bitrate, HDR and pacing changes use the engine's resume path. The wrapper now allows window recreation and gates each replacement on fresh decoded video. These live changes are session-only. |
| Input | Native SDL controller mapping, hotplug, multiple controllers, rumble, controller mouse mode, swapped face buttons, direct/trackpad touch, captured/absolute mouse, swapped mouse buttons, scroll inversion and system-key capture. Advanced controller capabilities remain dependent on hardware and host support. |
| Audio | Stereo, 5.1, 7.1 and optional host speaker playback. |
| Statistics | Native Standard/Full statistics, corner and text size. Ctrl + Alt + Shift + S or LB + RB + X toggles the overlay during play. |
| Exit controls | Five-second initial hint, manual Hide, keyboard/controller reopening, independent native escape shortcuts and a full video viewport when hidden. Interacting with the hint cancels auto-hide; manually reopened controls stay visible. |
| Runtime efficiency | Window enumeration moved from every 15 ms to a periodic fallback behind native window events. Chromium's gamepad animation-frame polling stops during active streaming and restarts on return. Host status polling remains bounded and does not replace the native video/input pipeline. |

Face-button swapping changes the physical live-settings shortcut to A and the statistics shortcut to Y. The independent controls toggle remains LB + RB + View.

Source checks: [CLI options and limits](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/cli/commandlineparser.cpp), [preferences and overlay fields](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/settings/streamingpreferences.cpp), [presentation and reconnect decisions](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/streaming/session.cpp), [live overlay](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/streaming/video/streamsettingsoverlay.cpp), [reconnect segue](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/gui/StreamSegue.qml), and [default shortcuts](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/app/settings/shortcutmanager.cpp).

## Remaining differences

These are outstanding work, not features this release claims to support:

| Gap | Work or dependency |
| --- | --- |
| Experimental VRR | Upstream forces a borderless top-level presentation path. Our player is an embedded child window, so VRR stays disabled until this architecture is validated or changed. A switch alone would not establish support. |
| PyroWave and its network/decoder test | Not exposed. Requires its own codec limits, capability detection and testing against a compatible Vibepollo/Vibeshine host. |
| Detailed overlay customization | Individual metric selection, colour and transparency controls remain unexposed. Standard/Full, corner and size are available. |
| Remote library organization | Games/Apps classification, remote pins, total streamed hours and per-field inheritance/reset indicators are not implemented. |
| Host networking and power | Wake-on-LAN, multiple saved addresses per host and automatic LAN/VPN failover are not implemented. Manual reachable VPN addresses work. |
| Companion integrations | Exact host-window readiness, Windows PIN unlock, host telemetry/power/update commands, link matching, shared clipboard and automatic Tailscale integration need an optional companion integration. They cannot be promised for every unmodified host. |
| Native overlay appearance | Live video settings use StreamLight's native overlay inside the video. Saved profiles/settings use this app's current UI. |
| Touch-only control recovery | Touch can use the visible bar; reopening a hidden bar currently requires the documented keyboard/controller shortcut. |

The [upstream feature inventory](https://github.com/FoggyBytes/StreamLight/blob/v7.0.0/README.md) separates core streaming from companion-dependent features. The integration deliberately preserves normal game streaming without a companion requirement.

## Verification and performance acceptance

Automated checks cover the actual bundled engine's launch command against a local TLS fixture, native child-window recreation after a 1.2-second interruption, first-frame gating, actual SDL background input using a virtual controller, history persistence, profile inheritance and reset, custom settings, and UI timing/navigation at 1920×1080, 1280×800 and 1024×640. Layout checks include enlarged text. Fixture artwork and hosts are test data.

No live host pairing or real game was performed, as requested. Physical HDR output, controller rumble/haptics, live quality changes against a gaming host and end-to-end efficiency remain device-validation items.

To establish performance parity, compare this build and standalone StreamLight 7.0.0 on the same handheld, host, display mode, game scene, network, resolution, FPS, bitrate, codec and decoder. Warm both runs, then alternate several matched sessions. Record native incoming/decoded/rendered FPS, drops, RTT, jitter, decode/queue/render timing, client CPU/GPU/memory and battery power. Test full-screen video with the banner hidden and statistics configured identically. Include controller input, rumble, hotplug, a live settings reconnect and game-exit return. Report measured differences and variability; sharing a decoder alone does not establish equivalent latency, power use or frame pacing.
