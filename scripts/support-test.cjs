// Support tools: diagnostics never contain keys or the Windows user folder; backups leave keys out unless asked;
// a backup that isn't ours is refused; two failed starts trigger safe mode and a healthy start clears it.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const support = require('../src/support.cjs');

const settings = {
  steamApiKey: 'ABCD1234EFGH5678IJKL9012MNOP3456', steamGridDbKey: 'sgdbkey_0123456789abcdef', steamId64: '76561198012345678',
  hiddenGameIds: ['steam-1', 'steam-2'], favoriteGameIds: ['steam-3'], customCollections: [{ id: 'c1', name: 'Co-op', gameIds: [] }],
  artwork: { 'steam-1': { tile: 'https://example.test/a.jpg' } }, playHistory: ['steam-3'], playCounts: { 'steam-3': 4 },
  reducedMotion: true, showUninstalledSteam: false
};

// Redaction.
const home = os.homedir();
const report = support.buildDiagnostics({ version: '0.27.0-beta.19', packaged: true, portable: true, electronVersion: '39.8.10', platform: 'win32', release: '10.0',
  locale: 'en-AU', settings, lastLaunch: null, updater: { state: 'current' }, safeMode: false, startup: { failedStarts: 0 }, now: 0 });
for (const secret of [settings.steamApiKey, settings.steamGridDbKey, settings.steamId64]) assert.equal(report.includes(secret), false, 'a key or id leaked');
assert.equal(report.includes(home), false, 'the Windows user folder leaked');
assert.match(report, /Steam Web API key: set/);
assert.match(report, /Hidden games: 2/);
assert.match(report, /== Recent log ==/);

// Backups: keys and the Steam id stay out by default; included only on request, and the file says so.
const plain = support.buildBackup(settings, { now: 0, version: '0.27.0-beta.19' });
assert.equal(JSON.stringify(plain).includes(settings.steamApiKey), false);
assert.equal(JSON.stringify(plain).includes(settings.steamGridDbKey), false);
assert.equal(plain.data.steamId64, undefined);
assert.deepEqual(plain.data.hiddenGameIds, ['steam-1', 'steam-2']);
assert.equal(plain.includesKeys, false);
const withKeys = support.buildBackup(settings, { includeKeys: true, now: 0 });
assert.equal(withKeys.data.steamGridDbKey, settings.steamGridDbKey);
assert.equal(withKeys.includesKeys, true);

// Restore: round trip keeps the data; wrong files are refused; wrong types are dropped, not trusted.
const restored = support.parseBackup(JSON.stringify(plain));
assert.deepEqual(restored.data.favoriteGameIds, ['steam-3']);
assert.deepEqual(restored.data.playCounts, { 'steam-3': 4 });
assert.throws(() => support.parseBackup('{"hello": 1}'), /not a settings backup/);
assert.throws(() => support.parseBackup('not json'), /not a settings backup/);
const tampered = JSON.parse(JSON.stringify(plain));
tampered.data.hiddenGameIds = 'steam-1';
tampered.data.artwork = ['nope'];
tampered.data.steamGridDbKey = 42;
const cleaned = support.parseBackup(JSON.stringify(tampered)).data;
assert.equal('hiddenGameIds' in cleaned, false, 'a non-list hidden games field is dropped');
assert.equal('artwork' in cleaned, false, 'a list where artwork belongs is dropped');
assert.equal('steamGridDbKey' in cleaned, false, 'a non-text key is dropped');

// Safe mode: two starts that never became healthy, then a third start runs safe; a healthy start clears it.
(async () => {
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xpui-support-test-'));
try {
  const file = path.join(dir, 'startup-state.json');
  const first = support.createStartupGuard(file);
  assert.equal(await first.begin(), false, 'first start is normal');
  const second = support.createStartupGuard(file);
  assert.equal(await second.begin(), false, 'a second start that failed to finish is counted, not yet safe');
  const third = support.createStartupGuard(file);
  assert.equal(await third.begin(), true, 'after two failed starts the next one is safe mode');
  await third.healthy();
  const fourth = support.createStartupGuard(file);
  assert.equal(await fourth.begin(), false, 'a healthy start clears safe mode');
  console.log('safe mode ok');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('support tests passed');
})().catch(error => { console.error(error); process.exit(1); });
