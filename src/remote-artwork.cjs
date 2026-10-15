const fs = require('node:fs/promises');
const path = require('node:path');
const {fileURLToPath} = require('node:url');
const {normalizeTitle} = require('./title-match.cjs');

const baseTitle = title => String(title || '').replace(/[\u200b-\u200d\ufeff™®]/g, '').replace(/\s*[-–:]\s*(multiplayer|zombies|campaign|single ?player|mp|sp|beta|dedicated server|server|demo)\s*$/i, '').trim();
const artworkKey = game => /^\d+$/.test(game.steamAppId || '') ? `steam:${game.steamAppId}` : `title:${normalizeTitle(baseTitle(game.title))}`;
const hasCover = art => Boolean(art?.tile || art?.grid);

// Share the launcher's matching rules, manual selections and image files. The
// host's numeric app ID is never treated as a Steam ID or used for title matches.
function createRemoteArtwork({directory, getContext, findArtwork, cacheArtwork, now = Date.now}) {
  const inflight = new Map();
  let records, loading, writing = Promise.resolve(), context, contextUntil = 0, contextLoading;
  async function load() {
    if (!loading) loading = fs.readFile(path.join(directory, 'artwork.json'), 'utf8').then(JSON.parse).catch(() => ({})).then(value => { records = value && !Array.isArray(value) && typeof value === 'object' ? value : {}; });
    await loading;
  }
  async function save() {
    const text = JSON.stringify(records);
    writing = writing.catch(() => {}).then(async () => {
      await fs.mkdir(directory, {recursive:true});
      const file = path.join(directory, 'artwork.json');
      await fs.writeFile(file + '.tmp', text); await fs.rename(file + '.tmp', file);
    });
    await writing;
  }
  async function currentContext() {
    if (context && now() < contextUntil) return context;
    if (!contextLoading) contextLoading = Promise.resolve().then(getContext).then(value => { context = value; contextUntil = now() + 5000; return value; }).finally(() => { contextLoading = null; });
    return contextLoading;
  }
  async function usable(art, network) {
    if (!hasCover(art)) return null;
    const value = {...art};
    // Avoid leaving broken cached-file URLs in cards. cacheArtwork repairs a
    // missing file from its source URL when network lookups are allowed.
    for (const slot of ['tile','grid','hero','wide','logo']) {
      if (!String(value[slot] || '').startsWith('file:')) continue;
      try { await fs.access(fileURLToPath(value[slot])); }
      catch { value[slot] = value.sourceUrls?.[slot] || null; }
    }
    if (!hasCover(value)) return null;
    const result = network ? await cacheArtwork(value) : value;
    return {...result, remoteArtworkVersion:1};
  }
  async function resolve(game, {network = true} = {}) {
    const key = artworkKey(game);
    if (inflight.has(key)) return inflight.get(key);
    const task = (async () => {
      await load(); const {settings = {}, games = []} = await currentContext();
      const saved = settings.artwork || {}, title = normalizeTitle(baseTitle(game.title));
      const exactSteam = game.steamAppId && saved[`steam-${game.steamAppId}`];
      const exact = item => Boolean(game.steamAppId && item.provider === 'Steam' && String(item.appId) === String(game.steamAppId));
      const matches = games.filter(item => item && !item.isApp && !item.isLauncher &&
        (game.steamAppId && item.provider === 'Steam' && String(item.appId) === String(game.steamAppId) || normalizeTitle(baseTitle(item.title)) === title));
      matches.sort((a,b) => Number(exact(b)) - Number(exact(a)) || Number(Boolean(saved[b.id]?.manual)) - Number(Boolean(saved[a.id]?.manual)));
      for (const art of [exactSteam, ...matches.map(item => saved[item.id] || item.artwork)]) {
        const reused = await usable(art, network); if (reused) return reused;
      }
      const cached = records[key], art = await usable(cached?.artwork, network);
      if (art && now() - cached.at < 7 * 86400000) return art;
      if (!network || cached && now() - cached.at < 3600000) return art;
      const found = await findArtwork(baseTitle(game.title), settings.steamGridDbKey || '', game.steamAppId ? 'Steam' : 'PC', true, game.steamAppId || '').catch(() => null);
      const fresh = await usable(found, true);
      records[key] = {at:now(), artwork:fresh || art || null}; await save().catch(() => {});
      return fresh || art;
    })().finally(() => { inflight.delete(key); });
    inflight.set(key, task); return task;
  }
  return {resolve};
}
module.exports = {createRemoteArtwork, artworkKey, baseTitle};
