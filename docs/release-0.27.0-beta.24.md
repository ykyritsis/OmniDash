# 0.27.0-beta.24

- Steam games with multiple launch modes now show their actual choices inside the launcher, with touch, keyboard and controller navigation. Advanced Warfare exposes Multiplayer, Exo and Exo Zombies. Steam receives the selected mode ID and still handles ownership, prerequisites, cloud saves and game startup.
- The launch screen follows Steam's setup stages, including redistributables, updates, cloud saves, shaders and waiting for the game window. First-time setup can run for up to 15 minutes instead of the previous 90-second wait. Progress appears when Steam supplies totals.
- Failed prerequisite installation, cloud conflicts and supported publisher agreements can be answered inside the launcher. Agreements must load before Accept becomes available; save conflicts require an explicit choice. Cancel stops pending Steam launch actions without stopping an already launched game.
- Steam controls can be enabled from the launch screen, with a one-time Steam restart. Running Steam games prevent that restart. If the launcher disconnects during setup, the unfinished action returns to Steam.

Windows administrator approval, external publisher launchers, and Steam prompts that this build does not recognize may still require a separate window. The integration uses the installed Steam client's internal launch API; incompatible future clients produce an error rather than silently launching the wrong mode.

Validation: Advanced Warfare Exo launched through the complete app flow on Windows; Steam recorded `+survival 1`. Mode IDs, prerequisite failures, cloud decisions, cancellation, and disconnect recovery have automated coverage. The setup and failure screens were exercised with simulated first-run events at 1280×800; this PC already had the game's prerequisites installed.

Downloads: `Xbox-Preview-UI-Setup-0.27.0-beta.24.exe` and `Xbox-Preview-UI-Portable-0.27.0-beta.24.exe`. Checksums are in `SHA256SUMS.txt`.
