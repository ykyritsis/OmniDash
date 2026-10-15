# Tracking a detached Steam game on a Windows host

Automatic return to the game page relies on Sunshine/Apollo/Vibepollo reporting that the game has exited. A shortcut that launches a Steam URI can outlive the game as a detached session. The client cannot inspect another PC's process list over the standard streaming protocol. **End session** remains available on its game page.

For a shortcut with broken lifetime tracking, [host-game-session.ps1](../tools/host-game-session.ps1) launches through Steam, waits up to two minutes for the exact game executable, and exits three seconds after that executable closes. It runs only for the session; no service or StreamTweak installation is needed. It does not terminate Steam or the game. The host handles cancellation according to its own configuration.

1. Back up the host's `apps.json`. Copy the script to a stable directory on the host, outside the game directory.
2. Set the affected app's command to the following, substituting the real script path, Steam App ID and game executable:

   ```text
   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Streaming\host-game-session.ps1" -AppId 209170 -Executable "D:\SteamLibrary\steamapps\common\Call of Duty Ghosts\iw6mp64_ship.exe"
   ```

3. Disable **auto-detach** and **wait-all** for this shortcut. Keep its existing UUID, name and artwork so the client retains its game identity and history.
4. For a Vibepollo auto-managed Steam shortcut, use `"steam-managed": "manual"` and clear `"steam-install-dir"` for this entry while retaining `steam-id` and `working-dir`. This prevents auto-sync from overwriting the command and bypasses the host's separate Steam tracker for this shortcut. Manual entries need manual removal if the game is uninstalled. Reload the host's applications configuration when no game is running.

Use the executable that remains alive throughout gameplay, not an updater or launcher. A title that swaps executables needs its own tracking configuration. `-LaunchTimeoutSeconds` and `-ExitGraceSeconds` adjust the initial wait and process handoff grace. Access-denied process lookups keep an already detected session alive rather than pretending the game has exited.

The wrapper is tested with a delayed harmless Windows process followed by a real process exit. Live Steam gameplay and each host's configuration reload still need verification on the affected PC. Restore the backed-up app entry to undo the change.

Upstream references: [Moonlight host-state/quit semantics](https://github.com/moonlight-stream/moonlight-qt/blob/master/app/backend/nvhttp.cpp), [Vibepollo process tracking](https://github.com/Nonary/Vibepollo/blob/master/src/process.cpp), and [Vibepollo manual Steam shortcut handling](https://github.com/Nonary/Vibepollo/blob/master/src/steam_sync_policy.cpp).
