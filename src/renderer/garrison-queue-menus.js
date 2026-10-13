// Queue page, uninstall, notifications, game menus and input badges, following the Xbox app full-screen
// mode (Jez Corden's hands-on). Loaded after garrison.js, garrison-details.js and garrison-collections.js.

// ---------- Uninstall: our confirmation, then Steam removes it without its own prompt ----------
async function gUninstallGame(game) {
  if (!game) return;
  const size = game.sizeOnDisk ? formatBytes(game.sizeOnDisk) : '';
  const steam = game.provider === 'Steam' && /^\d+$/.test(String(game.appId || ''));
  const choice = await gChoice(`Uninstall ${game.title}?`, `${size ? `This frees up ${escapeHtml(size)} on this PC. ` : ''}${steam ? 'Your Steam Cloud saves stay safe, and you can install it again from your library.' : 'You can install it again from its launcher.'}`, [['yes', 'Uninstall', true], ['', 'Cancel']]);
  if (choice !== 'yes') return;
  if (!steam) { await gGameAction(game, 'uninstall-steam', 'Uninstall options opened'); return; }
  if (Date.now() - gDownloadControlsLive > 60000) {
    if (!await gEnsureDownloadControls()) return;
    gDownloadControlsLive = Date.now();
  }
  try {
    await window.launcher.steamDownloadAction(game.appId, 'uninstall');
  } catch (error) { showToast(String(error.message || 'Steam could not uninstall this game').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); return; }
  game.uninstalling = true;
  showToast(`Uninstalling ${game.title}…`);
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const status = await window.launcher.getSteamUninstallStatus(game.id).catch(() => ({ done: false }));
    if (!status.done) continue;
    game.installed = false;
    game.sizeOnDisk = 0;
    delete game.uninstalling;
    renderLibrary();
    if (state.view === 'library') renderLibraryView();
    if (state.detailGameId === game.id) prepareConsoleGamePage(game);
    refreshFocusables();
    showToast(`${game.title} was uninstalled`);
    return;
  }
  delete game.uninstalling;
  showToast(`Steam is still uninstalling ${game.title}`);
}

