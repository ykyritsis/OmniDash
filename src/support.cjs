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
  if (!file || file.format !== BACKUP_FORMAT || file.formatVersion !== 1 || typeof file.data !== 'object') throw new Error('That file is not a settings backup from OmniDash.');
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

// ---------------------------------------------------------------------------
// Console theme packs (Settings → Appearance → Console packs, task P1).
// The player keeps Sony/Nintendo/Microsoft art, fonts and sounds in their own
// %APPDATA%\xbox-preview-ui\theme-packs folder; the app reads fixed names out of it and draws fallbacks without it.
// This registry is the one place that knows every pack folder the themes read, the credit documented for it, and
// the exact file names it looks for. main.cjs serves it over theme:packs; the renderer never hard-codes a pack, and
// scripts/pack-manager-test.cjs checks the registry against the IPC lists in main.cjs.
// ---------------------------------------------------------------------------
const PACK_README_NAME = 'OMNIDASH-README.md';
const PACK_COUNT_KEYS = ['icons', 'fonts', 'sounds', 'music', 'wallpapers', 'video'];
const PACK_REGISTRY = [
  {
    id: 'ps3', console: 'ps3', name: 'PlayStation 3', folder: 'ps3',
    credit: 'github.com/CorruptionVR/PS3-Simulator (Unlicense) and github.com/JMRDev0/XMB-PS3-Icons-Sounds-Pack- (MIT)',
    install: 'the PS3 Simulator icons and font, and the XMB Icons + Sounds pack',
    expected: [
      { label: 'Icons', folder: 'PS3-Simulator-main/icons', names: ['settings.png', 'psn.png', 'theme-settings.png'] },
      { label: 'Font', folder: 'PS3-Simulator-main/fonts', names: ['SCE-PS3-RD-R-LATIN2.woff'] },
      { label: 'Sounds', folder: 'XMB-PS3-Icons-Sounds-Pack--main/pack/PS3 Icons + Sounds/oggs', names: ['down.ogg', 'ok.ogg', 'cancel.ogg', 'up.ogg', 'unlock.ogg'] },
      { label: 'Music', folder: 'music', names: ['menu.ogg', 'menu.mp3'] },
      { label: 'Music (pack)', folder: 'XMB-PS3-Icons-Sounds-Pack--main/pack/PS3 Icons + Sounds/oggs', names: ['bgm.ogg'] }
    ]
  },
  {
    id: 'ps4', console: 'ps4', name: 'PlayStation 4', folder: 'ps4',
    credit: 'github.com/d4v1-sudo/Ps4-UI (MIT)',
    install: 'the Ps4-UI pack (wave background, SST font, icons and sounds)',
    expected: [
      { label: 'Wallpaper', folder: 'Ps4-UI-master/assets/img', names: ['background.png'] },
      { label: 'Font', folder: 'Ps4-UI-master/assets/font', names: ['sst.ttf'] },
      { label: 'Sounds', folder: 'Ps4-UI-master/assets/js', names: ['navigate.mp3', 'reward.mp3', 'startup.mp3', 'shutdown.mp3'] },
      { label: 'Music', folder: 'music', names: ['menu.mp3', 'menu.ogg'] },
      { label: 'Music (pack)', folder: 'Ps4-UI-master/assets/js', names: ['all.mp3'] }
    ]
  },
  {
    id: 'wii', console: 'wii', name: 'Wii', folder: 'wii',
    credit: 'github.com/andrewplus/Wii.JS (GPL-3) and github.com/aica7/Liink (GPL-2)',
    install: 'the Wii.JS channel art and sounds, and the Liink Rodin fonts',
    expected: [
      { label: 'Channel frame', folder: 'Wii.JS-gh-pages/assets/images', names: ['channel-border.png'] },
      { label: 'Fonts', folder: 'Liink-main/fonts', names: ['FOT-RodinProN-DB.otf', 'FOT-RodinProN-B.otf'] },
      { label: 'Sounds', folder: 'Wii.JS-gh-pages/assets/audio', names: ['button-hover.mp3', 'zip.mp3', 'button-select.mp3', 'back.mp3', 'startup.mp3'] },
      { label: 'Music', folder: 'music', names: ['menu.mp3', 'menu.ogg'] },
      { label: 'Music (pack)', folder: 'Wii.JS-gh-pages/assets/audio', names: ['bg-music.mp3'] }
    ]
  },
  {
    id: '3ds', console: '3ds', name: 'Nintendo 3DS', folder: '3ds',
    credit: 'Owner-supplied 3DS HOME Menu assets (docs/theme-packs.md)',
    install: '3DS HOME Menu music (icons and other HOME Menu assets are used when present)',
    expected: [
      { label: 'Music', folder: 'music', names: ['menu.mp3', 'menu.ogg'] }
    ]
  },
  {
    id: 'x360', console: 'x360', name: 'Xbox 360', folder: 'dashx360',
    credit: 'DashX360 by ZivvoZ (github.com/ZivvoZ/dashx360)',
    install: 'the DashX360 pack (boot video, dashboard art and sounds)',
    expected: [
      { label: 'Boot video', folder: 'Boot', names: ['Boot Screen.mp4'] },
      { label: 'Sounds', folder: 'Audio/Sounds', names: ['tile-hover.wav', '10. Select A.mp3', '14. Back.mp3', '08. Page Left.mp3', '09. Page Right.mp3'] },
      { label: 'Music', folder: 'Audio/Music', names: ['menu music.mp3', 'menu.mp3', 'menu.ogg'] },
      { label: 'Dashboard theme', folder: 'Custom Files/Themes', names: ['<name>/theme.json'] }
    ]
  },
  {
    id: 'series', console: 'series', name: 'Xbox Series X|S', folder: 'series',
    credit: 'OmniDash drawn music loop (drop-in music folder)',
    install: 'an optional music loop for the Series dashboard',
    expected: [
      { label: 'Music', folder: 'music', names: ['menu.mp3', 'menu.ogg'] }
    ]
  },
  {
    id: 'one', console: 'one', name: 'Xbox One', folder: 'one',
    credit: 'OmniDash drawn music loop (drop-in music folder)',
    install: 'an optional music loop for the Xbox One dashboard',
    expected: [
      { label: 'Music', folder: 'music', names: ['menu.mp3', 'menu.ogg'] }
    ]
  }
];
// Folders that hold reference material, not assets: `*/ref/` is Wikipedia captures for measuring, and DashX360's
// `References/` is screenshots. They must never make an empty pack look installed.
const PACK_SKIP_DIRS = new Set(['ref', 'refs', 'reference', 'references', 'screenshots', 'screenshot', '.git', '.github', '__macosx', 'node_modules']);
const PACK_IMAGE_FILE = /\.(png|jpe?g|webp|gif|svg|ico|bmp)$/i;
const PACK_FONT_FILE = /\.(ttf|otf|woff2?|eot)$/i;
const PACK_AUDIO_FILE = /\.(ogg|mp3|wav|m4a|aac|flac)$/i;
const PACK_VIDEO_FILE = /\.(mp4|webm|mov|mkv)$/i;
// A wallpaper is a background image; everything else image-shaped is an icon (channel frames, tiles, covers).
const PACK_WALLPAPER_PATH = /(wallpaper|wall-paper|background|backdrop|pic1|wave|menu-bg|home-bg)/i;
// Menu music, by the names the themes and the packs actually use (the `music/menu.*` slots count too).
const PACK_MUSIC_PATH = /(^|[\\/])music([\\/]|$)|(bgm|bg-music|background-music|menu|all\.mp3)/i;
// Credit files are readmes and credits notes, not licences: a GPL text credits nobody and would supply noise.
const PACK_CREDIT_FILE = /^(readme|credits?|authors?)([._ -].*)?$/i;
const PACK_CREDIT_EXT = /\.(md|markdown|txt)$/i;

