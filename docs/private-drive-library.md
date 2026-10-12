# Private Google Drive game library

> Historical preview documentation: the Google Drive provider and its setup controls have been removed from the current source. The instructions and test commands below apply only to the earlier prototype.

The launcher now includes a private library provider in `src/google-drive-provider.cjs`. Google Drive is the storage backend; no hosting server or public links are needed. This project uses Electron, so the prototype is implemented in Node rather than introducing a separate C# runtime.

## Recommended setup: a Games folder

Create a private folder called **Games** in Google Drive. Upload ZIPs of your complete playable Windows games, named with their versions:

```text
Games/
  Getaway-1.0.0.zip
  Another Game-1.2.0.zip
```

You can also use one subfolder per game:

```text
Games/
  Getaway/
    Getaway-1.0.0.zip
    cover.jpg
    hero.jpg
```

ZIPs can contain the game directory itself or its contents. The launcher reads executable paths and uncompressed sizes from the ZIP directory without downloading the whole package. It uses Google's SHA-256 checksum and verifies the completed download before extraction. If Google has not supplied a checksum yet, that package shows an issue and stays unavailable until a successful refresh. Use unencrypted ZIPs with standard stored/deflate compression; ZIP64 is supported. Ambiguous game executables are shown for you to choose once. PNG, JPEG and WebP artwork is optional. For flat layouts, name artwork `Getaway-cover.jpg` and `Getaway-hero.jpg`.

In **Settings → Library → Private Google Drive library**, import your Google Desktop OAuth credentials JSON once, then select **Connect Google Drive**. The launcher finds Games automatically. If more than one Games folder exists, choose the correct one from the list. Games install under `Documents/Xbox Games` by default; existing configured installation locations are retained. No manifest or file IDs are needed for this mode.

For updates, upload `Getaway-1.1.0.zip` beside the previous archive and select **Refresh games**. The highest numeric version is used. Versionless ZIPs use their Drive modification timestamp, so replacing the same file can be detected. Keep game titles and folder locations stable so the launcher retains the same identity across updates. Archives are never executed during discovery. Only ZIP packages are supported by this workflow.

The Google OAuth client is still required because Drive needs an authorized application to access private files. Create a Google Cloud project, enable Drive API, configure the consent screen and add yourself as a test user, create a **Desktop app** OAuth client, and download its JSON. The in-app credentials help describes these steps. Credentials are encrypted locally; do not paste them into chat or put them in the repository.

Connection status stays visible in the launcher: waiting for sign-in, securing authorization, inspecting games, ready, or an actionable error. Google's browser completion page reports the actual result and tries to close the tab. Browser security can prevent automatic closure of an externally opened tab; then close it yourself after the page confirms success. The launcher returns to the foreground when connection completes.

## Advanced manifest setup

1. Create a Google Cloud project and enable **Google Drive API**. Configure the Google OAuth consent screen for your own account and add yourself as a test user if the app is in testing.
2. Create an OAuth client of type **Desktop app**, then download its credentials JSON. Keep this file outside the repository.
3. Create a private `PrivateGameLibrary` folder on Drive. Upload your game ZIPs, artwork and `library.json`. Keep their sharing private; the signed-in Google account must have access.
4. Copy the file ID from the `library.json` Drive link: `https://drive.google.com/file/d/FILE_ID/view`.
5. In the launcher, open **Settings → Library** and scroll to **Private Google Drive library**. Expand **Google credentials help & advanced setup**, enter the optional manifest file ID, and import your OAuth credentials JSON. The launcher shows the installation folder.
6. Select **Connect Google Drive** and complete sign-in in your browser. The library loads automatically. Games appear in the combined library and the **Google Drive** source filter. Existing beta.8 manifest connections continue to work; to switch to automatic Games discovery, clear the advanced manifest ID and import the same credentials again.
7. Open a game and select **Install**. The installation dialog displays bytes, speed and progress. **Continue browsing** leaves the download running; **Cancel installation** cancels before the final replacement step.

