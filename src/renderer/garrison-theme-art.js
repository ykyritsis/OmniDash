// The art rule for the console themes: a wide slot only ever shows wide art, a square slot only a cover.
//
// Elements that need wide art carry data-g-wide-art="<game id>". This finds a real wallpaper for the game
// (Steam's library hero, Xbox Super Hero Art, a wide screenshot; see garrison-theme-home.js) and sets it as
// --g-art. A game with no wide art gets the console fallback instead: its cover, sharp in the middle, over a
// blurred, darkened copy of itself, so a square cover is never stretched or cropped into a rectangle.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const found = new Map();
  const find = id => state.games?.find(game => game.id === id) || state.remoteGames?.find(game => game.id === id)
    || Object.values(state.xboxStore || {}).filter(Array.isArray).flat().find(game => game.id === id)
    || state.gamePassCatalog?.find(game => game.id === id);
  const cover = game => game?.artwork?.tile || game?.artwork?.grid || '';
  async function wideArt(game) {
    if (!game) return '';
    if (found.has(game.id)) return found.get(game.id);
    let url = '';
    // Catalogue items carry Super Hero Art, which is always wide; library games are checked properly.
    if (game.discoveryOnly || game.xboxProductId) url = game.artwork?.hero || game.artwork?.wide || '';
    else if (typeof window.gThemeBackdrop === 'function') url = await window.gThemeBackdrop(game).catch(() => '');
    found.set(game.id, url);
    return url;
  }
  window.gWideArt = wideArt;
  const css = url => `url("${String(url).replaceAll('"', '%22')}")`;
  async function upgrade(element) {
    const game = find(element.dataset.gWideArt);
    element.dataset.gArtDone = '1';
    const url = await wideArt(game);
    if (!element.isConnected) return;
    if (url) { element.style.setProperty('--g-art', css(url)); element.classList.remove('g-art-cover'); return; }
    const square = cover(game);
    if (!square) return;
    element.style.setProperty('--g-cover', css(square));
    element.style.removeProperty('--g-art');
    element.classList.add('g-art-cover');
    if (!element.querySelector(':scope > .g-cover-fallback')) element.insertAdjacentHTML('afterbegin', '<span class="g-cover-fallback" aria-hidden="true"><i></i></span>');
  }
  let queued = false;
  function scan() {
    queued = false;
    if (theme() === 'helix') return;
    // One's big Home tile is a library card: it gets wide art too, not its square cover.
    const big = document.querySelector('body[data-g-theme="one"] #recent-row > .game-card:first-child');
    if (big && big.dataset.gWideArt !== big.dataset.gameId) { big.dataset.gWideArt = big.dataset.gameId; delete big.dataset.gArtDone; }
    // A slot whose artwork URL cannot be read just stays as it is; it must not reject into the console.
    for (const element of document.querySelectorAll('[data-g-wide-art]:not([data-g-art-done])')) upgrade(element).catch(() => {});
  }
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(scan); } };
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(() => { found.clear(); document.querySelectorAll('[data-g-art-done]').forEach(el => delete el.dataset.gArtDone); schedule(); })
    .observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  schedule();
})();
