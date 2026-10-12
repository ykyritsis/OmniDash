// Garrison: the full screen Xbox PC app shell. Library, launch and metadata
// behaviour stays in app.js; this layer arranges, labels and navigates it.
document.body.classList.add('garrison');

// Fluent UI System Icons (garrison-icons.js), the family the Xbox PC app draws with.
const gIconNames = {
  home: 'home', library: 'library', shop: 'shopping_bag', search: 'search', settings: 'settings', bell: 'alert', addFriend: 'person_add',
  filter: 'filter', sort: 'arrow_sort_up_lines', chevronDown: 'chevron_down', chevronRight: 'chevron_right', grid: 'grid', list: 'apps_list',
  heart: 'heart', heartFill: 'heart_filled', more: 'more_horizontal', play: 'play', game: 'games', delete: 'delete', open: 'open',
  check: 'checkmark', globe: 'globe', edit: 'edit', feedback: 'feedback', contact: 'person', power: 'power', refresh: 'arrow_clockwise',
  folder: 'folder_open', add: 'add', close: 'dismiss', download: 'arrow_download', info: 'info', keyboard: 'games', shield: 'shield_lock',
  language: 'local_language', volume: 'speaker_2', ease: 'accessibility', color: 'paint_brush', stream: 'video_clip', calculator: 'calculator',
  tv: 'desktop', drive: 'hard_drive', repair: 'wrench', photo: 'image', tag: 'tag', star: 'star', people: 'people_add', fullscreen: 'full_screen_maximize',
  controller: 'xbox_controller', help: 'question_circle', hide: 'eye_off', show: 'eye', friends: 'people', chat: 'chat', headset: 'headset', pause: 'pause'
};
function gIcon(name, className = '') {
  return `<svg class="g-glyph${className ? ' ' + className : ''}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${gIconPaths[gIconNames[name]] || gIconPaths.info}</svg>`;
}
const gGamePassMark = '<span class="g-gamepass" aria-hidden="true"><b>GAME</b><b>PASS</b></span>';
const gPrefs = (() => { try { return JSON.parse(localStorage.getItem('garrison') || '{}'); } catch { return {}; } })();
function saveGarrisonPrefs() { try { localStorage.setItem('garrison', JSON.stringify(gPrefs)); } catch { /* Storage unavailable. */ } }

// ---------- Top bar ----------
(function buildTopBar() {
  const set = (selector, html) => { const node = document.querySelector(selector); if (node) node.innerHTML = html; };
  set('.top-nav-button[data-action="home"]', gIcon('home'));
  set('.top-nav-button[data-action="library"]', gIcon('library'));
  set('.top-nav-button[data-action="dashboard-gamepass"]', gGamePassMark);
  set('.top-nav-button[data-action="dashboard-store"]', gIcon('shop'));
  set('.top-nav-button[data-action="toggle-search"]', gIcon('search'));
  set('.top-actions .g-icon-button[data-action="settings"]', gIcon('settings'));
  const bell = document.querySelector('#g-notifications-button');
  bell.querySelector('svg')?.replaceWith(document.createRange().createContextualFragment(gIcon('bell')));
  const status = document.querySelector('#controller-status-button');
  status.querySelector('svg')?.replaceWith(document.createRange().createContextualFragment(gIcon('addFriend')));
})();

// ---------- Library ----------
const gSources = [
  ['Steam', 'Steam'], ['Xbox PC', 'Xbox'], ['Epic Games', 'Epic Games'], ['Ubisoft Connect', 'Ubisoft Connect'],
  ['EA app', 'EA app'], ['Battle.net', 'Battle.net'], ['GOG Galaxy', 'GOG GALAXY'], ['Amazon Games', 'Amazon Games'],
  ['Rockstar Games', 'Rockstar Games'], ['Riot Games', 'Riot Games'], ['itch.io', 'itch.io'], ['PC', 'Custom']
];
state.gLayout = gPrefs.layout === 'list' ? 'list' : 'grid';
(function buildLibraryToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'g-library-toolbar';
  const filter = document.querySelector('#library-filter-button');
  filter.innerHTML = `${gIcon('filter')}<i id="library-filter-count" hidden></i>`;
  filter.dataset.gLabel = 'Filter';
  const sort = document.querySelector('#library-sort');
  for (const option of sort.options) if (option.value === 'name') option.textContent = 'Alphabetical';
  const sortWrap = document.createElement('span');
  sortWrap.className = 'g-sort-pill';
  sortWrap.innerHTML = gIcon('sort', 'g-sort-icon') + gIcon('chevronDown', 'g-chevron');
  sortWrap.insertBefore(sort, sortWrap.lastChild);
  const spacer = document.createElement('span');
  spacer.className = 'g-toolbar-spacer';
  const view = document.createElement('button');
  view.id = 'g-view-button';
  view.type = 'button';
  view.className = 'g-view-button focusable';
  view.dataset.action = 'g-view-menu';
  view.setAttribute('aria-label', 'View as');
  toolbar.append(filter, sortWrap, spacer, document.querySelector('#library-count'), view);
  document.querySelector('.library-heading-row').after(toolbar);
  document.querySelector('.console-library-content').prepend(document.querySelector('.g-library-tabs-row'), document.querySelector('#g-source-chips'));
  document.querySelector('.g-round-add').innerHTML = gIcon('add');
})();

function renderGarrisonViewButton() {
  document.querySelector('#g-view-button').innerHTML = gIcon(state.gLayout === 'list' ? 'list' : 'grid') + gIcon('chevronDown', 'g-chevron');
}

function renderGarrisonSourceChips() {
  const target = document.querySelector('#g-source-chips');
  const tab = libraryView.dataset.gTab;
  target.hidden = tab !== 'games';
  if (target.hidden) return;
  const present = new Set(state.games.filter(game => !game.isApp).map(game => game.provider));
  const chips = [['all', 'All'], ['favorites', 'Favorites'], ['groups', 'Collections'],
    ...gSources.filter(([provider]) => present.has(provider)), ...(state.games.some(game => game.isApp) ? [['apps', 'Apps']] : []), ...(state.hiddenGames?.length ? [['hidden', 'Hidden']] : [])];
  const active = state.gHiddenView ? 'hidden' : state.consoleLibraryGroups ? 'groups' : state.libraryCategory === 'apps' ? 'apps'
    : state.collectionFilter === 'favorites' ? 'favorites' : state.sourceFilter || 'all';
  const focused = target.contains(document.activeElement) ? document.activeElement.dataset.source : null;
  target.innerHTML = chips.map(([value, label]) => `<button class="g-chip focusable${value === active ? ' active' : ''}" type="button" role="tab" aria-selected="${value === active}" data-action="g-source" data-source="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('');
  if (focused) setFocusedElement(target.querySelector(`[data-source="${CSS.escape(focused)}"]`), { scroll: false });
}

// ---------- Queue: Steam's own download list, laid out like the Xbox app's Queue page ----------
const gDownloads = { list: [], rates: new Map(), overrides: new Map(), timer: 0, known: new Set(), running: false };
function gQueueGame(appId, title) {
  return state.games.find(game => game.provider === 'Steam' && String(game.appId) === String(appId))
    || { id: `steam-queue-${appId}`, title: title || 'Steam game', provider: 'Steam', appId: String(appId), installed: false, queueOnly: true,
      artwork: { tile: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`, hero: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg` } };
}
function gQueueRows() {
  const rows = new Map();
  for (const item of gDownloads.list) rows.set(String(item.appId), { game: gQueueGame(item.appId, item.title), result: { ...item } });
  for (const { game, result } of installTracking.values()) {
    const key = String(game.appId || game.id);
    if (!rows.has(key)) rows.set(key, { game, result: { state: 'waiting', percent: null, ...(result || {}) } });
  }
  for (const [key, row] of rows) {
    const override = gDownloads.overrides.get(key);
    if (override && Date.now() - override.at < 12000 && row.result.state !== 'installing') row.result.state = override.state;
    else if (override) gDownloads.overrides.delete(key);
    row.result.rate = row.result.state === 'downloading' ? (row.result.rate || gDownloads.rates.get(key)?.rate || 0) : 0;
  }
  return [...rows.values()];
}
const gQueueLabels = { downloading: 'Installing', installing: 'Installing', paused: 'Paused', waiting: 'Starting', queued: 'Queued' };
function gQueueRow({ game, result }) {
  const percent = Number.isFinite(result.percent) ? result.percent : null;
  const size = result.total ? (result.downloaded ? `${formatBytes(result.downloaded)} of ${formatBytes(result.total)}` : formatBytes(result.total)) : '';
  const paused = result.state === 'paused';
  const steam = /^\d+$/.test(String(game.appId || ''));
  const speed = result.state === 'downloading' ? gSpeed(result.rate) : '';
  return `<div class="g-queue-row" data-state="${escapeHtml(result.state || 'queued')}">
    <button class="g-queue-main focusable" type="button" data-action="${game.queueOnly ? 'g-noop' : 'select-game'}" data-game-id="${escapeHtml(game.id)}" aria-label="${escapeHtml(game.title)}, ${escapeHtml(gQueueLabels[result.state] || 'Queued')}${percent === null ? '' : ' ' + percent + '%'}">
      <span class="g-queue-art">${gameArt(game)}</span>
      <span class="g-queue-copy"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(gQueueLabels[result.state] || 'Queued')}${size ? ' · ' + size : ''}</small>
        <span class="g-progress${paused ? ' paused' : ''}"><i style="width:${percent ?? 0}%"></i></span></span>
      <span class="g-queue-stats">${speed ? `<span>${escapeHtml(speed)}</span><span aria-hidden="true">·</span>` : ''}<b>${percent === null ? '' : (result.estimated ? '≈ ' : '') + percent + '%'}</b></span>
    </button>
    ${steam && result.state !== 'waiting' ? `<button class="g-queue-icon focusable" type="button" data-action="g-queue-toggle" data-app-id="${escapeHtml(game.appId)}" aria-label="${paused ? 'Resume' : 'Pause'} ${escapeHtml(game.title)}" title="${paused ? 'Resume' : 'Pause'}">${gIcon(paused ? 'play' : 'pause')}</button>
    <button class="g-queue-icon focusable" type="button" data-action="g-queue-more" data-app-id="${escapeHtml(game.appId)}" aria-label="More options for ${escapeHtml(game.title)}" title="More options for ${escapeHtml(game.title)}">${gIcon('more')}</button>` : ''}
  </div>`;
}
function renderGarrisonQueue() {
  const rows = gQueueRows();
  const active = rows.filter(row => row.result.state !== 'queued');
  const upNext = rows.filter(row => row.result.state === 'queued');
  libraryCount.textContent = `${rows.length} item${rows.length === 1 ? '' : 's'}`;
  const allPaused = rows.length && rows.every(row => ['paused', 'queued'].includes(row.result.state));
  const lead = active[0]?.game || upNext[0]?.game;
  const hero = lead?.artwork?.hero || lead?.artwork?.wide || lead?.artwork?.tile || '';
  libraryGrid.innerHTML = rows.length
    ? `<div class="g-queue">${hero ? `<div class="g-queue-backdrop" aria-hidden="true"><img src="${escapeHtml(hero)}" alt="" decoding="async" /></div>` : ''}
        <div class="g-queue-head"><h2>Active</h2>${rows.some(row => /^\d+$/.test(String(row.game.appId || ''))) ? `<button class="g-pill focusable" type="button" data-action="g-queue-all" data-mode="${allPaused ? 'resume-all' : 'pause-all'}">${allPaused ? 'Resume all' : 'Pause all'}</button>` : ''}</div>
        <div class="g-queue-list">${active.map(gQueueRow).join('') || '<p class="g-queue-none">Nothing is installing right now.</p>'}</div>
        ${upNext.length ? `<div class="g-queue-head"><h2>Up next</h2></div><div class="g-queue-list">${upNext.map(gQueueRow).join('')}</div>` : ''}
      </div>`
    : `<div class="g-empty">${gIcon('download')}<h2>Your queue is empty</h2><p>Games you install from your library appear here while they download.</p></div>`;
}
async function gPollDownloads() {
  if (gDownloads.running) return;
  gDownloads.running = true;
  clearTimeout(gDownloads.timer);
  const visible = state.view === 'library' && state.libraryQueue && !document.hidden;
  // Downloads started in Steam itself are picked up too, so the game page and Queue show them.
  try {
    const list = await window.launcher.getSteamDownloads();
    const now = Date.now(), ids = new Set(list.map(item => String(item.appId)));
    for (const item of list) {
      const key = String(item.appId), previous = gDownloads.rates.get(key);
      if (previous && item.downloaded > previous.bytes) gDownloads.rates.set(key, { bytes: item.downloaded, at: now, rate: (item.downloaded - previous.bytes) * 8 / ((now - previous.at) / 1000) });
      else if (!previous) gDownloads.rates.set(key, { bytes: item.downloaded, at: now, rate: 0 });
      else if (now - previous.at > 20000) previous.rate = 0;
    }
    const finished = [...gDownloads.known].filter(id => !ids.has(id));
    gDownloads.known = ids;
    gDownloads.list = list;
    // The game page's Installing button reads the same numbers as the Queue.
    for (const item of list) {
      const game = state.games.find(entry => entry.provider === 'Steam' && String(entry.appId) === String(item.appId));
      if (!game) continue;
      if (!installTracking.has(game.id)) installTracking.set(game.id, { game, at: Date.now() });
      const tracked = installTracking.get(game.id);
      tracked.result = { ...item, installed: false };
      renderGarrisonInstallButton(game, tracked.result);
    }
    for (const appId of finished) {
      const game = state.games.find(entry => entry.provider === 'Steam' && String(entry.appId) === appId);
      if (!game) continue;
      const result = await window.launcher.getSteamInstallStatus(game.id).catch(() => null);
      // A missing queue entry can mean completion or cancellation. Only Steam's
      // installed flag permits Play; never treat a 100% download as installed.
      if (result?.installed || (result?.state === 'waiting' && !result.requestedAt)) {
        installTracking.delete(game.id);
        gDownloads.rates.delete(appId);
        gDownloads.overrides.delete(appId);
        if (result.installed) game.installed = true;
        if (state.detailGameId === game.id) {
          const button = document.querySelector('#detail-play');
          button.classList.remove('g-installing');
          button.style.removeProperty('--g-install');
          button.innerHTML = `<strong>${game.installed !== false ? 'Play' : 'Install'}</strong>`;
        }
      }
    }
    if (finished.length && !state.activeGameSession) scanLibrary(false, false, true).catch(() => {});
    if (visible && !topmostOpenDialog()) gRefreshQueue();
  } catch { /* Steam may be restarting. */ }
  finally {
    gDownloads.running = false;
    gDownloads.timer = setTimeout(gPollDownloads, visible || installTracking.size ? 2000 : 20000);
  }
}
function gRefreshQueue(focusSelector = '') {
  const focused = document.activeElement;
  const key = focusSelector || (focused?.dataset?.appId ? `[data-action="${focused.dataset.action}"][data-app-id="${CSS.escape(focused.dataset.appId)}"]` : focused?.dataset?.gameId ? `.g-queue-main[data-game-id="${CSS.escape(focused.dataset.gameId)}"]` : focused?.dataset?.action === 'g-queue-all' ? '[data-action="g-queue-all"]' : '');
  renderGarrisonQueue();
  refreshFocusables();
  if (key && libraryGrid.contains(focused) || focusSelector) setFocusedElement(libraryGrid.querySelector(key), { scroll: false });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) gPollDownloads(); });
// Pause and resume use Steam's own download controls. They're turned on once, with the player's OK.
async function gEnsureDownloadControls() {
  const status = await window.launcher.getSteamDownloadControls().catch(() => ({}));
  if (status.live) return true;
  if (status.enabled) { showToast('Steam is starting. Try again in a moment.'); return false; }
  const choice = await gChoice('Pause and resume here', 'To pause and resume Steam downloads from here, Steam needs its download controls turned on. Steam restarts quietly in the background to apply it.<br><br>The controls only accept connections from this PC, but while they\'re on, other apps on this PC could also control Steam. You can turn them off in Settings › Manage games.', [['on', 'Turn on', true], ['', 'Not now']]);
  if (choice !== 'on') return false;
  if (state.activeGameSession) { showToast('Close your game first. Steam has to restart to turn this on.'); return false; }
  showToast('Turning on download controls…');
  await window.launcher.setSteamDownloadControls(true);
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    if ((await window.launcher.getSteamDownloadControls().catch(() => ({}))).live) { showToast('Download controls are on'); return true; }
  }
  showToast('Steam is still starting. Try again in a moment.');
  return false;
}
async function gQueueAction(appId, action) {
  if (!await gEnsureDownloadControls()) return;
  try {
    const result = await window.launcher.steamDownloadAction(appId, action);
    const targets = action.endsWith('-all') ? gQueueRows().map(row => String(row.game.appId)) : [String(appId)];
    if (['pause', 'resume', 'pause-all', 'resume-all'].includes(action)) for (const key of targets) gDownloads.overrides.set(key, { state: result.status, at: Date.now() });
    if (action === 'remove') gDownloads.list = gDownloads.list.filter(item => String(item.appId) !== String(appId));
    gRefreshQueue(action.endsWith('-all') ? '[data-action="g-queue-all"]' : action === 'remove' ? '.g-queue .focusable' : `[data-action="g-queue-toggle"][data-app-id="${CSS.escape(String(appId))}"]`);
  } catch (error) { showToast(String(error.message || 'Steam could not change this download').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); }
}
async function gQueueMore(button) {
  const appId = button.dataset.appId;
  const row = gQueueRows().find(item => String(item.game.appId) === String(appId));
  if (!row) return;
  const paused = row.result.state === 'paused';
  const choice = await gMenu(button, [[paused ? 'resume' : 'pause', paused ? 'Resume install' : 'Pause install'], ['top', 'Move to top'], ['remove', 'Remove from queue']]);
  if (choice) await gQueueAction(appId, choice);
}
// A small first-party style choice dialog.
function gChoice(title, body, options) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'g-flyout g-choice';
    dialog.innerHTML = `<header><h2>${escapeHtml(title)}</h2></header><p>${body}</p><div class="g-choice-actions">${options.map(([value, label, primary]) => `<button class="${primary ? 'g-onboard-primary' : 'g-onboard-secondary'} focusable" type="button" data-choice="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('')}</div>`;
    document.body.append(dialog);
    const done = value => { dialog.close(); dialog.remove(); refreshFocusables(); resolve(value); };
    dialog.addEventListener('click', event => { const button = event.target.closest('[data-choice]'); if (button) done(button.dataset.choice); });
    dialog.addEventListener('cancel', () => done(''));
    dialog.showModal();
    refreshFocusables();
    setFocusedElement(dialog.querySelector('[data-choice]'), { scroll: false });
  });
}
// A context menu anchored to a button, like the Xbox app's "More options" menus.
function gMenu(anchor, items) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'g-menu g-anchored-menu';
    dialog.innerHTML = items.map(([value, label]) => `<button class="focusable" type="button" data-menu="${escapeHtml(value)}">${escapeHtml(label)}</button>`).join('');
    document.body.append(dialog);
    const box = anchor.getBoundingClientRect();
    dialog.style.top = `${Math.round(box.bottom + 6)}px`;
    dialog.style.right = `${Math.round(innerWidth - box.right)}px`;
    const done = value => { dialog.close(); dialog.remove(); refreshFocusables(); setFocusedElement(anchor, { scroll: false }); resolve(value); };
    dialog.addEventListener('click', event => { const button = event.target.closest('[data-menu]'); if (button) done(button.dataset.menu); else if (event.target === dialog) done(''); });
    dialog.addEventListener('cancel', () => done(''));
    dialog.showModal();
    refreshFocusables();
    setFocusedElement(dialog.querySelector('[data-menu]'), { scroll: false });
  });
}
// "Install to": pick a Steam library drive before the download starts.
function gInstallTo(game) {
  return new Promise(async resolve => {
    let targets;
    try { targets = await window.launcher.getSteamInstallTargets(game.id); } catch { resolve(''); return; }
    if (!targets.libraries.length) { resolve(''); return; }
    let selected = targets.preferred || targets.libraries[0].root;
    const dialog = document.createElement('dialog');
    dialog.className = 'g-flyout g-install-to';
    const render = () => {
      dialog.innerHTML = `<header><h2>Install ${escapeHtml(game.title)}</h2></header>
        <p>${targets.needed ? `Needs about ${escapeHtml(formatBytes(targets.needed))}. ` : ''}Choose where to install it.</p>
        <div class="g-drives" role="radiogroup" aria-label="Install location">${targets.libraries.map(item => {
          const used = item.total ? Math.round((1 - item.free / item.total) * 100) : 0;
          const low = targets.needed && item.free !== null && item.free < targets.needed;
          return `<button class="g-drive focusable${item.root === selected ? ' selected' : ''}${low ? ' low' : ''}" type="button" role="radio" aria-checked="${item.root === selected}" data-root="${escapeHtml(item.root)}">
            ${gIcon('drive', 'g-drive-icon')}<span class="g-drive-copy"><strong>${escapeHtml(item.drive)}</strong><small>${escapeHtml(item.root)}</small>
            <span class="g-drive-bar"><i style="width:${used}%"></i></span><small>${item.free === null ? '' : `${escapeHtml(formatBytes(item.free))} free${item.total ? ` of ${escapeHtml(formatBytes(item.total))}` : ''}`}${low ? ' · Not enough space' : ''}</small></span>
            <i class="g-drive-check">${gIcon('check')}</i></button>`;
        }).join('')}</div>
        <div class="g-choice-actions"><button class="g-onboard-primary focusable" type="button" data-install-confirm>Install</button><button class="g-onboard-secondary focusable" type="button" data-install-cancel>Cancel</button></div>`;
      refreshFocusables();
    };
    const done = value => { dialog.close(); dialog.remove(); refreshFocusables(); resolve(value); };
    dialog.addEventListener('click', event => {
      const drive = event.target.closest('[data-root]');
      if (drive) { selected = drive.dataset.root; render(); setFocusedElement(dialog.querySelector(`[data-root="${CSS.escape(selected)}"]`), { scroll: false }); return; }
      if (event.target.closest('[data-install-confirm]')) { window.launcher.rememberSteamLibrary(selected).catch(() => {}); done(selected); }
      if (event.target.closest('[data-install-cancel]')) done(null);
    });
    dialog.addEventListener('cancel', () => done(null));
    document.body.append(dialog);
    render();
    dialog.showModal();
    setFocusedElement(dialog.querySelector('[data-install-confirm]'), { scroll: false });
  });
}

