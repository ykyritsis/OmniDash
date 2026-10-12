// Shared, controller-friendly collection shelves. The existing library and
// artwork services remain the source of truth; a shelf never imports a game.
const collectionSources = [
  ['Steam', 'steam', 'Your Steam library, all in one place.'],
  ['Xbox PC', 'xbox', 'Your Xbox games on this PC.'],
  ['Ubisoft Connect', 'ubisoft', 'Explore the worlds in your Ubisoft library.'],
  ['EA app', 'ea', 'Find your next game in your EA library.'],
  ['Battle.net', 'battlenet', 'Games linked to your Battle.net library.'],
  ['Epic Games', 'epic', 'More to play from your Epic library.'],
  ['GOG Galaxy', 'gog', 'Classics and new favourites from GOG.'],
  ['Rockstar Games', 'rockstar', 'Your Rockstar collection.'],
  ['PC', 'custom', 'Games you have added to your library.']
];

function inputMethods(game, details = {}) {
  const support = details.controllerSupport && details.controllerSupport !== 'unknown' ? details.controllerSupport : game.controls;
  const methods = [];
  if (['controller', 'partial', 'controller-only'].includes(support)) methods.push({ key: 'controller', label: support === 'partial' ? 'Partial controller support' : 'Controller', asset: 'controller' });
  // A PC store's controller-support flag describes an alternative PC input.
  // Xbox catalog-only entries must not inherit keyboard support from that flag.
  if (support === 'kbm' || (['controller', 'partial'].includes(support) && !(game.discoveryOnly && game.xboxProductId))) methods.push({ key: 'kbm', label: support === 'kbm' ? 'Keyboard and mouse only' : 'Keyboard and mouse', asset: 'keyboard' });
  return methods;
}

function inputSymbols(game, details = {}, labels = false) {
  return inputMethods(game, details).map(method => `<span class="input-symbol" data-input="${method.key}" title="${escapeHtml(method.label)}" aria-label="${escapeHtml(method.label)}"><img src="assets/${method.asset}.svg" alt="" />${labels ? `<span>${escapeHtml(method.label)}</span>` : ''}</span>`).join('');
}

function renderDetailInputMethods(game, details = {}) {
  const methods = inputMethods(game, details);
  const bits = [];
  if (methods.length) bits.push(`<span class="detail-play-with"><span>Play with</span>${inputSymbols(game, details)}</span>`);
  if (game.steamPlaytimeMinutes > 0) bits.push(`<span>${hoursLabel(game.steamPlaytimeMinutes)} hours played</span>`);
  if (!game.discoveryOnly) bits.push(`<span>${game.steamFamilyShared ? 'Steam Family shared · ' : ''}${game.installed === false ? 'Not installed' : 'In your library'}</span>`);
  document.querySelector('#detail-session-info').innerHTML = bits.join('');
  document.querySelector('#detail-inputs').innerHTML = methods.length ? inputSymbols(game, details, true) : '<span class="input-unavailable">Input information unavailable</span>';
}

function collectionBrand(title, source, icon = 'groups') {
  const image = ['steam','xbox','ubisoft','ea','battlenet','epic'].includes(source) ? source : '';
  return `<span class="collection-brand">${image ? `<img src="assets/${image}.svg" alt="" />` : consoleIcon(icon)}<span>${escapeHtml(title)}</span></span>`;
}

function captureCollectionPosition() {
  const active = document.activeElement, band = active?.closest('.collection-band');
  return {
    focus: band ? { band: band.getAttribute('aria-labelledby'), game: active.dataset.gameId, action: active.dataset.action } : null,
    rows: [...document.querySelectorAll('#home-view .collection-band')].map(row => [row.getAttribute('aria-labelledby'), row.querySelector('.game-row')?.scrollLeft || 0])
  };
}
function restoreCollectionPosition(saved) {
  for (const [id, left] of saved.rows) {
    const row = document.querySelector(`#home-view .collection-band[aria-labelledby="${CSS.escape(id)}"] .game-row`);
    if (row) row.scrollLeft = left;
  }
  if (!saved.focus || state.view !== 'home' || topmostOpenDialog()) return;
  const band = document.querySelector(`#home-view .collection-band[aria-labelledby="${CSS.escape(saved.focus.band)}"]`);
  const target = band?.querySelector(saved.focus.game ? `[data-game-id="${CSS.escape(saved.focus.game)}"]` : `[data-action="${CSS.escape(saved.focus.action)}"]`);
  if (target) setFocusedElement(target, { scroll: false });
}

