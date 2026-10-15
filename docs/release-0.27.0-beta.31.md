# Beta 31

Fixes the remote-play artwork, controller input and missing exit controls reported on handhelds. Setup and Portable continue to include StreamLight; no separate client installation is needed.

- **Matching game artwork:** remote cards now use the app's normal artwork lookup, image cache and tile renderer. Existing local/manual covers are reused first, including logos and heroes. Known Steam IDs take priority over title matches. Host images are a fallback, and covers update individually as they become ready.
- **Controller input:** the embedded engine now keeps SDL gamepad input enabled when Electron owns the foreground window. This addresses controllers going silent after the launch animation. The engine still handles controller mappings, sticks, triggers and hotplug.
- **Visible exit controls:** a persistent Disconnect button sits above the native video. The bar shows the controller and keyboard shortcuts and leaves room for larger text. Disconnect returns to the app while leaving the host game open for resumption.
- **Independent escape paths:** use Ctrl + Alt + Shift + Q or LB + RB + A. A half-second controller hold also activates an XInput fallback independent of SDL. Stream settings offer the alternative View + Menu + LB + RB combination. If face-button swapping is enabled, the first combination uses physical B and the bar updates accordingly.
- **More stream settings:** audio layout, V-Sync, frame pacing, performance statistics, multiple controllers, face-button layout, controller mouse mode, touch mode, mouse mode and controller disconnect shortcut join the existing resolution, FPS, bitrate, codec and decoder controls. Settings are saved per PC and apply to the next stream.

Use Ctrl + Alt + Shift + Z to release a captured mouse, then click Disconnect. Touch users can use the button directly. See [remote play setup and controls](remote-play.md).

## Validation

- Reproduced dropped background controller events using the actual SDL DLL bundled with StreamLight and an embedded native window. Enabling background input delivered virtual-controller buttons, stick/trigger events and device arrival/removal events.
- Checked native shortcut registration and message dispatch, foreground guards, half-second controller holds, controller isolation, disconnect/reconnect state and both shortcut presets. These checks use local fixtures and do not inject input into a real game.
- Verified the real bundled StreamLight executable accepts the launch options, sends `/launch` to a local TLS fixture and returns an intentional host error to the app.
- Checked cache reuse, manual selections, exact Steam identity, conservative cross-store matching, shared artwork requests, offline persistence and full artwork delivery without contacting an offline host.
- UI checks passed at 1920×1080, 1280×800 and 1024×640, including larger text, long game titles, controller focus, visible Disconnect, saved settings, artwork logo overlays, storage and install sizing.
- Native checks covered video parenting, toolbar insets, physical-pixel resizing, decoder shutdown, isolated identity, mutual TLS and host certificate pinning. Protocol checks covered discovery and launch/exit lifecycle regressions.

Live gameplay with a paired host or physical handheld controller was not tested. Remote play remains a preview; game-ready and game-exit detection still depend on how the host tracks the game.
