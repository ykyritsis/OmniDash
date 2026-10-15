# Beta 28

This preview adds remote game streaming through a bundled StreamLight runtime, improves Steam install sizing and adds a local storage overview.

## Remote play preview

- Pair Sunshine, Apollo and Vibepollo PCs from **Settings → Remote play**. StreamTweak is not required.
- Browse and search the host's published game library from **My games & apps → Remote PCs**.
- Keep the app's launch animation visible while connecting; embed the native video surface inside the launcher window once its session is ready.
- Return to the remote library when the host reports that the game has closed. Manual disconnect preserves the host game for resumption.
- Set resolution, frame rate and bitrate before starting a stream. Host certificate checks, bounded cover downloads, connection-loss handling and owned-process cleanup are included.

**Preview limits:** standard host session readiness does not guarantee that a game window is visible yet. Automatic game-exit detection requires the host to track the game rather than a persistent desktop or detached launcher. Live streaming against a paired PC and physical device combinations still need verification. See [setup and limits](remote-play.md).

## Installs and storage

![Steam size estimates during drive selection](install-size-estimates.png)

![Settings storage overview](storage-overview.png)

UI captures use a sample library and drive sizes.

- Steam drive selection displays **Download**, **Installed game** and **Space needed** separately, with an immediate loading state while estimates are fetched.
- Estimates include shared content depots and distinguish compressed downloads from unpacked files. Missing data is shown explicitly; the app does not present a partial depot sum as a complete download.
- Drives show estimated space left after installation. Insufficient space disables Install, and the backend checks free space again before creating the download request.
- **Settings → Storage** shows available drives, free/used space, known game sizes and installed games per drive. Sizes come from library records and the existing size cache; unknown sizes remain labelled.

## Validation

- Automated remote-session checks: duplicate launch prevention, readiness gating, cancellation, temporary network failures, game exit and private identity isolation.
- Native Windows checks: child-window parenting, delayed reveal, keyboard focus, resizing, surface disappearance and decoder cleanup.
- Actual StreamLight portable identity tested with mutual TLS and rejection of a mismatched host certificate.
- UI review at 1920×1080, 1280×800 and 1024×640, including controller focus, PIN pairing, library search, drive selection and storage.
- Live metadata check for Call of Duty: WWII including shared depots and the store's listed space requirement.

StreamLight 7.0.0 is bundled unchanged; its [source and license](remote-play.md#streaming-component-and-source) are linked in the repository and included with the runtime.
