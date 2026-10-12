# Library connections in beta.11

Installed games do not require a launcher account sign-in here. Importing an account's uninstalled games is optional, with a different connection method for each publisher. Settings → Library keeps these choices together.

| Source | Installed games | Uninstalled games | What is required |
| --- | --- | --- | --- |
| Steam | Manifests and local Steam data | Steam Web API library | Your own API key and a SteamID, usually detected from the desktop client; game details must be visible to that key |
| Steam Family | Installed copies are detected normally | Steam Families shared library | Connect the Steam account with access to the Family; no Web API key needed |
| Epic Games | Local manifests | Legendary's account library | A separately installed and signed-in Legendary/Heroic helper |
| Ubisoft Connect | Installation registry and local shortcuts | Local configuration cache | Open Ubisoft Connect and load the intended account's library, then select Refresh library |
| EA app | Local shortcuts; account catalog install checks when connected | EA website account library | Optional sign-in on EA's official site in an isolated app window |
| Battle.net | Agent product database and local shortcuts | Account game records, including supported classics | Optional sign-in on Battle.net's official site in an isolated app window |
| Other supported launchers | Existing local discovery | Not connected in this build | Use the desktop launcher for account-owned games not installed here |

EA and Battle.net sign-in are preview integrations. Their parsers, pagination, cache handling, permissions and UI are covered by fixtures, but successful sign-in and entitlement retrieval still need live-account verification. Publisher changes, regional redirects, multi-factor requirements, bot checks or account privacy can prevent import. The app does not bypass them. If a connection fails, installed games remain available.

Ubisoft's list is the last library cached on this PC, not a live entitlement query. It may reflect the account most recently used in Ubisoft Connect. Battle.net account records can include trials or free accounts; appearing here is not proof of a paid license. DLC and launcher components are excluded where the source identifies them.

## Sign-in and storage

The EA and Battle.net websites run with no Node access, no launcher preload, denied browser permission requests, and isolated persistent browser sessions. Password fields stay on the publisher's website. EA authorization is held briefly in main-process memory to request the signed-in user's library; it is not returned to the renderer, written to the game-list cache, or logged.

Only the app's own publisher browser session and sanitized game list are saved. This does not sign you into or out of the publisher's desktop client. Disconnect clears that publisher's saved list and this app's browser session. Installed games stay in the launcher. Reset all launcher data also removes these app-owned connections; it does not delete games.

Account inventories are cached for six hours. On a failed refresh, an existing list stays available with a sign-in-again state. Authentication is never inferred solely from a successful page load: the app must retrieve a valid library response. Large EA libraries are paginated; an incomplete response does not replace a complete cached list.

## Steam Family

In Settings → Library → Steam → Steam Family, choose **Connect Steam Family**. If you have already signed in to Steam in the app's Store, that session can be used. Otherwise Steam's official sign-in page opens. The signed-in account is saved separately from the desktop Steam account, so account differences finish the connection instead of keeping the sign-in window open. No developer API key or pasted access token is needed for shared games.

The app reads Steam Families' shared-library response, includes eligible shared games, and labels them **Family**. Excluded games, DLC, tools and Steamworks redistributables are filtered out. Installed copies and owned games with the same Steam app ID remain a single entry. Steam handles whether a shared copy is currently available to play; the launcher does not reserve a family license.

The shared list is cached for six hours and reused offline. The temporary web token is held only while requesting the library, never exposed to the renderer or saved in the game-list cache. The connected Steam account ID is saved separately so a desktop account difference cannot block sign-in or hide the connected list. Family member IDs are not saved. Disconnect removes the cached Family list and disables import; it does not sign you out of the app's Steam Store. Steam Families uses an undocumented service, so live-account verification remains necessary and changes by Valve can affect this preview integration.

## Duplicate games

Settings → Library → **Duplicate games** offers **Show every copy** or **Show one preferred copy**. Automatic selection prefers installed copies, then the preferred launcher. You can override the choice per game. Matching uses the complete normalized title; sequels, remasters, and edition names stay separate. No game, artwork, launch setting or history is deleted.

The combined Home, library and search respect the preference. Browsing a specific source always shows that source's copy. Source collections also retain all their games. Titles that differ significantly between stores are not automatically merged.

## Installation

Steam uses its own installation workflow, with progress read from local manifests in the launcher. Drive selection, agreements and authentication can still open Steam UI.

Ubisoft uses its documented-by-client install URI. EA uses the catalog's content ID. Battle.net uses the installed client's game selector. When a specific action cannot be resolved safely, the button says **Open EA app** or **Open Battle.net**, not Install. No fabricated percentage or finished-install state is shown for these publishers. Scan again after installation to refresh local detection.

## Profile and PC Gamerscore

Open Settings → Library and select a service tile. Installed games are detected automatically. Connection pages apply account actions immediately and show sign-in, loading, success, cancellation, and failure status. Library tools retains Save changes for optional artwork keys. Steam Family has a separate connection inside the Steam page.

For Steam account games and scoring, select Get a key, paste your Steam Web API key, and select Link Steam account. The detected Steam account ID is used; another ID can be entered in Advanced. Game details must be visible to Steam's API. Epic account libraries currently require signed-in Legendary or Heroic; Ubisoft uses the desktop client's saved library. EA and Battle.net use their official sign-in pages in the launcher's separate browser session.

The default name and gamerpic come from the detected or linked Steam account when available. Custom names, presets and uploads are preserved.

PC Gamerscore is saved locally for each Steam account. Each game's full achievement catalog shares exactly 1,000 integer points. Rarer achievements get a larger share using weight `10 + 90 × (1 − √(p / 100))`, with rounding distributed deterministically to keep the total at 1,000. Unknown rarity uses weight 10. The allocation stays fixed on later syncs for the same catalog; a changed catalog redistributes the budget. Games without achievements award no points.

Only verified personal Steam unlocks earn points. Public catalogs and other platforms' reference lists earn none. Saved earned points remain after uninstalling or hiding a game. Older Preview score records need a successful full-catalog sync before conversion. Level is `floor(sqrt(total / 1000)) + 1`. This score is separate from Microsoft Gamerscore and is not sent to Xbox.

Profile → Your game scores shows per-game progress. Score calculator lets you edit sample achievements, rarities, and unlocks; examples never change earned points.

Sync is user-initiated, cached for a day, limited to small batches, and stops after repeated unavailable responses. It pauses when the app loses focus or a game is active. Global rarity is cached for a week. API keys are not stored in the score cache.

## Protocol references

The local-cache and publisher-client behavior was checked against the maintained integration work in [Playnite's library extensions](https://github.com/JosefNemec/PlayniteExtensions/tree/master/source/Libraries) and [Jeshibu's EA library extension](https://github.com/Jeshibu/PlayniteExtensions/tree/main/source/EaLibrary). This launcher has its own implementation; neither project endorses it. Publisher interfaces can change independently of either project.

Steam's [User Stats API](https://partner.steamgames.com/doc/webapi/ISteamUserStats) supplies personal progress and global rarity. Store metadata remains a best-effort reference, not a guarantee that a particular PC edition has identical features to a console edition.