function packFolder(root, pack) {
  return path.join(root, ...String(pack.folder || '').split('/').filter(Boolean));
}
async function packIsDirectory(dir) {
  try { return (await fs.stat(dir)).isDirectory(); } catch { return false; }
}
function packIsCreditFile(name) {
  const base = String(name).toLowerCase();
  return PACK_CREDIT_FILE.test(base) && (PACK_CREDIT_EXT.test(base) || !base.includes('.'));
}
function packIsReadmeFile(name) {
  return /^(?:omnidash-)?readme([._ -].*)?$/i.test(String(name));
}
async function packReadText(file, limit = 12000) {
  try { return String(await fs.readFile(file, 'utf8')).slice(0, limit); } catch { return ''; }
}
// Scratch folders are cheap; walk them without counting anything but the extensions each category is made of.
async function packScanAssets(folder) {
  const counts = Object.fromEntries(PACK_COUNT_KEYS.map(key => [key, 0]));
  const walk = async (dir, depth) => {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < 8 && !PACK_SKIP_DIRS.has(entry.name.toLowerCase())) await walk(full, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const rel = path.relative(folder, full);
      if (PACK_FONT_FILE.test(entry.name)) counts.fonts += 1;
      else if (PACK_AUDIO_FILE.test(entry.name)) { if (PACK_MUSIC_PATH.test(rel)) counts.music += 1; else counts.sounds += 1; }
      else if (PACK_VIDEO_FILE.test(entry.name)) counts.video += 1;
      else if (PACK_IMAGE_FILE.test(entry.name)) { if (PACK_WALLPAPER_PATH.test(rel)) counts.wallpapers += 1; else counts.icons += 1; }
    }
  };
  await walk(folder, 0);
  return { counts, total: PACK_COUNT_KEYS.reduce((sum, key) => sum + counts[key], 0) };
}
// README/credits files this pack carries, shallowest first, READMEs before credits/authors. Used only for the credit
// line.
async function packCreditFiles(folder) {
  const found = [];
  const walk = async (dir, depth) => {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isFile() && packIsCreditFile(entry.name)) found.push(full);
      else if (entry.isDirectory() && depth < 2 && !PACK_SKIP_DIRS.has(entry.name.toLowerCase())) await walk(full, depth + 1);
    }
  };
  await walk(folder, 0);
  const depthOf = file => path.relative(folder, file).split(path.sep).length - 1;
  const rank = file => { const base = path.basename(file).toLowerCase(); return base.startsWith('readme') ? 0 : base.startsWith('credit') ? 1 : base.startsWith('author') ? 2 : 3; };
  return found.sort((a, b) => depthOf(a) - depthOf(b) || rank(a) - rank(b) || a.localeCompare(b));
}
// A README at the pack's own root is what the player reads before dropping files in; subproject readmes explain
// their own projects, so they credit the pack but do not stop OmniDash writing its short drop-in guide.
async function packRootReadme(folder) {
  let entries = [];
  try { entries = await fs.readdir(folder, { withFileTypes: true }); } catch { return ''; }
  const files = entries.filter(entry => entry.isFile() && (packIsReadmeFile(entry.name) || entry.name.toLowerCase() === PACK_README_NAME.toLowerCase()))
    .map(entry => path.join(folder, entry.name));
  return files.sort((a, b) => (path.basename(a).toLowerCase() === PACK_README_NAME.toLowerCase() ? 1 : 0) - (path.basename(b).toLowerCase() === PACK_README_NAME.toLowerCase() ? 1 : 0) || a.localeCompare(b))[0] || '';
}
function packCleanLine(line) {
  return String(line || '')
    .replace(/^\uFEFF/, '').replace(/\r/g, '')
    .replace(/^#{1,6}\s*/, '').replace(/^[-*+]\s+/, '').replace(/^>\s*/, '')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)')
    .replace(/[*_`]/g, '').replace(/\s{2,}/g, ' ').trim();
}
// Pulls one honest credit line out of a pack's own readme/credits file: an explicit "credit:" line, a repository
// link, a "created by" line, or the line under a Credits/Thanks heading. Empty when the file doesn't credit anyone,
// which is the caller's signal to fall back to the credit documented in docs/theme-packs.md.
function extractPackCredit(text) {
  const lines = String(text || '').split(/\r?\n/).map(packCleanLine).filter(Boolean).slice(0, 400);
  let hit = lines.find(line => /^(original\s+)?(app\s+)?credits?\s*[:\-–—]/i.test(line));
  if (hit) return hit.slice(0, 160);
  hit = lines.find(line => /github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i.test(line));
  if (hit) return hit.match(/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/i)[0].replace(/\.git$/i, '');
  hit = lines.find(line => /^(created|made|developed|written)\s+by\s+/i.test(line));
  if (hit) return hit.slice(0, 160);
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (/^(credits?|thanks( to)?|authors?|acknowledg)/i.test(lines[i]) && lines[i].length < 60) return lines[i + 1].slice(0, 160);
  }
  return '';
}
async function themePackReport(root, pack) {
  const folder = packFolder(root, pack);
  const folderExists = await packIsDirectory(folder);
  const scan = folderExists ? await packScanAssets(folder) : { counts: Object.fromEntries(PACK_COUNT_KEYS.map(key => [key, 0])), total: 0 };
  let credit = '', creditFile = '';
  if (folderExists) {
    for (const file of await packCreditFiles(folder)) {
      const line = extractPackCredit(await packReadText(file));
      if (line) { credit = line; creditFile = path.relative(folder, file).split(path.sep).join('/'); break; }
    }
  }
  const readme = folderExists ? await packRootReadme(folder) : '';
  return {
    id: pack.id, console: pack.console, name: pack.name, folder: pack.folder, path: folder,
    found: scan.total > 0, folderExists, counts: scan.counts, total: scan.total,
    credit: credit || pack.credit, creditSource: credit ? 'pack' : 'docs', creditFile,
    expected: pack.expected, install: pack.install,
    readme: { name: PACK_README_NAME, present: Boolean(readme), file: readme ? path.basename(readme) : '', canWrite: !readme }
  };
}
async function listThemePacks(root) {
  const packs = [];
  for (const pack of PACK_REGISTRY) packs.push(await themePackReport(root, pack));
  return packs;
}
// Where "Open folder" should point: the pack itself, or its parent when the pack folder has not been created yet.
async function packOpenTarget(root, pack) {
  const folder = packFolder(root, pack);
  if (await packIsDirectory(folder)) return { path: folder, folder: true };
  return { path: root, folder: false };
}
function buildPackReadme(pack, credit = '') {
  const lines = [
    `# OmniDash console pack: ${pack.name}`,
    '',
    `OmniDash never ships ${pack.name} art, fonts or sounds. Put your own files in this folder; the app reads`,
    'only the file names below and draws its own fallbacks for anything missing.',
    '',
    `Credit: ${credit || pack.credit}`,
    `Pack folder: ${pack.folder}/`,
    '',
    '## Files OmniDash looks for'
  ];
  for (const group of pack.expected || []) {
    lines.push(`- **${group.label}** in \`${group.folder}/\`: ${(group.names || []).map(name => `\`${name}\``).join(', ')}`);
  }
  lines.push('', '## Notes',
    '- Names are exact; folder paths are relative to this README.',
    '- Every file is optional. Missing files fall back to the theme\'s drawn art, fonts and sounds.',
    '- Where several music names are listed, the first one found wins; they are alternatives, not copies.',
    '', '---',
    'Written by OmniDash because this pack had no README of its own. OmniDash never overwrites a file you wrote.');
  return `${lines.join('\n')}\n`;
}
async function writePackReadme(root, pack) {
  const folder = packFolder(root, pack);
  await fs.mkdir(folder, { recursive: true });
  const existing = await packRootReadme(folder);
  if (existing) return { written: false, file: path.basename(existing), reason: 'exists' };
  const report = await themePackReport(root, pack);
  const target = path.join(folder, PACK_README_NAME);
  const text = buildPackReadme(pack, report.credit);
  try { await fs.writeFile(target, text, { encoding: 'utf8', flag: 'wx' }); }
  catch (error) {
    if (error.code === 'EEXIST') return { written: false, file: PACK_README_NAME, reason: 'exists' };
    throw error;
  }
  return { written: true, file: PACK_README_NAME, path: target };
}

module.exports = { installLogCapture, recentLog, createStartupGuard, redact, buildDiagnostics, buildBackup, parseBackup, BACKUP_FIELDS, KEY_FIELDS,
  PACK_REGISTRY, PACK_README_NAME, PACK_COUNT_KEYS, packFolder, themePackReport, listThemePacks, buildPackReadme, writePackReadme, packOpenTarget, extractPackCredit };
