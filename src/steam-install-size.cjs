// Steam's compressed depot download and unpacked install size are different.
// Public manifest totals are estimates: Steam resolves owned DLC, language packs
// and shared depots when it queues the actual download.
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
function requirementBytes(requirements) {
  const text = `${requirements?.recommended || ''} ${requirements?.minimum || ''}`.replace(/<[^>]*>/g, ' ');
  const match = text.match(/(?:Storage|Hard Drive|Disk Space)[^0-9]{0,40}(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)/i)
    || text.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)\s*(?:of\s*)?(?:available|free|hard|disk|storage|space)/i);
  return match ? positive(Number(match[1].replace(',', '.')) * { TB: 1e12, GB: 1e9, MB: 1e6 }[match[2].toUpperCase()]) : null;
}
function depotSizes(info, language = 'english', shared = {}) {
  let installed = 0, download = 0, count = 0, missing = 0, downloadKnown = true;
  const seen = new Set();
  for (const [id, depot] of Object.entries(info?.depots || {})) {
    if (!/^\d+$/.test(id) || !depot || typeof depot !== 'object') continue;
    const config = depot.config || {};
    if (config.oslist && !String(config.oslist).split(',').map(s => s.trim()).includes('windows')) continue;
    if (config.language && String(config.language).toLowerCase() !== language) continue;
    if (depot.dlcappid || config.dlcappid || String(depot.optional) === '1') continue;
    let source = depot; const visited = new Set();
    while (source?.depotfromapp && !visited.has(String(source.depotfromapp))) {
      visited.add(String(source.depotfromapp)); source = shared[source.depotfromapp]?.depots?.[id];
    }
    const manifest = source?.manifests?.public;
    // A depot that only exists on another branch is not part of this install.
    if (source?.manifests && !manifest && !source.encryptedmanifests?.public) continue;
    if (!manifest || typeof manifest !== 'object' || !positive(manifest.size)) { missing++; continue; }
    const key = `${id}:${manifest.gid || ''}`;
    if (seen.has(key)) continue;
    seen.add(key); count++; installed += Number(manifest.size);
    if (positive(manifest.download)) download += Number(manifest.download); else downloadKnown = false;
  }
  return { installBytes: !missing && installed || null, downloadBytes: count && !missing && downloadKnown ? download : null, depotCount: count, missingDepots: missing };
}
function createInstallSizeLookup({ fetch: fetcher = global.fetch, now = Date.now } = {}) {
  const cache = new Map(), pending = new Map();
  const infoCache = new Map();
  async function appInfo(id) {
    const key=String(id), entry=infoCache.get(key);
    if (!entry || now()-entry.at >= 30*60*1000) {
      if(infoCache.size>200)infoCache.delete(infoCache.keys().next().value);
      infoCache.set(key,{at:now(),promise:fetcher(`https://api.steamcmd.net/v1/info/${id}`, { signal: AbortSignal.timeout(8000) }).then(r => r.ok ? r.json() : null).then(json => json?.data?.[id] || null).catch(() => null)});
    }
    return infoCache.get(key).promise;
  }
  return async function lookup(appId) {
    if (!/^\d+$/.test(String(appId))) throw new Error('Invalid Steam app.');
    if (cache.has(String(appId)) && now() - cache.get(String(appId)).at < 30 * 60 * 1000) return cache.get(String(appId)).value;
    if (pending.has(String(appId))) return pending.get(String(appId));
    const work = (async () => {
      const [depots, requirements] = await Promise.allSettled([
        appInfo(appId),
        fetcher(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.json() : null)
      ]);
      const info = depots.status === 'fulfilled' ? depots.value : null, shared = {};
      const sharedIds = [...new Set(Object.values(info?.depots || {}).map(depot => depot?.depotfromapp).filter(id => /^\d+$/.test(String(id))))].slice(0,8);
      await Promise.all(sharedIds.map(async id => { shared[id] = await appInfo(id); }));
      const totals = depotSizes(info, 'english', shared);
      const listed = requirementBytes(requirements.status === 'fulfilled' ? requirements.value?.[appId]?.data?.pc_requirements : null);
      const value = { ...totals, requiredBytes: Math.max(totals.installBytes || 0, listed || 0) || null, estimated: true, source: totals.depotCount ? 'public-depots' : listed ? 'store-requirements' : 'unavailable' };
      cache.set(String(appId), { at: now(), value });
      return value;
    })().finally(() => pending.delete(String(appId)));
    pending.set(String(appId), work);
    return work;
  };
}
module.exports = { requirementBytes, depotSizes, createInstallSizeLookup };
