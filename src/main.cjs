const { app, BrowserWindow, clipboard, dialog, ipcMain, shell, safeStorage } = require('electron');
const support = require('./support.cjs');
support.installLogCapture();
const fs = require('fs/promises');
const path = require('path');
const { fileURLToPath } = require('url');
const { spawn, execFile } = require('child_process');
const { createArtworkCache } = require('./artwork-cache.cjs');
const { createConsoleServices } = require('./console-services.cjs');
const ratings = require('./region-ratings.cjs');
const { uniqueVideos, uniqueScreenshots } = require('./renderer/media-utils.js');
const { createSteamStoreLookup } = require('./steam-store-lookup.cjs');
const { createSoundPack } = require('./sound-pack.cjs');
const { createSteamShop } = require('./steam-shop.cjs');
const { createSteamLaunch } = require('./steam-launch.cjs');
const { createStoreOffers } = require('./store-offers.cjs');
const { createPlayerProfile, profileMode, defaultAvatarId } = require('./player-profile.cjs');
const { createAccountLibraries } = require('./account-libraries.cjs');
const { scanLocalPublishers, mergePublisherGames } = require('./launcher-libraries.cjs');
const { readGogOwned, readAmazonOwned } = require('./local-owned-libraries.cjs');
const { normalizeTitle, titleMatchScore, titleNeedsRecheck } = require('./title-match.cjs');
const { libraryKey, installLibrariesByDrive } = require('./steam-install-libraries.cjs');
const { createInstallSizeLookup } = require('./steam-install-size.cjs');
const { storageOverview } = require('./storage-overview.cjs');
const { createRemotePlay } = require('./remote-play.cjs');
const { createRemoteArtwork } = require('./remote-artwork.cjs');
const { readSteamLocalLibrary, manifestProgress, applySteamLocalData, contentLogProgress, clientDownloadProgress, clientDownloadItems, parseVdf: parseSteamVdf } = require('./steam-local.cjs');
const { createUpdater } = require('./updater.cjs');
const { createSteamFamilyLibrary } = require('./steam-family.cjs');
const { duplicateGroups, providers: duplicateProviders } = require('./library-duplicates.cjs');
const storeOffers = createStoreOffers();
const { runPowerAction } = require('./power-actions.cjs');
const { createNativeKeyboard } = require('./native-keyboard.cjs');
const showNativeKeyboard = createNativeKeyboard({ demo: process.env.NEBULA_DEMO === '1' });
const { parseSteamCommunityAchievements, safeSteamIcon } = require('./steam-public-achievements.cjs');

if (process.env.NEBULA_DEMO === '1') {
  app.setPath('userData', process.env.NEBULA_DEMO_USER_DATA || path.join(app.getPath('temp'), 'xbox-preview-ui-demo'));
  if (process.env.NEBULA_DEMO_GPU !== '1') app.disableHardwareAcceleration();
}

// One launcher at a time. Opening it again (for example from Xbox mode) brings the window forward.
const XBOX_MODE = process.argv.includes('--xbox-mode');
if (!process.env.NEBULA_REVIEW && !app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', (_event, argv) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (argv.includes('--xbox-mode')) mainWindow.setFullScreen(true);
  mainWindow.show();
  mainWindow.focus();
});

let mainWindow;
let steamShop;
let currentLibrary = [];
const gameDetailCache = new Map();
const gameDetailRequests = new Map();
let steamChartsCache = { at: 0, apiKey: '', ranks: new Map(), status: 'empty' };
let steamDiscoveryCache = { at: 0, data: null };
const steamDiscoveryArtworkCache = new Map();
let steamDiscoveryArtworkRunning = false;
const publicSteamAchievementCache = new Map();
let activeGameSession = null;
// The last game launched from here, for diagnostics: what was started and whether it got going.
let lastLaunch = null;
let safeMode = false;
let startupGuard = null;
let rendererRecoveries = 0;
const installRequests = new Map();
let publisherLocalStatus = { ubisoftStatus:'not-scanned', ubisoftCount:0 };

// Games just hidden or unhidden through Steam, until Steam writes the change to its collection file.
const steamHiddenOverrides = new Map();
async function localSteamLibrary() {
  if (process.env.NEBULA_DEMO === '1') return { hiddenIds: [], stats: {}, available: false };
  const local = await readSteamLocalLibrary(await findSteamRoots(), await detectSteamId64());
  if (!steamHiddenOverrides.size) return local;
  const hidden = new Set(local.hiddenIds);
  for (const [appId, change] of steamHiddenOverrides) {
    if (Date.now() - change.at > 15 * 60 * 1000 || hidden.has(appId) === change.hidden) { steamHiddenOverrides.delete(appId); continue; }
    if (change.hidden) hidden.add(appId); else hidden.delete(appId);
  }
  return { ...local, hiddenIds: [...hidden] };
}

const SETTINGS_DEFAULTS = {
  region: 'auto',
  steamGridDbKey: '',
  steamApiKey: '',
  steamId64: '',
  showUninstalledSteam: false,
  includeSteamFamily: true,
  duplicateMode: 'all',
  duplicatePreferredProvider: 'Steam',
  duplicatePreferences: {},
  showUninstalledEpic: false,
  showUninstalledUbisoft: false,
  showUninstalledEA: false,
  showUninstalledBattleNet: false,
  showUninstalledGog: false,
  showUninstalledAmazon: false,
  legendaryPath: '',
  fullscreen: true,
  hiddenGameIds: [],
  customGames: [],
  artwork: {},
  playHistory: [],
  playCounts: {},
  favoriteGameIds: [],
  customCollections: [],
  steamAppDetails: {},
  gameLaunchOptions: {},
  gameCategoryOverrides: {},
  achievementReferenceAppIds: {},
  soundEffects: true,
  startupAnimation: true,
  onboardingComplete: false,
  steamBannerDismissed: false,
  avatarId: 'one-orbit',
  avatarImage: '',
  displayName: 'Player',
  uiScale: 1,
  tileRadius: 8,
  textScale: 1,
  highContrastFocus: false,
  reducedMotion: false,
  useRandomScreenshotBackground: true,
  shuffleHomeScreenshots: true
};

let settingsWriteQueue = Promise.resolve();
let libraryOrganizationQueue = Promise.resolve();
let librarySnapshotWriteQueue = Promise.resolve();
let artworkScanEpoch = 0;

function settingsPath() {
  const root = process.env.NEBULA_DEMO === '1' ? process.env.NEBULA_DEMO_USER_DATA || path.join(app.getPath('temp'), 'xbox-preview-ui-demo') : app.getPath('userData');
  return path.join(root, 'settings.json');
}

function librarySnapshotPath() {
  return path.join(path.dirname(settingsPath()), 'library-snapshot.json');
}

const artworkCache = createArtworkCache(path.join(path.dirname(settingsPath()), 'artwork-cache'));
let playerRegion = 'auto';
let windowsHomeCountry = '';
const consoleServices = createConsoleServices(path.join(path.dirname(settingsPath()), 'catalog-cache'), fetch, { getCountry: steamCountry });
const steamLookup = createSteamStoreLookup({ getCountry: steamCountry });
const installSizeLookup = createInstallSizeLookup();
const remoteArtwork = createRemoteArtwork({
  directory: path.join(path.dirname(settingsPath()), 'remote-play'),
  getContext: async () => {
    const [settings, snapshot, catalog] = await Promise.all([readSettings(), fs.readFile(librarySnapshotPath(), 'utf8').then(JSON.parse).catch(() => null), fs.readFile(path.join(path.dirname(settingsPath()), 'catalog-cache', `gamepass-catalog-${steamCountry()}.json`), 'utf8').then(JSON.parse).catch(() => null)]);
    const discovery=[...steamDiscoveryArtworkCache.entries()].map(([appId,value])=>({id:`steam-discovery-${appId}`,appId,title:'',provider:'Steam',artwork:value.artwork}));
    return {settings, games:[...currentLibrary, ...(Array.isArray(snapshot?.games) ? snapshot.games : []), ...(Array.isArray(catalog?.games) ? catalog.games : []), ...discovery]};
  },
  findArtwork,
  cacheArtwork: value => artworkCache.cacheArtwork(value)
});
const remotePlay = createRemotePlay({
  directory: path.join(path.dirname(settingsPath()), 'remote-play'),
  runtimeDirectory: app.isPackaged ? path.join(process.resourcesPath, 'streamlight') : path.join(__dirname, '..', '.packaging-staging', 'streamlight'),
  getWindow: () => mainWindow,
  resolveArtwork: (game, options) => remoteArtwork.resolve(game, options),
  onStatus: data => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('remote-play:status', data); }
});
const soundPack = createSoundPack(path.join(path.dirname(settingsPath()), 'personalization'));
const playerProfile = createPlayerProfile(path.join(path.dirname(settingsPath()), 'profile-cache'));
function connectionProgress(data) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('connection:progress', data);
  if (['connected', 'choose-folder', 'missing-folder', 'error'].includes(data.phase)) { mainWindow.show(); mainWindow.focus(); }
}
const accountLibraries = createAccountLibraries(path.join(path.dirname(settingsPath()), 'account-libraries'), () => mainWindow, process.env.NEBULA_DEMO === '1', { BrowserWindow, session: require('electron').session, onProgress: connectionProgress });
const steamFamily = createSteamFamilyLibrary(path.join(path.dirname(settingsPath()), 'steam-family'), () => mainWindow, {demo:process.env.NEBULA_DEMO === '1',onProgress:connectionProgress});
let artworkCacheTask = Promise.resolve();

async function readLibrarySnapshot() {
  try {
    await librarySnapshotWriteQueue;
    const snapshot = JSON.parse(await fs.readFile(librarySnapshotPath(), 'utf8'));
    if (snapshot.version !== 1 || !Array.isArray(snapshot.games) || snapshot.games.length > 30000
      || !snapshot.games.every(game => typeof game?.id === 'string' && typeof game.title === 'string' && typeof game.provider === 'string')) return null;
    snapshot.games = applySteamLocalData(snapshot.games, await localSteamLibrary());
    const savedSettings = await readSettings();
    snapshot.games = snapshot.games.filter(game => game.installed !== false || !game.accountLibrary || savedSettings[{ ubisoft:'showUninstalledUbisoft',ea:'showUninstalledEA',battlenet:'showUninstalledBattleNet',gog:'showUninstalledGog',amazon:'showUninstalledAmazon' }[game.accountLibrary]]);
    const expectedSteamId = savedSettings.steamFamilyAccountId || savedSettings.steamId64 || await detectSteamId64();
    const familyStatus = await steamFamily.status(expectedSteamId);
    snapshot.games = snapshot.games.filter(game => !game.steamFamilyImported || game.installed !== false ||
      (savedSettings.showUninstalledSteam && savedSettings.includeSteamFamily && familyStatus.status !== 'not-connected' && snapshot.summary?.steamFamilyAccount === expectedSteamId));
    const hiddenIds = new Set(savedSettings.hiddenGameIds || []);
    snapshot.games = snapshot.games.filter(game => !hiddenIds.has(game.id));
    if (!currentLibrary.length) currentLibrary = snapshot.games;
    return { ...snapshot.summary, games: snapshot.games, duplicateMode:savedSettings.duplicateMode,
      duplicatePreferredProvider:savedSettings.duplicatePreferredProvider,duplicatePreferences:savedSettings.duplicatePreferences,cachedAt: snapshot.savedAt };
  } catch { return null; }
}

function writeLibrarySnapshot(result, scanEpoch) {
  const operation = librarySnapshotWriteQueue.then(async () => {
    if (scanEpoch !== artworkScanEpoch) return;
    const target = librarySnapshotPath();
    const temporary = `${target}.tmp`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(temporary, JSON.stringify({ version: 1, savedAt: Date.now(), summary: { ...result, games: undefined }, games: result.games }), 'utf8');
    if (scanEpoch !== artworkScanEpoch) return;
    await fs.rename(temporary, target);
  });
  librarySnapshotWriteQueue = operation.catch(() => {});
  return operation;
}

// Settings hold every artwork choice and key, so a save interrupted by a crash or shutdown must never
// cost them: saves go to a temporary file that replaces the old one in a single step, the previous good
// copy is kept as settings.json.bak, and a damaged file is read from that backup instead.
async function readSettingsFile() {
  for (const file of [settingsPath(), `${settingsPath()}.bak`]) {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { /* Missing or damaged; try the backup. */ }
  }
  throw new Error('No readable settings.');
}
async function writeSettingsFile(text) {
  const target = settingsPath(), temp = `${target}.tmp`;
  await fs.writeFile(temp, text, 'utf8');
  try { JSON.parse(await fs.readFile(temp, 'utf8')); } catch { throw new Error('Settings could not be saved.'); }
  // Keep the last good copy before replacing it.
  try { const current = await fs.readFile(target, 'utf8'); JSON.parse(current); await fs.writeFile(`${target}.bak`, current, 'utf8'); } catch { /* No good copy to keep. */ }
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(temp, target); return; }
    catch (error) {
      // Windows can briefly lock the file (antivirus, OneDrive); retry, then fall back to a direct write.
      if (attempt < 4) { await new Promise(resolve => setTimeout(resolve, 60 * (attempt + 1))); continue; }
      await fs.writeFile(target, text, 'utf8');
      await fs.rm(temp, { force: true }).catch(() => {});
      return;
    }
  }
}
async function readSettings() {
  try {
    const saved = await readSettingsFile();
    return { ...SETTINGS_DEFAULTS, ...saved, showUninstalledSteam: Boolean(saved.showUninstalledSteam && saved.steamApiKey), uiScale: saved.uiScale === 0.7 && !saved.uiScaleCustomized ? 1 : saved.uiScale ?? SETTINGS_DEFAULTS.uiScale, steamGridDbKey: saved.steamGridDbKey || process.env.NEBULA_SGDB_KEY || '' };
  } catch {
    if (process.env.NEBULA_DEMO === '1') return { ...SETTINGS_DEFAULTS, onboardingComplete: true, fullscreen: false };
    try {
      const legacyPath = path.join(app.getPath('appData'), 'nebula-pc-launcher', 'settings.json');
      const saved = JSON.parse(await fs.readFile(legacyPath, 'utf8'));
      return { ...SETTINGS_DEFAULTS, ...saved, showUninstalledSteam: Boolean(saved.showUninstalledSteam && saved.steamApiKey), uiScale: saved.uiScale === 0.7 && !saved.uiScaleCustomized ? 1 : saved.uiScale ?? SETTINGS_DEFAULTS.uiScale, steamGridDbKey: saved.steamGridDbKey || process.env.NEBULA_SGDB_KEY || '' };
    } catch {
      return { ...SETTINGS_DEFAULTS, steamGridDbKey: process.env.NEBULA_SGDB_KEY || '' };
    }
  }
}

async function fetchSteamCurrentPopularity(apiKey) {
  if (!apiKey) return { ranks: new Map(), status: 'needs-api-key' };
  if (steamChartsCache.apiKey === apiKey && Date.now() - steamChartsCache.at < 20 * 60 * 1000) {
    return { ranks: steamChartsCache.ranks, status: steamChartsCache.status };
  }
  try {
    const url = new URL('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('input_json', JSON.stringify({ context: { language: 'english', country_code: steamCountry() }, data_request: { include_basic_info: true } }));
    const response = await fetch(url, { signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error(`Steam charts returned ${response.status}`);
    const body = await response.json();
    const entries = body?.response?.ranks || body?.response?.games || [];
    const ranks = new Map(entries.flatMap((entry, index) => {
      const id = String(entry.appid || entry.app_id || entry.id || '');
      const rank = Number(entry.rank) || index + 1;
      return /^\d+$/.test(id) ? [[id, rank]] : [];
    }));
    steamChartsCache = { at: Date.now(), apiKey, ranks, status: ranks.size ? 'ready' : 'unavailable' };
    return { ranks, status: steamChartsCache.status };
  } catch {
    steamChartsCache = { at: Date.now(), apiKey, ranks: new Map(), status: 'unavailable' };
    return { ranks: steamChartsCache.ranks, status: steamChartsCache.status };
  }
}

function decodeSteamText(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function steamCountry() {
  const { locale, timeZone } = Intl.DateTimeFormat().resolvedOptions();
  return ratings.resolveCountry({ region: playerRegion, country: windowsHomeCountry, locale, timeZone });
}
async function detectWindowsHomeCountry() {
  if (process.platform !== 'win32' || process.env.NEBULA_DEMO === '1') return '';
  return new Promise(resolve => execFile('reg.exe', ['query', 'HKCU\\Control Panel\\International\\Geo', '/v', 'Name'],
    { windowsHide: true, timeout: 1500 }, (_error, stdout) => resolve(String(stdout || '').match(/\bName\s+REG_SZ\s+([A-Z]{2})\b/)?.[1] || '')));
}
function steamStoreArt(appId) {
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/`;
  return { tile: base + 'library_600x900.jpg', grid: base + 'library_600x900.jpg', tileIsSquare: false, hero: base + 'library_hero.jpg', wide: base + 'header.jpg', imageSource: 'steam-store' };
}
// Name and price for Steam games, in batches (IStoreBrowseService answers without a key).
async function steamStoreItems(appIds) {
  return steamLookup.getItems(appIds);
}
function steamDiscoveryItem(appId, title, rank, extra = {}) {
  return { id: `steam-discovery-${appId}`, appId: String(appId), title: decodeSteamText(title), provider: 'Steam', discoveryOnly: true, installed: false, rank, artwork: { tile: null, tileIsSquare: false }, ...extra };
}

function parseSteamChart(html, { withPlayers = false, paidOnly = false } = {}) {
  const items = [];
  const seen = new Set();
  for (const row of html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || []) {
    const link = row.match(/href="https:\/\/store\.steampowered\.com\/app\/(\d+)\/[^\"]*"[\s\S]*?<div[^>]*>([^<]+)<\/div>/i);
    if (!link || seen.has(link[1])) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(match => decodeSteamText(match[1].replace(/<[^>]*>/g, '')));
    if (paidOnly && cells.some(cell => /^(?:free|free to play)$/i.test(cell))) continue;
    const rank = Number(cells.find(cell => /^\d+$/.test(cell))) || items.length + 1;
    const currentPlayers = withPlayers ? Number((cells.find(cell => /^\d{1,3}(?:,\d{3})+$/.test(cell)) || '0').replaceAll(',', '')) : undefined;
    seen.add(link[1]);
    items.push(steamDiscoveryItem(link[1], link[2], paidOnly ? items.length + 1 : rank, { currentPlayers }));
    if (items.length === 5) break;
  }
  return items;
}

function parseSteamUpcoming(html, limit = 5) {
  const items = [];
  const seen = new Set();
  for (const match of html.matchAll(/<a\b[^>]*data-ds-appid="(\d+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const id = match[1];
    if (seen.has(id)) continue;
    const title = match[2].match(/<span class="title">([^<]+)<\/span>/i)?.[1];
    if (!title) continue;
    // A zero final price is common for unreleased games, so only reject an
    // explicit Free-to-Play tag or Steam's visible "Free" price label.
    if (/data-ds-tagids="[^"]*\b113\b/i.test(match[0]) || /discount_final_price free|>\s*Free(?: To Play)?\s*</i.test(match[2])) continue;
    seen.add(id);
    items.push(steamDiscoveryItem(id, title, items.length + 1));
    if (items.length === limit) break;
  }
  return items;
}

async function verifyUpcomingPaid(candidates) {
  const selected = [];
  for (let index = 0; index < candidates.length && selected.length < 5; index += 5) {
    const batch = candidates.slice(index, index + 5);
    const checked = await Promise.all(batch.map(async game => {
      try {
        const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${game.appId}&l=english`, { signal: AbortSignal.timeout(7000) });
        if (!response.ok) return game;
        const details = (await response.json())?.[game.appId]?.data;
        return details?.is_free === true || (details?.type && details.type !== 'game') ? null : game;
      } catch { return game; }
    }));
    selected.push(...checked.filter(Boolean));
  }
  return selected.slice(0, 5).map((game, index) => ({ ...game, rank: index + 1 }));
}

async function fetchSteamDiscovery() {
  if (steamDiscoveryCache.data && Date.now() - steamDiscoveryCache.at < 20 * 60 * 1000) return steamDiscoveryCache.data;
  if (process.env.NEBULA_DEMO === '1') {
    const demo = { mostPlayed: [730, 570, 440, 1172470, 1085660].map((id, i) => steamDiscoveryItem(id, ['Counter-Strike 2', 'Dota 2', 'Team Fortress 2', 'Apex Legends', 'Destiny 2'][i], i + 1)), topSellers: [1091500, 1245620, 1174180, 594650, 2252570].map((id, i) => steamDiscoveryItem(id, ['Cyberpunk 2077', 'Elden Ring', 'Red Dead Redemption 2', 'Hunt: Showdown', 'Another paid game'][i], i + 1)), upcoming: [3669870, 2246340, 2314430, 2828710, 2406980].map((id, i) => steamDiscoveryItem(id, ['CONTROL Resonant', 'Upcoming game', 'Coming soon', 'New on Steam', 'Future release'][i], i + 1)), status: 'ready' };
    steamDiscoveryCache = { at: Date.now(), data: demo };
    return demo;
  }
  const urls = [
    'https://store.steampowered.com/charts/mostplayed?l=english',
    'https://store.steampowered.com/charts/topselling/global?l=english',
    'https://store.steampowered.com/search/results/?query&start=0&count=40&dynamic_data=&sort_by=_ASC&filter=popularcomingsoon&infinite=1&l=english'
  ];
  const responses = await Promise.allSettled(urls.map(async url => {
    const response = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Steam returned ${response.status}`);
    return url.includes('/search/results/') ? (await response.json()).results_html || '' : await response.text();
  }));
  const body = index => responses[index].status === 'fulfilled' ? responses[index].value : '';
  const data = { mostPlayed: parseSteamChart(body(0), { withPlayers: true }), topSellers: parseSteamChart(body(1), { paidOnly: true }), upcoming: await verifyUpcomingPaid(parseSteamUpcoming(body(2), 15)), status: responses.every(result => result.status === 'fulfilled') ? 'ready' : 'partial' };
  steamDiscoveryCache = { at: Date.now(), data };
  enrichSteamDiscoveryArtwork(data).catch(() => {});
  return data;
}

async function enrichSteamDiscoveryArtwork(data) {
  if (steamDiscoveryArtworkRunning) return;
  steamDiscoveryArtworkRunning = true;
  try {
    const settings = await readSettings();
    const games = [...new Map([...data.mostPlayed, ...data.topSellers, ...data.upcoming].map(game => [game.appId, game])).values()];
    let next = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (next < games.length) {
        const game = games[next++];
        const cached = steamDiscoveryArtworkCache.get(game.appId);
        const artwork = cached && Date.now() - cached.at < 24 * 60 * 60 * 1000
          ? cached.artwork : await findArtwork(game.title, settings.steamGridDbKey, 'Steam', false, game.appId).catch(() => null);
        if (!cached || Date.now() - cached.at >= 24 * 60 * 60 * 1000) steamDiscoveryArtworkCache.set(game.appId, { at: Date.now(), artwork });
        if (!artwork?.tile) continue;
        for (const item of [...data.mostPlayed, ...data.topSellers, ...data.upcoming]) if (item.appId === game.appId) item.artwork = artwork;
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('steam:discovery-artwork', { appId: game.appId, artwork });
      }
    }));
  } finally { steamDiscoveryArtworkRunning = false; }
}

function writeSettings(next, { replaceArtwork = false } = {}) {
  const operation = settingsWriteQueue.then(async () => {
    const previous = await readSettings();
    const settings = { ...previous, ...next };
    if (next.artwork && !replaceArtwork) {
      settings.artwork = { ...(previous.artwork || {}) };
      for (const [id, entry] of Object.entries(next.artwork)) {
        const old = settings.artwork[id] || {};
        settings.artwork[id] = { ...old, ...entry, logo: entry.logo || old.logo || null };
      }
    }
    await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
    await writeSettingsFile(JSON.stringify(settings, null, 2));
    return settings;
  });
  settingsWriteQueue = operation.catch(() => {});
  return operation;
}

function replaceSettings(next) {
  const operation = settingsWriteQueue.then(async () => {
    await fs.mkdir(path.dirname(settingsPath()), { recursive: true });
    await writeSettingsFile(JSON.stringify(next, null, 2));
    return next;
  });
  settingsWriteQueue = operation.catch(() => {});
  return operation;
}

function parseVdfValue(text, key) {
  return text.match(new RegExp(`"${key}"\\s+"([^"]*)"`, 'i'))?.[1] || '';
}

async function exists(candidate) {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

let steamRootCache = null;
async function findSteamRoots() {
  if (steamRootCache && Date.now() - steamRootCache.at < 30000) return [...steamRootCache.roots];
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Steam'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Steam')
  ];
  if (process.platform === 'win32' && process.env.NEBULA_DEMO !== '1') {
    const registered = await new Promise(resolve => execFile('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true, timeout: 1500 }, (error, stdout) => {
      resolve(error ? '' : stdout.match(/SteamPath\s+REG_SZ\s+([^\r\n]+)/i)?.[1]?.trim() || '');
    }));
    if (registered && path.isAbsolute(registered)) candidates.unshift(registered);
  }

  // The same folder can be spelled several ways (the registry uses "c:/program files (x86)/steam"), so compare normalised paths.
  const roots = [];
  const rootKey = value => path.resolve(value).replace(/[\\/]+$/, '').toLowerCase();
  const addRoot = async value => {
    if (!value || !path.isAbsolute(value)) return;
    const normal = path.resolve(value).replace(/[\\/]+$/, '');
    const index = roots.findIndex(item => rootKey(item) === rootKey(normal));
    // Keep the nicest spelling (one with capitals) for display.
    if (index >= 0) { if (roots[index] === roots[index].toLowerCase() && normal !== normal.toLowerCase()) roots[index] = normal; return; }
    if (await exists(path.join(normal, 'steamapps'))) roots.push(normal);
  };
  for (const candidate of candidates) await addRoot(candidate);

  for (const root of [...roots]) {
    try {
      const libraryVdf = await fs.readFile(path.join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      const matches = [...libraryVdf.matchAll(/"path"\s+"([^"]+)"/gi)];
      for (const match of matches) {
        await addRoot(match[1].replace(/\\\\/g, '\\'));
      }
    } catch { /* Steam may not have created libraryfolders.vdf yet. */ }
  }
  steamRootCache = { at: Date.now(), roots };
  return [...roots];
}

function isSteamRuntimeComponent(appId, title) {
  return String(appId) === '228980' || /steamworks common redistributables|steam linux runtime|steam runtime redistributable/i.test(String(title || ''));
}

async function scanSteam() {
  const games = [];
  const roots = await findSteamRoots();
  let steamExecutable = '';
  for (const root of roots) {
    if (await exists(path.join(root, 'steam.exe'))) {
      steamExecutable = path.join(root, 'steam.exe');
      break;
    }
  }
  for (const root of roots) {
    const steamApps = path.join(root, 'steamapps');
    let manifests = [];
    try {
      manifests = (await fs.readdir(steamApps)).filter((file) => /^appmanifest_\d+\.acf$/i.test(file));
    } catch { continue; }

    for (const manifest of manifests) {
      try {
        const text = await fs.readFile(path.join(steamApps, manifest), 'utf8');
        const appId = parseVdfValue(text, 'appid');
        const title = parseVdfValue(text, 'name');
        const installDir = parseVdfValue(text, 'installdir');
        const type = parseVdfValue(text, 'type').toLowerCase();
        const updated = Number(parseVdfValue(text, 'LastUpdated')) || 0;
        if (!appId || !title || isSteamRuntimeComponent(appId, title)) continue;
        games.push({
          id: `steam-${appId}`,
          title,
          provider: 'Steam',
          appId,
          steamType: type,
          installed: Boolean(Number(parseVdfValue(text, 'StateFlags')) & 4),
          addedAt: updated ? updated * 1000 : 0,
          sizeOnDisk: Number(parseVdfValue(text, 'SizeOnDisk')) || 0,
          buildId: parseVdfValue(text, 'buildid'),
          lastUpdated: updated ? updated * 1000 : 0,
          steamExecutable,
          installPath: path.join(steamApps, 'common', installDir),
          launchUri: `steam://rungameid/${appId}`
        });
      } catch { /* Ignore incomplete manifests. */ }
    }
  }
  return games;
}

