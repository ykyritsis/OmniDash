// Store search and pages for games you don't own, as in the Xbox app: search the Store, open any
// game's page with its price, and "View game" from Play with friends.

// Steam games without an Xbox listing live with the Steam discovery lists, so their pages, details and
// Buy button use the same path as the Steam charts.
function gRememberSteamGame(game) {
  if (!state.steamDiscovery || typeof state.steamDiscovery !== 'object') state.steamDiscovery = { mostPlayed: [], topSellers: [], upcoming: [], status: 'ready' };
  const list = Array.isArray(state.steamDiscovery.gViewed) ? state.steamDiscovery.gViewed : [];
  state.steamDiscovery.gViewed = [game, ...list.filter(item => item.id !== game.id)].slice(0, 60);
  return game;
}
function gOwnedCopy(game) {
  return state.games.find(item => (game.appId && item.provider === 'Steam' && String(item.appId) === String(game.appId))
    || (game.xboxProductId && item.xboxProductId === game.xboxProductId) || normalizeConsoleTitle(item.title) === normalizeConsoleTitle(game.title));
}
// Hidden games stay out of every search, the Store's included.
function gHiddenMatch(game) {
  return (state.hiddenGames || []).some(item => (game.appId && String(item.appId) === String(game.appId)) || normalizeConsoleTitle(item.title) === normalizeConsoleTitle(game.title));
}

// ---------- Store search ----------
const gStoreSearch = { query: '', results: null, loading: false, request: 0, timer: 0 };
function gStoreSearchField() {
  const toolbar = document.querySelector('#store-view .g-store-toolbar');
  if (!toolbar || toolbar.querySelector('.g-store-search')) return;
  toolbar.insertAdjacentHTML('afterbegin', `<label class="g-store-search">${gIcon('search')}<input id="g-store-query" class="focusable" type="search" autocomplete="off" spellcheck="false" placeholder="Search the Store" aria-label="Search the Store" /><button class="g-store-search-clear focusable" type="button" data-action="g-store-search-clear" aria-label="Clear search" hidden>${gIcon('close')}</button></label>`);
  const input = toolbar.querySelector('#g-store-query');
  input.value = gStoreSearch.query;
  input.addEventListener('input', () => {
    clearTimeout(gStoreSearch.timer);
    gStoreSearch.timer = setTimeout(() => gRunStoreSearch(input.value), 380);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') { clearTimeout(gStoreSearch.timer); gRunStoreSearch(input.value, true); }
    if (event.key === 'Escape' && input.value) { event.stopPropagation(); event.preventDefault(); gClearStoreSearch(); }
  });
}
async function gRunStoreSearch(value, focusResults = false) {
  const query = String(value || '').trim();
  gStoreSearch.query = query;
  if (query.length < 2) { gStoreSearch.results = null; gStoreSearch.loading = false; renderConsoleStore(); return; }
  const request = ++gStoreSearch.request;
  gStoreSearch.loading = true;
  renderConsoleStore();
  let results;
  try { results = await window.launcher.searchStore(query); }
  catch (error) { results = { xbox: [], steam: [], error: error.message || 'The Store couldn’t search right now.' }; }
  if (request !== gStoreSearch.request) return;
  gStoreSearch.loading = false;
  gStoreSearch.results = { xbox: (results.xbox || []).filter(game => !gHiddenMatch(game)), steam: (results.steam || []).filter(game => !gHiddenMatch(game)), error: results.error || '' };
  state.xboxStore = { ...(state.xboxStore || {}), gSearch: gStoreSearch.results.xbox };
  for (const game of gStoreSearch.results.steam) gRememberSteamGame(game);
  if (state.view !== 'store') return;
  renderConsoleStore();
  if (focusResults) setFocusedElement(document.querySelector('#console-store-grid .g-store-card') || document.querySelector('#g-store-query'), { scroll: true });
}
function gClearStoreSearch() {
  gStoreSearch.query = ''; gStoreSearch.results = null; gStoreSearch.loading = false; gStoreSearch.request++;
  const input = document.querySelector('#g-store-query');
  if (input) input.value = '';
  renderConsoleStore();
  setFocusedElement(input, { scroll: false });
}
function gStoreResultCard(game, kind) {
  const owned = gOwnedCopy(game);
  const caption = owned ? 'Owned' : gPrice(game.price) || 'View details';
  return `<button class="g-store-card focusable" type="button" data-action="g-store-result" data-kind="${kind}" data-game-id="${escapeHtml(game.id)}" aria-label="${escapeHtml(game.title)}"><span class="g-store-art">${gameArt(game)}</span><span class="g-card-text"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(caption)}${kind === 'steam' && !owned ? ' · Steam' : ''}</small></span></button>`;
}
const gSearchRenderStore = renderNativeStore;
renderNativeStore = function (grid) {
  gSearchRenderStore(grid);
  gStoreSearchField();
  const clear = document.querySelector('.g-store-search-clear');
  if (clear) clear.hidden = !gStoreSearch.query;
  document.querySelector('#store-view').classList.toggle('g-store-searching', Boolean(gStoreSearch.query.length >= 2));
  if (gStoreSearch.query.length < 2) return;
  const count = document.querySelector('#g-store-count');
  const focused = document.activeElement?.closest?.('.g-store-card')?.dataset.gameId;
  if (gStoreSearch.loading && !gStoreSearch.results) {
    if (count) count.textContent = '';
    grid.innerHTML = `<div class="g-score-loading"><span class="g-spinner"></span>Searching the Store…</div>`;
    refreshFocusables();
    return;
  }
  const { xbox = [], steam = [], error = '' } = gStoreSearch.results || {};
  const total = xbox.length + steam.length;
  if (count) count.textContent = `${total} result${total === 1 ? '' : 's'} for “${gStoreSearch.query}”`;
  grid.innerHTML = total
    ? (xbox.length ? `<h2 class="g-store-results-head">Xbox Store</h2>${xbox.map(game => gStoreResultCard(game, 'xbox')).join('')}` : '')
      + (steam.length ? `<h2 class="g-store-results-head">More on Steam</h2>${steam.map(game => gStoreResultCard(game, 'steam')).join('')}` : '')
    : `<div class="g-empty">${gIcon('search')}<h2>${error ? 'The Store couldn’t search right now' : `No results for “${escapeHtml(gStoreSearch.query)}”`}</h2><p>${escapeHtml(error || 'Check the spelling, or try a shorter name.')}</p></div>`;
  refreshFocusables();
  if (focused) setFocusedElement(grid.querySelector(`[data-game-id="${CSS.escape(focused)}"]`), { scroll: false });
};

