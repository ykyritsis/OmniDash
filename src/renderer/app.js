const state = {
  games: [],
  favoriteGameIds: [],
  customCollections: [],
  activeGameSession: null,
  selectedGameId: null,
  // The card currently carrying the .selected highlight, so focus changes patch two nodes
  // instead of re-querying every .game-card in the document.
  selectedCard: null,
  focusIndex: 0,
  focusables: [],
  previousButtons: [],
  lastAxisMove: 0,
  view: 'home',
  libraryTab: 'my-games',
  libraryCategory: 'games',
  ambientKey: '',
  homeAmbientRequestToken: 0,
  homeScreenshotCache: new Map(),
  lastHomeScreenshotByGame: new Map(),
  shuffleHomeScreenshots: false,
  optionsGameId: null,
  artworkGameId: null,
  artworkSearch: null,
  artworkChoice: null,
  artworkDraft: null,
  artworkSlot: 'tile',
  catalogArtwork: [],
  focusedElement: null,
  randomGameIds: [],
  trendingRanks: {},
  trendingStatus: 'needs-api-key',
  steamDiscovery: { mostPlayed: [], topSellers: [], upcoming: [], status: 'loading' },
  steamDiscoveryArtworkUpdates: new Map(),
  steamApiKeyConfigured: false,
  soundEffects: true,
  gamepadIndex: null,
  lastNotifiedGamepadIndex: null,
  steamStatus: 'disabled',
  steamBannerDismissed: false,
  steamLocalStatus: null,
  fullScreenImport: false,
  searchQuery: '',
  newsRequestToken: 0,
  newsPendingGameId: null,
  newsCache: new Map(),
  customDraft: null,
  customArtworkSearch: null,
  customArtworkChoice: null,
  resetKind: null,
  controllerClick: false,
  previousView: 'home',
  detailGameId: null,
  detailRequestToken: 0,
  detailBackdropLayer: 0,
  lastDetailScreenshotByGame: new Map(),
  useRandomScreenshotBackground: false,
  onboardingStep: 0,
  profileOriginal: null,
  displayName: 'Player',
  galleryImages: [],
  galleryIndex: 0,
  librarySort: 'recent',
  installFilter: 'all',
  sourceFilter: 'all',
  steamOwnedCount: 0,
  steamId64: '',
  showUninstalledSteam: false,
  duplicateMode: 'all',
  duplicatePreferredProvider: 'Steam',
  duplicatePreferences: {},
  showUninstalledEpic: false,
  epicStatus: 'needs-helper',
  epicHelperPath: '',
  achievementItems: [],
  achievementFilter: 'all',
  achievementsExpanded: false,
  achievementProgressAvailable: false,
  settingsOriginal: { uiScale: 1, tileRadius: 8, reducedMotion: false, textScale: 1, highContrastFocus: false, steamGridDbKey: '' },
  settingsSaved: false
};

function topmostOpenDialog() {
  const focusedDialog = document.activeElement?.closest('dialog[open]');
  if (focusedDialog) return focusedDialog;
  const dialogs = [...document.querySelectorAll('dialog[open]')];
  return dialogs[dialogs.length - 1] || null;
}

function navigateBack() {
  if (!steamShopSurface.hidden) { window.launcher.shopCommand('close'); return; }
  if (!launchOverlay.hidden) { cancelLaunchWait(); return; }
  playUiSound('back');
  const modal = topmostOpenDialog();
  if (modal) {
    if(modal===settingsDialog && state.consoleSettingsParent) {
      const opener=state.consoleSettingsOpener;
      showSettingsPage(state.consoleSettingsParent);
      setFocusedElement(opener || document.querySelector('.settings-tab.active'),{scroll:false});
      return;
    }
    if (modal === onboardingDialog) { if (state.onboardingStep > 0) showOnboardingStep(state.onboardingStep - 1); }
    else if (modal === powerDialog && !powerConfirm.hidden) showPowerChoices();
    else modal.close();
    return;
  }
  // Search now lives in a modal. Its deferred close event must not consume
  // another Back press after the player has already moved to a different page.
  searchPopover.hidden = true;
  if (state.view === 'detail') {
    const returnTo = state.detailReturn;
    showView(state.previousView, { restore: returnTo });
    state.detailReturn = null;
    if (returnTo?.searchGameId) openConsoleSearch(returnTo.searchGameId);
  }
  else if (state.view === 'library') showView('home');
  else if (state.view === 'store') showView('home');
}

const ambient = document.querySelector('#ambient');
const heroTitle = document.querySelector('#hero-title');
const heroSubtitle = document.querySelector('#hero-subtitle');
const heroProvider = document.querySelector('#hero-provider');
const heroPlay = document.querySelector('#hero-play');
const recentRow = document.querySelector('#recent-row');
const newsShelf = document.querySelector('#news-shelf');
const newsRow = document.querySelector('#news-row');
const newsSubtitle = document.querySelector('#news-subtitle');
const logoRequested = new Set();
const homeCollections = document.querySelector('#home-collections');
const favoritesShelf = document.querySelector('#favorites-shelf');
const favoritesRow = document.querySelector('#favorites-row');
const steamDiscoveryRows = { mostPlayed: document.querySelector('#steam-players-row'), topSellers: document.querySelector('#steam-sellers-row'), upcoming: document.querySelector('#steam-upcoming-row') };
const trendingShelf = document.querySelector('#trending-shelf');
const trendingRow = document.querySelector('#trending-row');
const trendingNote = document.querySelector('#trending-note');
const mostPlayedShelf = document.querySelector('#most-played-shelf');
const mostPlayedRow = document.querySelector('#most-played-row');
const recentlyUpdatedRow = document.querySelector('#recently-updated-row');
const randomRow = document.querySelector('#random-row');
const recentlyPlayedShelf = document.querySelector('#recently-played-shelf');
const recentlyPlayedRow = document.querySelector('#recently-played-row');
const homeView = document.querySelector('#home-view');
const controllerPrompts = document.querySelector('#controller-prompts');
const promptA = document.querySelector('#prompt-a');
const promptB = document.querySelector('#prompt-b');
const promptX = document.querySelector('#prompt-x');
const promptY = document.querySelector('#prompt-y');
const promptMenu = document.querySelector('#prompt-menu');
const controllerReadyShelf = document.querySelector('#controller-ready-shelf');
const controllerReadyRow = document.querySelector('#controller-ready-row');
const multiplayerShelf = document.querySelector('#multiplayer-shelf');
const multiplayerRow = document.querySelector('#multiplayer-row');
const singlePlayerShelf = document.querySelector('#single-player-shelf');
const singlePlayerRow = document.querySelector('#single-player-row');
const libraryView = document.querySelector('#library-view');
const libraryGrid = document.querySelector('#library-grid');
const libraryCount = document.querySelector('#library-count');
const emptyState = document.querySelector('#empty-state');
const settingsDialog = document.querySelector('#settings-dialog');
const collectionsDialog = document.querySelector('#collections-dialog');
const jumpLogo = document.querySelector('#jump-logo');
const toast = document.querySelector('#toast');
const controllerStatusDialog = document.querySelector('#controller-status-dialog');
const powerDialog = document.querySelector('#power-dialog');
const powerChoices = document.querySelector('#power-choices');
const powerConfirm = document.querySelector('#power-confirm');
let selectedPowerAction = null;
let powerActionPending = false;
const achievementDialog = document.querySelector('#achievement-dialog');
const ambientNext = document.querySelector('#ambient-next');
const gameOptionsDialog = document.querySelector('#game-options-dialog');
const steamLaunchDialog = document.querySelector('#steam-launch-dialog');
const artworkDialog = document.querySelector('#artwork-dialog');
const artworkResults = document.querySelector('#artwork-results');
const artworkGames = document.querySelector('#artwork-games');
const artworkStatus = document.querySelector('#artwork-status');
const artworkQuery = document.querySelector('#artwork-query');
const useArtwork = document.querySelector('#use-artwork');
const launchOverlay = document.querySelector('#launch-overlay');
const launchArt = document.querySelector('#launch-art');
const launchingGame = document.querySelector('#launching-game');
const launchGameLogo = document.querySelector('#launch-game-logo');
const librarySearch = document.querySelector('#library-search');
const detailLogo = document.querySelector('#detail-logo');
const detailTitle = document.querySelector('#detail-title');
const galleryDialog = document.querySelector('#gallery-dialog');
const galleryImage = document.querySelector('#gallery-image');
const galleryBackdrop = document.querySelector('#gallery-backdrop');
const galleryTitle = document.querySelector('#gallery-title');
const galleryThumbnails = document.querySelector('#gallery-thumbnails');
const gameDetailView = document.querySelector('#game-detail-view');
const searchPopover = document.querySelector('#search-popover');
const customGameDialog = document.querySelector('#custom-game-dialog');
const customGameName = document.querySelector('#custom-game-name');
const customArtworkQueryLabel = document.querySelector('#custom-artwork-query-label');
const resetConfirmDialog = document.querySelector('#reset-confirm-dialog');
const customArtworkGames = document.querySelector('#custom-artwork-games');
const customArtworkResults = document.querySelector('#custom-artwork-results');
const customArtworkStatus = document.querySelector('#custom-artwork-status');
const newsPreviewDialog = document.querySelector('#news-preview-dialog');
let visibleAmbient = ambient;
const avatarDialog = document.querySelector('#avatar-dialog');
const onboardingDialog = document.querySelector('#onboarding-dialog');
const scanProgress = document.querySelector('#scan-progress');
const importingScreen = document.querySelector('#importing-screen');
const startupLibrarySnapshot = window.launcher.getCachedLibrary().catch(() => null);
const avatarPresets = [
  ...['21058', '21038', '21046', '21026', '21047', '20000', '21040', '21045', '21019', '21050', '21044', '21006'].map((number, index) => ({ id: `360-original-${index + 1}`, group: 'Xbox 360 originals', label: `Original ${index + 1}`, url: `https://assets.xboxgamer.pics/titles/fffe07d1/${number}.png` })),
  ...[
    'https://live.staticflickr.com/3748/12110838883_8577c69393_z.jpg',
    'https://live.staticflickr.com/5534/12110922234_3b5072ec78_z.jpg',
    'https://live.staticflickr.com/3741/12111196666_c1bae4fa61_z.jpg',
    'https://live.staticflickr.com/2852/12110838863_b170342b32_z.jpg',
    'https://live.staticflickr.com/5518/12110536055_6e12210b4d_z.jpg',
    'https://live.staticflickr.com/5500/12111195906_33def93f4e_z.jpg'
  ].map((url, index) => ({ id: `one-contest-${index + 1}`, group: 'Xbox One community originals', label: `Xbox One ${index + 1}`, url })),
  { id: 'one-orbit', group: 'Offline presets', label: 'Orbit', glyph: '◎', colors: '#08764b,#0b1e2a' },
  { id: 'one-spark', group: 'Offline presets', label: 'Spark', glyph: '✦', colors: '#165ac7,#121532' },
  { id: 'one-peak', group: 'Offline presets', label: 'Peak', glyph: '▲', colors: '#7541ae,#1b1646' }
];
let selectedAvatarId = 'one-orbit';
let customAvatarData = '';
let customArtworkSearchSequence = 0;
let customArtworkSearchTimer = null;

function avatarMarkup(preset) {
  if (preset?.id === 'steam-profile') return steamPlayerIdentity?.avatar ? `<span class="avatar-picture"><span class="avatar-glyph">S</span><img src="${escapeHtml(steamPlayerIdentity.avatar)}" alt="Steam gamerpic" /></span>` : '<span class="avatar-glyph" style="background:linear-gradient(140deg,#173a54,#09202a)"><img src="assets/steam.svg" alt="Steam" /></span>';
  if (preset?.id === 'custom-uploaded' && customAvatarData) return `<img class="custom-avatar-image" src="${customAvatarData}" alt="Uploaded gamerpic" />`;
  return preset.url ? `<span class="avatar-picture"><span class="avatar-glyph" style="background:linear-gradient(140deg,#87c721,#103a26)">X</span><img src="${preset.url}" alt="" /></span>` : `<span class="avatar-glyph" style="background:linear-gradient(140deg,${preset.colors})">${preset.glyph}</span>`;
}

function renderAvatarChoices() {
  const presets = [{ id: 'steam-profile', group: 'Your gamerpic', label: 'Steam profile' }, ...(customAvatarData ? [{ id: 'custom-uploaded', group: 'Your gamerpic', label: 'Uploaded image' }] : []), ...avatarPresets];
  for (const container of [document.querySelector('#avatar-choices'), document.querySelector('#onboard-avatar-choices')]) {
    container.innerHTML = presets.map((preset, index) => `${index === 0 || presets[index - 1].group !== preset.group ? `<strong class="avatar-group">${preset.group}</strong>` : ''}<button class="avatar-choice focusable${selectedAvatarId === preset.id ? ' selected' : ''}" type="button" data-action="choose-avatar" data-avatar-id="${preset.id}" aria-label="${preset.group}: ${preset.label}">${avatarMarkup(preset)}<span>${preset.label}</span></button>`).join('');
  }
  const selected = presets.find((preset) => preset.id === selectedAvatarId) || avatarPresets.find((preset) => preset.id === 'one-orbit');
  document.querySelector('#profile-avatar').innerHTML = avatarMarkup(selected);
  document.querySelector('#dashboard-player-name').textContent = state.displayName;
  const profileAvatar = document.querySelector('#profile-large-avatar');
  if (profileAvatar) profileAvatar.innerHTML = avatarMarkup(selected);
  document.querySelectorAll('.avatar-picture img').forEach((image) => image.addEventListener('error', () => image.remove(), { once: true }));
}

function showOnboardingStep(step) {
  state.onboardingStep = Math.max(0, Math.min(2, step));
  document.querySelectorAll('[data-onboarding-step]').forEach((panel) => { panel.hidden = Number(panel.dataset.onboardingStep) !== state.onboardingStep; });
  document.querySelectorAll('[data-onboarding-indicator]').forEach((indicator) => {
    const index = Number(indicator.dataset.onboardingIndicator);
    indicator.classList.toggle('active', index === state.onboardingStep);
    indicator.classList.toggle('complete', index < state.onboardingStep);
    if (index === state.onboardingStep) indicator.setAttribute('aria-current', 'step');
    else indicator.removeAttribute('aria-current');
  });
  document.querySelector('#onboarding-step-label').textContent = `Step ${state.onboardingStep + 1} of 3`;
  document.querySelector('#onboard-back').hidden = state.onboardingStep === 0;
  document.querySelector('#onboard-next').hidden = state.onboardingStep === 2;
  document.querySelector('#onboard-finish').hidden = state.onboardingStep !== 2;
  refreshFocusables();
  const target = state.onboardingStep === 1 ? document.querySelector('#onboard-name')
    : state.onboardingStep === 2 ? document.querySelector('#onboard-finish')
      : document.querySelector('#onboard-next');
  if (target && onboardingDialog.open) setTimeout(() => setFocusedElement(target, { scroll: false }), 0);
}

function showSettingsPage(page) {
  state.consoleSettingsParent=null;
  document.querySelectorAll('[data-settings-page]').forEach((element) => { element.hidden = element.dataset.settingsPage !== page; });
  document.querySelectorAll('[data-settings-tab]').forEach((button) => {
    const parent = page === 'duplicates' || page.startsWith('connection-') ? 'services' : ['display', 'audio', 'accessibility'].includes(page) ? 'experience' : page;
    const active = button.dataset.settingsTab === parent;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const headings = { services: ['Library', 'Your games, apps, and connected services.'], experience: ['General', ''], personalization: ['Personalization', ''], data: ['System', 'Saved data and setup guidance.'], display:['TV & display options',''],audio:['Volume & audio',''],accessibility:['Accessibility',''],duplicates:['Duplicate games','Choose a preferred copy. Every source keeps its artwork, settings and play history.'] };
  const [title, description] = headings[page] || headings.experience;
  document.querySelector('.settings-title h2').textContent = title;
  document.querySelector('.settings-title p').textContent = description;
  document.querySelector('.settings-scroll').scrollTop = 0;
  if(typeof updateConnectionPage==='function')updateConnectionPage(page);
  refreshFocusables();
}

let activityTimer = null;
function showActivity(title, message, percent = null, duration = 0, kind = '') {
  clearTimeout(activityTimer);
  scanProgress.hidden = false;
  scanProgress.dataset.kind = kind;
  scanProgress.querySelector('.scan-progress-top strong').textContent = title;
  document.querySelector('#scan-percent').textContent = percent === null ? '' : `${percent}%`;
  scanProgress.querySelector('.scan-track').hidden = percent === null;
  document.querySelector('#scan-fill').style.width = `${percent ?? 0}%`;
  document.querySelector('#scan-message').textContent = message;
  if (duration) activityTimer = setTimeout(updateConnectivityActivity, duration);
}

function updateConnectivityActivity() {
  if (navigator.onLine) scanProgress.hidden = true;
  else showActivity('Offline mode', 'Your cached library and artwork remain available. Online metadata may be limited.', null, 0, 'offline');
}

window.launcher.onLibraryProgress(({ percent, message }) => {
  showActivity(state.backgroundLibraryRefresh ? 'Updating your library' : 'Importing your library', message, percent, percent >= 100 ? 1800 : 0);
  if (state.fullScreenImport) {
    document.querySelector('#importing-percent').textContent = `${percent}%`;
    document.querySelector('#importing-fill').style.width = `${percent}%`;
    document.querySelector('#importing-message').textContent = message;
  }
});
window.addEventListener('online', updateConnectivityActivity);
window.addEventListener('offline', updateConnectivityActivity);
function applyLibraryResult(result, preserveFocus = false) {
  scheduleScoreRefresh();
  const focusedBeforeRefresh = preserveFocus ? document.activeElement : null;
  const focusLocation = focusedBeforeRefresh?.classList?.contains('focusable') ? {
    containerId: focusedBeforeRefresh.parentElement?.id,
    gameId: focusedBeforeRefresh.dataset.gameId,
    appId: focusedBeforeRefresh.dataset.appId,
    action: focusedBeforeRefresh.dataset.action
  } : null;
  state.games = result.games || [];
  state.duplicateMode = result.duplicateMode || 'all';
  state.duplicatePreferredProvider = result.duplicatePreferredProvider || 'Steam';
  state.duplicatePreferences = result.duplicatePreferences || {};
  state.steamStatus = result.steamStatus || 'disabled';
  state.steamOwnedCount = Number(result.steamOwnedCount) || 0;
  state.steamId64 = result.steamId64 || '';
  state.showUninstalledSteam = result.showUninstalledSteam === true;
  state.showUninstalledEpic = result.showUninstalledEpic === true;
  state.epicStatus = result.epicStatus || 'needs-helper';
  state.epicOwnedCount = Number(result.epicOwnedCount) || 0;
  state.epicHelperPath = result.epicHelperPath || '';
  state.steamApiKeyConfigured = result.steamApiKeyConfigured === true;
  state.trendingRanks = {};
  state.trendingStatus = state.steamApiKeyConfigured ? 'loading' : 'needs-api-key';
  renderSteamConnectionStatus();
  renderEpicConnectionStatus();
  renderLibrary();
  if (focusLocation && !focusedBeforeRefresh.isConnected && !topmostOpenDialog()) {
    const container = focusLocation.containerId ? document.getElementById(focusLocation.containerId) : document;
    const candidates = [...(container || document).querySelectorAll('.focusable')];
    const replacement = candidates.find((element) =>
      element.dataset.action === focusLocation.action &&
      (focusLocation.gameId ? element.dataset.gameId === focusLocation.gameId : true) &&
      (focusLocation.appId ? element.dataset.appId === focusLocation.appId : true) &&
      element.offsetParent !== null
    ) || candidates.find((element) => element.offsetParent !== null);
    if (replacement) {
      state.focusedElement = replacement;
      replacement.classList.add('focused');
      replacement.focus({ preventScroll: true });
      refreshFocusables();
    }
  }
  if (!state.steamDiscoveryRequested) {
    state.steamDiscoveryRequested = true;
    window.launcher.getSteamDiscovery().then((discovery) => {
      state.steamDiscovery = discovery;
      for (const item of Object.values(discovery).filter(Array.isArray).flat()) {
        const artwork = state.steamDiscoveryArtworkUpdates.get(item.appId);
        if (artwork) item.artwork = artwork;
      }
      renderHomeCollections();
      if (state.view === 'store' && state.consoleStoreMode !== 'gamepass') renderConsoleStore();
      refreshFocusables();
    }).catch(() => {
      state.steamDiscovery = { mostPlayed: [], topSellers: [], upcoming: [], status: 'unavailable' };
      renderHomeCollections();
    });
  }
  if (settingsDialog.open) renderSettingsLauncherSummary();
}

function renderSettingsLauncherSummary() {
  const launchers = state.games.filter(game => game.isLauncher);
  document.querySelector('#settings-launcher-summary').innerHTML = launchers.length
    ? `<span class="settings-connected-dot"></span><strong>${launchers.length} game launcher${launchers.length === 1 ? '' : 's'} detected</strong><button class="focusable" type="button" data-action="settings-open-apps">View apps ›</button>`
    : '<strong>No game launchers detected yet</strong><span>Scan again or add an app manually.</span>';
}
// The game list arrives before artwork. Show it straight away and let artwork fill in behind it.
window.launcher.onLibraryInitial((result) => {
  applyLibraryResult(result, state.backgroundLibraryRefresh || state.libraryInitialShown);
  if (state.libraryInitialShown) return;
  state.libraryInitialShown = true;
  if (state.fullScreenImport) {
    importingScreen.classList.remove('visible');
    setTimeout(() => { importingScreen.hidden = true; importingScreen.setAttribute('aria-hidden', 'true'); }, 520);
    state.fullScreenImport = false;
  }
  if (!state.backgroundLibraryRefresh) {
    scanProgress.classList.add('background-refresh');
    showToast(`${state.games.length} library item${state.games.length === 1 ? '' : 's'} ready · artwork keeps loading in the background`);
  }
});
window.launcher.onSteamDiscoveryArtwork(({ appId, artwork }) => {
  state.steamDiscoveryArtworkUpdates.set(appId, artwork);
  for (const item of Object.values(state.steamDiscovery).filter(Array.isArray).flat()) if (item.appId === appId) item.artwork = artwork;
  document.querySelectorAll(`.steam-discovery-card[data-app-id="${CSS.escape(appId)}"]`).forEach(cardElement => {
    const item = Object.values(state.steamDiscovery).filter(Array.isArray).flat().find(game => game.appId === appId);
    const owned = state.games.find(game => game.provider === 'Steam' && String(game.appId) === appId);
    if (item) {
      const artGame = owned?.artwork?.manual ? owned : item;
      cardElement.querySelector('.steam-discovery-art').innerHTML = gameArt(artGame);
      cardElement.classList.toggle('no-cover', !artGame.artwork?.tile);
    }
  });
  updateNativeStoreArtwork(appId);
});
window.launcher.onLibraryTrending((result) => {
  state.trendingRanks = result.ranks || {};
  state.trendingStatus = result.status || 'unavailable';
  renderHomeCollections();
});
window.launcher.onLibraryArtwork((changes) => {
  const gamesById = new Map(state.games.map(game => [game.id,game]));
  let controlsChanged = false;
  for (const change of changes) {
    const game = gamesById.get(change.id);
    if (!game) continue;
    const previousControls = game.controls;
    const previousTile = gameArt(game), previousHero = gameArt(game, '', true);
    game.artwork = change.artwork;
    if (game.controls === 'unknown') game.controls = change.artwork?.controls || 'unknown';
    const tileChanged = previousTile !== gameArt(game), heroChanged = previousHero !== gameArt(game, '', true);
    if (tileChanged || heroChanged) {
      // Update the artwork itself, including collection cards and the My games
      // collage. Keep buttons, decoded unchanged images and scroll/focus intact.
      for (const element of document.querySelectorAll(`[data-art-game-id="${CSS.escape(game.id)}"]`)) {
        const featured = element.dataset.artFeatured === 'true';
        if (featured ? heroChanged : tileChanged) element.outerHTML = gameArt(game, element.dataset.artClass || '', featured);
      }
      if (game.id === state.selectedGameId) {
        if (document.body.classList.contains('garrison')) {
          if (heroChanged) updateAmbient(game);
        } else selectGame(game.id, false, null, false);
      }
    }
    if (previousControls !== game.controls) {
      controlsChanged = true;
      for (const badge of document.querySelectorAll(`.game-card[data-game-id="${CSS.escape(game.id)}"] > .control-badge`)) badge.outerHTML = controlBadge(game);
    }
  }
  // Controller metadata can change row membership; a cover alone cannot.
  if (controlsChanged) { scheduleHomeCollections(); updateControllerPrompts(); }
});
// Coalesce metadata that changes Home collection membership while covers are loading.
let homeCollectionsTimer = 0, homeCollectionsDirty = false;
function scheduleHomeCollections() {
  homeCollectionsDirty = true;
  if (homeCollectionsTimer) return;
  homeCollectionsTimer = setTimeout(() => {
    homeCollectionsTimer = 0;
    if (state.view !== 'home' || document.hidden || topmostOpenDialog()) return;
    homeCollectionsDirty = false;
    renderHomeCollections();
  }, 2500);
}
document.addEventListener('error', (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.dataset.artGameId) return;
  const game = state.games.find((item) => item.id === image.dataset.artGameId) || state.remoteGames?.find(item => item.id === image.dataset.artGameId) || Object.values(state.steamDiscovery).filter(Array.isArray).flat().find(item => item.id === image.dataset.artGameId);
  if (!game) return;
  const candidates = game.artwork?.coverCandidates || [];
  const next = Number(image.dataset.coverIndex || 0) + 1;
  if (candidates[next]?.tile) {
    image.dataset.coverIndex = String(next);
    image.src = candidates[next].tile;
  } else {
    const fallback = Object.assign(document.createElement('span'), { className: 'art-fallback broken-cover', textContent: game.title });
    Object.assign(fallback.dataset, {artGameId:game.id,artClass:image.dataset.artClass || '',artFeatured:image.dataset.artFeatured || 'false'});
    image.replaceWith(fallback);
  }
}, true);

function playUiSound(kind = 'navigate') {
  if (state.soundEffects) interfaceAudio.play(kind);
}

function hashHue(text) {
  return [...text].reduce((sum, char) => sum + char.charCodeAt(0) * 7, 0) % 360;
}

function escapeHtml(text) {
  return String(text).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
}

function fallbackWordmark(title) {
  const safe = escapeHtml(title.slice(0, 30));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="180" viewBox="0 0 900 180"><text x="450" y="115" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${title.length > 20 ? 48 : 68}" font-weight="900" letter-spacing="2">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const ambientPreloads = new Map();
const logoContrastChecks = new Map();
const logoBounds = new Map();
let ambientSequence = 0;
function isDarkGameLogo(url) {
  if (logoContrastChecks.has(url)) return logoContrastChecks.get(url);
  const check = new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => finish(false), 5000);
    let settled = false;
    const finish = dark => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      resolve(dark);
    };
    image.onerror = () => finish(false);
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 64;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 128, 64);
        const pixels = context.getImageData(0, 0, 128, 64).data;
        let dark = 0, total = 0, transparent = 0, left = 128, top = 64, right = 0, bottom = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] < 80) { transparent++; continue; }
          const weight = pixels[i + 3] / 255;
          const x = (i / 4) % 128, y = Math.floor(i / 4 / 128);
          left = Math.min(left, x); right = Math.max(right, x + 1);
          top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
          total += weight;
          if (.2126 * pixels[i] + .7152 * pixels[i + 1] + .0722 * pixels[i + 2] < 62) dark += weight;
        }
        // Only recolour transparent wordmarks, never opaque art into a white box.
        if (total > 0) {
          logoBounds.set(url, { left: Math.max(0,left-1)/128, top: Math.max(0,top-1)/64, right: Math.min(128,right+1)/128, bottom: Math.min(64,bottom+1)/64, ratio: image.naturalWidth / image.naturalHeight });
          while (logoBounds.size > 64) logoBounds.delete(logoBounds.keys().next().value);
        }
        finish(total > 0 && dark / total > .5 && transparent / (128 * 64) > .12);
      } catch { finish(false); } // Providers without CORS keep their original art.
    };
    image.src = url;
  });
  logoContrastChecks.set(url, check);
  while (logoContrastChecks.size > 64) logoContrastChecks.delete(logoContrastChecks.keys().next().value);
  return check;
}
function applyLogoContrast(image, url) {
  image.classList.remove('dark-game-logo');
  if (!url) return Promise.resolve();
  return isDarkGameLogo(url).then(dark => {
    if (image.getAttribute('src') === url) image.classList.toggle('dark-game-logo', dark);
  });
}
const ambientDimensions = new Map();
function preloadAmbientImage(url) {
  if (ambientPreloads.has(url)) return ambientPreloads.get(url);
  const task = new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const done = success => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      if (!success) image.src = '';
      resolve(success);
    };
    const timeout = setTimeout(() => done(false), 12000);
    image.onload = () => image.decode().catch(() => {}).then(() => {
      ambientDimensions.set(url, { width: image.naturalWidth, height: image.naturalHeight });
      while (ambientDimensions.size > 64) ambientDimensions.delete(ambientDimensions.keys().next().value);
      done(true);
    });
    image.onerror = () => done(false);
    image.src = url;
  });
  ambientPreloads.set(url, task);
  while (ambientPreloads.size > 16) ambientPreloads.delete(ambientPreloads.keys().next().value);
  task.then(success => { if (!success && ambientPreloads.get(url) === task) ambientPreloads.delete(url); });
  return task;
}
function applyAmbientImage(game, image, kind) {
  const sequence = ++ambientSequence;
  const ambientKey = `${game.id}:${kind}:${image || hashHue(game.title)}`;
  if (state.ambientKey === ambientKey) return;
  const commit = () => {
    if (sequence !== ambientSequence) return;
    state.ambientKey = ambientKey;
    const target = visibleAmbient === ambient ? ambientNext : ambient;
    target.style.backgroundImage = image
      ? `linear-gradient(118deg, rgba(3,9,14,.3), rgba(3,9,14,.08)), url("${image.replaceAll('"', '%22')}")`
      : `radial-gradient(circle at 78% 7%, hsla(${hashHue(game.title)}, 72%, 48%, .55), transparent 34%), linear-gradient(118deg, #06243a, #101820 66%, #07090c)`;
    target.classList.add('ambient-active');
    visibleAmbient.classList.remove('ambient-active');
    visibleAmbient = target;
  };
  // Keep the previous image visible until its replacement is decoded. Slow or
  // failed requests must never blank the background or win a later selection.
  if (image) preloadAmbientImage(image).then(success => {
    if (sequence !== ambientSequence) return;
    const size = ambientDimensions.get(image);
    // A square/portrait cover or tiny Steam capsule is not a wallpaper. Never
    // enlarge its embedded title across the whole dashboard.
    if (!success || !size || size.width / size.height < 1.5 || size.width < 900) image = '';
    commit();
  });
  else commit();
}