async function detectSteamId64() {
  for (const root of await findSteamRoots()) {
    try {
      const users = await fs.readFile(path.join(root, 'config', 'loginusers.vdf'), 'utf8');
      const entries = [...users.matchAll(/"(\d{17})"\s*\{([^{}]*)\}/g)];
      const recent = entries.find((entry) => /"MostRecent"\s+"1"/i.test(entry[2]));
      if (recent) return recent[1];
      if (entries[0]) return entries[0][1];
    } catch { /* Steam may not have a local account signed in. */ }
  }
  return '';
}

async function detectRecentSteamId64() {
  for (const root of await findSteamRoots()) {
    try {
      const users = await fs.readFile(path.join(root, 'config', 'loginusers.vdf'), 'utf8');
      const recent = users.match(/"(\d{17})"\s*\{[^{}]*"MostRecent"\s+"1"[^{}]*\}/i);
      if (recent) return recent[1];
    } catch { /* No local account is selected in this Steam install. */ }
  }
  return '';
}

async function steamClientIsRunning() {
  if (process.platform !== 'win32') return false;
  return new Promise((resolve) => {
    let output = '';
    const child = spawn('tasklist.exe', ['/FI', 'IMAGENAME eq steam.exe', '/FO', 'CSV', '/NH'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const timer = setTimeout(() => { child.kill(); resolve(false); }, 2500);
    child.stdout.on('data', (chunk) => { output += chunk.toString(); });
    child.once('error', () => { clearTimeout(timer); resolve(false); });
    child.once('close', () => { clearTimeout(timer); resolve(/"steam\.exe"/i.test(output)); });
  });
}

async function fetchOwnedSteamGames(settings) {
  const steamId64 = String(settings.steamId64 || await detectSteamId64()).trim();
  if (!settings.steamApiKey || !steamId64) {
    return { games: [], status: settings.steamApiKey ? 'needs-steam-id' : 'needs-api-key', steamId64, count: 0 };
  }
  try {
    const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
    url.searchParams.set('key', settings.steamApiKey);
    url.searchParams.set('steamid', steamId64);
    url.searchParams.set('include_appinfo', '1');
    url.searchParams.set('include_played_free_games', '1');
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return { games: [], status: response.status === 401 || response.status === 403 ? 'invalid-api-key' : 'steam-error', steamId64, count: 0 };
    const body = await response.json();
    if (!body?.response || !Array.isArray(body.response.games)) {
      return { games: [], status: 'private-library', steamId64, count: 0 };
    }
    return {
      status: 'ready', steamId64, count: body.response.games.length,
      games: body.response.games.filter((item) => !isSteamRuntimeComponent(item.appid, item.name)).map((item) => ({
        id: `steam-${item.appid}`,
        title: item.name || `Steam game ${item.appid}`,
        provider: 'Steam',
        appId: String(item.appid),
        installed: false,
        steamPlaytimeMinutes: Number(item.playtime_forever) || 0,
        launchUri: `steam://rungameid/${item.appid}`
      }))
    };
  } catch {
    return { games: [], status: 'steam-error', steamId64, count: 0 };
  }
}

async function scanEpic() {
  const manifestRoot = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');
  let files = [];
  try {
    files = (await fs.readdir(manifestRoot)).filter((file) => file.endsWith('.item'));
  } catch { return []; }

  const games = [];
  for (const file of files) {
    try {
      const item = JSON.parse(await fs.readFile(path.join(manifestRoot, file), 'utf8'));
      if (!item.DisplayName || !item.InstallLocation || item.bIsIncompleteInstall) continue;
      const executable = path.join(item.InstallLocation, item.LaunchExecutable || '');
      games.push({
        id: `epic-${item.CatalogItemId || item.AppName || item.DisplayName}`,
        title: item.DisplayName,
        provider: 'Epic Games',
        installPath: item.InstallLocation,
        executable,
        args: item.LaunchCommand || '',
        sizeOnDisk: Number(item.InstallSize) || 0,
        version: item.AppVersionString || ''
      });
    } catch { /* Ignore launcher support manifests. */ }
  }
  return games;
}

async function collectFiles(root, extension, files = []) {
  try {
    for (const entry of await fs.readdir(root, { withFileTypes: true })) {
      const candidate = path.join(root, entry.name);
      if (entry.isDirectory()) await collectFiles(candidate, extension, files);
      else if (entry.name.toLowerCase().endsWith(extension)) files.push(candidate);
    }
  } catch { /* A start-menu folder may be missing or inaccessible. */ }
  return files;
}

async function scanXboxGames() {
  const roots = [
    path.join(process.env.SystemDrive || 'C:', 'XboxGames'),
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'XboxGames')
  ];
  const games = [];
  for (const root of roots) {
    let entries = [];
    try { entries = await fs.readdir(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries.filter((item) => item.isDirectory())) {
      const installPath = path.join(root, entry.name);
      const executables = await collectFiles(installPath, '.exe');
      const playable = executables
        .filter((file) => !/\\(redist|redist64|support|prereq|crash|easyanticheat|_commonredist)(\\|$)/i.test(file))
        .filter((file) => !/(unins|install|setup|launcherupdater|crashreport|ueprereq)/i.test(path.basename(file)));
      const executable = playable.find((file) => /\\content\\/i.test(file)) || playable[0];
      if (!executable) continue;
      games.push({
        id: `xbox-${Buffer.from(installPath.toLowerCase()).toString('base64url')}`,
        title: entry.name,
        provider: 'Xbox PC',
        installPath,
        executable,
        args: ''
      });
    }
  }
  return games;
}

async function scanPublisherShortcuts() {
  const roots = [
    path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  ].filter(Boolean);
  const rules = [
    { provider: 'Ubisoft Connect', match: /(ubisoft|uplay)/i },
    { provider: 'EA app', match: /(^|\\|\s)(ea games|electronic arts)(\\|\s|$)/i },
    { provider: 'Battle.net', match: /(battle\.net|blizzard)/i },
    { provider: 'GOG Galaxy', match: /(gog|galaxy)/i },
    { provider: 'Amazon Games', match: /amazon games/i },
    { provider: 'Rockstar Games', match: /rockstar games/i },
    { provider: 'Riot Games', match: /riot games/i },
    { provider: 'itch.io', match: /itch\.io/i },
    { provider: 'Xbox PC', match: /(^|\\)xbox(\\|\s|$)/i }
  ];
  const ignored = /(uninstall|unins|launcher|updater|repair|crash|website|readme|support|ubisoft connect|ea app|battle\.net|xbox app|gog galaxy|amazon games|rockstar games launcher|riot client|itch\.io app)/i;
  const games = [];
  for (const root of roots) {
    const shortcuts = [...await collectFiles(root, '.lnk'), ...await collectFiles(root, '.url')];
    for (const shortcutPath of shortcuts) {
      const relative = path.relative(root, shortcutPath);
      const rule = rules.find((item) => item.match.test(relative));
      const title = path.basename(shortcutPath, path.extname(shortcutPath)).trim();
      if (!rule || !title || ignored.test(title)) continue;
      games.push({
        id: `shortcut-${Buffer.from(shortcutPath.toLowerCase()).toString('base64url')}`,
        title,
        provider: rule.provider,
        shortcutPath,
        installPath: null
      });
    }
  }
  return games;
}

async function scanInstalledLaunchers() {
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = process.env.LOCALAPPDATA || '';
  const roaming = process.env.APPDATA || '';
  const definitions = [
    ['Steam', [path.join(programFilesX86, 'Steam', 'steam.exe'), path.join(programFiles, 'Steam', 'steam.exe')]],
    ['Epic Games Launcher', [path.join(programFilesX86, 'Epic Games', 'Launcher', 'Portal', 'Binaries', 'Win64', 'EpicGamesLauncher.exe'), path.join(programFiles, 'Epic Games', 'Launcher', 'Portal', 'Binaries', 'Win64', 'EpicGamesLauncher.exe')]],
    ['EA app', [path.join(programFiles, 'Electronic Arts', 'EA Desktop', 'EA Desktop', 'EADesktop.exe')]],
    ['Ubisoft Connect', [path.join(programFilesX86, 'Ubisoft', 'Ubisoft Game Launcher', 'UbisoftConnect.exe')]],
    ['Battle.net', [path.join(programFilesX86, 'Battle.net', 'Battle.net Launcher.exe'), path.join(programFiles, 'Battle.net', 'Battle.net Launcher.exe')]],
    ['GOG Galaxy', [path.join(programFilesX86, 'GOG Galaxy', 'GalaxyClient.exe'), path.join(programFiles, 'GOG Galaxy', 'GalaxyClient.exe')]],
    ['Amazon Games', [path.join(programFilesX86, 'Amazon Games', 'App', 'Amazon Games.exe'), ...(local ? [path.join(local, 'Amazon Games', 'App', 'Amazon Games.exe')] : [])]],
    ['Rockstar Games Launcher', [path.join(programFiles, 'Rockstar Games', 'Launcher', 'Launcher.exe'), path.join(programFilesX86, 'Rockstar Games', 'Launcher', 'Launcher.exe')]],
    ['Riot Client', [path.join(path.parse(programFiles).root, 'Riot Games', 'Riot Client', 'RiotClientServices.exe'), ...(local ? [path.join(local, 'Riot Games', 'Riot Client', 'RiotClientServices.exe')] : [])]],
    ['itch', [path.join(programFiles, 'itch', 'itch.exe'), ...(roaming ? [path.join(roaming, 'itch', 'itch.exe')] : [])]]
  ];
  const launchers = [];
  for (const [title, candidates] of definitions) {
    const executable = (await Promise.all(candidates.map(async candidate => await exists(candidate) ? candidate : null))).find(Boolean);
    if (!executable) continue;
    let launcherIcon = '';
    try { launcherIcon = (await app.getFileIcon(executable, { size: 'normal' })).toDataURL(); } catch { /* Text mark still identifies the app. */ }
    launchers.push({ id: `launcher-${normalizeTitle(title).replaceAll(' ', '-')}`, title, provider: title === 'Epic Games Launcher' ? 'Epic Games' : title, executable, installPath: path.dirname(executable), isApp: true, isLauncher: true, launcherIcon });
  }
  if (process.platform === 'win32') {
    const xboxPackage = await new Promise(resolve => {
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '(Get-AppxPackage -Name Microsoft.GamingApp).PackageFamilyName'], { windowsHide: true, timeout: 3500 }, (error, stdout) => resolve(!error && /Microsoft\.GamingApp_/i.test(stdout)));
    });
    if (xboxPackage) launchers.push({ id: 'launcher-xbox-app', title: 'Xbox app', provider: 'Xbox PC', launchUri: 'msxbox://', isApp: true, isLauncher: true, isXboxLauncher: true });
  }
  return launchers;
}

async function fetchSgdbJson(endpoint, apiKey) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    // A dropped connection or timeout is retried; after that the player gets a plain message, not "fetch failed".
    try {
      response = await fetch(`https://www.steamgriddb.com/api/v2${endpoint}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000)
      });
    } catch {
      if (attempt < 2) { await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1))); continue; }
      throw new Error('Couldn’t reach SteamGridDB. Check your connection and try again.');
    }
    if (response.status === 401 || response.status === 403) throw new Error('SteamGridDB didn’t accept the API key. Check it in Settings › Manage games › Artwork.');
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get('retry-after'));
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 15000) : 1500 * 2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(`SteamGridDB returned ${response.status}`);
    const body = await response.json();
    return body.data || [];
  }
  return [];
}

async function fetchSteamNews(appId) {
  try {
    const response = await fetch(`https://api.steampowered.com/ISteamNews/GetNewsForApp/v0002/?appid=${encodeURIComponent(appId)}&count=10&maxlength=6000&format=json`, { headers: { 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return [];
    const body = await response.json();
    const items = body.appnews?.newsitems || [];
    // The news API strips images from many posts; Steam's events data has each post's capsule art.
    const eventArt = new Map();
    try {
      const events = await (await fetch(`https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid=${encodeURIComponent(appId)}&offset=0&count=12&l=english`, { signal: AbortSignal.timeout(6000) })).json();
      for (const event of events?.events || []) {
        let data = {}; try { data = JSON.parse(event.jsondata || '{}'); } catch { /* No art. */ }
        const file = (data.localized_capsule_image || []).find(Boolean) || (data.localized_title_image || []).find(Boolean);
        const clan = BigInt(String(event.clan_steamid || '0')) - 103582791429521408n;
        if (!file || clan <= 0n || !/^[a-f0-9]{40}\.(png|jpg|jpeg|gif)$/i.test(file)) continue;
        const url = `https://clan.akamai.steamstatic.com/images/${clan}/${file}`;
        if (event.announcement_body?.gid) eventArt.set(String(event.news_post_gid || ''), url);
        eventArt.set(`title:${String(event.event_name || '').trim().toLowerCase()}`, url);
      }
    } catch { /* Posts keep their own images or the game's art. */ }
    // Official announcements first; third-party press feeds only fill in when a game has few posts.
    const official = items.filter(item => item.feed_type === 1 || /steam_community_announcements/i.test(item.feedname || ''));
    const ordered = [...official, ...items.filter(item => !official.includes(item))];
    return ordered.map((item) => {
      const raw = String(item.contents || '');
      // Steam posts point at their images as {STEAM_CLAN_IMAGE}/…, [img src="…"], [img]…[/img] or <img src>.
      const clan = value => String(value || '').replace(/\{STEAM_CLAN_IMAGE\}/g, 'https://clan.akamai.steamstatic.com/images');
      const youtube = raw.match(/\[previewyoutube="?([A-Za-z0-9_-]{6,15})/i)?.[1];
      const candidate = clan(item.image || raw.match(/\[img(?:\s+src)?=["']?([^\]"']+)["']?[^\]]*\]/i)?.[1] || raw.match(/\[img\]([^\[]+)\[\/img\]/i)?.[1] || raw.match(/<img[^>]+src=["']([^"']+)/i)?.[1] || '');
      let image = null;
      try {
        const url = new URL(candidate);
        if (url.protocol === 'https:' && (url.hostname === 'steamstatic.com' || url.hostname.endsWith('.steamstatic.com'))) image = url.toString();
      } catch { /* No usable image in this post. */ }
      image = eventArt.get(String(item.gid || '')) || eventArt.get(`title:${String(item.title || '').trim().toLowerCase()}`) || image;
      if (!image && youtube) image = `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg`;
      const contents = raw
        .replace(/\[(previewyoutube|img|video|url)[^\]]*\][\s\S]*?\[\/\1\]/gi, ' ').replace(/\[img[^\]]*\]/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/\[\/?[a-z0-9*]+(=[^\]]*)?\]/gi, ' ').replace(/\{STEAM_CLAN_IMAGE\}\S*/g, ' ')
        .replace(/https?:\/\/\S+/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ').trim();
      return { title: item.title, url: item.url, date: item.date, image, contents, official: official.includes(item), feed: item.feedlabel || '' };
    }).filter((item) => {
      const sample = `${item.title} ${item.contents}`;
      const letters = (sample.match(/\p{L}/gu) || []).length;
      const latin = (sample.match(/[A-Za-z]/g) || []).length;
      if (letters && latin / letters < .8) return false;
      const englishSignals = sample.match(/\b(the|and|for|with|new|update|game|now|this|your|available|from|will|have|our|you|are|we|today|coming|patch|fixes|players)\b/gi) || [];
      return englishSignals.length >= 2;
    }).slice(0, 6);
  } catch {
    return [];
  }
}

function scheduleScreenshotCache(game, details) {
  if (!details.screenshots?.length || process.env.NEBULA_DEMO === '1') return;
  const task = (async () => {
    const cachedScreenshots = [];
    for (let index = 0; index < details.screenshots.length; index += 4) {
      cachedScreenshots.push(...await Promise.all(details.screenshots.slice(index, index + 4).map(url => artworkCache.cacheImage(url))));
    }
    if (!currentLibrary.some(entry => entry.id === game.id)) return;
    game.artwork = { ...(game.artwork || {}), screenshots: cachedScreenshots };
    details.screenshots = cachedScreenshots;
    await writeSettings({ artwork: { [game.id]: game.artwork } });
  })();
  artworkCacheTask = Promise.allSettled([artworkCacheTask, task]);
}

const xboxAgeRating = product => ratings.xboxAgeRating(product, steamCountry());
const detailCacheKey = (id, country = steamCountry()) => `v3:${country}:${id}`;
function invalidateGameDetails(id) {
  for (const key of gameDetailCache.keys()) if (key === id || key.endsWith(`:${id}`)) gameDetailCache.delete(key);
  if (detailDisk) for (const key of Object.keys(detailDisk)) if (key === id || key.endsWith(`:${id}`)) delete detailDisk[key];
}

// Game pages open from a copy saved on disk (up to a week old) while a fresh copy loads behind it.
const detailDiskFile = () => path.join(path.dirname(settingsPath()), 'game-details-cache.json');
let detailDisk = null, detailDiskTimer = null;
async function loadDetailDisk() {
  if (detailDisk) return detailDisk;
  try { detailDisk = JSON.parse(await fs.readFile(detailDiskFile(), 'utf8')) || {}; } catch { detailDisk = {}; }
  return detailDisk;
}
function saveDetailDisk() {
  clearTimeout(detailDiskTimer);
  detailDiskTimer = setTimeout(() => fs.writeFile(detailDiskFile(), JSON.stringify(detailDisk)).catch(() => {}), 2000);
}
async function fetchGameDetails(game) {
  const country = steamCountry(), key = detailCacheKey(game.id, country);
  const memory = gameDetailCache.get(key);
  if (memory && Date.now() - memory.at < 15 * 60 * 1000) return memory.data;
  const disk = (await loadDetailDisk())[key];
  // Like a console's title cache: a page seen in the last day opens straight from disk with no network
  // at all; older copies (up to a week) still open at once and refresh behind the page.
  if (disk?.data && Date.now() - disk.at < 24 * 60 * 60 * 1000) { gameDetailCache.set(key, { at: Date.now(), data: disk.data }); return disk.data; }
  let fresh = gameDetailRequests.get(key);
  if (!fresh) fresh = fetchGameDetailsFresh(game, country).then(data => {
    delete detailDisk[key];
    detailDisk[key] = { at: Date.now(), data };
    const keys = Object.keys(detailDisk);
    for (let index = 0; index < keys.length - 1500; index++) delete detailDisk[keys[index]];
    saveDetailDisk();
    return data;
  }).finally(() => gameDetailRequests.delete(key));
  gameDetailRequests.set(key, fresh);
  if (disk?.data && Date.now() - disk.at < 7 * 24 * 60 * 60 * 1000) { fresh.catch(() => {}); return disk.data; }
  return fresh;
}
async function fetchGameDetailsFresh(game, country = steamCountry()) {
  const key = detailCacheKey(game.id, country);
  const cached = gameDetailCache.get(key);
  if (cached && Date.now() - cached.at < 15 * 60 * 1000) return cached.data;
  const fallback = {
    title: game.title, provider: game.provider, description: '', fullDescription: '', genres: [], developer: '', publisher: '', releaseDate: '',
    screenshots: game.artwork?.screenshots || [], dlc: [], dlcStatus: 'unavailable',
    ageRating: '', controllerSupport: game.controls || 'unknown', categories: [], playableOn: ['PC'],
    achievementCount: 0, supportedLanguages: '', metacriticScore: null, metadataSource: 'Local library'
  };
  // Xbox.com's product summary carries the official rating badge, trailers and product ID.
  const xboxSummaryRequest = consoleServices.findXboxProduct(game.title).catch(() => null);
  const applyXboxSummary = async (details) => {
    const summary = await xboxSummaryRequest;
    if (!summary) return details;
    details.rating = ratings.chooseRating(country, summary.rating, details.rating);
    details.videos = uniqueVideos([...(summary.videos || []), ...(details.videos || [])], { playableOnly: true });
    details.xboxProductId ||= summary.xboxProductId;
    details.publisher ||= summary.publisher;
    if (!details.description && summary.description) details.description = details.fullDescription = summary.description;
    return details;
  };
  const xboxFallback = async () => {
    const xboxDetails = await fetchXboxCatalogDetails(game.title);
    const result = await applyXboxSummary(xboxDetails ? { ...fallback, ...xboxDetails } : { ...fallback });
    result.screenshots = uniqueScreenshots(result.screenshots);
    gameDetailCache.set(key, { at: Date.now(), data: result });
    scheduleScreenshotCache(game, result);
    return result;
  };
  let appId = /^\d+$/.test(String(game.achievementReferenceAppId || game.appId || '')) ? String(game.achievementReferenceAppId || game.appId) : '';
  if (!appId) try {
    const results = await steamLookup.search(game.title);
    const match = [...results].sort((a, b) => titleMatchScore(game.title, b.title) - titleMatchScore(game.title, a.title))[0];
    if (match?.appId && titleMatchScore(game.title, match.title) >= 90) appId = match.appId;
  } catch { /* An imported title may not have a Steam store listing. */ }
  if (!appId) return xboxFallback();
  const xboxDetailsRequest = fetchXboxCatalogDetails(game.title).catch(() => null);
  try {
    const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&l=english&cc=${country}`, {
      headers: { 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) return xboxFallback();
    const body = await response.json();
    const item = body?.[appId]?.success ? body[appId].data : null;
    if (!item) return xboxFallback();
    const plainText = (value) => String(value || '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp);/gi, (entity) => ({ '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' })[entity.toLowerCase()] || ' ').replace(/[ \t]+/g, ' ').trim();
    const details = {
      ...fallback,
      title: item.name || game.title,
      description: plainText(item.short_description),
      fullDescription: plainText(item.about_the_game || item.detailed_description || item.short_description).slice(0, 10000),
      genres: (item.genres || []).map((entry) => entry.description).filter(Boolean).slice(0, 5),
      developer: (item.developers || []).join(', '),
      publisher: (item.publishers || []).join(', '),
      releaseDate: item.release_date?.date || '',
      ageRating: item.required_age ? `${item.required_age}+` : '',
      categories: (item.categories || []).map((entry) => entry.description).filter(Boolean).slice(0, 18),
      playableOn: Object.entries(item.platforms || {}).filter(([, supported]) => supported).map(([platform]) => platform === 'windows' ? 'PC' : platform === 'mac' ? 'macOS' : 'Linux'),
      controllerSupport: item.controller_support === 'full' ? 'controller' : item.controller_support === 'partial' ? 'partial' : fallback.controllerSupport,
      achievementCount: Number(item.achievements?.total) || 0,
      supportedLanguages: String(item.supported_languages || '').replace(/<br\s*\/?\s*>/gi, ', ').replace(/<[^>]+>/g, '').replace(/\*+\s*languages with full audio support.*$/i, '').replace(/\*/g, '').split(',').map((language) => language.trim()).filter(Boolean).slice(0, 8).join(', '),
      supportedLanguageCount: String(item.supported_languages || '').replace(/<br\s*\/?\s*>/gi, ', ').replace(/<[^>]+>/g, '').replace(/\*+\s*languages with full audio support.*$/i, '').split(',').map((language) => language.trim()).filter(Boolean).length,
      contentNotes: plainText(item.content_descriptors?.notes || '').slice(0, 200),
      metacriticScore: Number(item.metacritic?.score) || null,
      metadataSource: 'Steam Store',
      screenshots: (item.screenshots || []).map((entry) => entry.path_full || entry.path_thumbnail).filter((url) => /^https:\/\/[^/]*steamstatic\.com\//i.test(url)).slice(0, 12),
      dlcStatus: 'unavailable'
    };
    details.steamAppId = appId;
    details.steamCategories = (item.categories || []).map((entry) => entry.description).filter(Boolean);
    details.requirements = { minimum: parseSteamRequirements(item.pc_requirements?.minimum), recommended: parseSteamRequirements(item.pc_requirements?.recommended) };
    details.support = { email: String(item.support_info?.email || '').trim(), url: String(item.support_info?.url || '').trim(), website: String(item.website || '').trim() };
    details.languages = String(item.supported_languages || '').replace(/<br\s*\/?\s*>/gi, ', ').replace(/<[^>]+>/g, '').replace(/\*+\s*languages with full audio support.*$/i, '').replace(/\*/g, '')
      .split(',').map((language) => language.trim()).filter(Boolean);
    const dlcIds = (item.dlc || []).map(String).filter((id) => /^\d+$/.test(id)).slice(0, 50);
    details.dlcIds = dlcIds;
    details.dlcStatus = dlcIds.length ? 'needs-check' : 'none-listed';
    details.rating = ratings.steamAgeRating(item, country);
    // Metadata follows the artwork order: the Xbox Store first, Steam fills the gaps.
    const xbox = await xboxDetailsRequest;
    if (xbox) {
      for (const key of ['description', 'publisher', 'developer', 'releaseDate']) if (xbox[key]) details[key] = xbox[key];
      // Keep whichever full description says more; Xbox listings are sometimes just the short blurb.
      if (String(xbox.fullDescription || '').length > String(details.fullDescription || '').length) details.fullDescription = xbox.fullDescription;
      if (xbox.genres?.length) details.genres = [...new Set([...xbox.genres, ...details.genres])].slice(0, 5);
      if (!details.screenshots.length) details.screenshots = xbox.screenshots || [];
      if (!details.categories.length) details.categories = xbox.categories || [];
      details.rating = ratings.chooseRating(country, xbox.rating, details.rating);
      details.xboxInfo = xbox.xboxInfo;
      details.metadataSource = 'Xbox Store · Steam';
    }
    await applyXboxSummary(details);
    // Steam's own trailers (HLS) play in the launcher's player when the Xbox listing has none.
    {
      const steamVideos = (item.movies || []).map(movie => ({
        title: String(movie.name || 'Trailer'),
        preview: String(movie.thumbnail || '').replace(/movie\.293x165\.jpg/, 'movie.600x338.jpg'),
        stream: String(movie.hls_h264 || '')
      })).filter(video => /^https:\/\/video\.(akamai|fastly|cloudflare)\.steamstatic\.com\/[^\s"]+\.m3u8(\?|$)/.test(video.stream) && /^https:\/\/[^/]*steamstatic\.com\//.test(video.preview));
      details.videos = uniqueVideos([...(details.videos || []), ...steamVideos], { playableOnly: true }).slice(0, 6);
    }
    // Small copies for the gallery strip; the full size opens in the viewer.
    details.screenshots = uniqueScreenshots(details.screenshots.length ? details.screenshots : fallback.screenshots);
    details.screenshotThumbs = details.screenshots.map(url => String(url).replace(/\.1920x1080\.jpg/, '.600x338.jpg'));
    if (details.rating) details.ageRating = details.rating.label;
    if (!details.screenshots.length) details.screenshots = fallback.screenshots;
    gameDetailCache.set(key, { at: Date.now(), data: details });
    scheduleScreenshotCache(game, details);
    return details;
  } catch { return xboxFallback(); }
}

async function fetchOwnedDlc(game) {
  const details = await fetchGameDetails(game);
  if (!details.dlcIds?.length) return { status: details.dlcStatus, items: [] };
  const owned = await fetchOwnedSteamGames(await readSettings());
  const ownedById = new Map((owned.games || []).map((entry) => [String(entry.appId), entry]));
  const ids = details.dlcIds.slice(0, 12);
  const items = [];
  for (let start = 0; start < ids.length; start += 3) {
    const batch = await Promise.all(ids.slice(start, start + 3).map(async (id) => {
      let title = ownedById.get(id)?.title || `DLC ${id}`;
      let price = '';
      try {
        const response = await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=${encodeURIComponent(app.getLocaleCountryCode() || 'US')}`, { signal: AbortSignal.timeout(6000) });
        if (response.ok) {
          const body = await response.json();
          title = body?.[id]?.data?.name || title;
          price = body?.[id]?.data?.is_free ? 'Free' : String(body?.[id]?.data?.price_overview?.final_formatted || '');
        }
      } catch { /* The DLC is still shown even if its title lookup fails. */ }
      return { id, title, price, owned: owned.status === 'ready' && ownedById.has(id), image: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg` };
    }));
    items.push(...batch);
  }
  return { status: owned.status === 'ready' ? 'listed-checked' : 'listed-unverified', items, total: details.dlcIds.length };
}


async function fetchGameAchievements(game) {
  const settings = await readSettings();
  const steamId = String(settings.steamId64 || await detectSteamId64()).trim();
  let appId = /^\d+$/.test(String(game.achievementReferenceAppId || game.appId || '')) ? String(game.achievementReferenceAppId || game.appId) : '';
  const referenceOnly = game.provider !== 'Steam';
  if (!appId && referenceOnly) {
    try {
      const results = await steamLookup.search(game.title);
      const match = [...results].sort((a, b) => titleMatchScore(game.title, b.title) - titleMatchScore(game.title, a.title))[0];
      if (match?.appId && titleMatchScore(game.title, match.title) >= 82) appId = match.appId;
    } catch { /* A non-Steam game may have no Steam edition. */ }
  }
  if (appId) {
    if (settings.steamApiKey) try {
      const schemaUrl = new URL('https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/');
      schemaUrl.searchParams.set('key', settings.steamApiKey);
      schemaUrl.searchParams.set('appid', appId);
      schemaUrl.searchParams.set('l', 'english');
      const playerUrl = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/');
      playerUrl.searchParams.set('key', settings.steamApiKey);
      playerUrl.searchParams.set('steamid', steamId);
      playerUrl.searchParams.set('appid', appId);
      playerUrl.searchParams.set('l', 'english');
      const [schemaResponse, playerResponse] = await Promise.all([
        fetch(schemaUrl, { signal: AbortSignal.timeout(10000) }),
        !referenceOnly && steamId ? fetch(playerUrl, { signal: AbortSignal.timeout(10000) }) : Promise.resolve(null)
      ]);
      if (schemaResponse.ok) {
        const schema = await schemaResponse.json();
        const player = playerResponse?.ok ? await playerResponse.json() : null;
        const available = schema.game?.availableGameStats?.achievements || [];
        const unlocked = new Map((player?.playerstats?.achievements || []).map((entry) => [entry.apiname, Boolean(entry.achieved)]));
        if (available.length) return {
          status: referenceOnly ? 'reference-only' : 'ready',
          source: 'Steam',
          progressAvailable: !referenceOnly && Boolean(player?.playerstats?.success),
          totalAvailable: available.length,
          unlockedCount: !referenceOnly ? available.filter(entry => unlocked.get(entry.name) === true).length : 0,
          items: available.slice(0, 150).map((entry) => ({
            id: entry.name, title: entry.displayName || entry.name,
            description: entry.hidden ? '' : entry.description || '',
            unlocked: !referenceOnly && unlocked.has(entry.name) ? unlocked.get(entry.name) : null,
            icon: safeSteamIcon(entry.icon), lockedIcon: safeSteamIcon(entry.icongray)
          }))
        };
      }
    } catch { /* Public and Xbox catalogs remain available if Steam API data is missing. */ }

    const cachedPublicCatalog = publicSteamAchievementCache.get(appId);
    if (cachedPublicCatalog && Date.now() - cachedPublicCatalog.at < 6 * 60 * 60 * 1000) return {
      status: referenceOnly ? 'reference-only' : 'catalog-only', source: 'Steam Community', progressAvailable: false, items: cachedPublicCatalog.items
    };
    try {
      const response = await fetch(`https://steamcommunity.com/stats/${encodeURIComponent(appId)}/achievements/?l=english`, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const html = await response.text();
        const items = parseSteamCommunityAchievements(html, appId);
        if (items.length) {
          publicSteamAchievementCache.set(appId, { at: Date.now(), items });
          return { status: referenceOnly ? 'reference-only' : 'catalog-only', source: 'Steam Community', progressAvailable: false, items };
        }
      }
    } catch { /* An authenticated Xbox catalog may have this game's achievement data. */ }
  }

  return { status: appId ? 'none-listed' : 'no-reference', items: [] };
}

