// Search everything at once: your library first, then the Xbox Store and the Steam Store, with prices.
// Store results open the same game pages as the Store does, and hidden games stay out of every list.
(function buildSearchEverything() {
  let timer = 0, request = 0;
  let store = { query: '', status: 'idle', xbox: [], steam: [], error: '' };
  const libraryCard = game => `<button class="g-store-card focusable" type="button" data-action="console-search-game" data-game-id="${escapeHtml(game.id)}" aria-label="${escapeHtml(game.title)}"><span class="g-store-art">${gameArt(game)}</span><span class="g-card-text"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.provider)}${game.installed === false ? ' · Not installed' : ''}</small></span></button>`;

  renderConsoleSearch = function () {
    const query = librarySearch.value.trim().toLocaleLowerCase();
    const count = document.querySelector('#console-search-count');
    const results = document.querySelector('#console-search-results');
    const matches = displayedLibraryGames().filter(game => !query || game.title.toLocaleLowerCase().includes(query));
    if (!query) {
      const shown = matches.slice(0, 60);
      count.textContent = 'Games and apps in your library';
      results.innerHTML = shown.length ? shown.map(libraryCard).join('') : `<div class="console-search-empty">${consoleIcon('search')}<h3>Your library is empty</h3><p>Add your games from My games &amp; apps to find them here.</p></div>`;
      refreshFocusables();
      return;
    }
    const current = store.query === query;
    const storeNote = !current || store.status === 'loading' ? 'searching the stores…' : store.status === 'error' ? 'stores unavailable' : '';
    count.textContent = `${matches.length} in your library${storeNote ? ` · ${storeNote}` : ''}`;
    const libraryHtml = matches.length ? `<h2 class="g-search-head">Your library</h2>${matches.slice(0, 12).map(libraryCard).join('')}` : '';
    const xbox = current ? store.xbox.slice(0, 12) : [], steam = current ? store.steam.slice(0, 12) : [];
    const storeHtml = (xbox.length ? `<h2 class="g-search-head">Xbox Store</h2>${xbox.map(game => gStoreResultCard(game, 'xbox')).join('')}` : '')
      + (steam.length ? `<h2 class="g-search-head">Steam Store</h2>${steam.map(game => gStoreResultCard(game, 'steam')).join('')}` : '');
    const body = libraryHtml + storeHtml;
    results.innerHTML = body || `<div class="console-search-empty">${consoleIcon('search')}<h3>No matches for “${escapeHtml(query)}”</h3><p>${current && store.status === 'ready' ? 'Try another name or a shorter search.' : 'Looking in the stores…'}</p></div>`;
    refreshFocusables();
  };

  async function runStores(query) {
    const id = ++request;
    store = { query, status: 'loading', xbox: [], steam: [], error: '' };
    renderConsoleSearch();
    try {
      const result = await window.launcher.searchStore(query);
      if (id !== request) return;
      const xbox = (result.xbox || []).filter(game => !gHiddenMatch(game));
      const steam = (result.steam || []).filter(game => !gHiddenMatch(game));
      store = { query, status: 'ready', xbox, steam, error: '' };
      // The Store's own handler reads these lists when a result is opened.
      gStoreSearch.query = query;
      gStoreSearch.results = { xbox, steam, error: '' };
      for (const game of steam) gRememberSteamGame(game);
    } catch (error) {
      if (id !== request) return;
      store = { query, status: 'error', xbox: [], steam: [], error: error.message || '' };
    }
    renderConsoleSearch();
  }
  librarySearch.addEventListener('input', () => {
    clearTimeout(timer);
    const query = librarySearch.value.trim();
    if (query.length < 2) { request++; store = { query: '', status: 'idle', xbox: [], steam: [], error: '' }; return; }
    timer = setTimeout(() => runStores(query), 380);
  });

  // Opening a store result from search closes the search first, as the Store does with its own pages.
  const perform = performAction;
  performAction = async function (action, source) {
    if (action === 'g-store-result') { const dialog = document.querySelector('#console-search-dialog'); if (dialog?.open) dialog.close(); }
    return perform(action, source);
  };
})();