// Hidden games: kept out of the library until unhidden here.
function renderGarrisonHidden() {
  const games = state.hiddenGames || [];
  libraryCount.textContent = `${games.length} hidden`;
  libraryGrid.classList.remove('g-list');
  libraryGrid.innerHTML = games.length
    ? games.map(game => `<button class="game-card g-hidden-card focusable" type="button" data-action="g-unhide" data-hidden-id="${escapeHtml(game.id)}" aria-label="Unhide ${escapeHtml(game.title)}">${gameArt({ ...game, artwork: game.artwork || {} })}<span class="g-card-text"><em>${escapeHtml(game.provider)}</em><strong>${escapeHtml(game.title)}</strong><small class="g-status">Select to unhide</small></span></button>`).join('')
    : `<div class="g-empty">${gIcon('show')}<h2>No hidden games</h2><p>Hide a game from its options menu to keep it out of your library.</p></div>`;
}
const gApplyLibraryResult = applyLibraryResult;
applyLibraryResult = function (result, ...rest) {
  state.hiddenGames = Array.isArray(result?.hiddenGames) ? result.hiddenGames : state.hiddenGames || [];
  return gApplyLibraryResult(result, ...rest);
};

const gRenderLibraryView = renderLibraryView;
renderLibraryView = function () {
  const tab = state.libraryQueue ? 'queue' : state.libraryTab === 'play-history' ? 'recent'
    : state.installFilter === 'installed' && !state.consoleLibraryGroups && state.libraryCategory !== 'apps' ? 'installed' : 'games';
  libraryView.dataset.gTab = tab;
  gRenderLibraryView();
  const list = state.gLayout === 'list' && !state.consoleLibraryGroups && !state.libraryQueue;
  libraryGrid.classList.toggle('g-list', list);
  if (list && libraryGrid.querySelector('.game-card')) libraryGrid.insertAdjacentHTML('afterbegin', '<div class="g-list-head" aria-hidden="true"><span>Title</span><span>Publisher</span><span>Last played</span><span>Size</span></div>');
  if (state.libraryQueue) { renderGarrisonQueue(); gPollDownloads(); }
  else if (state.gHiddenView && tab === 'games') renderGarrisonHidden();
  document.querySelector('.g-library-toolbar').hidden = Boolean(state.libraryQueue);
  renderGarrisonSourceChips();
  renderGarrisonViewButton();
  // The Installed tab is the install filter; only count filters chosen in the filter sheet.
  const count = document.querySelector('#library-filter-count');
  const chosen = [tab !== 'installed' && state.installFilter !== 'all', tab !== 'games' && state.sourceFilter !== 'all', state.collectionFilter && !['all', 'favorites'].includes(state.collectionFilter)].filter(Boolean).length;
  count.hidden = !chosen;
  count.textContent = String(chosen);
};

// Sizes measured in the background arrive per game; patch the cards already on screen.
window.launcher.onLibrarySizes?.(sizes => {
  for (const [id, bytes] of Object.entries(sizes)) {
    const game = state.games.find(item => item.id === id);
    if (game) game.sizeOnDisk = bytes;
    for (const card of document.querySelectorAll(`.game-card[data-game-id="${CSS.escape(id)}"]`)) {
      const size = card.querySelector('.g-size'), column = card.querySelector('.g-col-size');
      if (size) size.textContent = formatBytes(bytes);
      if (column) column.textContent = formatBytes(bytes);
    }
  }
});

// Load more cards as the grid nears the bottom of the page.
document.querySelector('main').addEventListener('scroll', event => {
  if (state.view !== 'library') return;
  const scroller = event.currentTarget;
  if (scroller.scrollTop + scroller.clientHeight > scroller.scrollHeight - 900) appendLibraryPage();
}, { passive: true });

// ---------- Home: Jump back in, Play with friends, then curated rows like the Xbox app ----------
const gHomeRows = document.createElement('div');
gHomeRows.id = 'g-home-rows';
homeCollections.prepend(gHomeRows);
for (const child of [...homeCollections.children]) if (child !== gHomeRows) child.hidden = true;
function gStoreRow(id, title, games, list) {
  if (!games?.length) return '';
  return `<section class="collection-band" data-tone="xbox" aria-labelledby="${id}-title"><div class="collection-intro"><h2 id="${id}-title"><span class="collection-brand"><span>${escapeHtml(title)}</span></span></h2><button class="collection-open focusable" data-action="collection-store" data-chart="${list}">See all <span aria-hidden="true">›</span></button></div>
    <div class="game-row collection-covers" role="list">${games.slice(0, 12).map(game => `<button class="g-store-card g-home-store focusable" type="button" role="listitem" data-action="g-store-game" data-game-id="${escapeHtml(game.id)}"><span class="g-store-art">${gameArt(game)}</span><span class="g-card-text"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(gStoreCaption(game))}</small></span></button>`).join('')}</div></section>`;
}
renderHomeCollections = function () {
  const saved = captureCollectionPosition();
  favoritesShelf.hidden = true;
  homeCollections.hidden = false;
  const query = state.searchQuery;
  const games = displayedLibraryGames().filter(game => !game.isApp && game.installed !== false && (!query || game.title.toLowerCase().includes(query)));
  const recentIds = new Set([...recentRow.querySelectorAll('.game-card[data-game-id]')].map(card => card.dataset.gameId));
  const rows = [
    ['home-favorites', 'Favorites', games.filter(game => matchesCollection(game, 'favorites')), 'favorites'],
    ['home-added', 'Recently added', [...games].filter(game => game.addedAt).sort((a, b) => b.addedAt - a.addedAt), 'all'],
    ...state.customCollections.map((group, index) => [`home-custom-${index}`, group.name, games.filter(game => matchesCollection(game, `custom:${group.id}`)), `custom:${group.id}`]),
    ['home-controller', 'Great with a controller', games.filter(game => ['controller', 'partial'].includes(game.controls) && !recentIds.has(game.id)), 'controller'],
    ['home-together', 'Play together', games.filter(game => matchesCollection(game, 'multiplayer')), 'multiplayer']
  ];
  gHomeRows.innerHTML = rows.filter(([, , list]) => list.length).map(([id, title, list, collection]) => collectionBand({ id, title, description: '', games: list, collection }))
    .join('') + gStoreRow('home-store-popular', 'Popular on Xbox', state.xboxStore?.popular, 'popular') + gStoreRow('home-store-new', 'New on Xbox', state.xboxStore?.newReleases, 'newReleases');
  gHomeRows.querySelectorAll('.collection-open').forEach(button => { if (button.dataset.action === 'collection-open') button.innerHTML = 'See all <span aria-hidden="true">›</span>'; });
  restoreCollectionPosition(saved);
  refreshFocusables();
};
// Jump back in: six recent games, then a tile that opens the whole library.
const gRenderLibrary = renderLibrary;
renderLibrary = function (...args) {
  gRenderLibrary.apply(this, args);
  const cards = [...recentRow.querySelectorAll('.game-card')];
  cards.slice(6).forEach(card => card.remove());
  const more = displayedLibraryGames().filter(game => !game.isApp && game.installed !== false && !cards.slice(0, 6).some(card => card.dataset.gameId === game.id)).slice(0, 4);
  if (cards.length) recentRow.insertAdjacentHTML('beforeend', `<button class="g-library-tile focusable" type="button" data-action="library" aria-label="Open your library"><span class="g-collage">${more.map(game => `<span>${gameArt(game)}</span>`).join('')}</span><span class="g-library-label">${gIcon('library')}<strong>My games</strong></span></button>`);
  renderHomeCollections();
  refreshFocusables();
};
setTimeout(() => loadXboxStore().then(() => { if (state.view === 'home') renderHomeCollections(); }), 6000);

// ---------- Boot: green bloom, the Xbox sphere with a light sweep and ring pulse, then Home rises ----------
(function buildBoot() {
  const screen = document.querySelector('#startup-screen');
  screen.innerHTML = '<div class="g-boot-bloom"></div><div class="g-boot-ring"></div><div class="g-boot-mark"><img src="assets/xbox.svg" alt="" /><span class="g-boot-sweep"></span></div><span class="g-boot-word">XBOX PREVIEW UI</span>';
})();
runStartupSequence = function (settings) {
  if (settings.startupAnimation === false) return;
  const screen = document.querySelector('#startup-screen');
  const reduced = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  screen.hidden = false;
  screen.classList.remove('leaving');
  screen.classList.toggle('still', Boolean(reduced));
  const playStartup = () => { if (!screen.hidden && settings.soundEffects !== false) interfaceAudio.play('startup'); };
  if (document.hasFocus()) playStartup(); else window.addEventListener('focus', playStartup, { once: true });
  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    screen.classList.add('leaving');
    if (!reduced) {
      document.body.classList.add('g-entering');
      setTimeout(() => document.body.classList.remove('g-entering'), 1100);
    }
    setTimeout(() => { screen.hidden = true; screen.classList.remove('leaving'); }, reduced ? 0 : 520);
    window.removeEventListener('keydown', dismiss);
    window.removeEventListener('focus', playStartup);
    screen.removeEventListener('pointerdown', dismiss);
  };
  window.addEventListener('keydown', dismiss, { once: true });
  screen.addEventListener('pointerdown', dismiss, { once: true });
  setTimeout(dismiss, reduced ? 200 : 2350);
};

