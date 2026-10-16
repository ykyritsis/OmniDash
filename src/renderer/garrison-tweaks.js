// Library from the top bar always opens fresh, as in the Xbox app: on Installed, no filters, at the top.
// (Back from a game page still returns to the exact spot; only the Library button resets.)
const gLibraryHome = 'installed';
const gTweaksPerform = performAction;
performAction = async function (action, source) {
  if (action === 'library' && source?.closest?.('.topbar')) {
    state.libraryQueue = false;
    state.gHiddenView = false;
    state.sourceFilter = 'all';
    state.collectionFilter = 'all';
    state.consoleLibraryGroups = false;
    const select = document.querySelector('#library-source-filter');
    if (select) select.value = 'all';
    const result = await gTweaksPerform(action, source);
    const tab = document.querySelector(`.console-library-nav [data-section="${CSS.escape(gLibraryHome)}"]`);
    if (tab) await performAction('console-library-section', tab);
    const main = document.querySelector('main');
    if (typeof gStopAllScrolls === 'function') gStopAllScrolls();
    main.scrollTo({ top: 0, behavior: 'instant' });
    libraryGrid.scrollTo?.({ top: 0, behavior: 'instant' });
    setFocusedElement(source, { scroll: false });
    return result;
  }
  return gTweaksPerform(action, source);
};

// Sleep while a game (or anything else) is in front: a moment after the launcher loses focus, every
// animation and transition pauses, a playing trailer pauses and focus scrolling stops, so the launcher
// costs next to nothing on the CPU and GPU. Coming back wakes it at once.
let gSleepTimer = 0;
function gSleep() {
  if (document.hasFocus() && document.visibilityState === 'visible') return;
  document.body.classList.add('g-asleep');
  if (typeof gStopAllScrolls === 'function') gStopAllScrolls();
  for (const video of document.querySelectorAll('video')) if (!video.paused) video.pause();
}
function gWake() {
  clearTimeout(gSleepTimer);
  document.body.classList.remove('g-asleep');
}
window.addEventListener('blur', () => { clearTimeout(gSleepTimer); gSleepTimer = setTimeout(gSleep, 1500); });
window.addEventListener('focus', gWake);
document.addEventListener('visibilitychange', () => { if (document.hidden) gSleep(); else if (document.hasFocus()) gWake(); });

// Game pages open ready, the way a console or Steam does it: resting on a tile for a moment fetches that
// game's details (kept on disk by the launcher) and warms its hero art and first gallery thumbnails, so
// pressing A shows a finished page. Skipped while a direction is held, or in the background.
const gPrefetched = new Map();
const gPrefetchImages = new Map();
let gPrefetchTimer = 0, gPrefetchBusy = false;
function gPreloadImage(url) {
  if (!url || !/^(https?:|file:|data:)/.test(url) || gPrefetchImages.has(url)) return;
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  // Kept for a while so the decoded copy isn't thrown away before the page opens.
  gPrefetchImages.set(url, image);
  image.onerror = () => gPrefetchImages.delete(url);
  if (gPrefetchImages.size > 24) gPrefetchImages.delete(gPrefetchImages.keys().next().value);
}
async function gPrefetchGame(gameId) {
  if (window.gSafeMode || document.hidden || !document.hasFocus() || state.activeGameSession || state.remotePlaySession) return;
  const game = findGameForDetails(gameId), key = `${state.region || 'auto'}:${gameId}`;
  if (!game || game.isApp || gPrefetchBusy || Date.now() - (gPrefetched.get(key) || 0) < 300000) return;
  gPrefetchBusy = true;
  gPrefetched.set(key, Date.now());
  if (gPrefetched.size > 200) gPrefetched.delete(gPrefetched.keys().next().value);
  try {
    gPreloadImage(game.artwork?.hero || game.artwork?.wide);
    const details = await loadGamePageDetails(game);
    if (details?.metadataSource === 'Local library') gPrefetched.delete(key);
    if (document.hidden || !document.hasFocus() || state.activeGameSession || state.remotePlaySession) return;
    if (state.focusedElement?.dataset.gameId !== gameId && !(state.view === 'detail' && state.detailGameId === gameId)) return;
    const shots = [...new Set((details?.screenshots || []).filter(Boolean))].slice(0, 4);
    for (const url of shots) gPreloadImage(typeof galleryThumb === 'function' ? galleryThumb(url) : url);
    if (details?.videos?.[0]?.preview) gPreloadImage(launcherMedia.trailerPreview(details.videos[0].preview));
  } catch { gPrefetched.delete(key); }
  finally { gPrefetchBusy = false; }
}
const gPrefetchFocus = setFocusedElement;
setFocusedElement = function (element, options = {}) {
  const result = gPrefetchFocus(element, options);
  clearTimeout(gPrefetchTimer);
  const gameId = element?.matches('.game-card, .remote-game-card, .g-store-card') ? element.dataset.gameId : '';
  if (gameId && !state.navRepeat && document.hasFocus()) gPrefetchTimer = setTimeout(() => { if (state.focusedElement === element) gPrefetchGame(gameId); }, 350);
  return result;
};