// ---------- Queue: its own page, megabytes per second, updates waiting, new installs to the front ----------
gSpeed = function (bitsPerSecond) {
  const bytes = Number(bitsPerSecond) / 8;
  if (!bytes || bytes < 1) return '';
  return bytes >= 1e9 ? `${(bytes / 1e9).toFixed(2)} GB/s` : `${(bytes / 1e6).toFixed(1)} MB/s`;
};
Object.assign(gQueueLabels, { update: 'Update available', queued: 'Queued' });
gQueueRow = function ({ game, result }) {
  const percent = Number.isFinite(result.percent) ? result.percent : null;
  const size = result.total ? (result.downloaded ? `${formatBytes(result.downloaded)} of ${formatBytes(result.total)}` : formatBytes(result.total)) : '';
  const stateName = result.state || 'queued';
  const paused = stateName === 'paused';
  const steam = /^\d+$/.test(String(game.appId || ''));
  const speed = stateName === 'downloading' ? gSpeed(result.rate) : '';
  const left = stateName === 'downloading' ? gTimeLeft(result) : '';
  // One button does the obvious next thing: pause a download, resume a paused one, start a queued one or an update.
  const toggle = paused ? ['resume', 'play', 'Resume'] : stateName === 'queued' ? ['top', 'download', 'Download now'] : stateName === 'update' ? ['update', 'download', 'Update now'] : ['pause', 'pause', 'Pause'];
  return `<div class="g-queue-row" data-state="${escapeHtml(stateName)}">
    <button class="g-queue-main focusable" type="button" data-action="${game.queueOnly ? 'g-noop' : 'select-game'}" data-game-id="${escapeHtml(game.id)}" aria-label="${escapeHtml(game.title)}, ${escapeHtml(gQueueLabels[stateName] || 'Queued')}${percent === null ? '' : ' ' + percent + '%'}">
      <span class="g-queue-art">${gameArt(game)}</span>
      <span class="g-queue-copy"><strong>${escapeHtml(game.title)}</strong><span class="g-queue-line"><small>${escapeHtml(gQueueLabels[stateName] || 'Queued')}${size ? ' • ' + size : ''}</small><span class="g-queue-stats">${left ? `<span class="g-queue-eta">${escapeHtml(left)}</span>` : ''}${speed ? `<span>${escapeHtml(speed)}</span>` : ''}<b>${percent === null || stateName === 'update' ? '' : (result.estimated ? '≈ ' : '') + percent + '%'}</b></span></span>
        <span class="g-progress${paused ? ' paused' : ''}"><i style="width:${percent ?? 0}%"></i></span></span>
    </button>
    ${steam && stateName !== 'waiting' ? `<button class="g-queue-icon focusable" type="button" data-action="g-queue-toggle" data-mode="${toggle[0]}" data-app-id="${escapeHtml(game.appId)}" aria-label="${toggle[2]} ${escapeHtml(game.title)}" title="${toggle[2]}">${gIcon(toggle[1])}</button>
    <button class="g-queue-icon focusable" type="button" data-action="g-queue-more" data-app-id="${escapeHtml(game.appId)}" aria-label="More options for ${escapeHtml(game.title)}" title="More options for ${escapeHtml(game.title)}">${gIcon('more')}</button>` : ''}
  </div>`;
};
const gQueueTitle = extra => `<h1 class="g-queue-title${extra}"><button class="g-queue-back focusable" type="button" data-action="g-queue-back" aria-label="Back to My games" title="Back to My games">${gIcon('chevronDown', 'g-back-glyph')}</button><span>Queue</span></h1>`;
const gQueueRender = renderGarrisonQueue;
renderGarrisonQueue = function () {
  gQueueRender();
  const queue = libraryGrid.querySelector('.g-queue');
  if (queue && !queue.querySelector('.g-queue-title')) queue.insertAdjacentHTML('afterbegin', gQueueTitle(''));
  if (!queue && !libraryGrid.querySelector('.g-queue-title')) libraryGrid.insertAdjacentHTML('afterbegin', gQueueTitle(' g-queue-title-empty'));
};
// The Queue is a page of its own, like the Xbox app: no tabs, filters or sort above it.
function gSyncQueuePage() { document.body.classList.toggle('g-queue-page', state.view === 'library' && Boolean(state.libraryQueue)); }
const gQueueShowView = showView;
showView = function (...args) { const result = gQueueShowView.apply(this, args); gSyncQueuePage(); return result; };
const gQueueLibraryView = renderLibraryView;
renderLibraryView = function (...args) { const result = gQueueLibraryView.apply(this, args); gSyncQueuePage(); return result; };
// Back from the Queue returns to the library.
document.querySelector('#prompt-b')?.addEventListener('click', () => { if (document.body.classList.contains('g-queue-page')) navigateBack(); });
const gQueueBackPerform = performAction;
performAction = async function (action, source) {
  if (action === 'g-queue-back') { navigateBack(); return; }
  return gQueueBackPerform(action, source);
};
const gQueueBack = navigateBack;
navigateBack = function (...args) {
  if (state.view === 'library' && state.libraryQueue && !topmostOpenDialog()) {
    document.querySelector('.console-library-nav [data-section="installed"]')?.click();
    setFocusedElement(document.querySelector('.console-library-nav [data-section="queue"]'), { scroll: false });
    return;
  }
  return gQueueBack.apply(this, args);
};

// New installs from here go to the front of Steam's queue; finished installs raise a notification.
const gQueueSeen = new Map();
function gNotify(title, body, game) {
  showToast(`${title} · ${body}`);
  try {
    if (!document.hasFocus() && typeof Notification === 'function') {
      const notice = new Notification(title, { body, silent: false, icon: game?.artwork?.tile && /^https?:|^file:/.test(game.artwork.tile) ? game.artwork.tile : 'assets/xbox.svg' });
      notice.onclick = () => window.focus();
    }
  } catch { /* Notifications unavailable. */ }
}
const gQueuePoll = gPollDownloads;
gPollDownloads = async function () {
  await gQueuePoll();
  const now = new Map(gDownloads.list.map(item => [String(item.appId), item]));
  for (const [appId, before] of gQueueSeen) {
    if (now.has(appId) || !['downloading', 'installing'].includes(before.state)) continue;
    const game = state.games.find(entry => entry.provider === 'Steam' && String(entry.appId) === appId);
    gNotify(before.wasUpdate ? 'Update installed' : 'Ready to play', game?.title || before.title || 'Your game', game);
  }
  gQueueSeen.clear();
  for (const [appId, item] of now) gQueueSeen.set(appId, { state: item.state, title: item.title, wasUpdate: item.state === 'update' || Boolean(gQueueSeen.get(appId)?.wasUpdate) });
  for (const tracked of installTracking.values()) {
    const item = now.get(String(tracked.game.appId));
    if (!item || tracked.bumped || Date.now() - tracked.at > 10 * 60 * 1000) continue;
    if (item.state === 'downloading' || item.state === 'installing') { tracked.bumped = true; continue; }
    if (item.state === 'queued' && Date.now() - gDownloadControlsLive < 60000) {
      tracked.bumped = true;
      window.launcher.steamDownloadAction(tracked.game.appId, 'top').catch(() => {});
    }
  }
};

