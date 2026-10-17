// Support tools: a rolling log, a safe-mode guard for repeated startup failures, redacted diagnostics,
// and settings backup and restore. Kept apart from main.cjs so each piece can be tested on its own.
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

const LOG_LIMIT = 400;
const logLines = [];
let capturing = false;

// Keeps the last few hundred console lines so a diagnostics report has what happened just before a problem.
function installLogCapture() {
  if (capturing) return;
  capturing = true;
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      try {
        const text = args.map(item => (item instanceof Error ? item.stack || item.message : typeof item === 'string' ? item : JSON.stringify(item))).join(' ');
        logLines.push(`${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${text.slice(0, 600)}`);
        if (logLines.length > LOG_LIMIT) logLines.splice(0, logLines.length - LOG_LIMIT);
      } catch { /* A log line that can't be formatted is skipped. */ }
      original(...args);
    };
  }
}
function recentLog(count = 300) {
  return logLines.slice(-count).join('\n');
}

// Start-up guard: if the launcher didn't reach a healthy state on the last two starts (it crashed, hung or
// closed straight away), the next start runs in safe mode: no background refresh, no prefetch, no update checks.
function createStartupGuard(file) {
  let state = { failedStarts: 0, pending: false };
  async function load() {
    try { state = { ...state, ...JSON.parse(await fs.readFile(file, 'utf8')) }; } catch { /* First run, or unreadable: start clean. */ }
  }
  async function save() {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(`${file}.tmp`, JSON.stringify(state), 'utf8');
    await fs.rename(`${file}.tmp`, file);
  }
  return {
    // Returns true when this start should run in safe mode.
    async begin() {
      await load();
      if (state.pending) state.failedStarts = Number(state.failedStarts || 0) + 1;
      state.pending = true;
      await save().catch(() => {});
      return state.failedStarts >= 2;
    },
    // The window loaded and stayed up: this start counts as good.
    async healthy() {
      if (!state.pending && !state.failedStarts) return;
      state = { failedStarts: 0, pending: false };
      await save().catch(() => {});
    },
    async crashed() {
      state.failedStarts = Number(state.failedStarts || 0) + 1;
      await save().catch(() => {});
    },
    snapshot: () => ({ ...state })
  };
}

// Redacts the things a report should never contain: API keys and the Steam account id, plus the Windows user folder.
function redact(text, secrets = [], home = os.homedir()) {
  let out = String(text ?? '');
  for (const secret of secrets) if (secret && String(secret).length >= 4) out = out.split(String(secret)).join('[redacted]');
  if (home) out = out.split(home).join('%USERPROFILE%');
  return out;
}

// One text file a player can paste into a bug report.
function buildDiagnostics({ version, packaged, portable, electronVersion, platform, release, locale, settings, lastLaunch, updater, safeMode, startup, now = Date.now() }) {
  const secrets = [settings.steamApiKey, settings.steamGridDbKey, settings.steamId64];
  const counts = key => (Array.isArray(settings[key]) ? settings[key].length : Object.keys(settings[key] || {}).length);
  const on = key => (settings[key] ? 'on' : 'off');
  const sections = [
    ['Launcher', [
      `Version: ${version} (${packaged ? (portable ? 'portable' : 'installed') : 'development'})`,
      `Electron: ${electronVersion}`,
      `Windows: ${platform} ${release} · ${locale}`,
      `Generated: ${new Date(now).toISOString()}`
    ]],
    ['Start-up', [
      `Safe mode this start: ${safeMode ? 'yes' : 'no'}`,
      `Failed starts in a row: ${startup?.failedStarts ?? 0}`
    ]],
    ['Last launch', lastLaunch
      ? [`Game: ${lastLaunch.title} (${lastLaunch.provider})`, `Started at: ${new Date(lastLaunch.at).toISOString()}`, `Outcome: ${lastLaunch.result || 'still waiting'}`]
      : ['No game launched in this session']],
    ['Updates', [`State: ${updater?.state || 'unknown'}`, `Checked: ${updater?.checkedAt ? new Date(updater.checkedAt).toISOString() : 'never'}`, updater?.error ? `Last error: ${updater.error}` : 'Last error: none']],
    ['Settings (summary, keys and ids removed)', [
      `Steam Web API key: ${settings.steamApiKey ? 'set' : 'not set'} · SteamGridDB key: ${settings.steamGridDbKey ? 'set' : 'not set'}`,
      `Hidden games: ${counts('hiddenGameIds')} · Favorites: ${counts('favoriteGameIds')} · Custom collections: ${counts('customCollections')}`,
      `Artwork choices: ${counts('artwork')} · Custom games: ${counts('customGames')} · Play history: ${counts('playHistory')}`,
      `Uninstalled Steam shown: ${on('showUninstalledSteam')} · Steam Family: ${on('includeSteamFamily')} · Reduced motion: ${on('reducedMotion')}`
    ]],
    ['Recent log', [recentLog(300)]]
  ];
  const text = sections.map(([title, lines]) => `== ${title} ==\n${lines.join('\n')}`).join('\n\n');
  return redact(text, secrets);
}

