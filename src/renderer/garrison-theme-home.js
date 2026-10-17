// Home extras for the console themes.
//
//  - Series: the selected game's art fills the screen behind Home. Garrison turns the backdrop off
//    (updateAmbient is a no-op there), so the Series theme feeds it directly: the game's wide hero art,
//    or one of its screenshots when it has none. Under the tiles sits the Series' row of wide cards.
//  - One: a Spotlight panel after the recent tiles (the 2013 dashboard's ad column, with made-up promos that
//    open real pages), and LB/RB move between the panorama headings.
//
// Every card uses an action the launcher already handles, so nothing here is decoration only.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const shelf = document.querySelector('#home-view .dashboard-recent');
  if (!shelf) return;
  const random = list => list[Math.floor(Math.random() * list.length)];
  const art = game => game?.artwork?.hero || game?.artwork?.wide || '';
  const bg = url => url ? ` style="--g-card-art:url(&quot;${escapeHtml(url).replaceAll('"', '%22')}&quot;)"` : '';
  const installedGames = () => state.games.filter(game => !game.isApp && game.installed !== false);

  // ---------- Series: backdrop ----------
  // A library's "hero" is often a square cover or a small store header, which the backdrop (rightly) refuses.
  // So candidates are tried in order and the first real wallpaper wins: hero, wide art, the screenshots
  // the library already has, then the store's screenshots. The answer is remembered per game.
  const backdropCache = new Map();
  const list = value => (Array.isArray(value) ? value : value ? [value] : []).filter(item => typeof item === 'string' && /^(https?:|file:|data:image)/.test(item));
  const isWallpaper = async url => {
    if (typeof preloadAmbientImage !== 'function' || !(await preloadAmbientImage(url))) return false;
    const size = typeof ambientDimensions !== 'undefined' ? ambientDimensions.get(url) : null;
    return Boolean(size && size.width >= 900 && size.width / size.height >= 1.5);
  };
  window.gThemeBackdrop = game => findBackdrop(game);
  async function findBackdrop(game) {
    if (backdropCache.has(game.id)) return backdropCache.get(game.id);
    try {
      const tried = new Set();
      const tryAll = async urls => { for (const url of urls) { if (tried.has(url)) continue; tried.add(url); if (await isWallpaper(url)) return url; } return ''; };
      // Steam's library hero is the console-style key art: 3840 px wide, no logo, made to sit behind a dashboard.
      const steamHero = game.provider === 'Steam' && /^\d+$/.test(String(game.appId || '')) ? [`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.appId}/library_hero.jpg`] : [];
      let found = await tryAll([...steamHero, ...list(game.artwork?.hero), ...list(game.artwork?.wide), ...list(game.artwork?.screenshots).slice(0, 4)]);
      if (!found && typeof loadGamePageDetails === 'function') {
        const details = await loadGamePageDetails(game).catch(() => null);
        found = await tryAll(list(details?.screenshots).slice(0, 4));
      }
      backdropCache.set(game.id, found);
      while (backdropCache.size > 120) backdropCache.delete(backdropCache.keys().next().value);
      return found;
    } catch {
      // An artwork URL that cannot even be decoded just means no backdrop for this game.
      backdropCache.set(game.id, '');
      return '';
    }
  }
  let backdropToken = 0;
  function seriesBackdrop(game, force = false) {
    if (!game || typeof applyAmbientImage !== 'function') return;
    if (force) state.ambientKey = '';
    const token = ++backdropToken;
    const known = backdropCache.get(game.id);
    if (known !== undefined) { applyAmbientImage(game, known, 'artwork'); return; }
    findBackdrop(game).then(url => {
      if (token === backdropToken && state.selectedGameId === game.id && theme() === 'series') applyAmbientImage(game, url, 'artwork');
    }).catch(() => {});
  }
  if (typeof updateAmbient === 'function') {
    const garrisonAmbient = updateAmbient;
    updateAmbient = function (game, force) {
      if (theme() === 'series') return seriesBackdrop(game, force);
      return garrisonAmbient.call(this, game, force);
    };
  }
  const currentGame = () => state.games.find(game => game.id === state.selectedGameId) || state.remoteGames?.find(game => game.id === state.selectedGameId);

  // ---------- Series: the wide cards under the tiles ----------
  const seriesRow = document.createElement('div');
  seriesRow.id = 'g-series-cards';
  seriesRow.setAttribute('role', 'group');
  seriesRow.setAttribute('aria-label', 'Featured');
  shelf.append(seriesRow);
  function renderSeriesCards() {
    const games = installedGames();
    const friends = Number(document.querySelector('#g-pill-count')?.textContent || 0);
    const pick = random(games.filter(art)) || games[0];
    const card = (action, title, body, extra = '', url = '', label = '') => `<button class="g-series-card focusable" type="button" data-action="${action}" ${extra}${bg(url)} aria-label="${escapeHtml(label || title)}"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(body)}</small></span></button>`;
    seriesRow.innerHTML = card('library', 'Browse your games', `${games.length} game${games.length === 1 ? '' : 's'} ready to play`, (games[1] || games[0]) ? `data-g-wide-art="${escapeHtml((games[1] || games[0]).id)}"` : '')
      + card('g-friends', friends ? `${friends} friend${friends === 1 ? '' : 's'} online` : 'Friends', friends ? 'See what they’re playing' : 'Find people to play with')
      + card('dashboard-gamepass', 'Game Pass', 'Hundreds of high-quality games. One low monthly price.', '', '', 'Game Pass')
      + (pick ? card('discovery-game', `Spotlight: ${pick.title}`, 'Pick up where you left off', `data-game-id="${escapeHtml(pick.id)}" data-g-wide-art="${escapeHtml(pick.id)}"`) : '')
      + card('dashboard-store', 'Deals Unlocked', 'Save up to 75% this week. Ends soon.', '', '', 'Store deals');
  }

  // ---------- One: Spotlight ----------
  const spotlight = document.createElement('div');
  spotlight.id = 'g-one-spotlight';
  spotlight.setAttribute('role', 'group');
  spotlight.setAttribute('aria-label', 'Spotlight');
  shelf.append(spotlight);
  function renderSpotlight() {
    // The big Home tile already shows the last game, so Spotlight features others.
    const lastPlayed = typeof homeRecentGames === 'function' ? homeRecentGames()[0] : null;
    const games = installedGames().filter(game => game.id !== lastPlayed?.id);
    const pick = random(games.filter(art)) || games[0];
    const other = random(games.filter(game => game !== pick && art(game)));
    const glyph = { 'dashboard-gamepass': 'game', 'g-friends': 'friends', 'dashboard-store': 'shop', library: 'library' };
    const tile = (action, title, body, tone, extra = '', url = '') => `<button class="g-one-spot focusable ${tone}" type="button" data-action="${action}" ${extra}${bg(url)} aria-label="${escapeHtml(title)}">${!url && glyph[action] && typeof gIcon === 'function' ? gIcon(glyph[action]) : ''}<strong>${escapeHtml(title)}</strong><small>${escapeHtml(body)}</small></button>`;
    spotlight.innerHTML = `<h3>Spotlight</h3><div class="g-one-spot-grid">
      ${pick ? tile('discovery-game', pick.title, 'Featured in your collection', 'art big', `data-game-id="${escapeHtml(pick.id)}"`, pick.artwork?.tile || pick.artwork?.grid) : ''}
      ${tile('dashboard-store', 'Free games and more', 'Members save on deals every week', 'gold')}
      ${tile('dashboard-gamepass', 'Game Pass', 'New games added this month', 'green')}
      ${other ? tile('discovery-game', `Try ${other.title}`, 'Recommended for you', 'art', `data-game-id="${escapeHtml(other.id)}"`, other.artwork?.tile || other.artwork?.grid) : tile('library', 'My games & apps', 'Everything you own', 'green')}
      ${tile('g-friends', 'Party up', 'See who’s online', 'blue')}
    </div>`;
  }

  // Refresh the extras whenever Home redraws its row.
  if (typeof renderRecentGames === 'function') {
    const recentBase = renderRecentGames;
    renderRecentGames = function (...args) {
      const result = recentBase.apply(this, args);
      if (theme() === 'series') renderSeriesCards();
      if (theme() === 'one') { renderSpotlight(); requestAnimationFrame(() => homeInView()); }
      return result;
    };
  }
  if (typeof showView === 'function') {
    const homeViewBase = showView;
    showView = function (next, ...rest) {
      const result = homeViewBase.call(this, next, ...rest);
      if (next === 'home') requestAnimationFrame(() => homeInView());
      return result;
    };
  }
  function applyTheme() {
    if (theme() === 'series') { renderSeriesCards(); const game = currentGame(); if (game) seriesBackdrop(game, true); }
    if (theme() === 'one') renderSpotlight();
    try { refreshFocusables(); } catch { /* Not ready yet. */ }
  }
  new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  applyTheme();

  // ---------- One: the panorama scrolls sideways ----------
  // Home opens with the big tile in view and Pins off to the left, like the console; the panorama follows
  // focus, keeping the focused group fully on screen.
  const gutter = () => parseFloat(getComputedStyle(shelf).paddingLeft) || 0;
  function homeInView(smooth = false) {
    if (theme() !== 'one') return;
    const recent = shelf.querySelector('#recent-row');
    if (recent) shelf.scrollTo({ left: Math.max(0, recent.offsetLeft - gutter()), behavior: smooth ? 'smooth' : 'auto' });
  }
  shelf.addEventListener('focusin', event => {
    if (theme() !== 'one') return;
    const group = event.target.closest('#g-one-pins, #recent-row, #g-one-spotlight');
    if (!group) return;
    const left = group.offsetLeft - gutter(), right = group.offsetLeft + group.offsetWidth + gutter() - shelf.clientWidth;
    const target = group.id === 'g-one-pins' ? 0 : group.id === 'recent-row' ? left : Math.max(right, Math.min(shelf.scrollLeft, left));
    shelf.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  });

  // ---------- Both consoles: A on a tile boots the game ----------
  // Neither the One nor the Series opens a game page first: pressing a tile starts the game, and its page
  // ("Manage game" / game hub) is under the Menu button. Games that aren't installed still open their page,
  // which is where Install lives, and remote-play tiles keep their own flow.
  document.addEventListener('click', event => {
    if (theme() === 'helix') return;
    const tile = event.target.closest?.(':is(.game-card, .g-boot-tile)[data-action="select-game"][data-game-id]');
    if (!tile || tile.closest('dialog')) return;
    const game = state.games.find(item => item.id === tile.dataset.gameId);
    if (!game || game.isApp || game.installed === false || game.remoteHostId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectGame(game.id, false, tile);
    launchSelectedGame();
  }, true);

  // ---------- One: LB / RB move across the panorama ----------
  // Game Pass and Store both open the Store page, so the heading the player chose is remembered here and
  // lit, rather than worked out from the page.
  const viewOf = action => ({ home: 'home', library: 'library', 'dashboard-gamepass': 'store', 'dashboard-store': 'store' })[action];
  let chosen = null;
  const tabs = () => [...document.querySelectorAll('.top-center-nav .top-nav-button')].filter(tab => viewOf(tab.dataset.action));
  function lightHeading() {
    if (!['one', 'x360'].includes(theme())) return;
    const list = tabs();
    const current = chosen && viewOf(chosen.dataset.action) === state.view ? chosen : list.find(tab => viewOf(tab.dataset.action) === state.view);
    for (const tab of list) tab.classList.toggle('active', tab === current);
  }
  document.addEventListener('click', event => {
    const tab = event.target.closest?.('.top-center-nav .top-nav-button');
    if (tab) { chosen = tab; setTimeout(lightHeading, 0); }
  });
  if (typeof showView === 'function') {
    const viewBase = showView;
    showView = function (...args) { const result = viewBase.apply(this, args); lightHeading(); return result; };
  }
  const pageScroll = window.gPageScroll;
  window.gPageScroll = direction => {
    if (!['one', 'x360'].includes(theme()) || document.querySelector('dialog[open]') || !document.querySelector('#launch-overlay')?.hidden) return pageScroll?.(direction);
    const list = tabs();
    lightHeading();
    const at = Math.max(0, list.findIndex(tab => tab.classList.contains('active')));
    const next = list[(at + (direction > 0 ? 1 : -1) + list.length) % list.length];
    if (!next) return;
    if (typeof playUiSound === 'function') playUiSound('navigate');
    next.click();
  };
})();