// Title matching lives in title-match.cjs (sequel numbers, years and remasters must agree).

function catalogImage(images, purpose, squareOnly = false) {
  return images
    .filter((image) => !purpose || image.ImagePurpose === purpose)
    .filter((image) => !squareOnly || Number(image.Width) === Number(image.Height))
    .sort((a, b) => (Number(b.Width) * Number(b.Height)) - (Number(a.Width) * Number(a.Height)))[0];
}

function catalogImageUrl(image) {
  if (!image?.Uri) return null;
  return image.Uri.startsWith('//') ? `https:${image.Uri}` : image.Uri;
}

async function fetchXboxCatalogArtwork(title) {
  try {
    const endpoint = `https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/Games/products?query=${encodeURIComponent(title)}&market=${steamCountry()}&languages=en-${steamCountry()}&fieldsTemplate=details&platformdependencyname=windows.xbox`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(4500) });
    if (!response.ok) return null;
    const body = await response.json();
    const products = body.Products || body.products || body.Items || body.items || [];
    if (!products.length) return null;
    const wanted = normalizeTitle(title);
    const product = [...products].sort((a, b) => {
      const titleOf = (item) => item.ProductTitle || item.LocalizedProperties?.[0]?.ProductTitle || item.LocalizedProperties?.[0]?.Title || '';
      const score = (value) => {
        const normalized = normalizeTitle(value);
        return normalized === wanted ? 4 : normalized.includes(wanted) || wanted.includes(normalized) ? 2 : 0;
      };
      return score(titleOf(b)) - score(titleOf(a));
    })[0];
    const productTitle = product?.ProductTitle || product?.LocalizedProperties?.[0]?.ProductTitle || product?.LocalizedProperties?.[0]?.Title || '';
    if (titleMatchScore(title, productTitle) < 82) return null;
    const localized = product.LocalizedProperties?.[0] || product.localizedProperties?.[0] || product;
    const imageList = localized.Images || localized.images || product.Images || product.images || [];
    const images = Array.isArray(imageList) ? imageList : [];
    const square = catalogImage(images, 'FeaturePromotionalSquareArt', true)
      || catalogImage(images, 'BoxArt', true)
      || catalogImage(images, null, true);
    const hero = catalogImage(images, 'TitledHeroArt')
      || catalogImage(images, 'SuperHeroArt')
      || catalogImage(images, null);
    if (!square && !hero) return null;
    const catalogText = JSON.stringify(product).toLowerCase();
    const controls = catalogText.includes('controller') ? 'controller' : 'unknown';
    return {
      tile: catalogImageUrl(square),
      grid: catalogImageUrl(square),
      tileIsSquare: Boolean(square),
      hero: catalogImageUrl(hero),
      wide: catalogImageUrl(hero),
      logo: null,
      controls,
      imageSource: 'xbox-catalog'
    };
  } catch {
    return null;
  }
}

async function fetchXboxCatalogDetails(title) {
  try {
    const endpoint = `https://displaycatalog.mp.microsoft.com/v7.0/productFamilies/Games/products?query=${encodeURIComponent(title)}&market=${steamCountry()}&languages=en-${steamCountry()}&fieldsTemplate=details&platformdependencyname=windows.xbox`;
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(6500) });
    if (!response.ok) return null;
    const body = await response.json();
    const products = body.Products || body.products || body.Items || body.items || [];
    const product = [...products].sort((a, b) => titleMatchScore(title, b.ProductTitle || b.LocalizedProperties?.[0]?.ProductTitle || '') - titleMatchScore(title, a.ProductTitle || a.LocalizedProperties?.[0]?.ProductTitle || ''))[0];
    if (!product || titleMatchScore(title, product.ProductTitle || product.LocalizedProperties?.[0]?.ProductTitle || '') < 82) return null;
    const localized = product.LocalizedProperties?.[0] || product;
    const images = localized.Images || product.Images || [];
    const market = product.MarketProperties?.[0] || {};
    const attributes = product.Properties?.Attributes || [];
    const hasAttribute = (name) => attributes.some((entry) => entry.Name === name);
    const playerRange = (name) => {
      const attribute = attributes.find((entry) => entry.Name === name);
      return attribute?.Minimum && attribute?.Maximum ? ` (${attribute.Minimum}–${attribute.Maximum})` : '';
    };
    const desktopFeature = (name) => attributes.some((entry) => entry.Name === name && entry.ApplicablePlatforms?.some((platform) => /desktop|pc/i.test(platform)));
    const categories = [
      hasAttribute('XblOnlineCoop') ? `Xbox online co-op${playerRange('XblOnlineCoop')}` : '',
      hasAttribute('XblOnlineMultiPlayer') ? `Xbox online multiplayer${playerRange('XblOnlineMultiPlayer')}` : '',
      hasAttribute('XblCrossPlatformMultiPlayer') ? 'Cross-platform multiplayer' : '',
      desktopFeature('CapabilityHDR') ? 'HDR on PC' : '',
      desktopFeature('Capability4k') ? '4K on PC' : '',
      hasAttribute('XblAchievements') ? 'Xbox achievements' : ''
    ].filter(Boolean);
    const release = Date.parse(market.OriginalReleaseDate || '');
    const screenshots = (Array.isArray(images) ? images : [])
      .filter((image) => /screen|hero/i.test(String(image.ImagePurpose || '')))
      .map(catalogImageUrl).filter(isAllowedArtworkUrl).slice(0, 12);
    return {
      title: localized.ProductTitle || product.ProductTitle || title,
      description: String(localized.ShortDescription || localized.ProductDescription || '').replace(/<[^>]+>/g, '').trim(),
      fullDescription: String(localized.ProductDescription || localized.ShortDescription || '').replace(/<[^>]+>/g, '').trim(),
      publisher: localized.PublisherName || product.PublisherName || '',
      developer: localized.DeveloperName || '',
      genres: product.Properties?.Category ? [String(product.Properties.Category)] : [],
      releaseDate: Number.isFinite(release) ? new Date(release).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '',
      categories,
      screenshots,
      dlcStatus: 'unavailable',
      rating: xboxAgeRating(product),
      metadataSource: 'Xbox Store',
      // The Xbox app's "Playable on", "Capabilities" and publisher info come straight from these.
      xboxInfo: {
        attributes: attributes.map(entry => ({ name: String(entry.Name || ''), platforms: (entry.ApplicablePlatforms || []).map(String) })).filter(entry => entry.name),
        platforms: ['PC', ...((product.Properties?.XboxConsoleGenOptimized || product.Properties?.XboxConsoleGenCompatible || []).includes('ConsoleGen9') ? ['Xbox Series X|S'] : []),
          ...((product.Properties?.XboxConsoleGenCompatible || []).includes('ConsoleGen8') ? ['Xbox One'] : [])],
        playAnywhere: hasAttribute('XPA'),
        consoleOptimized: (product.Properties?.XboxConsoleGenOptimized || []).includes('ConsoleGen9'),
        installTerms: String(product.DisplaySkuAvailabilities?.[0]?.Sku?.Properties?.InstallationTerms || ''),
        address: String(localized.PublisherAddress || '').trim(),
        phone: String(localized.SupportPhone || '').trim(),
        supportUri: String(localized.SupportUri || '').trim(),
        websiteUri: String(localized.PublisherWebsiteUri || '').trim(),
        productId: String(product.ProductId || '')
      }
    };
  } catch { return null; }
}

// Steam's pc_requirements HTML ("<li><strong>Processor:</strong> …</li>") as [label, value] rows.
function parseSteamRequirements(html) {
  const rows = [];
  for (const match of String(html || '').matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
    const text = match[1].replace(/<br\s*\/?>/gi, ' ');
    const label = (text.match(/<strong>([^<]+?):?\s*<\/strong>/i)?.[1] || '').replace(/[*:]+\s*$/, '').trim();
    const value = text.replace(/<strong>[^<]*<\/strong>/i, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (value) rows.push([label || 'Notes', value]);
  }
  return rows.slice(0, 12);
}

// Steam's store category ids (the same ones its store filters use).
const steamCategoryNames = { 1: 'Multi-player', 2: 'Single-player', 9: 'Co-op', 18: 'Partial Controller Support', 20: 'MMO', 24: 'Shared/Split Screen', 27: 'Cross-Platform Multiplayer',
  28: 'Full controller support', 36: 'Online PvP', 37: 'Shared/Split Screen PvP', 38: 'Online Co-op', 39: 'Shared/Split Screen Co-op', 44: 'Remote Play Together', 47: 'LAN PvP', 48: 'LAN Co-op', 49: 'PvP' };
const steamAppTypes = ['game', 'demo', 'mod', 'movie', 'dlc', 'guide', 'software', 'video', 'series', 'episode', 'hardware', 'music', 'beta', 'tool', 'advertising'];
// Store details for many games in one call. The old appdetails endpoint no longer answers for more than one app,
// so the whole library came back without categories and the controller and Play together lists stayed empty.
async function fetchSteamAppDetails(appIds, countryCode = steamCountry()) {
  try {
    const url = new URL('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/');
    url.searchParams.set('input_json', JSON.stringify({ ids: appIds.map(appid => ({ appid: Number(appid) })), context: { language: 'english', country_code: countryCode },
      data_request: { include_basic_info: true } }));
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) return {};
    const body = await response.json();
    return Object.fromEntries((body?.response?.store_items || []).flatMap(item => {
      if (!item?.appid || item.success !== 1) return [];
      const ids = [...(item.categories?.supported_player_categoryids || []), ...(item.categories?.controller_categoryids || [])].map(Number);
      const controls = ids.includes(28) ? 'controller' : ids.includes(18) ? 'partial' : 'kbm';
      return [[String(item.appid), { type: steamAppTypes[Number(item.type)] || 'game', controls, categoryIds: ids, categories: ids.map(id => steamCategoryNames[id]).filter(Boolean),
        publishers: (item.basic_info?.publishers || []).map(entry => String(entry.name || '')).filter(Boolean).slice(0, 3),
        developers: (item.basic_info?.developers || []).map(entry => String(entry.name || '')).filter(Boolean).slice(0, 3) }]];
    }));
  } catch {
    return {};
  }
}

