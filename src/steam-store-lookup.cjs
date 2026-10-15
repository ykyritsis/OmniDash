const TYPES = ['game', 'demo', 'mod', 'movie', 'dlc', 'guide', 'software', 'video', 'series', 'episode', 'hardware', 'music', 'beta', 'tool', 'advertising'];
const currencyFor = country => ({ AU: 'AUD', NZ: 'NZD', CA: 'CAD', GB: 'GBP', JP: 'JPY' })[country] || 'USD';
function steamStoreArt(appId) {
  const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/`;
  return { tile: base + 'library_600x900.jpg', grid: base + 'library_600x900.jpg', tileIsSquare: false,
    hero: base + 'library_hero.jpg', wide: base + 'header.jpg', imageSource: 'steam-store' };
}
function mapStoreItem(item, country) {
  const assets = item.assets || {}, fallback = steamStoreArt(item.appid);
  const asset = name => assets[name] && assets.asset_url_format
    ? `https://shared.akamai.steamstatic.com/store_item_assets/${String(assets.asset_url_format).replace('${FILENAME}', assets[name])}` : null;
  const tile = asset('library_capsule_2x') || asset('library_capsule');
  const option = item.best_purchase_option, cents = Number(option?.final_price_in_cents);
  const formatted = String(option?.formatted_final_price || '');
  const currency = /NZ\$/.test(formatted) ? 'NZD' : /A\$/.test(formatted) ? 'AUD' : /CDN\$|C\$/.test(formatted) ? 'CAD'
    : /€/.test(formatted) ? 'EUR' : /£/.test(formatted) ? 'GBP' : /¥/.test(formatted) ? 'JPY' : currencyFor(country);
  return { appId: String(item.appid), title: String(item.name || ''), type: TYPES[Number(item.type)] || 'unknown',
    artwork: { ...fallback, tile: tile || asset('header') || fallback.tile, grid: tile || asset('header') || fallback.grid,
      hero: asset('library_hero') || fallback.hero, wide: asset('header') || fallback.wide },
    price: option && Number.isFinite(cents) ? { list: cents / 100, msrp: (Number(option.original_price_in_cents) || cents) / 100,
      discount: Number(option.discount_pct) || 0, currency, formatted } : item.is_free ? { list: 0, msrp: 0, discount: 0, currency } : null };
}
function createSteamStoreLookup({ request = fetch, getCountry = () => 'US', now = Date.now } = {}) {
  const items = new Map(), queries = new Map(), itemPending = new Map(), queryPending = new Map();
  const prune = cache => { while (cache.size > 500) cache.delete(cache.keys().next().value); };
  async function getItems(values, country = getCountry()) {
    const ids = [...new Set(values.map(String).filter(id => /^\d{1,10}$/.test(id)))].slice(0, 200);
    const missing = ids.filter(id => { const key = `${country}:${id}`, saved = items.get(key); return !itemPending.has(key) && (!saved || now() - saved.at >= 15 * 60 * 1000); });
    for (let start = 0; start < missing.length; start += 50) {
      const batch = missing.slice(start, start + 50);
      const task = (async () => {
        const url = new URL('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/');
        url.searchParams.set('input_json', JSON.stringify({ ids: batch.map(appid => ({ appid: Number(appid) })),
          context: { language: 'english', country_code: country }, data_request: { include_basic_info: true, include_assets: true } }));
        const response = await request(url, { signal: AbortSignal.timeout(9000) });
        if (!response.ok) throw Error(`Steam lookup returned ${response.status}`);
        const data = (await response.json())?.response?.store_items || [];
        const byId = new Map(data.filter(item => item.success === 1 && item.appid).map(item => [String(item.appid), mapStoreItem(item, country)]));
        for (const id of batch) items.set(`${country}:${id}`, { at: now(), data: byId.get(id) || null });
        prune(items);
      })().finally(() => { for (const id of batch) itemPending.delete(`${country}:${id}`); });
      for (const id of batch) itemPending.set(`${country}:${id}`, task);
    }
    await Promise.all([...new Set(ids.map(id => itemPending.get(`${country}:${id}`)).filter(Boolean))]);
    return ids.map(id => items.get(`${country}:${id}`)?.data).filter(Boolean);
  }
  async function search(query) {
    const text = String(query || '').trim().replace(/\s+/g, ' ').slice(0, 120), country = getCountry();
    if (text.length < 2) return [];
    const key = `${country}:${text.toLowerCase()}`, cached = queries.get(key);
    if (cached && now() - cached.at < 5 * 60 * 1000) return cached.data;
    if (queryPending.has(key)) return queryPending.get(key);
    const task = (async () => {
      const url = new URL('https://store.steampowered.com/api/storesearch/');
      url.searchParams.set('term', text); url.searchParams.set('l', 'english'); url.searchParams.set('cc', country);
      const response = await request(url, { signal: AbortSignal.timeout(9000) });
      if (!response.ok) throw Error(`Steam search returned ${response.status}`);
      const found = (await response.json())?.items || [], seen = new Set();
      const results = found.filter(item => item.type === 'app' && /^\d{1,10}$/.test(String(item.id)) && item.platforms?.windows !== false)
        .filter(item => { const id = String(item.id); if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 20);
      const extra = new Map((await getItems(results.map(item => item.id), country).catch(() => [])).map(item => [item.appId, item]));
      const data = results.filter(item => !extra.has(String(item.id)) || extra.get(String(item.id)).type === 'game').map(item => {
        const appId = String(item.id), enriched = extra.get(appId);
        const price = item.price ? { list: (Number(item.price.final) || 0) / 100, msrp: (Number(item.price.initial) || 0) / 100,
          discount: item.price.initial > item.price.final ? Math.round((1 - item.price.final / item.price.initial) * 100) : 0, currency: item.price.currency || currencyFor(country) } : null;
        return { appId, title: String(item.name || ''), artwork: enriched?.artwork || steamStoreArt(appId), price: enriched?.price ?? price,
          controls: item.controller_support === 'full' ? 'controller' : 'unknown' };
      });
      queries.set(key, { at: now(), data }); prune(queries); return data;
    })().finally(() => queryPending.delete(key));
    queryPending.set(key, task); return task;
  }
  return { getItems, search };
}
module.exports = { createSteamStoreLookup, mapStoreItem };
