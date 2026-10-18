# Theme packs and app assets

This file is the map for anyone (human or agent) working on the console themes. The product's own drawn
assets live in the repo; console assets do **not**, and must never be committed or shipped. They stay in the
owner's pack folder and are linked here for convenience.

## Where everything lives

| What | Path | In git? |
|---|---|---|
| OmniDash-drawn app assets (logo, controller, launcher logos) | `src/renderer/assets/` | Yes |
| New OmniDash mark (splash, Settings, onboarding, launch) | `src/renderer/assets/omnidash.svg` | Yes |
| Installer/window icon | `build/icon.svg`, `build/icon.png` | Yes |
| Xbox mode bridge logos | `src/xbox-mode-bridge/Assets/` | Yes |
| Console packs (Sony/Nintendo/Microsoft assets) | `%APPDATA%\xbox-preview-ui\theme-packs\` | **No** |
| Same packs, visible from the repo root | `theme-packs/` (directory junction) | **No** (`.gitignore`) |
| Review captures and eval outputs | `.visual-review/` | **No** (`.gitignore`) |

The `theme-packs/` junction is created on this machine with:

```powershell
cmd /c mklink /J "theme-packs" "$env:APPDATA\xbox-preview-ui\theme-packs"
```

It points at the owner's personal pack folder; it is not part of the repo, the build, or a release. On a
fresh clone the directory simply will not exist and the themes fall back to their drawn assets.

## Pack inventory (personal use only)

| Folder | Source / licence | What it adds |
|---|---|---|
| `dashx360/` | github.com/ZivvoZ/dashx360 | Xbox 360 boot video and dashboard art/sounds |
| `ps3/PS3-Simulator-main/` | github.com/CorruptionVR/PS3-Simulator (Unlicense) | XMB icons, SCE PS3 font |
| `ps3/XMB-PS3-Icons-Sounds-Pack--main/pack/` | github.com/JMRDev0/XMB-PS3-Icons-Sounds-Pack- (MIT) | XMB icons, `oggs/*` sounds, `bgm.ogg` |
| `ps4/Ps4-UI-master/` | github.com/d4v1-sudo/Ps4-UI (MIT) | PS4 wave, icons, SST font, pack sounds |
| `wii/Wii.JS-gh-pages/` | github.com/andrewplus/Wii.JS (GPL-3) | channel frames, cursor, bottom bar, sounds |
| `wii/Liink-main/` | github.com/aica7/Liink (GPL-2) | Rodin fonts |
| `3ds/` | owner-supplied / reference | 3DS HOME Menu assets if present |
| `*/ref/` | Wikipedia/reference captures | small reference screenshots for measuring only |

Agents may read the junction while working, but must keep every pack file out of commits, releases and the
installer. New packs are discovered by the main process through `theme:retro-pack` (see
`docs/HANDOVER-themes.md`).

## App assets in `src/renderer/assets/`

- `omnidash.svg` — OmniDash mark: splash, Settings sidebar, onboarding, import screen, launch overlay.
- `xbox.svg` — drawn Xbox family fallback used by Xbox-era chrome and status pieces.
- `controller.svg` — controller-lost screen and controller status.
- `steam.svg`, `epic.svg`, `ea.svg`, `battlenet.svg`, `ubisoft.svg` — store/launcher marks for library
  connection cards and onboarding.
- `keyboard.svg` — on-screen keyboard decoration.
