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
| `dashx360/` | github.com/ZivvoZ/dashx360 | Xbox 360 boot video and dashboard art/sounds; optional menu music in `Audio/Music/` |
| `ps3/PS3-Simulator-main/` | github.com/CorruptionVR/PS3-Simulator (Unlicense) | XMB icons, SCE PS3 font |
| `ps3/XMB-PS3-Icons-Sounds-Pack--main/pack/` | github.com/JMRDev0/XMB-PS3-Icons-Sounds-Pack- (MIT) | XMB icons, `oggs/*` sounds (including `unlock.ogg`), menu music `oggs/bgm.ogg` |
| `ps4/Ps4-UI-master/` | github.com/d4v1-sudo/Ps4-UI (MIT) | PS4 wave, icons, SST font, pack sounds (`navigate.mp3`, `reward.mp3`, `startup.mp3`, `shutdown.mp3`), menu music `all.mp3` |
| `wii/Wii.JS-gh-pages/` | github.com/andrewplus/Wii.JS (GPL-3) | channel frames, cursor, bottom bar, sounds, menu music `assets/audio/bg-music.mp3` |
| `wii/Liink-main/` | github.com/aica7/Liink (GPL-2) | Rodin fonts |
| `3ds/` | owner-supplied / reference | 3DS HOME Menu assets if present, including optional `music/menu.*` |
| `series/`, `one/` | OmniDash drop-in slots (no upstream pack) | Optional menu music in `music/menu.*`; OmniDash draws a loop without it |
| `*/ref/` | Wikipedia/reference captures | small reference screenshots for measuring only |

## Pack manager (Settings → Appearance → Console packs)

There is no need to know the pack path by heart any more. The launcher's own Settings dialog (Helix's
**Appearance**, and every console's **Advanced (launcher)** entry) lists each folder the theme engines read:

| Row | Folder it manages | Expected names shown |
|---|---|---|
| PlayStation 3 | `ps3/` | `settings.png`, `SCE-PS3-RD-R-LATIN2.woff`, `down.ogg`, `ok.ogg`, `cancel.ogg`, `up.ogg`, `unlock.ogg`, `menu.ogg`/`.mp3`, `bgm.ogg` |
| PlayStation 4 | `ps4/` | `background.png`, `sst.ttf`, `navigate.mp3`, `reward.mp3`, `startup.mp3`, `shutdown.mp3`, `menu.mp3`/`.ogg`, `all.mp3` |
| Wii | `wii/` | `channel-border.png`, the two Rodin `.otf` fonts, five Wii.JS sounds, `menu.mp3`/`.ogg`, `bg-music.mp3` |
| Nintendo 3DS | `3ds/` | `music/menu.mp3` or `music/menu.ogg` |
| Xbox 360 | `dashx360/` | `Boot/Boot Screen.mp4`, five sounds, `Audio/Music/*`, `Custom Files/Themes/<name>/theme.json` |
| Xbox Series X\|S, Xbox One | `series/`, `one/` | `music/menu.mp3` or `music/menu.ogg` (drop-in slots) |

Each row reports:

- **Found / No pack files / Not installed.** "Found" means at least one asset file the theme can actually read.
  `ref/` and DashX360's `References/` are reference screenshots, not assets, so they never make an empty pack look
  installed. `3ds/` on this machine holds only `ref/`, so it correctly reads as **No pack files**.
- **Credit.** The first credit line found in the pack's own `README*`/`CREDITS*`/`AUTHORS*` file (an explicit
  "credit:" line, a repository link, a "created by" line, or the line under a Credits/Thanks heading). When the
  pack carries no readable credit, the row falls back to the documented credit in the inventory above.
- **What is inside**, counted from the files actually present: icons, fonts, sounds, music, wallpapers and video.
  Wallpapers are background-shaped images; other images are icons. Menu music is audio in a `music` folder or a
  named `bgm`/`menu`/`all.mp3` track; the rest is counted as sound.
- **Looks for**, a short list of the exact file names the theme engine requests (the README below carries the
  folder each name belongs in).
- **Open folder.** Uses the existing `shell.openPath` through IPC. A missing pack opens its parent
  (`%APPDATA%\xbox-preview-ui\theme-packs`), so the player can create the folder there.
- **Add README** when the pack's **root** has no README. It writes `OMNIDASH-README.md` with the pack's credit and
  every expected relative path. The write is `wx` (create-only) and is skipped when any root README already exists,
  so a file the player wrote is never overwritten. Packs with an upstream README one level down (PS3/PS4/Wii) still
  get the button: the OmniDash guide belongs at the pack root, next to the folders the player drops files into.

The registry lives in `src/support.cjs` (`PACK_REGISTRY`) and is served by three IPC channels: `theme:packs` (the
report), `theme:pack-open` (reveal) and `theme:pack-readme` (the create-only guide). Both actions are no-ops in the
hidden demo harness (`NEBULA_DEMO=1`), so reviews never open Explorer or write into a real pack folder.
`scripts/pack-manager-test.cjs` checks that the registry covers every pack folder `main.cjs` reads, that every
renderer row has an action, and that the scan, credit and README rules work against a temporary folder.

## Menu music (BGM) per theme

The shared audio engine (`window.gAudio`, task A1) looks for the first existing file in each theme's list. A
player can drop their own loop into the pack without renaming anything; the `music/menu.*` slots exist for every
theme, including the ones whose packs shipped without music. Files are read through `theme:retro-pack` (which
now returns a `music` map) and `theme:retro-sound(id, 'music')`; the 360 pack uses `theme:pack`'s `music` field
and `theme:pack-sound('music')`.

| Theme | First-found order | Present on this machine |
|---|---|---|
| PS3 | `ps3/music/menu.ogg`, `ps3/music/menu.mp3`, `ps3/XMB-PS3-Icons-Sounds-Pack--main/pack/PS3 Icons + Sounds/oggs/bgm.ogg` | pack `bgm.ogg` |
| PS4 | `ps4/music/menu.mp3`, `ps4/music/menu.ogg`, `ps4/Ps4-UI-master/assets/js/all.mp3` | pack `all.mp3` |
| Wii | `wii/music/menu.mp3`, `wii/music/menu.ogg`, `wii/Wii.JS-gh-pages/assets/audio/bg-music.mp3` | pack `bg-music.mp3` |
| 3DS | `3ds/music/menu.mp3`, `3ds/music/menu.ogg` | none — the engine plays its drawn loop |
| Series, One | `<theme>/music/menu.mp3`, `<theme>/music/menu.ogg` | none — drawn loop until a file is dropped in |
| 360 | `dashx360/Audio/Music/menu music.mp3`, `menu.mp3`, `menu.ogg`, `bgm.mp3`, `bgm.ogg` | none — drawn loop until a file is dropped in |

Music is not required: without a pack file the engine synthesises an 8-second seamless loop per theme. The
`menuMusic` and `menuMusicVolume` settings (Sound pages, per-console wording) gate it; it is separate from
`Interface sounds`. It only starts after the first input while focused, fades out on blur and on game launch, and
suspends with the context when hidden.

The PS3's **Game Audio (SND0)** setting is separate from pack music: it uses the selected game's own trailer
stream (hls.js), plays only its audio at 30%, and is off by default. The packs carry no SND0 files.

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
