// Smart collections: each rule picks the right games, apps are never included, and the dates and sizes
// are read the way the library stores them.
const assert = require('node:assert/strict');
const { gSmartCollections, gSmartMatch } = require('../src/renderer/smart-collections.js');

const now = Date.UTC(2026, 9, 17);
const day = 24 * 60 * 60 * 1000;
const games = {
  fresh: { title: 'Fresh', installed: true, addedAt: now - 3 * day, steamPlaytimeMinutes: 0 },
  old: { title: 'Old', installed: true, addedAt: now - 90 * day, steamPlaytimeMinutes: 3000, sizeOnDisk: 80e9, steamCategories: ['Single-player', 'Co-op'] },
  notInstalled: { title: 'Library only', installed: false, addedAt: now - 2 * day, sizeOnDisk: 90e9 },
  launchedHere: { title: 'Launched here', installed: true, steamPlaytimeMinutes: 0, playCount: 2 },
  played: { title: 'Played', installed: true, steamPlaytimeMinutes: 30 },
  coop: { title: 'Party', installed: true, steamCategories: ['Online Co-op', 'Shared/Split Screen Co-op'] },
  app: { title: 'Steam', isApp: true, installed: true, steamPlaytimeMinutes: 0 }
};
const matches = key => Object.keys(games).filter(name => gSmartMatch(games[name], key, now)).sort();

assert.deepEqual(matches('unplayed'), ['coop', 'fresh', 'notInstalled'], 'no playtime, never launched from here');
assert.equal(gSmartMatch(games.launchedHere, 'unplayed', now), false, 'a game launched here counts as played');
assert.equal(gSmartMatch(games.fresh, 'unplayed', now, () => now - day), false, 'a recorded launch counts as played');
assert.deepEqual(matches('recent-added'), ['fresh'], 'installed and added within 30 days');
assert.deepEqual(matches('played-lots'), ['old'], '20 hours or more');
assert.deepEqual(matches('big'), ['old'], 'installed and 50 GB or more');
assert.deepEqual(matches('coop'), ['coop', 'old']);
assert.deepEqual(matches('solo'), ['old']);
assert.equal(gSmartMatch(games.app, 'unplayed', now), false, 'apps are never in a collection');
assert.equal(gSmartMatch(games.fresh, 'nonsense', now), false);
assert.equal(gSmartMatch(null, 'unplayed', now), false);
assert.equal(gSmartCollections.length, 6);
assert.ok(gSmartCollections.every(([key, label]) => key && label));
console.log('smart-collections tests passed');
