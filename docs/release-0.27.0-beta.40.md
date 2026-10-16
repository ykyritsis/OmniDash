# Beta 40

Store and search refreshes do less work and keep controller focus and decoded artwork when the cards have not changed. Searching now renders the results directly instead of building the browse grid first. Ownership is indexed once per rendered list, and currency formatters are reused.

Measured in the same isolated 1,500-game demo library at 1280 × 800, using the median of nine warm synchronous renderer calls:

| Repeated refresh | Beta 39 | Beta 40 |
| --- | ---: | ---: |
| Store, 36 games | 16.3 ms | 1.7 ms |
| Search, 60 results | 34.6 ms | 2.0 ms |

These measure repeated UI refresh work, including unchanged-card reuse; they are not network timings or a hardware handheld benchmark.

- A failed Store load stops and offers **Try again**, instead of recursively requesting the same unavailable lists.
- Store and Game Pass ownership checks reject missing IDs and conflicting editions, handle non-Latin names, and choose the installed/preferred library copy. Trademark symbols no longer interfere with duplicate matching.
- Controller navigation moves from the search field into the current result cards. Capital letters work in global search; old responses cannot replace a newer query during the debounce delay.
- Global search and Store search keep separate results. Browse loading preserves games opened from search, and late responses do not steal focus from Home or Game Pass.
- Game Pass hides leftover Store search controls. Missing or malformed prices display a store link instead of falsely claiming that a game is free.
- Concurrent Xbox browse and metadata requests share work. Every Xbox Store cache writer respects the cache limit, and each request retains its original region through completion.
- Game-page metadata has a 160-page memory limit. Sparse offline results retry after 30 seconds; useful saved pages remain available during an outage. Xbox details start alongside the Steam lookup, and the fallback reuses the same Xbox request.
- Editing a game's metadata or resetting settings prevents old requests from refilling invalidated caches. Background screenshot caching respects artwork edits and resets, and releases completed task results.

Validated with isolated Store/search interaction and layout checks at 1280 × 800, 1024 × 640 and 125% text scale, cache/ownership/price regression tests, regional classifications and media checks, large-library navigation and artwork checks, Home controller checks, and packaged Home/Library/game-page smoke captures. Release assets are checked against the packaged source, bundled streaming runtime and published SHA-256 checksums. No live remote pairing or game launch was performed.

Includes the [beta 39 Game Bar button](release-0.27.0-beta.39.md) and all earlier remote-play, storage, artwork and focus improvements.