Google sign-in uses a random loopback port, state validation and PKCE. The read-only Drive scope allows reading existing private packages. Google does not offer a folder-limited read-only scope; `drive.file` alone cannot read arbitrary pre-existing files. Credentials and refresh tokens are encrypted with Electron `safeStorage` on Windows. Tokens never enter the renderer. Disconnect removes the locally stored refresh token; revoke the app in your Google account to revoke its server-side permission as well.

Google's testing-mode OAuth setup can require reauthorization when refresh tokens expire. See [Google desktop OAuth documentation](https://developers.google.com/identity/protocols/oauth2/native-app) and [Drive download documentation](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

## Manifest format

```json
{
  "schemaVersion": 1,
  "games": [
    {
      "id": "getaway",
      "name": "Getaway",
      "version": "1.0.0",
      "archiveFileId": "REPLACE_WITH_ARCHIVE_FILE_ID",
      "executable": "Getaway.exe",
      "downloadSize": 123456,
      "installSize": 234567,
      "sha256": "REPLACE_WITH_64_CHARACTER_SHA256",
      "coverFileId": "REPLACE_WITH_COVER_FILE_ID",
      "heroFileId": "REPLACE_WITH_HERO_FILE_ID"
    }
  ]
}
```

Sizes are bytes. `downloadSize` must equal the ZIP file's length. `installSize` is the total uncompressed file size; it is enforced as an extraction limit. Artwork IDs are optional. Use PNG, JPEG or WebP. Artwork is cached by file ID; upload changed artwork as a new file and update its ID in the manifest.

Use stable lowercase game IDs such as `getaway`. Versions use two to four numeric components, such as `1.0`, `1.2.0` or `1.2.0.4`. Versions are compared numerically; `1.10.0` is newer than `1.9.0`. Prerelease suffixes are outside V1.

ZIP the **contents** of the playable directory. The executable path is relative to the archive root, and can include subfolders. Archive traversal, Windows device paths, alternate streams, duplicate paths and links are rejected before extraction. Full packages only; no patches.

## Publishing and updates

Create a ZIP, calculate its SHA-256 (`Get-FileHash -Algorithm SHA256`), measure the archive and total uncompressed file lengths, then upload the ZIP to Drive. Replace the game's version, package file ID, sizes and hash in `library.json`, retaining the same manifest file ID. Upload the new package before updating the manifest.

The launcher refreshes authenticated libraries on startup. Select **Refresh games** for an immediate check. Available updates appear in the private library settings list; select **Update** there. Updating a running game is blocked. A failed download, failed verification or failed extraction leaves the installed copy intact. Save files inside the installed directory are replaced by a full package update; keep saves in the game's normal user-data location.

Installations use `<chosen folder>/<game-id>`. Downloads use a `.zip.download` file in a unique staging directory on the same volume. After streaming SHA-256 verification, the launcher safely extracts, checks the executable, moves the previous installation to a backup, moves the new installation into place and atomically records its version. A transaction journal restores an interrupted uncommitted replacement on the next library read. Cancellation is disabled during the short commit step. Backups are preserved if recovery cannot finish.

Cached manifests, artwork, encrypted OAuth data and `installed-games.json` live in the launcher's user-data folder under `private-drive`. Installed games remain playable offline and after disconnect. Keep the same installation folder once games are installed. Game IDs in automatic mode are generated from their titles and containing folder; advanced manifests keep their explicit IDs.

## Verification

Run `node scripts/private-drive-test.cjs` and `node scripts/drive-discovery-test.cjs` on Windows. These use temporary libraries, simulated Google responses and real ZIP extraction. They verify OAuth callbacks and PKCE, encrypted token storage, installation and full updates, hash rejection, unsafe ZIP rejection, record-write rollback, cancellation, recovery, automatic folder discovery, executable choices, bounded range inspection and ZIP64 support. Publisher lifecycle tests also verify that sign-in windows close and report progress without depending on one exact post-login page.

Real Google account authorization and downloading your actual private game need your OAuth client, Drive manifest and packages. These have not been supplied, so live Drive verification remains to be done after configuration. Automated uploads/publisher UI, delta updates and save synchronization remain outside V1.
