// "My games & apps" for the Series and One themes. Both consoles show the library as its own full-screen app:
// a side panel of sections on the left and a grid of tiles on the right, with no dashboard bar above it.
//
// The side panel only drives the launcher's existing library state (the same sections the Helix tabs use),
// so sorting, filtering, paging, installs and game menus all keep working unchanged.
(() => {
  const view = document.querySelector('#library-view');
  const content = view?.querySelector('.console-library-content');
  if (!view || !content) return;

  const side = document.createElement('aside');
  side.id = 'g-lib-side';
  side.setAttribute('aria-label', 'My games & apps');
  view.prepend(side);
  const title = document.createElement('div');
  title.id = 'g-lib-title';
  title.innerHTML = '<h1></h1><small></small>';
  content.prepend(title);

  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  // Each theme names and orders its sections the way that console did.
  const SECTIONS = {
    series: [
      { id: 'installed', label: 'Games', icon: 'game', count: 'games' },
      { id: 'apps', label: 'Apps', icon: 'grid', count: 'apps' },
      { id: 'groups', label: 'Groups', icon: 'library', count: 'groups' },
      { id: 'full', label: 'Full library', icon: 'library' },
      { divider: true },
      { id: 'queue', label: 'Manage', icon: 'download', count: 'queue' }
    ],
    one: [
      { id: 'installed', label: 'Games', count: 'games' },
      { id: 'apps', label: 'Apps', count: 'apps' },
      { id: 'queue', label: 'Queue', count: 'queue' },
      { id: 'ready', label: 'Ready to install', count: 'ready' },
      { id: 'groups', label: 'Collections', count: 'groups' }
    ]
  };
  SECTIONS.x360 = SECTIONS.ps3 = SECTIONS.ps4 = SECTIONS.ps5 = SECTIONS.wii = SECTIONS["3ds"] = SECTIONS.one;
  const TITLES = { installed: 'Games', apps: 'Apps', groups: 'Groups', full: 'Full library', queue: 'Manage', ready: 'Ready to install', recent: 'Recently played' };

  const theme = () => document.body.dataset.gTheme || 'helix';
  const visible = () => (typeof displayedLibraryGames === 'function' ? displayedLibraryGames() : state.games);
  function counts() {
    const all = visible();
    return {
      games: all.filter(game => !game.isApp && game.installed !== false).length,
      apps: all.filter(game => game.isApp).length,
      groups: (state.customCollections || []).length,
      ready: all.filter(game => !game.isApp && game.installed === false).length,
      queue: typeof installTracking !== 'undefined' && installTracking?.size ? installTracking.size : 0
    };
  }
  // Which section the library state currently shows.
  function activeSection() {
    if (state.libraryQueue) return 'queue';
    if (state.consoleLibraryGroups) return 'groups';
    if (state.libraryCategory === 'apps') return 'apps';
    if (state.installFilter === 'uninstalled') return 'ready';
    if (state.libraryTab === 'play-history') return 'recent';
    if (state.installFilter === 'installed') return 'installed';
    return 'full';
  }

  let storage = null;
  function loadStorage() {
    window.launcher?.getStorageOverview?.().then(data => {
      const volumes = (data?.drives || []).filter(item => item.total > 0);
      if (!volumes.length) return;
      const total = volumes.reduce((sum, item) => sum + item.total, 0), free = volumes.reduce((sum, item) => sum + item.free, 0);
      storage = { free, used: Math.round((1 - free / total) * 1000) / 10 };
      render();
    }).catch(() => {});
  }

  function render() {
    const id = theme();
    const sections = SECTIONS[id];
    if (!sections) { side.innerHTML = ''; return; }
    const numbers = counts(), active = activeSection();
    const player = document.querySelector('#profile-avatar')?.innerHTML || '';
    const name = state.displayName || document.querySelector('#dashboard-player-name')?.textContent || 'Player';
    const items = sections.map(item => item.divider ? '<hr>' : `<button class="g-lib-item focusable${item.id === active ? ' active' : ''}" type="button"
      ${item.id === 'ready' ? 'data-g-lib="ready"' : `data-action="console-library-section" data-section="${item.id}"`}>
      ${id === 'series' ? `<span class="g-lib-icon">${icon(item.icon)}</span>` : ''}<span class="g-lib-label">${item.label}</span>${item.count && numbers[item.count] ? `<em>${numbers[item.count]}</em>` : ''}</button>`).join('');
    const ring = storage ? `<div class="g-lib-storage"><span class="g-lib-ring" style="--used:${storage.used}"><b>${Math.round(storage.used)}%</b></span><span><strong>All storage</strong><small>${typeof formatBytes === 'function' ? formatBytes(storage.free) : ''} free</small></span></div>` : '';
    side.innerHTML = id === 'series'
      ? `<div class="g-lib-player"><span class="g-lib-avatar">${player}</span><strong>${escapeHtml(name)}</strong></div>
         <button class="g-lib-search focusable" type="button" data-action="toggle-search">${icon('search')}<span>Search</span></button>
         <nav class="g-lib-nav">${items}</nav>${ring}`
      : `<h2>My games &amp; apps</h2><nav class="g-lib-nav">${items}</nav>
         <button class="g-lib-sort focusable" type="button" data-action="g-sort-menu">Sort: <span>${escapeHtml(document.querySelector('#library-sort')?.selectedOptions?.[0]?.textContent.trim() || 'Most recent')}</span></button>${ring}`;
    const shown = TITLES[active] || 'Games';
    title.querySelector('h1').textContent = shown;
    title.querySelector('small').textContent = document.querySelector('#library-count')?.textContent || '';
  }

  // "Ready to install": owned games that aren't installed (One only; the Series calls this Full library).
  side.addEventListener('click', event => {
    const ready = event.target.closest('[data-g-lib="ready"]');
    if (!ready) return;
    Object.assign(state, { libraryQueue: false, consoleLibraryGroups: false, gHiddenView: false, libraryCategory: 'games', libraryTab: 'full-library', installFilter: 'uninstalled', collectionFilter: 'all' });
    renderLibraryView();
    setFocusedElement(side.querySelector('[data-g-lib="ready"]'), { scroll: false });
  });

  // Keep the panel in step with every library change, whatever caused it.
  if (typeof renderLibraryView === 'function') {
    const base = renderLibraryView;
    renderLibraryView = function (...args) {
      const result = base.apply(this, args);
      if (theme() !== 'helix') {
        const focused = document.activeElement?.closest?.('#g-lib-side') ? document.activeElement.dataset.section || document.activeElement.dataset.gLib : '';
        render();
        if (focused) setFocusedElement(side.querySelector(`[data-section="${focused}"], [data-g-lib="${focused}"]`), { scroll: false });
      }
      return result;
    };
  }
  // Opening the library on these consoles lands on installed games, as My games & apps did.
  if (typeof showView === 'function') {
    const showBase = showView;
    showView = function (next, ...rest) {
      if (next === 'library' && theme() !== 'helix' && state.view !== 'library' && !state.libraryQueue && state.libraryCategory !== 'apps') {
        Object.assign(state, { consoleLibraryGroups: false, libraryTab: 'my-games', installFilter: 'installed' });
      }
      const result = showBase.call(this, next, ...rest);
      if (next === 'library') { render(); if (!storage) loadStorage(); }
      return result;
    };
  }
  new MutationObserver(() => render()).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  render();
})();
