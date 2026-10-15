# 0.27.0-beta.26

Library management, duplicate selection and Steam launch options now use the current dashboard styling, with readable controls and controller focus at desktop and handheld resolutions. Launch once uses temporary arguments; Save keeps them for future launches.

Game galleries remove repeated trailers and screenshots, including cached entries. Playable trailers are retained when providers return overlapping media.

Steam Store lookup shares requests, batches item details and caches results by region. Returning to the same search reuses recent metadata, partial lookup failures retain usable results, and clearing a search prevents older responses from repainting it.

Age ratings prefer the player's region. Automatic detection uses the Windows home country, with a manual override under **Settings → Language & region**. Australian ratings use G, PG, M, MA15+ and R18+ when available. Another board is a fallback when the local rating is unavailable; a store's minimum age is displayed as an age requirement rather than incorrectly labelled PEGI. Store and game-detail caches are separated by country.

Publisher and series collections now load finished local promotional artwork: **14 publisher cards and 12 series banners**, including their branding. The set follows the approved EA layout with recognisable campaign imagery and clean logos. Eighteen cards were edited with the built-in image generator; eight were composed directly from promotional artwork and authentic logo crops. These are unofficial collection designs. [Preview the complete set](collection-artwork/README.md); [prompts, methods and source references](collection-artwork-prompts.json).

Validation: regression checks for regional ratings, media deduplication, Steam lookup caching/request sharing, duplicate selection, launch options and updater compatibility; visual and controller checks at 1920×1080, 1280×800 and 1024×640. All 26 local artwork assets decode and use the expected aspect ratios, and the artwork set totals 3.78 MiB. Desktop/handheld checks use resized Windows app windows, not a physical handheld.

Packaged validation: all 131 bundled source files exactly match the workspace. The actual Windows executable opened Home, Library and a game page in an isolated demo profile, captured all three screens and exited successfully.

Windows x64 installer and portable builds are included with `SHA256SUMS.txt`. The existing built-in updater can discover this release.
