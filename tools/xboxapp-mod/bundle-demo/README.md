# Route A demo: replace the Xbox app's UI bundle

This is the proof-of-concept for swapping the official Xbox app's interface with our
own React Native Windows code. It builds a Hermes **v96** bundle (the exact bytecode
version the installed app's runtime loads) that renders a "custom bundle running"
screen, and installs it over `Bundle\index.bundle`.

Source-only here. The working copy with `node_modules` lives in
`%LOCALAPPDATA%\XboxMod\bundle-demo`, because running `pnpm install` inside this repo
would install the repo's workspace (it has `pnpm-workspace.yaml` at the root) instead
of this package.

## Bootstrap + build

```powershell
powershell -ExecutionPolicy Bypass -File tools\xboxapp-mod\bundle-demo\bootstrap.ps1
```

That copies this folder to `%LOCALAPPDATA%\XboxMod\bundle-demo`, installs
`react-native@0.76.5` + `react-native-windows@0.76.17` + `@react-native/metro-config`,
then runs `build.ps1`, which:

1. bundles `index.js` with Metro for the `windows` platform (release, minified),
2. compiles it with the hermesc shipped in `react-native@0.76.5`
   (`sdks/hermesc/win64-bin/hermesc.exe`) — verified to emit **bytecode 96**,
3. checks the Hermes SHA-1 trailer,
4. publishes `%LOCALAPPDATA%\XboxMod\index.demo.bundle` plus an info manifest the
   installer uses to detect app-version drift.

## Install / revert

```powershell
powershell -ExecutionPolicy Bypass -File tools\xboxapp-mod\style\install-bundle.ps1 -Bundle "$env:LOCALAPPDATA\XboxMod\index.demo.bundle"
powershell -ExecutionPolicy Bypass -File tools\xboxapp-mod\style\install-bundle.ps1 -Restore
```

## How the host finds our component

The native host calls `AppRegistry.runApplication` with a component name compiled into
`XboxPcApp.exe`. We do not know it yet, so `index.js` registers the same component
under every plausible candidate (`App`, `XboxPcApp`, `Microsoft.Xbox.App`,
`Microsoft.Xbox.AppL`, `XboxPcAppL`, `Microsoft.GamingApp`, `GarrisonApp`, …).

Expected outcomes:

| What you see | Meaning | Next step |
| --- | --- | --- |
| The dark "XBOX APP MOD / Custom bundle running" card | route A works — the real app is running our JS | start building the dashboard |
| Blank / black window | our bundle loaded but the host launched a component name we did not register | find the real name (string search in `XboxPcApp.exe`, or register a broader list) |
| The app's normal UI | our bundle was not loaded (wrong path, or the app restored its copy) | check the file hash in the package folder |
| Crash / instant close | the host rejected the bundle (bytecode or native module mismatch) | revert with `-Restore`, then we inspect the app's log |

## Notes

- The installer backs up the original bundle to `%LOCALAPPDATA%\XboxMod\backup\` and
  hands file ownership back to TrustedInstaller afterwards.
- A Store update replaces the bundle; rebuild and reinstall after updates.
- Nothing here touches Microsoft's binaries beyond that one bundle file.
