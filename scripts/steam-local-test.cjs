const assert = require('node:assert/strict');
const { parseVdf, steamAccountId, extractLocalLibrary, manifestProgress, applySteamLocalData } = require('../src/steam-local.cjs');
assert.equal(steamAccountId('76561197960265851'), '123');
assert.equal(steamAccountId('../123'), '');
assert.equal(parseVdf('"Apps" { "20" { "PlayTime" "123" } }').apps['20'].playtime, '123');
const json = JSON.stringify({hidden:{id:'hidden',added:[20,30],removed:[30]},foo:{name:'Hidden',added:[40]}}).replaceAll('\\','\\\\').replaceAll('"','\\"');
const local = `"UserLocalConfigStore" { "Software" { "Valve" { "Steam" { "apps" { "10" { "Playtime" "600" "LastPlayed" "1500" } } "user-collections" "${json}" } } } }`;
const shared = '"UserRoamingConfigStore" { "Software" { "valve" { "Steam" { "apps" { "10" { "hidden" "1" } "50" { "hidden" "0" } } } } } }';
const result = extractLocalLibrary(local, shared);
assert.deepEqual(result.hiddenIds.sort(), ['10', '20']);
assert.equal(result.stats['10'].minutes, 600);
assert.equal(result.stats['10'].lastPlayed, 1500000);
const games = [{id:'steam-10',appId:'10',provider:'Steam'},{id:'steam-20',appId:'20',provider:'Steam',installed:false},{id:'custom-20',appId:'20',provider:'PC'},{id:'steam-50',appId:'50',provider:'Steam',steamPlaytimeMinutes:100}];
assert.deepEqual(applySteamLocalData(games, result).map(game=>game.id), ['custom-20','steam-50']);
assert.equal(applySteamLocalData(games, result)[1].steamPlaytimeMinutes, 100);
assert.equal(parseVdf('// comment\n"One" "2"').one, '2');
assert.equal(manifestProgress('"AppState" { "StateFlags" "4" }').installed, true);
assert.equal(manifestProgress('"AppState" { "StateFlags" "1026" "BytesDownloaded" "50" "BytesToDownload" "100" }').percent, 50);
assert.equal(manifestProgress('"AppState" { "StateFlags" "132" }').installed, false);
assert.equal(manifestProgress('"AppState" { "StateFlags" "512" }').state, 'paused');
assert.equal(manifestProgress('"AppState" { "StateFlags" "640" }').state, 'paused');
assert.equal(manifestProgress('"AppState" { "StateFlags" "1026" }').state, 'queued');
assert.equal(manifestProgress('"AppState" { "StateFlags" "1282" "BytesDownloaded" "0" "BytesToDownload" "100" }').state, 'downloading');
console.log('PASS Steam local hours, case-insensitive hidden games, modern hidden collection, safe account paths, manifest progress');

// Current Steam clients: the Hidden collection lives in cloud storage, with pending edits in .modified.json.
{
  const { cloudHiddenIds } = require('../src/steam-local.cjs');
  const synced = JSON.stringify([['user-collections.hidden', { key: 'user-collections.hidden', value: JSON.stringify({ id: 'hidden', name: 'Hidden', added: [10, 20, 30], removed: [] }) }], ['user-collections.uc-1', { value: JSON.stringify({ id: 'uc-1', name: 'Hidden', added: [99] }) }]]);
  const pending = JSON.stringify([['user-collections.hidden', { value: JSON.stringify({ id: 'hidden', added: [10, 20, 40], removed: [20] }) }]]);
  const assert = require('node:assert/strict');
  assert.deepEqual(cloudHiddenIds(synced).sort(), ['10', '20', '30']);
  assert.deepEqual(cloudHiddenIds(synced, pending).sort(), ['10', '40']);
  assert.deepEqual(cloudHiddenIds('not json', '[]'), []);
  console.log('cloud hidden collection ok');
}
