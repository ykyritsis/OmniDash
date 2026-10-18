# Xbox app modding tools

Start with `../docs/xbox-app-modding.md` for the findings behind these scripts.

## Use this one

`custom_library.py` — add, re-art, list or remove imported games in the official
Xbox app by writing files only. It stops the Xbox processes first, because the app
rewrites its manifest from memory at start-up and would otherwise revert the edit.

```powershell
python custom_library.py add --exe "C:\...\Game.exe" --title "Game" --art <png|url> --apply --kill
python custom_library.py set-art --exe-name DeadzoneSteam.exe --art <png|url> --apply --kill
python custom_library.py list
python custom_library.py remove --exe-name Game.exe --apply --kill
```

## Route B: retheme the real app (token patch)

`style/` rewrites design-token colour literals inside the app's Hermes bundle, so
every screen and feature still comes from Microsoft's own JS.

```powershell
# 1. build the patched bundle (no admin needed)
python tools\xboxapp-mod\style\patch_style.py --write

# 2. install it (asks for administrator; backs up the original first)
powershell -ExecutionPolicy Bypass -File tools\xboxapp-mod\style\install-bundle.ps1

# 3. revert any time
powershell -ExecutionPolicy Bypass -File tools\xboxapp-mod\style\install-bundle.ps1 -Restore
```

- `style/palette.json` – the old→new colour map; values must match the original
  byte length. Edit, re-run step 1, re-run step 2 to iterate.
- `style/analyze_tokens.py` – inventory of hex/rgba/font literals in the bundle.
- `style/patch_style.py` – applies the map, repairs the Hermes SHA-1 trailer and
  writes `%LOCALAPPDATA%\XboxMod\index.patched.bundle` plus a hash manifest.
- `style/install-bundle.ps1` – elevated swap with backup, ACL restore and a
  version-drift guard.

## Investigation helpers

- `probe_cache.py` – schema and samples of `AsyncCache.db`.
- `list_scopes.py`, `key_shape.py`, `dump_scope.py` – what the app caches, and in which id spaces.
- `analyse_collections.py`, `inspect_layouts.py` – home/store collections and layout metadata.
- `probe_network.py` – backend URLs the app called and their error status.
- `probe_altids.py` – title id / package family name to product id mappings.
- `prepare_poc.py`, `inject_metadata.py`, `verify_injection.py` – the `product_summary`
  experiment (proved that the product page does not read the local cache).
- `cleanup_poc.py` – removes that experiment's synthetic rows and entries.
- `capture-window.ps1` – screenshot a window (including a background one) without
  taking focus: `-ProcessId <pid> -TitleLike XBOX`.
- `list-windows.ps1` – enumerate windows with pid, class, title and size.
- `uia-dump.ps1`, `uia-combo.ps1`, `uia-addgame.ps1`, `uia-picker*.ps1`,
  `add_deadzone_official.ps1`, `edit_custom_item.ps1` – UI Automation drive of the
  `Add a game` / `Edit` flows, kept for reference; the file recipe above is faster.

## Superseded

`add_custom_entry.py` and `custom_entry_art.py` write to the stale
`LocalState\CustomLibraryManagement\` copy. Use `custom_library.py`.
