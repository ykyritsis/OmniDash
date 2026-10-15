# Beta 36

**Jump back in** now scrolls horizontally with controller focus, including the **My games** tile at the end. Moving left, holding a direction, and returning from the top bar keep the selected tile visible on handheld displays and with enlarged text.

Remote artwork fills in existing cards instead of rebuilding Home for every image. Availability checks retain the Home row and focus, and Home collections render once per library refresh. The hidden legacy Home wordmark no longer requests a logo on each game selection.

Game-page loading and focus prefetch share a small, bounded cache for local, remote and store games. Keys include the player's region and game metadata identity; failed requests remain retryable. Remote games now receive the same idle focus prefetch as local games. Prefetch pauses during gameplay and inactivity.

Artwork caching indexes files once, checks cached-file hits for deletion, shares duplicate downloads and limits downloads to four across callers. Failed sources have a short retry backoff. Remote cover work is limited to three jobs across hosts, Home requests are batched per PC, and unchanged artwork no longer emits redraw events or rewrites host settings. Background host checks pause when the app is inactive and refresh on return.

When the streaming engine ends before the next host-status poll, the launcher now checks authenticated host state before publishing the game page. A host-reported game exit returns to **Play remotely** without leaving stale **Resume game** state. A network failure is never treated as proof that a game closed, and the client never automatically cancels a game the host still reports running. Manual Disconnect and End session retain their existing behavior.

Automatic exit still depends on the host tracking the game process. A detached Steam shortcut can leave Sunshine/Apollo/Vibepollo reporting a session after the game closes. The optional [host tracking wrapper](host-game-tracking.md) fixes affected shortcuts when configured for their actual executable; the client cannot inspect a remote process list through the standard streaming protocol. This release does not automatically edit host configurations.

Validated the real renderer's controller navigation at 1920×1080, 1280×800 and 1024×640, enlarged text, cover/status focus preservation, regional detail-cache isolation, retries and memory bounds. Regression checks cover stream completion/cancellation, discovery, storage and install dialogs, artwork reuse, concurrency limits and deleted-file recovery. The host wrapper passed a delayed harmless-process lifetime test. No live host pairing or real game launch was performed.

An isolated 1,500-game demo run measured library rendering at 47 ms versus 68 ms before these changes, Home transition at 87 ms versus 111 ms, and opening a game page at 65 ms versus 94 ms. These are single-run local UI measurements including two animation frames, not handheld streaming latency or a guarantee across devices; cache warmth and scheduling vary.

See the [remote play guide](remote-play.md) and [StreamLight parity audit](streamlight-parity.md).
