const fs = require('fs/promises');
const path = require('path');

// Steam's text KeyValues format is case-insensitive. Never return the original
// document: localconfig also contains unrelated account/client information.
function parseVdf(text) {
  if (typeof text !== 'string' || text.length > 24 * 1024 * 1024) return {};
  const tokens = (text.match(/\/\/[^\r\n]*|"(?:\\.|[^"\\])*"|[{}]|[^\s{}"]+/g) || []).filter(token => !token.startsWith('//'));
  let position = 0;
  const unquote = value => value?.startsWith('"')
    ? value.slice(1, -1).replace(/\\([\\"])/g, '$1') : value;
  function object(depth = 0) {
    const result = Object.create(null);
    while (position < tokens.length && depth < 40) {
      const token = tokens[position++];
      if (token === '}') break;
      if (token === '{') continue;
      const key = String(unquote(token)).toLowerCase();
      const value = tokens[position++];
      if (value === undefined) break;
      result[key] = value === '{' ? object(depth + 1) : unquote(value);
    }
    return result;
  }
  return object();
}

function steamAccountId(steamId) {
  try {
    if (!/^7656119\d{10}$/.test(String(steamId))) return '';
    const id = BigInt(steamId) - 76561197960265728n;
    return id >= 0 && id <= 4294967295n ? String(id) : '';
  } catch { return ''; }
}

function extractLocalLibrary(localText = '', sharedText = '') {
  const local = parseVdf(localText).userlocalconfigstore || {};
  const shared = parseVdf(sharedText).userroamingconfigstore || {};
  const localSteam = local.software?.valve?.steam || {};
  const sharedSteam = shared.software?.valve?.steam || {};
  const hidden = new Set();
  const stats = {};
  for (const apps of [localSteam.apps, sharedSteam.apps]) {
    for (const [appId, value] of Object.entries(apps || {})) {
      if (!/^\d+$/.test(appId) || !value || typeof value !== 'object') continue;
      if (String(value.hidden) === '1') hidden.add(appId);
      const previous = stats[appId] || {};
      stats[appId] = {
        minutes: Math.max(previous.minutes || 0, Number(value.playtime) || 0),
        lastPlayed: Math.max(previous.lastPlayed || 0, (Number(value.lastplayed) || 0) * 1000)
      };
    }
  }
  // New Steam clients store the special hidden collection as JSON inside VDF.
  // Only the reserved ID is used; a user collection named "Hidden" is not one.
  function collections(value, key = '', depth = 0) {
    if (!value || depth > 12) return;
    if (typeof value === 'string') {
      if (key === 'user-collections') try { collections(JSON.parse(value), '', depth + 1); } catch { /* Partial Steam write. */ }
      return;
    }
    if (key === 'hidden' || value.id === 'hidden') {
      const ids = value.added || value.apps || value.appids || [];
      for (const id of Array.isArray(ids) ? ids : []) if (/^\d+$/.test(String(id))) hidden.add(String(id));
      for (const id of value.removed || []) hidden.delete(String(id));
    }
    for (const [name, child] of Object.entries(value)) collections(child, name.toLowerCase(), depth + 1);
  }
  collections(local);
  collections(shared);
  return { hiddenIds: [...hidden], stats };
}

// Current Steam clients keep collections in config/cloudstorage as a JSON list of
// [key, { value, is_deleted }] entries. "user-collections.hidden" is the Hidden
// collection; its value is itself JSON with added/removed app IDs.
function cloudHiddenIds(...documents) {
  let hidden = null;
  for (const text of documents) {
    let entries;
    try { entries = JSON.parse(text || '[]'); } catch { continue; }
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      const [key, record] = Array.isArray(entry) ? entry : [entry?.key, entry];
      if (key !== 'user-collections.hidden' || !record) continue;
      if (record.is_deleted) { hidden = new Set(); continue; }
      let value;
      try { value = typeof record.value === 'string' ? JSON.parse(record.value) : record.value; } catch { continue; }
      // A later document (the pending .modified file) replaces the synced state.
      hidden = new Set();
      for (const id of Array.isArray(value?.added) ? value.added : []) if (/^\d+$/.test(String(id))) hidden.add(String(id));
      for (const id of Array.isArray(value?.removed) ? value.removed : []) hidden.delete(String(id));
    }
  }
  return hidden ? [...hidden] : [];
}

async function readSteamLocalLibrary(roots, steamId) {
  const accountId = steamAccountId(steamId);
  if (!accountId) return { hiddenIds: [], stats: {}, available: false };
  for (const root of roots) {
    const userRoot = path.join(root, 'userdata', accountId);
    const read = async file => {
      try {
        const target = path.join(userRoot, file);
        if ((await fs.stat(target)).size > 24 * 1024 * 1024) return '';
        return await fs.readFile(target, 'utf8');
      } catch { return ''; }
    };
    const [local, shared, cloud, cloudPending] = await Promise.all([read('config/localconfig.vdf'), read('7/remote/sharedconfig.vdf'),
      read('config/cloudstorage/cloud-storage-namespace-1.json'), read('config/cloudstorage/cloud-storage-namespace-1.modified.json')]);
    if (local || shared || cloud) {
      const library = extractLocalLibrary(local, shared);
      const hiddenIds = [...new Set([...library.hiddenIds, ...cloudHiddenIds(cloud, cloudPending)])];
      return { ...library, hiddenIds, available: true };
    }
  }
  return { hiddenIds: [], stats: {}, available: false };
}

function applySteamLocalData(games, local) {
  const hidden = new Set(local.hiddenIds);
  return games.filter(game => game.provider !== 'Steam' || !hidden.has(String(game.appId))).map(game => {
    const stats = game.provider === 'Steam' ? local.stats[game.appId] : null;
    return stats ? { ...game, steamPlaytimeMinutes: Math.max(Number(game.steamPlaytimeMinutes) || 0, stats.minutes), steamLastPlayed: stats.lastPlayed } : game;
  });
}

function manifestProgress(text) {
  const data = parseVdf(text).appstate || {};
  const flags = Number(data.stateflags) || 0;
  const downloaded = Math.max(0, Number(data.bytesdownloaded) || 0);
  const total = Math.max(0, Number(data.bytestodownload) || 0);
  // Fully installed alone is ready. Download/update/staging bits must be clear.
  const busy = Boolean(flags & (2 | 16 | 32 | 128 | 256 | 512 | 1024 | 131072));
  const installed = Boolean(flags & 4) && !busy;
  const staging = Boolean(flags & (16 | 128 | 131072)) || (total > 0 && downloaded >= total && !installed);
  // 512 = update paused, 256 = update running. Anything else still pending is waiting in Steam's queue.
  return { installed, state: installed ? 'ready' : flags & 512 ? 'paused' : staging ? 'installing' : flags & 256 || downloaded > 0 ? 'downloading' : 'queued',
    downloaded, total, percent: total > 0 ? Math.min(100, Math.floor(downloaded / total * 100)) : null };
}

// Steam only writes byte counts to the manifest now and then, and preallocates files, so neither shows
// live progress. Its content log does: each download logs its size when it starts or resumes, every state
// change, and the current rate. Progress is the starting bytes plus the logged rate over time spent downloading.
function contentLogProgress(text, appId, now = Date.now()) {
  const id = String(appId);
  if (!/^\d{1,10}$/.test(id)) return null;
  const lines = String(text || '').split(/\r?\n/);
  const when = line => { const match = line.match(/^\[(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)\]/); return match ? new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5], +match[6]).getTime() : NaN; };
  let start = -1;
  const startPattern = new RegExp(`^\\[[^\\]]+\\] AppID ${id} update started : download (\\d+)/(\\d+)`);
  for (let index = lines.length - 1; index >= 0; index--) if (startPattern.test(lines[index])) { start = index; break; }
  if (start < 0) return null;
  const [, done, total] = lines[start].match(startPattern);
  let downloaded = Number(done), active = false, rate = 0, at = when(lines[start]), state = 'queued', finished = false;
  // The rate in effect when this download started.
  for (let index = start - 1; index >= 0 && index > start - 400; index--) {
    const sample = lines[index].match(/Current download rate: ([\d.]+) Mbps|rate was [\d.]+, now ([\d.]+)\)/);
    if (sample) { rate = Number(sample[1] ?? sample[2]) * 1e6; break; }
  }
  // Rates are logged roughly once a minute. Never extrapolate a stale sample
  // across a closed client or a long offline period.
  const advance = until => { if (active && Number.isFinite(until) && until > at) downloaded += rate / 8 * Math.min(until - at, 90000) / 1000; if (Number.isFinite(until)) at = Math.max(at, until); };
  const appPrefix = `AppID ${id} `;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index], time = when(line);
    if (/AppID \d+ App update changed : .*Downloading/.test(line) && !line.includes(appPrefix)) {
      advance(time); active = false; state = 'queued';
    }
    const sample = line.match(/Current download rate: ([\d.]+) Mbps|rate was [\d.]+, now ([\d.]+)\)/);
    if (sample) { advance(time); rate = Number(sample[1] ?? sample[2]) * 1e6; continue; }
    if (!line.includes(appPrefix)) continue;
    advance(time);
    if (/App update changed : .*Downloading/.test(line) && !/Stopping/.test(line)) { active = true; state = 'downloading'; }
    else if (/App update changed : .*(Stopping|None)/.test(line) || /update canceled/.test(line)) { active = false; state = /Suspended|Paused/i.test(line) || state === 'paused' ? 'paused' : 'queued'; }
    else if (/App update changed : .*(Committing|Verifying|Staging)/.test(line) && !/Downloading/.test(line)) { active = false; state = 'installing'; downloaded = Number(total); }
    if (/update canceled : .*Suspended/.test(line) || /state changed : .*Paused/.test(line)) state = 'paused';
    if (/finished update|fully installed|state changed : Fully Installed,?\s*$/.test(line)) { finished = true; active = false; }
    if (/finished uninstall|state changed : Uninstalled/.test(line)) return null;
  }
  const stale = now - at > 90000;
  advance(now);
  if (stale && active) { active = false; state = 'queued'; }
  const size = Number(total);
  const bytes = Math.min(size, Math.round(downloaded));
  return { state: finished ? 'ready' : state, downloaded: bytes, total: size, rate: active ? rate : 0, percent: size ? Math.min(100, Math.floor(bytes / size * 100)) : null, estimated: true };
}