function pickNewScreenshot(images, gameId, previousByGame) {
  const previous = previousByGame.get(gameId);
  const choices = images.length > 1 ? images.filter((image) => image !== previous) : images;
  const image = choices[Math.floor(Math.random() * choices.length)] || images[0];
  if (image) previousByGame.set(gameId, image);
  while (previousByGame.size > 80) previousByGame.delete(previousByGame.keys().next().value);
  return image;
}
function cacheHomeScreenshots(gameId, images) {
  state.homeScreenshotCache.delete(gameId);
  state.homeScreenshotCache.set(gameId, images);
  while (state.homeScreenshotCache.size > 80) state.homeScreenshotCache.delete(state.homeScreenshotCache.keys().next().value);
}

function updateAmbient(game, force = false) {
  const requestToken = ++state.homeAmbientRequestToken;
  const fallback = game.artwork?.hero || game.artwork?.wide || '';
  const cachedScreenshots = state.homeScreenshotCache.get(game.id) || [];
  if (state.shuffleHomeScreenshots && cachedScreenshots.length) {
    applyAmbientImage(game, pickNewScreenshot(cachedScreenshots, game.id, state.lastHomeScreenshotByGame), 'screenshot');
    return;
  }
  if (force) state.ambientKey = '';
  applyAmbientImage(game, fallback, 'artwork');
  if (!state.shuffleHomeScreenshots) return;
  loadGamePageDetails(game).then((details) => {
    const screenshots = [...new Set((details.screenshots || []).filter(Boolean))];
    cacheHomeScreenshots(game.id, screenshots);
    if (!screenshots.length || requestToken !== state.homeAmbientRequestToken || state.selectedGameId !== game.id || !state.shuffleHomeScreenshots) return;
    applyAmbientImage(game, pickNewScreenshot(screenshots, game.id, state.lastHomeScreenshotByGame), 'screenshot');
  }).catch(() => {});
}

function providerBadge(provider) {
  if (provider === 'Steam') {
    return '<span class="provider-mark steam-mark" title="Steam" aria-label="Steam"><img src="assets/steam.svg" alt="" /></span>';
  }
  if (provider === 'Epic Games') return '<span class="provider-mark epic-mark" title="Epic Games" aria-label="Epic Games">EPIC</span>';
  if (provider === 'Xbox PC' || provider === 'Xbox') return '<span class="provider-mark xbox-mark" title="Xbox" aria-label="Xbox"><img src="assets/xbox.svg" alt="" /></span>';
  if (provider === 'Ubisoft Connect') return '<span class="provider-mark pc-mark" title="Ubisoft Connect" aria-label="Ubisoft Connect">UBI</span>';
  if (provider === 'EA app') return '<span class="provider-mark pc-mark" title="EA app" aria-label="EA app">EA</span>';
  if (provider === 'Battle.net') return '<span class="provider-mark pc-mark" title="Battle.net" aria-label="Battle.net">B.NET</span>';
  return `<span class="provider-mark pc-mark" title="${escapeHtml(provider)}" aria-label="${escapeHtml(provider)}">PC</span>`;
}

function gameArt(game, className = '', featured = false) {
  const url = featured
    ? (game.artwork?.hero || game.artwork?.wide || game.artwork?.tile)
    : (game.artwork?.tile || game.artwork?.grid);
  // Non-square artwork is cropped by the square tile, without adding another
  // title over its own wordmark. The centred logo is an explicit choice.
  const showCenteredLogo = !featured && game.artwork?.logo && (game.artwork?.overlayLogo === true || !url);
  const identity = `data-art-game-id="${escapeHtml(game.id)}" data-art-class="${escapeHtml(className)}" data-art-featured="${featured}"`;
  if (url && !showCenteredLogo) return `<img class="${className}" src="${escapeHtml(url)}" ${identity} data-cover-index="0" alt="" loading="${featured ? 'eager' : 'lazy'}" decoding="async" draggable="false">`;
  return `<span class="art-fallback" ${identity} style="--hue:${hashHue(game.title)}">
    ${url ? `<img class="fallback-art" src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" draggable="false">` : ''}
    <span class="fallback-scrim"></span>
    ${showCenteredLogo ? `<img class="tile-logo" src="${escapeHtml(game.artwork.logo)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span class="fallback-title">${escapeHtml(game.title)}</span>`}
  </span>`;
}

function controlBadge(game) {
  const support = game.controls || 'unknown';
  const label = inputMethods(game).map(method => method.label).join(' · ');
  return `<span class="control-badge control-${escapeHtml(support)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${inputSymbols(game)}</span>`;
}

function card(game, index = 0) {
  if (game.isApp) {
    const icon = game.isXboxLauncher ? '<img src="assets/xbox.svg" alt="" />' : game.launcherIcon ? `<img src="${escapeHtml(game.launcherIcon)}" alt="" />` : game.artwork?.tile ? `<img src="${escapeHtml(game.artwork.tile)}" alt="" loading="lazy" />` : providerBadge(game.provider);
    return `<button class="app-list-card focusable" type="button" role="listitem" data-action="select-app" data-game-id="${escapeHtml(game.id)}" aria-label="Open ${escapeHtml(game.title)} options"><span class="app-list-icon">${icon}</span><span class="app-list-copy"><strong>${escapeHtml(game.title)}</strong><small>${game.isLauncher ? 'Game launcher' : 'App'} · ${escapeHtml(game.provider)}</small></span><span class="app-list-chevron" aria-hidden="true">›</span></button>`;
  }
  const installClass = game.installed === false ? ' not-installed' : '';
  return `<button class="game-card focusable${installClass}" style="--tile-index:${Math.min(index, 8)}" role="listitem" data-game-id="${escapeHtml(game.id)}" data-action="select-game" aria-label="${escapeHtml(game.title)}, ${escapeHtml(game.provider)}${game.installed === false ? ', not installed' : ''}" title="${escapeHtml(game.title)}${game.installed === false ? ' · Not installed' : ''} · Right click or press Menu for options">
    ${gameArt(game)}
    ${game.remoteHostId ? `<span class="remote-cloud-badge" role="img" aria-label="${escapeHtml('Remote play on '+game.hostName)}" title="${escapeHtml('Remote play · '+game.hostName)}">${consoleIcon('cloud')}</span>` : ''}
    ${providerBadge(game.provider)}
    ${controlBadge(game)}
    ${game.steamFamilyShared ? `<span class="family-shared-mark">${consoleIcon('groups')}<span>Family</span></span>` : ''}
    <span class="console-game-label">${escapeHtml(game.title)}</span>
    ${game.installed === false ? '<span class="install-state">NOT INSTALLED</span>' : ''}
    <span class="g-card-text"><em>${escapeHtml(game.provider === 'PC' ? 'Custom' : game.provider)}</em><strong>${escapeHtml(game.title)}</strong><small class="g-status">${escapeHtml(game.installed === false ? (game.steamFamilyShared ? 'Family shared' : 'Not installed') : game.provider === 'PC' ? 'Custom' : game.provider)}</small><small class="g-size">${game.sizeOnDisk ? formatBytes(game.sizeOnDisk) : ''}</small></span>
    <span class="g-col g-col-provider">${escapeHtml(game.provider === 'PC' ? 'Custom' : game.provider)}</span><span class="g-col g-col-played">${game.steamLastPlayed ? relativeTime(game.steamLastPlayed) : '—'}</span><span class="g-col g-col-size">${game.sizeOnDisk ? formatBytes(game.sizeOnDisk) : '—'}</span>
  </button>`;
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const power = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** power;
  return `${value >= 100 || power === 0 ? Math.round(value) : value.toFixed(1)} ${units[power]}`;
}

const relativeTimeFormat = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function relativeTime(at) {
  const seconds = (at - Date.now()) / 1000;
  for (const [unit, size] of [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]]) {
    if (Math.abs(seconds) >= size) return relativeTimeFormat.format(Math.round(seconds / size), unit);
  }
  return 'Just now';
}

function updateControllerPrompts() {
  const selectedGame = state.games.find((game) => game.id === state.selectedGameId);
  const hasGames = state.games.some((game) => !game.isApp);
  const hasHomeGames = state.games.some((game) => !game.isApp && game.installed !== false);
  const visible = state.view === 'home' ? hasHomeGames : state.view === 'store' || ['library', 'detail'].includes(state.view) && hasGames;
  controllerPrompts.hidden = !visible;
  const setPrompt = (element, show, label) => {
    element.hidden = !show;
    element.querySelector('span').textContent = label;
  };
  const catalogDetail = state.view === 'detail' && !state.games.some(game => game.id === state.detailGameId);
  setPrompt(promptA, Boolean(selectedGame) || state.view === 'store', state.view === 'store' || catalogDetail ? 'View' : state.view === 'detail' && selectedGame?.installed !== false ? 'Play' : state.view === 'detail' && selectedGame ? 'Install' : 'Open');
  setPrompt(promptB, state.view !== 'home', state.view === 'library' && !state.libraryQueue ? 'Home' : 'Back');
  setPrompt(promptX, false, 'Scan');
  setPrompt(promptY, state.view === 'home' || state.view === 'library', 'Search');
  setPrompt(promptMenu, Boolean(selectedGame) && state.view !== 'store' && !catalogDetail, 'Options');
}

function libraryCard(games) {
  const collage = games.map((game) => `<span class="library-collage-art">${gameArt(game)}</span>`).join('');
  return `<button class="library-card focusable" data-action="library" aria-label="Open full library">
    <span class="library-collage">${collage || '<span class="library-collage-empty">+</span>'}</span>
    <span class="library-card-scrim"></span>
    <span class="library-card-label"><strong>Library</strong><span>View all games</span></span>
  </button>`;
}

const LIBRARY_PAGE = 72;
function appendLibraryPage() {
  const items = state.libraryItems || [];
  if (state.consoleLibraryGroups || state.libraryRendered >= items.length) return false;
  const next = Math.min(items.length, state.libraryRendered + LIBRARY_PAGE);
  libraryGrid.insertAdjacentHTML('beforeend', items.slice(state.libraryRendered, next).map((game, index) => card(game, index)).join(''));
  state.libraryRendered = next;
  refreshFocusables();
  return true;
}

function trimHiddenLibraryPages() {
  if (state.consoleLibraryGroups || state.libraryRendered <= LIBRARY_PAGE) return;
  // Preserve the full grid while viewing a game's details so Back keeps its
  // exact card and position. Home/Store only need the first page kept warm.
  const cards = libraryGrid.querySelectorAll(':scope > .game-card, :scope > .app-list-card');
  for (let index = LIBRARY_PAGE; index < cards.length; index++) cards[index].remove();
  if (cards.length) state.libraryRendered = Math.min(cards.length,LIBRARY_PAGE);
}

