// Console pack manager (§2.6, task P1).
// The registry in src/support.cjs is the one place that names every pack folder the app reads. This test checks it
// against the IPC lists in main.cjs (so a pack cannot be supported but missing from Settings), checks the preload
// bridge and the Appearance section for a real action on every row, and exercises the folder scan, credit line,
// README write and no-overwrite rule against a temporary folder — never against the owner's real packs.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const support = require('../src/support.cjs');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFile(path.join(root, name), 'utf8');
const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The keys of one `const NAME = { ... };` block in main.cjs. Pack ids sit at four-space indent.
function blockKeys(source, name) {
  const start = source.indexOf(`const ${name} = {`);
  assert.notEqual(start, -1, `${name} exists in main.cjs`);
  const end = source.indexOf('\n  };', start);
  assert.notEqual(end, -1, `${name} block ends`);
  const keys = new Set();
  for (const match of source.slice(start, end).matchAll(/^ {4}'?([A-Za-z0-9_]+)'?:/gm)) keys.add(match[1]);
  return [...keys];
}

(async () => {
  const registry = support.PACK_REGISTRY;
  assert.ok(Array.isArray(registry) && registry.length, 'the pack registry is not empty');
  const ids = registry.map(pack => pack.id);
  assert.equal(new Set(ids).size, ids.length, 'pack ids are unique');

  // ---------- Every pack folder the app supports is in the registry ----------
  const main = await read('src/main.cjs');
  const retroPacks = blockKeys(main, 'RETRO_PACKS');
  const retroMusic = blockKeys(main, 'RETRO_MUSIC');
  assert.ok(retroPacks.length >= 4, 'main.cjs still lists the retro packs');
  assert.ok(retroMusic.length >= 6, 'main.cjs still lists the music slots');
  const supported = new Set([...retroPacks, ...retroMusic, 'x360']);
  assert.deepEqual(ids.slice().sort(), [...supported].sort(),
    `the registry lists every pack folder the app reads (registry: ${ids.join(', ')}; app: ${[...supported].join(', ')})`);
  for (const pack of registry) {
    assert.equal(typeof pack.name, 'string', `${pack.id} has a display name`);
    assert.ok(pack.name.trim(), `${pack.id} display name is not empty`);
    assert.equal(typeof pack.console, 'string', `${pack.id} names its theme`);
    assert.ok(pack.console.trim(), `${pack.id} theme is not empty`);
    assert.ok(pack.folder && !path.isAbsolute(pack.folder) && !pack.folder.split('/').includes('..'),
      `${pack.id} folder is a relative in-packs path (${pack.folder})`);
    assert.ok(typeof pack.credit === 'string' && pack.credit.trim(), `${pack.id} has a documented credit fallback`);
    assert.ok(typeof pack.install === 'string' && pack.install.trim(), `${pack.id} explains what to install`);
    assert.ok(Array.isArray(pack.expected) && pack.expected.length, `${pack.id} lists the names it looks for`);
    for (const group of pack.expected) {
      assert.ok(group.label && group.label.trim(), `${pack.id} expected group has a label`);
      assert.ok(group.folder && !path.isAbsolute(group.folder) && !group.folder.split('/').includes('..'),
        `${pack.id} expected group stays inside the pack (${group.folder})`);
      assert.ok(Array.isArray(group.names) && group.names.length, `${pack.id}/${group.label} lists file names`);
      for (const name of group.names) assert.ok(typeof name === 'string' && name.trim(), `${pack.id}/${group.label} file name is not empty`);
    }
  }
  // The four console themes whose engines read a pack folder, plus the 360's own DashX360 pack.
  for (const id of ['ps3', 'ps4', 'wii', '3ds', 'x360']) assert.ok(ids.includes(id), `the ${id} pack is listed`);

  // ---------- IPC and preload wiring ----------
  const preload = await read('src/preload.cjs');
  for (const channel of ['theme:packs', 'theme:pack-open', 'theme:pack-readme']) {
    assert.match(main, new RegExp(`ipcMain\\.handle\\('${escapeRegExp(channel)}'`), `${channel} has a main-process handler`);
    assert.match(preload, new RegExp(`invoke\\('${escapeRegExp(channel)}'`), `${channel} is reachable through the preload bridge`);
  }
  for (const method of ['getThemePacks', 'openThemePack', 'writeThemePackReadme']) {
    assert.match(preload, new RegExp(`\\b${method}\\s*:`), `window.launcher.${method} is exposed`);
  }
  // The IPC handlers must use the registry, not a second hand-written list.
  assert.match(main, /support\.PACK_REGISTRY\.find\(/, 'the pack handlers resolve ids through the registry');
  assert.match(main, /support\.listThemePacks\(retroRoot\)/, 'theme:packs reads the registry report');

  // ---------- Appearance section: a real action on every row ----------
  const settings = await read('src/renderer/garrison-theme-settings.js');
  const screens = await read('src/renderer/garrison-theme-screens.css');
  assert.match(settings, /data-settings-page="personalization"/, 'the manager is mounted on Settings → Appearance');
  assert.match(settings, /window\.launcher\.getThemePacks\(\)/, 'the section loads the pack report from the bridge');
  assert.match(settings, /window\.launcher\.openThemePack\(/, 'Open folder calls the IPC');
  assert.match(settings, /window\.launcher\.writeThemePackReadme\(/, 'Add README calls the IPC');
  assert.match(settings, /data-action="\$\{GPACK_OPEN\}"/, 'every rendered row carries the Open folder action');
  assert.match(settings, /data-action="\$\{GPACK_README\}"/, 'a row without a README carries the Add README action');
  assert.match(settings, /data-state="\$\{pack\.found \? 'found' : 'missing'\}"/, 'every row reports found or missing');
  assert.match(settings, /Add README/, 'the missing-README action is labelled');
  assert.doesNotMatch(settings, /data-pack-id="(?:ps3|ps4|wii|3ds|x360|series|one)"/, 'rows come from the registry, not a hard-coded list');
  assert.match(screens, /\.g-pack-section/, 'the pack section has styles in the console screens stylesheet');
  assert.match(screens, /body\[data-g-theme="(?:ps3|ps4|wii|3ds)"\][^{]*\.g-pack-section[^{]*\{[^}]*font-size:\s*calc\([^}]*var\(--cpx\)/,
    'the console settings screens size the section in --cpx');
  assert.match(screens, /body\[data-g-theme="wii"\][^{]*\.g-pack-row|body\[data-g-theme="3ds"\][^{]*\.g-pack-row/,
    'the light Wii/3DS settings screens keep the pack rows light');

  // ---------- Scan, credit, README, no-overwrite: a temporary pack folder only ----------
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'omnidash-pack-test-'));
  try {
    const ps3 = registry.find(pack => pack.id === 'ps3');
    let report = await support.themePackReport(temp, ps3);
    assert.equal(report.found, false, 'an absent pack reports missing');
    assert.equal(report.folderExists, false);
    assert.equal(report.creditSource, 'docs', 'a missing pack falls back to the documented credit');
    assert.ok(report.credit.trim(), 'the documented credit is a real line');
    for (const key of support.PACK_COUNT_KEYS) {
      assert.equal(typeof report.counts[key], 'number', `${key} count is a number`);
      assert.equal(report.counts[key], 0, `${key} count of a missing pack is 0`);
    }
    assert.equal(report.readme.present, false, 'a missing pack has no README');
    let target = await support.packOpenTarget(temp, ps3);
    assert.equal(target.folder, false, 'a missing pack opens its parent folder');
    assert.equal(target.path, temp, 'the parent folder is the packs root');

    // Build the real file names the PS3 pack expects.
    const packDir = path.join(temp, 'ps3');
    const iconDir = path.join(packDir, 'PS3-Simulator-main', 'icons');
    const fontDir = path.join(packDir, 'PS3-Simulator-main', 'fonts');
    const soundDir = path.join(packDir, 'XMB-PS3-Icons-Sounds-Pack--main', 'pack', 'PS3 Icons + Sounds', 'oggs');
    await fs.mkdir(iconDir, { recursive: true });
    await fs.mkdir(fontDir, { recursive: true });
    await fs.mkdir(soundDir, { recursive: true });
    await fs.writeFile(path.join(iconDir, 'settings.png'), 'not really a png');
    await fs.writeFile(path.join(iconDir, 'psn.png'), 'not really a png');
    await fs.writeFile(path.join(fontDir, 'SCE-PS3-RD-R-LATIN2.woff'), 'font');
    for (const name of ['down.ogg', 'ok.ogg', 'cancel.ogg', 'up.ogg', 'unlock.ogg', 'bgm.ogg']) {
      await fs.writeFile(path.join(soundDir, name), 'sound');
    }
    // Reference captures must not make a pack look installed.
    await fs.mkdir(path.join(packDir, 'ref'), { recursive: true });
    await fs.writeFile(path.join(packDir, 'ref', 'xmb.jpg'), 'reference');

    report = await support.themePackReport(temp, ps3);
    assert.equal(report.found, true, 'a populated pack reports found');
    assert.equal(report.folderExists, true);
    assert.equal(report.counts.icons, 2, 'icons are counted');
    assert.equal(report.counts.fonts, 1, 'fonts are counted');
    assert.equal(report.counts.sounds, 5, 'sounds are counted');
    assert.equal(report.counts.music, 1, 'music is counted separately from sounds');
    assert.equal(report.counts.wallpapers, 0);
    assert.equal(report.counts.video, 0);
    assert.equal(report.total, 9, 'the total is the sum of the categories');
    target = await support.packOpenTarget(temp, ps3);
    assert.equal(target.folder, true, 'a found pack opens its own folder');
    assert.equal(target.path, packDir);

    // Credit comes from the pack's own readme when it has one.
    const userReadme = path.join(packDir, 'README.md');
    await fs.writeFile(userReadme, '# Test pack\n\nOriginal app credit: Test Author\n');
    report = await support.themePackReport(temp, ps3);
    assert.equal(report.creditSource, 'pack', 'the pack readme supplies the credit');
    assert.equal(report.credit, 'Original app credit: Test Author');
    assert.equal(report.creditFile, 'README.md');
    assert.equal(report.readme.present, true);
    assert.equal(report.readme.file, 'README.md');

    // Never overwrite a file the user wrote.
    const userText = await fs.readFile(userReadme, 'utf8');
    const blocked = await support.writePackReadme(temp, ps3);
    assert.equal(blocked.written, false, 'a README already present is not replaced');
    assert.equal(blocked.reason, 'exists');
    assert.equal(await fs.readFile(userReadme, 'utf8'), userText, 'the player’s README is untouched');
    await assert.rejects(fs.access(path.join(packDir, support.PACK_README_NAME)), 'no second README is written');

    // A pack with no README gets one, and it names every file the app looks for.
    const ds = registry.find(pack => pack.id === '3ds');
    const made = await support.writePackReadme(temp, ds);
    assert.equal(made.written, true, 'a pack without a README gets one');
    assert.equal(made.file, support.PACK_README_NAME);
    const guide = await fs.readFile(path.join(temp, '3ds', support.PACK_README_NAME), 'utf8');
    assert.match(guide, /OmniDash console pack: Nintendo 3DS/);
    for (const group of ds.expected) {
      assert.match(guide, new RegExp(escapeRegExp(group.label)), `the README names the ${group.label} group`);
      for (const name of group.names) assert.ok(guide.includes(name), `the README names ${name}`);
    }
    assert.match(guide, /never overwrites/i, 'the README says it is not an overwrite risk');
    const again = await support.writePackReadme(temp, ds);
    assert.equal(again.written, false, 'a generated README is not written twice');
    report = await support.themePackReport(temp, ds);
    assert.equal(report.folderExists, true, 'the README creates the pack folder');
    assert.equal(report.found, false, 'a README alone does not count as pack files');
    assert.equal(report.readme.present, true, 'the generated README is reported present');
    assert.equal(report.total, 0);

    // Counts parsed from a scan are always finite numbers the eval and the UI can trust.
    for (const pack of registry) {
      const fresh = await support.themePackReport(temp, pack);
      for (const key of support.PACK_COUNT_KEYS) assert.ok(Number.isFinite(fresh.counts[key]), `${pack.id}/${key} is finite`);
      assert.equal(typeof fresh.found, 'boolean');
      assert.ok(fresh.credit.length > 0);
      assert.ok(Array.isArray(fresh.expected) && fresh.expected.length);
      assert.ok(fresh.readme && typeof fresh.readme.present === 'boolean');
    }
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }

  console.log(`PASS console pack manager: ${registry.length} pack folders, every row has a real action, README write never overwrites`);
})().catch(error => { console.error(error); process.exit(1); });
