# OmniDash 0.7.1

Settings is one list now, and the Series dashboard no longer burns CPU while it sits still.

## One Settings list

The **All launcher settings** row and the **Advanced (launcher)** section are gone from every theme. The things that used to send you there now work in place:

- **Steam Web API key** and **SteamGridDB key** open a small Save / Cancel box where you paste the key. Controller users get the on-screen keyboard.
- **Scan for games** and **Reset chosen artwork** are under **Library**.
- **Console pack** is under **Appearance** and installs that dashboard's pack.
- **Reset OmniDash** is under **System**.
- **Epic Games** just shows whether it was found, since it's detected automatically.

Helix and the Xbox themes use the clean shared screen. PlayStation and Nintendo show the same eight sections in their own menus.

Old features that only lived on the launcher page, like remote play, privacy and custom sound folders, no longer have a way in from Settings. Remote play still has its own screens.

## Performance

- **Series idle CPU:** the swirl background was animating behind the game art, holding the theme at about 18% CPU and 7.5% GPU doing nothing. It is still now, and idle drops under 0.1% — the same as Aero and Helix.
- **Cold start:** the window finishes loading in about a second.

These were measured in test windows, so your own timings will vary.

## Updating

The built-in updater installs this over 0.7.0: choose **Restart to update**, or let it apply when OmniDash next closes. `SHA256SUMS.txt` is attached for checking the downloads. Builds are not code-signed, so SmartScreen may warn on first run: choose **More info → Run anyway**.
