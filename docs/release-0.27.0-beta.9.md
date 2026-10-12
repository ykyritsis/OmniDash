# 0.27.0-beta.9

Library sign-in now shows a lasting status: waiting for sign-in, reading games, connected with a game count, or a specific error. EA, Battle.net and Steam Family windows close after verification. Detection checks the account session rather than waiting for one exact post-login page. Cancel controls are available while signing in. Reconnecting a publisher no longer deletes its saved library first.

Google Drive setup now discovers a private folder named **Games**. Upload ZIPs such as `Getaway-1.0.0.zip`, import a Desktop OAuth credentials JSON once, and connect. No hand-written manifest or copied file IDs are needed. Optional game subfolders can contain `cover.jpg` and `hero.jpg` alongside their ZIPs. Executables and installation sizes are read from the ZIP directory using small range requests; Google provides the package SHA-256. ZIP64 packages are supported. Ambiguous executable paths are presented for selection, and invalid packages have specific issue messages. The latest numeric filename version is used; names without versions use upload modification dates.

Google's external browser shows a completion page with the actual connection result and attempts to close its tab. Browsers can block script-driven closure of externally opened tabs; in that case the page explicitly confirms when it is safe to close, and the launcher is brought back to the foreground.

The package also unpacks the PowerShell extractor so installations work from packaged executables rather than relying on a script path inside `app.asar`.

See [private Drive setup](private-drive-library.md). Live Google and publisher account verification needs the user's own accounts; automated checks use isolated sessions and fixtures.
