# 0.4.0

Library selections keep their rounded white glow, and Steam galleries show distinct trailer previews again.

- The Library tab bar now leaves room around its scrolling buttons for the full glow. Focused source filters also keep their halo at the row edges.
- Steam trailer thumbnails use the URLs supplied by Steam. Older builds requested a larger image that does not exist for many trailers, causing different videos to show the same fallback artwork. Previously cached preview URLs are repaired when displayed.
- Duplicate trailers are merged across repeated metadata, CDN/codec variants and overlapping sources, while retaining a playable copy. Distinct trailers remain available.
- Trailer cards show short titles, making videos identifiable even when a provider has no thumbnail. Refreshing a page replaces its trailer cards without multiplying them.
- The new updater ignores the retired 0.27.0 beta line, so it cannot offer those builds as an upgrade from 0.4.0.

## Version numbering and installation

This release starts the **0.4.0** version series. Feature releases will advance to **0.5.0**, **0.6.0**, and so on; small fixes can use patch versions such as **0.4.1**.

**Coming from 0.27.0-beta? Install 0.4.0 manually once.** Standard version ordering treats 0.27 as higher than 0.4, and the updater already installed in those older builds cannot recognize this reset. Download the new Setup executable and install it over your existing copy, or replace your portable executable. Settings remain in Windows app data. Updates after this transition use the new version sequence normally.

## Validation

- Library controller navigation and glow clearance at 1024 × 640, 1280 × 800 with 125% text scale, and 1920 × 1080.
- Real Steam thumbnails loaded for six distinct Ghosts trailers and six Infinite Warfare trailers, starting from the old cached URLs. Each card dispatched its own correct stream to an isolated test player; repeated rendering kept six cards. This checks player routing, not full video decoding.
- Regression checks for transitive duplicate matching, playable-copy preference, regional game metadata, Store caches, and updater startup, checksums, helper rollback and the version transition.
- Packaged source/runtime verification and Home, Library and game-page smoke captures; published installer and portable downloads checked against SHA-256 checksums.

Includes the performance, remote-play, storage, Game Bar, artwork and accessibility work from [beta 40](release-0.27.0-beta.40.md) and earlier releases. No live game launch or remote pairing was performed for this release.
