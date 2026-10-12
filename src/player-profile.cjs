const fs = require('node:fs/promises');
const path = require('node:path');
const { parseVdf, steamAccountId } = require('./steam-local.cjs');
const pcGamerscore = require('./pc-gamerscore.cjs');
const DAY = 86400000;

// Preview points, not Xbox Gamerscore. Rarity is sampled when an unlock is first
// seen, so an earned score doesn't drift as other people earn achievements.
function rarityPoints(percent) {
  if (percent === null || percent === undefined || percent === '' || !Number.isFinite(Number(percent))) return 10;
  const rarity = Math.max(0, Math.min(100, Number(percent))) / 100;
  return Math.round((10 + 90 * (1 - Math.sqrt(rarity))) / 5) * 5;
}
function scoreUnlocks(achievements, percentages, previous = {}) {
  const entries = Object.create(null);
  for (const item of (Array.isArray(achievements) ? achievements : []).slice(0, 20000)) {
    if (Number(item.achieved) !== 1 || typeof item.apiname !== 'string' || item.apiname.length > 200) continue;
    const rawPercent = percentages.get(item.apiname);
    const percent = rawPercent !== null && rawPercent !== '' && Number.isFinite(Number(rawPercent)) ? Math.max(0, Math.min(100, Number(rawPercent))) : undefined;
    const old = Object.hasOwn(previous, item.apiname) ? previous[item.apiname] : null;
    entries[item.apiname] = old?.rarityKnown ? old : { points: rarityPoints(percent), rarityKnown: percent !== undefined, percent: percent ?? null };
  }
  return entries;
}
function summarizeScore(records, appIds) {
  let points = 0, unlocked = 0, checked = 0, baseOnly = 0, lastSync = 0, completed = 0, possible = 0, legacyGames = 0;
  const ids = new Set([...appIds,...Object.keys(records)]), games = [];
  for (const id of ids) {
    const record = records[id];
    if (!record?.verified) continue;
    if (record.algorithm !== pcGamerscore.ALGORITHM) { legacyGames++;continue; }
    checked++;
    lastSync = Math.max(lastSync, record.at || 0);
    let gamePoints=0,gameUnlocks=0;
    for (const entry of Object.values(record.entries || {})) {
      gamePoints += Math.max(0, Math.min(1000, Number(entry.points) || 0)); gameUnlocks++;
      if (!entry.rarityKnown) baseOnly++;
    }
    gamePoints=Math.min(1000,gamePoints);points+=gamePoints;unlocked+=gameUnlocks;
    const count=Object.keys(record.pointTable||{}).length,budget=count?1000:0,isComplete=count>0&&gameUnlocks===count;
    possible+=budget;if(isComplete)completed++;
    games.push({appId:id,title:record.title||`Steam game ${id}`,points:gamePoints,possible:budget,unlocked:gameUnlocks,total:count,completed:isComplete,at:record.at||0});
  }
  games.sort((a,b)=>b.at-a.at||b.points-a.points);
  return { points, unlocked, checked, total: ids.size, baseOnly, lastSync,completed,possible,legacyGames,level:pcGamerscore.level(points),games,algorithm:pcGamerscore.ALGORITHM };
}
function safeAvatar(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^(?:avatars\.)?(?:[a-z0-9-]+\.)*(?:steamstatic\.com|akamaihd\.net)$/.test(url.hostname) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
function xmlValue(text, name) {
  const raw = text.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1] || '';
  return raw.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').replace(/&(?:amp|lt|gt|quot|apos);/g, token => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"})[token]);
}
function parsePublicIdentity(text, steamId) {
  if (text.length > 1024 * 1024 || xmlValue(text, 'steamID64') !== steamId) return null;
  return { name: xmlValue(text, 'steamID').trim().slice(0, 32), avatar: safeAvatar(xmlValue(text, 'avatarFull')) };
}
function profileMode(settings) {
  return ['steam','custom'].includes(settings.profileNameMode) ? settings.profileNameMode
    : settings.displayName && settings.displayName !== 'Player' ? 'custom' : 'steam';
}
function defaultAvatarId(settings) {
  return settings.profileAvatarCustomized || settings.avatarImage || !['one-orbit','steam-profile',undefined].includes(settings.avatarId)
    ? settings.avatarId : 'steam-profile';
}
async function limitedText(response, limit = 4 * 1024 * 1024) {
  if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'sign-in-required' : 'service-unavailable');
  if (Number(response.headers.get('content-length')) > limit) throw Error('response-too-large');
  const chunks = []; let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > limit) throw Error('response-too-large');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function createPlayerProfile(directory, options = {}) {
  const request = options.fetch || fetch;
  let data, writes = Promise.resolve(), syncing = false, generation = 0;
  async function load() {
    if (data) return data;
    try {
      const file = path.join(directory, 'player-profile.json');
      if ((await fs.stat(file)).size > 24 * 1024 * 1024) throw Error('large');
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
      if (parsed.version !== 1) throw Error('version');
      data = parsed;
    } catch { data = { version: 1, identities: {}, scores: {}, rarity: {} }; }
    return data;
  }
  function save() {
    writes = writes.catch(() => {}).then(async () => {
      await fs.mkdir(directory, { recursive: true });
      const file = path.join(directory, 'player-profile.json');
      await fs.writeFile(file + '.tmp', JSON.stringify(data));
      await fs.rename(file + '.tmp', file);
    });
    return writes;
  }
  async function json(url, init) { return JSON.parse(await limitedText(await request(url, { ...init, signal: AbortSignal.timeout(12000) }))); }
  async function identity(steamId, roots, apiKey = '') {
    const epoch = generation;
    if (!steamAccountId(steamId)) return { available: false, name: '', avatar: '' };
    const db = await load(), cached = db.identities[steamId];
    if (cached && Date.now() - cached.at < DAY) return { ...cached, available: true };
    let localName = '';
    for (const root of roots) try {
      const users = parseVdf(await fs.readFile(path.join(root, 'config/loginusers.vdf'), 'utf8')).users;
      localName = String(users?.[steamId]?.personaname || '').slice(0, 32);
      if (localName) break;
    } catch { /* Only public persona fields are selected; never return login data. */ }
    let found;
    if (apiKey) try {
      const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
      url.search = new URLSearchParams({ key: apiKey, steamids: steamId }).toString();
      const player = (await json(url)).response?.players?.find(player => player.steamid === steamId);
      if (player) found = { name: String(player.personaname || '').slice(0, 32), avatar: safeAvatar(player.avatarfull) };
    } catch { /* Public Community and local persona still work without a key. */ }
    if (!found) try {
      // Valve documents this no-key fallback as deprecated; treat it as optional.
      found = parsePublicIdentity(await limitedText(await request(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, { signal: AbortSignal.timeout(8000) }), 1024 * 1024), steamId);
    } catch { /* Offline: keep the cached avatar/name. */ }
    const result = { name: found?.name || localName || cached?.name || '', avatar: found?.avatar || cached?.avatar || '', at: found ? Date.now() : Date.now() - DAY + 300000 };
    if (epoch !== generation) return { available: false, name: '', avatar: '' };
    if (result.name || result.avatar) {
      db.identities[steamId] = result;
      // Bound account cache without mixing identities when Steam accounts change.
      for (const id of Object.keys(db.identities).slice(0, -8)) delete db.identities[id];
      await save();
    }
    return { ...result, available: Boolean(result.name || result.avatar) };
  }
  async function score(steamId, appIds) {
    const db = await load();
    return summarizeScore(db.scores[steamId] || {}, appIds);
  }
  async function sync(steamId, apiKey, appIds, shouldContinue = () => true) {
    if (!steamAccountId(steamId) || !apiKey) return { ...await score(steamId, appIds), status: 'needs-steam-key', remaining: 0 };
    if (syncing) return { ...await score(steamId, appIds), status: 'busy', remaining: 0 };
    syncing = true;
    const epoch = generation;
    try {
      const db = await load();
      const records = db.scores[steamId] ||= {};
      const ids = [...new Set(appIds)].filter(id => /^\d{1,10}$/.test(id));
      const pending = ids.filter(id => (records[id]?.verified && records[id].algorithm!==pcGamerscore.ALGORITHM) || Date.now() - (records[id]?.attemptedAt || 0) > DAY);
      let failures = 0, attempts = 0, paused = false;
      for (const appId of pending.slice(0, 10)) {
        if (epoch !== generation || !shouldContinue()) { paused = true; break; }
        attempts++;
        try {
          const url = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/');
          url.search = new URLSearchParams({ key: apiKey, steamid: steamId, appid: appId, l: 'english' }).toString();
          const player = (await json(url)).playerstats;
          if (!player?.success || !Array.isArray(player.achievements)) throw Error('progress-unavailable');
          let rarity = db.rarity[appId];
          if (!rarity || Date.now() - rarity.at > 7 * DAY) {
            try {
              const body = await json(`https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`);
              rarity = { at: Date.now(), entries: (body.achievementpercentages?.achievements || []).slice(0,20000).map(item => [String(item.name), Number(item.percent)]) };
              db.rarity[appId] = rarity;
            } catch { /* Confirmed unlocks still receive 10 base points. */ }
          }
          if (epoch !== generation) break;
          const calculated=pcGamerscore.calculate(player.achievements,new Map(rarity?.entries||[]),records[appId]?.pointTable);
          records[appId] = { ...calculated, title:String(player.gameName||records[appId]?.title||`Steam game ${appId}`).slice(0,240),verified: true, at: Date.now(), attemptedAt: Date.now() };
          failures = 0;
        } catch {
          // Private/missing stats are unavailable, never zero verified unlocks.
          records[appId] = { ...records[appId], attemptedAt: Date.now() }; failures++;
        }
        await save();
        if (failures >= 3) break;
        await new Promise(resolve => setTimeout(resolve, options.delay ?? 1000));
      }
      return { ...summarizeScore(records, ids), status: paused ? 'paused' : failures >= 3 ? 'unavailable' : 'ready', remaining: Math.max(0, pending.length - attempts) };
    } finally { syncing = false; }
  }
  async function reset() {
    generation++;
    await writes.catch(() => {});
    data = { version: 1, identities: {}, scores: {}, rarity: {} };
    await save();
  }
  return { identity, score, sync, reset };
}
module.exports = { rarityPoints, scoreUnlocks, summarizeScore, safeAvatar, parsePublicIdentity, profileMode, defaultAvatarId, limitedText, createPlayerProfile };