// ---------- Menus ----------
// Library tiles: a grouped menu anchored to the tile. Game page "…": Share and Manage, as in the video.
gGameMenuMarkup = function (game) {
  const installed = game.installed !== false;
  const favorite = state.favoriteGameIds.includes(game.id);
  const steam = game.provider === 'Steam' && game.appId;
  void favorite;
  // The Xbox app's Start-button menu: the title, then Play, Manage game and Uninstall. Everything else
  // (Favorites, Hide, artwork, files) lives in Manage game.
  return `<header class="g-menu-head g-menu-head-plain"><h2>${escapeHtml(game.title)}</h2></header>
    <div class="g-menu-group">
      ${gRow('g-game-play', installed ? 'play' : 'download', installed ? 'Play' : 'Install')}
      ${gRow('g-game-manage', 'controller', 'Manage game')}
      ${installed && steam ? gRow('g-game-uninstall', 'delete', 'Uninstall') : ''}
    </div>`;
};
function gShareUrl(game) {
  if (game.provider === 'Steam' && /^\d+$/.test(String(game.appId || ''))) return `https://store.steampowered.com/app/${game.appId}/`;
  if (game.xboxProductId) return `https://www.xbox.com/games/store/x/${game.xboxProductId}`;
  return '';
}
async function gShareGame(game) {
  const url = game && gShareUrl(game);
  if (!url) { showToast('There’s no store page to share for this game'); return; }
  try { await navigator.clipboard.writeText(url); showToast('Link copied'); } catch { showToast(url); }
}
const gMenusPerform = performAction;
performAction = async function (action, source) {
  if (action === 'g-queue-toggle' && source?.dataset.mode) { await gQueueAction(source.dataset.appId, source.dataset.mode); return; }
  if (action === 'g-game-share') {
    const game = state.games.find(item => item.id === state.optionsGameId) || state.games.find(item => item.id === state.detailGameId);
    if (gGameMenu.open) gGameMenu.close();
    await gShareGame(game);
    return;
  }
  if (action === 'detail-options') {
    const game = state.games.find(item => item.id === state.detailGameId) || Object.values(state.xboxStore || {}).filter(Array.isArray).flat().find(item => item.id === state.detailGameId);
    if (!game) return;
    const owned = state.games.some(item => item.id === game.id);
    const choice = await gMenu(source, [['share', 'Share'], ...(owned ? [['manage', 'Manage']] : [])]);
    if (choice === 'share') await gShareGame(game);
    if (choice === 'manage') { state.optionsGameId = game.id; openManageGame(game, source); }
    return;
  }
  return gMenusPerform(action, source);
};

// ---------- Focus: back to the very top from the header, and the input badge on the selected tile ----------
const gInputSvg = {
  controller: gIconPaths[gIconNames.controller] || '',
  kbm: gIconPaths[gIconNames.kbm] || ''
};
function gInputBadge(card) {
  const game = state.games.find(item => item.id === card.dataset.gameId);
  card.querySelector('.g-input-badge')?.remove();
  if (!game || game.isApp) return;
  const controls = game.controls || 'unknown';
  const icons = controls === 'controller' ? ['controller'] : controls === 'partial' ? ['controller', 'kbm'] : controls === 'kbm' ? ['kbm'] : [];
  if (!icons.length) return;
  const label = controls === 'controller' ? 'Plays with a controller' : controls === 'partial' ? 'Controller and mouse and keyboard' : 'Mouse and keyboard';
  const host = card.querySelector('img, .art-fallback')?.parentElement === card ? card : card;
  host.insertAdjacentHTML("beforeend", `<span class="g-input-badge" role="img" aria-label="${label}"><span class="g-input-icons">${icons.map(icon => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${gInputSvg[icon]}</svg>`).join("")}</span></span>`);
}
const gFocusTop = setFocusedElement;
setFocusedElement = function (element, options = {}) {
  const result = gFocusTop(element, options);
  if (!element) return result;
  if (element.classList?.contains('game-card') && element.dataset.gameId) gInputBadge(element);
  // Reaching the header (or the first row under it) scrolls the page fully back up.
  if (options.scroll !== false && !topmostOpenDialog() && (element.closest?.('.topbar') || element.closest?.('#recent-row') || element.closest?.('.console-library-nav') || element.closest?.('.g-library-tabs-row'))) {
    const main = document.querySelector('main');
    if (main.scrollTop > 0) main.scrollTo({ top: 0, behavior: document.documentElement.classList.contains('reduce-motion') || state.navRepeat ? 'instant' : 'smooth' });
  }
  return result;
};

// Home rows skipped while away (artwork arrived during another view) refresh when Home is shown again.
const gPerfShowView = showView;
showView = function (view, ...rest) {
  const result = gPerfShowView.call(this, view, ...rest);
  if (view === 'home' && homeCollectionsDirty) { homeCollectionsDirty = false; renderHomeCollections(); }
  return result;
};
