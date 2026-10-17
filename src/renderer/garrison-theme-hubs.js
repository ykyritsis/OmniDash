// Pivot hubs for the One and 360 themes. On those consoles the headings across the top (and LB/RB) move
// between hubs inside the dashboard, each a band of tiles; only choosing a tile opens an app such as
// My Games, the Store or Settings, and B brings you back to the hub you left.
//
//  - 360: bing, home, social, games, game pass, apps, settings. Tiles use the DashX360 pack's console tile
//    art (My Games, Game Marketplace, My Apps, Friends, the settings icons) when it is installed.
//  - One: Pins, Home, Friends, Game Pass, Store. Pins and Home share the panorama, as on the 2013 console.
// Every tile runs an action the launcher already handles.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const hubTheme = () => ['one', 'x360'].includes(theme());
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text));
  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  const packUrl = rel => (window.gThemePack?.base ? window.gThemePack.base + rel.split('/').map(encodeURIComponent).join('/') : '');
  const bgStyle = url => url ? ` style="--g-art:url(&quot;${esc(url).replaceAll('"', '%22')}&quot;)"` : '';
  const recent = () => (typeof homeRecentGames === 'function' ? homeRecentGames().filter(game => !game.remoteHostId) : []);
  const apps = () => (state.games || []).filter(game => game.isApp);
  const wide = game => game?.artwork?.hero || game?.artwork?.wide || game?.artwork?.screenshots?.[0] || game?.artwork?.tile || '';
  const friends = () => (state.gFriends?.friends || []);
  const online = () => friends().filter(friend => friend.state !== 'offline' && friend.state !== 'unknown');

  const PIVOTS = {
    x360: [['bing', 'bing'], ['home', 'home'], ['social', 'social'], ['games', 'games'], ['gamepass', 'game pass'], ['apps', 'apps'], ['settings', 'settings']],
    one: [['pins', 'Pins'], ['home', 'Home'], ['friends', 'Friends'], ['gamepass', 'Game Pass'], ['store', 'Store']]
  };
  const sharedHome = id => theme() === 'one' && (id === 'pins' || id === 'home');
  let hub = 'home';

  // ---------- Tiles ----------
  // A tile: { size: 'full' | 'half', kind: 'lime' | 'art' | 'ad' | 'blue' | 'gold' | 'dark', label, sub, glyph, image, art, action, data }
  function tile(t) {
    const data = Object.entries(t.data || {}).map(([key, value]) => ` data-${key}="${esc(value)}"`).join('');
    const boot = t.action === 'select-game' ? ' g-boot-tile' : '';
    const picture = t.image ? `<img class="g-hub-img" src="${esc(t.image)}" alt="" onerror="this.remove()" />` : t.glyph ? icon(t.glyph) : '';
    return `<button class="g-hub-tile ${t.size || 'half'} ${t.kind || 'lime'}${boot} focusable" type="button" data-action="${esc(t.action)}"${data}${t.data?.progress != null ? ` style="--p:${Number(t.data.progress)}"` : bgStyle(t.art)} aria-label="${esc(t.label)}">
      ${picture}<span class="g-hub-label"><strong>${esc(t.label)}</strong>${t.sub ? `<small>${esc(t.sub)}</small>` : ''}</span></button>`;
  }
  const column = (width, tiles, extra = '') => `<div class="g-hub-col ${width}">${tiles.filter(Boolean).map(tile).join('')}${extra}</div>`;
  const gameTile = (game, size = 'half', sub = '') => game && { size, kind: 'art', label: game.title, sub, action: 'select-game', data: { 'game-id': game.id, 'g-wide-art': game.id } };
  // Friends without a picture get one of the era's gamerpics (from the pack), picked from their id.
  const POOL = ['20002', '20003', '20006', '20007', '20008', '20009', '2000a', '2000c'];
  const gamerpic = friend => friend.avatar || packUrl(`Profile/FriendPool/${POOL[[...String(friend.id)].reduce((sum, char) => sum + char.charCodeAt(0), 0) % POOL.length]}.png`);
  const friendTile = friend => friend && { size: 'half', kind: 'dark', label: friend.name || 'Friend', sub: friend.game ? `Playing ${friend.game}` : friend.state === 'online' ? 'Online' : 'Away', image: gamerpic(friend), action: 'g-friend-chat', data: { 'friend-id': friend.id } };
  // Live Store and Game Pass items (garrison-theme-extras.js loads them) and the download queue.
  const passItems = () => window.gHubData?.gamePass || [];
  const storeItems = list => window.gHubData?.store?.[list] || [];
  const deals = () => ['popular', 'newReleases'].flatMap(storeItems).filter(item => item.price?.discount > 0);
  const priceText = item => !item?.price ? '' : item.price.list === 0 ? 'Free' : `${item.price.discount ? `Save ${item.price.discount}% · ` : ''}${new Intl.NumberFormat(undefined, { style: 'currency', currency: item.price.currency || 'USD' }).format(item.price.list)}`;
  const passTile = (item, size = 'half') => item && { size, kind: 'art', label: item.title, sub: 'Game Pass', action: 'gamepass-game', data: { 'catalog-id': item.id, 'g-wide-art': item.id } };
  const storeTile = (item, size = 'half', sub) => item && { size, kind: 'art', label: item.title, sub: sub ?? priceText(item), action: 'g-store-game', data: { 'game-id': item.id, 'g-wide-art': item.id } };
  const queueTile = () => {
    const item = (window.gDownloads || [])[0];
    return item && { size: 'half', kind: 'dark', label: item.state === 'downloading' ? `Downloading ${item.title}` : `Queued · ${item.title}`, sub: `${Math.round(item.percent || 0)}%`, action: 'console-library-section', data: { section: 'queue', progress: Math.round(item.percent || 0) } };
  };
  const mostPlayed = () => (state.games || []).filter(game => !game.isApp && game.steamPlaytimeMinutes).sort((a, b) => b.steamPlaytimeMinutes - a.steamPlaytimeMinutes);
  const searches = () => { try { return JSON.parse(localStorage.getItem('g-recent-searches') || '[]').slice(0, 2); } catch { return []; } };
  const settingsTile = (label, iconFile, glyph, page) => ({ size: 'half', kind: 'lime', label, image: packUrl(`Misc/SettingsIcons/${iconFile}`), glyph, action: page === 'power' ? 'power-menu' : 'g-hub-settings', data: page === 'power' ? {} : { page } });

  const HUBS = {
    x360: {
      bing: () => {
        const trending = mostPlayed(), recentSearch = searches();
        return column('w597', [{ size: 'full', kind: 'art', label: 'bing', sub: 'Search games, apps and more', art: packUrl('References/penguin_bing_background.png'), action: 'toggle-search' }])
          + column('w294', [{ size: 'half', kind: 'lime', label: 'Search My Games', glyph: 'search', action: 'toggle-search' }, { size: 'half', kind: 'lime', label: 'Search Marketplace', glyph: 'shop', action: 'dashboard-store' }])
          + column('w294', [gameTile(trending[0], 'half', 'Trending in your library'), recentSearch[0] ? { size: 'half', kind: 'dark', label: recentSearch[0], sub: 'Recent search', glyph: 'search', action: 'toggle-search' } : gameTile(trending[1], 'half', 'Trending in your library')]);
      },
      social: () => {
        const list = online().slice(0, 4);
        return column('w231', [{ size: 'half', kind: 'lime', label: 'Friends', image: packUrl('Tiles/Social/friends.png'), glyph: 'friends', action: 'g-friends' }, { size: 'half', kind: 'lime', label: 'Profile', image: packUrl('Tiles/Social/sign_in_or_out.png'), glyph: 'contact', action: 'g-account' }])
          + column('w597', [{ size: 'full', kind: 'blue', label: `${online().length} friends online`, sub: friends().length ? `${friends().length} friends` : 'Find people to play with', image: packUrl('Tiles/Social/transparent_avatars.png'), action: 'g-friends' }])
          + column('w294', [friendTile(list[0]) || { size: 'half', kind: 'lime', label: 'Party', glyph: 'headset', action: 'g-friends' }, friendTile(list[1]) || { size: 'half', kind: 'ad', label: 'Avatar Store', image: packUrl('Tiles/Social/avatar_store.png'), action: 'dashboard-store' }])
          + (list.length > 2 ? column('w294', [friendTile(list[2]), friendTile(list[3])]) : '');
      },
      games: () => {
        const games = recent();
        return column('w231', [{ size: 'half', kind: 'lime', label: 'My Games', image: packUrl('Tiles/Marketplace/mygames.png'), glyph: 'game', action: 'library' }, { size: 'half', kind: 'lime', label: 'Game Marketplace', image: packUrl('Tiles/Marketplace/game_marketplace.png'), glyph: 'shop', action: 'dashboard-store' }])
          + column('w597', [gameTile(games[0], 'full', 'Play') || { size: 'full', kind: 'lime', label: 'My Games', action: 'library' }])
          + column('w294', [gameTile(games[1]), queueTile() || storeTile(deals()[0]) || gameTile(games[2]) || { size: 'half', kind: 'ad', label: 'Game Pass', sub: 'Hundreds of games', action: 'dashboard-gamepass' }], '<small class="g-hub-adlabel">ADVERTISEMENT</small>');
      },
      gamepass: () => {
        const pass = passItems(), games = recent();
        return column('w597', [passTile(pass[0], 'full') || { size: 'full', kind: 'ad', label: 'Game Pass', sub: 'Hundreds of high-quality games. Play them all.', action: 'dashboard-gamepass' }])
          + column('w294', [{ size: 'half', kind: 'lime', label: 'Browse Game Pass', glyph: 'game', action: 'dashboard-gamepass' }, passTile(pass[1]) || gameTile(games[3])])
          + column('w294', [passTile(pass[2]) || gameTile(games[4]), passTile(pass[3]) || gameTile(games[5])]);
      },
      apps: () => {
        const list = apps();
        const appTile = app => app && { size: 'half', kind: 'dark', label: app.title, image: app.launcherIcon || app.artwork?.tile, action: 'select-app', data: { 'game-id': app.id } };
        return column('w231', [{ size: 'half', kind: 'lime', label: 'My Apps', image: packUrl('Misc/myapps.png'), glyph: 'grid', action: 'g-hub-apps' }, { size: 'half', kind: 'lime', label: 'Apps Marketplace', image: packUrl('Tiles/Marketplace/apps_marketplace.png'), glyph: 'shop', action: 'dashboard-store' }])
          + column('w597', [list[0] ? { size: 'full', kind: 'art', label: list[0].title, art: packUrl('Tiles/apps.jpg'), action: 'select-app', data: { 'game-id': list[0].id } } : { size: 'full', kind: 'art', label: 'My Apps', art: packUrl('Tiles/apps.jpg'), action: 'g-hub-apps' }])
          + column('w294', [appTile(list[1]), appTile(list[2])]);
      },
      settings: () => column('w231', [settingsTile('Profile', 'account.png', 'contact', 'g-account'), settingsTile('Privacy', 'privacy.png', 'shield', 'g-privacy')])
        + column('w231', [settingsTile('System', 'system.png', 'settings', 'services'), settingsTile('Preferences', 'preferences.png', 'color', 'personalization')])
        + column('w231', [settingsTile('Family', 'family.png', 'friends', 'g-account'), settingsTile('Turn Off', 'turnoff.png', 'power', 'power')])
    },
    one: {
      friends: () => {
        const list = online().slice(0, 8);
        return column('w346', [{ size: 'full', kind: 'lime', label: `${online().length} friends online`, sub: friends().length ? `${friends().length} friends` : 'Find people to play with', glyph: 'friends', action: 'g-friends' }])
          + column('w170', [friendTile(list[0]) || { size: 'half', kind: 'blue', label: 'Find people', glyph: 'addFriend', action: 'g-friends' }, friendTile(list[1]) || { size: 'half', kind: 'lime', label: 'Party', glyph: 'headset', action: 'g-friends' }])
          + column('w170', [friendTile(list[2]), friendTile(list[3])]) + column('w170', [friendTile(list[4]), friendTile(list[5])]);
      },
      gamepass: () => {
        const pass = passItems(), games = recent();
        return column('w522', [passTile(pass[0], 'full') || { size: 'full', kind: 'lime', label: 'Game Pass', sub: 'Hundreds of high-quality games', glyph: 'game', action: 'dashboard-gamepass' }])
          + column('w346', [passTile(pass[1]) || gameTile(games[1]), passTile(pass[2]) || gameTile(games[2])])
          + column('w170', [{ size: 'half', kind: 'blue', label: 'Browse all', glyph: 'grid', action: 'dashboard-gamepass' }, queueTile() || { size: 'half', kind: 'lime', label: 'My games & apps', glyph: 'library', action: 'library' }]);
      },
      store: () => {
        const games = recent();
        const popular = storeItems('popular'), deal = deals(), spotlight = popular[0];
        return column('w522', [spotlight ? { size: 'full', kind: 'art', label: spotlight.title, sub: priceText(spotlight) || 'Spotlight', art: spotlight.artwork?.tile, action: 'g-store-game', data: { 'game-id': spotlight.id } } : { size: 'full', kind: 'art', label: 'Spotlight', sub: 'This week in the Store', art: games[0]?.artwork?.tile || games[0]?.artwork?.grid, action: 'dashboard-store' }])
          + column('w170', [{ size: 'half', kind: 'lime', label: 'Games', glyph: 'game', action: 'dashboard-store' }, { size: 'half', kind: 'blue', label: 'Apps', glyph: 'grid', action: 'dashboard-store' }])
          + column('w346', [storeTile(deal[0], 'half', deal[0] ? `Deals with Gold · ${priceText(deal[0])}` : '') || { size: 'half', kind: 'gold', label: 'Deals with Gold', sub: 'Save on games every week', action: 'dashboard-store' }, storeTile(popular[1]) || gameTile(games[2], 'half', 'Recommended for you')]);
      }
    }
  };

  // ---------- The pivot headings and the hub host ----------
  const topbar = document.querySelector('.topbar');
  const pivots = document.createElement('nav');
  pivots.id = 'g-pivots';
  pivots.setAttribute('aria-label', 'Dashboard');
  topbar?.append(pivots);
  const host = document.createElement('section');
  host.id = 'g-hub-host';
  host.setAttribute('aria-live', 'polite');
  document.querySelector('#home-view')?.prepend(host);

  function renderPivots() {
    const list = PIVOTS[theme()];
    pivots.innerHTML = list ? list.map(([id, label]) => `<button class="g-pivot focusable${id === hub ? ' active' : ''}" type="button" data-g-pivot="${id}">${esc(label)}</button>`).join('') : '';
  }
  function renderHub() {
    const builder = HUBS[theme()]?.[hub];
    host.innerHTML = builder && !sharedHome(hub) && hub !== 'home' ? `<div class="g-hub-band" data-hub="${hub}">${builder()}</div>` : '';
    document.body.dataset.gHub = hubTheme() ? (sharedHome(hub) ? 'home' : hub) : '';
    if (!hubTheme()) delete document.body.dataset.gHub;
    try { refreshFocusables(); } catch { /* Not ready. */ }
  }
  function go(next, { direction = 0, focusPivot = false } = {}) {
    const list = PIVOTS[theme()];
    if (!list || !list.some(([id]) => id === next)) return;
    const previous = hub;
    hub = next;
    if (state.view !== 'home' && typeof showView === 'function') showView('home');
    renderPivots();
    renderHub();
    // One: Pins and Home are one panorama; the heading scrolls it.
    if (sharedHome(next)) {
      const shelf = document.querySelector('#home-view .dashboard-recent');
      const target = next === 'pins' ? 0 : (document.querySelector('#recent-row')?.offsetLeft || 0) - (parseFloat(getComputedStyle(shelf).paddingLeft) || 0);
      shelf?.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }
    if (previous !== next) {
      const view = document.querySelector('#home-view');
      view.classList.remove('g-hub-in-left', 'g-hub-in-right');
      void view.offsetWidth;
      if (!(sharedHome(previous) && sharedHome(next))) view.classList.add(direction < 0 ? 'g-hub-in-left' : 'g-hub-in-right');
      try { interfaceAudio.play(direction < 0 ? 'pageLeft' : 'pageRight'); } catch { /* Optional. */ }
    }
    if (focusPivot) setFocusedElement(pivots.querySelector(`[data-g-pivot="${next}"]`), { scroll: false });
  }
  function step(direction) {
    const list = PIVOTS[theme()].map(([id]) => id);
    const at = list.indexOf(hub);
    go(list[(at + direction + list.length) % list.length], { direction, focusPivot: Boolean(document.activeElement?.closest?.('#g-pivots')) });
  }

  // Headings switch hubs; tiles with hub-only actions open the right place.
  document.addEventListener('click', event => {
    if (!hubTheme()) return;
    const pivot = event.target.closest?.('[data-g-pivot]');
    if (pivot) { event.preventDefault(); event.stopImmediatePropagation(); const list = PIVOTS[theme()].map(([id]) => id); go(pivot.dataset.gPivot, { direction: Math.sign(list.indexOf(pivot.dataset.gPivot) - list.indexOf(hub)), focusPivot: true }); return; }
    const settings = event.target.closest?.('[data-action="g-hub-settings"]');
    if (settings) {
      event.preventDefault(); event.stopImmediatePropagation();
      Promise.resolve(typeof openSettings === 'function' ? openSettings() : settingsDialog.showModal()).then(() => { try { showSettingsPage(settings.dataset.page); } catch { /* Page missing. */ } });
      return;
    }
    if (event.target.closest?.('[data-action="g-hub-apps"]')) {
      event.preventDefault(); event.stopImmediatePropagation();
      Object.assign(state, { libraryCategory: 'apps', libraryQueue: false, consoleLibraryGroups: false });
      showView('library');
    }
  }, true);

  // LB / RB: the next hub, only on the dashboard itself.
  const pageScroll = window.gPageScroll;
  window.gPageScroll = direction => {
    if (!hubTheme() || state.view !== 'home' || document.querySelector('dialog[open]') || !document.querySelector('#launch-overlay')?.hidden) return pageScroll?.(direction);
    step(direction > 0 ? 1 : -1);
  };

  // The One laid its Home out as a Metro grid, so the sticks move through it spatially rather than in a list.
  function nearestInDirection(items, current, direction) {
    const box = current.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    let best = null, bestScore = Infinity;
    for (const item of items) {
      if (item === current) continue;
      const rect = item.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - cx, dy = rect.top + rect.height / 2 - cy;
      const primary = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
      if (primary <= 4) continue;
      const secondary = direction === 'up' || direction === 'down' ? Math.abs(dx) : Math.abs(dy);
      const score = primary + secondary * 1.5;
      if (score < bestScore) { best = item; bestScore = score; }
    }
    return best;
  }
  function moveWithin(group, direction, current) {
    const items = [...group.querySelectorAll('.focusable')].filter(el => el.offsetParent !== null);
    if (!items.includes(current)) return false;
    if (direction === 'left' || direction === 'right') {
      const next = items[items.indexOf(current) + (direction === 'left' ? -1 : 1)];
      if (next) { setFocusedElement(next, { scroll: false }); return true; }
      return false;
    }
    const next = nearestInDirection(items, current, direction);
    if (next) { setFocusedElement(next, { scroll: false }); return true; }
    return false;
  }

  // Controller: Up from a hub's tiles reaches the headings; Left/Right on the headings switches hubs; Down goes in.
  if (typeof navigateConsoleHome === 'function') {
    const base = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (hubTheme() && state.view === 'home') {
        if (focused?.closest?.('#g-pivots')) {
          if (direction === 'left' || direction === 'right') { step(direction === 'right' ? 1 : -1); return true; }
          if (direction === 'down') {
            const first = host.querySelector('.focusable') || document.querySelector(theme() === 'x360' ? '#g-360-home .g-360-big' : (hub === 'pins' ? '#g-one-pins .focusable' : '#recent-row .focusable'));
            if (first) setFocusedElement(first, { scroll: false });
            return true;
          }
          return true;
        }
        if (theme() === 'one') {
          const group = focused?.closest?.('#recent-row, #g-one-pins, #g-one-spotlight');
          if (group) {
            if (direction === 'left' || direction === 'right') return moveWithin(group, direction, focused);
            if (direction === 'down' && moveWithin(group, 'down', focused)) return true;
            if (direction === 'up') {
              if (moveWithin(group, 'up', focused)) return true;
              setFocusedElement(pivots.querySelector('.active'), { scroll: false });
              return true;
            }
          }
        }
        if (direction === 'up' && focused?.closest?.('#g-hub-host, #g-360-home, #home-view .dashboard-recent')) {
          const tiles = [...document.querySelectorAll('#g-hub-host .focusable, #g-360-home .focusable, #home-view .dashboard-recent .focusable')].filter(el => el.offsetParent);
          const top = Math.min(...tiles.map(el => el.getBoundingClientRect().top));
          if (focused.getBoundingClientRect().top - top < 20) { setFocusedElement(pivots.querySelector('.active'), { scroll: false }); return true; }
          // A lower tile keeps moving inside its own band; the theme's grid decides where.
        }
        if (focused?.closest?.('#g-hub-host')) return false;
      }
      return base.call(this, direction, focused);
    };
  }

  // Keep hubs fresh: friends and recent games change underneath them.
  const refresh = () => { if (hubTheme() && hub !== 'home' && !sharedHome(hub) && !host.contains(document.activeElement)) renderHub(); };
  if (typeof renderPlayWithFriends === 'function') {
    const friendsBase = renderPlayWithFriends;
    renderPlayWithFriends = function (...args) { const result = friendsBase.apply(this, args); refresh(); return result; };
  }
  document.addEventListener('g-theme-pack', refresh);
  document.addEventListener('g-hub-data', refresh);
  document.addEventListener('g-downloads', refresh);
  // Remember what was searched for, for the 360's bing pivot.
  document.addEventListener('change', event => {
    const input = event.target.closest?.('#console-search-dialog input, #library-search');
    const query = input?.value.trim();
    if (!query) return;
    try { const list = JSON.parse(localStorage.getItem('g-recent-searches') || '[]').filter(item => item !== query); localStorage.setItem('g-recent-searches', JSON.stringify([query, ...list].slice(0, 6))); } catch { /* Storage unavailable. */ }
  }, true);
  // Pins: your favourites join the One's Pins wall as covers.
  function renderPinned() {
    const pins = document.querySelector('#g-one-pins');
    if (!pins) return;
    pins.querySelectorAll('.g-one-fav').forEach(el => el.remove());
    if (theme() !== 'one') return;
    const favourites = (window.gPinnedGames?.() || []).slice(0, 9);
    pins.insertAdjacentHTML('beforeend', favourites.map(game => `<button class="g-one-pin g-one-fav g-boot-tile focusable" type="button" data-action="select-game" data-game-id="${esc(game.id)}" aria-label="${esc(game.title)}" style="--g-art:url(&quot;${esc(game.artwork?.tile || game.artwork?.grid || '').replaceAll('"', '%22')}&quot;)"><span>${esc(game.title)}</span></button>`).join(''));
  }
  if (typeof renderRecentGames === 'function') {
    const recentBase = renderRecentGames;
    renderRecentGames = function (...args) { const result = recentBase.apply(this, args); renderPinned(); return result; };
  }
  // One: Home opens with the Pins wall on screen; the panorama only travels when the selection moves.
  function resetOnePanorama() {
    if (theme() !== 'one' || state.view !== 'home') return;
    document.querySelector('#home-view .dashboard-recent')?.scrollTo({ left: 0, behavior: 'instant' });
  }
  if (typeof showView === 'function') {
    const showBase = showView;
    showView = function (next, ...rest) {
      const result = showBase.call(this, next, ...rest);
      if (next === 'home') requestAnimationFrame(() => requestAnimationFrame(resetOnePanorama));
      return result;
    };
  }
  new MutationObserver(() => {
    hub = 'home'; renderPivots(); renderHub();
    if (theme() === 'one') requestAnimationFrame(() => requestAnimationFrame(resetOnePanorama));
  }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  renderPivots(); renderHub();
  window.gHub = { go, current: () => hub };
})();