function clientDownloadProgress(client, appId, result) {
  const id = String(appId);
  const item = Array.isArray(client?.items) ? client.items.find(entry => String(entry.appid) === id) : null;
  const overview = String(client?.overview?.update_appid) === id ? client.overview : null;
  if (!item && !overview) return null;
  const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
  const doneValue = overview?.update_bytes_downloaded ?? item?.downloaded_bytes;
  const totalValue = overview?.update_bytes_to_download ?? item?.total_bytes;
  // Incomplete callbacks are not evidence of zero progress. Let the log or
  // manifest supply the fallback until Steam sends usable byte counts.
  if (!finite(doneValue) || !finite(totalValue) || Number(totalValue) <= 0) return null;
  const total = Number(totalValue), downloaded = Math.min(total, Number(doneValue));
  const state = item?.paused || client?.overview?.paused ? 'paused'
    : item?.completed || downloaded >= total ? 'installing' : overview || item?.active ? 'downloading' : 'queued';
  return { ...result, state, downloaded, total,
    rate: state === 'downloading' && finite(overview?.update_network_bytes_per_second) ? Number(overview.update_network_bytes_per_second) * 8 : 0,
    secondsLeft: finite(overview?.update_seconds_remaining) ? Number(overview.update_seconds_remaining) : null,
    percent: Math.floor(downloaded / total * 100), live: true, estimated: false };
}

module.exports = { parseVdf, steamAccountId, extractLocalLibrary, cloudHiddenIds, readSteamLocalLibrary, manifestProgress, applySteamLocalData, contentLogProgress, clientDownloadProgress };
