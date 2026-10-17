# 0.6.0 — install choices, handheld quick settings and a console-style launch

This release also carries the 0.5.1 audit pass ([notes](release-0.5.1.md)): the security, performance and settings fixes listed there.

## Installing

- **Choose what to install.** The install sheet now lists the DLC that ships files, with the size of each, and the language packs for games that split by language, such as Call of Duty. Add-ons over 2 GB are flagged. Select all and Select none are there, and the total updates against free space on the drive you pick. Your choice is remembered for next time.
  - DLC you don't own is shown greyed with its price. Steam only downloads what you own.
  - The choices are carried out through Steam's own switches (`SetDLCEnabled` and `SetAppCurrentLanguage`) as the download starts.
  - Without Steam's download controls the launcher can't see which add-ons you own, so it lists them all and says so.

## Launching

- **Cancelling really cancels.** Cancel used to hide the launch screen; the game could still start. It now asks Steam to cancel, checks whether the game is running or about to start, closes it if so, and only says "Launch cancelled" once nothing is left. The screen shows "Cancelling" until then. If a game can't be closed, or a store launcher gives the launcher nothing to close, it says so instead of claiming success. Programs the launcher started directly are closed as a tree.
- **Console-style launch screen.** It grows out of the tile you pressed and dims the interface behind it. It shows the game's art on a dark base taken from its colours, plus its logo, and nothing else. Status, Cancel and the B hint appear after 6 seconds, on a first press of B, on mouse movement, or when Steam asks something. One small ring appears after about 2 seconds.
- **Live stages.** While a game starts, the screen says what it's waiting for.

## Handheld

- **Quick settings** (the speaker button in the top bar): battery, Wi-Fi, volume, brightness and the Windows power plan, with controller-friendly buttons. A part a PC doesn't have, such as a battery on a desktop, is left out.
- **Pause downloads while you play.** Downloads wait while a game runs and continue when it closes. They only resume what the launcher paused, and they leave downloads alone if you resume them yourself mid-game. A switch is in Settings → Account → Playing.
- **Controller vibration** on confirm and launch, with its own switch.

## Library and game pages

- **Smart collections** in the Filter menu: Not played yet, Recently added, Played a lot (20 h+), Large installs (50 GB+), Co-op games and Single-player.
- **Friends playing now** and **Your captures** under a game's gallery. Captures are Steam screenshots for the game and Xbox Game Bar captures named after it. Selecting one opens it.

## Themes

- **Choose your dashboard** in onboarding's Welcome step or Settings → Appearance. Your games, settings and controls stay the same; only the look changes.
  - **Helix:** the full-screen Xbox PC look this launcher started with.
  - **Series:** the Xbox Series X|S dashboard. The selected game's art fills Home behind a low row of square tiles, with the green swirl behind. The icon bar names the active item.
  - **One:** the 2013 Xbox One dashboard. Panorama headings across the top, a Pins wall, a big last-played tile with recent games around it, a planet-horizon wallpaper, and square corners everywhere.

## Not included

- **Steam Cloud warning before launch:** Steam already holds a launch until saves sync, and its pending-sync call returns an object I couldn't check against a real unsynced save.
- **Profile switching** for a shared handheld: settings are not per-profile, so this is a larger change.

## Checked and not checked

New logic has unit tests (add-on sizing, the install sheet, the download pause rule, smart collections, quick settings parsing, captures, and the launch stopper), and the screens were checked in the app's demo mode. **Not yet checked on real hardware:** Steam accepting the DLC switch before a game is installed, quick settings on a handheld's battery, brightness and Wi-Fi, and a cancelled launch against a real running game.