// ---------- Onboarding: welcome, you, your libraries, done. Detected accounts need one press. ----------
// Launchers that can also bring in games you own but haven't installed are switchable here.
const gOnboardIcons = { steam: 'assets/steam.svg', 'steam-family': 'assets/steam.svg', epic: 'assets/epic.svg', ea: 'assets/ea.svg', battlenet: 'assets/battlenet.svg', ubisoft: 'assets/ubisoft.svg', xbox: 'assets/xbox.svg' };
const gOnboard = { step: 0, identity: null, linked: {}, local: null, accounts: {}, sources: null, busy: {} };
(function buildOnboarding() {
  onboardingDialog.className = 'g-onboarding';
  onboardingDialog.innerHTML = `<div class="g-onboard-stage"></div>
    <div hidden aria-hidden="true"><input id="onboard-name" /><input id="onboard-steam-key" /><input id="onboard-sgdb-key" /><input id="onboard-steam-id" /><input id="onboard-uninstalled" type="checkbox" /><span id="onboard-uninstalled-note"></span><span id="onboard-steam-status"></span><span id="onboard-steam-check"></span><div id="onboard-avatar-choices"></div><button id="onboard-back"></button><button id="onboard-next"></button><button id="onboard-finish"></button></div>`;
})();
function gOnboardDots(step) { return `<div class="g-onboard-dots">${[0, 1, 2, 3].map(index => `<i class="${index === step ? 'active' : index < step ? 'done' : ''}"></i>`).join('')}</div>`; }
function gOnboardStatus(source) {
  const busy = gOnboard.busy[source.id];
  if (busy) return busy;
  if (!source.owned) return 'Installed games are found automatically';
  const games = count => `${count} game${count === 1 ? '' : 's'}`;
  if (source.id === 'steam-family' && source.enabled && !source.ready) return 'On · Sign in to Steam to load shared games';
  if (source.id === 'steam-family') return source.enabled && source.ready ? (source.noFamily ? 'This account isn\'t in a Steam Family' : `${games(source.count)} shared with you`) : 'Also include games your Steam Family shares';
  if (source.enabled) return source.count ? `Including ${games(source.count)} you haven't installed` : 'Including games you haven\'t installed';
  if (source.id === 'steam') return source.ready ? 'Linked · Installed games only' : gOnboard.identity?.name ? `Signed in as ${gOnboard.identity.name} · Installed games only` : 'Installed games only';
  if (source.id === 'epic' && !source.ready) return 'Installed games only · Uninstalled games need the Legendary helper';
  if (['ea', 'battlenet'].includes(source.id)) return source.ready ? 'Linked · Installed games only' : 'Installed games only · Sign in to add the rest';
  return 'Installed games only';
}
function gOnboardService(source) {
  const icon = gOnboardIcons[source.id];
  const mark = icon ? `<img src="${icon}" alt="" />` : `<span class="g-onboard-mark" aria-hidden="true">${escapeHtml(source.name.slice(0, 1))}</span>`;
  const blocked = source.id === 'epic' && !source.ready;
  const control = source.owned
    ? `<span class="g-switch${source.enabled ? ' on' : ''}${blocked ? ' blocked' : ''}" aria-hidden="true"><i></i></span>`
    : `<i class="g-onboard-check">${gIcon('check')}</i>`;
  return `<button class="g-onboard-service focusable${source.enabled || !source.owned ? ' linked' : ''}${gOnboard.busy[source.id] ? ' busy' : ''}" type="button" ${source.owned ? `role="switch" aria-checked="${source.enabled}" data-action="g-onboard-toggle"` : 'data-action="g-onboard-noop"'} data-service="${source.id}" aria-label="${escapeHtml(source.name)}${source.owned ? ', include games you haven\'t installed' : ''}">${source.id === 'steam-family' ? `<span class="g-onboard-family">${mark}${gIcon('people')}</span>` : mark}<span><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(gOnboardStatus(source))}</small></span>${control}</button>`;
}
function gOnboardServicesMarkup() {
  if (!gOnboard.sources) return '<p class="g-onboard-loading">Finding launchers on this PC…</p>';
  // Family games sit under Steam: they're only offered once Steam includes games you haven't installed.
  const steamOn = gOnboard.sources.find(item => item.id === 'steam')?.enabled;
  return gOnboard.sources.filter(item => item.id !== 'steam-family' || steamOn).map(gOnboardService).join('');
}
function renderOnboarding(focus = true) {
  const stage = onboardingDialog.querySelector('.g-onboard-stage');
  const step = gOnboard.step;
  const name = gOnboard.identity?.name || state.displayName || 'Player';
  const avatar = gOnboard.identity?.avatar ? `<img src="${escapeHtml(gOnboard.identity.avatar)}" alt="" />` : document.querySelector('#profile-avatar').innerHTML;
  stage.dataset.step = String(step);
  stage.innerHTML = step === 0
    ? `<div class="g-onboard-hero"><img class="g-onboard-logo" src="assets/xbox.svg" alt="" /><h1>Welcome</h1><p>All your PC games, from every launcher, in one Xbox home.</p><button class="g-onboard-primary focusable" type="button" data-action="g-onboard-next">Get started</button></div>${gOnboardDots(0)}`
    : step === 1
      ? `<div class="g-onboard-panel"><h1>Is this you?</h1><p>${gOnboard.identity?.name ? 'We found your Steam account on this PC.' : 'Choose how you appear on this PC. You can change it any time.'}</p><div class="g-onboard-player"><span class="g-onboard-avatar">${avatar}</span><strong>${escapeHtml(name)}</strong></div><div class="g-onboard-actions"><button class="g-onboard-primary focusable" type="button" data-action="g-onboard-next">Continue as ${escapeHtml(name)}</button><button class="g-onboard-secondary focusable" type="button" data-action="g-onboard-rename">Use another name</button></div></div>${gOnboardDots(1)}`
      : step === 2
        ? `<div class="g-onboard-panel g-onboard-wide"><h1>Bring your games</h1><p>Installed games from every launcher appear automatically. Switch a launcher on to also include games you own but haven't installed.</p><div class="g-onboard-services">${gOnboardServicesMarkup()}</div><div class="g-onboard-actions"><button class="g-onboard-primary focusable" type="button" data-action="g-onboard-next">Continue</button></div><p class="g-onboard-note">Sign-ins happen on each service's own website. Your passwords are never seen or stored here.</p></div>${gOnboardDots(2)}`
        : `<div class="g-onboard-hero"><span class="g-onboard-done">${gIcon('check')}</span><h1>You're all set</h1><p>We'll bring in your games now. This only takes a moment.</p><button class="g-onboard-primary focusable" type="button" data-action="g-onboard-finish">Let's go</button></div>${gOnboardDots(3)}`;
  refreshFocusables();
  if (focus) setFocusedElement(stage.querySelector('.g-onboard-primary') || stage.querySelector('.focusable'), { scroll: false });
}
showOnboardingStep = function (step) {
  gOnboard.step = Math.max(0, Math.min(3, step));
  state.onboardingStep = gOnboard.step;
  refreshOnboardingAccounts();
  renderOnboarding();
};
async function refreshOnboardingAccounts() {
  const [identity, local, sources, settings] = await Promise.all([
    window.launcher.getPlayerIdentity().catch(() => null), window.launcher.getSteamLocalStatus().catch(() => null),
    window.launcher.getImportSources().catch(() => null), window.launcher.getSettings().catch(() => ({}))
  ]);
  gOnboard.identity = identity?.available ? identity : null;
  gOnboard.local = local;
  if (sources) gOnboard.sources = sources;
  gOnboard.linked.steam = Boolean(settings.steamApiKey);
  if (onboardingDialog.open) gRenderOnboardServices();
}
// Re-render only the launcher tiles, keeping focus where it was.
function gRenderOnboardServices() {
  const list = onboardingDialog.querySelector('.g-onboard-services');
  if (!list) return;
  const focused = document.activeElement?.dataset?.service;
  list.innerHTML = gOnboardServicesMarkup();
  refreshFocusables();
  if (focused) setFocusedElement(list.querySelector(`[data-service="${CSS.escape(focused)}"]`), { scroll: false });
}
window.launcher.onConnectionProgress(data => {
  const id = { steam: 'steam', 'steam-family': 'steam-family', ea: 'ea', battlenet: 'battlenet' }[data.provider];
  if (!id || !onboardingDialog.open || !(id in gOnboard.busy)) return;
  gOnboard.busy[id] = data.message;
  gRenderOnboardServices();
});

const gOnboardActions = {
  'g-onboard-next': () => showOnboardingStep(gOnboard.step + 1),
  'g-onboard-noop': () => {},
  'g-onboard-toggle': async source => {
    const id = source.dataset.service;
    const entry = gOnboard.sources?.find(item => item.id === id);
    if (!entry || id in gOnboard.busy) return;
    const enable = !entry.enabled;
    if (enable && id === 'epic' && !entry.ready) { showToast('Epic needs the Legendary helper for games you haven\'t installed. Set it up any time in Settings › Libraries.'); return; }
    gOnboard.busy[id] = enable ? ({ steam: 'Waiting for Steam sign-in…', 'steam-family': 'Waiting for Steam sign-in…', ea: 'Waiting for EA sign-in…', battlenet: 'Waiting for Battle.net sign-in…' }[id] || 'Turning on…') : 'Turning off…';
    gRenderOnboardServices();
    try {
      let result = await window.launcher.setUninstalledImport(id, enable);
      if (result.status === 'needs-link') {
        const linked = await window.launcher.steamAutoLink();
        if (linked.status === 'linked') { gOnboard.busy[id] = `Linked · ${linked.count} games in your account`; gRenderOnboardServices(); result = await window.launcher.setUninstalledImport(id, true); }
      }
      if (result.status === 'needs-steam') showToast('Turn on Steam first. Family games follow your Steam setting.');
      if (id === 'steam' && !enable) await window.launcher.setUninstalledImport('steam-family', false).catch(() => {});
      if (result.status === 'on' && Number.isFinite(result.count)) showToast(`${entry.name} · ${result.count} game${result.count === 1 ? '' : 's'} found`);
    } catch (error) { showToast(String(error.message || 'Could not change this launcher').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); }
    delete gOnboard.busy[id];
    await refreshOnboardingAccounts();
  },
  'g-onboard-rename': async () => {
    const value = await gAskName(gOnboard.identity?.name || state.displayName || '');
    if (value) { state.displayName = value; gOnboard.identity = { ...(gOnboard.identity || {}), name: value, custom: true }; renderOnboarding(); }
  },
  'g-onboard-link': async source => {
    const service = source.dataset.service;
    source.querySelector('small').textContent = service === 'steam' ? 'Waiting for Steam sign-in…' : 'Waiting for sign-in…';
    try {
      if (service === 'steam') {
        const result = await window.launcher.steamAutoLink();
        if (result.status === 'linked') { gOnboard.linked.steam = true; showToast(result.privateLibrary ? 'Steam linked. Make your game details public in Steam to see uninstalled games.' : `Steam linked · ${result.count} games in your account`); }
      } else await window.launcher.connectLibraryAccount(service);
    } catch (error) { showToast(String(error.message || 'Could not link this account').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); }
    await refreshOnboardingAccounts();
    renderOnboarding(false);
    setFocusedElement(onboardingDialog.querySelector(`[data-service="${service}"]`), { scroll: false });
  },
  'g-onboard-finish': async () => {
    try {
      const custom = Boolean(gOnboard.identity?.custom);
      const displayName = (custom ? gOnboard.identity.name : gOnboard.identity?.name) || state.displayName || 'Player';
      await window.launcher.saveSettings({ onboardingComplete: true, displayName, profileNameMode: custom ? 'custom' : 'steam', avatarId: selectedAvatarId || 'steam-profile', profileAvatarCustomized: false });
      state.displayName = displayName;
      onboardingDialog.close();
      refreshPlayerIdentity();
      await scanLibrary(false, true);
    } catch (error) { showToast(error.message || 'Could not finish setup'); }
  }
};
// A simple name prompt using the launcher's on-screen keyboard friendly input.
function gAskName(initial) {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'g-flyout g-name-flyout';
    dialog.innerHTML = `<header><h2>Your name</h2></header><input class="g-input focusable" maxlength="32" value="${escapeHtml(initial)}" aria-label="Your name" /><div class="g-onboard-actions"><button class="g-onboard-primary focusable" type="button" data-name-save>Save</button></div>`;
    document.body.append(dialog);
    const input = dialog.querySelector('input');
    const done = value => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.querySelector('[data-name-save]').addEventListener('click', () => done(input.value.trim().slice(0, 32)));
    input.addEventListener('keydown', event => { if (event.key === 'Enter') done(input.value.trim().slice(0, 32)); });
    dialog.addEventListener('cancel', () => done(''));
    dialog.showModal();
    refreshFocusables();
    setFocusedElement(input, { scroll: false });
  });
}

// Background library refreshes wait while a game is running, so the launcher stays quiet mid-game.
const gScanLibrary = scanLibrary;
scanLibrary = function (refreshArt = false, fullScreenImport = false, backgroundRefresh = false) {
  if (backgroundRefresh && state.activeGameSession && !refreshArt) {
    clearTimeout(gScanLibrary.deferred);
    gScanLibrary.deferred = setTimeout(() => scanLibrary(refreshArt, fullScreenImport, backgroundRefresh), 10 * 60 * 1000);
    return Promise.resolve();
  }
  return gScanLibrary(refreshArt, fullScreenImport, backgroundRefresh);
};

// Home has no full screen backdrop here, so never decode or fetch one while moving focus.
updateAmbient = function () {};
document.querySelector('#shuffle-home-screenshots-toggle').closest('label').hidden = true;

