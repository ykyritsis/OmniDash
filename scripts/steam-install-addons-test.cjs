// Install add-on choices: depots group into DLC and languages, sizes add up, defaults follow what Steam
// would do, saved choices win, and the Steam calls only touch what the sheet listed.
const assert = require('node:assert/strict');
const { groupDepots, buildAddons, extraBytes, extraDownloadBytes, planCalls, languageLabel } = require('../src/steam-install-addons.cjs');

const manifest = (size, download) => ({ manifests: { public: { size: String(size), download: String(download) } } });
// Shaped like a Call of Duty app: a huge base, a depot per language, two DLC with files, other platforms ignored.
const info = {
  depots: {
    '100': { config: { oslist: 'windows' }, ...manifest(25e9, 20e9) },
    '101': { config: { oslist: 'windows', language: 'english' }, ...manifest(340e6, 300e6) },
    '102': { config: { oslist: 'windows', language: 'french' }, ...manifest(325e6, 290e6) },
    '103': { config: { oslist: 'windows', language: 'german' }, ...manifest(362e6, 320e6) },
    '200': { dlcappid: '5001', config: { oslist: 'windows' }, ...manifest(6e9, 5e9) },
    '201': { dlcappid: '5001', config: { oslist: 'windows' }, ...manifest(1e9, 0.9e9) },
    '210': { dlcappid: '5002', config: { oslist: 'windows' }, ...manifest(150e6, 120e6) },
    '300': { config: { oslist: 'macos' }, ...manifest(9e9, 8e9) },
    '301': { dlcappid: '5003', config: { oslist: 'macos' }, ...manifest(4e9, 3e9) },
    'branch': { config: {} },
    '400': { depotfromapp: '9000', config: { oslist: 'windows', language: 'english' } }
  }
};
// Black Ops III's Zombies DLC: shared files plus one depot per language. Only one language gets installed.
info.depots['220'] = { dlcappid: '5006', config: { oslist: 'windows' }, ...manifest(2941e6, 2800e6) };
info.depots['221'] = { dlcappid: '5006', config: { oslist: 'windows', language: 'english' }, ...manifest(355e6, 330e6) };
info.depots['222'] = { dlcappid: '5006', config: { oslist: 'windows', language: 'french' }, ...manifest(317e6, 300e6) };
info.depots['223'] = { dlcappid: '5006', config: { oslist: 'windows', language: 'arabic' }, ...manifest(499e6, 480e6) };
const shared = { 9000: { depots: { '400': manifest(500e6, 450e6) } } };
const groups = groupDepots(info, shared);

assert.equal(groups.dlc.size, 3, 'three DLC ship files (the macOS one is ignored)');
assert.equal(groups.dlc.get('5006').installBytes, 2941e6, 'language copies are kept apart from the shared files');
assert.equal(groups.languages.has('arabic'), false, "a DLC's language depots are not the game's language packs");
assert.equal(groups.dlc.get('5001').installBytes, 7e9, 'a DLC with two depots adds them up');
assert.equal(groups.dlc.get('5002').installBytes, 150e6);
assert.equal(groups.languages.get('english').installBytes, 340e6 + 500e6, 'a shared depot is sized from the app that owns it');
assert.equal(groups.languages.get('french').downloadBytes, 290e6);
assert.equal(groups.dlc.has('5003'), false, 'platform depots are skipped');

const store = new Map([['5001', { title: 'Zombies Chronicles', price: 'A$29.95' }], ['5002', { title: 'Weapon Pack', price: '' }]]);
const steamDlc = new Map([['5001', { name: 'Zombies Chronicles', enabled: true, owned: true }], ['5002', { name: 'Weapon Pack', enabled: false, owned: true }],
  ['5004', { name: 'Season Pass', enabled: true, owned: true }], ['5006', { name: 'Zombies', enabled: false, owned: false }], ['5005', { name: 'Unowned', enabled: false, owned: false }]]);
const addons = buildAddons({ groups, listedDlcIds: ['5001', '5002', '5004', '5005'], store, steamDlc });

