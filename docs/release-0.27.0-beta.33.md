# Beta 33

Remote-play controls now hide automatically after five seconds. Hold **LB + RB + View**, or press **Ctrl + Alt + Shift + H**, to bring them back. Reopened controls stay visible until dismissed, and disconnect shortcuts keep working while hidden.

Recently played remote games now appear in **Home → Jump back in** with a small cloud icon. They use the normal artwork and game page, retain their history across restarts, and stay browsable when the PC is offline. Failed launches do not enter history.

- Added three named stream profiles per PC and per-game overrides with a reset to the PC profile.
- Added custom resolution, frame rate and bitrate, **Use this display**, HDR, 4:4:4 colour, fractional V-Sync, host audio, more mouse/keyboard options and statistics layout controls.
- Fixed native video-window recreation during live settings changes. **LB + RB + B** or **Ctrl + Alt + Shift + O** opens StreamLight's live video settings; applying changes reconnects to the same game. Swapped face buttons use A instead.
- Reduced repeated native window scans and stopped the launcher's gamepad frame polling during streaming.

See [remote play controls and settings](remote-play.md) and the [StreamLight parity audit](streamlight-parity.md), including the remaining VRR, PyroWave and companion-integration gaps. Full feature and performance parity is not claimed.

Validated native window recreation, fresh-frame readiness, the actual bundled engine's launch path, virtual SDL controller input, saved history/profiles, custom values, banner timing, offline pages, handheld layouts and Home navigation. Real host pairing, physical handheld gameplay and comparative performance measurements were not performed.