function renderLibraryView() {
  state.libraryViewDirty = false;
  libraryView.classList.toggle('show-groups', Boolean(state.consoleLibraryGroups));
  libraryView.classList.toggle('show-apps', state.libraryCategory === 'apps');
  const displayed = displayedLibraryGames(state.sourceFilter);
  const categorySource = state.libraryCategory === 'apps'
    ? displayed.filter((game) => game.isApp)
    : state.libraryCategory === 'games'
      ? displayed.filter((game) => !game.isApp)
      : displayed;
  const filtered = categorySource.filter((game) => (!state.searchQuery || game.title.toLowerCase().includes(state.searchQuery))
    && (state.installFilter === 'all' || (game.installed !== false) === (state.installFilter === 'installed'))
    && (state.sourceFilter === 'all' || game.provider === state.sourceFilter)
    && matchesCollection(game, state.collectionFilter || 'all'));
  const source = filtered.filter((game) => state.libraryTab === 'play-history' ? (game.playCount || 0) > 0 || lastPlayedAt(game) > 0
    : state.libraryTab === 'my-games' ? game.installed !== false || game.steamOwned || game.steamFamilyShared || game.epicOwned || Boolean(game.accountLibrary) : true);
  if (state.librarySort === 'name') source.sort((a, b) => a.title.localeCompare(b.title));
  else if (state.librarySort === 'provider') source.sort((a, b) => a.provider.localeCompare(b.provider) || a.title.localeCompare(b.title));
  else if (state.librarySort === 'playtime') source.sort((a, b) => (b.steamPlaytimeMinutes || 0) - (a.steamPlaytimeMinutes || 0) || a.title.localeCompare(b.title));
  else if (state.librarySort === 'size') source.sort((a, b) => (b.sizeOnDisk || 0) - (a.sizeOnDisk || 0) || a.title.localeCompare(b.title));
  else if (state.libraryTab === 'play-history' || state.librarySort === 'recent') source.sort((a, b) => lastPlayedAt(b) - lastPlayedAt(a) || (b.playCount || 0) - (a.playCount || 0) || a.title.localeCompare(b.title));
  const categoryName = state.libraryCategory === 'apps' ? 'Apps' : state.libraryCategory === 'games' ? 'Games' : 'Full library';
  const activeSection = state.libraryQueue ? 'queue' : state.libraryTab === 'play-history' ? 'recent'
    : state.installFilter === 'installed' && !state.consoleLibraryGroups && state.libraryCategory !== 'apps' ? 'installed' : 'games';
  document.querySelectorAll('.console-library-nav [data-section]').forEach(button => button.classList.toggle('active', button.dataset.section === activeSection));
  libraryCount.textContent = `${source.length} ${state.libraryCategory === 'apps' ? 'app' : state.libraryCategory === 'games' ? 'game' : 'item'}${source.length === 1 ? '' : 's'}`;
  document.querySelector('#library-heading').textContent = state.libraryTab === 'play-history' ? 'Play history' : categoryName;
  // Build the grid a page at a time; the rest is appended as the player scrolls or moves focus down.
  state.libraryItems = source;
  state.libraryRendered = Math.min(source.length, LIBRARY_PAGE);
  libraryGrid.innerHTML = source.length
    ? source.slice(0, state.libraryRendered).map((game, index) => card(game, index)).join('')
    : libraryEmptyState();
  libraryGrid.classList.toggle('dense-results', source.length > 28);
  libraryGrid.classList.toggle('apps-grid', state.libraryCategory === 'apps');
  document.querySelectorAll('.library-tab').forEach((tab) => {
    const active = tab.dataset.tab === state.libraryTab;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    if (!chip.dataset.category) return;
    const active = chip.dataset.category === state.libraryCategory;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('[data-action="library-install-filter"]').forEach((chip) => {
    const active = chip.dataset.installed === state.installFilter;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
  if (state.consoleLibraryGroups) renderConsoleGroups();
  renderConsoleLibraryStatus();
}

function renderSteamConnectionStatus() {
  const messages = {
    disabled: 'Installed Steam games are linked. Account library features are optional.',
    ready: `${state.steamOwnedCount} Steam games visible to the API${state.showUninstalledSteam ? ' · uninstalled titles are included below' : ' · enable uninstalled games in Settings'}.`,
    'needs-api-key': 'Installed Steam games are linked. Add a Web API key for uninstalled owned games, or connect Steam Family in Settings.',
    'needs-steam-id': 'SteamID64 not detected. Sign in to the Steam client or enter it in Settings.',
    'invalid-api-key': 'Steam rejected this API key. Check or replace it in Settings.',
    'private-library': 'Steam returned no visible library. Check your profile’s Game details privacy setting.',
    'steam-error': 'Steam library request failed. Check the key, SteamID64, connection, and try again.'
  };
  const message = messages[state.steamStatus] || 'Steam library status unavailable.';
  document.querySelector('#steam-connection-text').textContent = message;
  document.querySelector('#settings-steam-status').textContent = message;
  document.querySelector('#steam-connection-banner').hidden = state.steamBannerDismissed;
}

function renderEpicConnectionStatus() {
  const status = document.querySelector('#settings-epic-status');
  const badge = document.querySelector('#settings-epic-badge');
  if (!status || !badge) return;
  const messages = {
    ready: `${state.epicOwnedCount || 0} Epic titles found in the signed-in account library.`,
    available: 'Legendary is available. Turn on uninstalled games to load your Epic account library.',
    'needs-helper': 'Install or select Legendary (included with Heroic) to read uninstalled Epic games.',
    'sign-in-required': 'Legendary is installed but could not read the library. Sign in there, then scan again.'
  };
  status.textContent = messages[state.epicStatus] || 'Epic account library status unavailable.';
  badge.textContent = state.epicStatus === 'ready' ? 'Connected' : state.epicStatus === 'available' ? 'Ready' : 'Setup needed';
}

async function refreshEpicHelperStatus() {
  const configuredPath = document.querySelector('#legendary-path').value.trim();
  const result = await window.launcher.getEpicHelperStatus(configuredPath);
  const toggle = document.querySelector('#show-uninstalled-epic-toggle');
  toggle.disabled = !result.available;
  if (!result.available) toggle.checked = false;
  document.querySelector('#settings-epic-status').textContent = result.available
    ? state.epicStatus === 'ready' && state.showUninstalledEpic ? `${state.epicOwnedCount || 0} Epic titles found in your account library.` : 'Legendary found. Sign in through Legendary or Heroic, then enable uninstalled games.'
    : 'Choose Legendary.exe to enable the uninstalled Epic library.';
  document.querySelector('#settings-epic-badge').textContent = result.available ? state.epicStatus === 'ready' && state.showUninstalledEpic ? 'Connected' : 'Ready' : 'Setup needed';
}

function renderSteamLocalStatus(target = '#onboard-steam-status') {
  const element = document.querySelector(target);
  if (!element) return;
  const status = state.steamLocalStatus;
  const locallyLinked = Boolean(status?.installed || status?.accountDetected || status?.ready);
  element.classList.toggle('steam-status-ready', locallyLinked);
  const check = document.querySelector('#onboard-steam-check');
  if (check && target === '#onboard-steam-status') {
    check.hidden = !locallyLinked;
    check.setAttribute('aria-label', locallyLinked ? 'Steam detected; installed games are linked automatically' : 'Steam not detected');
  }
  if (!status) { element.textContent = 'Checking this PC for Steam…'; return; }
  if (status.ready) element.textContent = 'Steam is connected on this PC. Installed games link automatically.';
  else if (status.clientRunning && status.accountDetected) element.textContent = 'Steam detected. Installed games link automatically; account details are optional.';
  else if (status.accountDetected) element.textContent = 'Steam account found. Installed games link automatically; no SteamID is needed for local games.';
  else if (status.installed) element.textContent = 'Steam found on this PC. Installed games link automatically; no sign-in is needed here.';
  else element.textContent = 'Steam desktop app not detected. Other installed games can still be imported.';
}

let steamLocalStatusPending = null;
function refreshSteamLocalStatus() {
  if (steamLocalStatusPending) return steamLocalStatusPending;
  steamLocalStatusPending = Promise.resolve().then(() => window.launcher.getSteamLocalStatus()).then(status => {
    state.steamLocalStatus = status;
    renderSteamLocalStatus();
    renderSteamLocalStatus('#settings-steam-local-status');
  }).catch(() => { /* Keep the last usable status when Steam is unavailable. */ })
    .finally(() => { steamLocalStatusPending = null; });
  return steamLocalStatusPending;
}

function updateUninstalledRequirement(keyInputId, checkboxId, noteId = '') {
  const key = document.querySelector(`#${keyInputId}`).value.trim();
  const checkbox = document.querySelector(`#${checkboxId}`);
  checkbox.disabled = !key;
  if (!key) checkbox.checked = false;
  const note = noteId && document.querySelector(`#${noteId}`);
  if (note) note.textContent = key ? 'Steam API key added — account library can be queried.' : 'Add a Steam Web API key to enable this.';
}

function matchesCollection(game, collection) {
  if (collection === 'favorites') return libraryCopyIds(game).some(id=>state.favoriteGameIds.includes(id));
  if (collection === 'family-shared') return game.steamFamilyShared === true;
  if (collection.startsWith('custom:')) return libraryCopyIds(game).some(id=>state.customCollections.find((item) => item.id === collection.slice(7))?.gameIds.includes(id));
  // Steam's own store filters: Full controller support, and Local & party (shared/split screen, LAN, Remote Play Together).
  if (collection === 'controller') return game.controls === 'controller';
  if (collection === 'solo') return /single-player/i.test((game.steamCategories || []).join(' '));
  if (collection === 'multiplayer') return /shared\/split screen|lan (pvp|co-op)|remote play together/i.test((game.steamCategories || []).join(' '));
  if (collection === 'installed') return game.installed !== false;
  return true;
}

function showProfilePage(page) {
  document.querySelectorAll('[data-profile-page]').forEach(panel => panel.hidden = panel.dataset.profilePage !== page);
  document.querySelectorAll('[data-action="profile-tab"]').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.page === page);
    tab.setAttribute('aria-selected', String(tab.dataset.page === page));
  });
  refreshFocusables();
}

function renderHomeCollections() {
  const savedPosition = captureCollectionPosition();
  favoritesShelf.hidden = true;
  homeCollections.hidden = false;
  for (const [key, row] of Object.entries(steamDiscoveryRows)) {
    const items = state.steamDiscovery[key] || [];
    row.closest('section').hidden = items.length === 0 && state.steamDiscovery.status !== 'loading';
    row.innerHTML = items.length ? items.map(item => {
      const owned = state.games.find(game => game.provider === 'Steam' && String(game.appId) === item.appId);
      const target = owned || item;
      const artGame = owned?.artwork?.manual ? owned : item;
      const caption = key === 'mostPlayed'
        ? Number.isFinite(item.currentPlayers) && item.currentPlayers >= 0
          ? `${Intl.NumberFormat('en').format(item.currentPlayers)} playing now`
          : 'Player count unavailable'
        : owned ? 'In your library' : 'View on Steam';
      return `<button class="steam-discovery-card focusable${artGame.artwork?.tile ? '' : ' no-cover'}" type="button" data-action="discovery-game" data-game-id="${escapeHtml(target.id)}" data-app-id="${escapeHtml(item.appId)}" aria-label="${escapeHtml(item.title)}, ${escapeHtml(caption)}${owned ? ', in your library' : ''}"><span class="steam-discovery-art">${gameArt(artGame)}</span><span class="steam-discovery-rank">#${item.rank}</span><span class="steam-discovery-caption"><strong>${escapeHtml(item.title)}</strong><small>${caption}</small></span></button>`;
    }).join('') : '<p class="discovery-loading">Loading Steam charts…</p>';
  }
  for (const shelf of [trendingShelf, mostPlayedShelf, controllerReadyShelf, multiplayerShelf, singlePlayerShelf, recentlyPlayedShelf]) shelf.hidden = true;
  recentlyUpdatedRow.closest('section').hidden = true;
  randomRow.closest('section').hidden = true;
  renderCollectionBands();
  restoreCollectionPosition(savedPosition);
}

function homeRecentGames() {
  const local = displayedLibraryGames().filter(game => !game.isApp && (game.installed !== false || state.searchQuery));
  const remote = (state.remoteGames || []).filter(game => !game.isApp && game.installed !== false && lastPlayedAt(game) > 0);
  return [...local, ...remote].filter(game => !state.searchQuery || game.title.toLowerCase().includes(state.searchQuery))
    .sort((a, b) => lastPlayedAt(b) - lastPlayedAt(a));
}
function renderRecentGames(games = homeRecentGames()) {
  recentRow.innerHTML = games.slice(0, 9).map((game, index) => card(game, index)).join('');
}
function renderHomeLibrary(redirectToApps = false) {
  state.homeLibraryDirty = false;
  const homeGames = homeRecentGames();
  const hasGames = homeGames.length > 0;
  const hasApps = state.games.some((game) => game.isApp);
  const hasItems = state.games.length > 0 || hasGames;
  if (!hasGames && hasApps && state.view === 'home' && !state.searchQuery) state.libraryCategory = 'apps';
  document.querySelector('main').hidden = !hasItems && state.view === 'home';
  emptyState.hidden = hasGames || state.view !== 'home';
  if (!hasGames && hasItems) {
    emptyState.querySelector('h2').textContent = state.searchQuery ? 'No matching games' : 'No installed games on Home';
    emptyState.querySelector('p').textContent = state.searchQuery
      ? 'Try another title, or open Library to browse all games and apps.'
      : 'Open Library to browse your full Steam collection, including games that are not installed.';
  } else {
    emptyState.querySelector('h2').textContent = 'No games found yet';
    emptyState.querySelector('p').textContent = 'We scan Steam and Epic Games automatically. You can also add any Windows game manually.';
  }
  renderRecentGames(homeGames);
  renderDashboard();
  renderHomeCollections();
  if (hasGames && !homeGames.some((game) => game.id === state.selectedGameId)) selectGame(homeGames[0].id, false);
  else if (redirectToApps && !hasGames && hasApps && state.view === 'home' && !state.searchQuery) showView('library');
}
function renderLibrary() {
  renderCollectionOptions();
  state.homeLibraryDirty = true;
  state.libraryViewDirty = true;
  if (state.view === 'home') renderHomeLibrary(true);
  else if (state.view === 'library') renderLibraryView();
  if (state.selectedGameId) {
    const selectedCard = [...document.querySelectorAll(`.game-card[data-game-id="${CSS.escape(state.selectedGameId)}"]`)]
      .find((element) => element.offsetParent !== null);
    if (selectedCard) selectGame(state.selectedGameId, false, selectedCard, false);
  }
  updateControllerPrompts();
  refreshFocusables();
}

function renderCollectionOptions() {
  const select = document.querySelector('#library-collection');
  const selected = state.collectionFilter || 'all';
  select.querySelectorAll('option[data-custom-collection]').forEach((option) => option.remove());
  for (const collection of state.customCollections) {
    const option = document.createElement('option');
    option.value = `custom:${collection.id}`;
    option.textContent = collection.name;
    option.dataset.customCollection = 'true';
    select.append(option);
  }
  if (![...select.options].some((option) => option.value === selected)) state.collectionFilter = 'all';
  select.value = state.collectionFilter || 'all';
}

function renderCollectionsDialog() {
  const game = state.games.find((item) => item.id === state.optionsGameId);
  if (!game) return;
  document.querySelector('#collections-subtitle').textContent = `Choose where ${game.title} appears.`;
  const list = document.querySelector('#collections-list');
  list.innerHTML = state.customCollections.length ? state.customCollections.map((collection) => {
    const included = collection.gameIds.includes(game.id);
    return `<div class="collection-list-row"><button class="collection-member focusable" type="button" data-action="collection-membership" data-collection-id="${escapeHtml(collection.id)}" aria-pressed="${included}"><span class="collection-check">${included ? '✓' : ''}</span><span><strong>${escapeHtml(collection.name)}</strong><small>${collection.gameIds.length} game${collection.gameIds.length === 1 ? '' : 's'}</small></span></button><button class="collection-delete focusable" type="button" data-action="collection-delete" data-collection-id="${escapeHtml(collection.id)}" aria-label="Delete ${escapeHtml(collection.name)} collection">×</button></div>`;
  }).join('') : '<p class="surface-empty">No collections yet. Create one below and this game will be added to it.</p>';
  refreshFocusables();
}

function renderGameSessionAction() {
  const activeId = state.activeGameSession?.gameId;
  const detailGame = state.games.find((item) => item.id === state.detailGameId);
  const detailButton = document.querySelector('#detail-play');
  if (detailGame && detailGame.installed !== false && detailGame.id === activeId) {
    detailButton.innerHTML = `<span class="detail-action-icon" aria-hidden="true">↩</span><strong>${state.activeGameSession.verified ? 'Return to game' : 'Return to last game'}</strong>`;
    detailButton.dataset.returnGame = 'true';
  } else {
    detailButton.removeAttribute('data-return-game');
    if (detailGame) detailButton.innerHTML = detailGame.installed === false
      ? `<span class="detail-action-icon" aria-hidden="true">${detailGame.clientOnly ? '↗' : '↓'}</span><strong>${detailGame.clientOnly ? `Open ${escapeHtml(detailGame.provider)}` : 'Install'}</strong>`
      : '<span class="detail-action-icon" aria-hidden="true">▶</span><strong>Play</strong>';
  }
  const optionsReturn = document.querySelector('#options-return');
  const optionsPlay = gameOptionsDialog.querySelector('[data-action="options-launch"]');
  const isCurrent = Boolean(activeId && state.optionsGameId === activeId);
  optionsReturn.hidden = !isCurrent;
  optionsPlay.hidden = isCurrent || state.games.find((item) => item.id === state.optionsGameId)?.installed === false;
  optionsReturn.querySelector('strong').textContent = state.activeGameSession?.verified ? 'Return to game' : 'Return to last game';
}

async function refreshActiveGameSession() {
  try { state.activeGameSession = await window.launcher.getActiveGameSession(); }
  catch { state.activeGameSession = null; }
  renderGameSessionAction();
}

function renderSelectedGameNews(game) {
  const requestToken = ++state.newsRequestToken;
  const eligible = game?.provider === 'Steam' && /^\d+$/.test(String(game.appId || '')) && !game.isApp && game.id === state.detailGameId;
  newsShelf.hidden = true;
  newsRow.innerHTML = '';
  newsRow.classList.remove('news-changing');
  state.newsPendingGameId = null;
  if (!eligible) return;
  state.newsPendingGameId = game.id;
  newsSubtitle.textContent = `${game.title} · Steam updates`;
  const cached = state.newsCache.get(game.id);
  const newsPromise = cached && Date.now() - cached.at < 5 * 60 * 1000
    ? Promise.resolve(cached.items)
    : window.launcher.getGameNews(game.id).then((items) => {
      state.newsCache.set(game.id, { at: Date.now(), items });
      while (state.newsCache.size > 80) state.newsCache.delete(state.newsCache.keys().next().value);
      return items;
    });
  newsPromise.then((items) => {
    if (requestToken !== state.newsRequestToken || state.detailGameId !== game.id || state.view !== 'detail') return;
    state.newsPendingGameId = null;
    if (!items.length) { newsShelf.hidden = true; newsRow.innerHTML = ''; return; }
    const steamHeader = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(game.appId)}/header.jpg`;
    const fallbackArt = game.artwork?.wide || game.artwork?.hero || game.artwork?.tile || '';
    // Each post shows its own image; posts without one take the game's screenshots in turn, so cards don't repeat.
    const pool = [...new Set([...(state.galleryImages || []).map(galleryThumb), game.artwork?.hero, game.artwork?.wide, steamHeader].filter(Boolean))];
    let spare = 0;
    const markup = items.length ? items.map((item, index) => {
      const subtitle = String(item.contents || '').slice(0, 140) || 'Read the latest update';
      const art = item.image || pool[spare++ % pool.length] || fallbackArt;
      const kind = /patch|hotfix|update|notes|changelog|fix/i.test(item.title) ? 'Patch notes' : 'News';
      const when = item.date ? relativeTime(Number(item.date) * 1000) : '';
      return `<button class="news-card focusable" role="listitem" data-action="open-news" data-news-index="${index}" aria-label="${escapeHtml(item.title)}">
        <img class="news-card-art" src="${escapeHtml(art)}" data-fallback="${escapeHtml(fallbackArt || steamHeader)}" alt="" loading="lazy" decoding="async" />
        <span class="news-card-shade"></span><span class="news-card-copy"><small class="news-card-meta">${escapeHtml([kind, when].filter(Boolean).join(' • '))}</small><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(subtitle)}</span></span>
      </button>`;
    }).join('') : '<p class="news-loading">No recent English-language Steam news for this game.</p>';
    newsRow.classList.add('news-changing');
    setTimeout(() => {
      if (requestToken !== state.newsRequestToken) return;
      newsRow.innerHTML = markup;
      newsShelf.hidden = false;
      newsRow.querySelectorAll('.news-card-art').forEach((image) => image.addEventListener('error', () => {
        if (image.dataset.fallback && image.src !== image.dataset.fallback) image.src = image.dataset.fallback;
        else image.hidden = true;
      }));
      requestAnimationFrame(() => newsRow.classList.remove('news-changing'));
      refreshFocusables();
    }, 180);
  }).catch(() => {
    if (requestToken === state.newsRequestToken) {
      state.newsPendingGameId = null;
      newsShelf.hidden = true;
      newsRow.innerHTML = '';
      newsRow.classList.remove('news-changing');
    }
  });
}

function selectGame(id, moveFocus = true, selectedElement = null, refreshNews = true) {
  const game = state.games.find((item) => item.id === id) || state.remoteGames?.find(item => item.id === id);
  if (!game) return;
  const changed = state.selectedGameId !== id;
  state.selectedGameId = id;
  heroTitle.textContent = game.title;
  heroSubtitle.textContent = game.remoteHostId ? `Remote play · ${game.hostName}` : game.installed === false ? `Not installed · ${game.provider}` : `Installed with ${game.provider}`;
  heroProvider.textContent = game.provider.toUpperCase();
  heroPlay.hidden = false;
  const showJumpLogo = !document.body.classList.contains('garrison');
  if (showJumpLogo && game.artwork?.logo) {
    jumpLogo.innerHTML = `<img src="${escapeHtml(game.artwork.logo)}" alt="" draggable="false">`;
    jumpLogo.hidden = false;
  } else if (showJumpLogo) {
    jumpLogo.innerHTML = '';
    jumpLogo.hidden = true;
    if (!game.remoteHostId && !logoRequested.has(id) && game.artwork?.tile) {
      logoRequested.add(id);
      window.launcher.getGameLogo(id).then((logo) => {
        if (!logo) return;
        game.artwork ||= {};
        game.artwork.logo = logo;
        if (state.selectedGameId === id) {
          jumpLogo.innerHTML = `<img src="${escapeHtml(logo)}" alt="" draggable="false">`;
          jumpLogo.hidden = false;
        }
      }).catch(() => {});
    }
  }
  if (changed) updateAmbient(game);
  const finishTileMotion = beginDashboardTileMotion(selectedElement);
  // Only the card that loses the highlight and the one that gains it need touching. This used to be
  // a whole-document query on every focus change, i.e. on every held direction repeat.
  const previousCard = state.selectedCard;
  if (previousCard && previousCard !== selectedElement && previousCard.isConnected) previousCard.classList.remove('selected');
  if (selectedElement?.classList.contains('game-card')) { selectedElement.classList.add('selected'); state.selectedCard = selectedElement; }
  else if (previousCard && !previousCard.isConnected) state.selectedCard = null;
  finishTileMotion();
  if (refreshNews && state.view === 'detail' && (changed || (!state.newsCache.has(id) && state.newsPendingGameId !== id))) renderSelectedGameNews(game);
  if (moveFocus) {
    // Cards for a game can appear in several shelves at once, so the document is only searched when
    // the selected game actually changes and the known card is gone or belongs to another game.
    let matchingCard = state.selectedCard && state.selectedCard.dataset.gameId === id && state.selectedCard.isConnected ? state.selectedCard : null;
    if (!matchingCard) matchingCard = [...document.querySelectorAll('.game-card[data-game-id]')].find((element) => element.dataset.gameId === id);
    if (matchingCard) setFocusedElement(matchingCard);
  }
  updateControllerPrompts();
}

// Rebuild on structural/visibility changes, not on every held D-pad repeat.
// Drain pending records too: a dialog can open and receive focus synchronously.
let focusScope = null;
let focusListDirty = true;
let focusListBuilds = 0;
const focusObserver = new MutationObserver(records => {
  if (records.some(affectsFocusableLayout)) focusListDirty = true;
});
function affectsFocusableLayout(record) {
  const containsControl = node => node.nodeType === 1 && (node.matches('.focusable') || node.querySelector('.focusable'));
  if (record.type === 'childList') {
    return [...record.addedNodes, ...record.removedNodes].some(containsControl);
  }
  if (!containsControl(record.target)) return false;
  if (record.attributeName !== 'class') return true;
  const structuralClasses = value => String(value || '').split(/\s+/).filter(name => !['focused', 'selected', 'store-product-selected'].includes(name)).sort().join(' ');
  return structuralClasses(record.oldValue) !== structuralClasses(record.target.className);
}
focusObserver.observe(document.body, { subtree:true, childList:true, attributes:true, attributeOldValue:true, attributeFilter:['hidden','disabled','inert','open','class'] });
window.addEventListener('resize', () => { focusListDirty = true; });

function refreshFocusables() {
  const activeDialog = topmostOpenDialog();
  const scope = !steamShopSurface.hidden ? steamShopSurface : activeDialog || document;
  if (focusObserver.takeRecords().some(affectsFocusableLayout)) focusListDirty = true;
  if (scope !== focusScope || focusListDirty) {
    state.focusables = [...scope.querySelectorAll('.focusable')].filter((element) => !element.hidden && !element.disabled && !element.closest('[inert]') && element.offsetParent !== null && getComputedStyle(element).visibility !== 'hidden');
    focusScope = scope;
    focusListDirty = false;
    focusListBuilds++;
  }
  const currentIndex = state.focusables.indexOf(state.focusedElement);
  const activeIndex = state.focusables.indexOf(document.activeElement);
  if (currentIndex >= 0) state.focusIndex = currentIndex;
  else if (activeIndex >= 0) state.focusIndex = activeIndex;
  else if (state.focusIndex >= state.focusables.length) state.focusIndex = 0;
}

function setFocusedElement(element, { scroll = true } = {}) {
  if (!steamShopSurface.hidden && !steamShopSurface.contains(element)) return;
  const activeDialog = topmostOpenDialog();
  if (!element || (activeDialog && !activeDialog.contains(element))) return;
  if (state.view === 'home' && !activeDialog && element.parentElement !== recentRow) collapseDashboardTiles();
  refreshFocusables();
  if (state.focusedElement !== element) playUiSound('navigate');
  if (state.focusedElement !== element) state.focusedElement?.classList.remove('focused');
  state.focusedElement = element;
  const index = state.focusables.indexOf(element);
  if (index >= 0) state.focusIndex = index;
  element.classList.add('focused');
  element.focus({ preventScroll: true });
  if (element.classList.contains('game-card') && element.dataset.gameId) selectGame(element.dataset.gameId, false, element);
  if (!scroll) return;
  // Held directions scroll instantly; stacking smooth scrolls is what makes held movement feel laggy.
  const behavior = document.documentElement.classList.contains('reduce-motion') || state.navRepeat ? 'instant' : 'smooth';
  if (scrollCollectionIntoView(element, behavior)) return;
  element.scrollIntoView({ behavior, block: element.closest('#random-row') ? 'center' : 'nearest', inline: 'center' });
  const mainScroller = document.querySelector('main');
  if (mainScroller.contains(element)) {
    const bounds = mainScroller.getBoundingClientRect();
    const focused = element.getBoundingClientRect();
    if (focused.top < bounds.top + 88) mainScroller.scrollBy({ top: focused.top - bounds.top - 110, behavior });
    else if (focused.bottom > bounds.bottom - 34) mainScroller.scrollBy({ top: focused.bottom - bounds.bottom + 90, behavior });
  }
}

function moveFocus(direction) {
  refreshFocusables();
  const current = state.focusables[state.focusIndex];
  if (!current) return;
  if (navigateCollectionBand(direction, current)) return;
  if (navigateConsoleHome(direction, current)) return;
  if (navigateConsoleLibrary(direction, current)) return;
  if (navigateConsoleSearch(direction, current)) return;
  if (navigateNativeStore(direction, current)) return;
  if (direction === 'down' && current.closest('#steam-upcoming-row')) {
    const browse = document.querySelector('#category-discovery .focusable');
    if (browse) { setFocusedElement(browse); return; }
  }
  const origin = current.getBoundingClientRect();
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  let best = null;
  let bestScore = Infinity;
  // The top bar stays on screen while the page scrolls, so it is always "just above". Going up from the
  // page reaches it only once nothing else is above, instead of jumping out of a section halfway down.
  const fromPage = direction === 'up' && !current.closest('.topbar') && !topmostOpenDialog();
  let barBest = null;
  let barScore = Infinity;

  for (const candidate of state.focusables) {
    if (candidate === current) continue;
    if (fromPage && candidate.closest('.topbar')) {
      const rect = candidate.getBoundingClientRect();
      const score = Math.abs(rect.left + rect.width / 2 - ox) + Math.abs(rect.top - oy);
      if (score < barScore) { barScore = score; barBest = candidate; }
      continue;
    }
    const rect = candidate.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = cx - ox;
    const dy = cy - oy;
    const valid = direction === 'left' ? dx < -10 : direction === 'right' ? dx > 10 : direction === 'up' ? dy < -10 : dy > 10;
    if (!valid) continue;
    const primary = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
    const secondary = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2.8;
    if (score < bestScore) { bestScore = score; best = candidate; }
  }
  if (!best && barBest) best = barBest;
  if (best) setFocusedElement(best);
  else if (topmostOpenDialog()) {
    const choices = state.focusables;
    if (!choices.length) return;
    const edge = choices.reduce((chosen, item) => {
      const rect = item.getBoundingClientRect();
      const saved = chosen.getBoundingClientRect();
      if (direction === 'left' && rect.left < saved.left) return item;
      if (direction === 'right' && rect.right > saved.right) return item;
      if (direction === 'up' && rect.top < saved.top) return item;
      if (direction === 'down' && rect.bottom > saved.bottom) return item;
      return chosen;
    });
    if (edge !== current) setFocusedElement(edge);
  } else if (direction === 'up' || direction === 'down') document.querySelector('main').scrollBy({ top: direction === 'up' ? -window.innerHeight * .68 : window.innerHeight * .68, behavior: 'smooth' });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.toggle('controller-toast', /^Controller (connected|disconnected)/i.test(message));
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function isUsableController(gamepad) {
  if (!gamepad?.connected) return false;
  const id = String(gamepad.id || '').toLowerCase();
  // Windows can expose headset media controls through the Gamepad API. They
  // are connected devices, but do not have a game-controller input layout.
  if (/headset|headphones?|earbuds?|microphone|hands[- ]?free|audio|soundbar|media remote|volume control/.test(id)) return false;
  const buttonCount = gamepad.buttons?.length || 0;
  const axisCount = gamepad.axes?.length || 0;
  // Standard pads have many buttons; generic HID pads usually have at least
  // four buttons and two stick axes. This filters media remotes without
  // restricting Xbox, PlayStation, Switch, or third-party controllers.
  return buttonCount >= 8 || (buttonCount >= 4 && axisCount >= 2);
}

function getConnectedControllers() {
  try {
    return [...(navigator.getGamepads?.() || [])].filter(isUsableController);
  } catch {
    return [];
  }
}

function hasRecentControllerInput(gamepad) {
  return Boolean(gamepad?.buttons?.some((button) => button.pressed || button.value > .6)
    || gamepad?.axes?.some((axis) => Math.abs(axis) > .6));
}

function refreshControllerStatus() {
  const devices = getConnectedControllers();
  const button = document.querySelector('#controller-status-button');
  const dot = document.querySelector('#controller-status-dot');
  const title = document.querySelector('#controller-status-title');
  const copy = document.querySelector('#controller-status-copy');
  const list = document.querySelector('#controller-device-list');
  const connectButton = document.querySelector('#controller-connect-button');
  button?.classList.toggle('controller-ready', devices.length > 0);
  button?.setAttribute('aria-label', devices.length ? `Controller status: ${devices.length} connected` : 'Controller status: keyboard and mouse');
  button?.setAttribute('title', devices.length ? `${devices.length} controller${devices.length === 1 ? '' : 's'} connected` : 'Keyboard and mouse active · no controller detected');
  dot?.classList.toggle('connected', devices.length > 0);
  if (devices.length) {
    title.textContent = devices.length === 1 ? 'Controller connected' : `${devices.length} controllers connected`;
    copy.textContent = 'Controller input is ready. Use it to navigate your library and open games.';
    list.hidden = false;
    list.innerHTML = devices.map((gamepad) => `<div class="controller-device"><img src="assets/controller.svg" alt="" /><div><strong>${escapeHtml(gamepad.id || `Controller ${gamepad.index + 1}`)}</strong><span>${gamepad.mapping === 'standard' ? 'Standard controller layout · ready' : 'Connected · button layout may vary'}</span></div><i aria-label="Connected"></i></div>`).join('');
    connectButton.textContent = 'Refresh controller status';
  } else {
    title.textContent = 'Controller not detected';
    copy.textContent = 'Connect an Xbox, PlayStation, or compatible controller using USB or Bluetooth. You can keep using keyboard and mouse too.';
    list.hidden = true;
    list.innerHTML = '';
    connectButton.textContent = 'Connect my controller';
  }
  return devices;
}

function openControllerStatus() {
  refreshControllerStatus();
  controllerStatusDialog.showModal();
  setTimeout(() => setFocusedElement(document.querySelector('#controller-connect-button'), { scroll: false }), 0);
}

function findGameForDetails(gameId) {
  for (const games of [state.games, state.remoteGames, ...Object.values(state.steamDiscovery), state.gamePassCatalog, ...Object.values(state.xboxStore || {})]) {
    if (!Array.isArray(games)) continue;
    const game = games.find(item => item.id === gameId);
    if (game) return game;
  }
}
// Focus prefetch, ambient screenshots and the page share one IPC request. Keep
// only a small working set, keyed by region and metadata identity as well as ID.
const gamePageDetails = new Map();
function loadGamePageDetails(game) {
  const key = JSON.stringify([state.region || 'auto', game.id, game.title, game.appId, game.steamAppId, game.achievementReferenceAppId, game.xboxProductId]);
  const cached = gamePageDetails.get(key);
  if (cached && (cached.pending || Date.now() < cached.expires)) {
    gamePageDetails.delete(key); gamePageDetails.set(key, cached);
    return cached.promise;
  }
  const entry = { pending: true, expires: 0 };
  entry.promise = Promise.resolve().then(() => game.remoteHostId ? window.launcher.remotePlayDetails(game.remoteHostId, game.appId)
    : game.xboxProductId && game.discoveryOnly ? window.launcher.getCatalogDetails(game.xboxProductId)
    : game.discoveryOnly ? window.launcher.getSteamDiscoveryDetails(game.appId) : window.launcher.getGameDetails(game.id))
    .then(details => { entry.pending = false; entry.expires = Date.now() + (details.metadataSource === 'Local library' ? 30000 : 300000); return details; })
    .catch(error => { if (gamePageDetails.get(key) === entry) gamePageDetails.delete(key); throw error; });
  gamePageDetails.set(key, entry);
  while (gamePageDetails.size > 80) gamePageDetails.delete(gamePageDetails.keys().next().value);
  return entry.promise;
}
function openGameDetails(gameId) {
  const game = findGameForDetails(gameId);
  if (!game) return;
  const discoveryOnly = game.discoveryOnly === true;
  if (state.view !== 'detail') {
    state.previousView = state.view;
    state.detailReturn = { element: document.activeElement, scrollTop: document.querySelector('main').scrollTop };
  }
  state.detailGameId = game.id;
  if (!discoveryOnly) state.selectedGameId = game.id;
  searchPopover.hidden = true;
  const requestToken = ++state.detailRequestToken;
  showView('detail');
  if (discoveryOnly || game.remoteHostId) { state.newsRequestToken++; state.newsPendingGameId = null; newsShelf.hidden = true; newsRow.innerHTML = ''; }
  else renderSelectedGameNews(game);
  const mainScroller = document.querySelector('main');
  mainScroller.style.scrollBehavior = 'auto';
  mainScroller.scrollTop = 0;
  gameDetailView.scrollTop = 0;
  requestAnimationFrame(() => mainScroller.style.removeProperty('scroll-behavior'));
  const image = game.artwork?.hero || game.artwork?.wide || (game.remoteHostId ? game.artwork?.tile : '') || '';
  const heroArt = document.querySelector('#detail-global-art');
  const alternateHeroArt = document.querySelector('#detail-global-art-next');
  const fallbackBackdrop = image
    ? `url("${image.replaceAll('"', '%22')}")`
    : `radial-gradient(circle at 38% 25%, hsla(${hashHue(game.title)}, 66%, 35%, .8), transparent 60%), #111820`;
  heroArt.style.backgroundImage = fallbackBackdrop;
  heroArt.classList.remove('active');
  alternateHeroArt.classList.remove('active');
  alternateHeroArt.style.backgroundImage = '';
  state.detailBackdropLayer = 0;
  requestAnimationFrame(() => {
    if (requestToken === state.detailRequestToken) heroArt.classList.add('active');
  });
  detailTitle.textContent = game.title;
  const showDetailLogo = async (logo) => {
    if (!logo || state.detailGameId !== game.id) return;
    if (!await preloadAmbientImage(logo) || requestToken !== state.detailRequestToken) return;
    detailLogo.src = logo;
    await applyLogoContrast(detailLogo, logo);
    if (requestToken !== state.detailRequestToken) return;
    detailLogo.hidden = false;
    document.querySelector('#detail-logo-frame').hidden = false;
    fitDetailWordmark();
    detailTitle.hidden = true;
    detailLogo.onerror = () => { detailLogo.hidden = true; document.querySelector('#detail-logo-frame').hidden = true; detailTitle.hidden = false; };
  };
  detailLogo.hidden = true;
  document.querySelector('#detail-logo-frame').hidden = true;
  detailTitle.hidden = false;
  if (game.artwork?.logo) showDetailLogo(game.artwork.logo);
  else if (!discoveryOnly && !game.remoteHostId) window.launcher.getGameLogo(game.id).then((logo) => {
    if (requestToken !== state.detailRequestToken || !logo) return;
    game.artwork ||= {};
    game.artwork.logo = logo;
    showDetailLogo(logo);
  }).catch(() => {});
  document.querySelector('#detail-provider').innerHTML = `${providerBadge(game.provider)} ${escapeHtml(game.provider)}${game.provider === 'Steam' ? ' · PC' : ''}`;
  document.querySelector('#detail-byline').textContent = game.provider;
  document.querySelector('#detail-description').textContent = 'Loading game details…';
  document.querySelector('#detail-full-description').textContent = 'Game details are loading…';
  document.querySelector('#detail-publisher').textContent = 'Not available';
  document.querySelector('#detail-developer').textContent = 'Not available';
  document.querySelector('#detail-release-date').textContent = 'Not available';
  document.querySelector('#detail-metadata-source').textContent = '';
  document.querySelector('#detail-overview-grid').innerHTML = '<p class="detail-overview-loading">Gathering game information…</p>';
  document.querySelector('#detail-full-description').classList.add('clamped');
  document.querySelector('#detail-description-more').hidden = true;
  document.querySelector('#detail-description-more').textContent = 'View more';
  document.querySelector('#detail-rating').textContent = '';
  const playButton = document.querySelector('#detail-play');
  playButton.innerHTML = discoveryOnly ? `<span class="detail-action-icon" aria-hidden="true">↗</span><strong>${game.xboxProductId ? 'View in Xbox' : 'View on Steam'}</strong>` : game.installed === false ? '<span class="detail-action-icon" aria-hidden="true">↓</span><strong>Install</strong>' : '<span class="detail-action-icon" aria-hidden="true">▶</span><strong>Play</strong>';
  if (discoveryOnly) playButton.removeAttribute('data-return-game');
  else renderGameSessionAction();
  playButton.classList.toggle('install-action', game.installed === false && !discoveryOnly);
  document.querySelector('#detail-options-button').hidden = discoveryOnly;
  prepareConsoleGamePage(game);
  state.galleryImages = [];
  document.querySelector('#detail-gallery').innerHTML = '<p>Loading screenshots…</p>';
  for (const id of ['detail-platforms', 'detail-capabilities']) document.querySelector(`#${id}`).innerHTML = '';
  document.querySelector('#detail-dlc-note').textContent = 'Checking available ownership information…';
  document.querySelector('#detail-dlc-grid').innerHTML = '';
  document.querySelector('#detail-achievements-note').textContent = 'Checking achievements…';
  const achievementArt = document.querySelector('#achievement-game-art');
  achievementArt.innerHTML = game.artwork?.tile ? `<img src="${escapeHtml(game.artwork.tile)}" alt="" loading="lazy" />` : '<span aria-hidden="true">◇</span>';
  achievementArt.querySelector('img')?.addEventListener('error', () => { achievementArt.innerHTML = '<span aria-hidden="true">◇</span>'; }, { once: true });
  document.querySelector('#detail-achievements-grid').innerHTML = '';
  state.achievementItems = [];
  state.achievementFilter = 'all';
  state.achievementsExpanded = false;
  document.querySelector('#achievement-filters').hidden = true;
  document.querySelector('#achievement-progress').hidden = true;
  document.querySelector('#achievement-more').hidden = true;
  document.querySelector('#achievement-trueachievements').hidden = true;
  document.querySelector('#achievement-progress-label').textContent = '';
  document.querySelector('#achievement-source-label').textContent = '';
  if (game.remoteHostId) {
    document.querySelector('#detail-achievements-note').textContent = 'Achievements are tracked by the game’s launcher on your host PC.';
    document.querySelector('#detail-dlc-note').textContent = 'Manage add-ons on your host PC.';
  } else if (discoveryOnly) {
    document.querySelector('#detail-achievements-note').textContent = `View this game in ${game.xboxProductId ? 'Xbox' : 'Steam'} to see its achievements.`;
    document.querySelector('#detail-dlc-note').textContent = `View this game in ${game.xboxProductId ? 'Xbox' : 'Steam'} to browse add-ons.`;
  } else window.launcher.getGameAchievements(game.id).then((result) => {
    if (requestToken !== state.detailRequestToken) return;
    state.achievementItems = result.items || [];
    state.achievementTotal = result.totalAvailable ?? state.achievementItems.length;
    state.achievementUnlocked = result.unlockedCount ?? state.achievementItems.filter(item => item.unlocked === true).length;
    state.achievementProgressAvailable = Boolean(result.progressAvailable);
    document.querySelector('#achievement-source-label').textContent = result.source || (result.status === 'xbox-ready' ? 'Xbox' : state.achievementItems.length ? 'Steam Community' : '');
    document.querySelector('#achievement-trueachievements').hidden = state.achievementItems.length > 0;
    const achievementStatusCopy = {
      'reference-only': 'Steam edition achievement catalog · view only; this PC copy’s unlocks are not linked',
      'catalog-only': '',
      'none-listed': 'No achievements listed for this Steam game.',
      'needs-steam-account': 'Add a Steam Web API key and SteamID64 in Settings to load achievements.',
      'xbox-ready': `${result.platform || 'Xbox'} achievement catalog · ${result.progressAvailable ? 'progress from your Xbox account' : 'catalog only'}`,
      'xbox-no-match': 'No achievement catalog matched this game.',
      'xbox-unavailable': 'Achievements could not be loaded right now.',
      'no-reference': 'No compatible achievement catalog found. Link a Steam edition in Manage game to show its achievements.',
      unsupported: 'Achievement lists for this source need a separate authenticated platform integration.'
    };
    document.querySelector('#detail-achievements-note').textContent = result.status === 'ready'
      ? result.progressAvailable ? 'Your Steam achievement progress' : 'Achievement artwork and descriptions · personal progress unavailable'
      : achievementStatusCopy[result.status] ?? 'Achievements could not be loaded.';
    renderAchievements();
  }).catch(() => {
    if (requestToken !== state.detailRequestToken) return;
    document.querySelector('#detail-achievements-note').textContent = 'Achievements could not be loaded.';
    document.querySelector('#achievement-trueachievements').hidden = false;
  });
  setTimeout(() => {
    if(requestToken!==state.detailRequestToken||state.view!=='detail')return;
    const remote=state.remotePlaySession;
    setFocusedElement(remote?.gameId===game.id&&remote.view==='page'?document.querySelector('#detail-disconnect'):playButton,{scroll:false});
  }, 0);
  loadGamePageDetails(game).then((details) => {
    if (requestToken !== state.detailRequestToken || state.detailGameId !== game.id) return;
    document.querySelector('#detail-byline').textContent = [details.publisher || details.developer || game.provider, ...(details.genres || []).slice(0, 3)].filter(Boolean).join(' • ');
    document.querySelector('#detail-description').textContent = details.description || `Play ${game.title} from your ${game.provider} library.`;
    document.querySelector('#detail-publisher').textContent = details.publisher || 'Not available';
    document.querySelector('#detail-developer').textContent = details.developer || 'Not available';
    document.querySelector('#detail-release-date').textContent = details.releaseDate || 'Not available';
    const fullDescription = details.fullDescription || details.description || `Play ${game.title} from your ${game.provider} library.`;
    const fullDescriptionNode = document.querySelector('#detail-full-description');
    const descriptionMore = document.querySelector('#detail-description-more');
    fullDescriptionNode.textContent = fullDescription;
    fullDescriptionNode.classList.toggle('clamped', fullDescription.length > 360);
    descriptionMore.hidden = fullDescription.length <= 360;
    document.querySelector('#detail-rating').textContent = details.ageRating ? `Age rating ${details.ageRating}` : '';
    const images = launcherMedia.uniqueScreenshots(details.screenshots);
    state.galleryImages = images;
    cacheHomeScreenshots(game.id, images);
    if (state.useRandomScreenshotBackground && images.length) {
      const screenshot = pickNewScreenshot(images, game.id, state.lastDetailScreenshotByGame);
      const currentLayer = state.detailBackdropLayer === 0 ? heroArt : alternateHeroArt;
      const nextLayer = state.detailBackdropLayer === 0 ? alternateHeroArt : heroArt;
      nextLayer.style.backgroundImage = `url("${screenshot.replaceAll('"', '%22')}")`;
      preloadAmbientImage(screenshot).then(ready => {
        if (!ready) return;
        if (requestToken !== state.detailRequestToken || state.detailGameId !== game.id) return;
        nextLayer.classList.add('active');
        currentLayer.classList.remove('active');
        state.detailBackdropLayer = state.detailBackdropLayer === 0 ? 1 : 0;
      });
    }
    document.querySelector('#detail-gallery').innerHTML = images.length
      ? images.map((url, index) => `<button class="detail-gallery-item focusable" type="button" data-action="detail-gallery-select" data-gallery-index="${index}" aria-label="View screenshot ${index + 1}"><img src="${escapeHtml(galleryThumb(url))}" alt="Screenshot ${index + 1} of ${escapeHtml(game.title)}" ${index < 4 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" /></button>`).join('')
      : '<p>No screenshots available from this game’s store listing.</p>';
    document.querySelector('#detail-rating').textContent = [details.ageRating ? `Age rating ${details.ageRating}` : '', details.metacriticScore ? `Metacritic ${Number(details.metacriticScore)}` : ''].filter(Boolean).join(' · ');
    const playModes = (details.categories || []).filter((category) => /^(single-player|multi-player|online co-op|local co-op|shared\/split screen co-op|Xbox online co-op|Xbox online multiplayer)/i.test(category)).slice(0, 2).join(' · ');
    const platforms = details.playableOn?.length ? details.playableOn : game.xboxProductId && discoveryOnly ? [] : ['PC'];
    const overviewFacts = [
      { label: 'Genre', value: (details.genres || []).slice(0, 2).join(' · ') },
      { label: 'Play modes', value: playModes },
      { label: 'Input', value: details.controllerSupport === 'controller' ? 'Full controller support' : details.controllerSupport === 'partial' ? 'Partial controller support' : details.controllerSupport === 'kbm' ? 'Keyboard and mouse' : '' },
      { label: 'Achievements', value: details.achievementCount ? `${details.achievementCount} available` : '' },
      { label: 'Released', value: details.releaseDate }
    ].filter((fact) => fact.value).slice(0, 4);
    if (overviewFacts.length < 4) overviewFacts.push({ label: 'Library', value: game.provider });
    if (overviewFacts.length < 4 && platforms.length) overviewFacts.push({ label: 'Playable on', value: platforms.join(' · ') });
    if (overviewFacts.length < 4 && !discoveryOnly) overviewFacts.push({ label: 'Status', value: game.installed === false ? 'Not installed' : 'Ready to play' });
    document.querySelector('#detail-metadata-source').textContent = details.metadataSource && details.metadataSource !== 'Local library' ? `Details from ${details.metadataSource}` : 'Your library';
    document.querySelector('#detail-overview-grid').innerHTML = overviewFacts.length
      ? overviewFacts.map((fact) => `<div class="detail-overview-fact"><span>${escapeHtml(fact.label)}</span><strong>${escapeHtml(fact.value)}</strong></div>`).join('')
      : '<p class="detail-overview-loading">More details aren’t available for this edition yet.</p>';
    if (details.controllerSupport && details.controllerSupport !== 'unknown') {
      game.controls = details.controllerSupport;
    }
    renderDetailInputMethods(game, details);
    const pills = (items) => items.map((label) => `<span class="detail-pill">${escapeHtml(label)}</span>`).join('');
    document.querySelector('#detail-platforms').innerHTML = pills(platforms.length ? platforms : ['Check the Xbox listing']);
    document.querySelector('#detail-capabilities').innerHTML = pills(details.categories || []) || '<span class="detail-pill">No capability data available</span>';
    const dlcNote = document.querySelector('#detail-dlc-note');
    dlcNote.textContent = discoveryOnly ? `View available add-ons in ${game.xboxProductId ? 'Xbox' : 'Steam'}.` : details.dlcStatus === 'needs-check' ? 'Loading add-ons listed by Steam…'
      : details.dlcStatus === 'none-listed' ? 'This store listing does not list DLC.'
        : 'No DLC listing is available for this game.';
    if (!discoveryOnly && details.dlcStatus === 'needs-check') window.launcher.getOwnedDlc(game.id).then((result) => {
      if (requestToken !== state.detailRequestToken || state.detailGameId !== game.id) return;
      dlcNote.textContent = result.items?.length ? `Showing ${result.items.length}${result.total > result.items.length ? ` of ${result.total}` : ''} add-ons from Steam. “Owned” appears only when verified in your visible Steam library.` : 'No DLC listing is available for this game.';
      const dlcGrid = document.querySelector('#detail-dlc-grid');
      dlcGrid.innerHTML = (result.items || []).map((item) => `<button type="button" class="detail-dlc-item focusable${item.image ? ' has-image' : ' no-image'}" data-action="g-open-link" data-url="https://store.steampowered.com/app/${escapeHtml(item.id)}/" aria-label="${escapeHtml(item.title)}${item.owned ? ', owned' : item.price ? ', ' + escapeHtml(item.price) : ''}">${item.image ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" />` : ''}<span class="detail-dlc-copy"><strong>${escapeHtml(item.title)}</strong><small class="${item.owned ? 'dlc-owned' : 'dlc-price'}">${item.owned ? 'Owned' : escapeHtml(item.price || 'Add-on')}</small></span></button>`).join('');
      dlcGrid.querySelectorAll('.detail-dlc-item img').forEach((image) => image.addEventListener('error', () => {
        image.closest('.detail-dlc-item')?.classList.replace('has-image', 'no-image');
        image.remove();
      }, { once: true }));
    }).catch(() => { if (requestToken === state.detailRequestToken) dlcNote.textContent = 'Could not load this game’s add-on list.'; });
    refreshFocusables();
  }).catch(() => {
    if (requestToken !== state.detailRequestToken || state.detailGameId !== game.id) return;
    document.querySelector('#detail-description').textContent = `Play ${game.title} from your ${game.provider} library.`;
    document.querySelector('#detail-full-description').textContent = 'Game details are currently unavailable. Try opening this page again later.';
    document.querySelector('#detail-gallery').innerHTML = '<p>Screenshots are currently unavailable.</p>';
    document.querySelector('#detail-overview-grid').innerHTML = '<p class="detail-overview-loading">Game information is unavailable while offline.</p>';
    document.querySelector('#detail-dlc-note').textContent = 'Add-on details are currently unavailable.';
  });
}

function renderAchievements() {
  const items = state.achievementItems;
  const progressAvailable = state.achievementProgressAvailable;
  const unlockedCount = state.achievementUnlocked ?? items.filter((item) => item.unlocked === true).length;
  const totalCount = state.achievementTotal ?? items.length;
  const progress = document.querySelector('#achievement-progress');
  progress.hidden = !items.length || !progressAvailable;
  progress.querySelector('span').style.width = totalCount ? `${Math.round(unlockedCount / totalCount * 100)}%` : '0%';
  document.querySelector('#achievement-progress-label').textContent = totalCount && progressAvailable ? `${unlockedCount} / ${totalCount}` : '';
  document.querySelector('#achievement-filters').hidden = !items.length || !progressAvailable;
  document.querySelectorAll('.achievement-filter').forEach((button) => button.classList.toggle('active', button.dataset.filter === state.achievementFilter));
  const filtered = items.filter((item) => state.achievementFilter === 'all' || (state.achievementFilter === 'unlocked' ? item.unlocked === true : item.unlocked === false));
  const shown = state.achievementsExpanded ? filtered : filtered.slice(0, 12);
  document.querySelector('#detail-achievements-grid').innerHTML = shown.map((item) => {
    const status = item.unlocked === true ? 'Unlocked' : item.unlocked === false ? 'Locked' : Number.isFinite(item.rarity) ? `${item.rarity}% of players` : 'View-only catalog';
    const icon = item.unlocked === false ? item.lockedIcon || item.icon : item.icon || item.lockedIcon;
    const itemIndex = items.indexOf(item);
    return `<button type="button" class="detail-achievement focusable${item.unlocked === true ? ' unlocked' : ''}" data-action="achievement-open" data-achievement-index="${itemIndex}" aria-label="${escapeHtml(item.title)}, ${status}"><span class="achievement-art">${icon ? `<img src="${escapeHtml(icon)}" alt="" loading="lazy" decoding="async" />` : '<span class="achievement-fallback" aria-hidden="true">◇</span>'}</span><span class="achievement-copy"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.description || 'Hidden achievement')}</span><small>${escapeHtml(status)}</small></span><span class="achievement-chevron" aria-hidden="true">›</span></button>`;
  }).join('');
  document.querySelectorAll('.achievement-art img').forEach((image) => image.addEventListener('error', () => { image.parentElement.innerHTML = '<span class="achievement-fallback" aria-hidden="true">◇</span>'; }, { once: true }));
  const more = document.querySelector('#achievement-more');
  more.hidden = filtered.length <= 12;
  more.textContent = state.achievementsExpanded ? 'Show fewer' : `Show all ${filtered.length} achievements`;
  refreshFocusables();
}

function openAchievement(index) {
  const item = state.achievementItems[index];
  if (!item) return;
  const icon = item.unlocked === false ? item.lockedIcon || item.icon : item.icon || item.lockedIcon;
  const art = document.querySelector('#achievement-detail-art');
  art.innerHTML = icon ? `<img src="${escapeHtml(icon)}" alt="" />` : '<span aria-hidden="true">◇</span>';
  const image = art.querySelector('img');
  if (image) image.onerror = () => { art.innerHTML = '<span aria-hidden="true">◇</span>'; };
  document.querySelector('#achievement-detail-title').textContent = item.title;
  const achievementGame = state.games.find((game) => game.id === state.detailGameId);
  document.querySelector('#achievement-detail-game').textContent = [achievementGame?.title || 'Achievement', document.querySelector('#achievement-source-label').textContent].filter(Boolean).join(' · ');
  document.querySelector('#achievement-detail-description').textContent = item.description || 'This achievement has a hidden description.';
  const status = document.querySelector('#achievement-detail-status');
  status.textContent = item.unlocked === true ? '✓ Unlocked' : item.unlocked === false ? 'Locked · Keep playing' : Number.isFinite(item.rarity) ? `${item.rarity}% of Steam players unlocked this · Your progress is not linked` : 'Catalog entry · Your progress is not linked';
  status.classList.toggle('unlocked', item.unlocked === true);
  achievementDialog.showModal();
  setFocusedElement(achievementDialog.querySelector('.primary'), { scroll: false });
}

function showOptionsPage(page) {
  document.querySelectorAll('[data-options-page]').forEach((panel) => { panel.hidden = panel.dataset.optionsPage !== page; });
  document.querySelectorAll('[data-options-tab]').forEach((tab) => {
    const active = tab.dataset.optionsTab === page;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  refreshFocusables();
}

function showGalleryImage(index) {
  if (!state.galleryImages.length) return;
  state.galleryIndex = (index + state.galleryImages.length) % state.galleryImages.length;
  const image = state.galleryImages[state.galleryIndex];
  galleryImage.src = image;
  galleryImage.alt = `${galleryTitle.textContent}, screenshot ${state.galleryIndex + 1}`;
  galleryBackdrop.style.backgroundImage = `url("${image.replaceAll('"', '%22')}")`;
  document.querySelector('#gallery-counter').textContent = `${state.galleryIndex + 1} / ${state.galleryImages.length}`;
  galleryThumbnails.querySelectorAll('.gallery-thumbnail').forEach((thumbnail, thumbnailIndex) => {
    thumbnail.classList.toggle('active', thumbnailIndex === state.galleryIndex);
    if (thumbnailIndex === state.galleryIndex) thumbnail.setAttribute('aria-current', 'true');
    else thumbnail.removeAttribute('aria-current');
  });
  galleryImage.classList.remove('gallery-image-refresh');
  void galleryImage.offsetWidth;
  galleryImage.classList.add('gallery-image-refresh');
}

function renderGalleryThumbnails() {
  // galleryThumb swaps Steam's 1920x1080 screenshots for the 600x338 variant. Without it the strip
  // downloaded and decoded a full-size JPEG per tile, which is hundreds of MB of bitmaps for a row
  // of thumbnails on a handheld.
  galleryThumbnails.innerHTML = state.galleryImages.map((image, index) => `<button class="gallery-thumbnail${index === state.galleryIndex ? ' active' : ''} focusable" type="button" data-action="gallery-select" data-gallery-index="${index}" aria-label="Show screenshot ${index + 1}"${index === state.galleryIndex ? ' aria-current="true"' : ''}><img src="${escapeHtml(galleryThumb(image))}" alt="" loading="lazy" decoding="async" /></button>`).join('');
}

function promoteRecentlyLaunchedGame(game) {
  state.games = [game, ...state.games.filter((item) => item.id !== game.id)];
  renderLibrary();
  recentRow.scrollLeft = 0;
}

async function launchSelectedGame(optionsOverride) {
  if (!state.selectedGameId || !launchOverlay.hidden) return;
  const game = state.games.find((item) => item.id === state.selectedGameId);
  if (!game) return;
  if (game.installed === false) {
    if (installTracking.has(game.id)) { showSteamInstallation(game); return; }
    try {
      await window.launcher.gameAction(game.id, 'download');
      if (gameOptionsDialog.open) gameOptionsDialog.close();
      if (game.provider === 'Steam') showSteamInstallation(game);
      else showToast(`Opening ${game.provider} — finish installation there, then scan your library`);
    } catch (error) { showToast(error.message || 'Could not open install options'); }
    return;
  }
  playUiSound('launch');
  if (gameOptionsDialog.open) gameOptionsDialog.close();
  const launchImage = game.artwork?.hero || game.artwork?.wide || game.artwork?.tile;
  launchArt.style.backgroundImage = launchImage
    ? `url("${launchImage.replaceAll('"', '%22')}")`
    : `radial-gradient(circle at 50% 35%, hsla(${hashHue(game.title)}, 72%, 45%, .75), transparent 48%), linear-gradient(145deg, #172632, #05080b)`;
  const launchId = game.id;
  launchGameLogo.src = game.artwork?.logo || fallbackWordmark(game.title);
  applyLogoContrast(launchGameLogo, launchGameLogo.getAttribute('src'));
  launchGameLogo.onerror = () => { launchGameLogo.src = fallbackWordmark(game.title); };
  launchGameLogo.hidden = false;
  launchingGame.hidden = true;
  if (!game.artwork?.logo) window.launcher.getGameLogo(game.id).then((logo) => {
    if (logo && state.selectedGameId === launchId && !launchOverlay.hidden) {
      launchGameLogo.src = logo;
      applyLogoContrast(launchGameLogo, logo);
      game.artwork ||= {};
      game.artwork.logo = logo;
    }
  }).catch(() => {});
  const status = document.querySelector('#launch-status');
  const via = document.querySelector('#launch-via');
  if (status) status.textContent = 'Starting';
  if (via) via.textContent = ['PC', 'Custom'].includes(game.provider) ? '' : `Launching with ${game.provider === 'Xbox PC' ? 'the Xbox app' : game.provider}`;
  launchOverlay.dataset.gameId = launchId;
  delete launchOverlay.dataset.cancelled;
  window.steamLaunchUI?.reset();
  launchOverlay.hidden = false;
  requestAnimationFrame(() => launchOverlay.classList.add('active'));
  // Still waiting after a while: say so, so it doesn't look stuck.
  delete launchOverlay.dataset.liveStatus;
  const slow = setTimeout(() => { if (status && !launchOverlay.dataset.liveStatus) status.textContent = game.provider === 'Steam' ? 'Waiting for Steam' : 'Still starting'; }, 9000);
  try {
    let prepared = await window.launcher.prepareGameLaunch(launchId);
    if (launchOverlay.dataset.cancelled) return;
    if (prepared.setupRequired) {
      const enable = await window.steamLaunchUI.choose({ title: 'Enable Steam launch controls', body: 'Steam needs a one-time restart to show launch modes and first-time setup here. Finish any running Steam game before continuing.', options: [{ value: 'enable', label: 'Enable and restart Steam' }, { value: null, label: 'Cancel' }] });
      if (enable !== 'enable' || launchOverlay.dataset.cancelled) return;
      const result = await window.launcher.setSteamDownloadControls(true);
      if (launchOverlay.dataset.cancelled) return;
      if (!result.restarted) throw new Error('Close your running Steam game, then restart Steam to enable launch controls.');
      prepared = await window.launcher.prepareGameLaunch(launchId);
    }
    if (launchOverlay.dataset.cancelled) return;
    let launchIndex = prepared.choices?.[0]?.index;
    if (prepared.choices?.length > 1) {
      launchIndex = await window.steamLaunchUI.choose({ title: 'What would you like to launch?', body: game.title, options: [...prepared.choices.map(choice => ({ value: choice.index, label: choice.label })), { value: null, label: 'Cancel' }] });
      if (launchIndex == null) return;
    }
    if (launchOverlay.dataset.cancelled) return;
    await Promise.all([
      (rememberLaunch(launchId), window.launcher.launchGame(launchId, optionsOverride, launchIndex)),
      new Promise((resolve) => setTimeout(resolve, 1200))
    ]);
    game.playCount = (game.playCount || 0) + 1;
    promoteRecentlyLaunchedGame(game);
    // Stay on the launch screen until the game is actually running (or the player backs out).
    const result = await window.launcher.waitGameStarted(launchId, 90000);
    await refreshActiveGameSession();
    if (result.exited) showToast(`${game.title} closed before it opened a window`);
    else if (!result.started && !result.cancelled && !result.handoff) showToast(`${game.title} is taking a while to start`);
    // Say what cancelling really did, not just that the screen went away.
    if (result.cancelled) {
      showToast(result.stillRunning ? `${game.title} had already started and could not be closed. Close it from its own window.`
        : result.method === 'unsupported' ? 'Launch cancelled. This launcher cannot be stopped from here, so close it yourself if it opened.'
        : result.wasRunning ? `${game.title} was closed` : 'Launch cancelled');
    }
  } catch (error) {
    showToast(error.message || 'Could not launch this game');
  } finally {
    clearTimeout(slow);
    window.steamLaunchUI?.reset();
    delete launchOverlay.dataset.gameId;
    launchOverlay.classList.remove('active');
    setTimeout(() => { launchOverlay.hidden = true; }, 380);
  }
  // Stay underneath the game. Minimizing on a timer exposed the desktop while
  // Steam or another storefront was still preparing its game window.
}

function openGameOptions(gameId = state.selectedGameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  state.optionsGameId = game.id;
  const hasSteamActions = game.provider === 'Steam' && Boolean(game.appId);
  const activeCard = document.activeElement?.classList.contains('game-card') && document.activeElement.dataset.gameId === game.id
    ? document.activeElement
    : null;
  if (!game.isApp) selectGame(game.id, false, activeCard);
  document.querySelector('#options-title').textContent = game.title;
  document.querySelector('#options-provider').textContent = game.provider.toUpperCase();
  document.querySelector('#options-status').textContent = `${game.isApp ? 'App' : 'Game'} · ${game.installed === false ? 'Not installed' : 'Ready to launch'}`;
  document.querySelector('#options-manage-subtitle').textContent = game.isCustom ? 'Edit this imported title or open its folder' : `Shortcuts for ${game.provider}`;
  const optionsArtwork = document.querySelector('#options-artwork');
  const optionsArtworkPlaceholder = document.querySelector('#options-artwork-placeholder');
  const artworkUrl = (game.isXboxLauncher ? 'assets/xbox.svg' : game.launcherIcon) || game.artwork?.tile || game.artwork?.grid || game.artwork?.hero || '';
  optionsArtworkPlaceholder.textContent = game.title.toUpperCase();
  optionsArtwork.onerror = () => { optionsArtwork.hidden = true; optionsArtworkPlaceholder.hidden = false; };
  optionsArtwork.hidden = !artworkUrl;
  optionsArtworkPlaceholder.hidden = Boolean(artworkUrl);
  if (artworkUrl) optionsArtwork.src = artworkUrl;
  else optionsArtwork.removeAttribute('src');
  const sourceNames = { 'playstation-store': 'PlayStation Store', ign: 'IGN', 'xbox-catalog': 'Xbox Store', 'steamgriddb-square': 'SteamGridDB square', 'steamgriddb-fallback': 'SteamGridDB fallback', 'steamgriddb-manual': 'Custom artwork' };
  document.querySelector('#options-art-source').textContent = `Cover source: ${sourceNames[game.artwork?.imageSource] || 'No artwork found yet'}`;
  document.querySelector('#steam-management-group').hidden = !hasSteamActions;
  document.querySelector('#view-steam-button').hidden = !hasSteamActions;
  document.querySelector('#view-steam-library-button').hidden = !hasSteamActions;
  document.querySelector('#download-steam-button').hidden = !hasSteamActions || game.installed !== false;
  document.querySelector('#uninstall-steam-button').hidden = !hasSteamActions || game.installed === false;
  document.querySelector('#game-options-form [data-action="options-launch"]').hidden = game.installed === false;
  const providerInstall = document.querySelector('#options-provider-install');
  providerInstall.hidden = hasSteamActions || game.installed !== false || !['Ubisoft Connect','EA app','Battle.net','Epic Games'].includes(game.provider);
  providerInstall.textContent = game.clientOnly ? `Open ${game.provider}` : `Install with ${game.provider}`;
  document.querySelector('#favorite-game-button').innerHTML = `${state.favoriteGameIds.includes(game.id) ? 'Remove from Favorites <span>★</span>' : 'Add to Favorites <span>☆</span>'}`;
  renderGameSessionAction();
  const canOpenFolder = Boolean(game.installPath || game.executable);
  document.querySelector('#open-folder-button').hidden = !canOpenFolder;
  document.querySelector('#options-manage-group').hidden = Boolean(game.isLauncher) && !canOpenFolder && !game.isCustom;
  document.querySelector('#options-manage-empty').hidden = !game.isLauncher || hasSteamActions || canOpenFolder || game.isCustom;
  document.querySelector('#steam-launch-group').hidden = !hasSteamActions || game.installed === false;
  document.querySelector('#edit-custom-button').hidden = !game.isCustom;
  const categoryButton = document.querySelector('#change-category-button');
  categoryButton.hidden = Boolean(game.isLauncher);
  categoryButton.innerHTML = `${game.isApp ? 'Move to Games' : 'Move to Apps'} <span>›</span>`;
  document.querySelector('#steam-launch-options').value = game.launchOptions || '';
  document.querySelector('#achievement-reference-editor').hidden = game.provider === 'Steam';
  document.querySelector('#achievement-reference-id').value = game.achievementReferenceAppId || '';
  document.querySelector('#achievement-links-group').open = false;
  document.querySelector('#achievement-links-group').hidden = Boolean(game.isApp);
  document.querySelector('#options-tab-advanced').hidden = Boolean(game.isApp) && !hasSteamActions;
  showOptionsPage('manage');
  playUiSound('confirm');
  gameOptionsDialog.showModal();
  setTimeout(() => setFocusedElement(gameOptionsDialog.querySelector('.option-button:not([hidden])')), 0);
}

async function openArtworkPicker(gameId = state.selectedGameId) {
  const game = state.games.find((item) => item.id === gameId);
  if (!game) return;
  state.artworkGameId = game.id;
  state.artworkChoice = null;
  state.artworkSearch = null;
  state.artworkDraft = { ...(game.artwork || {}) };
  state.artworkSlot = 'tile';
  state.artworkSource = 'community';
  state.officialArtworkRequest = (state.officialArtworkRequest || 0) + 1;
  state.officialArtwork = [];
  state.catalogArtwork = [];
  document.querySelector('#artwork-steam-id').value = game.provider === 'Steam' ? game.appId || '' : '';
  document.querySelector('#official-steam-controls').open = false;
  artworkQuery.value = game.title;
  document.querySelector('#overlay-logo-toggle').checked = game.artwork?.overlayLogo === true;
  artworkResults.innerHTML = '';
  artworkGames.innerHTML = '';
  artworkStatus.textContent = 'Checking the Xbox Store…';
  useArtwork.disabled = false;
  renderArtworkSlot();
  if (gameOptionsDialog.open) gameOptionsDialog.close();
  artworkDialog.showModal();
  // Same order as automatic artwork: Xbox first, then IGN, PlayStation and SteamGridDB.
  const xboxSource = document.querySelector('[data-action="artwork-source"][data-source="xbox"]');
  if (xboxSource) await performAction('artwork-source', xboxSource); else await runArtworkSearch();
}

function artworkChoicesForSlot() {
  if (state.artworkSource === 'steam') return (state.officialArtwork || []).filter(asset => asset.slot === state.artworkSlot);
  if (['xbox', 'psn', 'ign'].includes(state.artworkSource)) return (state.catalogArtwork || []).filter(asset => asset.slot === state.artworkSlot);
  const result = state.artworkSearch || {};
  if (state.artworkSlot === 'hero') return result.heroChoices || [];
  if (state.artworkSlot === 'logo') return result.logoChoices || [];
  if (state.artworkSlot === 'wide') return (result.choices || []).filter((choice) => choice.width > choice.height * 1.4).concat(result.heroChoices || []);
  return result.choices || [];
}

function renderArtworkSlot() {
  document.querySelector('#official-steam-controls').hidden = state.artworkSource !== 'steam';
  document.querySelector('.artwork-logo-toggle').hidden = state.artworkSlot !== 'tile';
  artworkGames.hidden = state.artworkSource !== 'community';
  document.querySelectorAll('[data-action="artwork-source"]').forEach(button => {
    const active = button.dataset.source === state.artworkSource;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  artworkResults.dataset.slot = state.artworkSlot;
  document.querySelectorAll('.artwork-slot').forEach((button) => button.classList.toggle('active', button.dataset.slot === state.artworkSlot));
  const current = state.artworkDraft?.[state.artworkSlot];
  document.querySelector('#artwork-current').innerHTML = current
    ? `<img src="${escapeHtml(current)}" alt="" /> Current ${escapeHtml(state.artworkSlot)} artwork`
    : `No ${escapeHtml(state.artworkSlot)} artwork selected yet`;
  const choices = artworkChoicesForSlot();
  artworkResults.innerHTML = choices.map((choice, index) => `<button class="artwork-choice focusable${choice.url === current ? ' selected' : ''}" type="button" data-action="select-artwork" data-art-index="${index}" title="${choice.width} × ${choice.height}"><img src="${escapeHtml(choice.url)}" alt="${escapeHtml(state.artworkSlot)} artwork ${index + 1}" /></button>`).join('');
  const sourceName = { steam: 'Official Steam assets', xbox: 'Xbox Store', psn: 'PlayStation Store', ign: 'IGN' }[state.artworkSource] || state.artworkSearch?.game?.name || 'SteamGridDB';
  artworkStatus.textContent = `${choices.length} ${state.artworkSlot} choices · ${sourceName}. Choose an image, then save all artwork.`;
  refreshFocusables();
}

async function runArtworkSearch(gameId = '') {
  const query = artworkQuery.value.trim();
  if (!query) return;
  const request = state.artworkSearchRequest = (state.artworkSearchRequest || 0) + 1;
  artworkStatus.textContent = 'Searching SteamGridDB…';
  artworkGames.innerHTML = '';
  try {
    const result = await window.launcher.searchArtwork(query, gameId);
    if (request !== state.artworkSearchRequest || !artworkDialog.open) return;
    state.artworkSearch = result;
    artworkGames.innerHTML = (result.games || []).map((game) => `<button class="artwork-game-choice focusable${String(result.game?.id) === String(game.id) ? ' active' : ''}" type="button" role="listitem" data-action="select-artwork-game" data-sgdb-game-id="${escapeHtml(game.id)}" title="Match score ${game.matchScore}%">${escapeHtml(game.name)}</button>`).join('');
    renderArtworkSlot();
  } catch (error) {
    artworkStatus.textContent = error.message || 'Artwork search failed.';
  }
}

async function loadCatalogArtwork() {
  const query = artworkQuery.value.trim();
  const source = state.artworkSource;
  if (!query || !['xbox', 'psn', 'ign'].includes(source)) return;
  const request = state.catalogArtworkRequest = (state.catalogArtworkRequest || 0) + 1;
  state.catalogArtwork = [];
  renderArtworkSlot();
  artworkStatus.textContent = `Checking ${source === 'psn' ? 'PlayStation Store' : source === 'xbox' ? 'Xbox Store' : 'IGN'} artwork…`;
  try {
    const choices = await window.launcher.getCatalogArtwork(query, source);
    if (request !== state.catalogArtworkRequest || state.artworkSource !== source || !artworkDialog.open) return;
    state.catalogArtwork = choices;
    renderArtworkSlot();
    if (!choices.length) artworkStatus.textContent = 'No confident artwork match found for this name. Try another search or source.';
  } catch (error) { if (request === state.catalogArtworkRequest) artworkStatus.textContent = error.message || 'Artwork source unavailable.'; }
}

async function saveArtworkChoice() {
  if (!state.artworkGameId || !state.artworkDraft) return;
  const result = state.artworkSearch;
  try {
    await window.launcher.saveArtwork(state.artworkGameId, {
      ...state.artworkDraft,
      overlayLogo: document.querySelector('#overlay-logo-toggle').checked,
      sgdbGameId: result?.game?.id || state.artworkDraft.sgdbGameId
    });
    artworkDialog.close();
    await scanLibrary(false);
    showToast('Artwork updated');
  } catch (error) {
    showToast(error.message || 'Could not save artwork');
  }
}

function openCustomGameEditor(game) {
  if (!game) return;
  state.customDraft = { ...game };
  state.customArtworkSearch = null;
  state.customArtworkChoice = null;
  document.querySelector('#custom-game-heading').textContent = game.isCustom && state.games.some((item) => item.id === game.id) ? 'Edit custom game' : 'Import custom game';
  document.querySelector('#custom-game-path').textContent = game.executable;
  customGameName.value = game.title;
  document.querySelector('#custom-game-type').value = game.isApp ? 'app' : 'game';
  customArtworkQueryLabel.textContent = `Searching for “${game.title}”`;
  customArtworkGames.innerHTML = '';
  customArtworkResults.innerHTML = '';
  customArtworkStatus.textContent = 'Choose a matching game and cover. Your name stays as typed, and the artwork saves with the import.';
  if (gameOptionsDialog.open) gameOptionsDialog.close();
  if (settingsDialog.open) settingsDialog.close();
  customGameDialog.showModal();
  setTimeout(() => setFocusedElement(customGameName), 0);
  runCustomArtworkSearch();
}

async function runCustomArtworkSearch(sgdbGameId = '') {
  const query = customGameName.value.trim();
  if (!query || !customGameDialog.open) return;
  const sequence = ++customArtworkSearchSequence;
  customArtworkQueryLabel.textContent = `Artwork for “${query}”`;
  customArtworkStatus.textContent = 'Searching SteamGridDB…';
  try {
    const result = await window.launcher.searchArtwork(query, sgdbGameId);
    if (!customGameDialog.open || sequence !== customArtworkSearchSequence || query !== customGameName.value.trim()) return;
    state.customArtworkSearch = result;
    state.customArtworkChoice = null;
    customArtworkGames.innerHTML = (result.games || []).map((game) => `<button class="artwork-game-choice focusable${String(result.game?.id) === String(game.id) ? ' active' : ''}" type="button" data-action="select-custom-artwork-game" data-sgdb-game-id="${escapeHtml(game.id)}">${escapeHtml(game.name)}</button>`).join('');
    customArtworkResults.innerHTML = (result.choices || []).map((choice, index) => `<button class="artwork-choice focusable" type="button" data-action="select-custom-artwork" data-art-index="${index}" title="${choice.width} × ${choice.height}"><img src="${escapeHtml(choice.url)}" alt="Artwork option ${index + 1}" /></button>`).join('');
    const firstSquare = result.choices?.findIndex((choice) => choice.tileIsSquare) ?? -1;
    const selectedIndex = firstSquare >= 0 ? firstSquare : result.choices?.length ? 0 : -1;
    if (selectedIndex >= 0) {
      state.customArtworkChoice = result.choices[selectedIndex];
      customArtworkResults.children[selectedIndex]?.classList.add('selected');
    }
    customArtworkStatus.textContent = result.game
      ? `${result.game.name} · ${result.choices?.length || 0} artwork choices. The selected image will be saved with this game.`
      : 'No matches found. Try another name or save the game without artwork.';
    refreshFocusables();
  } catch (error) { customArtworkStatus.textContent = error.message || 'Artwork search failed. You can still save the game.'; }
}

async function scanLibrary(refreshArt = false, fullScreenImport = false, backgroundRefresh = false) {
  state.backgroundLibraryRefresh = backgroundRefresh;
  heroSubtitle.textContent = refreshArt ? 'Refreshing your game artwork…' : 'Scanning Steam and Epic Games…';
  scanProgress.classList.toggle('background-refresh', backgroundRefresh);
  showActivity(backgroundRefresh ? 'Updating your library' : 'Importing your library', 'Starting library discovery…', 0);
  state.fullScreenImport = Boolean(fullScreenImport);
  if (state.fullScreenImport) {
    importingScreen.hidden = false;
    importingScreen.setAttribute('aria-hidden', 'false');
    document.querySelector('#importing-message').textContent = 'Finding the games on this PC…';
    document.querySelector('#importing-percent').textContent = '0%';
    document.querySelector('#importing-fill').style.width = '0%';
    requestAnimationFrame(() => importingScreen.classList.add('visible'));
  }
  state.libraryInitialShown = false;
  try {
    const result = await window.launcher.scanLibrary({ refreshArt });
    const quiet = backgroundRefresh || state.libraryInitialShown;
    applyLibraryResult(result, quiet);
    if (!quiet && getConnectedControllers().length && !document.querySelector('dialog[open]')) {
      const target = [...document.querySelectorAll('.game-card.focusable')].find((element) => element.dataset.gameId === state.selectedGameId && element.offsetParent !== null)
        || (state.view === 'library' ? libraryGrid.querySelector('.game-card.focusable') : recentRow.querySelector('.game-card.focusable'));
      if (target) setFocusedElement(target);
    }
    if (!quiet) showToast(`${state.games.length} library item${state.games.length === 1 ? '' : 's'} ready`);
    if (state.fullScreenImport) {
      importingScreen.classList.remove('visible');
      setTimeout(() => { importingScreen.hidden = true; importingScreen.setAttribute('aria-hidden', 'true'); state.fullScreenImport = false; }, 520);
    }
  } catch (error) {
    showToast(error.message || 'Could not scan your library');
    showActivity('Library update failed', error.message || 'Could not scan your library. Try again when ready.', null, 9000, 'error');
    if (state.fullScreenImport) {
      importingScreen.classList.remove('visible');
      setTimeout(() => { importingScreen.hidden = true; importingScreen.setAttribute('aria-hidden', 'true'); state.fullScreenImport = false; }, 520);
    }
  } finally {
    state.backgroundLibraryRefresh = false;
  }
}

function applyPersonalization(settings) {
  // Garrison is sized in viewport units, so scale is applied through --g-scale rather than browser zoom. 100% is a touch smaller than the reference capture.
  if (settings.uiScale) document.body.style.setProperty('--g-scale', String(0.9 * Math.max(0.65, Math.min(1.5, Number(settings.uiScale) || 1))));
  document.documentElement.style.setProperty('--tile-radius', `${Number(settings.tileRadius ?? 8)}px`);
  document.documentElement.style.setProperty('--text-scale', String(Math.max(1, Math.min(1.3, Number(settings.textScale) || 1))));
  document.documentElement.classList.toggle('high-contrast-focus', Boolean(settings.highContrastFocus));
  document.documentElement.classList.toggle('reduce-motion', Boolean(settings.reducedMotion));
}

async function openSettings() {
  const settings = await window.launcher.getSettings();
  const previewGame = state.games.find((game) => game.id === state.selectedGameId) || state.games[0];
  const previewTile = document.querySelector('#appearance-preview-tile');
  const previewUrl = previewGame?.artwork?.tile;
  previewTile.style.backgroundImage = previewUrl ? `linear-gradient(0deg,#0009,transparent 58%),url("${previewUrl.replaceAll('"', '%22')}")` : '';
  document.querySelector('#appearance-preview-title').textContent = previewGame?.title || 'Your game';
  state.settingsOriginal = { uiScale: settings.uiScale || 1, tileRadius: settings.tileRadius ?? 8, reducedMotion: Boolean(settings.reducedMotion), textScale: settings.textScale || 1, highContrastFocus: Boolean(settings.highContrastFocus), steamGridDbKey: settings.steamGridDbKey || '' };
  state.settingsSaved = false;
  state.soundEffects = settings.soundEffects !== false;
  state.showUninstalledSteam = settings.showUninstalledSteam === true;
  state.showUninstalledEpic = settings.showUninstalledEpic === true;
  state.steamBannerDismissed = settings.steamBannerDismissed === true;
  document.querySelector('#sgdb-key').value = settings.steamGridDbKey || '';
  document.querySelector('#steam-api-key').value = settings.steamApiKey || '';
  document.querySelector('#steam-id64').value = settings.steamId64 || '';
  document.querySelector('#show-uninstalled-toggle').checked = settings.showUninstalledSteam === true;
  document.querySelector('#show-uninstalled-epic-toggle').checked = settings.showUninstalledEpic === true;
  document.querySelector('#legendary-path').value = settings.legendaryPath || '';
  refreshEpicHelperStatus().catch(() => {});
  refreshAccountLibraries();
  refreshSteamFamily();
  renderDuplicateSettings(settings);
  updateUninstalledRequirement('steam-api-key', 'show-uninstalled-toggle');
  renderSteamConnectionStatus();
  renderEpicConnectionStatus();
  if (state.steamLocalStatus) renderSteamLocalStatus('#settings-steam-local-status');
  else window.launcher.getSteamLocalStatus().then((status) => { state.steamLocalStatus = status; renderSteamLocalStatus('#settings-steam-local-status'); }).catch(() => {});
  document.querySelector('#fullscreen-toggle').checked = settings.fullscreen;
  const regionChoice = document.querySelector('#player-region');
  if (regionChoice) {
    const region = settings.region || 'auto';
    if (![...regionChoice.options].some(option => option.value === region)) regionChoice.add(new Option(region, region));
    regionChoice.value = region;
    state.region = region;
    regionChoice.options[0].textContent = `Automatic${settings.country ? ` · ${new Intl.DisplayNames(['en'], { type: 'region' }).of(settings.country)}` : ''}`;
  }
  document.querySelector('#sound-toggle').checked = state.soundEffects;
  document.querySelector('#startup-toggle').checked = settings.startupAnimation !== false;
  document.querySelector('#ui-scale').value = String(Math.round((settings.uiScale || 1) * 100));
  document.querySelector('#scale-value').textContent = `${Math.round((settings.uiScale || 1) * 100)}%`;
  document.querySelector('#tile-radius').value = String(settings.tileRadius ?? 8);
  document.querySelector('#radius-value').textContent = `${settings.tileRadius ?? 8} px`;
  document.querySelector('#reduced-motion-toggle').checked = Boolean(settings.reducedMotion);
  document.querySelector('#text-size').value = String(Math.round((settings.textScale || 1) * 100));
  document.querySelector('#text-size-value').textContent = `${Math.round((settings.textScale || 1) * 100)}%`;
  document.querySelector('#high-contrast-focus-toggle').checked = Boolean(settings.highContrastFocus);
  document.querySelector('#random-screenshot-background-toggle').checked = settings.useRandomScreenshotBackground !== false;
  state.useRandomScreenshotBackground = false; // Xbox keeps the game's own hero art behind its page.
  document.querySelector('#shuffle-home-screenshots-toggle').checked = settings.shuffleHomeScreenshots !== false;
  state.shuffleHomeScreenshots = false;
  settingsDialog.showModal();
  // Account toggles load asynchronously; snapshot again once they settle unless the player has edited them.
  state.settingsTouched = false;
  state.settingsOriginal.libraryKey = librarySettingsKey();
  setTimeout(() => { if (!state.settingsTouched) state.settingsOriginal.libraryKey = librarySettingsKey(); }, 1500);
  renderSettingsLauncherSummary();
  showSettingsPage('experience');
  setTimeout(() => setFocusedElement(document.querySelector('.settings-tab.active'), { scroll: false }), 0);
}

function showView(view, { restore = null } = {}) {
  if (state.view === 'detail' && view !== 'detail') { state.detailRequestToken++; state.newsRequestToken++; }
  document.body.dataset.pageDirection = restore ? 'back' : 'forward';
  state.view = view;
  const isLibrary = view === 'library';
  const isDetail = view === 'detail';
  const isStore = view === 'store';
  document.body.classList.toggle('detail-active', isDetail);
  document.body.classList.toggle('home-active', view === 'home');
  document.querySelector('main').hidden = state.games.length === 0 && !isLibrary && !isDetail && !isStore;
  const hasHomeGames = state.games.some((game) => !game.isApp && (game.installed !== false || state.searchQuery));
  emptyState.hidden = isLibrary || isDetail || isStore || hasHomeGames;
  document.body.classList.toggle('library-active', isLibrary);
  document.body.classList.toggle('store-active', isStore);
  homeView.hidden = isLibrary || isDetail || isStore;
  libraryView.hidden = !isLibrary;
  gameDetailView.hidden = !isDetail;
  document.querySelector('#store-view').hidden = !isStore;
  if (view === 'home' || isStore) trimHiddenLibraryPages();
  // Hidden pages are rebuilt once, on entry, before choosing controller focus.
  if (isLibrary && !state.libraryRemote && state.libraryViewDirty) renderLibraryView();
  else if (view === 'home' && state.homeLibraryDirty) renderHomeLibrary();
  if (view === 'home') window.renderFriendsActivity?.();
  if (state.view !== view) return;
  document.querySelectorAll('.top-nav-button').forEach((button) => button.classList.toggle('active', button.dataset.action === view));
  const mainScroller = document.querySelector('main');
  mainScroller.scrollTo({ top: restore?.scrollTop || 0, behavior: 'instant' });
  if (isDetail) gameDetailView.scrollTop = 0;
  updateControllerPrompts();
  refreshFocusables();
  const first = isDetail ? gameDetailView.querySelector('#detail-play')
    : isStore ? document.querySelector('#console-store-grid .focusable') || document.querySelector('.console-store-tabs .active')
    : isLibrary ? libraryView.querySelector(`.game-card[data-game-id="${CSS.escape(state.selectedGameId || '')}"]`) || libraryView.querySelector('.console-library-nav .active')
      : recentRow.querySelector(`.game-card[data-game-id="${CSS.escape(state.selectedGameId || '')}"]`) || recentRow.querySelector('.focusable');
  const restored = restore?.element?.isConnected && restore.element.offsetParent !== null ? restore.element : null;
  if (restored || first) setFocusedElement(restored || first, { scroll: !isDetail && !restore });
}

function toggleNav() {
  // The Xbox/Guide button belongs to Windows Game Bar. View opens the library.
  showView(state.view === 'library' ? 'home' : 'library');
}

function showPowerChoices() {
  selectedPowerAction = null;
  powerConfirm.hidden = true;
  powerChoices.hidden = false;
  document.querySelector('#power-error').hidden = true;
  setFocusedElement(powerChoices.querySelector('.power-choice'));
}

function showPowerConfirmation(action) {
  const choices = {
    sleep: ['Sleep this PC?', 'Your games and apps stay open. Windows may require sign-in when you return.', 'Sleep'],
    hibernate: ['Hibernate this PC?', 'Windows saves your session to disk and turns off this PC. Hibernate must be enabled in Windows.', 'Hibernate'],
    restart: ['Restart this PC?', 'Windows will close your games and apps. Save your work first.', 'Restart'],
    shutdown: ['Shut down this PC?', 'Windows will close your games and apps and turn off this PC. Save your work first.', 'Shut down'],
    exit: ['Exit the launcher?', 'The launcher will close. Windows and your other apps will keep running.', 'Exit launcher']
  };
  if (!Object.hasOwn(choices, action)) return;
  selectedPowerAction = action;
  const [title, copy, label] = choices[action];
  document.querySelector('#power-confirm-title').textContent = title;
  document.querySelector('#power-confirm-copy').textContent = copy;
  document.querySelector('#power-confirm-button').textContent = label;
  document.querySelector('#power-error').hidden = true;
  powerChoices.hidden = true;
  powerConfirm.hidden = false;
  setFocusedElement(powerConfirm.querySelector('[data-action="power-back"]'));
}

async function performAction(action, source) {
  if (action.startsWith('g-') && await garrisonAction(action, source)) return;
  if (action === 'steam-family-connect' || action === 'steam-family-disconnect') { await steamFamilyAction(action,source); return; }
  if (action === 'collection-open') { openCollection(source); return; }
  if (action === 'collection-store') { consoleStoreTab = source.dataset.chart; await openConsoleStore(); return; }
  if (['detail-tab', 'install-close', 'install-steam', 'install-play'].includes(action) && await refinementAction(action, source)) return;
  if (['select-game', 'library', 'home', 'dashboard-store', 'dashboard-gamepass', 'dashboard-customize', 'settings', 'avatar-picker', 'controller-status', 'power-menu', 'toggle-nav'].includes(action)) playUiSound('confirm');
  if ((/^(dashboard-|console-)/.test(action) || action === 'gamepass-game') && await consoleAction(action, source)) return;
  if (action === 'toggle-favorite') {
    try {
      const organized = await window.launcher.organizeLibrary('favorite', { gameId: state.optionsGameId });
      state.favoriteGameIds = organized.favoriteGameIds;
      state.customCollections = organized.customCollections;
      document.querySelector('#favorite-game-button').innerHTML = `${state.favoriteGameIds.includes(state.optionsGameId) ? 'Remove from Favorites <span>★</span>' : 'Add to Favorites <span>☆</span>'}`;
      renderLibrary();
      showToast(state.favoriteGameIds.includes(state.optionsGameId) ? 'Added to Favorites' : 'Removed from Favorites');
    } catch (error) { showToast(error.message || 'Could not update Favorites'); }
    return;
  }
  if (action === 'edit-game-collections') {
    gameOptionsDialog.close();
    renderCollectionsDialog();
    collectionsDialog.showModal();
    setTimeout(() => setFocusedElement(collectionsDialog.querySelector('.collection-member') || document.querySelector('#collection-name')), 0);
    return;
  }
  if (action === 'collections-close') { collectionsDialog.close(); return; }
  if (action === 'collection-membership' || action === 'collection-delete') {
    try {
      const collection = state.customCollections.find((item) => item.id === source.dataset.collectionId);
      if (action === 'collection-delete' && source.dataset.confirm !== 'true') {
        source.dataset.confirm = 'true';
        source.textContent = 'Delete?';
        source.setAttribute('aria-label', `Confirm deletion of ${collection?.name || 'collection'}`);
        return;
      }
      const result = await window.launcher.organizeLibrary(action === 'collection-delete' ? 'delete' : 'membership', { collectionId: source.dataset.collectionId, gameId: state.optionsGameId });
      state.favoriteGameIds = result.favoriteGameIds;
      state.customCollections = result.customCollections;
      renderCollectionsDialog();
      renderLibrary();
      showToast(action === 'collection-delete' ? 'Collection deleted' : 'Collection updated');
    } catch (error) { showToast(error.message || 'Could not update collection'); }
    return;
  }
  if (action === 'return-to-game') {
    if (gameOptionsDialog.open) gameOptionsDialog.close();
    try { await window.launcher.returnToGame(state.activeGameSession?.gameId); }
    catch (error) { showToast(error.message || 'Could not return to that game'); await refreshActiveGameSession(); }
    return;
  }
  if (action === 'power-menu') { powerDialog.showModal(); showPowerChoices(); return; }
  if (action === 'power-close') { powerDialog.close(); return; }
  if (action === 'power-select') { showPowerConfirmation(source.dataset.power); return; }
  if (action === 'power-back') { showPowerChoices(); return; }
  if (action === 'power-confirm') {
    if (!selectedPowerAction || powerActionPending) return;
    powerActionPending = true;
    const confirmButton = document.querySelector('#power-confirm-button');
    confirmButton.disabled = true;
    try {
      if (selectedPowerAction === 'exit') await window.launcher.quit();
      else await window.launcher.powerAction(selectedPowerAction);
      powerDialog.close();
      showToast('Power action sent to Windows');
    } catch (error) {
      const errorMessage = document.querySelector('#power-error');
      errorMessage.textContent = error.message || 'Windows could not complete this power action.';
      errorMessage.hidden = false;
    } finally {
      powerActionPending = false;
      confirmButton.disabled = false;
    }
    return;
  }
  if (action === 'controller-status') { openControllerStatus(); return; }
  if (action === 'controller-status-close') { controllerStatusDialog.close(); return; }
  if (action === 'controller-recheck') {
    const devices = refreshControllerStatus();
    if (devices.length) showToast('Controller connected · input is ready');
    else {
      document.querySelector('#controller-status-copy').textContent = 'Press any button on your controller to wake it. This screen will update automatically when the controller connects.';
      showToast('Waiting for controller input');
    }
    return;
  }
  if (action === 'recently-played') {
    showView('home');
    document.querySelector('#recent-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (['give-feedback', 'request-feature', 'get-help', 'game-bar-settings'].includes(action)) {
    try {
      if (action === 'game-bar-settings') await window.launcher.openGameBarSettings();
      else await window.launcher.openFeedback({ 'give-feedback':'feedback', 'request-feature':'feature', 'get-help':'help' }[action]);
    } catch { showToast('Couldn’t open that link. Please try again.'); }
    return;
  }
  if (['account-connect','account-disconnect','account-client'].includes(action)) { await accountLibraryAction(action,source); return; }
  if (action === 'avatar-picker') {
    state.profileOriginal = { avatarId: selectedAvatarId, displayName: state.displayName, avatarImage: customAvatarData };
    document.querySelector('#profile-name-input').value = state.displayName;
    document.querySelector('#profile-name-heading').textContent = state.displayName;
    prepareProfileIdentity();
    scheduleScoreRefresh();
    const games = state.games.filter((game) => !game.isApp);
    const art = games.find((game) => game.id === state.selectedGameId)?.artwork;
    const profileBackground = art?.hero || art?.wide || '';
    document.querySelector('.profile-hero').style.setProperty('--profile-art', profileBackground ? `url("${profileBackground.replaceAll('"', '%22')}")` : 'none');
    const providerCount = new Set(games.map((game) => game.provider).filter(Boolean)).size;
    document.querySelector('#profile-source-count').textContent = `${providerCount} store${providerCount === 1 ? '' : 's'}`;
    showProfilePage('overview');
    avatarDialog.showModal();
    loadSteamProfile();
    setTimeout(() => setFocusedElement(document.querySelector('.profile-tabs .active'), { scroll: false }), 0);
    return;
  }
  if (action === 'avatar-close') {
    if (state.profileOriginal) {
      selectedAvatarId = state.profileOriginal.avatarId;
      state.displayName = state.profileOriginal.displayName;
      customAvatarData = state.profileOriginal.avatarImage || '';
      renderAvatarChoices();
      state.profileOriginal = null;
    }
    avatarDialog.close();
    return;
  }
  if (action === 'profile-tab') { showProfilePage(source.dataset.page); return; }
  if (action === 'profile-game') { avatarDialog.close(); openGameDetails(source.dataset.gameId); return; }
  if (action === 'browse-collection') {
    state.collectionFilter = source.dataset.collection;
    state.libraryCategory = 'games'; state.libraryTab = 'full-library'; state.installFilter = 'installed'; state.sourceFilter = 'all';
    document.querySelector('#library-collection').value = state.collectionFilter;
    renderLibraryView();
    showView('library'); return;
  }
  if (action === 'profile-save') {
    const nameMode = document.querySelector('#profile-steam-name').checked ? 'steam' : 'custom';
    const displayName = (nameMode === 'steam' && steamPlayerIdentity?.name) || document.querySelector('#profile-name-input').value.trim().slice(0, 32) || 'Player';
    try {
      await window.launcher.saveSettings({ avatarId: selectedAvatarId, profileAvatarCustomized: selectedAvatarId !== 'steam-profile', profileNameMode: nameMode, avatarImage: selectedAvatarId === 'custom-uploaded' ? customAvatarData : '', displayName });
      state.profileNameMode = nameMode;
      state.displayName = displayName;
      state.profileOriginal = null;
      document.querySelector('#profile-button').title = displayName;
      document.querySelector('#profile-name-heading').textContent = displayName;
      renderAvatarChoices();
      avatarDialog.close();
      showToast('Player profile saved');
    } catch (error) { showToast(error.message || 'Could not save player profile'); }
    return;
  }
  if (action === 'profile-library') { avatarDialog.close(); showView('library'); return; }
  if (action === 'profile-score-sync') { await syncPlayerScore(); return; }
  if (action === 'profile-settings') { avatarDialog.close(); await openSettings(); return; }
  if (action === 'choose-custom-gamerpic') {
    const path = await openConsoleFiles('image');
    if (path) try {
      const data = await window.launcher.readGamerpic(path);
      const [header, encoded] = data.split(',');
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      await applyCustomGamerpic(new Blob([bytes], {type:header.match(/data:([^;]+)/)[1]}));
    } catch { showToast('That image could not be opened'); }
    return;
  }
  if (action === 'settings-tab') { showSettingsPage(source.dataset.settingsTab); setFocusedElement(source, { scroll: false }); return; }
  if (action === 'options-tab') { showOptionsPage(source.dataset.optionsTab); setFocusedElement(source, { scroll: false }); return; }
  if (action === 'achievement-open') { openAchievement(Number(source.dataset.achievementIndex)); return; }
  if (action === 'achievement-close') { achievementDialog.close(); return; }
  if (action === 'choose-avatar') {
    selectedAvatarId = source.dataset.avatarId;
    renderAvatarChoices();
    return;
  }
  if (action === 'onboard-next') { showOnboardingStep(state.onboardingStep + 1); return; }
  if (action === 'onboard-back') { showOnboardingStep(state.onboardingStep - 1); return; }
  if (action === 'onboard-finish') {
    try {
      const displayName = document.querySelector('#onboard-name').value.trim() || 'Player';
      const saved = await window.launcher.saveSettings({
        onboardingComplete: true,
        avatarId: selectedAvatarId,
        profileAvatarCustomized: selectedAvatarId !== 'steam-profile',
        profileNameMode: displayName === 'Player' || displayName === steamPlayerIdentity?.name ? 'steam' : 'custom',
        avatarImage: selectedAvatarId === 'custom-uploaded' ? customAvatarData : '',
        displayName,
        steamGridDbKey: document.querySelector('#onboard-sgdb-key').value.trim(),
        steamApiKey: document.querySelector('#onboard-steam-key').value.trim(),
        steamId64: document.querySelector('#onboard-steam-id').value.trim(),
        showUninstalledSteam: document.querySelector('#onboard-uninstalled').checked && Boolean(document.querySelector('#onboard-steam-key').value.trim())
      });
      state.showUninstalledSteam = saved.showUninstalledSteam;
      state.displayName = displayName;
      document.querySelector('#profile-button').title = displayName;
      onboardingDialog.close();
      await scanLibrary(false, true);
    } catch (error) { showToast(error.message || 'Could not save setup'); }
    return;
  }
  if (action === 'cancel-custom') { customGameDialog.close(); return; }
  if (action === 'console-search-close') { document.querySelector('#console-search-dialog').close(); return; }
  if (action === 'console-search-game') {
    const returnTo = consoleSearchReturn;
    document.querySelector('#console-search-dialog').close();
    if (state.games.find(game => game.id === source.dataset.gameId)?.isApp) openGameOptions(source.dataset.gameId);
    else {
      openGameDetails(source.dataset.gameId);
      state.detailReturn = { ...returnTo, searchGameId: source.dataset.gameId };
    }
    return;
  }
  if (action === 'toggle-search') {
    openConsoleSearch();
    return;
  }
  if (action === 'toggle-nav') {
    toggleNav();
    return;
  }
  if (action === 'select-game') {
    selectGame(source.dataset.gameId, false, source);
    openGameDetails(source.dataset.gameId);
    return;
  }
  if (action === 'select-app') { openGameOptions(source.dataset.gameId); return; }
  if (action === 'play-selected') {
    openGameDetails(state.selectedGameId);
    return;
  }
  if (action === 'detail-play') {
    const xboxGame = state.gamePassCatalog?.find(game => game.id === state.detailGameId);
    if (xboxGame) { await window.launcher.openCatalogGame(xboxGame.xboxProductId); return; }
    if (source.dataset.returnGame === 'true') { await performAction('return-to-game', source); return; }
    const discovery = Object.values(state.steamDiscovery).filter(Array.isArray).flat().find(item => item.id === state.detailGameId);
    if (discovery) { await openSteamShop(discovery.appId); return; }
    state.selectedGameId = state.detailGameId; await launchSelectedGame(); return;
  }
  if (action === 'discovery-game') { openGameDetails(source.dataset.gameId); return; }
  if (action === 'detail-options') { openGameOptions(state.detailGameId); return; }
  if (action === 'detail-description-more') {
    const description = document.querySelector('#detail-full-description');
    const clamped = description.classList.toggle('clamped');
    source.textContent = clamped ? 'View more' : 'View less';
    return;
  }
  if (action === 'detail-gallery-select') {
    const game = state.games.find((item) => item.id === state.detailGameId);
    galleryTitle.textContent = game?.title || 'Screenshots';
    state.galleryIndex = Number(source.dataset.galleryIndex) || 0;
    renderGalleryThumbnails();
    showGalleryImage(state.galleryIndex);
    galleryDialog.showModal();
    setTimeout(() => setFocusedElement(galleryDialog.querySelector('[data-action="gallery-close"]')), 0);
    return;
  }
  if (action === 'achievement-filter') {
    state.achievementFilter = source.dataset.filter;
    state.achievementsExpanded = false;
    renderAchievements();
    setFocusedElement(source);
    return;
  }
  if (action === 'achievement-more') { state.achievementsExpanded = !state.achievementsExpanded; renderAchievements(); return; }
  if (action === 'open-trueachievements') {
    try { await window.launcher.openTrueAchievements(state.detailGameId); }
    catch (error) { showToast(error.message || 'Could not open TrueAchievements'); }
    return;
  }
  if (action === 'choose-legendary') {
    try {
      const selected = await openConsoleFiles('game');
      if (selected) { document.querySelector('#legendary-path').value = selected; await refreshEpicHelperStatus(); }
    } catch (error) { showToast(error.message || 'Could not choose Legendary'); }
    return;
  }
  if (action === 'epic-helper-help') { await window.launcher.openSteamHelp('epicHelper'); return; }
  if (action === 'gallery-close') { galleryDialog.close(); return; }
  if (action === 'gallery-prev') { showGalleryImage(state.galleryIndex - 1); return; }
  if (action === 'gallery-next') { showGalleryImage(state.galleryIndex + 1); return; }
  if (action === 'gallery-select') { showGalleryImage(Number(source.dataset.galleryIndex) || 0); return; }
  if (action === 'settings') await openSettings();
  if (action === 'steam-setup') { await openSettings(); showSettingsPage('services'); }
  if (action === 'settings-open-apps') {
    settingsDialog.close();
    state.libraryCategory = 'apps';
    state.libraryTab = 'my-games';
    state.collectionFilter = 'all';
    state.installFilter = 'all';
    state.sourceFilter = 'all';
    document.querySelector('#library-collection').value = 'all';
    document.querySelector('#library-source-filter').value = 'all';
    showView('library');
    return;
  }
  if (action === 'settings-open-profile') { settingsDialog.close(); performAction('avatar-picker', source); return; }
  if (action === 'dismiss-steam-banner') {
    state.steamBannerDismissed = true;
    document.querySelector('#steam-connection-banner').hidden = true;
    window.launcher.saveSettings({ steamBannerDismissed: true }).catch(() => {});
    return;
  }
  if (action === 'clear-custom-artwork' || action === 'reset-launcher-data') {
    state.resetKind = action;
    const all = action === 'reset-launcher-data';
    document.querySelector('#reset-confirm-title').textContent = all ? 'Reset Xbox Preview UI?' : 'Clear chosen artwork?';
    document.querySelector('#reset-confirm-copy').textContent = all
      ? 'This removes your local profile, preferences, custom games and apps, saved artwork, API keys, and play history. Installed games are not deleted. This cannot be undone.'
      : 'This removes only artwork you chose manually. Automatic artwork will be fetched again. Your games and other settings stay as they are.';
    resetConfirmDialog.showModal();
    setTimeout(() => setFocusedElement(resetConfirmDialog.querySelector('[data-action="cancel-reset"]')), 0);
    return;
  }
  if (action === 'cancel-reset') { resetConfirmDialog.close(); return; }
  if (action === 'confirm-reset') {
    const kind = state.resetKind;
    resetConfirmDialog.querySelector('[data-action="confirm-reset"]').disabled = true;
    try {
      if (kind === 'reset-launcher-data') {
        await window.launcher.resetLauncherData();
        window.location.reload();
      } else if (kind === 'clear-custom-artwork') {
        const count = await window.launcher.clearCustomArtwork();
        resetConfirmDialog.close();
        settingsDialog.close();
        await scanLibrary(false);
        showToast(`${count} chosen artwork ${count === 1 ? 'entry' : 'entries'} cleared`);
      }
    } catch (error) { showToast(error.message || 'Could not reset local data'); }
    finally { resetConfirmDialog.querySelector('[data-action="confirm-reset"]').disabled = false; }
    return;
  }
  if (action === 'steam-open-privacy' || action === 'steam-open-api-key' || action === 'steam-open-client') {
    try { await window.launcher.openSteamHelp(action === 'steam-open-privacy' ? 'privacy' : action === 'steam-open-client' ? 'client' : 'apiKey'); }
    catch (error) { showToast(error.message || 'Could not open Steam help'); }
    if (action === 'steam-open-client') setTimeout(refreshSteamLocalStatus, 2500);
  }
  if (action === 'sgdb-open-api-key') {
    try { await window.launcher.openSteamHelp('sgdbApiKey'); }
    catch (error) { showToast(error.message || 'Could not open SteamGridDB'); }
    return;
  }
  if (action === 'rescan') await scanLibrary(false);
  if (action === 'add-game') {
    const path = await openConsoleFiles('game');
    const added = path ? await window.launcher.addGame(path) : null;
    if (added) openCustomGameEditor(added);
  }
  if (action === 'bulk-import') {
    try {
      const path = await openConsoleFiles('folder');
      const result = path ? await window.launcher.bulkAddGames(path) : {canceled:true};
      if (!result.canceled) {
        settingsDialog.close();
        showToast(`${result.added} games imported${result.truncated ? ' · folder scan limit reached' : ''}`);
        await scanLibrary(false);
      }
    } catch (error) { showToast(error.message || 'Folder import failed'); }
  }
  if (action === 'edit-custom') openCustomGameEditor(state.games.find((item) => item.id === state.optionsGameId));
  if (action === 'search-custom-artwork') await runCustomArtworkSearch();
  if (action === 'select-custom-artwork-game') await runCustomArtworkSearch(source.dataset.sgdbGameId);
  if (action === 'select-custom-artwork') {
    state.customArtworkChoice = state.customArtworkSearch?.choices[Number(source.dataset.artIndex)] || null;
    customArtworkResults.querySelectorAll('.artwork-choice').forEach((item) => item.classList.toggle('selected', item === source));
  }
  if (action === 'open-news') {
    const item = state.newsCache.get(state.selectedGameId)?.items?.[Number(source.dataset.newsIndex)];
    if (!item) return;
    const game = state.games.find((entry) => entry.id === state.selectedGameId);
    document.querySelector('#news-preview-art').src = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${encodeURIComponent(game.appId)}/header.jpg`;
    document.querySelector('#news-preview-title').textContent = item.title;
    document.querySelector('#news-preview-date').textContent = item.date ? new Date(item.date * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    document.querySelector('#news-preview-text').textContent = item.contents || 'No preview text is available for this update.';
    newsPreviewDialog.showModal();
    setTimeout(() => setFocusedElement(newsPreviewDialog.querySelector('.news-preview-close')), 0);
    return;
  }
  if (action === 'close-news-preview') { newsPreviewDialog.close(); return; }
  if (action === 'library') showView('library');
  if (action === 'home') showView('home');
  if (action === 'library-tab') {
    state.libraryTab = source.dataset.tab || 'my-games';
    renderLibraryView();
    refreshFocusables();
    setFocusedElement(source);
  }
  if (action === 'library-filter') {
    state.libraryCategory = source.dataset.category || 'games';
    document.querySelectorAll('.filter-chip').forEach((chip) => {
      const active = chip === source;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-selected', String(active));
    });
    renderLibraryView();
    refreshFocusables();
    setFocusedElement(source);
  }
  if (action === 'library-install-filter') {
    state.installFilter = source.dataset.installed || 'all';
    renderLibraryView();
    setFocusedElement(source);
  }
  if (action === 'options-launch') {
    state.selectedGameId = state.optionsGameId;
    const launchTarget = state.games.find((game) => game.id === state.optionsGameId);
    if (launchTarget?.isLauncher && launchTarget.title === 'Steam') {
      gameOptionsDialog.close();
      steamLaunchDialog.showModal();
      setTimeout(() => setFocusedElement(steamLaunchDialog.querySelector('[data-action="steam-launch-desktop"]')), 0);
      return;
    }
    await launchSelectedGame();
  }
  if (action === 'change-category') {
    const game = state.games.find((item) => item.id === state.optionsGameId);
    if (!game || game.isLauncher) return;
    const nextIsApp = !game.isApp;
    try {
      await window.launcher.saveGameCategory(game.id, nextIsApp);
      game.isApp = nextIsApp;
      if (nextIsApp && state.selectedGameId === game.id) state.selectedGameId = null;
      renderLibrary();
      document.querySelector('#change-category-button').innerHTML = `${nextIsApp ? 'Move to Games' : 'Move to Apps'} <span>›</span>`;
      document.querySelector('#options-status').textContent = `${nextIsApp ? 'App' : 'Game'} · ${game.installed === false ? 'Not installed' : 'Ready to launch'}`;
      refreshFocusables();
      showToast(nextIsApp ? `${game.title} moved to Apps` : `${game.title} moved to Games`);
    } catch (error) { showToast(error.message || 'Could not move this item'); }
    return;
  }
  if (action === 'steam-launch-cancel') { steamLaunchDialog.close(); return; }
  if (action === 'steam-launch-desktop') { steamLaunchDialog.close(); await launchSelectedGame(); return; }
  if (action === 'steam-launch-big-picture') {
    steamLaunchDialog.close();
    try { await window.launcher.launchSteamBigPicture(state.selectedGameId); showToast('Opening Steam Big Picture'); }
    catch (error) { showToast(error.message || 'Could not open Steam Big Picture'); }
    return;
  }
  if (action === 'download-steam' || action === 'uninstall-steam' || action === 'view-steam' || action === 'view-steam-library' || action === 'open-folder' || action === 'open-steamdb') {
    try {
      const normalizedAction = action === 'download-steam' ? 'download' : action;
      const gameId = source.dataset.gameId || state.optionsGameId;
      if(action==='view-steam') {
        const game = state.games.find(item=>item.id===gameId);
        if(game?.provider==='Steam' && game.appId) { if(gameOptionsDialog.open)gameOptionsDialog.close(); await openSteamShop(game.appId); return; }
      }
      await window.launcher.gameAction(gameId, normalizedAction);
      if (gameOptionsDialog.open) gameOptionsDialog.close();
      if (action === 'download-steam') showSteamInstallation(state.games.find(item => item.id === gameId));
      if (action === 'uninstall-steam') showToast('Steam uninstall options opened');
    } catch (error) { showToast(error.message || 'Could not complete that action'); }
  }
  if (action === 'launch-with-options') {
    const value = document.querySelector('#steam-launch-options').value.trim();
    try {
      state.selectedGameId = state.optionsGameId;
      await launchSelectedGame(value);
    } catch (error) { showToast(error.message || 'Could not launch with these options'); }
  }
  if (action === 'save-launch-options') {
    try {
      const value = document.querySelector('#steam-launch-options').value.trim();
      await window.launcher.saveGameLaunchOptions(state.optionsGameId, value);
      const game = state.games.find((item) => item.id === state.optionsGameId);
      if (game) game.launchOptions = value;
      showToast(value ? 'Default Steam launch options saved' : 'Default Steam launch options cleared');
      gameOptionsDialog.close();
    } catch (error) { showToast(error.message || 'Could not save launch options'); }
  }
  if (action === 'save-achievement-reference') {
    const gameId = state.optionsGameId;
    try {
      const appId = await window.launcher.saveAchievementReference(gameId, document.querySelector('#achievement-reference-id').value);
      const game = state.games.find((item) => item.id === gameId);
      if (game) game.achievementReferenceAppId = appId;
      gameOptionsDialog.close();
      showToast(appId ? 'Steam reference linked for metadata and view-only achievements' : 'Steam reference removed');
      if (state.view === 'detail') openGameDetails(gameId);
    } catch (error) { showToast(error.message || 'Could not save achievement reference'); }
  }
  if (action === 'change-artwork') await openArtworkPicker(state.optionsGameId);
  if (action === 'refresh-game-artwork') {
    const gameId = state.optionsGameId;
    gameOptionsDialog.close();
    showActivity('Finding artwork', 'Checking Xbox, IGN, PlayStation, then SteamGridDB…');
    try {
      const artwork = await window.launcher.refreshGameArtwork(gameId);
      const names = { 'playstation-store': 'PlayStation Store', ign: 'IGN', 'xbox-catalog': 'Xbox Store', 'steamgriddb-square': 'SteamGridDB' };
      showToast(`Cover found on ${names[artwork.imageSource] || artwork.imageSource}`);
      showActivity('Artwork updated', `Cover found on ${names[artwork.imageSource] || artwork.imageSource}.`, null, 3500);
    } catch (error) { showToast(error.message || 'Artwork refresh failed'); showActivity('Artwork unavailable', error.message || 'Could not find artwork. Your current cover is unchanged.', null, 9000, 'error'); }
  }
  if (action === 'artwork-source' || action === 'artwork-steam-load') {
    const request = state.officialArtworkRequest = (state.officialArtworkRequest || 0) + 1;
    state.artworkSource = action === 'artwork-steam-load' ? 'steam' : source.dataset.source;
    if (state.artworkSource === 'steam') state.officialArtwork = [];
    renderArtworkSlot();
    if (state.artworkSource === 'steam') {
      const gameId = state.artworkGameId;
      artworkStatus.textContent = 'Checking official Steam assets…';
      try {
        const result = await window.launcher.getOfficialSteamArtwork(gameId, document.querySelector('#artwork-steam-id').value.trim());
        if (request !== state.officialArtworkRequest || state.artworkGameId !== gameId || !artworkDialog.open) return;
        state.officialArtwork = result.assets;
        renderArtworkSlot();
      } catch (error) { if (request === state.officialArtworkRequest && artworkDialog.open) artworkStatus.textContent = error.message; }
    }
    else if (['xbox', 'psn', 'ign'].includes(state.artworkSource)) await loadCatalogArtwork();
    return;
  }
  if (action === 'artwork-slot') { state.artworkSlot = source.dataset.slot; renderArtworkSlot(); }
  if (action === 'search-artwork') {
    if (['xbox', 'psn', 'ign'].includes(state.artworkSource)) await loadCatalogArtwork();
    else if (state.artworkSource === 'steam') await performAction('artwork-steam-load', source);
    else await runArtworkSearch();
  }
  if (action === 'select-artwork-game') await runArtworkSearch(source.dataset.sgdbGameId);
  if (action === 'select-artwork') {
    const choice = artworkChoicesForSlot()[Number(source.dataset.artIndex)];
    if (!choice) return;
    state.artworkDraft[state.artworkSlot] = choice.url;
    if (state.artworkSlot === 'tile') { state.artworkDraft.tileIsSquare = Boolean(choice.tileIsSquare); state.artworkDraft.imageSource = choice.source || (state.artworkSource === 'steam' ? 'official-steam' : 'steamgriddb-manual'); }
    renderArtworkSlot();
  }
  if (action === 'use-artwork') await saveArtworkChoice();
}

document.addEventListener('click', (event) => {
  if (!launchOverlay.hidden) return;
  const target = event.target.closest('[data-action]');
  // performAction is async and some branches await IPC without their own try/catch. Without this a
  // failed call was an unhandled rejection with no toast, so the button just looked dead.
  if (target) performAction(target.dataset.action, target).catch(error => showToast(error?.message || 'That action failed.'));
});

document.addEventListener('contextmenu', (event) => {
  const card = event.target.closest('.game-card[data-game-id]');
  if (!card) return;
  event.preventDefault();
  openGameOptions(card.dataset.gameId);
});

document.addEventListener('focusin', (event) => {
  if (event.target.classList.contains('focusable') && state.focusedElement !== event.target) setFocusedElement(event.target);
});

// Ceiling for held arrow-key movement, matching the tightest gamepad repeat interval.
const KEYBOARD_MOVE_INTERVAL = 65;
let lastKeyboardMove = 0;

document.addEventListener('keydown', (event) => {
  if (!launchOverlay.hidden && !window.steamLaunchUI?.isOpen()) { event.preventDefault(); if (event.key === 'Escape' || event.key === 'Backspace') cancelLaunchWait(); return; }
  const activeModal = topmostOpenDialog();
  if (activeModal && event.key === 'Tab') {
    refreshFocusables();
    const items = state.focusables;
    if (items.length) {
      const index = items.indexOf(document.activeElement);
      const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index < 0 || index >= items.length - 1 ? 0 : index + 1);
      event.preventDefault();
      setFocusedElement(items[next], { scroll: false });
    }
    return;
  }
  const directions = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  const isTextInput = event.target instanceof HTMLInputElement && event.target.type !== 'checkbox';
  if (event.key === 'Home' && !isTextInput && !document.querySelector('dialog[open]')) { event.preventDefault(); document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (galleryDialog.open && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
    event.preventDefault();
    showGalleryImage(state.galleryIndex + (event.key === 'ArrowRight' ? 1 : -1));
    return;
  }
  if (directions[event.key] && !isTextInput) {
    event.preventDefault();
    // Holding an arrow key repeats at roughly 30/s, and one step measures every focusable in the
    // page. Key repeat is device-generated, so it needs the same ceiling the gamepad path uses.
    const now = performance.now();
    if (now - lastKeyboardMove >= KEYBOARD_MOVE_INTERVAL) { lastKeyboardMove = now; moveFocus(directions[event.key]); }
  }
  if (event.key === 'Enter' && event.target === artworkQuery) { event.preventDefault(); runArtworkSearch(); }
  if (event.key === 'Enter' && event.target === librarySearch) {
    event.preventDefault();
    const first = document.querySelector('.console-search-game');
    if (first) setFocusedElement(first);
    return;
  }
  if (event.key === 'ArrowDown' && event.target === librarySearch) { event.preventDefault(); navigateConsoleSearch('down', librarySearch); return; }
  if (event.key === 'Enter' && document.activeElement?.dataset.action) {
    event.preventDefault();
    performAction(document.activeElement.dataset.action, document.activeElement);
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    navigateBack();
  }
  if ((event.key === 'o' || event.key === 'O') && !isTextInput && !document.querySelector('dialog[open]')) openGameOptions();
});

document.querySelector('#custom-game-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.customDraft) return;
  const result = state.customArtworkSearch;
  const choice = state.customArtworkChoice;
  try {
    const saved = await window.launcher.saveCustomGame({
      id: state.customDraft.id,
      executable: state.customDraft.executable,
      title: customGameName.value.trim(),
      isApp: document.querySelector('#custom-game-type').value === 'app',
      artwork: choice ? { ...choice, logo: result.logo, hero: result.hero, sgdbGameId: result.game?.id, overlayLogo: false } : null
    });
    customGameDialog.close();
    await scanLibrary(false);
    selectGame(saved.id, false);
    showToast(`${saved.title} saved`);
  } catch (error) { showToast(error.message || 'Could not save custom game'); }
});

document.querySelector('#collection-create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const nameInput = document.querySelector('#collection-name');
  const name = nameInput.value.trim();
  if (!name) return;
  try {
    const result = await window.launcher.organizeLibrary('create', { name, gameId: state.optionsGameId });
    state.favoriteGameIds = result.favoriteGameIds;
    state.customCollections = result.customCollections;
    nameInput.value = '';
    renderCollectionsDialog();
    renderLibrary();
    showToast(`${name} created`);
    setFocusedElement(collectionsDialog.querySelector('.collection-member:last-of-type') || nameInput);
  } catch (error) { showToast(error.message || 'Could not create collection'); }
});

customGameName.addEventListener('input', () => {
  clearTimeout(customArtworkSearchTimer);
  customArtworkSearchSequence++;
  state.customArtworkSearch = null;
  state.customArtworkChoice = null;
  customArtworkGames.innerHTML = '';
  customArtworkResults.innerHTML = '';
  const query = customGameName.value.trim();
  customArtworkQueryLabel.textContent = query ? `Artwork for “${query}”` : 'Name this game to find artwork';
  customArtworkStatus.textContent = query ? 'Finding matching artwork…' : 'Enter a name to search SteamGridDB.';
  if (query) customArtworkSearchTimer = setTimeout(() => runCustomArtworkSearch(), 450);
});

// Library-affecting fields. A rescan only runs when one of these changes.
function librarySettingsKey() {
  return JSON.stringify([...['steam-api-key', 'steam-id64', 'legendary-path'].map(id => document.querySelector('#' + id).value.trim()),
    ...['show-uninstalled-toggle', 'steam-family-toggle', 'show-uninstalled-epic-toggle', 'uninstalled-ubisoft', 'uninstalled-ea', 'uninstalled-battlenet'].map(id => document.querySelector('#' + id).checked),
    duplicateSettingsPayload()]);
}
document.querySelector('#settings-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (event.submitter?.value === 'cancel') { settingsDialog.close('cancel'); return; }
  await saveSettingsForm();
});
async function saveSettingsForm({ close = true } = {}) {
  try {
    const refreshArtwork = state.settingsOriginal.steamGridDbKey !== document.querySelector('#sgdb-key').value.trim();
    const libraryChanged = state.settingsOriginal.libraryKey !== librarySettingsKey();
    await window.launcher.saveSettings({
      region: document.querySelector('#player-region').value,
      steamGridDbKey: document.querySelector('#sgdb-key').value,
      steamApiKey: document.querySelector('#steam-api-key').value,
      steamId64: document.querySelector('#steam-id64').value,
      showUninstalledSteam: document.querySelector('#show-uninstalled-toggle').checked,
      includeSteamFamily: document.querySelector('#steam-family-toggle').checked,
      ...duplicateSettingsPayload(),
      showUninstalledEpic: document.querySelector('#show-uninstalled-epic-toggle').checked,
      showUninstalledUbisoft: document.querySelector('#uninstalled-ubisoft').checked,
      showUninstalledEA: document.querySelector('#uninstalled-ea').checked,
      showUninstalledBattleNet: document.querySelector('#uninstalled-battlenet').checked,
      legendaryPath: document.querySelector('#legendary-path').value.trim(),
      fullscreen: document.querySelector('#fullscreen-toggle').checked,
      soundEffects: document.querySelector('#sound-toggle').checked,
      startupAnimation: document.querySelector('#startup-toggle').checked,
      uiScale: Number(document.querySelector('#ui-scale').value) / 100,
      tileRadius: Number(document.querySelector('#tile-radius').value),
      reducedMotion: document.querySelector('#reduced-motion-toggle').checked,
      textScale: Number(document.querySelector('#text-size').value) / 100,
      highContrastFocus: document.querySelector('#high-contrast-focus-toggle').checked,
      useRandomScreenshotBackground: document.querySelector('#random-screenshot-background-toggle').checked,
      shuffleHomeScreenshots: document.querySelector('#shuffle-home-screenshots-toggle').checked
    });
    state.settingsOriginal = { uiScale: Number(document.querySelector('#ui-scale').value) / 100, tileRadius: Number(document.querySelector('#tile-radius').value), reducedMotion: document.querySelector('#reduced-motion-toggle').checked, textScale: Number(document.querySelector('#text-size').value) / 100, highContrastFocus: document.querySelector('#high-contrast-focus-toggle').checked, steamGridDbKey: document.querySelector('#sgdb-key').value.trim(), libraryKey: librarySettingsKey() };
    state.settingsSaved = true;
    const region = document.querySelector('#player-region').value;
    if (state.region !== region) {
      state.region = region;
      state.gamePassCatalog = null;
      state.steamDiscovery = { status: 'empty', mostPlayed: [], topSellers: [], upcoming: [] };
      resetRegionViews();
    }
    state.soundEffects = document.querySelector('#sound-toggle').checked;
    state.showUninstalledSteam = document.querySelector('#show-uninstalled-toggle').checked;
    state.showUninstalledEpic = document.querySelector('#show-uninstalled-epic-toggle').checked;
    state.useRandomScreenshotBackground = false;
    state.shuffleHomeScreenshots = false;
    state.ambientKey = '';
    const selectedGame = state.games.find((game) => game.id === state.selectedGameId);
    if (selectedGame) updateAmbient(selectedGame, true);
    if (close && settingsDialog.open) settingsDialog.close();
    refreshPlayerIdentity();
    if (libraryChanged || refreshArtwork) await scanLibrary(refreshArtwork, false, true);
  } catch (error) { showToast(error.message || 'Could not save settings'); }
}
document.querySelector('#steam-api-key').addEventListener('input', () => updateUninstalledRequirement('steam-api-key', 'show-uninstalled-toggle'));
document.querySelector('#legendary-path').addEventListener('change', () => refreshEpicHelperStatus().catch(() => {}));
document.querySelector('#onboard-steam-key').addEventListener('input', () => updateUninstalledRequirement('onboard-steam-key', 'onboard-uninstalled', 'onboard-uninstalled-note'));
document.querySelector('#ui-scale').addEventListener('input', (event) => {
  document.querySelector('#scale-value').textContent = `${event.target.value}%`;
  previewPersonalization();
});
function previewPersonalization() {
  applyPersonalization({
    tileRadius: Number(document.querySelector('#tile-radius').value),
    reducedMotion: document.querySelector('#reduced-motion-toggle').checked,
    textScale: Number(document.querySelector('#text-size').value) / 100,
    highContrastFocus: document.querySelector('#high-contrast-focus-toggle').checked,
    uiScale: Number(document.querySelector('#ui-scale').value) / 100
  });
}
document.querySelector('#tile-radius').addEventListener('input', (event) => {
  document.querySelector('#radius-value').textContent = `${event.target.value} px`;
  previewPersonalization();
});
document.querySelector('#reduced-motion-toggle').addEventListener('change', previewPersonalization);
document.querySelector('#text-size').addEventListener('input', (event) => { document.querySelector('#text-size-value').textContent = `${event.target.value}%`; previewPersonalization(); });
document.querySelector('#high-contrast-focus-toggle').addEventListener('change', previewPersonalization);
document.querySelector('#profile-name-input').addEventListener('input', (event) => {
  document.querySelector('#profile-name-heading').textContent = event.target.value.trim() || 'Player';
});

async function applyCustomGamerpic(file) {
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) { showToast('Choose an image smaller than 20 MB'); return; }
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const edge = Math.min(bitmap.width, bitmap.height);
    canvas.getContext('2d', { alpha: false }).drawImage(bitmap, (bitmap.width - edge) / 2, (bitmap.height - edge) / 2, edge, edge, 0, 0, 256, 256);
    bitmap.close();
    customAvatarData = canvas.toDataURL('image/jpeg', .84);
    selectedAvatarId = 'custom-uploaded';
    renderAvatarChoices();
    showToast('Gamerpic ready — save your profile to keep it');
  } catch { showToast('That image could not be opened'); }
}
document.querySelector('#gamerpic-file-input').addEventListener('change', async (event) => {
  const file=event.target.files?.[0]; event.target.value=''; await applyCustomGamerpic(file);
});

for (const dialog of document.querySelectorAll('dialog')) {
  let opener;
  let openerView;
  dialog.addEventListener('beforetoggle', (event) => {
    if (event.newState === 'open') { opener = document.activeElement; openerView = state.view; }
  });
  dialog.addEventListener('close', () => {
    // Full screen settings save as you leave them, like the Xbox app. Cancel still discards.
    if (dialog === settingsDialog && !state.settingsSaved && document.body.classList.contains('garrison') && dialog.returnValue !== 'cancel') {
      state.settingsSaved = true;
      saveSettingsForm({ close: false });
    }
    if (dialog === settingsDialog && !state.settingsSaved) {
      window.launcher.previewScale(state.settingsOriginal.uiScale).catch(() => {});
      applyPersonalization(state.settingsOriginal);
    }
    if (dialog === avatarDialog && state.profileOriginal) {
      selectedAvatarId = state.profileOriginal.avatarId;
      state.displayName = state.profileOriginal.displayName;
      customAvatarData = state.profileOriginal.avatarImage || '';
      state.profileOriginal = null;
      renderAvatarChoices();
    }
    setTimeout(() => {
      if (state.view !== openerView) return;
      const activeDialog = topmostOpenDialog();
      if (opener?.isConnected && opener.offsetParent !== null && (!activeDialog || activeDialog.contains(opener))) {
        refreshFocusables();
        setFocusedElement(opener);
        return;
      }
      if (activeDialog) return;
      refreshFocusables();
      const target = !searchPopover.hidden ? document.querySelector('.top-nav-button[data-action="toggle-search"]') : [...document.querySelectorAll('.game-card.focusable')].find((element) => element.dataset.gameId === state.selectedGameId)
        || (state.view === 'library' ? libraryView.querySelector('.library-tab') : recentRow.querySelector('.focusable'));
      if (target) setFocusedElement(target);
    }, 0);
  });
}

librarySearch.addEventListener('input', () => {
  scheduleConsoleSearch();
});
document.querySelector('#library-collection').addEventListener('change', event => {
  state.collectionFilter = event.target.value; renderLibraryView(); refreshFocusables();
});
document.querySelector('#library-sort').addEventListener('change', (event) => {
  state.librarySort = event.target.value;
  renderLibraryView();
});
document.querySelector('#library-source-filter').addEventListener('change', (event) => {
  state.sourceFilter = event.target.value;
  renderLibraryView();
});

function focusForGamepad(gamepad) {
  if (!isUsableController(gamepad)) return;
  state.gamepadIndex = gamepad.index;
  // Returning from a game, Game Bar or the Steam session can arrive with A/B
  // still held. Consume that gesture instead of launching or backing out twice.
  state.previousButtons = gamepad.buttons.map(button => Boolean(button.pressed || button.value > .55));
  refreshControllerStatus();
  if (state.fullScreenImport) return;
  if (state.lastNotifiedGamepadIndex !== gamepad.index) showToast('Controller connected · input is ready');
  state.lastNotifiedGamepadIndex = gamepad.index;
  refreshFocusables();
  const activeDialog = topmostOpenDialog();
  const target = activeDialog?.querySelector('.focusable:not([hidden]):not(:disabled)')
    || [...document.querySelectorAll('.game-card.focusable')].find((element) => element.dataset.gameId === state.selectedGameId && element.offsetParent !== null)
    || (state.view === 'library' ? libraryGrid.querySelector('.game-card.focusable') : recentRow.querySelector('.game-card.focusable'))
    || state.focusables.find((element) => element !== librarySearch)
    || state.focusables[0];
  if (target) setFocusedElement(target);
}

function gamepadMove(direction) {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && active.type === 'range' && (direction === 'left' || direction === 'right')) {
    const step = Number(active.step) || 1;
    const delta = direction === 'right' ? step : -step;
    active.value = String(Math.max(Number(active.min), Math.min(Number(active.max), Number(active.value) + delta)));
    active.dispatchEvent(new Event('input', { bubbles: true }));
    playUiSound('navigate');
    return;
  }
  moveFocus(direction);
}

let gamepadPollTimer = null;
let gamepadIdleTimer = null, gamepadConnected = true;
function stopGamepadPoll() {
  if (gamepadPollTimer !== null) cancelAnimationFrame(gamepadPollTimer);
  if (gamepadIdleTimer !== null) clearTimeout(gamepadIdleTimer);
  gamepadPollTimer = gamepadIdleTimer = null;
}

function scheduleGamepadPoll() {
  if (gamepadPollTimer !== null || gamepadIdleTimer !== null || window.remotePlayUI?.capturesInput || document.visibilityState !== 'visible' || !document.hasFocus()) return;
  // Keyboard/touch-only sessions need no per-frame controller work. The connect
  // event wakes immediately; the slow fallback covers missed device events.
  if (!gamepadConnected) {
    gamepadIdleTimer = setTimeout(() => { gamepadIdleTimer = null; pollGamepad(); }, 250);
    return;
  }
  // Every frame, so a press lands on the next frame like a console.
  gamepadPollTimer = requestAnimationFrame(() => {
    gamepadPollTimer = null;
    pollGamepad();
  });
}

// Settings registry: PlayStation's Enter Button (✕ or ○) and Nintendo's A/B layout swap confirm and back, so
// the face button the console prints is the one that confirms. Xbox themes keep the standard layout.
function swapsConfirmBack() {
  try {
    const settings = window.gSettings;
    if (!settings) return false;
    const theme = document.body.dataset.gTheme;
    if (theme === 'ps3' || theme === 'ps4') return settings.cached('enterButton') === 'o';
    if (theme === 'wii' || theme === '3ds') return settings.cached('nintendoLayout') === true;
  } catch { /* The registry may not be ready on the first frames. */ }
  return false;
}
function pollGamepad() {
  try {
  if (document.visibilityState !== 'visible' || !document.hasFocus()) return;
  if (window.remotePlayUI?.capturesInput) { state.previousButtons = []; return; }
  const connected = getConnectedControllers();
  gamepadConnected = connected.length > 0;
  if (window.remotePlayUI?.captureControllerShortcut(connected)) { state.previousButtons = []; return; }
  if (window.remotePlayUI?.suppressHeldButtons(connected)) return;
  // Prefer whichever controller was just used. Keeping a stale first device
  // selected meant a headset/remote could silently steal all navigation.
  const gamepad = connected.find(hasRecentControllerInput)
    || connected.find((item) => item.index === state.gamepadIndex)
    || connected[0]
    || null;
  if (gamepad) {
    if (hasRecentControllerInput(gamepad)) document.body.classList.add('controller-input');
    if (state.gamepadIndex !== gamepad.index) focusForGamepad(gamepad);
    const pressed = gamepad.buttons.map((button) => Boolean(button.pressed || button.value > .55));
    const justPressed = (index) => pressed[index] && !state.previousButtons[index];
    const swapped = swapsConfirmBack();
    const confirmButton = swapped ? 1 : 0, backButton = swapped ? 0 : 1;
    if (!launchOverlay.hidden && !window.steamLaunchUI?.isOpen() && justPressed(backButton)) cancelLaunchWait();
    if (state.fullScreenImport || (!launchOverlay.hidden && !window.steamLaunchUI?.isOpen())) { state.previousButtons = pressed; return; }
    if (justPressed(confirmButton)) {
      if (document.activeElement instanceof HTMLSelectElement) openConsoleChoice(document.activeElement);
      else if (isTextEntry(document.activeElement)) openNativeKeyboard(document.activeElement);
      else { state.controllerClick = true; document.activeElement?.click(); state.controllerClick = false; }
    }
    let modalBackHandled = false;
    if (justPressed(backButton)) {
      modalBackHandled = true;
      navigateBack();
    }
    if (modalBackHandled) { state.previousButtons = pressed; return; }
    if (justPressed(9)) {
      if (gameOptionsDialog.open) gameOptionsDialog.close();
      else if (!document.querySelector('dialog[open]') && state.view !== 'store') {
        const gameId = document.activeElement?.dataset.gameId || (state.view === 'detail' ? state.detailGameId : state.selectedGameId);
        if (state.games.some(game => game.id === gameId)) openGameOptions(gameId);
      }
    }
    // X has no global action in the Xbox app; a full library scan was too easy to trigger by accident.
    if (justPressed(3) && !document.querySelector('dialog[open]') && ['home','library'].includes(state.view)) {
      state.controllerClick = true;
      try { performAction('toggle-search'); } finally { state.controllerClick = false; }
    }
    if (justPressed(8) && !document.querySelector('dialog[open]')) toggleNav();
    if (justPressed(4) && !document.querySelector('dialog[open]')) (window.gPageScroll ? window.gPageScroll(-1) : document.querySelector('main').scrollBy({ top: -window.innerHeight * .75, behavior: 'smooth' }));
    if (justPressed(5) && !document.querySelector('dialog[open]')) (window.gPageScroll ? window.gPageScroll(1) : document.querySelector('main').scrollBy({ top: window.innerHeight * .75, behavior: 'smooth' }));
    // Directions behave like a console: one move on press, then repeats after a short hold that speed up.
    // The stick uses a dead zone with hysteresis so it doesn't flicker between directions.
    const now = performance.now();
    const [x = 0, y = 0] = gamepad.axes;
    const held = state.heldDirection;
    const engage = .5, release = .32;
    const stick = Math.abs(x) >= Math.abs(y)
      ? (x <= -(held === 'left' ? release : engage) ? 'left' : x >= (held === 'right' ? release : engage) ? 'right' : '')
      : (y <= -(held === 'up' ? release : engage) ? 'up' : y >= (held === 'down' ? release : engage) ? 'down' : '');
    let hat = '';
    if (gamepad.mapping !== 'standard') {
      const [hatX = 0, hatY = 0] = gamepad.axes.slice(6, 8);
      hat = hatX < -.5 ? 'left' : hatX > .5 ? 'right' : hatY < -.5 ? 'up' : hatY > .5 ? 'down' : '';
    }
    const direction = pressed[12] ? 'up' : pressed[13] ? 'down' : pressed[14] ? 'left' : pressed[15] ? 'right' : stick || hat;
    const step = which => {
      if (galleryDialog.open && (which === 'left' || which === 'right')) showGalleryImage(state.galleryIndex + (which === 'left' ? -1 : 1));
      else gamepadMove(which);
    };
    if (!direction) state.heldDirection = '';
    else if (direction !== held) {
      state.heldDirection = direction;
      state.heldSince = now;
      state.lastRepeat = now;
      state.navRepeat = false;
      step(direction);
    } else {
      const heldFor = now - state.heldSince;
      const interval = heldFor > 1600 ? 65 : heldFor > 900 ? 85 : 110;
      if (heldFor > 380 && now - state.lastRepeat >= interval) {
        state.lastRepeat = now;
        state.navRepeat = true;
        try { step(direction); } finally { state.navRepeat = false; }
      }
    }
    state.previousButtons = pressed;
  } else if (state.gamepadIndex !== null) {
    state.gamepadIndex = null;
    state.previousButtons = [];
  }
  } catch {
    state.gamepadIndex = null;
    state.previousButtons = [];
  } finally {
    scheduleGamepadPoll();
  }
}

window.addEventListener('gamepadconnected', (event) => {
  if (isUsableController(event.gamepad)) { stopGamepadPoll(); gamepadConnected = true; focusForGamepad(event.gamepad); scheduleGamepadPoll(); }
  else refreshControllerStatus();
});

window.addEventListener('focus', () => {
  stopGamepadPoll(); gamepadConnected = true;
  state.gamepadIndex = null;
  state.previousButtons = [];
  refreshControllerStatus();
  refreshSteamLocalStatus();
  requestAnimationFrame(() => {
    const controllers = getConnectedControllers();
    const pad = controllers.find(hasRecentControllerInput) || controllers[0];
    if (pad) focusForGamepad(pad);
  });
  scheduleGamepadPoll();
});

window.addEventListener('blur', () => {
  stopGamepadPoll();
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    stopGamepadPoll();
    return;
  }
  stopGamepadPoll(); gamepadConnected = true;
  state.gamepadIndex = null;
  state.previousButtons = [];
  refreshControllerStatus();
  refreshSteamLocalStatus();
  requestAnimationFrame(() => {
    const controllers = getConnectedControllers();
    const pad = controllers.find(hasRecentControllerInput) || controllers[0];
    if (pad) focusForGamepad(pad);
  });
  scheduleGamepadPoll();
});

window.addEventListener('gamepaddisconnected', (event) => {
  const disconnectedIndex = event.gamepad?.index;
  const wasActiveController = state.gamepadIndex === disconnectedIndex || state.lastNotifiedGamepadIndex === disconnectedIndex;
  if (state.gamepadIndex === disconnectedIndex) state.gamepadIndex = null;
  if (state.lastNotifiedGamepadIndex === disconnectedIndex) {
    state.lastNotifiedGamepadIndex = null;
  }
  if (wasActiveController) showToast('Controller disconnected');
  state.previousButtons = [];
  setTimeout(refreshControllerStatus, 80);
});

// The page opens on Home before any showView() call, and showView() is what marks it. Console themes key
// their whole dashboard (and their wallpapers) on .home-active, so without this the first frame is the
// launcher's own Home with the console's background and chrome hidden: a stuck, half-drawn screen.
document.body.classList.add('home-active');

window.launcher.getSettings().then(async (settings) => {
  applyPersonalization(settings);
  document.querySelector('#fullscreen-toggle').checked = Boolean(settings.fullscreen);
  state.favoriteGameIds = Array.isArray(settings.favoriteGameIds) ? settings.favoriteGameIds : [];
  state.customCollections = Array.isArray(settings.customCollections) ? settings.customCollections : [];
  refreshActiveGameSession().catch(() => {});
  state.useRandomScreenshotBackground = false; // Xbox keeps the game's own hero art behind its page.
  state.shuffleHomeScreenshots = false;
  state.soundEffects = settings.soundEffects !== false;
  runStartupSequence(settings);
  selectedAvatarId = settings.avatarId || 'one-orbit';
  customAvatarData = settings.avatarImage || '';
  state.steamBannerDismissed = settings.steamBannerDismissed === true;
  state.displayName = settings.displayName || 'Player';
  refreshPlayerIdentity();
  scheduleScoreRefresh();
  window.launcher.getSteamLocalStatus().then((status) => {
    state.steamLocalStatus = status;
    renderSteamLocalStatus();
    renderSteamLocalStatus('#settings-steam-local-status');
  }).catch(() => { renderSteamLocalStatus(); renderSteamLocalStatus('#settings-steam-local-status'); });
  renderAvatarChoices();
  document.querySelector('#profile-button').title = state.displayName;
  if (settings.onboardingComplete) {
    const cachedLibrary = await startupLibrarySnapshot;
    if (cachedLibrary) {
      applyLibraryResult(cachedLibrary);
      // A library saved in the last 15 minutes is current enough; otherwise refresh quietly once the UI is up.
      const age = Date.now() - (Number(cachedLibrary.cachedAt) || 0);
      setTimeout(() => scanLibrary(false, false, true), age < 15 * 60 * 1000 ? 15 * 60 * 1000 - age : 4000);
    } else scanLibrary(false, true);
  }
  else {
    document.querySelector('#onboard-name').value = settings.displayName === 'Player' ? '' : settings.displayName || '';
    document.querySelector('#onboard-steam-key').value = settings.steamApiKey || '';
    document.querySelector('#onboard-sgdb-key').value = settings.steamGridDbKey || '';
    document.querySelector('#onboard-steam-id').value = settings.steamId64 || '';
    document.querySelector('#onboard-uninstalled').checked = settings.showUninstalledSteam === true;
    updateUninstalledRequirement('onboard-steam-key', 'onboard-uninstalled', 'onboard-uninstalled-note');
    showOnboardingStep(0);
    onboardingDialog.showModal();
    setTimeout(() => setFocusedElement(document.querySelector('#onboard-next'), { scroll: false }), 0);
  }
}).catch(() => { renderAvatarChoices(); scanLibrary(false); });
window.addEventListener('focus', () => refreshActiveGameSession().catch(() => {}));
scheduleGamepadPoll();
updateConnectivityActivity();
refreshControllerStatus();
settingsDialog.addEventListener('input', () => { state.settingsTouched = true; }); settingsDialog.addEventListener('change', () => { state.settingsTouched = true; });

// Gallery tiles load a small copy; the viewer opens the full image.
function galleryThumb(url) {
  const value = String(url || '');
  if (/steamstatic\.com\/.*\.1920x1080\.jpg/.test(value)) return value.replace('.1920x1080.jpg', '.600x338.jpg');
  if (/store-images\.s-microsoft\.com\//.test(value) && !/[?&]w=/.test(value)) return `${value}${value.includes('?') ? '&' : '?'}w=720`;
  return value;
}

// Sorting a large library used to read and parse localStorage for every pair
// of games. Read once, update on launch, and invalidate for other windows.
let lastLaunchHistory;
function launchHistory() {
  if (lastLaunchHistory) return lastLaunchHistory;
  try {
    const saved = JSON.parse(localStorage.getItem('lastLaunched') || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) return lastLaunchHistory = saved;
  } catch { /* Storage unavailable or invalid. */ }
  return lastLaunchHistory = {};
}
window.addEventListener('storage', event => {
  if (event.key === 'lastLaunched' || event.key === null) lastLaunchHistory = undefined;
});
// When a game was last played, from whichever launcher knows: Steam's own record or a launch from here.
function lastPlayedAt(game) {
  const launched = Number(launchHistory()[game.id]) || 0;
  return Math.max(Number(game.steamLastPlayed) || 0, Number(game.lastPlayed) || 0, launched);
}
function rememberLaunch(gameId) {
  const map = launchHistory();
  map[gameId] = Date.now();
  try {
    localStorage.setItem('lastLaunched', JSON.stringify(map));
  } catch { /* Storage unavailable. */ }
}

// B cancels pending Steam setup; completed games are never stopped here.
function cancelLaunchWait() {
  launchOverlay.dataset.cancelled = '1';
  window.steamLaunchUI?.reset();
  const gameId = launchOverlay.dataset.gameId;
  if (gameId) window.launcher.cancelGameWait(gameId).catch(() => {});
}