// Backup: the settings a player would hate to rebuild. API keys are left out unless the player explicitly includes them.
const BACKUP_FIELDS = ['hiddenGameIds', 'favoriteGameIds', 'customCollections', 'artwork', 'playHistory', 'playCounts', 'customGames',
  'gameLaunchOptions', 'installChoices', 'gameCategoryOverrides', 'achievementReferenceAppIds', 'displayName', 'avatarId', 'profileNameMode',
  'profileAvatarCustomized', 'uiScale', 'uiScaleCustomized', 'textScale', 'reducedMotion', 'theme', 'highContrastFocus', 'steamInstallLibrary',
  'duplicateMode', 'duplicatePreferredProvider', 'duplicatePreferences', 'showUninstalledSteam', 'showUninstalledEpic',
  'showUninstalledUbisoft', 'showUninstalledEA', 'showUninstalledBattleNet', 'showUninstalledGog', 'showUninstalledAmazon',
  'includeSteamFamily', 'steamFamilyAccountId',
  // Console settings added with the settings registry.
  'clockFormat', 'dateOrder', 'enterButton', 'nintendoLayout', 'menuMusic', 'menuMusicVolume', 'screensaverDelay',
  'notifyFriends', 'notifyDownloads', 'notifyAchievements', 'screenLayout3ds', 'ps3ThemeColour'];
const KEY_FIELDS = ['steamApiKey', 'steamGridDbKey'];
const BACKUP_FORMAT = 'xbox-preview-ui-backup';

function buildBackup(settings, { includeKeys = false, now = Date.now(), version = '' } = {}) {
  const data = {};
  for (const field of BACKUP_FIELDS) if (settings[field] !== undefined) data[field] = settings[field];
  if (includeKeys) for (const field of KEY_FIELDS) if (settings[field]) data[field] = settings[field];
  return { format: BACKUP_FORMAT, formatVersion: 1, exportedAt: new Date(now).toISOString(), appVersion: version, includesKeys: includeKeys, data };
}

// Reads a backup file and keeps only the fields it knows about, with the right types.
function parseBackup(text) {
  let file;
  try { file = JSON.parse(String(text || '')); } catch { throw new Error('That file is not a settings backup.'); }
  if (!file || file.format !== BACKUP_FORMAT || file.formatVersion !== 1 || typeof file.data !== 'object') throw new Error('That file is not a settings backup from Xbox Preview UI.');
  const shape = { hiddenGameIds: 'array', favoriteGameIds: 'array', customCollections: 'array', customGames: 'array', playHistory: 'array', artwork: 'object', playCounts: 'object', gameLaunchOptions: 'object', installChoices: 'object', gameCategoryOverrides: 'object', achievementReferenceAppIds: 'object', duplicatePreferences: 'object' };
  const data = {};
  for (const field of [...BACKUP_FIELDS, ...KEY_FIELDS]) {
    const value = file.data[field];
    if (value === undefined) continue;
    if (shape[field] === 'array' && !Array.isArray(value)) continue;
    if (shape[field] === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) continue;
    if (KEY_FIELDS.includes(field) && typeof value !== 'string') continue;
    data[field] = value;
  }
  if (!Object.keys(data).length) throw new Error('The backup has no settings in it.');
  return { data, includesKeys: Boolean(file.includesKeys), exportedAt: file.exportedAt || '' };
}

module.exports = { installLogCapture, recentLog, createStartupGuard, redact, buildDiagnostics, buildBackup, parseBackup, BACKUP_FIELDS, KEY_FIELDS };
