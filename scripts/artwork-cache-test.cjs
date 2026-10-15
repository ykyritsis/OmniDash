const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { createArtworkCache } = require('../src/artwork-cache.cjs');

(async () => {
  const root = path.resolve(__dirname, '../.visual-review');
  const directory = await fs.mkdtemp(path.join(root, 'artwork-cache-'));
  try {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let requests = 0;
    const url = 'https://art.example.test/cover.png';
    const cache = createArtworkCache(directory, {
      allowedHosts: new Set(['art.example.test']),
      fetchImage: async () => { requests++; return new Response(image, { headers: { 'content-type': 'image/png' } }); }
    });
    const [first, duplicate] = await Promise.all([cache.cacheImage(url), cache.cacheImage(url)]);
    assert.equal(first, duplicate);
    assert.equal(requests, 1, 'simultaneous requests should share one download');
    assert.deepEqual(await fs.readFile(fileURLToPath(first)), image);
    const artwork = await cache.cacheArtwork({ tile: url, logo: url, tileIsSquare: true });
    assert.equal(artwork.tile, first);
    assert.equal(artwork.sourceUrls.tile, url);
    assert.equal(await cache.cacheImage('https://not-allowed.test/cover.png'), 'https://not-allowed.test/cover.png');
    const offline = createArtworkCache(directory, {
      allowedHosts: new Set(['art.example.test']),
      fetchImage: () => { throw Error('Network must not be used for a cached image'); }
    });
    assert.equal(await offline.cacheImage(url), first);
    assert.equal((await offline.cacheArtwork(artwork)).tile, first);
    await fs.unlink(fileURLToPath(first));
    assert.equal(await cache.cacheImage(url), first, 'A deleted cache file must be downloaded again');
    assert.equal(requests, 2);
    let active = 0, peak = 0, clock = 1000, attempts = 0;
    const bounded = createArtworkCache(directory, {
      allowedHosts: new Set(['art.example.test']), now: () => clock,
      fetchImage: async url => {
        attempts++;
        if (url.includes('unavailable')) throw Error('offline');
        active++; peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, 10)); active--;
        return new Response(image, {headers:{'content-type':'image/png'}});
      }
    });
    const covers = await Promise.all(Array.from({length:12}, (_,i) => bounded.cacheImage(`https://art.example.test/${i}.png`)));
    assert(covers.every(value => value.startsWith('file:')));
    assert(peak > 1 && peak <= 4, 'Separate callers must share a bounded download pool');
    const missing = 'https://art.example.test/unavailable.png';
    await bounded.cacheImage(missing); const failedAttempts = attempts;
    await Promise.all(Array.from({length:10}, () => bounded.cacheImage(missing)));
    assert.equal(attempts, failedAttempts, 'Failed artwork must not retry on every render');
    clock += 30001; await bounded.cacheImage(missing);
    assert.equal(attempts, failedAttempts + 1, 'A failed source must remain retryable');
    console.log('PASS: indexed offline artwork reuse, deleted-file repair, duplicate requests, four-download limit and retry backoff');
  } finally {
    assert.equal(path.dirname(directory), root);
    await fs.rm(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
