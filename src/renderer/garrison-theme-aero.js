// Aero: the Series dashboard redrawn in Frutiger Aero. A sunny island sea fills the screen, the last game is
// one big square tile beside smaller glossy square tiles, four glass cards sit beneath (My games & apps,
// Friends, Game Pass, Achievements), then the Store row and Customize. It is a skin of Series
// (body[data-g-theme="series"][data-g-skin="aero"]), so navigation, Settings and boot build on the Series' own.
//
// Pressing a game on Home starts it and shows the launching page; only the library opens a game's page.
// Artwork is always the square cover first (artwork.tile), never a wide hero cropped to fit.
(() => {
  'use strict';
  const on = () => document.body.dataset.gSkin === 'aero';
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])));
  const cssUrl = value => value ? `url(&quot;${esc(value).replaceAll('"', '%22')}&quot;)` : '';
  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  const square = game => game?.artwork?.tile || game?.artwork?.grid || '';
  const recent = () => (typeof homeRecentGames === 'function' ? homeRecentGames() : []).filter(game => !game.isApp);
  const installed = () => (state.games || []).filter(game => !game.isApp && game.installed !== false);
  const findGame = id => (state.games || []).find(game => game.id === id);
  const launchable = game => game && !game.isApp && game.installed !== false && !game.remoteHostId;
  const row = document.querySelector('#recent-row');
  const shelf = document.querySelector('#home-view .dashboard-recent');
  if (!row || !shelf) return;

  // ---------- Wallpaper: the island sea picture (assets/aero-background.webp), drawn by the stylesheet ----------
  const wall = document.querySelector('#g-theme-wall');
  const scene = document.createElement('div');
  scene.className = 'g-wall-aero';
  wall?.prepend(scene);
  // The picture is the backdrop, so the Series' per-game backdrop search (image loads and decodes on every move
  // along the row) is skipped entirely while Aero is on.
  if (typeof updateAmbient === 'function') {
    const ambientBase = updateAmbient;
    updateAmbient = function (...args) { return on() ? undefined : ambientBase.apply(this, args); };
  }

  // ---------- Drawn marks ----------
  const xboxOrb = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6.6 6.9c1.6.4 3.6 2 5.4 3.9 1.8-1.9 3.8-3.5 5.4-3.9 2.1 2.6 2.4 7 .6 10-.8-2.5-3.4-5.4-6-7.4-2.6 2-5.2 4.9-6 7.4-1.8-3-1.5-7.4.6-10Z" fill="currentColor"/></svg>';
  const storeBag = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 15h28l-2 27H12Z" fill="#fff"/><path d="M17 15v-3a7 7 0 0 1 14 0v3" fill="none" stroke="#fff" stroke-width="3"/><rect x="17" y="22" width="6.5" height="6.5" fill="#f25022"/><rect x="24.5" y="22" width="6.5" height="6.5" fill="#7fba00"/><rect x="17" y="29.5" width="6.5" height="6.5" fill="#00a4ef"/><rect x="24.5" y="29.5" width="6.5" height="6.5" fill="#ffb900"/></svg>';
  const trophy = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3V3Zm0 4H6v1a2 2 0 0 0 1 1.7V7Zm10 0v2.7A2 2 0 0 0 18 8V7h-1Z" fill="currentColor"/></svg>';
  // A mosaic of your own square covers, used as the art behind the Game Pass and Store tiles.
  const mosaic = (games, count) => `<span class="g-aero-mosaic" aria-hidden="true">${games.slice(0, count).map(game => `<i style="background-image:${cssUrl(square(game))}"></i>`).join('')}</span>`;
  // A full-bleed banner of square covers side by side (the shape of the console's wide Game Pass card).
  // My games & apps: one large square cover and six small ones in a bento grid.
  const collage = games => `<span class="g-aero-collage" aria-hidden="true">${games.slice(0, 5).map(game => `<i style="background-image:${cssUrl(square(game))}"></i>`).join('')}</span>`;
  // A frosted backdrop made from one cover, blurred once (it never moves, so it costs nothing per frame).
  const frost = game => game ? `<span class="g-aero-frost" aria-hidden="true" style="background-image:${cssUrl(square(game))}"></span>` : '';
  const strip = (games, count) => `<span class="g-aero-strip" aria-hidden="true">${games.slice(0, count).map(game => `<i style="background-image:${cssUrl(square(game))}"></i>`).join('')}</span>`;
  // Game Pass and Store art comes from the Game Pass catalog (its own square box art), never from your library.
  let catalog = Array.isArray(state.gamePassCatalog) ? state.gamePassCatalog.filter(square) : [];
  let catalogLoading = null;
  function loadCatalog() {
    if (catalog.length || catalogLoading || typeof window.launcher?.getGamePassCatalog !== 'function') return;
    catalogLoading = window.launcher.getGamePassCatalog().then(list => {
      if (Array.isArray(list)) { state.gamePassCatalog ||= list; catalog = list.filter(square); }
      if (on() && catalog.length) paint();
    }).catch(() => {}).finally(() => { catalogLoading = null; });
  }
  // The catalog's own order is its featured order; skip anything you already own so it reads as discovery.
  const catalogPicks = () => {
    const owned = new Set((state.games || []).map(game => String(game.title || '').toLowerCase()));
    return catalog.filter(game => !owned.has(String(game.title || '').toLowerCase()));
  };

  // ---------- Row: one big square, four small squares, Game Pass and the Store ----------
  function decorateRow() {
    // One big square, five small squares, then your library: exactly the width of the dashboard, so nothing
    // hangs off the edge. Running this twice never adds a second library tile.
    const cards = [...row.querySelectorAll(':scope > .game-card')];
    cards.slice(6).forEach(card => card.remove());
    row.querySelectorAll(':scope > .g-library-tile, :scope > .g-aero-app').forEach(tile => tile.remove());
    const first = cards[0];
    if (first) {
      first.classList.add('g-aero-big');
      const game = findGame(first.dataset.gameId);
      if (!first.querySelector('.g-aero-name')) first.insertAdjacentHTML('beforeend', `<span class="g-aero-name">${esc(game?.title || '')}</span>`);
    }
    for (const card of row.querySelectorAll(':scope > .game-card')) card.classList.toggle('g-aero-running', running(findGame(card.dataset.gameId)));
    row.querySelector(':scope > .g-aero-focus') || row.insertAdjacentHTML('afterbegin', '<span class="g-aero-focus" aria-hidden="true"><strong></strong><small></small></span>');
    const count = installed().length;
    row.insertAdjacentHTML('beforeend', `<button class="g-aero-app lib focusable" type="button" data-action="library" aria-label="My games and apps">${mosaic(installed().filter(square).slice(6), 4)}<span class="g-aero-app-face"><i class="lib-icon">${icon('library')}</i><b>My games &amp; apps</b><small>${count} game${count === 1 ? '' : 's'}</small></span></button>`);
  }

  // ---------- The selected tile's name, over the row like the Series and Helix dashboards ----------
  const ago = at => { const days = Math.floor((Date.now() - at) / 86400000); return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : days < 30 ? `${days} days ago` : ''; };
  function showFocusTitle() {
    const label = row.querySelector(':scope > .g-aero-focus');
    if (!label) return;
    const focused = row.querySelector(':scope > .focused, :scope > :focus-visible');
    const game = focused?.classList.contains('game-card') ? findGame(focused.dataset.gameId) : null;
    const title = game?.title || (focused?.classList.contains('lib') ? 'My games & apps' : '');
    let meta = '';
    if (game) {
      const last = typeof lastPlayedAt === 'function' ? Number(lastPlayedAt(game)) || 0 : 0;
      meta = running(game) ? 'Playing now · Press A to resume' : [game.provider, last ? ago(last) : ''].filter(Boolean).join(' · ');
    } else if (title) meta = 'Everything installed on this PC';
    label.querySelector('strong').textContent = title;
    label.querySelector('small').textContent = meta;
    label.classList.toggle('on', Boolean(title) && !focused?.classList.contains('g-aero-big'));
  }
  new MutationObserver(() => { if (on()) showFocusTitle(); }).observe(row, { subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('focus', () => { if (on() && typeof refreshActiveGameSession === 'function') refreshActiveGameSession().then(() => { for (const card of row.querySelectorAll(':scope > .game-card')) card.classList.toggle('g-aero-running', running(findGame(card.dataset.gameId))); showFocusTitle(); }).catch(() => {}); });

  // ---------- Cards ----------
  const cardsHost = document.querySelector('#g-series-cards');
  const presence = friend => friend.game ? 'playing' : friend.state === 'online' ? 'online' : 'away';
  function friendsCard() {
    const friends = (state.gFriends?.friends || []).filter(friend => !['offline', 'unknown'].includes(friend.state));
    const playing = friends.filter(friend => friend.game);
    const order = [...playing, ...friends.filter(friend => !friend.game)];
    const shown = order.slice(0, 4);
    const avatar = friend => `<i class="g-aero-av ${presence(friend)}">${friend.avatar ? `<img src="${esc(friend.avatar)}" alt="" loading="lazy" />` : `<b>${esc(friend.name.slice(0, 1).toUpperCase())}</b>`}</i>`;
    const lead = playing[0];
    const line = lead ? `<strong>${esc(lead.name)}</strong> is playing ${esc(lead.game)}`
      : friends.length ? `<strong>${esc(friends[0].name)}</strong>${friends.length > 1 ? ` and ${friends.length - 1} other${friends.length === 2 ? '' : 's'}` : ''} online`
      : state.gFriends?.status === 'loading' ? 'Checking who’s online…' : 'No friends online right now';
    return `<button class="g-aero-card friends focusable" type="button" data-action="g-friends" aria-label="Friends">
      <span class="g-aero-head">${icon('friends')}Friends${friends.length ? `<em class="g-aero-count">${friends.length} online</em>` : ''}</span>
      <span class="g-aero-avs">${shown.map(avatar).join('')}${order.length > shown.length ? `<i class="g-aero-av more"><b>+${order.length - shown.length}</b></i>` : ''}${shown.length ? '' : `<i class="g-aero-av empty">${icon('addFriend')}</i>`}</span>
      <small class="g-aero-line">${line}</small>
    </button>`;
  }
  // Achievements: your Gamerscore, then the game you played last: its points out of 1,000, how many
  // achievements you have, and your latest unlock in it.
  function scoreCard() {
    const local = window.gLocalScore;
    const value = (document.querySelector('#profile-score-value')?.textContent || '').replace(/[^\d,]/g, '') || (local?.available ? local.points.toLocaleString() : '0');
    const game = recent()[0];
    const stats = game && local?.byApp?.[String(game.achievementReferenceAppId || game.appId || '')];
    const latest = stats?.recent?.[0];
    const pct = stats ? Math.round((stats.points / 1000) * 100) : 0;
    const body = !game ? '<small class="g-aero-latest">Play a game to start earning Gamerscore</small>'
      : !stats ? `<span class="g-aero-game"><span>${esc(game.title)}</span></span><small class="g-aero-latest">${local?.available === false || !local ? 'Achievements appear after Steam has synced this game' : 'This game has no Steam achievements'}</small>`
      : `<span class="g-aero-game"><span>${esc(game.title)}</span><em>${stats.points} / 1000G</em></span>
        <span class="g-aero-bar"><i style="width:${pct}%"></i></span>
        <small class="g-aero-latest">${latest ? `<b>${esc(latest.name)}</b> · ${latest.points}G` : 'No achievements unlocked yet'} · ${stats.unlocked}/${stats.total}</small>`;
    return `<button class="g-aero-card ach focusable" type="button" data-action="g-account" aria-label="Achievements, Gamerscore ${esc(value)}">
      <span class="g-aero-head">${trophy}Achievements</span>
      <span class="g-aero-score"><i class="g">G</i>${esc(value)}</span>
      ${body}
    </button>`;
  }
  function renderCards() {
    if (!cardsHost) return;
    const mine = (recent().length ? [...recent(), ...installed()] : installed()).filter(square);
    const unique = [...new Map(mine.map(game => [game.id, game])).values()];
    const count = installed().length;
    cardsHost.innerHTML = `
      <button class="g-aero-card mine banner focusable" type="button" data-action="library" aria-label="My games and apps">
        ${frost(unique[0])}${collage(unique.slice(1))}
        <span class="g-aero-head">${icon('library')}My games &amp; apps</span>
        <span class="g-aero-foot"><strong>${count} game${count === 1 ? '' : 's'}</strong><small>Ready to play</small></span>
      </button>
      ${friendsCard()}
      <button class="g-aero-card pass banner focusable" type="button" data-action="dashboard-gamepass" aria-label="Game Pass">
        ${frost(catalogPicks()[0])}${strip(catalogPicks(), 2)}
        <span class="g-aero-head">${xboxOrb}GAME PASS</span>
        <span class="g-aero-foot"><strong>Discover</strong><small>Hundreds of great games</small></span>
      </button>
      ${scoreCard()}`;
    loadCatalog();
  }
  // Only the cards whose data changed are redrawn, and never the one in focus (that would drop the focus ring).
  function refreshCard(selector, markup) {
    const old = cardsHost?.querySelector(selector);
    if (!old || old.classList.contains('focused')) return;
    old.outerHTML = markup();
    try { refreshFocusables(); } catch { /* Not ready yet. */ }
  }
  document.addEventListener('g-local-score', () => { if (on()) refreshCard('.ach', scoreCard); });
  window.addEventListener('player-score-updated', () => { if (on()) setTimeout(() => refreshCard('.ach', scoreCard), 0); });

  // ---------- Store row and Customize ----------
  const store = document.createElement('div');
  store.id = 'g-aero-store';
  store.setAttribute('role', 'group');
  store.setAttribute('aria-label', 'Store');
  const chip = (action, glyph, label) => `<button class="g-aero-chip focusable" type="button" data-action="${action}">${glyph}<span>${label}</span></button>`;
  store.innerHTML = `<h3>Store</h3><div class="g-aero-chips">
    ${chip('dashboard-store', `<i class="g-aero-chip-bag">${storeBag}</i>`, 'Browse the store')}${chip('dashboard-store', icon('tag'), 'DEALS')}
    ${chip('dashboard-gamepass', '<i class="g-aero-gp">GAME<br>PASS</i>', 'SUBSCRIPTIONS')}${chip('toggle-search', icon('search'), 'SEARCH')}
    <button class="g-aero-customize focusable" type="button" data-action="dashboard-customize"><i data-g-role="y"></i>Customize</button></div>`;
  shelf.append(store);

  function paint() {
    if (!on()) return;
    decorateRow();
    renderCards();
    try { refreshFocusables(); } catch { /* Not ready yet. */ }
  }
  if (typeof renderRecentGames === 'function') {
    const base = renderRecentGames;
    renderRecentGames = function (...args) {
      const result = base.apply(this, args);
      if (on()) paint();
      return result;
    };
  }
  const friendsBase = window.renderFriendsActivity;
  if (typeof friendsBase === 'function') window.renderFriendsActivity = function (...args) { const result = friendsBase.apply(this, args); if (on()) refreshCard('.friends', friendsCard); return result; };

  // ---------- Pressing a game ----------
  // Home: start it and show the launching page. A game that is not installed opens its page, where Install is.
  const running = game => Boolean(game && state.activeGameSession?.gameId === game.id);
  function launchFromHome(tile) {
    const game = findGame(tile?.dataset.gameId);
    if (!launchable(game)) return false;
    // Already running: go back to its window instead of starting it again.
    if (running(game)) { selectGame(game.id, false, tile); performAction('return-to-game', tile); return true; }
    selectGame(game.id, false, tile);
    launchSelectedGame();
    return true;
  }
  if (typeof performAction === 'function') {
    const actionBase = performAction;
    performAction = async function (action, source) {
      if (on() && action === 'select-game' && source?.closest?.('#recent-row') && launchFromHome(source)) return;
      return actionBase.call(this, action, source);
    };
  }
  // Home clicks: the Series boots from a click before the launcher's own handler; window capture runs first, so a
  // running game's tile resumes it here instead of starting a second copy.
  window.addEventListener('click', event => {
    if (!on()) return;
    const tile = event.target.closest?.('#recent-row .game-card[data-action="select-game"][data-game-id]');
    if (!tile || !running(findGame(tile.dataset.gameId))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    launchFromHome(tile);
  }, true);
  // Library: a press opens the game's page. The Series theme boots from any tile on click; window capture runs
  // before that document listener, so library tiles take the launcher's own select-game path instead.
  window.addEventListener('click', event => {
    if (!on()) return;
    const tile = event.target.closest?.('.game-card[data-action="select-game"][data-game-id]');
    if (!tile || tile.closest('dialog') || !tile.closest('#library-view')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    performAction('select-game', tile);
  }, true);

  // ---------- Launching page: the square cover, the title and the status, over the sea ----------
  const launchOverlay = document.querySelector('#launch-overlay');
  if (launchOverlay) {
    const title = document.createElement('div');
    title.className = 'g-aero-launch-title';
    title.setAttribute('aria-hidden', 'true');
    launchOverlay.append(title);
    new MutationObserver(() => {
      if (!on() || launchOverlay.hidden) return;
      const game = findGame(state.selectedGameId);
      title.innerHTML = `<strong>${esc(game?.title || '')}</strong>`;
    }).observe(launchOverlay, { attributes: true, attributeFilter: ['hidden'] });
  }

  // ---------- Controller moves between the three Home rows ----------
  if (typeof navigateConsoleHome === 'function') {
    const navBase = navigateConsoleHome;
    const groups = () => [row, cardsHost, store].filter(Boolean);
    const items = group => [...group.querySelectorAll('.focusable')].filter(el => el.offsetParent);
    const centre = el => { const box = el.getBoundingClientRect(); return box.left + box.width / 2; };
    navigateConsoleHome = function (direction, focused) {
      if (!on() || state.view !== 'home' || document.querySelector('dialog[open]')) return navBase.call(this, direction, focused);
      const list = groups();
      const at = list.findIndex(group => group.contains(focused));
      if (at < 0 || (at === 0 && direction !== 'down')) return navBase.call(this, direction, focused);
      if (direction === 'left' || direction === 'right') {
        const own = items(list[at]);
        const next = own[own.indexOf(focused) + (direction === 'left' ? -1 : 1)];
        if (next) setFocusedElement(next, { scroll: false });
        return true;
      }
      const target = list[at + (direction === 'down' ? 1 : -1)];
      if (!target) return true;
      const x = centre(focused);
      const next = items(target).sort((a, b) => Math.abs(centre(a) - x) - Math.abs(centre(b) - x))[0];
      if (next) setFocusedElement(target === row ? (row.querySelector('.selected') || next) : next, { scroll: false });
      return true;
    };
  }

  // Y opens Customize on Home, as the chip says.
  document.addEventListener('keydown', event => {
    if (!on() || event.key.toLowerCase() !== 'y' || event.ctrlKey || event.altKey || event.metaKey || state.view !== 'home' || document.querySelector('dialog[open]')) return;
    if (/^(input|textarea|select)$/i.test(document.activeElement?.tagName || '')) return;
    store.querySelector('.g-aero-customize')?.click();
  });

  // Switching into or out of the skin redraws Home: Series and Aero share the row, so it is rebuilt either way.
  let wasOn = on();
  new MutationObserver(() => {
    if (on() === wasOn) return;
    wasOn = on();
    try { if (typeof renderRecentGames === 'function') renderRecentGames(); } catch { /* Home not ready. */ }
    if (!wasOn) { try { refreshFocusables(); } catch { /* Not ready yet. */ } }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-g-skin'] });
  // Series redraws its own row and cards on several paths (theme switches, artwork arriving); whenever it does,
  // the Aero versions are put back.
  new MutationObserver(() => { if (on() && !row.querySelector(':scope > .g-aero-app') && row.querySelector(':scope > .game-card')) { decorateRow(); try { refreshFocusables(); } catch { /* Not ready yet. */ } } }).observe(row, { childList: true });
  if (cardsHost) new MutationObserver(() => { if (on() && cardsHost.querySelector(':scope > .g-series-card')) { renderCards(); try { refreshFocusables(); } catch { /* Not ready yet. */ } } }).observe(cardsHost, { childList: true });
  paint();
})();