// ---------- Pages for games you don't own ----------
async function gOpenSteamGamePage(appId, fallback = {}) {
  const id = String(appId || '');
  if (!/^\d{1,10}$/.test(id)) return;
  const owned = state.games.find(item => item.provider === 'Steam' && String(item.appId) === id);
  if (owned) { await openGameDetails(owned.id); return; }
  let item = null;
  try { item = await window.launcher.getSteamStoreItem(id); } catch (error) { if (!fallback.title) { showToast(error.message || 'Steam doesn’t list this game'); return; } }
  const game = gRememberSteamGame({ id: `steam-store-${id}`, appId: id, provider: 'Steam', discoveryOnly: true, installed: false, controls: 'unknown', rank: 0,
    title: item?.title || fallback.title || 'Steam game', price: item?.price ?? null, artwork: item?.artwork || fallback.artwork || { tile: null, tileIsSquare: false } });
  await openGameDetails(game.id);
}
// The Buy button shows the Steam price, as Store pages do.
const gSearchInputMethods = renderDetailInputMethods;
renderDetailInputMethods = function (game, details = {}) {
  const result = gSearchInputMethods(game, details);
  if (game?.discoveryOnly && !game.xboxProductId && game.appId && game.price !== undefined) {
    const button = document.querySelector('#detail-play');
    const price = game.price;
    if (button) button.innerHTML = `<strong>${!price ? 'View on Steam' : !price.list ? 'Get on Steam' : `Buy ${escapeHtml(gPrice({ ...price, discount: 0 }))}`}</strong>`;
  }
  return result;
};

// ---------- Play with friends: "View game" opens the game's page, owned or not ----------
const gSearchPerform = performAction;
performAction = async function (action, source) {
  if (action === 'g-store-search-clear') { gClearStoreSearch(); return; }
  if (action === 'g-store-result') {
    const kind = source.dataset.kind;
    const list = kind === 'xbox' ? gStoreSearch.results?.xbox : gStoreSearch.results?.steam;
    const game = (list || []).find(item => item.id === source.dataset.gameId);
    if (!game) return;
    const owned = gOwnedCopy(game);
    if (owned) { await openGameDetails(owned.id); return; }
    if (kind === 'steam') gRememberSteamGame(game);
    await openGameDetails(game.id);
    return;
  }
  if (action === 'g-friend-join') {
    const friend = state.gFriends?.friends?.find(item => item.id === source.dataset.friendId);
    if (friend && !friend.lobby && friend.gameId) {
      await gOpenSteamGamePage(friend.gameId, { title: friend.game, artwork: { tile: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${friend.gameId}/library_600x900.jpg`, tileIsSquare: false } });
      return;
    }
  }
  return gSearchPerform(action, source);
};
