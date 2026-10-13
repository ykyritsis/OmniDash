// Library filter, as the Xbox app does it: a flyout under the Filter button with Show / Launcher /
// Collection groups, a check beside what's selected, applied as you choose.
const gFilterMenu = gFlyout('g-filter-dialog', 'g-filter-flyout', 'Filter');
function gFilterOptions() {
  const present = new Set(state.games.filter(game => !game.isApp).map(game => game.provider));
  const launchers = gSources.filter(([provider]) => present.has(provider));
  const collections = [['all', 'All collections'], ['favorites', 'Favorites'], ['controller', 'Great with a controller'], ['multiplayer', 'Play together'],
    ...state.customCollections.map(group => [`custom:${group.id}`, group.name])];
  return [
    ['install', 'Show', [['all', 'All games'], ['installed', 'Installed'], ['not-installed', 'Not installed']], state.installFilter === 'all' ? 'all' : state.installFilter === 'installed' ? 'installed' : 'not-installed'],
    ['source', 'Launcher', [['all', 'All launchers'], ...launchers.map(([provider, label]) => [provider, label === 'Custom' ? 'Added by you' : label])], state.sourceFilter || 'all'],
    ['collection', 'Collection', collections, /^(series|publisher):/.test(state.collectionFilter || '') ? '' : state.collectionFilter || 'all'],
    // Steam's "Show hidden games": off by default, never part of search.
    ['hidden', 'Hidden games', [['hide', 'Don’t show hidden games'], ['show', `Show hidden games${state.hiddenGames?.length ? ` (${state.hiddenGames.length})` : ''}`]], state.gHiddenView ? 'show' : 'hide']
  ];
}
function gFilterActive() {
  return (state.gHiddenView ? 1 : 0) + (state.installFilter !== 'all' ? 1 : 0) + ((state.sourceFilter || 'all') !== 'all' ? 1 : 0) + ((state.collectionFilter || 'all') !== 'all' ? 1 : 0);
}
function gFilterMarkup() {
  const groups = gFilterOptions().map(([kind, title, options, selected]) => `<div class="g-filter-group" role="group" aria-label="${escapeHtml(title)}"><h3>${escapeHtml(title)}</h3>${options.map(([value, label]) => {
    const on = value === selected;
    return `<button class="g-menu-item g-filter-option focusable${on ? ' active' : ''}" type="button" role="menuitemradio" aria-checked="${on}" data-action="g-filter-set" data-kind="${kind}" data-value="${escapeHtml(value)}"><span>${escapeHtml(label)}</span>${on ? gIcon('check', 'g-trailing') : ''}</button>`;
  }).join('')}</div>`).join('');
  return `<header><h2>Filter</h2></header><div class="g-filter-groups">${groups}</div>${gFilterActive() ? `<div class="g-filter-foot"><button class="g-menu-item focusable" type="button" data-action="g-filter-clear">${gIcon('close')}<span>Clear filters</span></button></div>` : ''}`;
}
function gApplyFilter(kind, value) {
  if (kind === 'hidden') { state.gHiddenView = value === 'show'; if (state.gHiddenView) { state.consoleLibraryGroups = false; state.libraryCategory = 'games'; } }
  else if (kind !== 'collection') state.gHiddenView = false;
  if (kind === 'install') { state.installFilter = value; }
  if (kind === 'source') { state.sourceFilter = value; const select = document.querySelector('#library-source-filter'); if (select) select.value = value; }
  if (kind === 'collection') { state.collectionFilter = value; state.consoleLibraryGroups = false; state.gHiddenView = false; const select = document.querySelector('#library-collection'); if (select) select.value = value; }
  // Filtering a section other than My games moves to My games, as Xbox does.
  if (state.libraryQueue || state.libraryTab === 'play-history') document.querySelector('.console-library-nav [data-section="games"]')?.click();
  renderLibraryView();
}
function gRefreshFilterMenu(focus) {
  gFilterMenu.innerHTML = gFilterMarkup();
  refreshFocusables();
  setFocusedElement(gFilterMenu.querySelector(focus) || gFilterMenu.querySelector('.g-filter-option.active') || gFilterMenu.querySelector('.focusable'), { scroll: true });
}
const gFilterPerform = performAction;
performAction = async function (action, source) {
  if (action === 'console-library-filters') {
    const button = document.querySelector('#library-filter-button');
    openGFlyout(gFilterMenu, button, gFilterMarkup(), button);
    // Under the Filter button, like the sort and view menus.
    const box = button.getBoundingClientRect();
    gFilterMenu.style.cssText = `left:${Math.max(12, box.left)}px;top:${box.bottom + 8}px;right:auto;bottom:auto;max-height:${Math.max(240, innerHeight - box.bottom - 32)}px`;
    setFocusedElement(gFilterMenu.querySelector('.g-filter-option.active') || gFilterMenu.querySelector('.focusable'), { scroll: false });
    return;
  }
  if (action === 'g-filter-set') {
    gApplyFilter(source.dataset.kind, source.dataset.value);
    gRefreshFilterMenu(`[data-kind="${source.dataset.kind}"][data-value="${CSS.escape(source.dataset.value)}"]`);
    return;
  }
  if (action === 'g-filter-clear') {
    state.installFilter = 'all'; state.sourceFilter = 'all'; state.collectionFilter = 'all'; state.gHiddenView = false;
    renderLibraryView();
    gRefreshFilterMenu('.g-filter-option');
    return;
  }
  return gFilterPerform(action, source);
};