// ---------- Store: the Xbox Store's own lists, in the Library's tab bar and cover grid ----------
const gStoreLists = { popular: 'Popular', newReleases: 'New releases', free: 'Free to play' };
function gPrice(price) {
  if (!price) return '';
  if (!price.list) return 'Free';
  const format = new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currency || 'USD' });
  return price.discount && price.msrp > price.list ? `${format.format(price.list)} · −${Math.round(price.discount)}%` : format.format(price.list);
}
function gStoreCaption(game) {
  const owned = state.games.find(item => item.xboxProductId === game.xboxProductId || normalizeConsoleTitle(item.title) === normalizeConsoleTitle(game.title));
  return owned ? 'Owned' : gPrice(game.price) || 'View details';
}
async function loadXboxStore(force = false) {
  if (state.xboxStore?.status === 'ready' && !force) return state.xboxStore;
  if (gStoreRequest) return gStoreRequest;
  state.xboxStore = { ...(state.xboxStore || {}), status: 'loading' };
  gStoreRequest = window.launcher.getXboxStore().then(result => { state.xboxStore = result; return result; })
    .catch(() => { state.xboxStore = { status: 'unavailable' }; return state.xboxStore; })
    .finally(() => { gStoreRequest = null; if (state.view === 'store' && state.consoleStoreMode !== 'gamepass') renderConsoleStore(); });
  return gStoreRequest;
}
let gStoreRequest = null;
renderNativeStore = function (grid) {
  document.querySelector('#store-rail')?.remove();
  const view = document.querySelector('#store-view');
  view.classList.add('native-store', 'g-store');
  if (!gStoreLists[consoleStoreTab]) consoleStoreTab = 'popular';
  if (!state.xboxStore || state.xboxStore.status === 'unavailable' && !gStoreRequest) loadXboxStore(state.xboxStore?.status === 'unavailable');
  const games = state.xboxStore?.[consoleStoreTab] || [];
  document.querySelector('#store-heading').textContent = 'Store';
  document.querySelectorAll('.console-store-tabs button').forEach(tab => {
    const active = tab.dataset.tab === consoleStoreTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  let toolbar = view.querySelector('.g-store-toolbar');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'g-store-toolbar';
    toolbar.innerHTML = '<span id="g-store-count"></span>';
    view.querySelector('.console-store-tabs').after(toolbar);
  }
  const browse = document.querySelector('#browse-steam-shop');
  if (browse) browse.hidden = true;
  const focused = document.activeElement?.closest?.('.g-store-card')?.dataset.gameId;
  grid.className = 'library-grid g-store-grid';
  if (!games.length) {
    const loading = !state.xboxStore || state.xboxStore.status === 'loading';
    toolbar.querySelector('#g-store-count').textContent = '';
    grid.innerHTML = loading
      ? `<div class="g-score-loading"><span class="g-spinner"></span>Getting the Store ready…</div>`
      : `<div class="g-empty">${gIcon('shop')}<h2>The Store is unavailable right now</h2><p>Your installed games are still ready to play. Check your connection and try again.</p><button class="g-button focusable" type="button" data-action="g-store-retry">Try again</button></div>`;
    refreshFocusables();
    return;
  }
  toolbar.querySelector('#g-store-count').textContent = `${games.length} games`;
  grid.innerHTML = games.map(game => `<button class="g-store-card focusable" type="button" data-action="g-store-game" data-game-id="${escapeHtml(game.id)}" aria-label="${escapeHtml(game.title)}"><span class="g-store-art">${gameArt(game)}</span><span class="g-card-text"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(gStoreCaption(game))}</small></span></button>`).join('');
  refreshFocusables();
  if (focused) setFocusedElement(grid.querySelector(`[data-game-id="${CSS.escape(focused)}"]`), { scroll: false });
};
selectNativeStoreGame = function (game) { state.storeSelectedId = game.id; };
requestStoreOffer = function () {};
navigateNativeStore = function () { return false; };
// A Store game opens its page; owned copies open the library entry instead.
const gPerformAction = performAction;
performAction = async function (action, source) {
  if (action === 'g-store-retry') { await loadXboxStore(true); return; }
  if (action === 'g-store-game') {
    const game = Object.values(state.xboxStore || {}).filter(Array.isArray).flat().find(item => item.id === source.dataset.gameId);
    if (!game) return;
    const owned = state.games.find(item => item.xboxProductId === game.xboxProductId || normalizeConsoleTitle(item.title) === normalizeConsoleTitle(game.title));
    await openGameDetails(owned ? owned.id : game.id);
    return;
  }
  if (action === 'collection-store') { consoleStoreTab = gStoreLists[source.dataset.chart] ? source.dataset.chart : 'popular'; await openConsoleStore(); return; }
  if (action === 'detail-play') {
    const storeGame = Object.values(state.xboxStore || {}).filter(Array.isArray).flat().find(item => item.id === state.detailGameId);
    if (storeGame) { try { await window.launcher.openCatalogGame(storeGame.xboxProductId); } catch (error) { showToast(error.message || 'Could not open the Xbox app'); } return; }
  }
  return gPerformAction(action, source);
};

// ---------- Views ----------
const gShowView = showView;
showView = function (view, options) {
  gShowView(view, options);
  const current = view === 'store' ? (state.consoleStoreMode === 'gamepass' ? 'dashboard-gamepass' : 'dashboard-store') : view;
  document.querySelectorAll('.top-nav-button').forEach(button => button.classList.toggle('active', button.dataset.action === current));
};

// ---------- Friends: Steam friends in the Xbox friends pill, panel and "Play with friends" ----------
state.gFriends = { status: 'loading', friends: [], online: 0 };
function gFriendStatus(friend) {
  if (friend.game) return `Playing ${friend.game}`;
  return { online: 'Online', busy: 'Busy', away: 'Away', snooze: 'Away', offline: 'Offline', unknown: 'Steam friend' }[friend.state] || 'Offline';
}
function gFriendAvatar(friend, className = 'g-friend-avatar') {
  return `<span class="${className} g-presence-${friend.game ? 'playing' : friend.state}">${friend.avatar ? `<img src="${escapeHtml(friend.avatar)}" alt="" loading="lazy" />` : `<b>${escapeHtml(friend.name.slice(0, 1).toUpperCase())}</b>`}<i></i></span>`;
}
async function refreshGarrisonFriends(force = false) {
  try { state.gFriends = await window.launcher.getFriends(force); } catch { state.gFriends = { status: 'unavailable', friends: [], online: 0 }; }
  const online = state.gFriends.online || 0;
  document.querySelector('#g-pill-count').textContent = online > 9 ? '9+' : String(online);
  renderPlayWithFriends();
}
function gFriendsMarkup() {
  const { friends = [], status } = state.gFriends;
  const active = friends.filter(friend => friend.state !== 'offline' && friend.state !== 'unknown');
  const others = friends.filter(friend => !active.includes(friend));
  const row = friend => `<button class="g-friend focusable" type="button" data-action="g-friend-chat" data-friend-id="${escapeHtml(friend.id)}">${gFriendAvatar(friend)}<span class="g-friend-copy"><strong>${escapeHtml(friend.name)}</strong><small>${escapeHtml(gFriendStatus(friend))}</small></span>${friend.lobby && friend.gameId ? `<span class="g-friend-join">Join</span>` : ''}</button>`;
  const empty = status === 'no-account' ? 'Sign in to Steam on this PC to see your friends.'
    : status === 'unavailable' ? 'Your friends could not be loaded. Check your connection and Steam account in Settings → Manage games.' : 'No friends yet.';
  return `<header class="g-friends-head"><h2>${gIcon('friends')}Friends</h2><span><button class="g-icon-small focusable" type="button" data-action="g-friend-add" aria-label="Add a friend">${gIcon('addFriend')}</button><button class="g-icon-small focusable" type="button" data-action="g-friends-refresh" aria-label="Refresh friends">${gIcon('refresh')}</button></span></header>
    ${status === 'local' ? '<p class="g-friends-note">Showing friends saved by Steam on this PC. Link your Steam account for live status.</p>' : ''}
    ${friends.length ? `${active.length ? `<h3>Online (${active.length})</h3>${active.map(row).join('')}` : ''}${others.length ? `<h3>${status === 'local' ? 'Friends' : 'Offline'} (${others.length})</h3>${others.map(row).join('')}` : ''}` : `<p class="g-friends-note">${empty}</p>`}`;
}
function renderPlayWithFriends() {
  let section = document.querySelector('#g-play-with-friends');
  const playing = (state.gFriends.friends || []).filter(friend => friend.game && friend.gameId);
  if (!section) {
    section = document.createElement('section');
    section.id = 'g-play-with-friends';
    section.className = 'collection-band g-friends-band';
    section.setAttribute('aria-labelledby', 'g-play-with-friends-title');
    document.querySelector('.dashboard-recent').after(section);
  }
  section.hidden = !playing.length;
  if (!playing.length) { section.innerHTML = ''; return; }
  const focused = section.contains(document.activeElement) ? document.activeElement.dataset.friendId : null;
  section.innerHTML = `<div class="collection-intro"><h2 id="g-play-with-friends-title"><span class="collection-brand"><span>Play with friends</span></span></h2></div>
    <div class="game-row collection-covers" role="list">${playing.map(friend => {
      const owned = state.games.find(game => game.provider === 'Steam' && String(game.appId) === friend.gameId);
      const art = owned?.artwork?.tile ? gameArt(owned) : `<img src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${escapeHtml(friend.gameId)}/library_600x900.jpg" alt="" loading="lazy" data-fallback="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${escapeHtml(friend.gameId)}/header.jpg" />`;
      return `<button class="game-card g-friend-card focusable" type="button" role="listitem" data-action="g-friend-join" data-friend-id="${escapeHtml(friend.id)}"><span class="g-friend-art">${art}${gFriendAvatar(friend, 'g-friend-badge')}</span><span class="g-card-text"><strong>${escapeHtml(friend.game)}</strong><small>${escapeHtml(friend.name)}</small><b class="g-friend-action">${friend.lobby ? 'Join game' : 'View profile'}</b></span></button>`;
    }).join('')}</div>`;
  if (focused) setFocusedElement(section.querySelector(`[data-friend-id="${CSS.escape(focused)}"]`), { scroll: false });
  refreshFocusables();
}
document.addEventListener('error', event => {
  const image = event.target;
  if (image?.tagName === 'IMG' && image.dataset.fallback && image.src !== image.dataset.fallback) image.src = image.dataset.fallback;
}, true);
refreshGarrisonFriends();
setInterval(() => { if (document.visibilityState === 'visible') refreshGarrisonFriends(); }, 60000);

// ---------- Notifications ----------
const gNotices = [];
const gShowToast = showToast;
showToast = function (message) {
  if (!message) return;
  const controller = /^Controller (connected|disconnected)/i.test(message);
  if (!(gPrefs.popups === false || (controller && gPrefs.controllerAlerts === false))) gShowToast(message);
  gNotices.unshift({ message: String(message), at: new Date() });
  gNotices.length = Math.min(gNotices.length, 30);
  const badge = document.querySelector('#g-notification-badge');
  const unread = gNotices.filter(item => !item.read).length;
  badge.hidden = !unread;
  badge.textContent = unread > 9 ? '9+' : String(unread);
};

// ---------- Flyouts ----------
function gFlyout(id, className, label) {
  const dialog = document.createElement('dialog');
  dialog.id = id;
  dialog.className = `g-flyout ${className}`;
  dialog.setAttribute('aria-label', label);
  document.body.append(dialog);
  dialog.addEventListener('close', () => {
    const opener = dialog.gOpener;
    dialog.gOpener = null;
    if (opener?.isConnected) setTimeout(() => setFocusedElement(opener, { scroll: false }), 0);
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  return dialog;
}
const gAccountMenu = gFlyout('g-account-dialog', 'g-account-flyout', 'Account');
const gNotificationMenu = gFlyout('g-notifications-dialog', 'g-notifications-flyout', 'Notifications');
const gViewMenu = gFlyout('g-view-dialog', 'g-view-flyout', 'View as');
const gFriendsMenu = gFlyout('g-friends-dialog', 'g-friends-flyout', 'Friends');
const gGameMenu = gFlyout('g-game-dialog', 'g-game-flyout', 'Game options');

function openGFlyout(dialog, opener, html, anchor) {
  dialog.innerHTML = html;
  dialog.gOpener = opener;
  dialog.style.cssText = '';
  dialog.showModal();
  if (anchor) {
    const box = anchor.getBoundingClientRect(), own = dialog.getBoundingClientRect();
    const left = Math.min(Math.max(12, box.left + box.width / 2 - own.width / 2), innerWidth - own.width - 12);
    const below = box.top + box.height * .55;
    const top = below + own.height > innerHeight - 12 ? Math.max(12, box.top - own.height + box.height * .45) : below;
    dialog.style.cssText = `left:${left}px;top:${top}px;right:auto;bottom:auto`;
  }
  refreshFocusables();
  setFocusedElement(dialog.querySelector('.focusable'), { scroll: false });
}
const gRow = (action, icon, label, extra = '') => `<button class="g-menu-item focusable" type="button" data-action="${action}"${extra}>${gIcon(icon)}<span>${label}</span></button>`;
function gScoreText() { return document.querySelector('#dashboard-player-status')?.textContent?.match(/[\d,]+/)?.[0] || '—'; }
function gPlayerMarkup() {
  return `<span class="g-account-avatar">${document.querySelector('#profile-avatar').innerHTML}</span><span class="g-player-copy"><strong>${escapeHtml(state.displayName || 'Player')}</strong><small><span class="g-score-mark">G</span>${escapeHtml(gScoreText())}</small></span>`;
}

function gAccountMarkup() {
  return `<div class="g-account-head">${gPlayerMarkup()}</div>
    <div class="g-presence"><i></i>Online</div>
    <div class="g-menu-group">
      ${gRow('g-account-profile', 'contact', 'View profile')}
      ${gRow('g-account-calculator', 'calculator', 'Gamerscore calculator')}
      ${gRow('g-account-settings', 'settings', 'Settings')}
      ${gRow('g-account-rescan', 'refresh', 'Scan for games')}
    </div>
    <div class="g-menu-group">
      ${gRow('g-account-fullscreen', 'fullscreen', 'Exit full screen')}
      ${gRow('g-account-feedback', 'feedback', 'Give feedback')}
      ${gRow('g-account-power', 'power', 'Power options')}
    </div>`;
}

function gNotificationsMarkup() {
  gNotices.forEach(item => { item.read = true; });
  document.querySelector('#g-notification-badge').hidden = true;
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  return `<header><h2>Notifications</h2></header>${gNotices.length
    ? `<div class="g-notice-list">${gNotices.map(item => `<button class="g-notice focusable" type="button" data-action="g-close-flyout"><strong>${escapeHtml(item.message)}</strong><small>${time.format(item.at)}</small></button>`).join('')}</div>`
    : `<div class="g-notice-empty">${gIcon('bell')}<strong>You're all caught up</strong><button class="g-menu-item focusable" type="button" data-action="g-close-flyout"><span>Close</span></button></div>`}`;
}

function gViewMarkup() {
  return `<header><h2>View as</h2></header>${['grid', 'list'].map(layout => `<button class="g-menu-item focusable${state.gLayout === layout ? ' active' : ''}" type="button" data-action="g-layout" data-layout="${layout}">${gIcon(layout)}<span>${layout === 'grid' ? 'Grid view' : 'List view'}</span>${state.gLayout === layout ? gIcon('check', 'g-trailing') : ''}</button>`).join('')}`;
}

// ---------- Game options: the Xbox context menu ----------
function gGameMenuMarkup(game) {
  const installed = game.installed !== false;
  const uninstall = installed && game.provider === 'Steam' && game.appId;
  return `<header><h2>${escapeHtml(game.title)}</h2></header>
    ${gRow('g-game-play', installed ? 'play' : 'download', installed ? 'Play' : 'Install')}
    ${gRow('g-game-manage', 'game', 'Manage game')}
    ${gRow('g-game-details', 'info', 'Game details')}
    ${gRow('g-game-favorite', state.favoriteGameIds.includes(game.id) ? 'heartFill' : 'heart', state.favoriteGameIds.includes(game.id) ? 'Remove from Favorites' : 'Add to Favorites')}
    ${uninstall ? gRow('g-game-uninstall', 'delete', 'Uninstall') : ''}
    ${gRow('g-game-hide', 'hide', 'Hide game')}`;
}

const gOpenGameOptions = openGameOptions;
openGameOptions = function (gameId = state.selectedGameId) {
  const game = state.games.find(item => item.id === gameId);
  if (!game) return;
  state.optionsGameId = game.id;
  if (game.isApp) { gOpenGameOptions(gameId); return; }
  const card = document.activeElement?.dataset?.gameId === game.id ? document.activeElement
    : state.view === 'detail' ? document.querySelector('#detail-options-button')
      : [...document.querySelectorAll('.game-card[data-game-id]')].find(item => item.dataset.gameId === game.id && item.offsetParent !== null);
  if (state.view === 'detail' && card?.id === 'detail-options-button') { openManageGame(game, card); return; }
  openGFlyout(gGameMenu, card || document.activeElement, gGameMenuMarkup(game), card);
};

// ---------- Manage game: Files and storage ----------
const gManage = document.createElement('dialog');
gManage.id = 'g-manage-dialog';
gManage.className = 'g-manage';
gManage.setAttribute('aria-label', 'Manage game');
document.body.append(gManage);
gManage.addEventListener('close', () => {
  const opener = gManage.gOpener;
  gManage.gOpener = null;
  if (opener?.isConnected) setTimeout(() => setFocusedElement(opener, { scroll: false }), 0);
});
let gManageRequest = 0;

function gDate(at) { return at ? new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(at)) : '—'; }
function gSection(id, title, body) { return `<section class="g-manage-section" id="g-manage-${id}"><h3>${title}</h3>${body}</section>`; }
function gAction(action, title, detail = '', trailing = '', extra = '') {
  return `<button class="g-setting-row focusable" type="button" data-action="${action}"${extra}><span><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ''}</span>${trailing}</button>`;
}

function gManageMarkup(game, storage = null) {
  const steam = game.provider === 'Steam' && game.appId;
  const installed = game.installed !== false;
  const size = storage?.sizeBytes ? `${storage.sizeEstimated ? 'About ' : ''}${formatBytes(storage.sizeBytes)}` : game.sizeOnDisk ? formatBytes(game.sizeOnDisk) : installed ? 'Checking…' : '—';
  const version = storage?.version || (game.buildId ? `Build ${game.buildId}` : '—');
  const updated = gDate(storage?.lastUpdated || game.lastUpdated);
  const folder = storage?.folder || game.installPath || '';
  const favorite = state.favoriteGameIds.includes(game.id);
  const files = [
    gSection('updates', 'Installs & updates',
      gAction('g-manage-updates', 'Check for updates', steam ? 'Steam keeps this game up to date' : `Updates are managed by ${escapeHtml(game.provider)}`)
      + `<div class="g-field"><span class="g-field-label">Install and update priority</span><div class="g-select-row"><span class="g-select g-select-static"><span>As per ${escapeHtml(game.provider === 'PC' ? 'Windows' : game.provider)} settings</span>${gIcon('chevronDown')}</span>${steam ? `<button class="g-link focusable" type="button" data-action="g-manage-steam-settings">Check ${escapeHtml(game.provider)} settings ${gIcon('open')}</button>` : ''}</div></div>`),
    installed ? gSection('location', 'File location',
      gAction('g-manage-shortcut', 'Add a desktop shortcut to launch this game')
      + `<div class="g-field"><span class="g-field-label">Change drive</span><div class="g-select-row"><span class="g-select g-select-static g-select-tall"><span><b>${escapeHtml(storage?.library || folder || 'Unknown location')}</b><small>${storage?.freeBytes ? `${formatBytes(storage.freeBytes)} available` : storage?.drive ? escapeHtml(storage.drive) : ''}</small></span>${gIcon('chevronDown')}</span>${folder ? `<button class="g-link focusable" type="button" data-action="g-manage-explorer">Show file in Explorer ${gIcon('open')}</button>` : ''}</div></div>`) : '',
    gSection('manage', 'Manage game',
      (steam && installed ? gAction('g-manage-verify', 'Verify and repair', "This will check the game's files and repair them. Mods and game saves that aren't backed up may be lost.") : '')
      + (steam ? `<div class="g-field"><span class="g-field-label g-field-split"><span>Advanced launch options</span><span>Optional</span></span><textarea id="g-launch-options" class="g-textarea focusable" maxlength="300" placeholder="Enter custom launch parameters">${escapeHtml(game.launchOptions || '')}</textarea><span class="g-counter"><span id="g-launch-count">${(game.launchOptions || '').length}</span>/300</span></div>` : '')
      + (installed && steam ? gAction('g-manage-uninstall', 'Uninstall game', storage?.sizeBytes ? `This game uses ${formatBytes(storage.sizeBytes)} on this disk.` : 'Remove this game from this PC.', '', ' data-tone="danger"') : '')
      + (!installed ? gAction('g-game-play', 'Install game', `Opens ${escapeHtml(game.provider)} to install.`) : '')),
  ].join('');
  const artwork = gSection('artwork', 'Artwork',
    gAction('g-manage-artwork', 'Change artwork', 'Choose a cover, background, wide art or logo.', gIcon('chevronRight', 'g-trailing'))
    + gAction('g-manage-refresh-art', 'Find artwork again', 'Check Xbox, IGN, PlayStation, then SteamGridDB.', gIcon('refresh', 'g-trailing')));
  const library = gSection('library', 'Library',
    gAction('g-manage-favorite', favorite ? 'Remove from Favorites' : 'Add to Favorites', '', gIcon(favorite ? 'heartFill' : 'heart', 'g-trailing'))
    + gAction('g-manage-collections', 'Collections', 'Add this game to your own groups.', gIcon('chevronRight', 'g-trailing'))
    + (!game.isLauncher ? gAction('g-manage-category', game.isApp ? 'Move to Games' : 'Move to Apps', '', gIcon('chevronRight', 'g-trailing')) : '')
    + (game.isCustom ? gAction('g-manage-edit', 'Edit game details', '', gIcon('edit', 'g-trailing')) : '')
    + (steam ? gAction('g-manage-store', 'View in Steam Store', '', gIcon('open', 'g-trailing')) : '')
    + gAction('g-game-hide', 'Hide this game', 'Hidden games stay in My games → Hidden.', gIcon('hide', 'g-trailing')));
  const achievements = gSection('achievements', 'Achievements',
    `<div class="g-field"><span class="g-field-label">Steam achievement catalog</span><div class="g-select-row"><input id="g-achievement-ref" class="g-input focusable" inputmode="numeric" placeholder="Steam App ID, e.g. 221430" value="${escapeHtml(game.achievementReferenceAppId || '')}" /><button class="g-button focusable" type="button" data-action="g-manage-achievement-ref">Save</button></div><small class="g-field-help">Link a Steam edition to show its achievements for this game.</small></div>`);
  return `<aside class="g-manage-side">
      <div class="g-manage-card"><span class="g-manage-eyebrow">Manage</span><h2>${escapeHtml(game.title)}</h2>
        <dl><div><dt>Installed size:</dt><dd>${installed ? size : 'Not installed'}</dd></div><div><dt>Version:</dt><dd>${escapeHtml(version)}</dd></div><div><dt>Last updated:</dt><dd>${updated}</dd></div></dl>
        <nav class="g-manage-nav">
          <button class="g-nav-item focusable active" type="button" data-action="g-manage-jump" data-target="updates">Files and storage</button>
          <button class="g-nav-item focusable" type="button" data-action="g-manage-jump" data-target="artwork">Artwork</button>
          <button class="g-nav-item focusable" type="button" data-action="g-manage-jump" data-target="library">Library</button>
          <button class="g-nav-item focusable" type="button" data-action="g-manage-jump" data-target="achievements">Achievements</button>
        </nav>
        <button class="g-button g-manage-close focusable" type="button" data-action="g-manage-close">Close</button>
      </div>
    </aside>
    <div class="g-manage-main">${files}${artwork}${library}${achievements}</div>
    <span class="g-close-hint"><kbd class="xb-button xb-b">B</kbd>Close</span>`;
}

async function openManageGame(game, opener) {
  if (gGameMenu.open) { gGameMenu.gOpener = null; gGameMenu.close(); }
  state.optionsGameId = game.id;
  gManage.gOpener = opener || document.activeElement;
  gManage.innerHTML = gManageMarkup(game);
  gManage.showModal();
  bindManageInputs(game);
  refreshFocusables();
  setFocusedElement(gManage.querySelector('.g-nav-item.active'), { scroll: false });
  const request = ++gManageRequest;
  const storage = await window.launcher.getGameStorage(game.id).catch(() => null);
  if (request !== gManageRequest || !gManage.open || !storage) return;
  const focusedAction = document.activeElement?.dataset?.action, focusedTarget = document.activeElement?.dataset?.target;
  const scroll = gManage.querySelector('.g-manage-main').scrollTop;
  if (storage.sizeBytes) game.sizeOnDisk ||= storage.sizeBytes;
  gManage.innerHTML = gManageMarkup(game, storage);
  bindManageInputs(game);
  gManage.querySelector('.g-manage-main').scrollTop = scroll;
  refreshFocusables();
  const again = [...gManage.querySelectorAll('.focusable')].find(item => item.dataset.action === focusedAction && (!focusedTarget || item.dataset.target === focusedTarget));
  setFocusedElement(again || gManage.querySelector('.g-nav-item.active'), { scroll: false });
}

function bindManageInputs(game) {
  const options = gManage.querySelector('#g-launch-options');
  if (options) {
    options.addEventListener('input', () => { gManage.querySelector('#g-launch-count').textContent = String(options.value.length); });
    options.addEventListener('change', async () => {
      const value = options.value.replace(/[\r\n]+/g, ' ').trim();
      try { await window.launcher.saveGameLaunchOptions(game.id, value); game.launchOptions = value; showToast(value ? 'Launch options saved' : 'Launch options cleared'); }
      catch (error) { showToast(error.message || 'Could not save launch options'); }
    });
  }
  const main = gManage.querySelector('.g-manage-main');
  main.addEventListener('scroll', () => {
    const sections = [...main.querySelectorAll('.g-manage-section')];
    const current = sections.filter(section => section.offsetTop - main.scrollTop < 140).pop() || sections[0];
    const group = ['updates', 'location', 'manage'].includes(current.id.slice(9)) ? 'updates' : current.id.slice(9);
    gManage.querySelectorAll('.g-nav-item').forEach(item => item.classList.toggle('active', item.dataset.target === group));
  }, { passive: true });
}

async function gGameAction(game, action, success) {
  try { await window.launcher.gameAction(game.id, action); if (success) showToast(success); }
  catch (error) { showToast(error.message || 'That action is not available for this game'); }
}

// ---------- Actions ----------
async function garrisonAction(action, source) {
  const game = state.games.find(item => item.id === state.optionsGameId);
  if (action === 'g-account') { openGFlyout(gAccountMenu, source, gAccountMarkup()); return true; }
  if (action === 'g-notifications') { openGFlyout(gNotificationMenu, source, gNotificationsMarkup()); return true; }
  if (action === 'g-view-menu') { openGFlyout(gViewMenu, source, gViewMarkup(), source); return true; }
  if (action === 'g-close-flyout') { source.closest('dialog')?.close(); return true; }
  if (action === 'g-layout') {
    state.gLayout = source.dataset.layout === 'list' ? 'list' : 'grid';
    gPrefs.layout = state.gLayout; saveGarrisonPrefs();
    gViewMenu.close();
    renderLibraryView();
    return true;
  }
  if (action === 'g-queue-toggle') {
    const row = gQueueRows().find(item => String(item.game.appId) === source.dataset.appId);
    await gQueueAction(source.dataset.appId, row?.result.state === 'paused' ? 'resume' : 'pause');
    return true;
  }
  if (action === 'g-queue-more') { await gQueueMore(source); return true; }
  if (action === 'g-queue-all') { await gQueueAction(gQueueRows().find(row => /^\d+$/.test(String(row.game.appId)))?.game.appId || '0', source.dataset.mode); return true; }
  if (action === 'g-noop') return true;
  if (action.startsWith('g-account-')) {
    const key = action.slice(10);
    gAccountMenu.gOpener = null;
    gAccountMenu.close();
    if (key === 'calculator') { openGamerscoreCalculator(document.querySelector('#profile-button')); return true; }
    if (key === 'fullscreen') {
      try { const settings = await window.launcher.getSettings(); await window.launcher.saveSettings({ fullscreen: !settings.fullscreen }); document.querySelector('#fullscreen-toggle').checked = !settings.fullscreen; }
      catch (error) { showToast(error.message || 'Could not change full screen'); }
      return true;
    }
    const next = { profile: 'avatar-picker', settings: 'settings', rescan: 'rescan', feedback: 'give-feedback', power: 'power-menu' }[key];
    if (next) await performAction(next, document.querySelector('#profile-button'));
    return true;
  }
  if (action === 'g-source') {
    const value = source.dataset.source;
    state.gHiddenView = value === 'hidden';
    state.consoleLibraryGroups = value === 'groups';
    state.libraryCategory = value === 'apps' ? 'apps' : 'games';
    state.collectionFilter = value === 'favorites' ? 'favorites' : 'all';
    state.sourceFilter = ['all', 'favorites', 'groups', 'apps'].includes(value) ? 'all' : value;
    document.querySelector('#library-collection').value = state.collectionFilter;
    document.querySelector('#library-source-filter').value = state.sourceFilter;
    renderLibraryView();
    refreshFocusables();
    setFocusedElement(document.querySelector(`#g-source-chips [data-source="${CSS.escape(value)}"]`), { scroll: false });
    return true;
  }
  if (action === 'g-detail-favorite' || action === 'g-game-favorite' || action === 'g-manage-favorite') {
    const gameId = action === 'g-detail-favorite' ? state.detailGameId : state.optionsGameId;
    if (!state.games.some(item => item.id === gameId)) return true;
    try {
      const organized = await window.launcher.organizeLibrary('favorite', { gameId });
      state.favoriteGameIds = organized.favoriteGameIds;
      state.customCollections = organized.customCollections;
      renderGarrisonFavorite();
      renderLibrary();
      showToast(state.favoriteGameIds.includes(gameId) ? 'Added to Favorites' : 'Removed from Favorites');
    } catch (error) { showToast(error.message || 'Could not update Favorites'); }
    if (action === 'g-game-favorite') { gGameMenu.close(); return true; }
    if (action === 'g-manage-favorite' && game) { await openManageGame(game, gManage.gOpener); setFocusedElement(gManage.querySelector('[data-action="g-manage-favorite"]'), { scroll: false }); return true; }
    setFocusedElement(source, { scroll: false });
    return true;
  }
  if (action === 'g-unhide') {
    const id = source.dataset.hiddenId;
    try {
      await window.launcher.organizeLibrary('unhide', { gameId: id });
      const hidden = (state.hiddenGames || []).find(item => item.id === id);
      state.hiddenGames = (state.hiddenGames || []).filter(item => item.id !== id);
      showToast(`${hidden?.title || 'Game'} is back in your library`);
      renderLibraryView();
      scanLibrary(false, false, true);
    } catch (error) { showToast(error.message || 'Could not unhide this game'); }
    return true;
  }
  if (!game) return false;
  if (action === 'g-game-hide') {
    try {
      await window.launcher.organizeLibrary('hide', { gameId: game.id });
      for (const dialog of [gGameMenu, gManage]) if (dialog.open) { dialog.gOpener = null; dialog.close(); }
      state.games = state.games.filter(item => item.id !== game.id);
      state.hiddenGames = [{ id: game.id, title: game.title, provider: game.provider, artwork: game.artwork || null }, ...(state.hiddenGames || [])];
      if (state.view === 'detail' && state.detailGameId === game.id) showView(state.previousView || 'library');
      renderLibrary();
      showToast(`${game.title} is hidden. Find it in My games → Hidden.`);
      refreshFocusables();
      setFocusedElement((state.view === 'library' ? libraryGrid : recentRow).querySelector('.focusable'), { scroll: false });
    } catch (error) { showToast(error.message || 'Could not hide this game'); }
    return true;
  }
  if (action === 'g-game-play') {
    if (gGameMenu.open) { gGameMenu.gOpener = null; gGameMenu.close(); }
    if (gManage.open) { gManage.gOpener = null; gManage.close(); }
    state.selectedGameId = game.id;
    await launchSelectedGame();
    return true;
  }
  if (action === 'g-game-manage') { await openManageGame(game, gGameMenu.gOpener); return true; }
  if (action === 'g-game-details') { gGameMenu.gOpener = null; gGameMenu.close(); openGameDetails(game.id); return true; }
  if (action === 'g-game-uninstall' || action === 'g-manage-uninstall') {
    if (gGameMenu.open) gGameMenu.close();
    await gGameAction(game, 'uninstall-steam', 'Steam uninstall options opened');
    return true;
  }
  if (action === 'g-manage-close') { gManage.close(); return true; }
  if (action === 'g-manage-jump') {
    const target = gManage.querySelector(`#g-manage-${source.dataset.target}`);
    gManage.querySelector('.g-manage-main').scrollTo({ top: target.offsetTop - 8, behavior: document.documentElement.classList.contains('reduce-motion') ? 'instant' : 'smooth' });
    gManage.querySelectorAll('.g-nav-item').forEach(item => item.classList.toggle('active', item === source));
    return true;
  }
  if (action === 'g-manage-updates' || action === 'g-manage-steam-settings') { await gGameAction(game, 'check-updates'); return true; }
  if (action === 'g-manage-shortcut') { await gGameAction(game, 'desktop-shortcut', 'Shortcut added to your desktop'); return true; }
  if (action === 'g-manage-explorer') { await gGameAction(game, 'open-folder'); return true; }
  if (action === 'g-manage-verify') { await gGameAction(game, 'verify', 'Steam is verifying this game'); return true; }
  if (action === 'g-manage-store') { await gGameAction(game, 'view-steam'); return true; }
  const forward = { 'g-manage-artwork': 'change-artwork', 'g-manage-refresh-art': 'refresh-game-artwork', 'g-manage-collections': 'edit-game-collections', 'g-manage-category': 'change-category', 'g-manage-edit': 'edit-custom' }[action];
  if (forward) {
    if (forward !== 'edit-game-collections') { gManage.gOpener = null; gManage.close(); }
    await performAction(forward, source);
    return true;
  }
  if (action === 'g-manage-achievement-ref') {
    try {
      const appId = await window.launcher.saveAchievementReference(game.id, gManage.querySelector('#g-achievement-ref').value);
      game.achievementReferenceAppId = appId;
      showToast(appId ? 'Steam achievement catalog linked' : 'Achievement link removed');
      if (state.view === 'detail' && state.detailGameId === game.id) openGameDetails(game.id);
    } catch (error) { showToast(error.message || 'Could not save achievement link'); }
    return true;
  }
  return false;
}

