# Beta 37

A bright white border and soft white glow now follow the selected control throughout the app: Home, local and remote game libraries, Store, navigation, Settings, menus and dialogs. The focus treatment follows each control's shape. Remote cards have one outline, and search fields highlight their surrounding pill without a second inner border.

Scrolling shelves and compact menus reserve space for the glow. Controller navigation still reaches the **My games** tile at the end of **Jump back in**. High contrast uses a solid ring, Windows contrast themes retain a system-colored outline, and reduced motion disables focus transitions. The effect uses the existing focus states and CSS; it adds no animation loop or artwork filter.

The Australian **MA15+** badge now uses the [official Australian Classification artwork](https://www.classification.gov.au/classification-ratings/what-are-ratings), including the hexagonal MA symbol and Restricted label. The image is bundled for offline use. Other classification badges retain their existing appearance.

Checked the real renderer at handheld and desktop sizes, shared keyboard/controller focus styles, search inputs, menus, remote cards, high contrast and reduced motion. Existing Home navigation and remote/storage checks cover end-of-row controller movement, install dialogs, streaming controls and regional rating labels. No live host pairing or real game launch was performed.

Includes the loading, artwork and streaming improvements from [beta 36](release-0.27.0-beta.36.md). Automatic stream completion still relies on the host tracking the game process; see [host game tracking](host-game-tracking.md).
