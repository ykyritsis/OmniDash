const fs = require('fs/promises');
const path = require('path');
const { createHash } = require('crypto');
const { pathToFileURL } = require('url');

const IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'],
  ['image/avif', '.avif'], ['image/gif', '.gif'], ['image/svg+xml', '.svg']
]);
const ALLOWED_HOSTS = new Set([
  'cdn2.steamgriddb.com', 'cdn.steamgriddb.com', 'cdn.akamai.steamstatic.com',
  'shared.fastly.steamstatic.com', 'store-images.s-microsoft.com',
  'images-eds.xboxlive.com', 'image.api.playstation.com', 'assets-prd.ignimgs.com'
]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CACHE_BYTES = 600 * 1024 * 1024;
const ARTWORK_FIELDS = ['tile', 'grid', 'wide', 'hero', 'logo'];

function createArtworkCache(directory, { fetchImage = fetch, allowedHosts = ALLOWED_HOSTS, now = Date.now } = {}) {
  const inflight = new Map(), files = new Map(), retryAfter = new Map(), waiting = [];
  let knownBytes, indexLoading, sizeLoading, downloads = 0;

  function allowed(url) {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' && allowedHosts.has(parsed.hostname);
    } catch { return false; }
  }

  async function cachedPath(url) {
    // One directory read replaces probing every possible extension for every
    // cover, logo and hero. Still check a hit so deleted files can be repaired.
    if (!indexLoading) indexLoading = fs.readdir(directory).catch(() => []).then(entries => {
      for (const name of entries) if (/^[a-f0-9]{64}\.(jpg|png|webp|avif|gif|svg)$/.test(name)) files.set(name.slice(0, 64), path.join(directory, name));
    });
    await indexLoading;
    const hash = createHash('sha256').update(url).digest('hex');
    const filename = files.get(hash);
    if (filename) try { await fs.access(filename); return filename; } catch { files.delete(hash); knownBytes = undefined; }
    return null;
  }

  async function sizeOnDisk() {
    if (knownBytes !== undefined) return knownBytes;
    if (!sizeLoading) sizeLoading = (async () => {
      const entries = (await fs.readdir(directory, { withFileTypes: true }).catch(() => [])).filter(entry => entry.isFile());
      let bytes = 0;
      for (let i = 0; i < entries.length; i += 16) bytes += (await Promise.all(entries.slice(i, i + 16).map(entry => fs.stat(path.join(directory, entry.name)).then(stat => stat.size).catch(() => 0)))).reduce((total, size) => total + size, 0);
      knownBytes = bytes; return bytes;
    })().finally(() => { sizeLoading = null; });
    return sizeLoading;
  }

  async function download(task) {
    if (downloads >= 4) await new Promise(resolve => waiting.push(resolve));
    else downloads++;
    try { return await task(); }
    finally { const next = waiting.shift(); if (next) next(); else downloads--; }
  }

  async function store(url) {
    if (!allowed(url)) return url;
    const existing = await cachedPath(url);
    if (existing) return pathToFileURL(existing).href;
    if (now() < (retryAfter.get(url) || 0)) return url;
    return download(async () => {
      // Failed sources get a short backoff instead of retrying on every card.
      retryAfter.delete(url); retryAfter.set(url, now() + 30000);
      while (retryAfter.size > 512) retryAfter.delete(retryAfter.keys().next().value);
      if (await sizeOnDisk() >= MAX_CACHE_BYTES) return url;
      try {
        const response = await fetchImage(url, { signal: AbortSignal.timeout(12000) });
        if (!response.ok || !allowed(response.url || url)) { await response.body?.cancel().catch(() => {}); return url; }
        const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const extension = IMAGE_TYPES.get(mime);
        if (!extension || Number(response.headers.get('content-length') || 0) > MAX_IMAGE_BYTES) { await response.body?.cancel().catch(() => {}); return url; }
        const chunks = [];
        let byteCount = 0;
        for await (const chunk of response.body) {
          byteCount += chunk.length;
          if (byteCount > MAX_IMAGE_BYTES) { await response.body.cancel().catch(() => {}); return url; }
          chunks.push(chunk);
        }
        await sizeOnDisk();
        if (!byteCount || knownBytes + byteCount > MAX_CACHE_BYTES) return url;
        const hash = createHash('sha256').update(url).digest('hex');
        const filename = path.join(directory, `${hash}${extension}`);
        // Reserve before yielding to disk I/O so parallel downloads obey the cap.
        knownBytes += byteCount;
        try {
          await fs.mkdir(directory, { recursive: true });
          await fs.writeFile(`${filename}.tmp`, Buffer.concat(chunks));
          await fs.rename(`${filename}.tmp`, filename);
        } catch (error) { knownBytes -= byteCount; throw error; }
        files.set(hash, filename); retryAfter.delete(url);
        return pathToFileURL(filename).href;
      } catch { return url; }
    });
  }

  function cacheImage(url) {
    if (!allowed(url)) return Promise.resolve(url);
    if (!inflight.has(url)) inflight.set(url, store(url).finally(() => inflight.delete(url)));
    return inflight.get(url);
  }

  async function cacheArtwork(artwork) {
    if (!artwork) return artwork;
    const next = { ...artwork, sourceUrls: { ...(artwork.sourceUrls || {}) } };
    await Promise.all(ARTWORK_FIELDS.map(async field => {
      if (typeof next[field] !== 'string') return;
      const source = allowed(next[field]) ? next[field] : next.sourceUrls[field];
      if (!source) return;
      next.sourceUrls[field] = source;
      next[field] = await cacheImage(source);
    }));
    // Preserve identity for an already-cached cover. Callers can then avoid
    // sending unchanged artwork to the renderer or rewriting preferences.
    return ARTWORK_FIELDS.some(field => next[field] !== artwork[field] || next.sourceUrls[field] !== artwork.sourceUrls?.[field]) ? next : artwork;
  }

  return { cacheImage, cacheArtwork, cachedPath };
}

module.exports = { createArtworkCache };