// ---------- Installs: no pop-up. Play becomes "Installing x%" and the download joins Queue. ----------
const gInstallLabels = { waiting: 'Waiting for Steam', downloading: 'Installing', installing: 'Installing', paused: 'Paused', ready: 'Play' };
function renderGarrisonInstallButton(game, result = {}) {
  if (state.detailGameId !== game.id) return;
  const button = document.querySelector('#detail-play');
  const percent = Number.isFinite(result.percent) ? result.percent : null;
  if (result.installed) {
    button.classList.remove('g-installing');
    button.style.removeProperty('--g-install');
    button.innerHTML = '<strong>Play</strong>';
    return;
  }
  if (game.installed !== false && !installTracking.has(game.id)) return;
  button.classList.add('g-installing');
  button.style.setProperty('--g-install', `${percent ?? 0}%`);
  button.innerHTML = `<span class="g-install-copy"><strong>${gInstallLabels[result.state] || 'Installing'}</strong><small>${percent === null ? 'Preparing…' : (result.estimated ? '≈ ' : '') + percent + '%'}</small></span>`;
}
const gShowSteamInstallation = showSteamInstallation;
showSteamInstallation = function (game) {
  if (!game || game.provider !== 'Steam') return;
  const fresh = !installTracking.has(game.id);
  gShowSteamInstallation(game);
  const dialog = document.querySelector('#install-dialog');
  if (dialog.open) dialog.close();
  if (fresh) showToast(`${game.title} was added to your queue`);
  renderGarrisonInstallButton(game, { state: 'waiting', percent: null });
  if (state.view === 'library' && state.libraryQueue) renderLibraryView();
};
// Install inside the launcher: Steam is told to download in the background, without its dialog.
const gLaunchSelectedGame = launchSelectedGame;
launchSelectedGame = async function (...args) {
  const game = state.games.find(item => item.id === state.selectedGameId);
  if (game && installTracking.has(game.id)) { gOpenQueue(); return; }
  if (!game || game.installed !== false || game.provider !== 'Steam' || !game.appId) return gLaunchSelectedGame.apply(this, args);
  const library = await gInstallTo(game);
  if (library === null) return;
  showToast(`Preparing ${game.title}…`);
  try {
    const result = await window.launcher.installSteamNative(game.id, library || '');
    if (result.status === 'installed') { game.installed = true; return gLaunchSelectedGame.apply(this, args); }
    if (result.status === 'dialog') showToast('Confirm the installation in Steam to continue');
    else showToast(result.status === 'queued' ? `${game.title} is already queued` : 'Steam is starting your download in the background');
    showSteamInstallation(game);
  } catch (error) { showToast(String(error.message || 'Could not start the installation').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); }
};
function gSpeed(bitsPerSecond) {
  if (!bitsPerSecond || bitsPerSecond < 1) return '';
  return bitsPerSecond >= 1e9 ? `${(bitsPerSecond / 1e9).toFixed(1)} Gb/s` : `${(bitsPerSecond / 1e6).toFixed(1)} Mb/s`;
}
const gRenderInstallStatus = renderInstallStatus;
renderInstallStatus = function (game, result) {
  const tracked = installTracking.get(game.id);
  if (tracked && !result?.rate && !result?.live && !result?.estimated && Number.isFinite(result?.downloaded)) {
    const now = Date.now();
    if (tracked.lastBytes !== undefined && result.downloaded > tracked.lastBytes) result.rate = (result.downloaded - tracked.lastBytes) * 8 / ((now - tracked.lastAt) / 1000);
    else if (tracked.rate && result.downloaded === tracked.lastBytes) result.rate = 0;
    tracked.lastBytes = result.downloaded; tracked.lastAt = now; tracked.rate = result.rate;
  }
  gRenderInstallStatus(game, result);
  renderGarrisonInstallButton(game, result);
  if (state.view === 'library' && state.libraryQueue && !topmostOpenDialog()) {
    gRefreshQueue();
  }
};

