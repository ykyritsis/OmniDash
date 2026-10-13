// Shared console surfaces. Library discovery and launch behavior live in app.js.
const consoleIcons = {
  home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3z"/>',
  library: '<rect x="3" y="4" width="4" height="16"/><rect x="10" y="4" width="4" height="16"/><path d="m17 5 4-1 3 15-4 1z"/>',
  store: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M8 5V3h8v2M7 10h3m4 0h3M7 15h3m4 0h3"/>',
  controller: '<path d="M7 7h10a4 4 0 0 1 4 3l2 7a2 2 0 0 1-3 2l-4-4H8l-4 4a2 2 0 0 1-3-2l2-7a4 4 0 0 1 4-3zM7 9v5M4.5 11.5h5M16 10h.1M19 13h.1"/>',
  apps: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  groups: '<path d="M3 6h7l2 3h9v12H3zM3 6V3h8l2 3h8v3"/>',
  bell: '<path d="M5 16V9a7 7 0 0 1 14 0v7l2 3H3zM10 22h4"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M3 21v-2a9 9 0 0 1 18 0v2z"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 3-1 2 3 3-1 1-3 3-1 2-3-2-2 1-3-3-2-3 1-2-3z"/><circle cx="12" cy="12" r="3"/>',
  folder: '<path d="M3 5h7l2 3h9v13H3z"/>',
  paint: '<path d="m14 3 7 7-11 11H3v-7zM11 6l7 7M3 17l4 4"/>',
  power: '<path d="M12 2v9M6 5a9 9 0 1 0 12 0"/>',
  trophy: '<path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 14v6M7 22h10"/>',
  search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 7 7"/>'
};
// Use the Microsoft glyph set already installed with Windows, not redrawn approximations.
const consoleGlyphs = { home:0xE80F, library:0xE8F1, store:0xE719, controller:0xE7FC, apps:0xE71D, groups:0xE8F4, bell:0xEA8F, person:0xE77B, settings:0xE713, folder:0xE8B7, paint:0xE771, power:0xE7E8, search:0xE721, filter:0xE71C, add:0xE710 };
function consoleIcon(name) {
  if (consoleGlyphs[name]) return `<span class="console-glyph" aria-hidden="true">${String.fromCodePoint(consoleGlyphs[name])}</span>`;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${consoleIcons[name] || consoleIcons.controller}</svg>`;
}
function hydrateConsoleIcons(root = document) {
  root.querySelectorAll('[data-console-icon]').forEach(node => {
    if (node.dataset.hydratedIcon === node.dataset.consoleIcon) return;
    node.innerHTML = consoleIcon(node.dataset.consoleIcon);
    node.dataset.hydratedIcon = node.dataset.consoleIcon;
  });
}
const tileAnimations = new Map();
function captureDashboardTileMotion(row) {
  const reduced=document.documentElement.classList.contains('reduce-motion');
  if(reduced) {for(const animation of tileAnimations.values())animation.cancel();tileAnimations.clear();}
  if (!row || reduced) return () => {};
  const tiles = [...row.children];
  const before = tiles.map(tile => tile.getBoundingClientRect());
  for (const animation of tileAnimations.values()) animation.cancel();
  tileAnimations.clear();
  return () => {
    // Lay out once; animate compositor transforms instead of reflowing nine cards every frame.
    const after = tiles.map(tile => tile.getBoundingClientRect());
    tiles.forEach((tile, index) => {
      const a = before[index], b = after[index];
      if (!a.width || !b.width || (Math.abs(a.left - b.left) < .5 && Math.abs(a.top - b.top) < .5 && Math.abs(a.width - b.width) < .5 && Math.abs(a.height - b.height) < .5)) return;
      const animation = tile.animate([
        { transform:`translate(${a.left-b.left}px,${a.top-b.top}px) scale(${a.width/b.width},${a.height/b.height})` },
        { transform:'none' }
      ], { duration:160, easing:'cubic-bezier(.16,1,.3,1)' });
      tileAnimations.set(tile, animation);
      animation.onfinish = () => { if(tileAnimations.get(tile)===animation) tileAnimations.delete(tile); };
      animation.oncancel = animation.onfinish;
    });
  };
}
function beginDashboardTileMotion(selected) {
  const row = document.querySelector('#recent-row');
  if (!selected || selected.parentElement !== row) return () => {};
  if (selected.classList.contains('selected') && row.classList.contains('row-focused')) return () => {};
  const finish = captureDashboardTileMotion(row);
  row.classList.add('row-focused');
  return finish;
}
function collapseDashboardTiles() {
  const row = document.querySelector('#recent-row');
  if (!row?.classList.contains('row-focused')) return;
  const finish = captureDashboardTileMotion(row);
  row.classList.remove('row-focused');
  finish();
}
let consoleStoreTab = 'popular';
function updateConsoleClock() {
  const text = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date());
  document.querySelector('#dashboard-clock').textContent = text;
}
function renderDashboard() {
  document.querySelector('#dashboard-player-name').textContent = state.displayName;
  const games = displayedLibraryGames().filter(game => !game.isApp && game.installed !== false);
  const visibleIds = new Set([...recentRow.querySelectorAll('.game-card')].map(node => node.dataset.gameId));
  const preview = games.filter(game => !visibleIds.has(game.id)).slice(0, 4);
  const featured = games.find(game => state.favoriteGameIds.includes(game.id)) || games[0];
  document.querySelector('#dashboard-features').innerHTML = `${libraryCard(preview)}
    <button class="dashboard-feature focusable dashboard-customize" data-action="dashboard-customize"><span class="dashboard-feature-icon">${consoleIcon('paint')}</span><span class="dashboard-feature-label">Customize your Home</span></button>
    ${featured ? `<button class="dashboard-feature focusable" data-action="select-game" data-game-id="${escapeHtml(featured.id)}">${gameArt(featured, 'dashboard-feature-art', true)}<span class="dashboard-feature-shade"></span><span class="dashboard-feature-label">${escapeHtml(featured.title)}</span></button>` : `<button class="dashboard-feature focusable" data-action="dashboard-store"><span class="dashboard-feature-icon">${consoleIcon('store')}</span><span class="dashboard-feature-label">Discover your next game</span></button>`}
    <button class="dashboard-feature focusable dashboard-input" data-action="controller-status"><img src="assets/controller.svg" alt="" /><span class="dashboard-feature-label">Play your way</span></button>`;
  const libraryLabel = document.querySelector('#dashboard-features .library-card-label');
  libraryLabel.innerHTML = `${consoleIcon('controller')}<strong>Browse your games</strong>`;
  document.querySelector('#dashboard-features .library-collage-empty')?.remove();
  hydrateConsoleIcons();
  updateConsoleClock();
}
function renderConsoleStore() {
  const grid = document.querySelector('#console-store-grid');
  const gamepass = state.consoleStoreMode === 'gamepass';
  let browse = document.querySelector('#browse-steam-shop');
  if (!browse) {
    browse = document.createElement('button');
    Object.assign(browse, { id:'browse-steam-shop', className:'primary focusable', textContent:'Browse Steam & cart' });
    browse.dataset.action='console-shop-open';
    document.querySelector('.console-page-heading').append(browse);
  }
  browse.hidden=gamepass;
  document.querySelector('#store-heading').textContent = gamepass ? 'Game Pass' : 'Store';
  document.querySelector('.console-page-heading > span').innerHTML = gamepass ? '<span class="gamepass-glyph" aria-hidden="true">GAME<br>PASS</span>' : consoleIcon('store');
  document.querySelector('.console-store-tabs').hidden = gamepass;
  document.querySelector('#store-view').classList.toggle('native-store',!gamepass);
  if(document.querySelector('#store-rail'))document.querySelector('#store-rail').hidden=gamepass;
  if(!gamepass) { renderNativeStore(grid); return; }
  grid.className='library-grid';
  const games = state.gamePassCatalog || [];
  const caption = typeof gCatalogCardText === 'function' ? gCatalogCardText : game => `<span class="console-game-label">${escapeHtml(game.title)}</span>`;
  grid.innerHTML = games.length ? games.map(game => `<button class="game-card focusable console-catalog-card" data-action="gamepass-game" data-catalog-id="${escapeHtml(game.id)}" role="listitem" aria-label="${escapeHtml(game.title)}">${gameArt(game)}${caption(game)}</button>`).join('') : '<p class="console-store-empty">'+(state.gamePassError ? 'Game Pass is unavailable right now. Try again later.' : 'Getting games ready…')+'</p>';
  refreshFocusables();
}
async function openConsoleStore(gamepass = false) {
  const request = state.consoleStoreRequest = (state.consoleStoreRequest || 0) + 1;
  state.consoleStoreMode = gamepass ? 'gamepass' : 'steam';
  showView('store');
  renderConsoleStore();
  if (gamepass && !state.gamePassCatalog) {
    try { state.gamePassCatalog = await window.launcher.getGamePassCatalog(); state.gamePassError = false; }
    catch { state.gamePassError = true; }
    if (state.view === 'store' && request === state.consoleStoreRequest) renderConsoleStore();
  }
  if (state.view === 'store' && request === state.consoleStoreRequest) setFocusedElement(document.querySelector('#console-store-grid .focusable') || document.querySelector('.console-store-tabs .active'));
}
function navigateConsoleHome(direction, current) {
  if (state.view !== 'home' || topmostOpenDialog()) return false;
  const row = current?.closest('#recent-row');
  if (row && ['left','right'].includes(direction)) {
    const cards = [...recentRow.querySelectorAll('.focusable')];
    const next = cards[cards.indexOf(current)+(direction === 'left' ? -1 : 1)];
    if (next) setFocusedElement(next, {scroll:false});
    return true;
  }
  if (row && direction === 'up') { setFocusedElement(document.querySelector('.top-center-nav .focusable'), {scroll:false}); return true; }
  if (current?.closest('.topbar') && direction === 'down') { setFocusedElement(recentRow.querySelector('.selected') || recentRow.querySelector('.focusable'), {scroll:false}); return true; }
  if (current?.closest('#dashboard-features') && direction === 'up') { setFocusedElement(recentRow.querySelector('.selected') || recentRow.querySelector('.focusable')); return true; }
  return false;
}
let consoleChoiceTarget = null;
function openConsoleChoice(select) {
  consoleChoiceTarget = select;
  setFocusedElement(select, {scroll:false});
  const modal = document.querySelector('#console-choice-dialog');
  document.querySelector('#console-choice-title').textContent = select.getAttribute('aria-label') || select.closest('label')?.childNodes[0]?.textContent?.trim() || 'Choose an option';
  document.querySelector('#console-choice-list').innerHTML = [...select.options].filter(option => !option.disabled).map(option => `<button class="console-choice focusable${option.selected ? ' active' : ''}" data-action="console-choice" data-value="${escapeHtml(option.value)}"><span>${escapeHtml(option.textContent)}</span>${option.selected ? '<i>✓</i>' : ''}</button>`).join('');
  modal.showModal();
  setFocusedElement(modal.querySelector('.active') || modal.querySelector('.focusable'));
}
let consoleFileRequest = null;
let consoleFilePath = '';
let consoleFileParent = '';
let consoleFileSequence = 0;
async function browseConsoleFiles(directory = '') {
  const sequence = ++consoleFileSequence;
  const list = document.querySelector('#console-file-list');
  list.innerHTML = '<p class="surface-empty">Opening location…</p>';
  try {
    const result = await window.launcher.browseFiles(directory, consoleFileRequest?.kind || 'game');
    if (sequence !== consoleFileSequence) return;
    consoleFilePath = result.path;
    consoleFileParent = result.parent;
    document.querySelector('#console-file-path').textContent = result.path || 'Locations';
    document.querySelector('#console-file-select').hidden = consoleFileRequest?.kind !== 'folder' || !result.path;
    list.innerHTML = result.entries.length ? result.entries.map(entry => `<button class="console-file-entry focusable" data-action="console-file-entry" data-path="${escapeHtml(entry.path)}" data-directory="${entry.directory}"><span>${consoleIcon(entry.directory ? 'folder' : 'controller')}</span><strong>${escapeHtml(entry.name)}</strong><small>${entry.directory ? '›' : ''}</small></button>`).join('') : '<p class="surface-empty">No matching files in this folder.</p>';
    refreshFocusables();
    setFocusedElement(list.querySelector('.focusable') || document.querySelector('#console-file-select'));
  } catch (error) { list.innerHTML = '<p class="surface-empty">'+escapeHtml(error.message || 'This location is unavailable.')+'</p>'; }
}
function openConsoleFiles(kind = 'game') {
  const modal = document.querySelector('#console-file-dialog');
  if (consoleFileRequest) consoleFileRequest.resolve(null);
  const promise = new Promise(resolve => { consoleFileRequest = {kind,resolve}; });
  document.querySelector('#console-file-title').textContent = kind === 'folder' ? 'Choose a folder' : kind === 'image' ? 'Choose your gamerpic' : 'Choose a game or app';
  modal.showModal();
  browseConsoleFiles();
  return promise;
}
function finishConsoleFiles(path = null) {
  const pending = consoleFileRequest;
  consoleFileRequest = null;
  ++consoleFileSequence;
  document.querySelector('#console-file-dialog').close();
  pending?.resolve(path);
}
async function consoleAction(action, source) {
  if(consoleLibraryAction(action))return true;
  if(action==='console-store-retry') {
    state.steamDiscovery.status='loading';renderConsoleStore();
    try {state.steamDiscovery=await window.launcher.getSteamDiscovery();}
    catch {state.steamDiscovery.status='unavailable';}
    renderHomeCollections();
    if(state.view==='store') {renderConsoleStore();setFocusedElement(document.querySelector('#console-store-grid .focusable'));}
    return true;
  }
  if(action==='console-settings-open') { openConsoleSettingsPage(source.dataset.page,source);return true; }
  if(action === 'console-shop-open') { await openSteamShop(); return true; }
  if(action === 'console-shop-cart' || action === 'console-shop-login') { await openSteamShop(action.endsWith('cart')?'cart':'login'); return true; }
  if(action.startsWith('console-shop-')) { await window.launcher.shopCommand(action.slice('console-shop-'.length)); return true; }
  if (action === 'console-sound-import') {
    const folder = await openConsoleFiles('folder');
    if (!folder) { setFocusedElement(source); return true; }
    try {
      const count = await interfaceAudio.load(await window.launcher.installSoundPack(folder));
      document.querySelector('#sound-pack-status').textContent = `${count} custom sounds ready. Stored on this PC only.`;
      playUiSound('confirm');
    } catch(error) { showToast(error.message || 'Could not load these sounds.'); }
    setFocusedElement(source);
    return true;
  }
  if (action === 'console-sound-preview') { interfaceAudio.play('confirm'); return true; }
  if (action === 'console-sound-reset') {
    await interfaceAudio.load(await window.launcher.resetSoundPack());
    document.querySelector('#sound-pack-status').textContent = 'Default interface sounds restored.';
    playUiSound('confirm');
    return true;
  }
  if (action === 'dashboard-store' || action === 'dashboard-gamepass') { await openConsoleStore(action === 'dashboard-gamepass'); return true; }
  if (action === 'console-store-tab') { consoleStoreTab = source.dataset.tab; document.querySelectorAll('.console-store-tabs button').forEach(button=>button.classList.toggle('active',button===source)); renderConsoleStore(); setFocusedElement(source,{scroll:false}); return true; }
  if (action === 'gamepass-game') {
    const game = state.gamePassCatalog?.find(item=>item.id===source.dataset.catalogId);
    if (!game) return true;
    const owned = state.games.find(item=>item.xboxProductId===game.xboxProductId || normalizeConsoleTitle(item.title)===normalizeConsoleTitle(game.title));
    if (owned) openGameDetails(owned.id);
    else { state.catalogDetailGame=game; await openGameDetails(game.id); }
    return true;
  }
  if (action === 'dashboard-customize') { await openSettings(); showSettingsPage('personalization'); return true; }
  if (action === 'console-library-section') {
    const section = source.dataset.section;
    if (section === 'manage') { await openSettings(); showSettingsPage('services'); return true; }
    state.consoleLibraryGroups = section === 'groups';
    state.libraryQueue = section === 'queue';
    state.gHiddenView = false;
    state.libraryCategory = section === 'apps' ? 'apps' : 'games';
    state.libraryTab = section === 'recent' ? 'play-history' : section === 'games' || section === 'full' ? 'full-library' : 'my-games';
    state.installFilter = section === 'installed' ? 'installed' : 'all';
    state.collectionFilter = 'all';
    document.querySelector('#library-collection').value = 'all';
    renderLibraryView();
    setFocusedElement(source,{scroll:false});
    return true;
  }
  if (action === 'console-group-open') {
    state.consoleLibraryGroups = false;
    state.collectionFilter = source.dataset.collection;
    document.querySelector('#library-collection').value = state.collectionFilter;
    renderLibraryView();
    setFocusedElement(libraryGrid.querySelector('.focusable') || document.querySelector('.console-library-nav [data-section=groups]'));
    return true;
  }
  if (action === 'console-choice') {
    const target = consoleChoiceTarget;
    document.querySelector('#console-choice-dialog').close();
    target.value = source.dataset.value;
    target.dispatchEvent(new Event('change',{bubbles:true}));
    setFocusedElement(target,{scroll:false});
    return true;
  }
  if (action === 'console-file-roots') { await browseConsoleFiles(); return true; }
  if (action === 'console-file-up') { await browseConsoleFiles(consoleFileParent); return true; }
  if (action === 'console-file-entry') { source.dataset.directory==='true' ? await browseConsoleFiles(source.dataset.path) : finishConsoleFiles(source.dataset.path); return true; }
  if (action === 'console-file-select') { finishConsoleFiles(consoleFilePath); return true; }
  if (action === 'console-file-cancel') { finishConsoleFiles(); return true; }
  return false;
}
function normalizeConsoleTitle(title) { return String(title).toLowerCase().replace(/[^a-z0-9]/g,''); }
function renderConsoleGroups() {
  const groups = [{id:'favorites',name:'Favorites',gameIds:state.favoriteGameIds},...state.customCollections.map(group=>({...group,id:'custom:'+group.id}))];
  const sources=collectionSources.map(([provider,source,description])=>({provider,source,description,games:state.games.filter(game=>!game.isApp&&game.provider===provider)})).filter(group=>group.games.length);
  document.querySelector('#library-heading').textContent = 'Groups';
  libraryCount.textContent = `${groups.length+sources.length} groups`;
  libraryGrid.innerHTML = sources.map(group=>collectionBand({id:`library-source-${group.source}`,title:group.provider,description:group.description,source:group.source,provider:group.provider,games:group.games})).join('') + groups.map((group,index)=>collectionBand({id:`library-group-${index}`,title:group.name,description:'Your collection, your way.',games:displayedLibraryGames().filter(game=>!game.isApp && libraryCopyIds(game).some(id=>group.gameIds.includes(id))),collection:group.id,empty:true})).join('');
}
document.querySelector('#console-file-dialog').addEventListener('close',()=>{ if(consoleFileRequest)finishConsoleFiles(); });
document.addEventListener('pointermove',()=>document.body.classList.remove('controller-input'),{passive:true});
document.querySelectorAll('select').forEach(select=>{
  select.addEventListener('pointerdown',event=>{event.preventDefault();openConsoleChoice(select);});
  select.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();openConsoleChoice(select);}});
});
hydrateConsoleIcons();
updateConsoleClock();
setInterval(()=>{if(document.visibilityState==='visible')updateConsoleClock();},30000);