function collectionBand({ id, title, description, games, source = 'custom', icon = 'groups', collection = 'all', provider = 'all', action = 'collection-open', empty = false }) {
  const shown = games.slice(0, 8);
  if (!shown.length && !empty) return '';
  return `<section class="collection-band" data-tone="${source}" aria-labelledby="${id}-title">
    <div class="collection-intro"><h2 id="${id}-title">${collectionBrand(title, source, icon)}</h2><p>${escapeHtml(description)}</p><span class="collection-count">${games.length} game${games.length === 1 ? '' : 's'}</span><button class="collection-open focusable" data-action="${action}" data-collection="${escapeHtml(collection)}" data-source="${escapeHtml(provider)}">View games <span aria-hidden="true">›</span></button></div>
    <div class="game-row collection-covers" role="list" aria-label="${escapeHtml(title)}">${shown.length ? shown.map((game, index) => card(game, index)).join('') : '<p class="collection-empty">Add games to this group from Game options.</p>'}</div>
  </section>`;
}

function renderCollectionBands() {
  const query = state.searchQuery;
  const homeGames = state.games.filter(game => !game.isApp && game.installed !== false && (!query || game.title.toLowerCase().includes(query)));
  const combinedGames = displayedLibraryGames().filter(game=>homeGames.includes(game));
  const target = document.querySelector('#source-collections');
  target.innerHTML = collectionSources.map(([provider, source, description]) => collectionBand({ id: `home-${source}`, title: provider === 'EA app' ? 'EA' : provider === 'Xbox PC' ? 'Xbox' : provider, description, source, provider, games: homeGames.filter(game => game.provider === provider) })).join('');
  target.hidden = !target.children.length;
  const choices = [
    ...state.customCollections.map(group => [`custom:${group.id}`, group.name, 'A collection made by you.', 'groups']),
    ['favorites', 'Favourites', 'The games you keep coming back to.', 'heart'],
    ['controller', 'Pick up and play', 'Games with full or partial controller support.', 'controller'],
    ['solo', 'A world of your own', 'Single-player games from your library.', 'person'],
    ['multiplayer', 'Better together', 'Multiplayer and co-op games from your library.', 'groups']
  ];
  document.querySelector('#category-discovery').innerHTML = choices.map(([collection, title, description, icon], index) => collectionBand({ id: `home-collection-${index}`, title, description, icon, collection, games: combinedGames.filter(game => matchesCollection(game, collection)) })).join('');
  document.querySelector('.browse-collections').hidden = !document.querySelector('#category-discovery').children.length;
  // Keep all three live Steam charts, but give them the same left-to-right
  // rhythm as library collections instead of another generic heading/grid.
  const charts = [
    ['mostPlayed', 'Players right now', 'The five most-played games on Steam.'],
    ['topSellers', 'Top sellers', 'Popular paid games on Steam.'],
    ['upcoming', 'Coming soon', 'Upcoming paid games to look forward to.']
  ];
  for (const [key, title, description] of charts) {
    const row = steamDiscoveryRows[key], section = row.closest('section');
    section.classList.add('collection-band', 'collection-chart'); section.dataset.tone = 'steam';
    row.classList.add('collection-covers');
    const heading = section.querySelector('.section-heading'); heading.classList.add('collection-intro');
    const headingId = heading.querySelector('h2').id;
    heading.innerHTML = `<h2 id="${headingId}">${collectionBrand(title, 'steam')}</h2><p>${description}</p><span class="collection-count">STEAM CHARTS</span><button class="collection-open focusable" data-action="collection-store" data-chart="${key}">Browse store <span aria-hidden="true">›</span></button>`;
  }
}