// ---------- Game page ----------
// Keep the reading and controller order aligned: gallery, description and
// supported devices, then publishing information and the remaining sections.
const gDetailContent = document.querySelector('.detail-content');
const gDetailDescription = gDetailContent.querySelector('.detail-info');
const gDetailCapabilities = gDetailContent.querySelector('.detail-capabilities');
const gDetailMore = gDetailContent.querySelector('.detail-overview');
gDetailMore.append(document.querySelector('.detail-meta-row'));
document.querySelector('#details-heading').textContent = 'Description';
document.querySelector('#overview-heading').textContent = 'More info';
gDetailContent.prepend(gDetailContent.querySelector('[aria-labelledby="gallery-heading"]'), gDetailDescription, gDetailCapabilities, gDetailMore);

function renderGarrisonFavorite() {
  const button = document.querySelector('#g-detail-favorite');
  const owned = state.games.some(game => game.id === state.detailGameId);
  const favorite = state.favoriteGameIds.includes(state.detailGameId);
  button.hidden = !owned;
  button.innerHTML = gIcon(favorite ? 'heartFill' : 'heart');
  button.classList.toggle('active', favorite);
  button.setAttribute('aria-pressed', String(favorite));
  button.setAttribute('aria-label', favorite ? 'Remove from Favorites' : 'Add to Favorites');
}
document.querySelector('#detail-options-button').innerHTML = gIcon('more');
document.querySelector('#detail-options-button').setAttribute('aria-label', 'Manage game');

const gPrepareGamePage = prepareConsoleGamePage;
prepareConsoleGamePage = function (game) {
  gPrepareGamePage(game);
  renderGarrisonFavorite();
  document.querySelector('#g-detail-rating').innerHTML = '';
  document.querySelector('#detail-play').classList.remove('g-installing');
  if (installTracking.has(game.id)) renderGarrisonInstallButton(game, installTracking.get(game.id).result || { state: 'waiting', percent: null });
};
const gDetailRating = document.createElement('div');
gDetailRating.id = 'g-detail-rating';
gDetailRating.className = 'g-detail-rating';
document.querySelector('.detail-actions').after(gDetailRating);

let gDetailFacts = { gameId: '', languages: 0 };
const gRenderInputMethods = renderDetailInputMethods;
renderDetailInputMethods = function (game, details = {}) {
  gRenderInputMethods(game, details);
  if (details.supportedLanguageCount) gDetailFacts = { gameId: game.id, languages: details.supportedLanguageCount };
  if (details.ageRating !== undefined || details.rating || game.rating) renderGarrisonRating(game, details);
  if (details.ageRating !== undefined) renderGarrisonTrailers(game, details);
  const info = document.querySelector('#detail-session-info');
  const owned = !game.discoveryOnly;
  const price = game.price ? gPrice(game.price) : '';
  const pill = owned ? `<span class="g-own-pill">${gIcon('check')}You own this</span>` : price && price !== 'Free' && game.price.discount ? `<span class="g-own-pill g-sale-pill">−${Math.round(game.price.discount)}%</span>` : '';
  const languages = gDetailFacts.gameId === game.id && gDetailFacts.languages ? `<span class="g-via">${gIcon('globe')}${gDetailFacts.languages} supported language${gDetailFacts.languages === 1 ? '' : 's'}</span>` : '';
  info.insertAdjacentHTML('afterbegin', pill + languages);
  if (game.discoveryOnly && game.xboxProductId && game.price !== undefined) {
    const button = document.querySelector('#detail-play');
    button.innerHTML = `<strong>${!game.price || !game.price.list ? 'Get' : `Buy ${escapeHtml(gPrice({ ...game.price, discount: 0 }))}`}</strong>`;
  }
};

// Trailers first, as in the Xbox app; they play in the Xbox app's own player.
function renderGarrisonTrailers(game, details) {
  const videos = details.videos || game.videos || [];
  const gallery = document.querySelector('#detail-gallery');
  gallery.querySelectorAll('.g-trailer').forEach(node => node.remove());
  const productId = details.xboxProductId || game.xboxProductId;
  state.gTrailers = videos.slice(0, 6);
  if (!videos.length || !productId) return;
  if (!gallery.querySelector('img')) gallery.innerHTML = '';
  gallery.insertAdjacentHTML('afterbegin', videos.slice(0, 6).map((video, index) => `<button class="g-trailer focusable" type="button" role="listitem" data-action="g-trailer" data-index="${index}" data-product-id="${escapeHtml(productId)}" aria-label="Play ${escapeHtml(video.title)}"><img src="${escapeHtml(video.preview)}" alt="" loading="lazy" /><span class="g-trailer-play">${gIcon('play')}</span></button>`).join(''));
  refreshFocusables();
}

// Full screen trailer player. Xbox trailers are HLS streams, played through hls.js.
const gPlayer = document.createElement('dialog');
gPlayer.id = 'g-trailer-dialog';
gPlayer.className = 'g-trailer-dialog';
gPlayer.setAttribute('aria-label', 'Trailer');
gPlayer.innerHTML = '<video id="g-trailer-video" playsinline></video><div class="g-trailer-bar"><button class="g-trailer-toggle focusable" type="button" data-action="g-trailer-toggle" aria-label="Pause"></button><strong id="g-trailer-title"></strong><span class="g-trailer-hints"><span><kbd class="xb-button xb-b">B</kbd>Close</span></span></div><button class="g-trailer-close focusable" type="button" data-action="g-trailer-close" aria-label="Close trailer"></button>';
document.body.append(gPlayer);
let gHls = null;
function stopGarrisonTrailer() {
  const video = gPlayer.querySelector('video');
  if (gHls) { gHls.destroy(); gHls = null; }
  video.pause(); video.removeAttribute('src'); video.load();
}
gPlayer.addEventListener('close', () => {
  stopGarrisonTrailer();
  const opener = gPlayer.gOpener;
  gPlayer.gOpener = null;
  if (opener?.isConnected) setTimeout(() => setFocusedElement(opener, { scroll: false }), 0);
});
gPlayer.querySelector('video').addEventListener('ended', () => gPlayer.close());
gPlayer.addEventListener('click', event => { if (event.target.tagName === 'VIDEO') togglePlay(); });
function togglePlay() { const video = gPlayer.querySelector('video'); if (video.paused) video.play().catch(() => {}); else video.pause(); }
const gTrailerToggle = playing => { const button = gPlayer.querySelector('.g-trailer-toggle'); button.innerHTML = gIcon(playing ? 'pause' : 'play'); button.setAttribute('aria-label', playing ? 'Pause' : 'Play'); };
gPlayer.querySelector('video').addEventListener('play', () => gTrailerToggle(true));
gPlayer.querySelector('video').addEventListener('pause', () => gTrailerToggle(false));
function playGarrisonTrailer(index, opener) {
  const video = state.gTrailers?.[index];
  if (!video?.stream || typeof Hls === 'undefined' || !Hls.isSupported()) {
    window.launcher.openCatalogGame(opener?.dataset.productId).catch(error => showToast(error.message || 'Could not open the Xbox app'));
    return;
  }
  gPlayer.gOpener = opener;
  gPlayer.querySelector('#g-trailer-title').textContent = video.title;
  gPlayer.querySelector('.g-trailer-close').innerHTML = gIcon('close');
  const element = gPlayer.querySelector('video');
  element.poster = video.preview || '';
  if (!gPlayer.open) gPlayer.showModal();
  stopGarrisonTrailer();
  gHls = new Hls({ enableWorker: false, capLevelToPlayerSize: true, startLevel: -1 });
  gHls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { showToast('This trailer could not be played'); gPlayer.close(); } });
  gHls.loadSource(video.stream);
  gHls.attachMedia(element);
  gHls.on(Hls.Events.MANIFEST_PARSED, () => element.play().catch(() => {}));
  refreshFocusables();
  gTrailerToggle(true);
  setFocusedElement(gPlayer.querySelector('.g-trailer-toggle'), { scroll: false });
}

function renderGarrisonRating(game, details) {
  const rating = details.rating || game.rating || (details.ageRating ? { system: 'PEGI', value: String(details.ageRating).replace('+', ''), label: String(details.ageRating).replace('+', ''), descriptors: '' } : null);
  const descriptors = rating?.descriptors || details.contentNotes || '';
  const tone = !rating ? '' : rating.system === 'PEGI' ? (Number(rating.value) >= 18 ? 'red' : Number(rating.value) >= 12 ? 'orange' : 'green') : String(rating.system).toLowerCase();
  const badge = rating?.image ? `<img class="g-rating-image" src="${escapeHtml(rating.image)}" alt="${escapeHtml(rating.system)} ${escapeHtml(rating.label)}" />`
    : `<span class="g-age-badge g-age-${tone}" aria-hidden="true"><b>${escapeHtml(rating?.value || rating?.label || '')}</b><small>${escapeHtml(rating?.system || '')}</small></span>`;
  const label = rating ? (rating.system === 'PEGI' ? `PEGI ${rating.value || rating.label}` : String(rating.label).replace(/_/g, ' ').replace(/^./, letter => letter.toUpperCase())) : '';
  const lines = [descriptors, rating?.interactive, game.discoveryOnly ? '' : game.provider === 'PC' ? '' : `${game.provider} handles purchases and installation for this game.`].filter(Boolean);
  document.querySelector('#g-detail-rating').innerHTML = rating
    ? `${badge}<div><button class="g-link focusable" type="button" data-action="g-rating-info" data-system="${escapeHtml(rating.system)}">${escapeHtml(label)} ${gIcon('open')}</button>${lines.map(line => `<span class="g-rating-line">${escapeHtml(line)}</span>`).join('')}</div>`
    : '';
}

