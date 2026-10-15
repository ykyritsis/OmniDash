# Remote play preview

The app uses StreamLight's native streaming runtime with Sunshine, Apollo and Vibepollo hosts. StreamTweak is not required. Pairing, host libraries, search, launch progress and return navigation use the app's own interface. Only the native video surface is embedded in the launcher window; StreamLight's separate launcher interface stays hidden.

![Remote PC pairing screen](remote-play-pairing.png)

UI capture with a sample host and test PIN.

## Connect a PC

1. Run Sunshine, Apollo or Vibepollo on your gaming PC and publish the games you want to stream in its app list.
2. On the client, open **Settings → Remote play → Add a PC**. Enter the host's IP address or hostname. A custom HTTP port can be appended, such as `192.168.1.20:48000`. The default is 47989.
3. Enter the displayed four-digit PIN in the host's pairing page. The client waits for approval and then opens its game browser.
4. Choose a game from **My games & apps → Remote PCs** or **Settings → Remote play → Browse remote games**.
5. Choose stream resolution, frame rate and bitrate in Remote play settings before starting your next session. 1080p, 60 fps and 20 Mbps are the defaults.

Both devices must be able to reach each other. Remote play does not open router ports or configure a VPN. A reachable VPN hostname/address can be entered like any other host address.

## Starting and ending a session

The existing game launch animation remains visible while the client connects. The native surface is revealed once the host reports that selected app running, the decoder reports a video stream and Windows has attached the video window to the launcher. Controller navigation in the launcher is suspended during play.

When the host reports that app has stopped, the client ends its stream and returns to the remote library. Two successful state checks confirm the exit; a failed request is not treated as a closed game. A replacement app on the host also ends this client's stream without stopping the replacement app.

To disconnect manually, use **Ctrl + Alt + Shift + Q** or **LB + RB + A**, StreamLight's default disconnect shortcuts. Disconnecting the client does not send a host-game quit request, so a game can stay open for later resumption. Cancelling the launch animation also disconnects the client. Closing the launcher or its native bridge closes its owned streaming process.

## Host behaviour and preview limits

- This browser shows the host's **published apps**, not an inventory of everything installed on its disk. Configure the host's game library or its existing library integration to publish additional games.
- The standard protocol exposes app/session state, not a universal game-window-ready signal. Some games can show a host desktop, splash screen or launcher after the stream becomes ready. Exact window detection cannot be guaranteed across unmodified Sunshine/Apollo/Vibepollo hosts.
- Automatic termination depends on the host tracking the actual game. Desktop sessions or detached launcher commands can remain active after the game exits. Configure those apps to track their game's lifetime, or disconnect manually.
- StreamLight's CLI selects apps by name. Give apps unique names on the host; ambiguous duplicates are reported before launch. Invisible ordering prefixes are retained for launching while labels are cleaned for display.
- A host already running a different app is left alone. Close that app before launching another game. Selecting the same running app resumes it.
- Cached libraries remain browsable while a PC is offline. Starting or refreshing needs a reachable, paired host. Artwork downloads are limited to cards as they become visible.
- This first preview has automated UI, state, native-window and identity/TLS checks. Live streaming against a paired gaming PC and physical controller/decoder combinations still need device verification. HDR, microphone passthrough, host power controls and mid-stream quality changes are not exposed in this preview.

## Pairing data

The app keeps an isolated StreamLight portable profile under its own user-data `remote-play/engine` directory. It does not reuse or change a separate StreamLight installation. Private client credentials stay in the main process; the renderer receives host names, library records and public artwork only. HTTPS requests verify the saved host certificate. If a host identity changes, remove the entry and pair again.

Removing a PC removes it from this app's browser. To revoke this client on the host as well, remove it from the host's paired devices. Re-adding the same PC can reuse its existing local pairing until it is revoked on the host.

## Streaming component and source

- Engine: [FoggyBytes/StreamLight, v7.0.0](https://github.com/FoggyBytes/StreamLight/tree/v7.0.0), using Moonlight's streaming core, FFmpeg, SDL and the upstream decoder/runtime dependencies.
- License: [GPL v3](../src/remote-play/LICENSE.StreamLight), also included next to the bundled runtime.
- Engine source: the linked release tag and its recorded submodules; the app does not modify StreamLight's binary or source.
- Integration source: [remote-play.cjs](../src/remote-play.cjs), [WindowBridge.cs](../src/remote-play/WindowBridge.cs), and [remote-storage.js](../src/renderer/remote-storage.js).
- Build preparation: run `npm run prepare:streaming` on Windows. [prepare-streaming.cjs](../scripts/prepare-streaming.cjs) verifies a pinned official installer, extracts its files without running setup, and compiles the native bridge using Windows' .NET Framework C# compiler. The unpacker is used only during preparation and is not bundled.
- Each build includes a `runtime-manifest.json` with the pinned engine source/version and hashes of its runtime files. Build staging and private pairing data are ignored by Git.

The native bridge uses a Windows job object to own the decoder process and a child window for its SDL surface. It follows the parent client's physical pixel dimensions and keeps the engine's other windows hidden. This avoids moving decoded frames through JavaScript or Chromium's video pipeline.
