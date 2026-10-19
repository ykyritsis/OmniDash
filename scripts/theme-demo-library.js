// Review helper (theme-review.cjs, DEMO_LIBRARY_SCRIPT): swaps the demo library's stand-in titles for the
// mainstream games used in the README captures, and gives the profile a neutral gamerpic. It changes no app
// code and no real library: only the hidden demo window. The covers themselves are seeded into the demo
// profile's artwork under the same demo ids, so this script only renames and re-orders the six games.
(() => {
  const games = [
    { id: 'demo-1', reviewId: 'readme-1', title: 'Call of Duty: Modern Warfare III', appId: '2519060', size: 78.4 * 1024 ** 3 },
    { id: 'demo-2', reviewId: 'readme-2', title: 'FIFA 23', appId: '1811260', size: 52.6 * 1024 ** 3 },
    { id: 'demo-3', reviewId: 'readme-3', title: 'Grand Theft Auto V', appId: '271590', size: 105 * 1024 ** 3 },
    { id: 'demo-4', reviewId: 'readme-4', title: 'Red Dead Redemption 2', appId: '1174180', size: 115 * 1024 ** 3 },
    { id: 'demo-5', reviewId: 'readme-5', title: 'Elden Ring', appId: '1245620', size: 49.7 * 1024 ** 3 },
    { id: 'demo-6', reviewId: 'readme-6', title: 'Apex Legends', appId: '1172470', size: 56.2 * 1024 ** 3 }
  ];
  games.forEach((meta, index) => {
    const game = state.games.find(item => item.id === meta.id || item.id === meta.reviewId);
    if (!game) return;
    // A fresh id also invalidates the per-id backdrop cache, which otherwise keeps the old game's Steam hero.
    game.id = meta.reviewId;
    game.title = meta.title;
    game.provider = 'Steam';
    game.appId = meta.appId;
    game.sizeOnDisk = Math.round(meta.size);
    game.steamLastPlayed = Date.now() - index * 3600 * 1000;
    game.installed = true;
    game.isApp = false;
    game.isLauncher = false;
    game.steamType = 'game';
  });
  state.selectedGameId = 'readme-1';
  state.libraryCategory = 'games';
  state.playHistory = games.map(meta => meta.reviewId);
  state.playCounts = Object.fromEntries(games.map((meta, index) => [meta.reviewId, [17, 9, 41, 12, 23, 6][index]]));
  try { localStorage.removeItem('lastLaunched'); } catch { /* Storage unavailable. */ }

  // A neutral silhouette instead of the Steam profile picture the demo identity supplies.
  customAvatarData = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjggMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgZmlsbD0iIzJiMzEzOCIvPjxjaXJjbGUgY3g9IjY0IiBjeT0iNDgiIHI9IjIyIiBmaWxsPSIjOThhMmFkIi8+PHBhdGggZD0iTTIwIDEyMGMyLTI4IDIyLTQyIDQ0LTQyczQyIDE0IDQ0IDQyeiIgZmlsbD0iIzk4YTJhZCIvPjwvc3ZnPg==';
  selectedAvatarId = 'custom-uploaded';
  renderAvatarChoices();
  // Themes that copied the old Steam picture into their own chrome get the new one too.
  const avatarMarkupNow = document.querySelector('#profile-avatar').innerHTML;
  document.querySelectorAll('.g-account-avatar, .g-me-avatar').forEach(element => { element.innerHTML = avatarMarkupNow; });

  if (typeof selectGame === 'function') selectGame(state.selectedGameId, false);
  renderHomeLibrary();
  renderLibrary();
  // Helix's "My games" tile is a collage of covers from beyond the recent row. With only six demo games
  // there is nothing left to collage, so it would be an empty tile; fill it from the visible covers.
  const collage = document.querySelector('#recent-row .g-library-tile .g-collage');
  if (collage && !collage.querySelector('img')) {
    collage.innerHTML = [...document.querySelectorAll('#recent-row .game-card > img')].slice(0, 4)
      .map(image => `<span><img src="${image.src}" alt=""></span>`).join('');
  }
})()