// ---------- Gamerscore calculator ----------
// Read-only: each Steam game shares 1,000 points, weighted by Steam's global unlock rates.
const gScore = document.createElement('dialog');
gScore.id = 'g-score-dialog';
gScore.className = 'g-manage g-score';
gScore.setAttribute('aria-label', 'Gamerscore calculator');
document.body.append(gScore);
gScore.addEventListener('close', () => {
  const opener = gScore.gOpener;
  gScore.gOpener = null;
  if (opener?.isConnected) setTimeout(() => setFocusedElement(opener, { scroll: false }), 0);
});
let gScoreRequest = 0;
function gScoreGames() {
  return state.games.filter(game => !game.isApp && (game.provider === 'Steam' && game.appId || game.achievementReferenceAppId))
    .sort((a, b) => (b.steamPlaytimeMinutes || 0) - (a.steamPlaytimeMinutes || 0) || a.title.localeCompare(b.title));
}
function gScoreRows(result) {
  if (!result) return `<div class="g-score-loading"><span class="g-spinner"></span>Loading achievements from Steam…</div>`;
  if (result.error) return `<div class="g-empty">${gIcon('info')}<h2>No achievements to score</h2><p>${escapeHtml(result.error)}</p></div>`;
  return `<div class="g-score-summary"><span class="g-score-mark g-score-mark-large">G</span><div><strong>${result.total.toLocaleString()}</strong><span>points across ${result.items.length} achievement${result.items.length === 1 ? '' : 's'}</span></div><p>${result.rarityKnown ? 'Rarer achievements are worth more. Points come from the share of all Steam players who unlocked each one, so they are the same for every player.' : 'Steam has no unlock rates for this game yet, so every achievement is worth the same.'}</p></div>
    <div class="g-score-head" aria-hidden="true"><span>Achievement</span><span>Players unlocked</span><span>Points</span></div>
    <div class="g-score-list">${result.items.map(item => `<div class="g-score-row"><span class="g-score-icon">${item.icon ? `<img src="${escapeHtml(item.icon)}" alt="" loading="lazy" />` : gIcon('star')}</span><span class="g-score-copy"><strong>${escapeHtml(item.title)}</strong>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span><span class="g-score-rarity">${item.percent === null ? '<small>Unknown</small>' : `<b>${item.percent < 10 ? item.percent.toFixed(1) : Math.round(item.percent)}%</b><span class="g-progress"><i style="width:${Math.max(1, item.percent)}%"></i></span>`}</span><span class="g-score-points"><span class="g-score-mark">G</span>${item.points}</span></div>`).join('')}</div>`;
}
async function renderGScore(gameId, focus = false) {
  const games = gScoreGames();
  const game = games.find(item => item.id === gameId) || games[0];
  gScore.dataset.gameId = game?.id || '';
  gScore.innerHTML = `<aside class="g-manage-side"><div class="g-manage-card"><span class="g-manage-eyebrow">Gamerscore calculator</span><h2>Choose a game</h2>
      <nav class="g-manage-nav g-score-games">${games.length ? games.map(item => `<button class="g-nav-item focusable${item.id === game.id ? ' active' : ''}" type="button" data-action="g-score-game" data-game-id="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>`).join('') : '<p class="g-field-help">Add a Steam game to see how its points are shared.</p>'}</nav>
      <button class="g-button g-manage-close focusable" type="button" data-action="g-score-close">Close</button></div></aside>
    <div class="g-manage-main"><h2 class="g-score-title">${escapeHtml(game?.title || 'Gamerscore')}</h2><div id="g-score-body">${game ? gScoreRows(null) : ''}</div></div>
    <span class="g-close-hint"><kbd class="xb-button xb-b">B</kbd>Close</span>`;
  refreshFocusables();
  if (focus) setFocusedElement(gScore.querySelector('.g-nav-item.active') || gScore.querySelector('.focusable'), { scroll: false });
  if (!game) return;
  const request = ++gScoreRequest;
  let result;
  try { result = await window.launcher.getGamerscoreBreakdown(game.id); }
  catch (error) { result = { error: String(error.message || 'Steam did not return achievements for this game.').replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }; }
  if (request !== gScoreRequest || !gScore.open) return;
  gScore.querySelector('#g-score-body').innerHTML = gScoreRows(result);
  refreshFocusables();
}
function openGamerscoreCalculator(opener, gameId = state.detailGameId || state.selectedGameId) {
  gScore.gOpener = opener;
  if (!gScore.open) gScore.showModal();
  renderGScore(gameId, true);
}
document.querySelector('#pc-score-calculator-open').onclick = event => { event.stopImmediatePropagation(); openGamerscoreCalculator(event.currentTarget); };

// ---------- Settings ----------
const gSettingsPages = [
  ['g-account', 'Account', 'contact'], ['g-privacy', 'Safety & privacy', 'shield'], ['g-notifications', 'Notifications', 'bell'],
  ['g-language', 'Language & region', 'language'], ['audio', 'Audio & Video', 'volume'], ['accessibility', 'Accessibility', 'ease'],
  ['personalization', 'Appearance', 'color'], ['g-streaming', 'Streaming', 'stream'], ['services', 'Manage games', 'library'], ['g-input', 'Input', 'game']
];
(function buildSettings() {
  const scroll = document.querySelector('.settings-scroll');
  const page = (id, html) => {
    const node = document.createElement('div');
    node.className = 'settings-page g-settings-page';
    node.dataset.settingsPage = id;
    node.hidden = true;
    node.innerHTML = html;
    scroll.append(node);
    return node;
  };
  const toggle = (id, title, detail, checked) => `<label class="toggle-row g-toggle"><span><strong>${title}</strong>${detail ? `<small>${detail}</small>` : ''}</span><input class="focusable" id="${id}" type="checkbox"${checked ? ' checked' : ''} /></label>`;
  const info = (title, detail) => `<div class="g-setting-row g-setting-info"><span><strong>${title}</strong><small>${detail}</small></span></div>`;

  page('g-account', `<div class="g-setting-list">
    ${gAction('g-set-gamerpic', 'Change gamerpic', '', gIcon('chevronRight', 'g-trailing'))}
    ${gAction('g-set-profile', 'View full profile', '', gIcon('chevronRight', 'g-trailing'))}
    ${gAction('g-set-gamertag', 'Change gamertag', `<span id="g-settings-gamertag"></span>`, gIcon('edit', 'g-trailing'))}
    ${gAction('g-set-calculator', 'Gamerscore calculator', 'See how achievements and rarity add up to 1,000 points per game.', gIcon('calculator', 'g-trailing'))}
    ${gAction('profile-score-sync', 'Update Gamerscore', 'Check your verified Steam achievements.', gIcon('refresh', 'g-trailing'))}
    <button class="g-setting-row g-setting-feedback focusable" type="button" data-action="give-feedback">${gIcon('feedback')}<span><strong>Give feedback</strong></span></button>
    ${gAction('give-feedback', 'Request a feature', '', gIcon('open', 'g-trailing'))}
    ${gAction('open-fse-setup', 'Get help', '', gIcon('open', 'g-trailing'))}
  </div>`);

  const privacy = page('g-privacy', `<div class="g-setting-list">
    ${info('Hidden Steam games', 'Games you hide in Steam stay hidden here too.')}
    ${gAction('steam-open-privacy', 'Steam game details privacy', 'Choose who can see your games and playtime.', gIcon('open', 'g-trailing'))}
  </div>`);
  const data = document.querySelector('.settings-data-actions');
  if (data) { data.classList.add('g-setting-group'); privacy.append(data); }

  page('g-notifications', `<div class="g-setting-list">
    ${toggle('g-popups-toggle', 'Show notification pop-ups', 'Notifications are always kept in the notification centre.', gPrefs.popups !== false)}
    ${toggle('g-controller-alerts-toggle', 'Controller alerts', 'Tell me when a controller connects or disconnects.', gPrefs.controllerAlerts !== false)}
  </div>`);

  const language = new Intl.DisplayNames([navigator.language], { type: 'language' }).of(navigator.language) || navigator.language;
  const region = Intl.DateTimeFormat().resolvedOptions();
  page('g-language', `<div class="g-setting-list">
    ${info('Display language', `${escapeHtml(language)} · from your Windows settings`)}
    ${info('Region format', `${escapeHtml(new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date()))} · ${escapeHtml(region.timeZone)}`)}
    ${info('Time format', escapeHtml(new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date())))}
  </div>`);

  page('g-streaming', `<div class="g-setting-list">
    ${gAction('g-set-big-picture', 'Open Steam Big Picture', 'Stream and play with Steam’s TV mode.', gIcon('open', 'g-trailing'))}
    ${info('Steam Remote Play', 'Remote Play is configured in Steam. Games you stream still launch from your library here.')}
  </div>`);

  page('g-input', `<div class="g-setting-list">
    ${gAction('controller-status', 'Controller', '<span id="g-settings-controller">Checking…</span>', gIcon('chevronRight', 'g-trailing'))}
    ${info('Xbox button', 'Opens Windows Game Bar.')}
    ${info('Controller shortcuts', 'Y searches · Menu opens game options · B goes back.')}
    ${info('Keyboard and mouse', 'Arrow keys move focus · Enter selects · Esc goes back.')}
  </div>`);

  // Appearance: display mode cards, then the existing personalization controls.
  const appearance = document.querySelector('[data-settings-page="personalization"]');
  const fullscreen = document.querySelector('#fullscreen-toggle');
  appearance.insertAdjacentHTML('afterbegin', `<section class="g-setting-group"><h3>Display</h3><p class="g-setting-note">Adjust your layout for a console or desktop experience.</p>
    <button class="g-mode-card focusable" type="button" data-action="g-set-mode" data-mode="full"><span class="g-mode-preview g-mode-full"><i></i><i></i><i></i><i></i></span><span><strong>Full screen mode</strong><small>Transform your layout into a console like experience</small></span><span class="g-radio"></span></button>
    <button class="g-mode-card focusable" type="button" data-action="g-set-mode" data-mode="desktop"><span class="g-mode-preview g-mode-desktop"><i></i><i></i><i></i><i></i><i></i><i></i></span><span><strong>Desktop mode</strong><small>Adjust your layout to see more at once</small></span><span class="g-radio"></span></button></section>`);
  fullscreen.closest('label').hidden = true;
  appearance.querySelector('.g-setting-group').after(document.querySelector('#ui-scale').closest('label'));
  document.querySelector('.settings-help-card')?.remove();
  appearance.insertAdjacentHTML('beforeend', `<section class="g-setting-group" id="g-xbox-mode"><h3>Xbox mode</h3><p class="g-setting-note">Make Xbox Preview UI your home app in Windows Xbox mode, so it opens full screen when your PC starts in Xbox mode.</p><div class="g-setting-list" id="g-xbox-mode-rows">${gAction('g-xbox-mode-refresh', 'Checking Xbox mode…', '')}</div></section>`);
  const syncModes = () => appearance.querySelectorAll('.g-mode-card').forEach(card => card.classList.toggle('active', (card.dataset.mode === 'full') === fullscreen.checked));
  fullscreen.addEventListener('change', syncModes);
  settingsDialog.addEventListener('toggle', syncModes);

  // Sidebar: player, then the Xbox app's categories.
  const sidebar = document.querySelector('.settings-sidebar');
  sidebar.querySelectorAll('.settings-tab, .settings-sidebar-note').forEach(node => node.remove());
  const player = document.createElement('div');
  player.className = 'g-settings-player';
  sidebar.querySelector('.settings-sidebar-brand').after(player);
  player.insertAdjacentHTML('afterend', gSettingsPages.map(([id, label]) => `<button class="settings-tab focusable" type="button" data-action="settings-tab" data-settings-tab="${id}" aria-selected="false">${label}</button>`).join(''));

  // The header close button saves, like every other way out of Settings.
  const close = settingsDialog.querySelector('.dialog-header .close-button');
  close.type = 'button';
  close.value = '';
  close.dataset.action = 'g-settings-close';
  close.innerHTML = gIcon('close');
  settingsDialog.querySelector('form').insertAdjacentHTML('beforeend', '<span class="g-close-hint"><kbd class="xb-button xb-b">B</kbd>Close</span>');

  for (const [id, key] of [['g-popups-toggle', 'popups'], ['g-controller-alerts-toggle', 'controllerAlerts']]) {
    document.querySelector('#' + id).addEventListener('change', event => { gPrefs[key] = event.target.checked; saveGarrisonPrefs(); });
  }
})();

async function renderXboxModeSettings() {
  const rows = document.querySelector('#g-xbox-mode-rows');
  if (!rows) return;
  let status;
  try { status = await window.launcher.xboxModeStatus(); } catch { status = { supported: false }; }
  rows.innerHTML = !status.supported
    ? `<div class="g-setting-row g-setting-info"><span><strong>Xbox mode isn't available</strong><small>Xbox mode needs Windows 11 24H2 or later.</small></span></div>`
    : status.registered
      ? `${gAction('g-xbox-mode-open', 'Choose Xbox Preview UI as your home app', 'Windows Settings → Gaming → Xbox mode → Choose home app.', gIcon('open', 'g-trailing'))}${gAction('g-xbox-mode-remove', 'Remove from Xbox mode', 'Switch your home app back to Xbox first.', gIcon('delete', 'g-trailing'))}`
      : status.developerMode
        ? gAction('g-xbox-mode-add', 'Add to Xbox mode', 'Adds Xbox Preview UI to the Windows home app list. No restart needed.', gIcon('add', 'g-trailing'))
        : `${gAction('g-xbox-mode-dev', 'Turn on Developer Mode', 'Windows only lists home apps outside the Microsoft Store when Developer Mode is on.', gIcon('open', 'g-trailing'))}${gAction('g-xbox-mode-refresh', 'Check again', '', gIcon('refresh', 'g-trailing'))}`;
  refreshFocusables();
}
queueMicrotask(() => Object.assign(gSettingsActions, {
  'g-xbox-mode-refresh': () => renderXboxModeSettings(),
  'g-xbox-mode-dev': () => window.launcher.xboxModeOpenSettings('developers'),
  'g-xbox-mode-open': () => window.launcher.xboxModeOpenSettings('gaming'),
  'g-xbox-mode-add': async source => {
    source.disabled = true;
    try {
      const result = await window.launcher.xboxModeRegister();
      if (result.status === 'needs-developer-mode') showToast('Turn on Developer Mode in Windows Settings first');
      else { showToast('Added to Xbox mode. Choose it as your home app in Windows Settings.'); window.launcher.xboxModeOpenSettings('gaming'); }
    } catch (error) { showToast(String(error.message || 'Could not add to Xbox mode').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); }
    source.disabled = false;
    await renderXboxModeSettings();
    setFocusedElement(document.querySelector('#g-xbox-mode-rows .focusable'), { scroll: false });
  },
  'g-xbox-mode-remove': async () => {
    try { await window.launcher.xboxModeUnregister(); showToast('Removed from Xbox mode'); }
    catch (error) { showToast(error.message || 'Could not remove from Xbox mode'); }
    await renderXboxModeSettings();
  }
}));

