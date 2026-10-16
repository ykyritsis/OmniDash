# Beta 39

The **Xbox logo at the top left opens Windows Game Bar**. The Friends icon beside it keeps its own button and action. Each button has a minimum 44 × 44 pixel touch target, an accessible label, keyboard/controller navigation and the shared white focus glow.

The shortcut calls Windows through the [Game Bar launch protocol](https://learn.microsoft.com/en-us/xbox/game-bar/api/xgb-widgetcontrol#uri-scheme). If Windows cannot open it, the app shows a clear message and lets you try again. The physical controller Guide button keeps its existing Windows behavior.

Checked pointer and keyboard activation through the real preload/main-process route, left/right controller focus, the separate Friends flyout, failure/retry handling, and layouts at 1920 × 1080, 1280 × 800, 1024 × 640 and enlarged text. The review intercepted the operating-system launch; it did not open the live overlay or launch a game.

Includes all [beta 38 performance improvements](release-0.27.0-beta.38.md): page-specific library refreshes, reused duplicate grouping and play history, bounded hidden card pages, and artwork updates that preserve focus and scrolling. The 1,500-game development fixture measured Home refresh at 14.3 ms versus 32.0 ms before the optimization and Library refresh at 10.0 ms versus 29.0 ms.