async function fetchPsnSquareArtwork(title) {
  try {
    const endpoint = new URL('https://web.np.playstation.com/api/graphql/v1//op');
    endpoint.searchParams.set('operationName', 'getSearchResults');
    endpoint.searchParams.set('variables', JSON.stringify({ countryCode: 'US', languageCode: 'en', nextCursor: '', pageOffset: 0, pageSize: 24, searchTerm: title }));
    endpoint.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: '4df6284f982e57bec70f23c77e2c219dc792eb19af7fb3d3a81767aa3f1958aa' } }));
    const response = await fetch(endpoint, { headers: { 'Content-Type': 'application/json', Origin: 'https://store.playstation.com', Referer: 'https://store.playstation.com/', 'apollographql-client-name': '@sie-ppr-web-store/app', 'apollographql-client-version': '0.113.0', 'X-PSN-Store-Locale-Override': 'en-US' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const results = (await response.json())?.data?.universalSearch?.results || [];
    const match = results.filter((item) => !['ADD_ON', 'ADD_ON_PACK', 'DEMO', 'VIRTUAL_CURRENCY'].includes(item.storeDisplayClassification) && titleMatchScore(title, item.name) >= 82)
      .sort((a, b) => titleMatchScore(title, b.name) - titleMatchScore(title, a.name))[0];
    if (!match) return null;
    const media = match.media || [];
    const image = (roles) => roles.map((role) => media.find((item) => item.type === 'IMAGE' && item.role === role)?.url).find(Boolean);
    const tile = image(['MASTER', 'GAMEHUB_COVER_ART', 'EDITION_KEY_ART']);
    if (!tile || !/^https:\/\/image\.api\.playstation\.com\//i.test(tile)) return null;
    const hero = image(['BACKGROUND', 'SIXTEEN_BY_NINE_BANNER', 'BACKGROUND_LAYER_ART']);
    return { tile, grid: tile, tileIsSquare: true, hero: hero || null, wide: hero || null, imageSource: 'playstation-store' };
  } catch { return null; }
}

async function fetchIgnSquareArtwork(title) {
  try {
    const endpoint = new URL('https://mollusk.apis.ign.com/graphql');
    endpoint.searchParams.set('operationName', 'SearchObjectsByName');
    endpoint.searchParams.set('variables', JSON.stringify({ term: title, count: 20, objectType: 'Game' }));
    endpoint.searchParams.set('extensions', JSON.stringify({ persistedQuery: { version: 1, sha256Hash: 'e1c2e012a21b4a98aaa618ef1b43eb0cafe9136303274a34f5d9ea4f2446e884' } }));
    const response = await fetch(endpoint, { headers: { 'Content-Type': 'application/json', Referer: 'https://www.ign.com/reviews/games', 'apollographql-client-name': 'kraken', 'apollographql-client-version': 'v0.67.0' }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const results = (await response.json())?.data?.searchObjectsByName?.objects || [];
    const match = results.filter((item) => titleMatchScore(title, item.metadata?.names?.name) >= 85)
      .sort((a, b) => titleMatchScore(title, b.metadata?.names?.name) - titleMatchScore(title, a.metadata?.names?.name))[0];
    const tile = match?.primaryImage?.url;
    if (!tile || !/^https:\/\/assets-prd\.ignimgs\.com\//i.test(tile)) return null;
    return { tile, grid: tile, tileIsSquare: true, imageSource: 'ign' };
  } catch { return null; }
}

// Steam's own library art for an exact app ID: always the right game, used when no store match is confident.
async function fetchSteamOfficialArtwork(appId) {
  if (!/^\d{1,10}$/.test(String(appId || ''))) return null;
  const base = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}`;
  const ok = async url => { try { const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(3500) }); return response.ok ? url : null; } catch { return null; } };
  const [portrait, header, hero, logo] = await Promise.all([ok(`${base}/library_600x900_2x.jpg`).then(url => url || ok(`${base}/library_600x900.jpg`)), ok(`${base}/header.jpg`), ok(`${base}/library_hero.jpg`), ok(`${base}/logo.png`)]);
  if (!portrait && !header) return null;
  return { tile: portrait || header, grid: portrait || header, tileIsSquare: false, hero: hero || header, wide: header, logo: logo || null, imageSource: 'official-steam' };
}
// "– Multiplayer", "– Zombies" and similar split launchers share their base game's artwork.
function artworkLookupTitle(title) {
  return String(title || '').replace(/\s*[-–:]\s*(multiplayer|zombies|campaign|single ?player|mp|sp|beta|dedicated server|server|demo)\s*$/i, '').trim() || String(title || '');
}
async function findArtwork(rawTitle, apiKey, provider = 'PC', fullArt = true, appId = '') {
  const title = artworkLookupTitle(rawTitle);
  const [psn, xbox, ign, steamOfficial] = await Promise.all([
    fetchPsnSquareArtwork(title), fetchXboxCatalogArtwork(title), fetchIgnSquareArtwork(title),
    provider === 'Steam' && appId ? fetchSteamOfficialArtwork(appId) : null
  ]);
  let sgdb = null;
  let sgdbError = '';
  if (apiKey && (fullArt || !(xbox?.tile || ign?.tile || psn?.tile))) {
    try {
      const results = await fetchSgdbJson(`/search/autocomplete/${encodeURIComponent(title)}`, apiKey);
      if (results.length) {
        const ranked = results
          .map((result) => ({ ...result, matchScore: titleMatchScore(title, result.name) }))
          .sort((a, b) => b.matchScore - a.matchScore);
        const best = ranked[0];
        const second = ranked[1];
        // Automatic art should be conservative: a plausible franchise/edition
        // match is not enough to silently attach its logo and screenshots.
        if (!best?.id || (best.matchScore < 92 && !(best.matchScore >= 88 && best.matchScore - (second?.matchScore || 0) >= 12))) {
          throw new Error('No confident SteamGridDB title match');
        }
        const gameId = best.id;
        const [squareGrids, logos, heroes] = await Promise.all([
          fetchSgdbJson(`/grids/game/${gameId}?dimensions=512x512,1024x1024&types=static&nsfw=false`, apiKey),
          fetchSgdbJson(`/logos/game/${gameId}?types=static&nsfw=false`, apiKey),
          fetchSgdbJson(`/heroes/game/${gameId}?types=static&nsfw=false`, apiKey)
        ]);
        const logo = logos.find((asset) => asset.width / asset.height > 2.2) || logos[0];
        const square = squareGrids.find((asset) => Number(asset.width) === Number(asset.height));
        sgdb = {
          tile: square?.url || null,
          grid: square?.url || null,
          tileIsSquare: Boolean(square),
          hero: heroes[0]?.url || null,
          wide: null,
          logo: logo?.url || null,
          controls: 'unknown',
          sgdbGameId: gameId,
          imageSource: square ? 'steamgriddb-square' : 'none'
        };
      }
    } catch (error) {
      sgdbError = error.message || 'SteamGridDB request failed';
    }
  }

  if (!sgdb?.tile && !xbox?.tile && !psn?.tile && !ign?.tile && apiKey && sgdb?.sgdbGameId) {
    try {
      const [verticalGrids, wideGrids] = await Promise.all([
        fetchSgdbJson(`/grids/game/${sgdb.sgdbGameId}?dimensions=600x900,660x930,342x482&types=static&nsfw=false`, apiKey),
        fetchSgdbJson(`/grids/game/${sgdb.sgdbGameId}?dimensions=460x215,920x430&types=static&nsfw=false`, apiKey)
      ]);
      const fallback = verticalGrids[0] || wideGrids[0];
      sgdb.tile = fallback?.url || null;
      sgdb.grid = fallback?.url || null;
      sgdb.wide = wideGrids[0]?.url || null;
      sgdb.imageSource = fallback ? 'steamgriddb-fallback' : 'none';
    } catch (error) {
      sgdbError = error.message || sgdbError;
    }
  }

  // Covers: Xbox, then IGN, then PlayStation, then SteamGridDB.
  const selected = xbox?.tile ? xbox : ign?.tile ? ign : psn?.tile ? psn : sgdb?.tile ? sgdb : steamOfficial?.tile ? steamOfficial : sgdb || xbox || ign || psn || {};
  const hasArtwork = Boolean(selected.tile || selected.hero || sgdb?.hero || xbox?.hero || steamOfficial?.hero);
  const coverCandidates = [xbox, ign, psn, sgdb, steamOfficial].filter((source) => source?.tile && isAllowedArtworkUrl(source.tile))
    .filter((source, index, sources) => sources.findIndex((candidate) => candidate.tile === source.tile) === index)
    .map((source) => ({ tile: source.tile, imageSource: source.imageSource, tileIsSquare: Boolean(source.tileIsSquare) }));
  return {
    tile: selected.tile || null,
    grid: selected.grid || selected.tile || null,
    tileIsSquare: Boolean(selected.tileIsSquare),
    hero: xbox?.hero || psn?.hero || sgdb?.hero || steamOfficial?.hero || selected.tile || null,
    wide: xbox?.wide || psn?.wide || sgdb?.wide || steamOfficial?.wide || null,
    logo: xbox?.logo || sgdb?.logo || steamOfficial?.logo || null,
    controls: xbox?.controls || 'unknown',
    sgdbGameId: sgdb?.sgdbGameId || null,
    imageSource: selected.imageSource || (hasArtwork ? 'steamgriddb-fallback' : 'none'),
    coverCandidates,
    artworkVersion: 9,
    artworkError: hasArtwork ? '' : sgdbError,
    artworkPriority: 'xbox-then-ign-then-psn-then-steamgriddb',
    provider
  };
}

function isSteamAppType(type) {
  return ['software', 'application', 'tool', 'video', 'music'].includes(String(type || '').toLowerCase());
}

async function findLegendaryExecutable(configuredPath = '') {
  const candidates = [configuredPath];
  for (const directory of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) candidates.push(path.join(directory, 'legendary.exe'));
  for (const root of [process.env.ProgramFiles, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')].filter(Boolean)) {
    for (const name of ['Heroic', 'heroic']) candidates.push(path.join(root, name, 'resources', 'app.asar.unpacked', 'build', 'bin', 'x64', 'win32', 'legendary.exe'));
  }
  for (const candidate of candidates) {
    if (!candidate || path.basename(candidate).toLowerCase() !== 'legendary.exe') continue;
    if (await exists(candidate)) return candidate;
  }
  return '';
}

function parseLegendaryGames(output) {
  const parsed = JSON.parse(output);
  if (!Array.isArray(parsed)) throw new Error('Legendary did not return a game list.');
  return parsed.filter(item => item && typeof item === 'object' && item.app_name && item.app_title)
    .filter(item => !item.is_dlc && !/unreal engine|marketplace/i.test(item.app_title))
    .map(item => ({ id: `epic-owned-${String(item.app_name).replace(/[^a-z\d_-]/gi, '').slice(0, 80)}`, title: String(item.app_title).trim().slice(0, 160), provider: 'Epic Games', epicAppName: String(item.app_name), epicOwned: true, installed: false }))
    .filter(item => item.title && item.id !== 'epic-owned-');
}

async function fetchOwnedEpicGames(settings) {
  if (process.env.NEBULA_DEMO === '1') return { games: [], status: 'needs-helper', helperPath: '' };
  const helperPath = await findLegendaryExecutable(settings.legendaryPath);
  if (!helperPath) return { games: [], status: 'needs-helper', helperPath: '' };
  if (!settings.showUninstalledEpic) return { games: [], status: 'available', helperPath };
  try {
    const output = await new Promise((resolve, reject) => execFile(helperPath, ['list', '--json'], { windowsHide: true, timeout: 30000, maxBuffer: 30 * 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolve(stdout)));
    const games = parseLegendaryGames(output);
    return { games, status: 'ready', helperPath };
  } catch { return { games: [], status: 'sign-in-required', helperPath }; }
}

// Install sizes for launchers that do not report one. Folders are measured once in the
// background, one at a time, and cached on disk for a week.
let installSizeCache = null;
let installSizeRunning = false;
function installSizeFile() { return path.join(path.dirname(settingsPath()), 'install-sizes.json'); }
async function readInstallSizes() {
  if (installSizeCache) return installSizeCache;
  try { installSizeCache = JSON.parse(await fs.readFile(installSizeFile(), 'utf8')) || {}; } catch { installSizeCache = {}; }
  return installSizeCache;
}
async function measureFolderSize(folder, { files = 400000, until = Date.now() + 60000 } = {}) {
  let total = 0, seen = 0;
  const stack = [folder];
  while (stack.length && seen < files && Date.now() < until) {
    const current = stack.pop();
    let entries = [];
    try { entries = await fs.readdir(current, { withFileTypes: true }); } catch { continue; }
    const sizes = await Promise.all(entries.map(async (entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { stack.push(full); return 0; }
      if (!entry.isFile()) return 0;
      seen++;
      try { return (await fs.stat(full)).size; } catch { return 0; }
    }));
    for (const size of sizes) total += size;
  }
  return { bytes: total, complete: !stack.length };
}
function needsMeasuredSize(game) {
  return game.installed !== false && !game.sizeOnDisk && !game.isLauncher && game.installPath && game.provider !== 'Steam';
}
async function applyCachedInstallSizes(games) {
  const cache = await readInstallSizes();
  for (const game of games) if (needsMeasuredSize(game) && cache[game.installPath]?.bytes) game.sizeOnDisk = cache[game.installPath].bytes;
}
async function measureInstallSizes() {
  if (installSizeRunning || process.env.NEBULA_DEMO === '1') return;
  installSizeRunning = true;
  try {
    const cache = await readInstallSizes();
    const pending = currentLibrary.filter((game) => needsMeasuredSize(game) || (game.provider !== 'Steam' && game.installPath && cache[game.installPath] && Date.now() - cache[game.installPath].at > 7 * 24 * 60 * 60 * 1000));
    for (const game of pending) {
      if (!await exists(game.installPath)) continue;
      const measured = await measureFolderSize(game.installPath);
      if (!measured.bytes) continue;
      cache[game.installPath] = { bytes: measured.bytes, at: Date.now() };
      game.sizeOnDisk = measured.bytes;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:sizes', { [game.id]: measured.bytes });
      await fs.writeFile(installSizeFile(), JSON.stringify(cache)).catch(() => {});
    }
  } finally { installSizeRunning = false; }
}

async function scanLibrary({ refreshArt = false } = {}) {
  const scanEpoch = ++artworkScanEpoch;
  const progress = (percent, message) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:progress', { percent, message });
  };
  progress(3, 'Finding installed games and your Steam library…');
  if (process.env.NEBULA_DEMO === '1' && process.env.NEBULA_REVIEW_SCAN_DELAY) {
    await new Promise(resolve => setTimeout(resolve, Math.min(5000, Number(process.env.NEBULA_REVIEW_SCAN_DELAY) || 0)));
  }
  const settings = await readSettings();
  const steamAccount = settings.steamId64 || await detectSteamId64();
  const steamFamilyAccount = settings.steamFamilyAccountId || steamAccount;
  const [found, ownedResult, epicOwnedResult, steamLocal, publishers, eaOwned, battleOwned, familyResult] = await Promise.all([
    process.env.NEBULA_DEMO === '1'
      ? [[
        { id: 'demo-1', title: 'Forza Horizon 5', provider: 'Steam', appId: '1551360', executable: process.execPath, sizeOnDisk: 161061273600, buildId: '15890211', lastUpdated: Date.UTC(2026, 8, 4) },
        { id: 'demo-2', title: 'Halo Infinite', provider: 'Steam', appId: '1240440', executable: process.execPath, sizeOnDisk: 52613349376, buildId: '14220877', lastUpdated: Date.UTC(2026, 7, 21) },
        { id: 'demo-3', title: 'Lies of P', provider: 'PC', executable: process.execPath },
        { id: 'demo-4', title: 'Hi-Fi RUSH', provider: 'Epic Games', executable: process.execPath },
        { id: 'demo-5', title: 'Sea of Thieves', provider: 'Steam', appId: '1172620', executable: process.execPath, sizeOnDisk: 85899345920, buildId: '15012344', lastUpdated: Date.UTC(2026, 8, 30) },
        { id: 'demo-6', title: 'Senua’s Saga', provider: 'PC', executable: process.execPath }
      ], [{ id: 'launcher-steam', title: 'Steam', provider: 'Steam', executable: process.execPath, isApp: true, isLauncher: true }, { id: 'launcher-epic-games-launcher', title: 'Epic Games Launcher', provider: 'Epic Games', executable: process.execPath, isApp: true, isLauncher: true }]]
      : Promise.all([scanSteam(), scanEpic(), scanXboxGames(), scanPublisherShortcuts(), scanInstalledLaunchers()]),
    process.env.NEBULA_DEMO === '1' ? Promise.resolve({ games: [], status: 'disabled' }) : fetchOwnedSteamGames(settings),
    fetchOwnedEpicGames(settings),
    localSteamLibrary(),
    process.env.NEBULA_DEMO === '1' ? {games:[],ubisoftStatus:'not-connected',ubisoftCount:0} : scanLocalPublishers(settings.showUninstalledUbisoft),
    settings.showUninstalledEA ? accountLibraries.library('ea') : {games:[],status:'disabled'},
    settings.showUninstalledBattleNet ? accountLibraries.library('battlenet') : {games:[],status:'disabled'},
    settings.includeSteamFamily ? steamFamily.library(steamFamilyAccount) : {games:[],status:'disabled'}
  ]);
  publisherLocalStatus = {ubisoftStatus:publishers.ubisoftStatus,ubisoftCount:publishers.ubisoftCount};
  const ownedByAppId = new Map(ownedResult.games.map((game) => [game.appId, game]));
  const familyByAppId = new Map(familyResult.games.map(game=>[game.appId,game]));
  const demo = process.env.NEBULA_DEMO === '1';
  const gogOwned = settings.showUninstalledGog && !demo ? readGogOwned() : { games: [] }, amazonOwned = settings.showUninstalledAmazon && !demo ? readAmazonOwned() : { games: [] };
  const installed = mergePublisherGames(mergePublisherGames(found.flat(), publishers.games), [...eaOwned.games,...battleOwned.games,...gogOwned.games,...amazonOwned.games]).map((game) => ({
    ...game,
    installed: game.installed !== false,
    steamPlaytimeMinutes: Math.max(ownedByAppId.get(game.appId)?.steamPlaytimeMinutes || 0,familyByAppId.get(game.appId)?.steamPlaytimeMinutes || 0),
    steamOwned: Boolean(ownedByAppId.has(game.appId) || familyByAppId.get(game.appId)?.steamOwned),
    steamFamilyShared: game.provider === 'Steam' && !ownedByAppId.has(game.appId) && familyByAppId.get(game.appId)?.steamFamilyShared === true
  }));
  const installedIds = new Set(installed.filter((game) => game.provider === 'Steam').map((game) => game.appId));
  const remoteGames = settings.showUninstalledSteam ? ownedResult.games.filter((game) => !installedIds.has(game.appId)).map((game) => ({ ...game, steamOwned: true })) : [];
  const remoteIds = new Set(remoteGames.map(game=>game.appId));
  // Family games you haven't installed follow the Steam switch: "installed games only" means none of them.
  const familyGames = !settings.showUninstalledSteam ? [] : familyResult.games.filter(game=>game.steamFamilyShared && !ownedByAppId.has(game.appId) && !installedIds.has(game.appId) && !remoteIds.has(game.appId))
    .map(game=>({...game,steamFamilyImported:true}));
  const installedEpicTitles = new Set(installed.filter(game => game.provider === 'Epic Games').map(game => normalizeTitle(game.title)));
  const remoteEpicGames = settings.showUninstalledEpic ? epicOwnedResult.games.filter(game => !installedEpicTitles.has(normalizeTitle(game.title))) : [];
  const everything = [...installed, ...remoteGames, ...familyGames, ...remoteEpicGames, ...(settings.customGames || []).map((game) => ({ installed: true, ...game, isCustom: true }))];
  const merged = applySteamLocalData(everything, steamLocal);
  // Games hidden in Steam stay out of the library and search, but are listed under Hidden, as in Steam.
  const steamHiddenSet = new Set(steamLocal.hiddenIds || []);
  const steamHiddenGames = everything.filter((game, index, list) => game.provider === 'Steam' && steamHiddenSet.has(String(game.appId)) && list.findIndex(other => other.provider === 'Steam' && other.appId === game.appId) === index);
  progress(28, `Found ${merged.length} library items. Checking game types…`);
  const byId = new Map();
  const seen = new Set();
  for (const game of merged) {
    const dedupeKey = game.isCustom ? game.id : game.provider === 'Steam' && game.appId ? `steam-${game.appId}` : `${normalizeTitle(game.title)}:${game.provider}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    byId.set(game.id, game);
  }
  const artwork = { ...(settings.artwork || {}) };
  const steamAppDetails = { ...(settings.steamAppDetails || {}) };
  const steamGames = [...byId.values()].filter((game) => game.provider === 'Steam' && game.appId);
  const detailsPending = steamGames.filter((game) => {
    const cached = steamAppDetails[game.appId];
    return !cached?.type || !Array.isArray(cached.categoryIds) || !Array.isArray(cached.publishers) || (cached.checkedAt && Date.now() - cached.checkedAt > 30 * 24 * 60 * 60 * 1000);
  }).sort((a, b) => Number(b.installed !== false) - Number(a.installed !== false)).slice(0, 2000);
  // Steam's app-type lookup waits at most 4 seconds before the library is shown; the rest finishes behind it.
  const detailsTask = (async () => {
  for (let index = 0; index < detailsPending.length; index += 300) {
    const groups = Array.from({ length: Math.min(3, Math.ceil((detailsPending.length - index) / 100)) }, (_, groupIndex) => detailsPending.slice(index + groupIndex * 100, index + (groupIndex + 1) * 100));
    await Promise.all(groups.map(async (batch) => {
      const details = await fetchSteamAppDetails(batch.map((game) => game.appId));
      for (const game of batch) {
        const fetched = details[game.appId];
        const localType = game.steamType || '';
        steamAppDetails[game.appId] = {
          ...(steamAppDetails[game.appId] || {}),
          ...(fetched || {}),
          type: fetched?.type || localType || steamAppDetails[game.appId]?.type || '',
          controls: fetched?.controls || steamAppDetails[game.appId]?.controls || 'unknown',
          categories: fetched?.categories || steamAppDetails[game.appId]?.categories || [],
          checkedAt: fetched?.type || localType ? Date.now() : 0
        };
      }
    }));
  }
  if (detailsPending.length) await writeSettings({ steamAppDetails });
  })().catch(() => {});
  if (detailsPending.length) await Promise.race([detailsTask, new Promise(resolve => setTimeout(resolve, 4000))]);
  progress(42, 'Preparing your game artwork…');
  const playHistory = settings.playHistory || [];
  const historyRank = new Map(playHistory.map((id, index) => [id, index]));
  const hiddenIds = new Set(settings.hiddenGameIds || []);
  const steamArt = (game) => game.provider === 'Steam' && /^\d+$/.test(String(game.appId || '')) ? { tile: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.appId}/library_600x900.jpg`, tileIsSquare: false } : null;
  const hiddenGames = [...[...byId.values()].filter((game) => hiddenIds.has(game.id)), ...steamHiddenGames.filter(game => !hiddenIds.has(game.id))]
    .map((game) => ({ id: game.id, appId: game.appId || '', title: game.title, provider: game.provider, installed: game.installed !== false, steamHidden: steamHiddenSet.has(String(game.appId)) && game.provider === 'Steam',
      artwork: artwork[game.id] || game.artwork || steamArt(game) }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const visible = [...byId.values()]
    .filter((game) => !hiddenIds.has(game.id))
    .sort((a, b) => {
      const aRank = historyRank.has(a.id) ? historyRank.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bRank = historyRank.has(b.id) ? historyRank.get(b.id) : Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.title.localeCompare(b.title);
    });

  const capabilitiesByGame = {};
  for (const game of visible.filter((item) => item.provider === 'Steam' && item.appId)) {
    capabilitiesByGame[game.id] = steamAppDetails[game.appId]?.controls || 'unknown';
  }
  currentLibrary = visible.map((game) => ({
    ...game,
    artwork: artwork[game.id] || game.artwork || null,
    steamType: game.provider === 'Steam' ? (steamAppDetails[game.appId]?.type || game.steamType || 'game') : null,
    steamCategories: game.provider === 'Steam' ? (steamAppDetails[game.appId]?.categories || []) : [],
    publisher: game.publisher || (game.provider === 'Steam' ? steamAppDetails[game.appId]?.publishers?.[0] || '' : ''),
    isApp: game.isLauncher || (typeof settings.gameCategoryOverrides?.[game.id] === 'boolean'
      ? settings.gameCategoryOverrides[game.id]
      : game.isCustom ? Boolean(game.isApp) : game.provider === 'Steam' && isSteamAppType(steamAppDetails[game.appId]?.type || game.steamType)),
    installed: game.installed !== false,
    steamPlaytimeMinutes: Number(game.steamPlaytimeMinutes) || 0,
    playCount: Number((settings.playCounts || {})[game.id] || 0),
    launchOptions: (settings.gameLaunchOptions || {})[game.id] || '',
    achievementReferenceAppId: (settings.achievementReferenceAppIds || {})[game.id] || '',
    controls: capabilitiesByGame[game.id] || game.controls || artwork[game.id]?.controls || 'unknown'
  }));
  const latestPlaySettings = await readSettings();
  const latestHistoryRank = new Map((latestPlaySettings.playHistory || []).map((id, index) => [id, index]));
  currentLibrary.forEach((game) => { game.playCount = Number(latestPlaySettings.playCounts?.[game.id] || 0); });
  currentLibrary.sort((a, b) => (latestHistoryRank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (latestHistoryRank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  const librarySummary = { hiddenGames, steamStatus: ownedResult.status, steamOwnedCount: ownedResult.count || 0, steamId64: ownedResult.steamId64 || '', showUninstalledSteam: settings.showUninstalledSteam === true, steamApiKeyConfigured: Boolean(settings.steamApiKey), epicStatus: epicOwnedResult.status, epicOwnedCount: epicOwnedResult.games.length, epicHelperPath: epicOwnedResult.helperPath, showUninstalledEpic: settings.showUninstalledEpic === true,
    steamFamilyStatus:familyResult.status,steamFamilyCount:familyResult.games.filter(game=>game.steamFamilyShared).length,steamFamilyAccount:familyResult.steamId || steamAccount,
    duplicateMode:settings.duplicateMode,duplicatePreferredProvider:settings.duplicatePreferredProvider,duplicatePreferences:settings.duplicatePreferences };
  await applyCachedInstallSizes(currentLibrary);
  setTimeout(() => measureInstallSizes().catch(() => {}), 8000);
  if (scanEpoch === artworkScanEpoch) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:initial', { games: currentLibrary, ...librarySummary });
    await writeLibrarySnapshot({ games: currentLibrary, ...librarySummary }, scanEpoch).catch(() => {});
  }
  if (settings.steamApiKey) {
    fetchSteamCurrentPopularity(settings.steamApiKey).then(({ ranks, status }) => {
      if (scanEpoch !== artworkScanEpoch || !mainWindow || mainWindow.isDestroyed()) return;
      const libraryRanks = Object.fromEntries(currentLibrary.filter((game) => game.provider === 'Steam' && ranks.has(String(game.appId))).map((game) => [game.id, ranks.get(String(game.appId))]));
      mainWindow.webContents.send('library:trending', { ranks: libraryRanks, status });
    });
  }

  if ((settings.steamGridDbKey || visible.length) && (process.env.NEBULA_DEMO !== '1' || process.env.NEBULA_DEMO_ART === '1')) {
    // One image shared by different games means at least one of them matched the wrong store listing.
    const tileOwners = new Map();
    for (const game of visible) { const tile = artwork[game.id]?.tile; if (tile && !artwork[game.id]?.manual) tileOwners.set(tile, (tileOwners.get(tile) || 0) + 1); }
    const pending = visible.filter((game) => {
      if (game.isLauncher) return false;
      const cached = artwork[game.id];
      const version = Number(cached?.artworkVersion) || 0;
      // Games that already have artwork keep it. Only missing art, or a failed lookup a week old, is fetched again.
      // Before version 9: numbered/dated titles, art shared with another game, and Steam games with none are checked again once.
      return !cached?.manual && (refreshArt || !cached || version < 6
        || (version < 9 && (titleNeedsRecheck(game.title) || tileOwners.get(cached.tile) > 1 || (game.provider === 'Steam' && !cached.tile)))
        || (!cached.tile && !cached.hero && Date.now() - (cached.lastAttemptedAt || 0) > 7 * 24 * 60 * 60 * 1000));
    }).sort((a, b) => (historyRank.has(a.id) ? historyRank.get(a.id) : Number.MAX_SAFE_INTEGER) - (historyRank.has(b.id) ? historyRank.get(b.id) : Number.MAX_SAFE_INTEGER)
      || Number(b.installed !== false) - Number(a.installed !== false)
      || (Number(b.steamPlaytimeMinutes) || 0) - (Number(a.steamPlaytimeMinutes) || 0)
      || a.title.localeCompare(b.title));
    for (let index = 0; index < pending.length; index += 3) {
      if (scanEpoch !== artworkScanEpoch) break;
      const batch = pending.slice(index, index + 3);
      await Promise.all(batch.map(async (game) => {
        try {
          const foundArtwork = await findArtwork(game.title, settings.steamGridDbKey, game.provider, false, game.appId);
          const existingLogo = artwork[game.id]?.artworkVersion >= 6 && !(artwork[game.id].artworkVersion < 8 && titleNeedsRecheck(game.title))
            ? (currentLibrary.find((item) => item.id === game.id)?.artwork?.logo || artwork[game.id]?.logo)
            : null;
          artwork[game.id] = { ...(foundArtwork || { artworkVersion: 9, imageSource: 'none' }), logo: foundArtwork?.logo || existingLogo || null, lastAttemptedAt: Date.now() };
        } catch (error) {
          // A failed lookup must not bless old, potentially mismatched artwork
          // with the new matcher's version: leave it eligible for a retry.
          artwork[game.id] = { ...(artwork[game.id] || {}), imageSource: artwork[game.id]?.imageSource || 'none', lastAttemptedAt: Date.now(), artworkError: error.message };
        }
      }));
      if (scanEpoch !== artworkScanEpoch) break;
      const changes = batch.map((game) => ({ id: game.id, artwork: artwork[game.id] }));
      for (const change of changes) {
        const current = currentLibrary.find((game) => game.id === change.id);
        if (current) { current.artwork = change.artwork; if (current.controls === 'unknown') current.controls = change.artwork?.controls || 'unknown'; }
      }
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:artwork', changes);
      progress(42 + Math.round(53 * Math.min(index + batch.length, pending.length) / Math.max(pending.length, 1)), `Artwork ${Math.min(index + batch.length, pending.length)} of ${pending.length}…`);
      if (index % 15 === 0) await writeSettings({ artwork });
    }
    if (scanEpoch === artworkScanEpoch) await writeSettings({ artwork });
  }

  if (scanEpoch === artworkScanEpoch && (process.env.NEBULA_DEMO !== '1' || process.env.NEBULA_DEMO_ART === '1')) {
    const toCache = currentLibrary.filter(game => game.artwork && !game.isLauncher);
    const cacheOne = async game => {
      const cached = await artworkCache.cacheArtwork(game.artwork);
      if (scanEpoch !== artworkScanEpoch) return;
      game.artwork = cached;
      artwork[game.id] = cached;
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:artwork', [{ id: game.id, artwork: cached }]);
    };
    artworkCacheTask = (async () => {
      for (let index = 0; index < toCache.length && scanEpoch === artworkScanEpoch; index += 4) {
        await Promise.all(toCache.slice(index, index + 4).map(cacheOne));
        if (index % 40 === 0) progress(95 + Math.round(4 * index / Math.max(toCache.length, 1)), `Saving artwork for offline use…`);
      }
    })();
    await artworkCacheTask.catch(() => {});
    if (scanEpoch === artworkScanEpoch) await writeSettings({ artwork });
  }

  if (scanEpoch === artworkScanEpoch) await writeLibrarySnapshot({ games: currentLibrary, ...librarySummary }, scanEpoch).catch(() => {});
  progress(100, `${currentLibrary.length} library items ready`);
  return { games: currentLibrary, ...librarySummary };
}

function launchExecutable(filePath, args = '', cwd = path.dirname(filePath)) {
  const parsedArgs = Array.isArray(args)
    ? args.map(String)
    : args.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((arg) => arg.replace(/^"|"$/g, '')) || [];
  return new Promise((resolve, reject) => {
    const child = spawn(filePath, parsedArgs, { detached: true, stdio: 'ignore', cwd, windowsHide: true });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve(child.pid);
    });
  });
}

function isAllowedArtworkUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol === 'file:') {
      const local = path.resolve(fileURLToPath(url));
      return local.startsWith(`${path.resolve(path.dirname(settingsPath()), 'artwork-cache')}${path.sep}`);
    }
    return url.protocol === 'https:' && ['cdn2.steamgriddb.com', 'cdn.steamgriddb.com', 'cdn.akamai.steamstatic.com', 'shared.fastly.steamstatic.com', 'store-images.s-microsoft.com', 'images-eds.xboxlive.com', 'image.api.playstation.com', 'assets-prd.ignimgs.com'].includes(url.hostname);
  } catch {
    return false;
  }
}

async function fetchArtworkForSgdbGame(game, apiKey) {
  const [squares, verticals, wides, logos, heroes] = await Promise.all([
    fetchSgdbJson(`/grids/game/${game.id}?dimensions=512x512,1024x1024&types=static&nsfw=false`, apiKey),
    fetchSgdbJson(`/grids/game/${game.id}?dimensions=600x900,660x930,342x482&types=static&nsfw=false`, apiKey),
    fetchSgdbJson(`/grids/game/${game.id}?dimensions=460x215,920x430&types=static&nsfw=false`, apiKey),
    fetchSgdbJson(`/logos/game/${game.id}?types=static&nsfw=false`, apiKey),
    fetchSgdbJson(`/heroes/game/${game.id}?types=static&nsfw=false`, apiKey)
  ]);
  const logo = logos.find((asset) => asset.width / asset.height > 2.2) || logos[0];
  const choices = [...squares, ...verticals, ...wides].slice(0, 36).map((asset) => ({
    url: asset.url,
    width: Number(asset.width),
    height: Number(asset.height),
    tileIsSquare: Number(asset.width) === Number(asset.height)
  }));
  return {
    game: { id: game.id, name: game.name }, choices,
    heroChoices: heroes.slice(0, 30).map((asset) => ({ url: asset.url, width: Number(asset.width), height: Number(asset.height) })),
    logoChoices: logos.slice(0, 30).map((asset) => ({ url: asset.url, width: Number(asset.width), height: Number(asset.height) })),
    logo: logo?.url || null, hero: heroes[0]?.url || null
  };
}

async function searchArtwork(query, selectedGameId = '') {
  const settings = await readSettings();
  if (!settings.steamGridDbKey) throw new Error('Add a SteamGridDB API key in Settings first.');
  const matches = await fetchSgdbJson(`/search/autocomplete/${encodeURIComponent(query)}`, settings.steamGridDbKey);
  if (!matches.length) return { game: null, games: [], choices: [], heroChoices: [], logoChoices: [], logo: null, hero: null };
  const games = [...matches]
    .map((game) => ({ id: game.id, name: game.name, matchScore: titleMatchScore(query, game.name) }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 10);
  const game = games.find((candidate) => String(candidate.id) === String(selectedGameId)) || games[0];
  return { ...await fetchArtworkForSgdbGame(game, settings.steamGridDbKey), games };
}

function registerIpc() {
  ipcMain.handle('remote-play:snapshot', () => remotePlay.snapshot());
  ipcMain.handle('remote-play:display', () => {const screen=require('electron').screen,display=mainWindow&&!mainWindow.isDestroyed()?screen.getDisplayMatching(mainWindow.getBounds()):screen.getPrimaryDisplay();return {width:Math.round(display.bounds.width*display.scaleFactor),height:Math.round(display.bounds.height*display.scaleFactor),fps:Math.max(10,Math.min(480,Math.round(display.displayFrequency||60)))};});
  ipcMain.handle('remote-play:check-hosts', () => remotePlay.checkHosts());
  ipcMain.handle('remote-play:scan', () => remotePlay.scan());
  ipcMain.handle('remote-play:settings', (_event, id, preferences, config) => remotePlay.settings(id, preferences, config));
  ipcMain.handle('remote-play:hide-game', (_event, id, appId, hidden) => remotePlay.hideGame(id, appId, hidden));
  ipcMain.handle('remote-play:details', async (_event, id, appId) => {
    const game=await remotePlay.game(id,appId);
    // Streaming app IDs belong to the host and must never be sent to the Steam
    // store as if they were Steam app IDs.
    return fetchGameDetails({...game,appId:game.steamAppId||'',achievementReferenceAppId:game.steamAppId||''});
  });
  ipcMain.handle('remote-play:add', (_event, address) => remotePlay.add(address));
  ipcMain.handle('remote-play:pair', (_event, id) => remotePlay.pair(id));
  ipcMain.handle('remote-play:cancel-pair', () => remotePlay.cancelPair());
  ipcMain.handle('remote-play:refresh', (_event, id) => remotePlay.refresh(id));
  ipcMain.handle('remote-play:covers', (_event, id, ids) => remotePlay.covers(id, ids));
  ipcMain.handle('remote-play:start', (_event, id, appId, preferences) => {
    if (activeGameSession) throw new Error('Close your local game before starting remote play.');
    return remotePlay.start(id, appId, preferences);
  });
  ipcMain.handle('remote-play:stop', () => remotePlay.stop());
  ipcMain.handle('remote-play:remove', (_event, id) => remotePlay.remove(id));
  ipcMain.handle('remote-play:focus', () => remotePlay.focus());
  ipcMain.handle('remote-play:page', () => remotePlay.page());
  ipcMain.handle('remote-play:viewport', (_event, value) => remotePlay.viewport(value));
  ipcMain.handle('storage:overview', async () => {
    const libraries = process.env.NEBULA_DEMO === '1' ? ['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary'] : await findSteamRoots();
    let volumes = [];
    if (process.env.NEBULA_DEMO === '1') volumes = [{ root: 'C:\\', label: 'Windows', total: 1e12, free: 182e9 }, { root: 'D:\\', label: 'Games', total: 2e12, free: 1.21e12 }];
    else {
      try {
        const output = await new Promise((resolve, reject) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[System.IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and $_.DriveType -in @("Fixed","Removable","Network") } | ForEach-Object { [pscustomobject]@{ root=$_.Name; label=$_.VolumeLabel; total=$_.TotalSize; free=$_.AvailableFreeSpace } } | ConvertTo-Json -Compress'], { windowsHide: true, timeout: 8000 }, (error, stdout) => error ? reject(error) : resolve(stdout)));
        const data = JSON.parse(output || '[]'); volumes = Array.isArray(data) ? data : [data];
      } catch {
        const roots = [...new Set(libraries.map(folder => path.parse(folder).root))];
        for (const root of roots) try { const stat = await fs.statfs(root); volumes.push({ root, label: '', total: stat.blocks * stat.bsize, free: stat.bavail * stat.bsize }); } catch { /* Disconnected volumes stay out. */ }
      }
    }
    await applyCachedInstallSizes(currentLibrary);
    return storageOverview(currentLibrary, volumes, libraries);
  });
  ipcMain.handle('keyboard:show', event => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner || owner.isDestroyed()) throw new Error('The text-entry window is unavailable.');
    const handle = owner.getNativeWindowHandle();
    return showNativeKeyboard(handle.length === 8 ? handle.readBigUInt64LE() : BigInt(handle.readUInt32LE()));
  });
  ipcMain.handle('artwork:official-steam', async (_event, gameId, requestedAppId) => {
    const game = currentLibrary.find(item => item.id === gameId);
    if (!game) throw new Error('Import this game before choosing artwork.');
    const appId = String(requestedAppId || (game.provider === 'Steam' ? game.appId : '') || '').trim();
    if (!/^\d{1,10}$/.test(appId)) throw new Error('Enter the Steam App ID for the edition you want.');
    const base = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/`;
    const assets = [
      ['tile', 'library_600x900.jpg', 600, 900], ['tile', 'capsule_616x353.jpg', 616, 353],
      ['hero', 'library_hero.jpg', 3840, 1240], ['wide', 'header.jpg', 460, 215],
      ['wide', 'capsule_616x353.jpg', 616, 353], ['logo', 'logo.png', 0, 0]
    ];
    const available = await Promise.all(assets.map(async ([slot, file, width, height]) => {
      try {
        const url = base + file;
        const response = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(7000) });
        return response.ok && response.headers.get('content-type')?.startsWith('image/')
          ? { slot, url, width, height, tileIsSquare: false, source: 'Official Steam' } : null;
      } catch { return null; }
    }));
    return { appId, assets: available.filter(Boolean) };
  });
  ipcMain.handle('library:scan', (_event, options) => scanLibrary(options));
  ipcMain.handle('accounts:cancel-connect', () => accountLibraries.cancelConnect());
  ipcMain.handle('steam:family-cancel-connect', () => steamFamily.cancelConnect());
  ipcMain.handle('library:cached', () => readLibrarySnapshot());
  ipcMain.handle('settings:get', async () => {
    const settings = await readSettings();
    return { ...settings, country: steamCountry(), steamId64: settings.steamId64 || await detectSteamId64() };
  });
  ipcMain.handle('steam:local-status', async () => {
    const [roots, steamId64, recentSteamId64, clientRunning] = await Promise.all([findSteamRoots(), detectSteamId64(), detectRecentSteamId64(), steamClientIsRunning()]);
    return { installed: roots.length > 0, accountDetected: Boolean(steamId64), steamId64, clientRunning, ready: clientRunning && Boolean(recentSteamId64) };
  });
  ipcMain.handle('steam:profile', async () => {
    const [local, settings] = await Promise.all([localSteamLibrary(), readSettings()]);
    currentLibrary = applySteamLocalData(currentLibrary, local);
    const games = currentLibrary.filter(game => game.provider === 'Steam' && game.appId && !game.isApp);
    return { games: games.map(game => ({ id: game.id, minutes: Number(game.steamPlaytimeMinutes) || 0, lastPlayed: game.steamLastPlayed || 0 })),
      localAvailable: local.available, personalAchievements: Boolean(settings.steamApiKey),
      scope: 'Imported Steam games · hidden games excluded' };
  });
  ipcMain.handle('profile:identity', async () => {
    const settings = await readSettings();
    const steamId = settings.steamId64 || await detectSteamId64();
    const identity = process.env.NEBULA_DEMO === '1' ? { available: false } : await playerProfile.identity(steamId, await findSteamRoots(), settings.steamApiKey);
    return { ...identity, nameMode: profileMode(settings), avatarId: defaultAvatarId(settings) };
  });
  ipcMain.handle('profile:score', async (_event, sync = false) => {
    const settings = await readSettings();
    const steamId = settings.steamId64 || await detectSteamId64();
    const ids = currentLibrary.filter(game => game.provider === 'Steam' && !game.isApp).map(game => String(game.appId)).filter(id => /^\d+$/.test(id));
    const canSync = Boolean(settings.steamApiKey && steamId && process.env.NEBULA_DEMO !== '1');
    const summary = sync && canSync ? await playerProfile.sync(steamId, settings.steamApiKey, ids, () => mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused() && !activeGameSession)
      : await playerProfile.score(steamId, ids);
    return { ...summary, canSync };
  });
  ipcMain.handle('accounts:status', async () => {
    const settings = await readSettings();
    return { ubisoft:{status:publisherLocalStatus.ubisoftStatus,count:publisherLocalStatus.ubisoftCount,enabled:settings.showUninstalledUbisoft},
      ea:{...await accountLibraries.status('ea'),enabled:settings.showUninstalledEA},
      battlenet:{...await accountLibraries.status('battlenet'),enabled:settings.showUninstalledBattleNet} };
  });
  // Every launcher on this PC, and whether it can also bring in games you own but haven't installed.
  // Owned-library support: Steam (Web API), Steam Family (family sign-in), Epic (Legendary helper),
  // EA app and Battle.net (website sign-in), Ubisoft Connect, GOG Galaxy and Amazon Games (local client data).
  // Xbox app, Rockstar, Riot and itch only expose installed games.
  let launcherScanCache = { at: 0, list: null };
  ipcMain.handle('library:import-sources', async () => {
    const settings = await readSettings();
    const demo = process.env.NEBULA_DEMO === '1';
    if (!launcherScanCache.list || Date.now() - launcherScanCache.at > 60000) launcherScanCache = { at: Date.now(), list: demo ? ['Steam', 'Epic Games', 'EA app', 'Battle.net', 'Ubisoft Connect', 'GOG Galaxy', 'Xbox PC'].map(provider => ({ provider })) : await scanInstalledLaunchers().catch(() => []) };
    const found = new Set(launcherScanCache.list.map(item => item.provider));
    const [ea, battlenet, family, helper] = await Promise.all([accountLibraries.status('ea').catch(() => ({})), accountLibraries.status('battlenet').catch(() => ({})),
      steamFamily.status(settings.steamFamilyAccountId || settings.steamId64 || await detectSteamId64()).catch(() => ({})), findLegendaryExecutable(settings.legendaryPath).catch(() => '')]);
    const linked = value => ['ready', 'cached'].includes(value?.status);
    const fs2 = require('fs'), { gogDatabasePath, amazonDatabasePath } = require('./local-owned-libraries.cjs');
    const counts = {};
    for (const game of currentLibrary) if (game.installed === false) counts[game.accountLibrary || (game.steamFamilyImported ? 'steam-family' : game.provider)] = (counts[game.accountLibrary || (game.steamFamilyImported ? 'steam-family' : game.provider)] || 0) + 1;
    const sources = [
      { id: 'steam', name: 'Steam', found: found.has('Steam'), owned: true, enabled: Boolean(settings.showUninstalledSteam), ready: Boolean(settings.steamApiKey), needs: 'link', count: counts.Steam || 0 },
      { id: 'steam-family', name: 'Steam Family games', found: found.has('Steam'), owned: true, enabled: Boolean(settings.includeSteamFamily), ready: ['ready', 'cached', 'no-family'].includes(family.status), noFamily: family.status === 'no-family', needs: 'sign-in', count: family.count || counts['steam-family'] || 0 },
      { id: 'epic', name: 'Epic Games', found: found.has('Epic Games'), owned: true, enabled: Boolean(settings.showUninstalledEpic), ready: Boolean(helper), needs: 'legendary', count: counts['Epic Games'] || 0 },
      { id: 'ea', name: 'EA app', found: found.has('EA app'), owned: true, enabled: Boolean(settings.showUninstalledEA), ready: linked(ea), needs: 'sign-in', count: counts.ea || 0 },
      { id: 'battlenet', name: 'Battle.net', found: found.has('Battle.net'), owned: true, enabled: Boolean(settings.showUninstalledBattleNet), ready: linked(battlenet), needs: 'sign-in', count: counts.battlenet || 0 },
      { id: 'ubisoft', name: 'Ubisoft Connect', found: found.has('Ubisoft Connect'), owned: true, enabled: Boolean(settings.showUninstalledUbisoft), ready: true, needs: 'client', count: counts.ubisoft || 0 },
      { id: 'gog', name: 'GOG Galaxy', found: found.has('GOG Galaxy'), owned: true, enabled: Boolean(settings.showUninstalledGog), ready: demo || fs2.existsSync(gogDatabasePath()), needs: 'client', count: counts.gog || 0 },
      { id: 'amazon', name: 'Amazon Games', found: found.has('Amazon Games'), owned: true, enabled: Boolean(settings.showUninstalledAmazon), ready: fs2.existsSync(amazonDatabasePath()), needs: 'client', count: counts.amazon || 0 },
      { id: 'xbox', name: 'Xbox app', found: found.has('Xbox PC'), owned: false },
      { id: 'rockstar', name: 'Rockstar Games', found: found.has('Rockstar Games Launcher'), owned: false },
      { id: 'riot', name: 'Riot Games', found: found.has('Riot Client'), owned: false },
      { id: 'itch', name: 'itch.io', found: found.has('itch'), owned: false }
    ];
    return sources.filter(source => source.found || source.id === 'steam');
  });
  ipcMain.handle('library:set-uninstalled', async (_event, id, enabled) => {
    enabled = Boolean(enabled);
    const settings = await readSettings();
    const keys = { steam: 'showUninstalledSteam', epic: 'showUninstalledEpic', ea: 'showUninstalledEA', battlenet: 'showUninstalledBattleNet', ubisoft: 'showUninstalledUbisoft', gog: 'showUninstalledGog', amazon: 'showUninstalledAmazon' };
    if (id === 'steam-family') {
      if (enabled && !settings.showUninstalledSteam) return { status: 'needs-steam' };
      if (!enabled) { await writeSettings({ includeSteamFamily: false }); currentLibrary = currentLibrary.filter(game => !game.steamFamilyImported || game.installed !== false); return { status: 'off' }; }
      if (process.env.NEBULA_DEMO === '1') { await writeSettings({ includeSteamFamily: true }); return { status: 'on', count: 0 }; }
      const result = await steamFamily.connect();
      await writeSettings({ includeSteamFamily: true, steamFamilyAccountId: result.steamId || '' });
      return { status: 'on', count: result.games.filter(game => game.steamFamilyShared).length };
    }
    if (!keys[id]) throw Error('This launcher only shows installed games.');
    if (enabled && id === 'steam' && !settings.steamApiKey) return { status: 'needs-link' };
    if (enabled && id === 'epic' && !await findLegendaryExecutable(settings.legendaryPath)) return { status: 'needs-helper' };
    if (enabled && ['ea', 'battlenet'].includes(id) && process.env.NEBULA_DEMO !== '1' && !['ready', 'cached'].includes((await accountLibraries.status(id)).status)) {
      const result = await accountLibraries.connect(id);
      await writeSettings({ [keys[id]]: true });
      return { status: 'on', count: result.games.length };
    }
    await writeSettings({ [keys[id]]: enabled });
    if (!enabled) currentLibrary = currentLibrary.filter(game => game.installed !== false || (id === 'steam' ? game.provider !== 'Steam' : id === 'epic' ? game.provider !== 'Epic Games' : game.accountLibrary !== id));
    return { status: enabled ? 'on' : 'off' };
  });
  ipcMain.handle('steam:connect-account', async (_event, input = {}) => {
    const settings=await readSettings(),apiKey=String(input.apiKey||settings.steamApiKey||'').trim(),steamId64=String(input.steamId||settings.steamId64||await detectSteamId64()).trim();
    if(!/^[a-f0-9]{32}$/i.test(apiKey))throw Error('Paste your Steam Web API key to link account games and PC Gamerscore.');
    if(!/^7656119\d{10}$/.test(steamId64))throw Error('Open Steam and sign in, or enter your SteamID in Advanced setup.');
    connectionProgress({provider:'steam',phase:'loading',message:'Checking your Steam account…'});
    const result=await fetchOwnedSteamGames({...settings,steamApiKey:apiKey,steamId64});
    if(result.status!=='ready') {
      const message=result.status==='private-library'?'Steam game details are private. Make Game details public in Steam, then try again.':result.status==='invalid-api-key'?'Steam did not accept this key. Check it and try again.':'Steam could not be reached. Your current library is unchanged.';
      connectionProgress({provider:'steam',phase:'error',message});throw Error(message);
    }
    await writeSettings({steamApiKey:apiKey,steamId64,showUninstalledSteam:true});
    connectionProgress({provider:'steam',phase:'connected',message:`Steam linked. ${result.count} account games found. PC Gamerscore is ready to sync.`});
    return {count:result.count,steamId64};
  });
  // One-click Steam link: the player signs in on Steam's own page in a sandboxed window. Once signed
  // in, the Web API key is read from steamcommunity.com/dev/apikey. If there is no key yet, Steam's
  // registration form is pre-filled and the player confirms it there; nothing is submitted for them.
  let steamLinkWindow = null;
  ipcMain.handle('steam:auto-link', async () => {
    if (steamLinkWindow && !steamLinkWindow.isDestroyed()) { steamLinkWindow.focus(); return { status: 'open' }; }
    const { session } = require('electron');
    const linkSession = session.fromPartition('persist:steam-link');
    const allowed = (url) => { try { const host = new URL(url).hostname; return /(^|\.)steamcommunity\.com$|(^|\.)steampowered\.com$|(^|\.)steamstatic\.com$/.test(host); } catch { return false; } };
    steamLinkWindow = new BrowserWindow({ parent: mainWindow, modal: true, width: 1000, height: 760, show: false, autoHideMenuBar: true, backgroundColor: '#171a21', title: 'Sign in to Steam',
      webPreferences: { session: linkSession, sandbox: true, nodeIntegration: false, contextIsolation: true, devTools: false } });
    const win = steamLinkWindow;
    win.webContents.on('will-navigate', (event, url) => { if (!allowed(url)) event.preventDefault(); });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
    connectionProgress({ provider: 'steam', phase: 'waiting', message: 'Sign in to Steam to link your account…' });
    return new Promise((resolve) => {
      let finished = false;
      const finish = (value) => { if (finished) return; finished = true; if (!win.isDestroyed()) win.close(); steamLinkWindow = null; resolve(value); };
      win.on('closed', () => finish({ status: 'cancelled' }));
      win.webContents.on('did-finish-load', async () => {
        let page;
        try {
          page = await win.webContents.executeJavaScript(`(() => {
            const text = document.querySelector('#bodyContents_ex')?.innerText || '';
            const key = (text.match(/Key:\\s*([A-F0-9]{32})/i) || [])[1] || '';
            const steamId = typeof g_steamID === 'string' ? g_steamID : '';
            const form = document.querySelector('#editForm, form[action*="registerkey"]');
            if (form && !key) {
              const domain = form.querySelector('input[name="domain"]');
              if (domain && !domain.value) domain.value = 'localhost';
              const agree = form.querySelector('input[type="checkbox"]');
              if (agree) agree.checked = true;
            }
            return { key, steamId, signedIn: Boolean(steamId), form: Boolean(form), path: location.pathname };
          })()`);
        } catch { return; }
        if (!page.signedIn && !/\/login/.test(page.path)) { win.loadURL('https://steamcommunity.com/login/home/?goto=dev%2Fapikey').catch(() => {}); return; }
        if (page.signedIn && !/\/dev\/apikey/.test(page.path) && !/\/dev\/registerkey/.test(page.path)) { win.loadURL('https://steamcommunity.com/dev/apikey').catch(() => {}); return; }
        if (page.key && /^7656119\d{10}$/.test(page.steamId)) {
          await writeSettings({ steamApiKey: page.key, steamId64: page.steamId });
          const settings = await readSettings();
          const result = await fetchOwnedSteamGames({ ...settings, steamApiKey: page.key, steamId64: page.steamId }).catch(() => ({ status: 'steam-error' }));
          if (result.status === 'ready') await writeSettings({ showUninstalledSteam: true });
          connectionProgress({ provider: 'steam', phase: 'connected', message: result.status === 'ready' ? `Steam linked. ${result.count} games in your account.` : 'Steam linked. Make your game details public in Steam to include uninstalled games.' });
          finish({ status: 'linked', count: result.count || 0, privateLibrary: result.status === 'private-library' });
        } else if (page.form) connectionProgress({ provider: 'steam', phase: 'waiting', message: 'Confirm "Register" on Steam\'s page to finish linking.' });
      });
      win.loadURL('https://steamcommunity.com/dev/apikey').catch(() => finish({ status: 'unavailable' }));
    });
  });
  ipcMain.handle('steam:disconnect-account',async()=>{await writeSettings({steamApiKey:'',showUninstalledSteam:false});return true;});
  ipcMain.handle('steam:family-status',async()=>{
    const settings=await readSettings();
    return {...await steamFamily.status(settings.steamFamilyAccountId || settings.steamId64 || await detectSteamId64()),enabled:settings.includeSteamFamily};
  });
  ipcMain.handle('steam:family-connect',async()=>{
    const settings=await readSettings();
    const result=await steamFamily.connect();
    await writeSettings({includeSteamFamily:true,steamFamilyAccountId:result.steamId||''});
    return {status:result.status,count:result.games.filter(game=>game.steamFamilyShared).length};
  });
  ipcMain.handle('steam:family-disconnect',async()=>{
    await steamFamily.disconnect();
    await writeSettings({includeSteamFamily:false,steamFamilyAccountId:''});
    currentLibrary=currentLibrary.filter(game=>!game.steamFamilyImported || game.installed!==false);
    return true;
  });
  ipcMain.handle('accounts:connect', async (_event, provider) => {
    if (!['ea','battlenet'].includes(provider)) throw Error('Choose EA app or Battle.net. Ubisoft reads the local client cache.');
    const result = await accountLibraries.connect(provider);
    await writeSettings({ [provider === 'ea' ? 'showUninstalledEA' : 'showUninstalledBattleNet']:true });
    return {status:result.status,count:result.games.length};
  });
  ipcMain.handle('accounts:disconnect', async (_event, provider) => {
    if (!['ea','battlenet'].includes(provider)) throw Error('Unknown account');
    await accountLibraries.disconnect(provider);
    await writeSettings({ [provider === 'ea' ? 'showUninstalledEA' : 'showUninstalledBattleNet']:false });
    currentLibrary = currentLibrary.filter(game => game.accountLibrary !== provider || game.installed !== false);
    const snapshot = await readLibrarySnapshot();
    if (snapshot) await writeLibrarySnapshot({...snapshot,games:currentLibrary},artworkScanEpoch);
    return true;
  });
  ipcMain.handle('accounts:open-client', async (_event, provider) => {
    const name = {ubisoft:'Ubisoft Connect',ea:'EA app',battlenet:'Battle.net'}[provider];
    if (!name) throw Error('Unknown launcher');
    if (process.env.NEBULA_DEMO === '1') return true;
    const launcher = currentLibrary.find(game=>game.isLauncher && game.provider===name);
    if (!launcher?.executable || !await exists(launcher.executable)) throw Error(`Install ${name} first, then scan your library.`);
    await launchExecutable(launcher.executable,[],path.dirname(launcher.executable));
    return true;
  });
  ipcMain.handle('steam:install-status', async (_event, gameId) => {
    const game = currentLibrary.find(item => item.id === gameId && item.provider === 'Steam' && /^\d+$/.test(String(item.appId)));
    if (!game) throw new Error('This Steam game is not in your library.');
    if (process.env.NEBULA_DEMO === '1') return { state: 'waiting', installed: false, percent: null };
    for (const root of await findSteamRoots()) {
      try {
        const manifest = await fs.readFile(path.join(root, 'steamapps', `appmanifest_${game.appId}.acf`), 'utf8');
        const result = manifestProgress(manifest);
        if (result.installed) {
          game.installed = true;
          game.installPath = path.join(root, 'steamapps', 'common', parseVdfValue(manifest, 'installdir'));
          installRequests.delete(gameId);
        }
        return result.installed ? result : await liveSteamProgress(game.appId, result);
      } catch { /* The install may not have created its manifest yet. */ }
    }
    return { state: 'waiting', installed: false, percent: null, requestedAt: installRequests.get(gameId) || null };
  });
  ipcMain.handle('steam:open-help', async (_event, destination) => {
    const urls = {
      privacy: 'https://steamcommunity.com/my/edit/settings',
      apiKey: 'https://steamcommunity.com/dev/apikey',
      sgdbApiKey: 'https://www.steamgriddb.com/profile/preferences/api',
      client: 'steam://open/games',
      epicHelper: 'https://github.com/legendary-gl/legendary#quickstart'
    };
    if (!urls[destination]) throw new Error('Unknown Steam help destination.');
    await shell.openExternal(urls[destination]);
    return true;
  });
  ipcMain.handle('achievements:open-trueachievements', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    await shell.openExternal(`https://www.trueachievements.com/searchresults.aspx?search=${encodeURIComponent(game.title)}`);
    return true;
  });
  ipcMain.handle('app:feedback', async () => { await shell.openExternal('https://github.com/ykyritsis/xbox-cloud-preview-on-pc/issues'); return true; });
  ipcMain.handle('app:fse-setup', async () => { await shell.openExternal('https://github.com/ashpynov/AnyFSE#readme'); return true; });
  ipcMain.handle('settings:save', async (_event, incoming) => {
    const existing = await readSettings();
    const allowed = {};
    if ('region' in incoming) {
      const region = String(incoming.region || 'auto');
      if (region !== 'auto' && !/^[A-Z]{2}$/.test(region)) throw new Error('Choose a valid region.');
      allowed.region = region;
    }
    if ('steamId64' in incoming) {
      const steamId64 = String(incoming.steamId64 || '').trim();
      if (steamId64 && !/^\d{17}$/.test(steamId64)) throw new Error('SteamID64 must be exactly 17 digits.');
      allowed.steamId64 = steamId64;
    }
    if ('steamGridDbKey' in incoming) allowed.steamGridDbKey = String(incoming.steamGridDbKey || '').trim();
    if ('steamApiKey' in incoming) allowed.steamApiKey = String(incoming.steamApiKey || '').trim();
    const effectiveSteamApiKey = 'steamApiKey' in incoming ? allowed.steamApiKey : existing.steamApiKey;
    if ('showUninstalledSteam' in incoming) allowed.showUninstalledSteam = Boolean(incoming.showUninstalledSteam && effectiveSteamApiKey);
    if ('includeSteamFamily' in incoming) allowed.includeSteamFamily = Boolean(incoming.includeSteamFamily);
    if (['all','preferred'].includes(incoming.duplicateMode)) allowed.duplicateMode=incoming.duplicateMode;
    if (duplicateProviders.includes(incoming.duplicatePreferredProvider)) allowed.duplicatePreferredProvider=incoming.duplicatePreferredProvider;
    if (incoming.duplicatePreferences && typeof incoming.duplicatePreferences==='object' && !Array.isArray(incoming.duplicatePreferences)) {
      const groups=duplicateGroups(currentLibrary);
      allowed.duplicatePreferences={...(existing.duplicatePreferences || {})};
      for(const group of groups) {
        delete allowed.duplicatePreferences[group.key];
        const id=incoming.duplicatePreferences[group.key];
        if(typeof id==='string' && group.copies.some(game=>game.id===id))allowed.duplicatePreferences[group.key]=id;
      }
    }
    if ('steamApiKey' in incoming && !effectiveSteamApiKey) allowed.showUninstalledSteam = false;
    if ('legendaryPath' in incoming) {
      const helper = String(incoming.legendaryPath || '').trim();
      if (helper && (path.basename(helper).toLowerCase() !== 'legendary.exe' || !await exists(helper))) throw new Error('Choose a valid Legendary executable.');
      allowed.legendaryPath = helper;
    }
    if ('showUninstalledEpic' in incoming) {
      const helper = await findLegendaryExecutable(allowed.legendaryPath ?? existing.legendaryPath);
      allowed.showUninstalledEpic = Boolean(incoming.showUninstalledEpic && helper);
    }
    for (const key of ['showUninstalledUbisoft','showUninstalledEA','showUninstalledBattleNet','showUninstalledGog','showUninstalledAmazon']) {
      if (key in incoming) allowed[key] = Boolean(incoming[key]);
    }
    if ('fullscreen' in incoming) allowed.fullscreen = Boolean(incoming.fullscreen);
    if ('soundEffects' in incoming) allowed.soundEffects = incoming.soundEffects !== false;
    if ('startupAnimation' in incoming) allowed.startupAnimation = incoming.startupAnimation !== false;
    if (typeof incoming.onboardingComplete === 'boolean') allowed.onboardingComplete = incoming.onboardingComplete;
    if (typeof incoming.avatarId === 'string') allowed.avatarId = incoming.avatarId.slice(0, 40);
    if (['steam', 'custom'].includes(incoming.profileNameMode)) allowed.profileNameMode = incoming.profileNameMode;
    if (typeof incoming.profileAvatarCustomized === 'boolean') allowed.profileAvatarCustomized = incoming.profileAvatarCustomized;
    if (typeof incoming.avatarImage === 'string') {
      const image = incoming.avatarImage.trim();
      if (image.length > 1_000_000 || (image && !/^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=]+$/i.test(image))) throw new Error('Choose a PNG, JPEG, or WebP image under 750 KB after cropping.');
      allowed.avatarImage = image;
    }
    if ('steamBannerDismissed' in incoming) allowed.steamBannerDismissed = Boolean(incoming.steamBannerDismissed);
    if (typeof incoming.displayName === 'string') allowed.displayName = incoming.displayName.trim().slice(0, 32) || 'Player';
    if ('uiScale' in incoming) {
      allowed.uiScale = Math.max(0.65, Math.min(1.5, Number(incoming.uiScale) || SETTINGS_DEFAULTS.uiScale));
      allowed.uiScaleCustomized = true;
    }
    if ('tileRadius' in incoming) allowed.tileRadius = Math.max(0, Math.min(24, Number(incoming.tileRadius) || 0));
    if ('reducedMotion' in incoming) allowed.reducedMotion = Boolean(incoming.reducedMotion);
    if ('textScale' in incoming) allowed.textScale = Math.max(1, Math.min(1.3, Number(incoming.textScale) || 1));
    if ('highContrastFocus' in incoming) allowed.highContrastFocus = Boolean(incoming.highContrastFocus);
    if ('useRandomScreenshotBackground' in incoming) allowed.useRandomScreenshotBackground = Boolean(incoming.useRandomScreenshotBackground);
    if ('shuffleHomeScreenshots' in incoming) allowed.shuffleHomeScreenshots = Boolean(incoming.shuffleHomeScreenshots);
    const saved = await writeSettings(allowed);
    const previousCountry = steamCountry();
    playerRegion = saved.region || 'auto';
    if (previousCountry !== steamCountry()) {
      steamDiscoveryCache = { at: 0, data: null };
    }
    if (mainWindow) {
      mainWindow.setFullScreen(saved.fullscreen);
      mainWindow.webContents.setZoomFactor(1);
    }
    return saved;
  });
  ipcMain.handle('settings:preview-scale', (_event, value) => {
    const scale = Math.max(0.65, Math.min(1.5, Number(value) || SETTINGS_DEFAULTS.uiScale));
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.setZoomFactor(1);
    return scale;
  });
  ipcMain.handle('epic:choose-helper', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { title: 'Choose Legendary.exe', properties: ['openFile'], filters: [{ name: 'Legendary', extensions: ['exe'] }] });
    const selected = result.filePaths?.[0] || '';
    if (!selected) return '';
    if (path.basename(selected).toLowerCase() !== 'legendary.exe') throw new Error('Choose legendary.exe.');
    return selected;
  });
  ipcMain.handle('epic:helper-status', async (_event, configuredPath) => {
    const helperPath = await findLegendaryExecutable(String(configuredPath || ''));
    return { available: Boolean(helperPath), helperPath };
  });
  ipcMain.handle('settings:clear-custom-artwork', async () => {
    artworkScanEpoch++;
    const settings = await readSettings();
    const artwork = Object.fromEntries(Object.entries(settings.artwork || {}).filter(([, entry]) => !entry?.manual));
    await writeSettings({ artwork }, { replaceArtwork: true });
    gameDetailCache.clear();
    return Object.keys(settings.artwork || {}).length - Object.keys(artwork).length;
  });
  ipcMain.handle('settings:reset-all', async () => {
    artworkScanEpoch++;
    await artworkCacheTask.catch(() => {});
    await librarySnapshotWriteQueue;
    await playerProfile.reset();
    await accountLibraries.disconnect('ea');
    await accountLibraries.disconnect('battlenet');
    await steamFamily.disconnect();
    await fs.rm(librarySnapshotPath(), { force: true });
    await fs.rm(`${librarySnapshotPath()}.tmp`, { force: true });
    const cacheDirectory = path.resolve(path.dirname(settingsPath()), 'artwork-cache');
    if (path.dirname(cacheDirectory) !== path.resolve(path.dirname(settingsPath()))) throw new Error('Invalid artwork cache path.');
    await fs.rm(cacheDirectory, { recursive: true, force: true });
    await replaceSettings({ ...SETTINGS_DEFAULTS });
    currentLibrary = [];
    activeGameSession = null;
    gameDetailCache.clear();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setFullScreen(SETTINGS_DEFAULTS.fullscreen);
      mainWindow.webContents.setZoomFactor(1);
    }
    return true;
  });
  const steamLaunch = createSteamLaunch({ evaluate: (...args) => steamClientEval(...args) });
  async function prepareSteamLaunch(game) {
    if (!await exists(await steamControlFlag())) return { setupRequired: true, choices: [] };
    const steamExe = await steamExecutableFile();
    if (!steamExe) throw new Error('Steam was not found on this PC.');
    if (!await steamClientIsRunning()) {
      launchStatus(game.id, 'Starting Steam in the background');
      spawn(steamExe, ['-silent'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
    const deadline = Date.now() + 90000;
    let lastError;
    while (Date.now() < deadline) {
      if (launchWaitCancel.has(game.id)) throw new Error('Launch cancelled.');
      if (await steamSignedIn()) {
        try { return { choices: await steamLaunch.prepare(game) }; }
        catch (error) { lastError = error; }
      } else launchStatus(game.id, 'Waiting for Steam to sign in');
      await new Promise(resolve => setTimeout(resolve, 1000));
      // A live but incompatible client should fail clearly instead of silently launching a default mode.
      if (lastError && /cannot hand|does not support|launch controls are unavailable/.test(lastError.message)) throw lastError;
    }
    throw new Error(lastError ? 'Steam controls are not ready. Restart Steam, then try again.' : 'Sign in to Steam, then try again.');
  }
  ipcMain.handle('game:launch-prepare', async (_event, gameId) => {
    const game = currentLibrary.find(item => item.id === gameId);
    if (!game || game.installed === false) throw new Error('Install this game before launching it.');
    launchWaitCancel.delete(gameId);
    if (game.provider !== 'Steam' || !/^\d+$/.test(String(game.appId)) || process.env.NEBULA_DEMO === '1') return { choices: [] };
    return prepareSteamLaunch(game);
  });
  ipcMain.handle('game:launch-respond', (_event, gameId, requestId, value) => steamLaunch.respond(gameId, requestId, value));
  ipcMain.handle('game:launch', async (_event, gameId, launchOptions, launchIndex) => {
    if (remotePlay.active()) throw new Error('Disconnect remote play before launching a local game.');
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    lastLaunch = { gameId, title: game.title, provider: game.provider, at: Date.now(), result: '' };
    if (game.installed === false) throw new Error('This game is not installed. Choose Install on its game page first.');
    const optionText = String(launchOptions ?? game.launchOptions ?? '').trim();
    if (optionText.length > 512 || /[\r\n\0]/.test(optionText)) throw new Error('Steam launch options must be a single line under 512 characters.');
    const parsedOptions = optionText.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((arg) => arg.replace(/^"|"$/g, '')) || [];
    let directProcessId = null;
    if (game.accountLibrary === 'battlenet' && game.internalId && /^[a-z0-9]+$/i.test(game.providerId)) {
      const launcher = currentLibrary.find(item => item.isLauncher && item.provider === 'Battle.net');
      if (!launcher?.executable || !await exists(launcher.executable)) throw Error('Battle.net client was not found. Scan your library after installing it.');
      await launchExecutable(launcher.executable, [`--exec=launch ${game.providerId}`], path.dirname(launcher.executable));
    } else if (game.provider === 'Steam' && /^\d+$/.test(String(game.appId)) && process.env.NEBULA_DEMO !== '1') {
      if (launchWaitCancel.has(gameId)) throw new Error('Launch cancelled.');
      const prepared = await prepareSteamLaunch(game);
      if (prepared.setupRequired) throw new Error('Enable Steam controls to launch games inside the app.');
      const index = launchIndex ?? (prepared.choices.length === 1 ? prepared.choices[0].index : undefined);
      if (launchWaitCancel.has(gameId)) throw new Error('Launch cancelled.');
      launchStatus(gameId, `Starting ${game.title}`);
      await steamLaunch.start(game, index, optionText);
      if (launchWaitCancel.has(gameId)) { await steamLaunch.cancel(gameId); throw new Error('Launch cancelled.'); }
    } else if (game.launchUri && game.provider === 'Steam' && game.appId && game.steamExecutable && await exists(game.steamExecutable)) {
      try {
        await launchExecutable(game.steamExecutable, ['-silent', '-applaunch', game.appId, ...parsedOptions], path.dirname(game.steamExecutable));
      } catch {
        const target = parsedOptions.length ? `steam://run/${encodeURIComponent(game.appId)}//${encodeURIComponent(optionText)}` : game.launchUri;
        await shell.openExternal(target);
      }
    } else if (game.launchUri) {
      const target = game.provider === 'Steam' && parsedOptions.length
        ? `steam://run/${encodeURIComponent(game.appId)}//${encodeURIComponent(optionText)}`
        : game.launchUri;
      await shell.openExternal(target);
    }
    else if (game.shortcutPath) {
      const error = await shell.openPath(game.shortcutPath);
      if (error) throw new Error(error);
    }
    else if (game.executable && await exists(game.executable)) directProcessId = await launchExecutable(game.executable, game.args);
    else throw new Error('The game executable could not be found.');
    const settings = await readSettings();
    const playHistory = [gameId, ...(settings.playHistory || []).filter((id) => id !== gameId)].slice(0, 40);
    const playCounts = { ...(settings.playCounts || {}), [gameId]: Number(settings.playCounts?.[gameId] || 0) + 1 };
    await writeSettings({ playHistory, playCounts });
    activeGameSession = { gameId, launchedAt: Date.now(), pid: directProcessId };
    game.playCount = playCounts[gameId];
    currentLibrary = [game, ...currentLibrary.filter((entry) => entry.id !== gameId)];
    try {
      const snapshot = await readLibrarySnapshot();
      if (snapshot) await writeLibrarySnapshot({ ...snapshot, games: currentLibrary }, artworkScanEpoch);
    } catch (error) {
      console.warn('Could not update the cached recent-games order:', error.message);
    }
    return true;
  });
  // The launch screen stays up until the game is actually running: Steam reports its RunningAppID, the
  // launcher window gives way to the game's window, or a directly started process stays alive.
  const launchWaitCancel = new Set();
  const steamRunningAppId = () => new Promise(resolve => execFile('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'RunningAppID'], { windowsHide: true, timeout: 1500 }, (error, stdout) => {
    const hex = !error && String(stdout).match(/RunningAppID\s+REG_DWORD\s+0x([0-9a-f]+)/i)?.[1];
    resolve(hex ? String(parseInt(hex, 16)) : '');
  }));
  // Tells the launch screen what it's waiting for, so a long wait never looks stuck.
  const launchStatus = (gameId, text, extra = {}) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('launch:status', { gameId, text, ...extra }); };
  // Steam's install folder, found on the drives it's installed to.
  const steamExecutableFile = async () => {
    for (const root of await findSteamRoots()) if (await exists(path.join(root, 'steam.exe'))) return path.join(root, 'steam.exe');
    return '';
  };
  // Steam is signed in once its registry "ActiveUser" holds a user id.
  const steamSignedIn = () => new Promise(resolve => execFile('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam\\ActiveProcess', '/v', 'ActiveUser'], { windowsHide: true, timeout: 1500 }, (error, stdout) => {
    const hex = !error && String(stdout).match(/ActiveUser\s+REG_DWORD\s+0x([0-9a-f]+)/i)?.[1];
    resolve(Boolean(hex && parseInt(hex, 16)));
  }));
  ipcMain.handle('game:wait-started', async (_event, gameId, timeoutMs = 90000) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) return { started: false };
    if (process.env.NEBULA_DEMO === '1') { await new Promise(resolve => setTimeout(resolve, 2500)); return { started: true, via: 'demo' }; }
    if (steamLaunch.has(gameId)) {
      // First-time redistributables can take much longer than a normal game launch.
      const deadline = Date.now() + 15 * 60 * 1000;
      try {
        while (Date.now() < deadline) {
          if (launchWaitCancel.has(gameId)) {
            await steamLaunch.cancel(gameId);
            if (activeGameSession?.gameId === gameId) activeGameSession = null;
            return { started: false, cancelled: true };
          }
          const snapshot = await steamLaunch.poll(gameId);
          launchStatus(gameId, snapshot.status.text, snapshot.status);
          if (snapshot.error) throw new Error(snapshot.error);
          if (snapshot.ended) {
            const started = snapshot.task === 'Completed';
            if (activeGameSession?.gameId === gameId) {
              if (started) activeGameSession.seenRunning = true;
              else activeGameSession = null;
            }
            if (lastLaunch?.gameId === gameId) lastLaunch.result = snapshot.task;
            if (!started && snapshot.task !== 'Cancelled' && !snapshot.handoff) throw new Error('Steam could not finish starting this game. Please try again.');
            return { started, cancelled: snapshot.task === 'Cancelled', handoff: Boolean(snapshot.handoff) };
          }
          await new Promise(resolve => setTimeout(resolve, 600));
        }
        throw new Error('First-time setup took longer than 15 minutes. Launch again to retry.');
      } catch (error) {
        await steamLaunch.cancel(gameId).catch(() => {});
        if (activeGameSession?.gameId === gameId) activeGameSession = null;
        throw error;
      } finally { steamLaunch.forget(gameId); launchWaitCancel.delete(gameId); }
    }
    const started = Date.now(), deadline = started + Math.max(5000, Math.min(Number(timeoutMs) || 90000, 120000));
    launchStatus(gameId, game.provider === 'Steam' ? 'Waiting for Steam to open the game' : `Waiting for ${game.title} to open`);
    const slowNote = setTimeout(() => launchStatus(gameId, 'Still loading. Some games take a while the first time'), 25000);
    let blurredAt = 0;
    const onBlur = () => { blurredAt = Date.now(); };
    mainWindow?.on('blur', onBlur);
    try {
      while (Date.now() < deadline) {
        if (launchWaitCancel.delete(gameId)) { if (lastLaunch?.gameId === gameId) lastLaunch.result = 'cancelled'; return { started: false, cancelled: true }; }
        if (game.provider === 'Steam' && game.appId && await steamRunningAppId() === String(game.appId)) {
          if (activeGameSession?.gameId === gameId) activeGameSession.seenRunning = true;
          if (lastLaunch?.gameId === gameId) lastLaunch.result = 'running (Steam)';
          return { started: true, via: 'steam' };
        }
        // Losing focus is not proof that a game is running: Steam and other launchers take focus while the game
        // is still loading. Steam games are judged only by Steam's running-game value above, and anything else
        // needs focus to stay away for several seconds before the launch screen hands over.
        const away = blurredAt && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFocused() && Date.now() - blurredAt > 4000;
        if (away && game.provider !== 'Steam') return { started: true, via: 'window' };
        if (activeGameSession?.gameId === gameId && activeGameSession.pid && Date.now() - started > 4000) {
          try { process.kill(activeGameSession.pid, 0); return { started: true, via: 'process' }; } catch { /* Exited or handed off. */ }
        }
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      return { started: false };
    } finally { clearTimeout(slowNote); mainWindow?.removeListener('blur', onBlur); }
  });
  ipcMain.handle('game:wait-cancel', async (_event, gameId) => { launchWaitCancel.add(String(gameId)); await steamLaunch.cancel(gameId); return true; });
  ipcMain.handle('game:active-session', async () => {
    const remote = remotePlay.active();
    if (remote) return { gameId: `remote:${remote.hostId}:${remote.appId}`, verified: remote.phase === 'playing', remote: true };
    if (!activeGameSession) return null;
    const session = activeGameSession;
    const age = Date.now() - session.launchedAt;
    if (age > (session.pid ? 4 * 60 * 60 * 1000 : 30 * 60 * 1000)) { activeGameSession = null; return null; }
    if (session.pid) {
      try { process.kill(session.pid, 0); }
      catch { activeGameSession = null; return null; }
      return { gameId: session.gameId, verified: true };
    }
    // Steam games start through Steam, so there's no process to watch; Steam's own "running game" value
    // says whether it's still open. Closing the game ends the session at once.
    const game = currentLibrary.find(item => item.id === session.gameId);
    if (game?.provider === 'Steam' && game.appId && process.env.NEBULA_DEMO !== '1') {
      if (steamLaunch.has(session.gameId)) return { gameId: session.gameId, verified: false };
      const running = await steamRunningAppId() === String(game.appId);
      if (running) { session.seenRunning = true; return { gameId: session.gameId, verified: true }; }
      // Not running: closed after it ran, or it never started within two minutes.
      if (session.seenRunning || age > 2 * 60 * 1000) { if (activeGameSession === session) activeGameSession = null; return null; }
    }
    return { gameId: session.gameId, verified: false };
  });
  ipcMain.handle('game:return', (_event, gameId) => {
    if(remotePlay.active()?.gameId===gameId)return remotePlay.focus();
    if (!activeGameSession || activeGameSession.gameId !== gameId) throw new Error('This is not the last launched game.');
    if (activeGameSession.pid) {
      try { process.kill(activeGameSession.pid, 0); }
      catch { activeGameSession = null; throw new Error('That game is no longer running.'); }
    }
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    return true;
  });
  ipcMain.handle('library:organize', (_event, action, payload = {}) => {
    const operation = libraryOrganizationQueue.then(async () => {
    const settings = await readSettings();
    const favoriteGameIds = Array.isArray(settings.favoriteGameIds) ? [...settings.favoriteGameIds] : [];
    const customCollections = Array.isArray(settings.customCollections) ? settings.customCollections.map((item) => ({ ...item, gameIds: [...(item.gameIds || [])] })) : [];
    const gameId = String(payload.gameId || '');
    if (['favorite', 'membership'].includes(action) || (action === 'create' && gameId)) {
      if (!currentLibrary.some((game) => game.id === gameId)) throw new Error('Game is not in your library.');
    }
    if (action === 'favorite') {
      const index = favoriteGameIds.indexOf(gameId);
      if (index >= 0) favoriteGameIds.splice(index, 1);
      else favoriteGameIds.unshift(gameId);
    } else if (action === 'create') {
      const name = String(payload.name || '').trim().slice(0, 40);
      if (!name || customCollections.length >= 20) throw new Error('Enter a collection name (up to 20 collections).');
      if (customCollections.some((item) => item.name.toLowerCase() === name.toLowerCase())) throw new Error('A collection with that name already exists.');
      customCollections.push({ id: `collection-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, name, gameIds: gameId ? [gameId] : [] });
    } else if (action === 'membership') {
      const collection = customCollections.find((item) => item.id === payload.collectionId);
      if (!collection) throw new Error('Collection not found.');
      const index = collection.gameIds.indexOf(gameId);
      if (index >= 0) collection.gameIds.splice(index, 1);
      else collection.gameIds.push(gameId);
    } else if (action === 'delete') {
      const index = customCollections.findIndex((item) => item.id === payload.collectionId);
      if (index < 0) throw new Error('Collection not found.');
      customCollections.splice(index, 1);
    } else if (action === 'hide' || action === 'unhide') {
      const hiddenGameIds = new Set(settings.hiddenGameIds || []);
      const game = currentLibrary.find((item) => item.id === gameId);
      const appId = String(payload.appId || game?.appId || (gameId.match(/^steam-(\d+)$/) || [])[1] || '');
      const isSteam = /^\d{1,10}$/.test(appId) && (game ? game.provider === 'Steam' : gameId.startsWith('steam-'));
      // Steam games hide and unhide in Steam itself (its Hidden collection), so both stay in sync.
      let steamSynced = false;
      if (isSteam && process.env.NEBULA_DEMO !== '1') {
        try {
          steamSynced = await steamClientEval(`(() => { const store = window.collectionStore; if (!store?.SetAppsAsHidden) return false; store.SetAppsAsHidden([${Number(appId)}], ${action === 'hide'}); return true; })()`, 4000) === true;
        } catch { steamSynced = false; }
        if (steamSynced) steamHiddenOverrides.set(appId, { hidden: action === 'hide', at: Date.now() });
      }
      if (action === 'hide') {
        if (!game) throw new Error('Game is not in your library.');
        if (!steamSynced) hiddenGameIds.add(gameId);
        currentLibrary = currentLibrary.filter((item) => item.id !== gameId);
      } else {
        hiddenGameIds.delete(gameId);
        if (payload.steamHidden && !steamSynced) throw new Error('This game is hidden in Steam. Turn on Steam download controls in Queue, or unhide it in Steam.');
      }
      await writeSettings({ hiddenGameIds: [...hiddenGameIds] });
      return { favoriteGameIds, customCollections, hiddenGameIds: [...hiddenGameIds], steamSynced };
    } else throw new Error('Unknown collection action.');
    await writeSettings({ favoriteGameIds, customCollections });
    return { favoriteGameIds, customCollections };
    });
    libraryOrganizationQueue = operation.catch(() => {});
    return operation;
  });
  ipcMain.handle('launcher:steam-big-picture', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game?.isLauncher || game.title !== 'Steam' || !game.executable || !await exists(game.executable)) throw new Error('Steam launcher was not found.');
    await launchExecutable(game.executable, ['-bigpicture'], path.dirname(game.executable));
    return true;
  });
  ipcMain.handle('game:action', async (_event, gameId, action) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    if (action === 'download' && game.accountLibrary && !game.installed) {
      if (process.env.NEBULA_DEMO === '1') return true;
      if (game.accountLibrary === 'ubisoft' && /^\d+$/.test(game.providerId)) await shell.openExternal(`uplay://install/${game.providerId}`);
      else if (game.accountLibrary === 'ea' && /^origin2:\/\/game\/launch\/\?offerIds=[A-Za-z0-9%.:_-]+$/.test(game.installUri || '')) await shell.openExternal(game.installUri);
      else if (game.accountLibrary === 'gog' && /^goggalaxy:\/\/openGameView\/\d+$/.test(game.installUri || '')) await shell.openExternal(game.installUri);
      else if (game.accountLibrary === 'amazon' && /^amazon-games:\/\/play\/[A-Za-z0-9._-]+$/.test(game.installUri || '')) await shell.openExternal(game.installUri);
      else {
        const launcher = currentLibrary.find(item=>item.isLauncher && item.provider===game.provider);
        if (!launcher?.executable || !await exists(launcher.executable)) throw Error(`Install ${game.provider} first, then scan your library.`);
        const args = game.accountLibrary === 'battlenet' && /^[a-z0-9_]+$/i.test(game.internalId || '') ? [`--game=${game.internalId}`] : [];
        await launchExecutable(launcher.executable,args,path.dirname(launcher.executable));
      }
      return true;
    }
    if (action === 'download' && game.provider === 'Steam' && game.appId && !game.installed) {
      if (process.env.NEBULA_DEMO !== '1') await shell.openExternal(`steam://install/${encodeURIComponent(game.appId)}`);
      installRequests.set(game.id, Date.now());
      return true;
    }
    if (action === 'download' && game.provider === 'Epic Games' && game.epicOwned && !game.installed) {
      const launcher = currentLibrary.find(item => item.isLauncher && item.provider === 'Epic Games' && item.executable);
      if (!launcher || !await exists(launcher.executable)) throw new Error('Install this game from the Epic Games Launcher. The launcher was not found on this PC.');
      await launchExecutable(launcher.executable, [], path.dirname(launcher.executable));
      return true;
    }
    if (action === 'uninstall-steam' && game.provider === 'Steam' && game.appId && game.installed) {
      await shell.openExternal(`steam://uninstall/${encodeURIComponent(game.appId)}`);
      return true;
    }
    if (action === 'view-steam' && game.provider === 'Steam' && game.appId) {
      await shell.openExternal(`steam://store/${encodeURIComponent(game.appId)}`);
      return true;
    }
    if (action === 'view-steam-library' && game.provider === 'Steam' && game.appId) {
      if (process.env.NEBULA_DEMO !== '1') await shell.openExternal(`steam://nav/games/details/${encodeURIComponent(game.appId)}`);
      return true;
    }
    if (action === 'open-steamdb' && game.provider === 'Steam' && game.appId) {
      await shell.openExternal(`https://steamdb.info/app/${encodeURIComponent(game.appId)}/`);
      return true;
    }
    if (action === 'open-folder') {
      const folder = game.installPath || (game.executable ? path.dirname(game.executable) : null);
      if (!folder || !await exists(folder)) throw new Error('The install folder could not be found.');
      const result = await shell.openPath(folder);
      if (result) throw new Error(result);
      return true;
    }
    if (action === 'verify' && game.provider === 'Steam' && game.appId && game.installed) {
      if (process.env.NEBULA_DEMO !== '1') await shell.openExternal(`steam://validate/${encodeURIComponent(game.appId)}`);
      return true;
    }
    if (action === 'check-updates' && game.provider === 'Steam' && game.appId) {
      if (process.env.NEBULA_DEMO !== '1') await shell.openExternal('steam://open/downloads');
      return true;
    }
    if (action === 'desktop-shortcut') {
      const target = game.launchUri || (game.provider === 'Steam' && game.appId ? `steam://rungameid/${game.appId}` : '');
      const name = String(game.title).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 120) || 'Game';
      const file = path.join(app.getPath('desktop'), `${name}.${target ? 'url' : 'lnk'}`);
      if (process.env.NEBULA_DEMO === '1') return true;
      if (target && /^[a-z][a-z0-9+.-]*:\/\//i.test(target)) await fs.writeFile(file, `[InternetShortcut]\r\nURL=${target}\r\n`, 'utf8');
      else if (game.executable && await exists(game.executable)) {
        if (!shell.writeShortcutLink(file, { target: game.executable, cwd: path.dirname(game.executable) })) throw new Error('Could not create the shortcut.');
      } else throw new Error('This game has no launch target for a shortcut.');
      return true;
    }
    throw new Error('That action is not available for this game.');
  });
  // Storage details for Manage game. Steam and Epic report their own size; other folders share the background size cache.
  // Xbox mode (Windows full screen experience) home app. Registration happens only when the player
  // chooses it in Settings: the bridge layout is copied to their profile and registered as an
  // unpacked app, which Windows permits while Developer Mode is on. Nothing here needs admin rights.
  const XBOX_MODE_PACKAGE = 'XboxPreviewUI.XboxModeHome';
  const powershell = (command) => new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { windowsHide: true, timeout: 60000 }, (error, stdout, stderr) => resolve({ ok: !error, stdout: String(stdout || '').trim(), stderr: String(stderr || error?.message || '').trim() })));
  const developerMode = () => new Promise((resolve) => execFile('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModelUnlock', '/v', 'AllowDevelopmentWithoutDevLicense'], { windowsHide: true, timeout: 4000 }, (error, stdout) => resolve(!error && /0x1\b/.test(stdout))));
  ipcMain.handle('xbox-mode:status', async () => {
    if (process.platform !== 'win32') return { supported: false };
    const result = await powershell(`(Get-AppxPackage -Name '${XBOX_MODE_PACKAGE}' | Select-Object -First 1).InstallLocation`);
    return { supported: true, registered: Boolean(result.stdout), developerMode: await developerMode() };
  });
  ipcMain.handle('xbox-mode:register', async () => {
    if (process.platform !== 'win32') throw new Error('Xbox mode is a Windows feature.');
    if (!await developerMode()) return { status: 'needs-developer-mode' };
    const source = path.join(__dirname, 'xbox-mode-bridge').replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
    const target = path.join(process.env.LOCALAPPDATA || app.getPath('userData'), 'Xbox Preview UI', 'xbox-mode-bridge');
    if (!await exists(path.join(source, 'AppxManifest.xml'))) throw new Error('The Xbox mode bridge is missing from this install. Reinstall Xbox Preview UI.');
    await fs.rm(target, { recursive: true, force: true });
    await fs.cp(source, target, { recursive: true });
    await fs.writeFile(path.join(path.dirname(target), 'xbox-mode-target.txt'), process.execPath, 'utf8');
    const result = await powershell(`Add-AppxPackage -Register '${path.join(target, 'AppxManifest.xml').replace(/'/g, "''")}' -ForceApplicationShutdown`);
    if (!result.ok) throw new Error(`Windows could not add Xbox Preview UI to Xbox mode. ${result.stderr.split(/\r?\n/).find(Boolean) || ''}`.trim());
    return { status: 'registered' };
  });
  ipcMain.handle('xbox-mode:unregister', async () => {
    const result = await powershell(`Get-AppxPackage -Name '${XBOX_MODE_PACKAGE}' | Remove-AppxPackage`);
    if (!result.ok) throw new Error('Windows could not remove the Xbox mode home app.');
    return { status: 'removed' };
  });
  ipcMain.handle('xbox-mode:open-settings', async (_event, page = 'gaming') => {
    await shell.openExternal(page === 'developers' ? 'ms-settings:developers' : 'ms-settings:gaming-fullscreenexperience').catch(() => shell.openExternal('ms-settings:gaming'));
    return true;
  });
  // Native Steam installs: no Steam dialog. A manifest flagged "update required" is written to the
  // Steam library with the most free space, and Steam is restarted silently so it starts the download.
  const steamRunning = () => new Promise((resolve) => execFile('tasklist.exe', ['/FI', 'IMAGENAME eq steam.exe', '/NH'], { windowsHide: true, timeout: 4000 }, (error, stdout) => resolve(!error && /steam\.exe/i.test(stdout))));
  ipcMain.handle('steam:native-install', async (_event, gameId, chosenLibrary = '') => {
    const game = currentLibrary.find((item) => item.id === gameId && item.provider === 'Steam' && /^\d+$/.test(String(item.appId)));
    if (!game) throw new Error('This Steam game is not in your library.');
    if (game.installed !== false) return { status: 'installed' };
    if (process.env.NEBULA_DEMO === '1') { installRequests.set(game.id, Date.now()); return { status: 'started', library: 'D:\\SteamLibrary', demo: true }; }
    if (activeGameSession || remotePlay.active()) throw new Error('Close your game before installing. Steam needs to restart to start the download.');
    const roots = await findSteamRoots();
    const steamExe = roots.map((root) => path.join(root, 'steam.exe')).find((file) => require('fs').existsSync(file));
    if (!steamExe) throw new Error('Steam was not found on this PC.');
    for (const root of roots) if (await exists(path.join(root, 'steamapps', `appmanifest_${game.appId}.acf`))) return { status: 'queued', library: root };
    let info = null;
    try {
      const response = await fetch(`https://api.steamcmd.net/v1/info/${game.appId}`, { signal: AbortSignal.timeout(10000) });
      if (response.ok) info = (await response.json()).data?.[game.appId] || null;
    } catch { /* The Steam dialog is the fallback below. */ }
    const installdir = String(info?.config?.installdir || '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
    if (!installdir) {
      await shell.openExternal(`steam://install/${game.appId}`);
      installRequests.set(game.id, Date.now());
      return { status: 'dialog' };
    }
    const libraries = [];
    for (const root of roots) {
      try { const stats = await fs.statfs(root); libraries.push({ root, free: stats.bavail * stats.bsize }); } catch { /* Unavailable drive. */ }
    }
    libraries.sort((a, b) => b.free - a.free);
    const target = roots.includes(chosenLibrary) ? chosenLibrary : libraries[0]?.root || roots[0];
    const size = await installSizeLookup(game.appId);
    const free = libraries.find(item => item.root === target)?.free;
    if (size.requiredBytes && free !== undefined && free < size.requiredBytes) throw new Error('There is not enough free space on this drive. Choose another location or free some space first.');
    const settings = await readSettings();
    const owner = String(settings.steamId64 || await detectSteamId64() || '');
    const name = String(info?.common?.name || game.title).replace(/["\\\r\n]/g, '');
    const manifest = `"AppState"\n{\n\t"appid"\t\t"${game.appId}"\n\t"Universe"\t\t"1"\n\t"name"\t\t"${name}"\n\t"StateFlags"\t\t"1026"\n\t"installdir"\t\t"${installdir}"\n\t"LastUpdated"\t\t"0"\n\t"SizeOnDisk"\t\t"0"\n\t"StagingSize"\t\t"0"\n\t"buildid"\t\t"0"\n\t"LastOwner"\t\t"${/^\d{17}$/.test(owner) ? owner : '0'}"\n\t"UpdateResult"\t\t"0"\n\t"BytesToDownload"\t\t"0"\n\t"BytesDownloaded"\t\t"0"\n\t"BytesToStage"\t\t"0"\n\t"BytesStaged"\t\t"0"\n\t"AutoUpdateBehavior"\t\t"0"\n\t"AllowOtherDownloadsWhileRunning"\t\t"0"\n\t"ScheduledAutoUpdate"\t\t"0"\n}\n`;
    await fs.mkdir(path.join(target, 'steamapps'), { recursive: true });
    await fs.writeFile(path.join(target, 'steamapps', `appmanifest_${game.appId}.acf`), manifest, 'utf8');
    installRequests.set(game.id, Date.now());
    removedDownloads.delete(String(game.appId));
    // Steam only reads new manifests at start-up: close it, then start it again in the background.
    if (await steamRunning()) {
      await shell.openExternal('steam://exit');
      for (let waited = 0; waited < 40000 && await steamRunning(); waited += 1000) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    spawn(steamExe, ['-silent'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return { status: 'started', library: target, free: libraries.find(item => item.root === target)?.free || null };
  });
  // "Install to": every Steam library folder with its drive, free space and the game's listed size.
  ipcMain.handle('steam:install-targets', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId && item.provider === 'Steam' && /^\d+$/.test(String(item.appId)));
    if (!game) throw new Error('This Steam game is not in your library.');
    const roots = process.env.NEBULA_DEMO === '1' ? ['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary'] : await findSteamRoots();
    const libraries = [];
    for (const root of roots) {
      let free = null, total = null;
      try { const stats = await fs.statfs(root); free = stats.bavail * stats.bsize; total = stats.blocks * stats.bsize; } catch { if (process.env.NEBULA_DEMO !== '1') continue; }
      if (process.env.NEBULA_DEMO === '1') { free = root.startsWith('C') ? 182e9 : 1.21e12; total = root.startsWith('C') ? 1e12 : 2e12; }
      libraries.push({ root, drive: path.parse(root).root.replace(/\\$/, ''), free, total });
    }
    const size = process.env.NEBULA_DEMO === '1' ? { downloadBytes: 48.3e9, installBytes: 71.8e9, requiredBytes: 75e9, estimated: true, source: 'public-depots' } : await installSizeLookup(game.appId);
    const settings = await readSettings();
    const destinations = installLibrariesByDrive(libraries, settings.steamInstallLibrary);
    const preferred = destinations.find(item => libraryKey(item.root) === libraryKey(settings.steamInstallLibrary || ''))?.root
      || [...destinations].sort((a, b) => (b.free || 0) - (a.free || 0))[0]?.root || '';
    return { libraries: destinations, needed: size.requiredBytes, ...size, preferred };
  });
  ipcMain.handle('steam:remember-library', async (_event, root) => {
    if (typeof root === 'string' && (await findSteamRoots()).includes(root)) await writeSettings({ steamInstallLibrary: root });
    return true;
  });
  // The real Steam download queue, read from Steam's own manifests (only changed files are re-read).
  const manifestCache = new Map();
  // Downloads removed from the queue stay hidden (until they're queued again) even if Steam keeps their manifest.
  const removedDownloads = new Map();
  // True when Steam has a manifest for the game but it has never been fully installed (StateFlags bit 4).
  async function steamPartialInstall(appId) {
    for (const root of await findSteamRoots()) {
      const text = await fs.readFile(path.join(root, 'steamapps', `appmanifest_${appId}.acf`), 'utf8').catch(() => '');
      if (!text) continue;
      return !(Number(parseVdfValue(text, 'StateFlags')) & 4);
    }
    return false;
  }
  ipcMain.handle('steam:downloads', async () => {
    if (process.env.NEBULA_DEMO === '1') return (process.env.NEBULA_DEMO_QUEUE ? [{ appId: '1551360', title: 'Forza Horizon 5', library: 'D:\SteamLibrary', installed: false, state: 'downloading', downloaded: 21.1e9 + (Date.now() % 60000) * 4e5, total: 33.7e9, percent: 63 }, { appId: '1172620', title: 'Sea of Thieves', library: 'D:\SteamLibrary', installed: false, state: 'queued', downloaded: 0, total: 85.9e9, percent: 0 }] : []).filter(item => !removedDownloads.has(String(item.appId)));
    const active = [];
    for (const root of await findSteamRoots()) {
      const folder = path.join(root, 'steamapps');
      let names = [];
      try { names = (await fs.readdir(folder)).filter(name => /^appmanifest_\d+\.acf$/.test(name)); } catch { continue; }
      for (const name of names) {
        const file = path.join(folder, name);
        let stat;
        try { stat = await fs.stat(file); } catch { continue; }
        let entry = manifestCache.get(file);
        if (!entry || entry.mtime !== stat.mtimeMs) {
          try {
            const text = await fs.readFile(file, 'utf8');
            entry = { mtime: stat.mtimeMs, appId: name.match(/\d+/)[0], title: parseVdfValue(text, 'name'), result: manifestProgress(text), root };
          } catch { continue; }
          manifestCache.set(file, entry);
        }
        if (!entry.result.installed) active.push({ appId: entry.appId, title: entry.title, library: root, ...entry.result });
      }
    }
    // Steam's own list also has downloads with no manifest on disk yet (or paused ones). Scheduled
    // auto-updates that haven't started stay out, as in the Xbox app's queue.
    const client = await steamClientDownloads();
    // With Steam's own list available, it decides what's queued: a game removed from Steam's queue keeps an
    // unfinished manifest on disk, which would otherwise bring it straight back.
    if (Array.isArray(client?.items) || Array.isArray(client?.items?.items)) {
      const listed = new Set(clientDownloadItems(client).filter(item => !item.completed).map(item => String(item.appid)));
      for (let index = active.length - 1; index >= 0; index--) {
        if (!listed.has(String(active[index].appId)) && active[index].state !== 'installing') active.splice(index, 1);
      }
    }
    for (const appId of removedDownloads.keys()) {
      if (Date.now() - removedDownloads.get(appId) > 10 * 60 * 1000) removedDownloads.delete(appId);
    }
    for (let index = active.length - 1; index >= 0; index--) if (removedDownloads.has(String(active[index].appId))) active.splice(index, 1);
    for (const item of clientDownloadItems(client)) {
      const appId = String(item.appid || '');
      if (!/^\d+$/.test(appId) || appId === '0' || item.completed || removedDownloads.has(appId) || active.some(entry => entry.appId === appId)) continue;
      // Updates Steam has waiting (scheduled for later) show in the queue too, ready to start.
      const hasUpdate = (item.update_type_info || []).some(info => info?.has_update && !info.completed);
      if (!(item.active || item.paused || Number(item.queue_index) >= 0 || hasUpdate)) continue;
      const owned = currentLibrary.find(game => game.provider === 'Steam' && String(game.appId) === appId);
      if (!owned) continue;
      const state = item.paused ? 'paused' : item.active ? 'downloading' : Number(item.queue_index) >= 0 ? 'queued' : 'update';
      active.push({ appId, title: owned.title, library: '', installed: false, state, downloaded: 0, total: 0, percent: null, isUpdate: owned.installed !== false });
    }
    return Promise.all(active.map(item => liveSteamProgress(item.appId, item)));
  });
  // Pause and resume talk to the Steam client itself. That needs Steam's local developer port, which
  // the player turns on once from the Queue. It listens on this PC only (127.0.0.1:8080).
  const steamControlFlag = async () => path.join((await findSteamRoots())[0] || '', '.cef-enable-remote-debugging');
  // One connection to Steam's shared script context stays open, so pause and resume answer in
  // milliseconds instead of reconnecting each time.
  const steamClient = { socket: null, opening: null, next: 1, pending: new Map() };
  function steamClientSocket() {
    if (steamClient.socket?.readyState === 1) return Promise.resolve(steamClient.socket);
    if (steamClient.opening) return steamClient.opening;
    steamClient.opening = (async () => {
      const targets = await (await fetch('http://127.0.0.1:8080/json', { signal: AbortSignal.timeout(1500) })).json();
      const target = targets.find(item => item.title === 'SharedJSContext') || targets.find(item => /SharedJSContext/i.test(item.title || ''));
      if (!target?.webSocketDebuggerUrl || !/^ws:\/\/(127\.0\.0\.1|localhost):8080\//.test(target.webSocketDebuggerUrl)) throw new Error('Steam download controls are not ready yet.');
      return await new Promise((resolve, reject) => {
        const socket = new WebSocket(target.webSocketDebuggerUrl);
        const timer = setTimeout(() => { socket.close(); reject(new Error('Steam did not respond.')); }, 3000);
        socket.onopen = () => { clearTimeout(timer); steamClient.socket = socket; resolve(socket); };
        socket.onmessage = event => {
          const message = JSON.parse(String(event.data));
          const waiting = steamClient.pending.get(message.id);
          if (!waiting) return;
          steamClient.pending.delete(message.id);
          clearTimeout(waiting.timer);
          if (message.result?.exceptionDetails || message.error) waiting.reject(new Error(message.result?.exceptionDetails?.exception?.description?.split('\n')[0]?.replace(/^Error: /, '') || 'Steam could not complete this action.'));
          else waiting.resolve(message.result?.result?.value);
        };
        const drop = () => {
          clearTimeout(timer);
          if (steamClient.socket === socket) steamClient.socket = null;
          for (const waiting of steamClient.pending.values()) { clearTimeout(waiting.timer); waiting.reject(new Error('Steam closed the connection.')); }
          steamClient.pending.clear();
          reject(new Error('Steam download controls are not ready yet.'));
        };
        socket.onerror = drop;
        socket.onclose = drop;
      });
    })().finally(() => { steamClient.opening = null; });
    return steamClient.opening;
  }
  async function steamClientEval(expression, timeout = 4000) {
    const socket = await steamClientSocket();
    const id = steamClient.next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { steamClient.pending.delete(id); reject(new Error('Steam did not respond.')); }, timeout);
      steamClient.pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
    });
  }
  // Live progress: Steam's own numbers when download controls are on, otherwise an estimate from its
  // content log. The manifest alone lags far behind (it can read 0% while Steam shows 74%).
  let contentLogCache = { at: 0, text: '' };
  async function steamContentLogTail() {
    if (Date.now() - contentLogCache.at < 1500) return contentLogCache.text;
    let text = '';
    try {
      const file = path.join((await findSteamRoots())[0] || '', 'logs', 'content_log.txt');
      const handle = await fs.open(file, 'r');
      try {
        const { size } = await handle.stat();
        const length = Math.min(size, 512 * 1024);
        const buffer = Buffer.alloc(length);
        await handle.read(buffer, 0, length, size - length);
        text = buffer.toString('utf8');
      } finally { await handle.close(); }
    } catch { /* No log yet. */ }
    contentLogCache = { at: Date.now(), text };
    return text;
  }
  let clientDownloadsCache = { at: 0, data: null };
  async function steamClientDownloads() {
    if (Date.now() - clientDownloadsCache.at < 700) return clientDownloadsCache.data;
    let data = null;
    try {
      // One listener stays registered inside Steam; each read returns its latest numbers immediately.
      if (await exists(await steamControlFlag())) data = await steamClientEval(`(() => {
        const watch = window.__xboxPreviewDownloads || (window.__xboxPreviewDownloads = (() => {
          const state = { overview: null, items: null };
          SteamClient.Downloads.RegisterForDownloadOverview(overview => { state.overview = overview; });
          SteamClient.Downloads.RegisterForDownloadItems((active, items) => { state.items = items; });
          return state;
        })());
        const overview = watch.overview ? { ...watch.overview, history: undefined } : null;
        return JSON.parse(JSON.stringify({ overview, items: watch.items }));
      })()`, 2500);
    } catch { /* Controls off or Steam starting: the log estimate is used. */ }
    clientDownloadsCache = { at: Date.now(), data };
    return data;
  }
  async function liveSteamProgress(appId, result) {
    if (!result || result.installed) return result;
    const id = String(appId);
    const client = await steamClientDownloads();
    const live = clientDownloadProgress(client, id, result);
    if (live) return live;
    const log = contentLogProgress(await steamContentLogTail(), id);
    if (!log || log.state === 'ready') return result;
    const downloaded = Math.max(result.downloaded || 0, log.downloaded), total = log.total || result.total || 0;
    const state = result.state === 'paused' ? 'paused' : log.state === 'queued' && result.state !== 'queued' ? result.state : log.state;
    return { ...result, state, downloaded, total, rate: state === 'downloading' ? log.rate : 0, percent: total ? Math.min(100, Math.floor(downloaded / total * 100)) : result.percent, estimated: true };
  }
  ipcMain.handle('steam:download-controls', async () => {
    if (process.env.NEBULA_DEMO === '1') return { enabled: true, live: true };
    const enabled = await exists(await steamControlFlag());
    let live = false;
    if (enabled) try { live = await steamClientEval('typeof SteamClient?.Downloads?.PauseAppUpdate === "function"') === true; } catch { /* Steam is starting or closed. */ }
    return { enabled, live };
  });
  ipcMain.handle('steam:set-download-controls', async (_event, enabled) => {
    const flag = await steamControlFlag();
    if (!path.isAbsolute(flag)) throw new Error('Steam was not found on this PC.');
    if (enabled) await fs.writeFile(flag, '', 'utf8'); else await fs.rm(flag, { force: true });
    // Steam reads the setting when it starts. Restart it quietly unless a game is running.
    const runningId = await steamRunningAppId();
    const mayRestart = !activeGameSession && (!runningId || runningId === '0');
    if (mayRestart && process.env.NEBULA_DEMO !== '1') {
      const steamExe = path.join(path.dirname(flag), 'steam.exe');
      if (await steamRunning()) {
        await shell.openExternal('steam://exit');
        for (let waited = 0; waited < 40000 && await steamRunning(); waited += 1000) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      if (await exists(steamExe)) spawn(steamExe, ['-silent'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
    return { enabled: Boolean(enabled), restarted: mayRestart };
  });
  // After a silent uninstall, the game counts as installed until Steam has removed its manifest.
  const uninstallWatch = new Set();
  ipcMain.handle('steam:uninstall-status', async (_event, gameId) => {
    const game = currentLibrary.find(item => item.id === gameId && item.provider === 'Steam');
    if (!game) return { done: true };
    if (process.env.NEBULA_DEMO === '1') { game.installed = false; uninstallWatch.delete(gameId); return { done: true }; }
    for (const root of await findSteamRoots()) {
      if (await exists(path.join(root, 'steamapps', `appmanifest_${game.appId}.acf`))) return { done: false };
    }
    game.installed = false;
    game.sizeOnDisk = 0;
    uninstallWatch.delete(gameId);
    const snapshot = await readLibrarySnapshot().catch(() => null);
    if (snapshot) await writeLibrarySnapshot({ ...snapshot, games: currentLibrary }, artworkScanEpoch).catch(() => {});
    return { done: true };
  });
  ipcMain.handle('steam:download-action', async (_event, appId, action) => {
    if (!/^\d{1,10}$/.test(String(appId)) || !['pause', 'resume', 'pause-all', 'resume-all', 'top', 'remove', 'update', 'uninstall'].includes(action)) throw new Error('Unknown download action.');
    const status = action.startsWith('pause') ? 'paused' : action === 'remove' ? 'removed' : action === 'uninstall' ? 'uninstalling' : 'downloading';
    if (action === 'remove') removedDownloads.set(String(appId), Date.now()); else if (!action.endsWith('-all')) removedDownloads.delete(String(appId));
    if (process.env.NEBULA_DEMO === '1') return { status };
    const id = Number(appId);
    // These are the calls Steam's own Downloads page makes (steamui/sp.js). Every one takes the client ID
    // ("0" is this PC); without it Steam ignores them. Steam downloads one game at a time, so its pause button
    // pauses downloads as a whole (EnableAllDownloads(false)); PauseAppUpdate only moves a game out of the queue.
    const client = '"0"';
    const unpause = `if (window.__xboxPreviewDownloads?.overview?.paused) SteamClient.Downloads.EnableAllDownloads(true, ${client});`;
    const wait = 'await new Promise(resolve => setTimeout(resolve, 300));';
    const script = {
      pause: `SteamClient.Downloads.EnableAllDownloads(false, ${client})`,
      resume: `SteamClient.Downloads.EnableAllDownloads(true, ${client}); ${wait} SteamClient.Downloads.ResumeAppUpdate(${id}, ${client})`,
      'pause-all': `SteamClient.Downloads.EnableAllDownloads(false, ${client})`, 'resume-all': `SteamClient.Downloads.EnableAllDownloads(true, ${client})`,
      // To the front of the queue and started, like "Move to top" in the Xbox app.
      top: `${unpause} SteamClient.Downloads.SetQueueIndex(${id}, 0, ${client}); ${wait} SteamClient.Downloads.ResumeAppUpdate(${id}, ${client})`,
      remove: `SteamClient.Downloads.RemoveFromDownloadList(${id}, ${client})`,
      update: `${unpause} SteamClient.Downloads.QueueAppUpdate(${id}, ${client}); ${wait} SteamClient.Downloads.ResumeAppUpdate(${id}, ${client})`,
      // The player already confirmed in the launcher, so Steam's own prompt is skipped.
      uninstall: `SteamClient.Installs.OpenUninstallWizard([${id}], ${client}, true)`
    }[action];
    await steamClientEval(`(async () => { ${script}; return true; })()`, 6000);
    clientDownloadsCache.at = 0;
    // Removing a game that never finished installing cancels it, as the Xbox app does: Steam's own
    // uninstall deletes the partial download. Queued updates of installed games just leave the queue.
    if (action === 'remove') {
      const fresh = await steamPartialInstall(id).catch(() => false);
      if (fresh) await steamClientEval(`(async () => { await new Promise(resolve => setTimeout(resolve, 600)); SteamClient.Installs.OpenUninstallWizard([${id}], ${client}, true); return true; })()`, 6000).catch(() => {});
    }

    if (action === 'uninstall') {
      for (const game of currentLibrary) if (game.provider === 'Steam' && String(game.appId) === String(id)) uninstallWatch.add(game.id);
    }
    return { status };
  });
  // Steam's cached persona names are not evidence of friendship.
  const steamFriends = require('./steam-friends.cjs').createSteamFriends();
  ipcMain.handle('friends:list', async (_event, force = false) => {
    if (process.env.NEBULA_DEMO === '1') return { status: 'demo', friends: [], online: 0 };
    const settings = await readSettings();
    return steamFriends.list({
      steamId: settings.steamId64 || await detectSteamId64(),
      apiKey: settings.steamApiKey, force: force === true
    });
  });
  ipcMain.handle('friends:action', async (_event, action, friendId, appId = '', lobbyId = '') => {
    if (!/^\d{17}$/.test(String(friendId))) throw new Error('Unknown friend.');
    const urls = {
      chat: `steam://friends/message/${friendId}`,
      profile: `steam://url/SteamIDPage/${friendId}`,
      join: /^\d+$/.test(String(appId)) && /^\d+$/.test(String(lobbyId)) ? `steam://joinlobby/${appId}/${lobbyId}/${friendId}` : `steam://url/SteamIDPage/${friendId}`,
      add: 'steam://friends/add'
    };
    if (!urls[action]) throw new Error('Unknown friend action.');
    if (process.env.NEBULA_DEMO !== '1') await shell.openExternal(urls[action]);
    return true;
  });
  // Gamerscore calculator: the fixed 1,000-point split for a Steam game, from global unlock rates.
  const gamerscoreBreakdowns = new Map();
  ipcMain.handle('gamerscore:breakdown', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    const appId = String(game?.achievementReferenceAppId || game?.appId || '');
    if (!/^\d{1,10}$/.test(appId)) throw new Error('Choose a game with Steam achievements.');
    const cached = gamerscoreBreakdowns.get(appId);
    if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.result;
    const pcGamerscore = require('./pc-gamerscore.cjs');
    const settings = await readSettings();
    const getJson = async (url) => { const response = await fetch(url, { signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`Steam returned ${response.status}`); return response.json(); };
    const global = (await getJson(`https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`).catch(() => null))?.achievementpercentages?.achievements || [];
    let named = [];
    if (settings.steamApiKey) try {
      const schema = await getJson(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${encodeURIComponent(settings.steamApiKey)}&appid=${appId}&l=english`);
      named = (schema.game?.availableGameStats?.achievements || []).map((entry) => ({ id: String(entry.name), title: entry.displayName || entry.name, description: entry.hidden ? '' : entry.description || '', icon: safeSteamIcon(entry.icon) }));
    } catch { /* Fall back to the public achievement page. */ }
    if (!named.length) {
      const html = await fetch(`https://steamcommunity.com/stats/${appId}/achievements/?l=english`, { signal: AbortSignal.timeout(10000) }).then((response) => response.ok ? response.text() : '').catch(() => '');
      const items = parseSteamCommunityAchievements(html, appId);
      // The public page and the global API are both ordered by unlock rate, so ranks line up.
      const ranked = [...global].sort((a, b) => Number(b.percent) - Number(a.percent));
      named = items.map((item, index) => ({ id: ranked[index] ? String(ranked[index].name) : item.id, title: item.title, description: item.description, icon: item.icon, rarity: item.rarity }));
    }
    if (!named.length && global.length) named = global.map((entry) => ({ id: String(entry.name), title: String(entry.name), description: '', icon: null }));
    if (!named.length) throw new Error('This game has no Steam achievements.');
    const percentages = new Map(global.map((entry) => [String(entry.name), Number(entry.percent)]));
    for (const item of named) if (!percentages.has(item.id) && Number.isFinite(item.rarity)) percentages.set(item.id, item.rarity);
    const table = pcGamerscore.pointTable(named.map((item) => ({ apiname: item.id })), percentages);
    const items = named.map((item) => ({ title: item.title, description: item.description, icon: item.icon, percent: table[item.id]?.percent ?? null, points: table[item.id]?.points || 0 }))
      .sort((a, b) => b.points - a.points || a.title.localeCompare(b.title));
    const result = { appId, title: game?.title || '', total: items.reduce((sum, item) => sum + item.points, 0), rarityKnown: items.some((item) => item.percent !== null), items };
    gamerscoreBreakdowns.set(appId, { at: Date.now(), result });
    return result;
  });
  ipcMain.handle('game:storage', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    const folder = game.installPath || (game.executable ? path.dirname(game.executable) : '');
    const result = { installed: game.installed !== false, folder: folder || '', drive: '', freeBytes: null, sizeBytes: game.sizeOnDisk || null, sizeEstimated: false, version: game.buildId ? `Build ${game.buildId}` : game.version || '', lastUpdated: game.lastUpdated || 0 };
    if (!folder || game.installed === false || !await exists(folder)) return result;
    result.drive = path.parse(folder).root.replace(/\\$/, '');
    result.library = path.dirname(game.provider === 'Steam' ? path.dirname(path.dirname(folder)) : folder);
    try { const stats = await fs.statfs(path.parse(folder).root); result.freeBytes = stats.bavail * stats.bsize; } catch { /* Network drives may not report space. */ }
    if (!result.sizeBytes) {
      const cache = await readInstallSizes();
      let measured = cache[folder] ? { bytes: cache[folder].bytes, complete: true } : null;
      if (!measured) {
        measured = await measureFolderSize(folder, { until: Date.now() + 8000 });
        if (measured.complete && measured.bytes) { cache[folder] = { bytes: measured.bytes, at: Date.now() }; fs.writeFile(installSizeFile(), JSON.stringify(cache)).catch(() => {}); }
      }
      result.sizeBytes = measured.bytes || null;
      result.sizeEstimated = !measured.complete;
      if (measured.complete && measured.bytes) game.sizeOnDisk = measured.bytes;
    }
    if (!result.lastUpdated) try { result.lastUpdated = (await fs.stat(folder)).mtimeMs; } catch { /* Unknown. */ }
    return result;
  });
  ipcMain.handle('game:category:save', async (_event, gameId, isApp) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game || game.isLauncher) throw new Error('This item cannot be moved between Games and Apps.');
    const settings = await readSettings();
    await writeSettings({ gameCategoryOverrides: { ...(settings.gameCategoryOverrides || {}), [gameId]: Boolean(isApp) } });
    game.isApp = Boolean(isApp);
    return true;
  });
  ipcMain.handle('game:launch-options:save', async (_event, gameId, incoming) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game || game.provider !== 'Steam' || !game.appId) throw new Error('Steam launch options are only available for Steam games.');
    const value = String(incoming || '').trim();
    if (value.length > 512 || /[\r\n\0]/.test(value)) throw new Error('Launch options must be a single line under 512 characters.');
    const settings = await readSettings();
    const gameLaunchOptions = { ...(settings.gameLaunchOptions || {}), [gameId]: value };
    await writeSettings({ gameLaunchOptions });
    game.launchOptions = value;
    return true;
  });
  ipcMain.handle('artwork:search', (_event, query, gameId) => searchArtwork(String(query || '').trim(), String(gameId || '')));
  ipcMain.handle('artwork:catalog-choices', async (_event, title, source) => {
    const query = String(title || '').trim().slice(0, 160);
    if (!query || !['xbox', 'psn', 'ign'].includes(source)) return [];
    const artwork = source === 'xbox' ? await fetchXboxCatalogArtwork(query) : source === 'psn' ? await fetchPsnSquareArtwork(query) : await fetchIgnSquareArtwork(query);
    if (!artwork) return [];
    return [['tile', artwork.tile, true], ['hero', artwork.hero, false], ['wide', artwork.wide, false], ['logo', artwork.logo, false]]
      .filter(([, url]) => isAllowedArtworkUrl(url))
      .map(([slot, url, tileIsSquare]) => ({ slot, url, tileIsSquare, source: artwork.imageSource }));
  });
  ipcMain.handle('artwork:logo', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) return null;
    if (isAllowedArtworkUrl(game.artwork?.logo)) return game.artwork.logo;
    const settings = await readSettings();
    if (!settings.steamGridDbKey) return null;
    try {
      const sgdbId = game.artwork?.sgdbGameId;
      const result = sgdbId
        ? await fetchArtworkForSgdbGame({ id: sgdbId, name: game.title }, settings.steamGridDbKey)
        : await searchArtwork(game.title);
      if (!isAllowedArtworkUrl(result.logo)) return null;
      const nextArt = await artworkCache.cacheArtwork({ ...(game.artwork || {}), logo: result.logo, sgdbGameId: result.game?.id || sgdbId });
      game.artwork = nextArt;
      await writeSettings({ artwork: { ...(settings.artwork || {}), [game.id]: nextArt } });
      return nextArt.logo;
    } catch { return null; }
  });
  ipcMain.handle('news:get', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game || game.provider !== 'Steam' || !game.appId) return [];
    return fetchSteamNews(game.appId);
  });
  ipcMain.handle('game:details', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    return fetchGameDetails(game);
  });
  ipcMain.handle('steam:discovery', () => fetchSteamDiscovery());
  ipcMain.handle('steam:discovery-details', async (_event, appId) => {
    if (!/^\d{1,10}$/.test(String(appId))) throw new Error('Invalid Steam app ID.');
    const listings = await fetchSteamDiscovery().catch(() => ({ mostPlayed: [], topSellers: [], upcoming: [] }));
    // Any Steam game can have a page, owned or not (a friend's game, a Store search result).
    const game = [...listings.mostPlayed, ...listings.topSellers, ...listings.upcoming].find(item => item.appId === String(appId))
      || steamDiscoveryItem(appId, (await steamStoreItems([appId]).catch(() => []))[0]?.title || '', 0);
    return fetchGameDetails(game);
  });
  // A Steam game's name, price and artwork, for games you don't own.
  ipcMain.handle('steam:store-item', async (_event, appId) => {
    if (!/^\d{1,10}$/.test(String(appId))) throw new Error('Invalid Steam app ID.');
    const [item] = await steamStoreItems([appId]);
    if (!item) throw new Error('Steam doesn’t list this game in your region.');
    return item;
  });
  // Store search: the Xbox Store first, as in the Xbox app; Steam adds the PC games Xbox doesn't sell.
  ipcMain.handle('store:search', async (_event, query) => {
    const text = String(query || '').trim().slice(0, 120);
    if (text.length < 2) return { xbox: [], steam: [] };
    const normal = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const [xbox, steam] = await Promise.all([
      consoleServices.searchXboxStore(text).catch(() => []),
      steamLookup.search(text).then(items => items.map(item => steamDiscoveryItem(item.appId, item.title, 0, {
        id: `steam-store-${item.appId}`, price: item.price, controls: item.controls, artwork: item.artwork
      }))).catch(() => [])
    ]);
    // Games only (no soundtracks or tools), with Steam's real covers and prices.
    const onXbox = new Set(xbox.map(item => normal(item.title)));
    return { xbox, steam: steam.filter(item => !onXbox.has(normal(item.title))) };
  });
  ipcMain.handle('steam:open-store', async (_event, appId) => {
    if (!/^\d{1,10}$/.test(String(appId))) throw new Error('Invalid Steam app ID.');
    await shell.openExternal(`https://store.steampowered.com/app/${appId}/`);
    return true;
  });
  ipcMain.handle('game:owned-dlc', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    return fetchOwnedDlc(game);
  });
  ipcMain.handle('game:achievements', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    return fetchGameAchievements(game);
  });
  ipcMain.handle('game:achievement-reference:save', async (_event, gameId, value) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    const appId = String(value || '').trim();
    if (appId && !/^\d{1,10}$/.test(appId)) throw new Error('Enter a numeric Steam App ID.');
    const settings = await readSettings();
    const achievementReferenceAppIds = { ...(settings.achievementReferenceAppIds || {}) };
    if (appId) achievementReferenceAppIds[gameId] = appId;
    else delete achievementReferenceAppIds[gameId];
    await writeSettings({ achievementReferenceAppIds });
    game.achievementReferenceAppId = appId;
    invalidateGameDetails(gameId);
    return appId;
  });
  ipcMain.handle('artwork:save', async (_event, gameId, selection) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    if (!selection || typeof selection !== 'object') throw new Error('Choose artwork first.');
    for (const field of ['tile', 'hero', 'logo', 'wide']) {
      if (selection[field] != null && !isAllowedArtworkUrl(selection[field])) throw new Error(`Unsupported ${field} artwork source.`);
    }
    const settings = await readSettings();
    const previous = settings.artwork?.[gameId] || {};
    const nextArtwork = await artworkCache.cacheArtwork({
      ...previous,
      tile: selection.tile || previous.tile || null,
      grid: selection.tile || previous.grid || previous.tile || null,
      tileIsSquare: selection.tileIsSquare == null ? Boolean(previous.tileIsSquare) : Boolean(selection.tileIsSquare),
      overlayLogo: selection.overlayLogo == null ? previous.overlayLogo === true : Boolean(selection.overlayLogo),
      logo: selection.logo || previous.logo || null,
      hero: selection.hero || previous.hero || selection.tile || previous.tile || null,
      wide: selection.wide || previous.wide || null,
      sgdbGameId: selection.sgdbGameId || previous.sgdbGameId || null,
      imageSource: ['playstation-store', 'ign', 'xbox-catalog', 'official-steam', 'steamgriddb-manual'].includes(selection.imageSource) ? selection.imageSource : 'steamgriddb-manual',
      artworkVersion: 3,
      manual: true
    });
    await writeSettings({ artwork: { ...(settings.artwork || {}), [gameId]: nextArtwork } });
    game.artwork = nextArtwork;
    return nextArtwork;
  });
  ipcMain.handle('artwork:refresh-one', async (_event, gameId) => {
    const game = currentLibrary.find((item) => item.id === gameId);
    if (!game) throw new Error('Game is not in the current library.');
    const settings = await readSettings();
    const fresh = await artworkCache.cacheArtwork({ ...(await findArtwork(game.title, settings.steamGridDbKey, game.provider, game.installed !== false, game.appId)), lastAttemptedAt: Date.now() });
    if (!fresh.tile && !fresh.hero) throw new Error('No matching artwork found from PlayStation, IGN, Xbox, or SteamGridDB.');
    game.artwork = fresh;
    if (game.controls === 'unknown') game.controls = fresh.controls || 'unknown';
    await writeSettings({ artwork: { ...(settings.artwork || {}), [gameId]: fresh } });
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:artwork', [{ id: gameId, artwork: fresh }]);
    return fresh;
  });
  ipcMain.handle('app:rating-info', async (_event, system) => {
    const urls = { PEGI: 'https://pegi.info/what-do-the-labels-mean', ESRB: 'https://www.esrb.org/ratings-guide/', USK: 'https://usk.de/en/home/age-classification-for-games-and-apps/', 'COB-AU': 'https://www.classification.gov.au/classification-ratings/what-are-ratings', 'OFLC-NZ': 'https://www.classificationoffice.govt.nz/', CERO: 'https://www.cero.gr.jp/en/publics/index/17/', GRAC: 'https://www.grac.or.kr/english/', DJCTQ: 'https://www.gov.br/mj/pt-br/assuntos/seus-direitos/classificacao-1' };
    await shell.openExternal(urls[String(system)] || urls.PEGI);
    return true;
  });
  // Links on a game page (publisher support, website, Learn more): web pages and support email only.
  ipcMain.handle('app:open-link', async (_event, url) => {
    const value = String(url || '').trim();
    if (/^mailto:[^\s@<>"]+@[^\s@<>"]+$/i.test(value)) { await shell.openExternal(value); return true; }
    const target = new URL(/^[a-z]+:/i.test(value) ? value : `https://${value}`);
    if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error('Unsupported link.');
    await shell.openExternal(target.toString());
    return true;
  });
  ipcMain.handle('news:open', async (_event, url) => {
    const target = new URL(String(url));
    if (target.protocol !== 'https:' || !['store.steampowered.com', 'steamcommunity.com'].includes(target.hostname)) throw new Error('Unsupported news link.');
    await shell.openExternal(target.toString());
    return true;
  });
  ipcMain.handle('app:browse-files', (_event, directory, kind) => consoleServices.browseFiles(String(directory || ''), kind));
  ipcMain.handle('app:read-gamerpic', (_event, filename) => consoleServices.readGamerpic(String(filename || '')));
  ipcMain.handle('app:get-sound-pack', () => soundPack.get());
  ipcMain.handle('shop:offers', (event, appId) => {
    if(event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame)throw Error('Untrusted Store request');
    return storeOffers.get(appId, steamCountry());
  });
  ipcMain.handle('shop:open', (event, destination) => {
    if(event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw Error('Untrusted Store request');
    return steamShop.open(destination);
  });
  ipcMain.handle('shop:command', (event, action) => {
    if(event.sender !== mainWindow?.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) throw Error('Untrusted Store request');
    steamShop.command(action);
  });
  ipcMain.handle('app:install-sound-pack', (_event, folder) => soundPack.install(String(folder || '')));
  ipcMain.handle('app:reset-sound-pack', () => soundPack.reset());
  ipcMain.handle('xbox:gamepass-catalog', async () => (await consoleServices.getGamePassCatalog()).map(({details, ...game}) => game));
  ipcMain.handle('xbox:catalog-details', (_event, id) => consoleServices.getCatalogDetails(String(id || '')));
  ipcMain.handle('xbox:store', () => consoleServices.getXboxStore());
  ipcMain.handle('xbox:open-catalog-game', async (_event, id) => {
    if (!/^[A-Z0-9]{12}$/i.test(String(id))) throw Error('Invalid game');
    await shell.openExternal(`msxbox://game/?productId=${id}`);
    return true;
  });
  // Publisher logos for "Browse by publisher": the logo from the company's Wikipedia article, cached on disk.
  const publisherPages = { 'Deep Silver': 'Deep Silver', Konami: 'Konami', 'Rockstar Games': 'Rockstar Games', 'Warner Bros. Games': 'Warner Bros. Games', EA: 'Electronic Arts', Bethesda: 'Bethesda Softworks', Blizzard: 'Blizzard Entertainment', 'Bandai Namco': 'Bandai Namco Entertainment', '2K': '2K (company)',
    Valve: 'Valve Corporation', SEGA: 'Sega', 'CD PROJEKT RED': 'CD Projekt', 'PlayStation Studios': 'PlayStation Studios', 'Warner Bros. Games': 'Warner Bros. Games', KRAFTON: 'Krafton',
    'IO Interactive': 'IO Interactive', Rebellion: 'Rebellion Developments', 'THQ Nordic': 'THQ Nordic', 'Focus Entertainment': 'Focus Entertainment', 'Riot Games': 'Riot Games' };
  const logoFile = () => path.join(path.dirname(settingsPath()), 'publisher-logos.json');
  let publisherLogos = null, logoQueue = Promise.resolve();
  ipcMain.handle('art:publisher-logo', async (_event, name) => {
    const publisher = String(name || '').trim().slice(0, 80);
    if (!publisher) return '';
    if (!publisherLogos) { try { publisherLogos = JSON.parse(await fs.readFile(logoFile(), 'utf8')) || {}; } catch { publisherLogos = {}; } }
    const cached = publisherLogos[publisher];
    // A found logo is kept; "no logo" is only trusted when Wikidata actually answered (rate limits are retried).
    if (cached && (cached.url || (cached.none && Date.now() - cached.at < 7 * 24 * 60 * 60 * 1000))) return cached.url || '';
    // Wikidata's "logo image" (P154): the current logo, skipping deprecated ones and those with an end date.
    // Requests go one at a time, since Wikidata turns away bursts.
    const run = logoQueue.then(async () => {
      const lookup = async title => {
        const response = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(title)}&props=claims&format=json&maxlag=5`, { headers: { 'User-Agent': 'XboxPreviewUI/1.0 (publisher logos)' }, signal: AbortSignal.timeout(6000) });
        if (!response.ok) return { error: true };
        let body; try { body = await response.json(); } catch { return { error: true }; }
        if (body?.error) return { error: true };
        const claims = (Object.values(body?.entities || {})[0]?.claims?.P154 || []).filter(claim => claim?.mainsnak?.datavalue?.value && claim.rank !== 'deprecated');
        const current = claims.filter(claim => !claim.qualifiers?.P582);
        const chosen = current.find(claim => claim.rank === 'preferred') || current[current.length - 1] || claims[claims.length - 1];
        const file = String(chosen?.mainsnak?.datavalue?.value || '');
        return { url: file && /\.(svg|png)$/i.test(file) ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=600` : '' };
      };
      let result = { error: true };
      for (let attempt = 0; attempt < 2 && result.error; attempt++) {
        try { result = await lookup(publisherPages[publisher] || publisher); } catch { result = { error: true }; }
        if (result.error) await new Promise(resolve => setTimeout(resolve, 3000));
      }
      // "Konami" style names sometimes live under "<name> (company)".
      if (!result.error && !result.url && !publisherPages[publisher]) { try { const alt = await lookup(`${publisher} (company)`); if (alt.url) result = alt; } catch { /* Keep the first answer. */ } }
      await new Promise(resolve => setTimeout(resolve, 1200));
      return result;
    });
    logoQueue = run.catch(() => '');
    const result = await run;
    const url = result.url || '';
    if (result.error) return '';
    publisherLogos[publisher] = { url, none: !url, at: Date.now() };
    fs.writeFile(logoFile(), JSON.stringify(publisherLogos)).catch(() => {});
    return url;
  });
  // "Add a game or app": everything in the Start menu, as the Xbox app lists it, with each app's icon.
  let startMenuCache = { at: 0, list: [] };
  ipcMain.handle('apps:start-menu', async () => {
    if (Date.now() - startMenuCache.at < 5 * 60 * 1000 && startMenuCache.list.length) return startMenuCache.list;
    const roots = [path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')];
    const skip = /(unins|uninstall|setup|install(er)?\b|update|readme|help|manual|license|website|support|documentation|release notes|crash|report)/i;
    const shortcuts = [];
    const walk = async (directory, depth) => {
      let entries = [];
      try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory() && depth < 3) await walk(full, depth + 1);
        else if (entry.isFile() && /\.lnk$/i.test(entry.name) && !skip.test(entry.name)) shortcuts.push(full);
      }
    };
    for (const root of roots) await walk(root, 0);
    const owned = new Set(currentLibrary.map(game => String(game.executable || '').toLowerCase()).filter(Boolean));
    const seen = new Set(), list = [];
    for (const file of shortcuts.slice(0, 900)) {
      let target = '';
      try { target = shell.readShortcutLink(file).target || ''; } catch { continue; }
      const key = target.toLowerCase();
      if (!/\.exe$/i.test(target) || seen.has(key) || skip.test(path.basename(target)) || /\\windows\\(system32|syswow64)\\/i.test(target)) continue;
      seen.add(key);
      if (!await exists(target)) continue;
      list.push({ name: path.basename(file, '.lnk'), target, added: owned.has(key) });
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    // Icons last, a few at a time, so the list itself is quick.
    for (let index = 0; index < list.length; index += 8) {
      await Promise.all(list.slice(index, index + 8).map(async item => {
        try { item.icon = (await app.getFileIcon(item.target, { size: 'large' })).toDataURL(); } catch { item.icon = ''; }
      }));
    }
    startMenuCache = { at: Date.now(), list };
    return list;
  });
  ipcMain.handle('game:add', async (_event, selectedPath) => {
    if (!selectedPath) return null;
    const executable = String(selectedPath);
    if (!path.isAbsolute(executable) || !/\.(exe|bat|cmd)$/i.test(executable) || !(await fs.stat(executable)).isFile()) throw Error('Choose an existing game or app');
    const customGame = {
      id: `custom-${Buffer.from(executable.toLowerCase()).toString('base64url')}`,
      title: path.basename(executable, path.extname(executable)),
      provider: 'PC',
      installPath: path.dirname(executable),
      executable,
      args: '',
      isApp: false
    };
    return { ...customGame, isCustom: true };
  });
  ipcMain.handle('game:bulk-add', async (_event, selectedPath) => {
    if (!selectedPath) return { added: 0, canceled: true };
    const root = path.resolve(String(selectedPath));
    if (!path.isAbsolute(String(selectedPath)) || !(await fs.stat(root)).isDirectory()) throw Error('Choose an existing folder');
    const queue = [{ directory: root, depth: 0, gameTitle: '' }];
    const candidates = new Map();
    const ignored = /(unins|uninstall|setup|install|update|crash|report|redistributable|prereq|anticheat|launcherupdater)/i;
    let visited = 0;
    while (queue.length && visited < 800 && candidates.size < 300) {
      const { directory, depth, gameTitle } = queue.shift();
      visited++;
      let entries = [];
      try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { continue; }
      const launchers = entries.filter((entry) => entry.isFile() && /\.exe$/i.test(entry.name) && !ignored.test(entry.name));
      if (launchers.length) {
        const preferred = launchers.find((entry) => normalizeTitle(entry.name).includes(normalizeTitle(path.basename(directory)))) || launchers[0];
        const title = gameTitle || path.parse(preferred.name).name;
        if (!candidates.has(title)) candidates.set(title, { executable: path.join(directory, preferred.name), title });
      }
      if (depth < 4) for (const entry of entries) {
        if (entry.isDirectory() && !/(redist|support|prereq|directx|vcredist)/i.test(entry.name)) queue.push({ directory: path.join(directory, entry.name), depth: depth + 1, gameTitle: gameTitle || entry.name });
      }
      if (visited % 20 === 0 && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library:progress', { percent: Math.min(25, Math.round(visited / 800 * 25)), message: `Searching folders… ${visited} checked` });
    }
    const settings = await readSettings();
    const customGames = [...(settings.customGames || [])];
    const known = new Set(customGames.map((game) => String(game.executable).toLowerCase()));
    let added = 0;
    for (const candidate of candidates.values()) {
      if (known.has(candidate.executable.toLowerCase())) continue;
      const id = `custom-${Buffer.from(candidate.executable.toLowerCase()).toString('base64url')}`;
      customGames.push({ id, title: candidate.title, provider: 'PC', installPath: path.dirname(candidate.executable), executable: candidate.executable, args: '', isCustom: true, isApp: false });
      known.add(candidate.executable.toLowerCase());
      added++;
    }
    await writeSettings({ customGames });
    return { added, scanned: visited, truncated: queue.length > 0 || candidates.size >= 300 };
  });
  ipcMain.handle('game:custom:save', async (_event, incoming) => {
    const title = String(incoming?.title || '').trim();
    if (!title || title.length > 160 || /[\r\n\0]/.test(title)) throw new Error('Enter a game name under 160 characters.');
    const executable = String(incoming?.executable || '');
    if (!/\.(exe|bat|cmd)$/i.test(executable) || !await exists(executable)) throw new Error('Choose an existing Windows executable.');
    const id = `custom-${Buffer.from(executable.toLowerCase()).toString('base64url')}`;
    if (incoming.id && incoming.id !== id) throw new Error('The custom game executable cannot be changed here.');
    artworkScanEpoch++;
    const settings = await readSettings();
    const previous = (settings.customGames || []).find((item) => item.id === id);
    const customGame = { ...previous, id, title, provider: 'PC', installPath: path.dirname(executable), executable, args: previous?.args || '', isCustom: true, isApp: Boolean(incoming.isApp) };
    const customGames = [...(settings.customGames || []).filter((item) => item.id !== id), customGame];
    let artwork = settings.artwork || {};
    const selection = incoming.artwork;
    if (selection && !isAllowedArtworkUrl(selection.url)) throw new Error('The selected artwork URL is not supported. Choose another image.');
    if (selection) {
      artwork = { ...artwork, [id]: {
        ...(artwork[id] || {}), tile: selection.url, grid: selection.url,
        tileIsSquare: Boolean(selection.tileIsSquare), overlayLogo: Boolean(selection.overlayLogo),
        logo: isAllowedArtworkUrl(selection.logo) ? selection.logo : artwork[id]?.logo || null,
        hero: isAllowedArtworkUrl(selection.hero) ? selection.hero : selection.url,
        wide: isAllowedArtworkUrl(selection.wide) ? selection.wide : artwork[id]?.wide || null,
        sgdbGameId: selection.sgdbGameId || null, imageSource: 'steamgriddb-manual', artworkVersion: 3, manual: true
      } };
    }
    await writeSettings({ customGames, artwork });
    invalidateGameDetails(id);
    return customGame;
  });
  ipcMain.handle('app:minimize-to-taskbar', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
    return true;
  });
  ipcMain.handle('app:power', (_event, action) => runPowerAction(action, { demo: process.env.NEBULA_DEMO === '1' || process.env.NEBULA_REVIEW === '1' }));
  ipcMain.handle('app:quit', () => app.quit());
  ipcMain.handle('updater:status', () => updater.status());
  ipcMain.handle('app:safe-mode', () => safeMode);
  ipcMain.handle('diagnostics:copy', async () => {
    const settings = await readSettings();
    const text = support.buildDiagnostics({
      version: app.getVersion(), packaged: app.isPackaged, portable: Boolean(process.env.PORTABLE_EXECUTABLE_FILE),
      electronVersion: process.versions.electron, platform: process.platform, release: require('os').release(), locale: app.getLocale(),
      settings, lastLaunch, updater: updater.status(), safeMode, startup: startupGuard?.snapshot()
    });
    clipboard.writeText(text);
    return { characters: text.length };
  });
  ipcMain.handle('backup:export', async () => {
    const settings = await readSettings();
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'question', buttons: ['Leave keys out', 'Include keys', 'Cancel'], defaultId: 0, cancelId: 2,
      title: 'Export settings', message: 'Include your API keys in the backup?',
      detail: 'Keys let whoever opens the file use them. Leave them out to share a backup safely.'
    });
    if (choice.response === 2) return { status: 'cancelled' };
    const picked = await dialog.showSaveDialog(mainWindow, { title: 'Save settings backup', defaultPath: `xbox-preview-ui-settings-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'Settings backup', extensions: ['json'] }] });
    if (picked.canceled || !picked.filePath) return { status: 'cancelled' };
    const backup = support.buildBackup(settings, { includeKeys: choice.response === 1, version: app.getVersion() });
    await fs.writeFile(picked.filePath, JSON.stringify(backup, null, 2), 'utf8');
    return { status: 'saved', file: path.basename(picked.filePath), includesKeys: backup.includesKeys, count: Object.keys(backup.data).length };
  });
  ipcMain.handle('backup:import', async () => {
    const picked = await dialog.showOpenDialog(mainWindow, { title: 'Open settings backup', properties: ['openFile'], filters: [{ name: 'Settings backup', extensions: ['json'] }] });
    if (picked.canceled || !picked.filePaths[0]) return { status: 'cancelled' };
    const parsed = support.parseBackup(await fs.readFile(picked.filePaths[0], 'utf8'));
    await writeSettings(parsed.data, { replaceArtwork: true });
    return { status: 'restored', file: path.basename(picked.filePaths[0]), count: Object.keys(parsed.data).length, includesKeys: parsed.includesKeys };
  });
  ipcMain.handle('updater:check', () => updater.check({ force: true }));
  ipcMain.handle('updater:install', () => updater.installNow());
}

async function createWindow() {
  const settings = await readSettings();
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1024,
    minHeight: 650,
    backgroundColor: '#080b0e',
    autoHideMenuBar: true,
    frame: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    fullscreen: settings.fullscreen,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: true,
      autoplayPolicy: 'no-user-gesture-required',
      offscreen: Boolean(process.env.NEBULA_CAPTURE_SET || process.env.NEBULA_REVIEW)
    }
  });
  mainWindow.setMenu(null);
  steamShop = createSteamShop(mainWindow, { WebContentsView:require('electron').WebContentsView, ipcMain });
  // A healthy start means the window loaded and stayed up. Two starts in a row that never got there make the
  // next start run in safe mode (see support.cjs).
  mainWindow.webContents.once('did-finish-load', () => setTimeout(() => startupGuard?.healthy(), 20000));
  // If the page itself crashes, reload it, but not in a loop.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`Launcher page stopped (${details.reason})`);
    startupGuard?.crashed();
    if (details.reason !== 'clean-exit' && rendererRecoveries++ < 3 && mainWindow && !mainWindow.isDestroyed()) setTimeout(() => mainWindow?.webContents.reload(), 800);
  });
  mainWindow.once('ready-to-show', () => {
    if (XBOX_MODE) mainWindow.setFullScreen(true);
    if (!process.env.NEBULA_CAPTURE && !process.env.NEBULA_CAPTURE_SET && !process.env.NEBULA_REVIEW) mainWindow.show();
  });
  await mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.webContents.setZoomFactor(1);
  if (process.env.NEBULA_CAPTURE_SET && process.env.NEBULA_DEMO === '1') {
    setTimeout(async () => {
      const output = process.env.NEBULA_CAPTURE_SET;
      await fs.mkdir(output, { recursive: true });
      for (const [name, script] of [['home', "showView('home')"], ['library', "showView('library')"], ['game-details', "openGameDetails('demo-1')"]]) {
        await mainWindow.webContents.executeJavaScript(script);
        await new Promise((resolve) => setTimeout(resolve, name === 'game-details' ? 6000 : 1300));
        console.log('Demo capture', name, await mainWindow.webContents.executeJavaScript('({view:state.view,home:homeView.hidden,library:libraryView.hidden,detail:gameDetailView.hidden})'));
        await fs.writeFile(path.join(output, `${name}.png`), (await mainWindow.webContents.capturePage()).toPNG());
      }
      if (process.env.NEBULA_SMOKE_IMPORT === '1') {
        const executable = process.execPath;
        const id = `custom-${Buffer.from(executable.toLowerCase()).toString('base64url')}`;
        const result = await mainWindow.webContents.executeJavaScript(`(async () => {
          const before = await window.launcher.getSettings();
          const url = before.artwork['demo-1']?.tile;
          if (!url) throw new Error('Demo artwork was not ready for the import test.');
          await window.launcher.saveCustomGame({ id: ${JSON.stringify(id)}, executable: ${JSON.stringify(executable)}, title: 'Import artwork smoke test', isApp: true, artwork: { url, tileIsSquare: true, overlayLogo: false } });
          const saved = await window.launcher.getSettings();
          const imported = saved.customGames.some(game => game.id === ${JSON.stringify(id)} && game.isApp);
          const artworkSaved = saved.artwork[${JSON.stringify(id)}]?.tile === url;
          const cleared = await window.launcher.clearCustomArtwork();
          const afterClear = await window.launcher.getSettings();
          const artworkCleared = !afterClear.artwork[${JSON.stringify(id)}];
          await window.launcher.resetLauncherData();
          const afterReset = await window.launcher.getSettings();
          return { imported, artworkSaved, cleared, artworkCleared, reset: !afterReset.onboardingComplete && afterReset.customGames.length === 0 && Object.keys(afterReset.artwork).length === 0 };
        })()`);
        console.log('Import artwork smoke test', result);
      }
      app.quit();
    }, Number(process.env.NEBULA_CAPTURE_DELAY || 20000));
  }
  if (process.env.NEBULA_CAPTURE) {
    setTimeout(async () => {
      if (process.env.NEBULA_CAPTURE_VIEW === 'library') await mainWindow.webContents.executeJavaScript("showView('library')");
      if (process.env.NEBULA_CAPTURE_VIEW === 'detail') await mainWindow.webContents.executeJavaScript("openGameDetails('demo-1')");
      if (process.env.NEBULA_CAPTURE_VIEW) await new Promise((resolve) => setTimeout(resolve, 1800));
      const image = await mainWindow.webContents.capturePage();
      await fs.writeFile(process.env.NEBULA_CAPTURE, image.toPNG());
      app.quit();
    }, Number(process.env.NEBULA_CAPTURE_DELAY || 1800));
  }
}

// Built-in updates: checks GitHub in the background and installs a verified build when you choose or when the
// launcher closes. A game the launcher started counts as running, so nothing is replaced under it.
const updater = createUpdater({
  app,
  getWindow: () => mainWindow,
  isGameRunning: () => Boolean(activeGameSession || remotePlay.active()),
  log: message => console.log(message)
});
app.on('before-quit', event => updater.applyOnQuit(event));
app.on('before-quit', event => { if (!event.defaultPrevented) remotePlay.dispose(); });

app.whenReady().then(async () => {
  windowsHomeCountry = await detectWindowsHomeCountry();
  playerRegion = (await readSettings()).region || 'auto';
  registerIpc();
  startupGuard = support.createStartupGuard(path.join(app.getPath('userData'), 'startup-state.json'));
  safeMode = await startupGuard.begin();
  if (safeMode) console.warn('Starting in safe mode after repeated start-up problems: background refresh, prefetch and update checks are off.');
  if (process.env.NEBULA_SGDB_KEY) {
    const saved = await readSettings();
    if (!saved.steamGridDbKey) await writeSettings({ steamGridDbKey: process.env.NEBULA_SGDB_KEY });
  }
  await createWindow();
  if (!safeMode) updater.start();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