assert.deepEqual(addons.dlc.map(row => row.appId), ['5001', '5002'], 'only owned add-ons, biggest first');
assert.equal(addons.dlc[0].price, '', 'owned add-ons show no price');
assert.equal(addons.dlc[0].big, true, 'a 7 GB add-on is flagged');
assert.equal(addons.dlc[1].big, false);
assert.equal(addons.dlc[0].checked, true, 'enabled in Steam means checked');
assert.equal(addons.dlc[1].checked, false, 'disabled in Steam stays unchecked');
assert.equal(addons.noDownloadCount, 1, 'owned add-ons that add no files are counted, not listed');
// Sized like Steam: shared files plus the chosen language's copy (3,296 MB for Zombies in English).
const zombies = buildAddons({ groups, store, steamDlc: new Map([['5006', { name: 'Zombies', enabled: true, owned: true }]]) });
assert.equal(zombies.dlc[0].installBytes, 2941e6 + 355e6);
assert.equal(extraBytes(zombies, { dlc: {}, language: 'french' }), 2941e6 + 317e6 + (325e6 - 840e6), 'the DLC follows the language picked; French also replaces the English pack');
assert.equal(addons.languages.length, 3);
assert.equal(addons.language, 'english');
assert.equal(languageLabel('latam'), 'Spanish - Latin America');
assert.equal(languageLabel('klingon'), 'Klingon');

// Space: every checked add-on, plus the difference when another language replaces English.
assert.equal(extraBytes(addons, { dlc: {}, language: 'english' }), 7e9);
assert.equal(extraBytes(addons, { dlc: { 5001: false, 5002: true }, language: 'english' }), 150e6);
assert.equal(extraBytes(addons, { dlc: { 5001: false }, language: 'french' }), 325e6 - 840e6 < 0 ? 0 : 325e6 - 840e6, 'never below zero');
assert.equal(extraBytes(addons, { dlc: { 5001: false, 5002: false }, language: 'german' }), 0, 'a smaller pack than English adds nothing');
assert.equal(extraDownloadBytes(addons, { dlc: { 5001: true, 5002: true }, language: 'french' }), 5.9e9 + 120e6 + 290e6);

// A saved choice wins over Steam's default; without Steam's list nothing is offered (ownership unknown).
const remembered = buildAddons({ groups, store, steamDlc, saved: { dlc: { 5001: false, 5002: true }, language: 'german' } });
assert.equal(remembered.dlc[0].checked, false);
assert.equal(remembered.dlc[1].checked, true);
assert.equal(remembered.language, 'german');
const unknown = buildAddons({ groups, store, steamDlc: null });
assert.equal(unknown.dlc.length, 0, 'without Steam, unowned add-ons are never offered');
assert.equal(unknown.languages.length, 3, 'language packs still are');
const notOwned = buildAddons({ groups, store, steamDlc: new Map([['5002', { name: 'Weapon Pack', enabled: true, owned: true }]]) });
assert.equal(notOwned.dlc.some(row => row.appId === '5001'), false, 'a DLC you do not own is not listed');

// Steam calls: explicit choices only, never for DLC you don't own, language only when it's a real option.
const calls = planCalls('311210', { dlc: { 5001: false, 5002: true }, language: 'french' }, addons);
assert.deepEqual(calls, [
  { type: 'dlc', appId: 311210, dlcAppId: 5001, enabled: false },
  { type: 'dlc', appId: 311210, dlcAppId: 5002, enabled: true },
  { type: 'language', appId: 311210, code: 'french' }
]);
assert.equal(planCalls('311210', { dlc: { 5001: true } }, notOwned).length, 0, 'nothing is sent for a DLC that is not listed');
assert.equal(planCalls('311210', { dlc: {}, language: 'klingon' }, addons).length, 0, 'an unknown language is ignored');
assert.throws(() => planCalls('abc', { dlc: {} }, addons), /Invalid Steam app/);
console.log('steam-install-addons tests passed');