const gShowSettingsPage = showSettingsPage;
showSettingsPage = function (page) {
  const target = page === 'experience' || page === 'startup' ? 'g-account' : page === 'display' ? 'personalization' : page === 'data' ? 'g-privacy' : page;
  gShowSettingsPage(target);
  if (target === 'personalization') renderXboxModeSettings();
  const tab = target === 'duplicates' || target.startsWith('connection-') ? 'services' : target;
  document.querySelectorAll('[data-settings-tab]').forEach(button => {
    const active = button.dataset.settingsTab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const entry = gSettingsPages.find(([id]) => id === target);
  if (entry) {
    document.querySelector('.settings-title h2').textContent = entry[1];
    document.querySelector('.settings-title p').textContent = '';
  }
  settingsDialog.querySelector('.settings-scroll').scrollTop = 0;
};

const gOpenSettings = openSettings;
openSettings = async function (...args) {
  await gOpenSettings.apply(this, args);
  document.querySelector('.g-settings-player').innerHTML = gPlayerMarkup();
  document.querySelector('#g-settings-gamertag').textContent = state.displayName || 'Player';
  const controllers = getConnectedControllers().length;
  document.querySelector('#g-settings-controller').textContent = controllers ? `${controllers} connected` : 'Not connected · using keyboard and mouse';
  document.querySelector('#g-popups-toggle').checked = gPrefs.popups !== false;
  document.querySelector('#g-controller-alerts-toggle').checked = gPrefs.controllerAlerts !== false;
  document.querySelector('#fullscreen-toggle').dispatchEvent(new Event('change'));
  showSettingsPage('g-account');
  setTimeout(() => setFocusedElement(document.querySelector('.settings-tab.active'), { scroll: false }), 0);
};

const gSettingsActions = {
  'g-settings-close': () => settingsDialog.close(),
  'g-score-close': () => gScore.close(),
  'g-friends': async source => { openGFlyout(gFriendsMenu, source, gFriendsMarkup()); if (Date.now() - (state.gFriendsOpenedAt || 0) > 30000) { state.gFriendsOpenedAt = Date.now(); await refreshGarrisonFriends(true); if (gFriendsMenu.open) { gFriendsMenu.innerHTML = gFriendsMarkup(); refreshFocusables(); setFocusedElement(gFriendsMenu.querySelector('.focusable'), { scroll: false }); } } },
  'g-friends-refresh': async () => { await refreshGarrisonFriends(true); gFriendsMenu.innerHTML = gFriendsMarkup(); refreshFocusables(); setFocusedElement(gFriendsMenu.querySelector('[data-action="g-friends-refresh"]'), { scroll: false }); },
  'g-friend-add': () => window.launcher.friendAction('add', '76561197960265728').catch(error => showToast(error.message)),
  'g-friend-chat': source => window.launcher.friendAction('chat', source.dataset.friendId).catch(error => showToast(error.message)),
  'g-friend-join': source => {
    const friend = state.gFriends.friends.find(item => item.id === source.dataset.friendId);
    if (!friend) return;
    return window.launcher.friendAction(friend.lobby ? 'join' : 'profile', friend.id, friend.gameId, friend.lobby).then(() => showToast(friend.lobby ? `Joining ${friend.name}…` : `Opening ${friend.name}'s profile`)).catch(error => showToast(error.message));
  },
  'g-trailer': source => playGarrisonTrailer(Number(source.dataset.index) || 0, source),
  'g-trailer-close': () => gPlayer.close(),
  'g-trailer-toggle': () => togglePlay(),
  'g-trailer': source => window.launcher.openCatalogGame(source.dataset.productId).catch(error => showToast(error.message || 'Could not open the Xbox app')),
  'g-score-game': async source => { await renderGScore(source.dataset.gameId); setFocusedElement(gScore.querySelector(`.g-nav-item[data-game-id="${CSS.escape(source.dataset.gameId)}"]`), { scroll: false }); },
  'g-set-profile': () => { settingsDialog.close(); return performAction('avatar-picker', document.querySelector('#profile-button')); },
  'g-set-gamerpic': async () => { settingsDialog.close(); await performAction('avatar-picker', document.querySelector('#profile-button')); showProfilePage('customize'); },
  'g-set-gamertag': async () => { settingsDialog.close(); await performAction('avatar-picker', document.querySelector('#profile-button')); showProfilePage('customize'); setFocusedElement(document.querySelector('#profile-name-input')); },
  'g-set-calculator': source => openGamerscoreCalculator(source),
  'g-set-big-picture': async () => {
    try { await window.launcher.launchSteamBigPicture('launcher-steam'); }
    catch (error) { showToast(error.message || 'Steam was not found on this PC'); }
  },
  'g-set-mode': source => {
    const fullscreen = document.querySelector('#fullscreen-toggle');
    fullscreen.checked = source.dataset.mode === 'full';
    fullscreen.dispatchEvent(new Event('change', { bubbles: true }));
  }
};
const gGarrisonAction = garrisonAction;
garrisonAction = async function (action, source) {
  if (gOnboardActions[action]) { await gOnboardActions[action](source); return true; }
  if (gSettingsActions[action]) { await gSettingsActions[action](source); return true; }
  return gGarrisonAction(action, source);
};

// ---------- Focus labels under the top bar icons ----------
const gTip = document.createElement('span');
gTip.className = 'g-nav-tip';
gTip.setAttribute('aria-hidden', 'true');
document.body.append(gTip);
function placeGTip(target) {
  const label = target?.dataset?.gLabel;
  if (!label || topmostOpenDialog()) { gTip.classList.remove('show'); return; }
  const box = target.getBoundingClientRect();
  gTip.textContent = label;
  gTip.style.left = `${box.left + box.width / 2}px`;
  gTip.style.top = `${box.bottom + 4}px`;
  gTip.classList.add('show');
}
document.addEventListener('focusin', event => placeGTip(event.target.closest?.('[data-g-label]')));
document.addEventListener('pointerover', event => {
  const target = event.target.closest?.('[data-g-label]');
  if (target) placeGTip(target);
  else if (!document.activeElement?.dataset?.gLabel) gTip.classList.remove('show');
});
document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement?.dataset?.gLabel) gTip.classList.remove('show'); }, 0));

// ---------- Controller navigation ----------
function gLibraryRows() {
  const visible = items => items.filter(item => item.offsetParent !== null && !item.hidden && !item.disabled);
  return [
    visible([...document.querySelectorAll('.topbar .focusable')]),
    visible([...document.querySelectorAll('.g-library-tabs-row .focusable')]),
    visible([...document.querySelectorAll('#g-source-chips .focusable')]),
    visible([...document.querySelectorAll('.g-library-toolbar .focusable')])
  ].filter(row => row.length);
}
function gNearest(items, origin) {
  const x = origin.left + origin.width / 2;
  let best = items[0], distance = Infinity;
  for (const item of items) {
    const box = item.getBoundingClientRect(), gap = Math.abs(box.left + box.width / 2 - x);
    if (gap < distance) { best = item; distance = gap; }
  }
  return best;
}
// Grid moves are index arithmetic on the column count, not a measurement of every card.
function gGridColumns() {
  if (libraryGrid.classList.contains('g-list')) return 1;
  return Math.max(1, getComputedStyle(libraryGrid).gridTemplateColumns.split(' ').filter(Boolean).length);
}

navigateConsoleLibrary = function (direction, current) {
  if (state.view !== 'library' || topmostOpenDialog()) return false;
  const rows = gLibraryRows();
  const rowIndex = rows.findIndex(row => row.includes(current));
  if (rowIndex >= 0) {
    const row = rows[rowIndex];
    if (direction === 'left' || direction === 'right') {
      const next = row[row.indexOf(current) + (direction === 'left' ? -1 : 1)];
      if (next) setFocusedElement(next);
      return true;
    }
    const origin = current.getBoundingClientRect();
    if (direction === 'up' && rowIndex > 0) { setFocusedElement(gNearest(rows[rowIndex - 1], origin), { scroll: false }); return true; }
    if (direction === 'down' && rowIndex < rows.length - 1) { setFocusedElement(gNearest(rows[rowIndex + 1], origin), { scroll: false }); return true; }
    if (direction === 'down') {
      const first = [...libraryGrid.querySelectorAll(':scope > .focusable, .g-queue .focusable')].slice(0, gGridColumns());
      if (first.length) setFocusedElement(gNearest(first, origin));
      else setFocusedElement(libraryGrid.querySelector('.focusable'));
      return true;
    }
    return direction === 'up';
  }
  const queue = current.closest('.g-queue');
  if (current.parentElement !== libraryGrid && !queue) return false;
  const cards = queue ? [...queue.querySelectorAll('.focusable')] : [...libraryGrid.children].filter(item => item.classList.contains('focusable'));
  const index = cards.indexOf(current), columns = queue ? 1 : gGridColumns();
  const column = index % columns;
  if (direction === 'left' || direction === 'right') {
    const next = direction === 'left' ? (column > 0 ? cards[index - 1] : null) : (column < columns - 1 ? cards[index + 1] : null);
    if (next) setFocusedElement(next);
    return true;
  }
  if (direction === 'down') {
    if (index + columns >= cards.length - columns && appendLibraryPage()) { navigateConsoleLibrary(direction, current); return true; }
    const next = cards[Math.min(cards.length - 1, index + columns)];
    if (next && Math.floor(cards.indexOf(next) / columns) > Math.floor(index / columns)) setFocusedElement(next);
    return true;
  }
  if (index - columns >= 0) { setFocusedElement(cards[index - columns]); return true; }
  if (rows.length) setFocusedElement(gNearest(rows[rows.length - 1], current.getBoundingClientRect()), { scroll: false });
  document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' });
  return true;
};

navigateConsoleHome = function (direction, current) {
  if (state.view !== 'home' || topmostOpenDialog()) return false;
  const row = current?.closest('#recent-row');
  if (row && ['left', 'right'].includes(direction)) {
    const cards = [...recentRow.querySelectorAll('.focusable')];
    const next = cards[cards.indexOf(current) + (direction === 'left' ? -1 : 1)];
    if (next) setFocusedElement(next, { scroll: false });
    return true;
  }
  if (row && direction === 'up') { setFocusedElement(document.querySelector('.top-center-nav [data-action="home"]'), { scroll: false }); return true; }
  if (row && direction === 'down') {
    const band = [...document.querySelectorAll('#home-view .collection-band')].find(item => item.offsetParent !== null);
    const target = band?.querySelector('.game-row .focusable') || band?.querySelector('.focusable');
    if (target) setFocusedElement(target);
    return true;
  }
  if (current?.closest('.topbar') && direction === 'down') { setFocusedElement(recentRow.querySelector('.selected') || recentRow.querySelector('.focusable'), { scroll: false }); return true; }
  return false;
};

navigateCollectionBand = function (direction, current) {
  if (topmostOpenDialog() || !['home', 'library'].includes(state.view)) return false;
  const band = current?.closest('.collection-band');
  if (!band) return false;
  const covers = [...band.querySelectorAll('.game-row .focusable')];
  const more = band.querySelector('.collection-open');
  const items = more && more.offsetParent !== null ? [...covers, more] : covers;
  const index = items.indexOf(current);
  if (direction === 'left' || direction === 'right') {
    const next = items[index + (direction === 'left' ? -1 : 1)];
    if (next) setFocusedElement(next);
    return true;
  }
  const root = state.view === 'home' ? document.querySelector('#home-view') : libraryGrid;
  const bands = [...root.querySelectorAll('.collection-band')].filter(item => item.offsetParent !== null);
  const next = bands[bands.indexOf(band) + (direction === 'up' ? -1 : 1)];
  if (next) {
    const choices = [...next.querySelectorAll('.game-row .focusable')];
    setFocusedElement(choices[Math.min(Math.max(index, 0), choices.length - 1)] || next.querySelector('.focusable'));
  } else if (direction === 'up') {
    const rows = gLibraryRows();
    setFocusedElement(state.view === 'home' ? recentRow.querySelector('.selected') || recentRow.querySelector('.focusable') : rows.length ? gNearest(rows[rows.length - 1], current.getBoundingClientRect()) : null);
  }
  return true;
};

refreshControllerStatus();
renderLibrary();
refreshFocusables();
// The top bar gains a backdrop once the page scrolls under it.
document.querySelector('main').addEventListener('scroll', event => {
  document.body.classList.toggle('g-scrolled', event.currentTarget.scrollTop > 24);
}, { passive: true });

// ---------- Settings › Manage games › Downloads: Steam download controls on or off ----------
document.querySelector('[data-settings-page="services"]').insertAdjacentHTML('beforeend', '<section class="g-setting-group" id="g-downloads"><h3>Downloads</h3><p class="g-setting-note">You choose the drive each time you install a Steam game. Pausing and resuming from the Queue uses Steam\'s download controls.</p><div class="g-setting-list" id="g-download-rows"></div></section>');
async function renderDownloadSettings() {
  const rows = document.querySelector('#g-download-rows');
  const status = await window.launcher.getSteamDownloadControls().catch(() => ({}));
  rows.innerHTML = status.enabled
    ? gAction('g-dl-controls', 'Turn off Steam download controls', 'On. While they\'re on, other apps on this PC could also control Steam.', gIcon('delete', 'g-trailing'))
    : gAction('g-dl-controls', 'Turn on Steam download controls', 'Pause and resume Steam downloads from the Queue. Steam restarts quietly to apply it.', gIcon('add', 'g-trailing'));
  rows.querySelector('[data-action="g-dl-controls"]').dataset.enabled = String(Boolean(status.enabled));
  refreshFocusables();
}
queueMicrotask(() => Object.assign(gSettingsActions, {
  'g-dl-controls': async source => {
    if (source.dataset.enabled === 'true') {
      if (state.activeGameSession) { showToast('Close your game first. Steam has to restart to change this.'); return; }
      await window.launcher.setSteamDownloadControls(false).catch(error => showToast(error.message));
      showToast('Steam download controls are off');
    } else await gEnsureDownloadControls();
    await renderDownloadSettings();
    setFocusedElement(document.querySelector('#g-download-rows .focusable'), { scroll: false });
  }
}));
const gShowSettingsPageDownloads = showSettingsPage;
showSettingsPage = function (page) {
  gShowSettingsPageDownloads(page);
  if (page === 'services') renderDownloadSettings();
};

// Garrison tiles keep their size when focused, so the old dashboard's tile-motion measuring is skipped entirely.
beginDashboardTileMotion = () => () => {};

// Pressing Installing on a game page opens the Queue, like the Xbox app.
function gOpenQueue() {
  showView('library');
  document.querySelector('.console-library-nav [data-section="queue"]')?.click();
}
// Pick up downloads already running in Steam (for example after a restart) a few seconds after start.
setTimeout(gPollDownloads, 5000);

// Focus moves call scrollIntoView, which also scrolls hidden-overflow ancestors sideways. Only rows such as
// the gallery may scroll horizontally; the page itself stays put.
for (const node of [document.querySelector('main'), document.body, document.documentElement]) {
  node?.addEventListener('scroll', () => { if (node.scrollLeft) node.scrollLeft = 0; }, { passive: true });
}
// The game page gallery scrolls as its own strip: the focused screenshot is brought into view inside it,
// and the page only scrolls up or down to reach the strip.
const gSetFocusedElement = setFocusedElement;
setFocusedElement = function (element, options = {}) {
  const strip = element?.closest?.('.detail-gallery');
  if (!strip || options.scroll === false) return gSetFocusedElement(element, options);
  gSetFocusedElement(element, { ...options, scroll: false });
  const box = strip.getBoundingClientRect(), item = element.getBoundingClientRect();
  // Move the strip directly with controller focus. Queued smooth animations
  // can otherwise lag behind repeated left/right input and hide the selection.
  const left = strip.scrollLeft + item.left - box.left - (strip.clientWidth - item.width) / 2;
  let page = strip.parentElement;
  while (page && !(page.scrollHeight > page.clientHeight + 1 && /auto|scroll|hidden/.test(getComputedStyle(page).overflowY))) page = page.parentElement;
  page = page || document.scrollingElement;
  const view = page === document.scrollingElement ? { top: 0, bottom: innerHeight } : page.getBoundingClientRect();
  if (item.bottom > view.bottom - 40) page.scrollBy({ top: item.bottom - view.bottom + 80, behavior: 'instant' });
  else if (item.top < view.top + 100) page.scrollBy({ top: item.top - view.top - 120, behavior: 'instant' });
  strip.scrollTo({ left: Math.max(0, Math.min(strip.scrollWidth - strip.clientWidth, left)), behavior: 'instant' });
};
