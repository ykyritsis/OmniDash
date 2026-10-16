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
// Xbox Store results have to be known to the game page, or it opens empty.
function gRememberXboxGame(game) {
  const list = Array.isArray(state.xboxStore?.gRemembered) ? state.xboxStore.gRemembered : [];
  state.xboxStore = { ...(state.xboxStore || {}), gRemembered: [game, ...list.filter(item => item.id !== game.id)].slice(0, 60) };
  return game;
}
// Hidden games stay out of every search, the Store's included.
function gHiddenMatch(game) {
  const title = libraryDuplicates.titleKey(game.title);
  return (state.hiddenGames || []).some(item => (game.appId && game.provider === 'Steam' && item.provider === 'Steam' && String(item.appId) === String(game.appId))
    || (game.xboxProductId && item.xboxProductId === game.xboxProductId) || (title && libraryDuplicates.titleKey(item.title) === title));
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
    gStoreSearch.request++;
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
  if (query !== gStoreSearch.query) gStoreSearch.results = null;
  gStoreSearch.query = query;
  const request = ++gStoreSearch.request;
  if (query.length < 2) { gStoreSearch.results = null; gStoreSearch.loading = false; if (state.view === 'store' && state.consoleStoreMode !== 'gamepass') renderConsoleStore(); return; }
  gStoreSearch.loading = true;
  if (state.view === 'store' && state.consoleStoreMode !== 'gamepass') renderConsoleStore();
  let results;
  try { results = await window.launcher.searchStore(query); }
  catch (error) { results = { xbox: [], steam: [], error: error.message || 'The Store couldn’t search right now.' }; }
  if (request !== gStoreSearch.request) return;
  gStoreSearch.loading = false;
  gStoreSearch.results = { xbox: (results.xbox || []).filter(game => !gHiddenMatch(game)), steam: (results.steam || []).filter(game => !gHiddenMatch(game)), error: results.error || '' };
  state.xboxStore = { ...(state.xboxStore || {}), gSearch: gStoreSearch.results.xbox };
  for (const game of gStoreSearch.results.steam) gRememberSteamGame(game);
  if (state.view !== 'store' || state.consoleStoreMode === 'gamepass') return;
  renderConsoleStore();
  if (focusResults) setFocusedElement(document.querySelector('#console-store-grid .g-store-card') || document.querySelector('#g-store-query'), { scroll: true });
}
function gClearStoreSearch() {
  clearTimeout(gStoreSearch.timer);
  gStoreSearch.query = ''; gStoreSearch.results = null; gStoreSearch.loading = false; gStoreSearch.request++;
  const input = document.querySelector('#g-store-query');
  if (input) input.value = '';
  renderConsoleStore();
  setFocusedElement(input, { scroll: false });
}
function resetRegionViews() {
  gStoreEpoch++;
  gStoreRequest = null;
  state.xboxStore = null;
  clearTimeout(gStoreSearch.timer);
  gStoreSearch.request++;
  gStoreSearch.results = null;
  gStoreSearch.loading = false;
  gPrefetched.clear();
  storeOfferEpoch++;
  storeOfferCache.clear(); storeOfferTimes.clear(); storeOfferRequests.clear(); storeOfferFailures.clear();
  const epoch = gStoreEpoch;
  window.launcher.getSteamDiscovery().then(discovery => {
    if (epoch !== gStoreEpoch) return;
    state.steamDiscovery = discovery;
    renderHomeCollections();
    if (state.view === 'store') renderConsoleStore();
  }).catch(() => {});
  if (gStoreSearch.query.length >= 2) gRunStoreSearch(gStoreSearch.query);
  loadXboxStore(true);
}
function gStoreResultCard(game, kind, ownership) {
  const owned = gOwnedCopy(game, ownership);
  const caption = owned ? 'Owned' : gPrice(game.price) || 'View details';
  return `<button class="g-store-card focusable" type="button" data-action="g-store-result" data-kind="${kind}" data-game-id="${escapeHtml(game.id)}" aria-label="${escapeHtml(game.title)}"><span class="g-store-art">${gameArt(game)}</span><span class="g-card-text"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(caption)}${kind === 'steam' && !owned ? ' · Steam' : ''}</small></span></button>`;
}
const gSearchRenderStore = renderNativeStore;
renderNativeStore = function (grid) {
  gSearchRenderStore(grid, { searching: gStoreSearch.query.length >= 2 });
  gStoreSearchField();
  const clear = document.querySelector('.g-store-search-clear');
  if (clear) clear.hidden = !gStoreSearch.query;
  document.querySelector('#store-view').classList.toggle('g-store-searching', Boolean(gStoreSearch.query.length >= 2));
  if (gStoreSearch.query.length < 2) return;
  const count = document.querySelector('#g-store-count');
  if (gStoreSearch.loading && !gStoreSearch.results) {
    if (count) count.textContent = '';
    gRenderStoreGrid(grid, `<div class="g-score-loading" role="status"><span class="g-spinner"></span>Searching the Store…</div>`);
    return;
  }
  const { xbox = [], steam = [], error = '' } = gStoreSearch.results || {};
  const total = xbox.length + steam.length;
  if (count) count.textContent = `${total} result${total === 1 ? '' : 's'} for “${gStoreSearch.query}”`;
  const ownership = gStoreOwnership();
  gRenderStoreGrid(grid, total
    ? (xbox.length ? `<h2 class="g-store-results-head">Xbox Store</h2>${xbox.map(game => gStoreResultCard(game, 'xbox', ownership)).join('')}` : '')
      + (steam.length ? `<h2 class="g-store-results-head">More on Steam</h2>${steam.map(game => gStoreResultCard(game, 'steam', ownership)).join('')}` : '')
    : `<div class="g-empty">${gIcon('search')}<h2>${error ? 'The Store couldn’t search right now' : `No results for “${escapeHtml(gStoreSearch.query)}”`}</h2><p>${escapeHtml(error || 'Check the spelling, or try a shorter name.')}</p></div>`);
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
    if (button) button.innerHTML = `<strong>${!gPrice(price) ? 'View on Steam' : price.list === 0 ? 'Get on Steam' : `Buy ${escapeHtml(gPrice({ ...price, discount: 0 }))}`}</strong>`;
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
    else gRememberXboxGame(game);
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

// Game Pass tiles carry the same title block as library tiles, with "Owned" for games you have.
// Owned titles are looked up once per library, not once per tile.
function gCatalogCardText(game, ownership) {
  const owned = gOwnedCopy(game, ownership);
  return `<span class="g-card-text"><strong>${escapeHtml(game.title)}</strong><small class="g-status">${owned ? 'Owned' : 'Game Pass'}</small></span>`;
}
