# 0.27.0-beta.8

Adds private Google Drive game hosting to the launcher. Connect a Google Desktop OAuth client and a private library manifest in Settings → Library. Games appear in the combined library and the Google Drive source filter.

- Browser sign-in with PKCE and encrypted local credentials/tokens.
- Cached game metadata and artwork, with startup and manual refresh.
- Downloads with progress, speed and cancellation; SHA-256 verification before extraction.
- Full-package installs and version checks, with Update controls in Library settings.
- Staged replacements, rollback and interrupted-install recovery; cached installed games remain playable offline.

See [private library setup](private-drive-library.md). Real Drive authorization requires your own OAuth client, manifest and packages. Automated publishing and save synchronization are outside this release.

Windows x64 installer and portable builds are in `dist/dashboard-027b8`. Packaging was performed from an isolated staging folder. All 48 packaged source files were verified against the workspace. Provider tests cover OAuth callbacks, installation, updates, invalid hashes, unsafe ZIPs, cancellation, rollback and recovery.