function openCollection(source) {
  state.consoleLibraryGroups = false;
  state.collectionFilter = source.dataset.collection || 'all';
  state.sourceFilter = source.dataset.source || 'all';
  state.libraryCategory = 'games'; state.libraryTab = 'full-library'; state.installFilter = 'all';
  document.querySelector('#library-collection').value = state.collectionFilter;
  document.querySelector('#library-source-filter').value = state.sourceFilter;
  renderLibraryView();
  showView('library');
  setFocusedElement(libraryGrid.querySelector('.focusable') || document.querySelector('#library-filter-button'));
}

function navigateCollectionBand(direction, current) {
  if (topmostOpenDialog() || !['home', 'library'].includes(state.view)) return false;
  const band = current?.closest('.collection-band');
  if (!band) return false;
  const items = [...band.querySelectorAll('.focusable')].filter(item => item.offsetParent !== null);
  const index = items.indexOf(current);
  if (direction === 'left' || direction === 'right') {
    const next = items[index + (direction === 'left' ? -1 : 1)];
    if (next) setFocusedElement(next);
    else if (direction === 'left' && state.view === 'library') setFocusedElement(document.querySelector('.console-library-nav .active'), { scroll: false });
    return true;
  }
  const root = state.view === 'home' ? document.querySelector('#home-view') : libraryGrid;
  const bands = [...root.querySelectorAll('.collection-band')].filter(item => item.offsetParent !== null);
  const next = bands[bands.indexOf(band) + (direction === 'up' ? -1 : 1)];
  if (next) {
    const choices = [...next.querySelectorAll('.focusable')];
    // Preserve the horizontal position across rows, including the intro action.
    setFocusedElement(choices[Math.min(index, choices.length - 1)]);
  } else if (direction === 'up') {
    setFocusedElement(state.view === 'home' ? document.querySelector('#dashboard-features .focusable') : document.querySelector('.console-library-controls .focusable:not([hidden])'));
  }
  return true;
}

let collectionScrollTimer;
function scrollCollectionIntoView(element, behavior) {
  clearTimeout(collectionScrollTimer);
  const band = element.closest('.collection-band');
  if (!band) return false;
  // Reserve the footer before measuring. Its padded scrolled treatment must
  // not grow over the artwork after a smooth scroll has already started.
  if (state.view === 'home') document.body.classList.add('collections-scrolled');
  const scroller = document.querySelector('main'), row = element.closest('.game-row');
  if (row) {
    const bounds = row.getBoundingClientRect(), item = element.getBoundingClientRect();
    if (item.left < bounds.left + 8) row.scrollBy({ left: item.left - bounds.left - 8, behavior });
    else if (item.right > bounds.right - 8) row.scrollBy({ left: item.right - bounds.right + 8, behavior });
  }
  const align = motion => {
    const bounds = scroller.getBoundingClientRect(), header = document.querySelector('.topbar').getBoundingClientRect();
    const hints = document.querySelector('#controller-prompts');
    const top = Math.max(bounds.top + 20, header.bottom + 12);
    const bottom = Math.min(bounds.bottom - 25, innerHeight - 94, hints.hidden ? innerHeight - 35 : hints.getBoundingClientRect().top - 24);
    const whole = band.getBoundingClientRect();
    const focus = whole.height <= bottom - top ? whole : (band.querySelector('.game-row')?.getBoundingClientRect() || element.getBoundingClientRect());
    if (focus.top < top) scroller.scrollBy({ top: focus.top - top, behavior:motion });
    else if (focus.bottom > bottom) scroller.scrollBy({ top: focus.bottom - bottom, behavior:motion });
  };
  align(behavior);
  // Home's expanded tile and page-entry transition settle after initial focus.
  // Re-measure once after that layout change, without a permanent scroll loop.
  collectionScrollTimer = setTimeout(() => {
    if(document.activeElement===element && element.isConnected && !topmostOpenDialog())align(behavior);
  },360);
  return true;
}

document.querySelector('main').addEventListener('scroll', event => {
  document.body.classList.toggle('collections-scrolled', event.currentTarget.scrollTop > 130);
}, { passive: true });
