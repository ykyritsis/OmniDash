// The install sheet's add-ons section, run for real in a sandbox (no window): rows and language choices render,
// ticking changes the space, unowned add-ons can't be ticked, and saving sends only what can be installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/renderer/garrison-install-addons.js'), 'utf8');
const saved = [];
const data = {
  dlc: [
    { appId: '5001', title: 'Zombies Chronicles', price: '', installBytes: 7e9, downloadBytes: 5.9e9, owned: true, checked: true, big: true },
    { appId: '5002', title: 'Weapon Pack', price: '', installBytes: 150e6, downloadBytes: 120e6, owned: true, checked: false, big: false },
    { appId: '5003', title: 'Season Pass <b>', price: 'A$39.95', installBytes: 3e9, downloadBytes: 2e9, owned: false, checked: false, big: true }
  ],
  noDownloadCount: 2, ownershipKnown: true, language: 'english', englishInstallBytes: 340e6,
  languages: [{ code: 'english', label: 'English', installBytes: 340e6 }, { code: 'french', label: 'French', installBytes: 325e6 }, { code: 'german', label: 'German', installBytes: 900e6 }]
};
const sandbox = {
  window: { launcher: { getInstallAddons: async () => data, setInstallChoices: async (id, choices) => { saved.push({ id, choices }); return true; } } },
  escapeHtml: text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
  gIcon: name => `<i data-icon="${name}"></i>`,
  formatBytes: bytes => `${(bytes / 1e9).toFixed(1)} GB`,
  CSS: { escape: text => String(text) },
  console
};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.gLoadInstallAddons = gLoadInstallAddons;`, sandbox);
const control = attribute => ({ dataset: attribute });

(async () => {
  const addons = await sandbox.gLoadInstallAddons({ id: 'steam-311210', title: 'Call of Duty' });
  assert.ok(addons, 'the section loads');
  assert.equal(addons.extraBytes(), 7e9, 'Steam enabled the 7 GB add-on, so it counts');

  const markup = addons.markup();
  assert.match(markup, /What to install/);
  assert.match(markup, /Zombies Chronicles/);
  assert.match(markup, /Large/, 'a big add-on is flagged');
  assert.match(markup, /Not owned/, 'an unowned add-on says so');
  assert.doesNotMatch(markup, /A\$39\.95/, 'prices are never shown');
  assert.match(markup, /Season Pass &lt;b&gt;/, 'titles are escaped');
  assert.match(markup, /2 more add-ons add no download/);
  assert.match(markup, /Language pack/);
  assert.match(markup, /Your choices add about 7\.0 GB/);

  // Ticking and unticking changes the space; focus goes back to the control that was used.
  assert.equal(addons.handle(control({ addonToggle: '5002' })), '[data-addon-toggle="5002"]');
  assert.equal(addons.extraBytes(), 7e9 + 150e6);
  addons.handle(control({ addonToggle: '5001' }));
  assert.equal(addons.extraBytes(), 150e6);

  // An add-on you don't own can't be ticked.
  addons.handle(control({ addonToggle: '5003' }));
  assert.equal(addons.selection.dlc['5003'], false);
  assert.match(addons.markup(), /aria-disabled="true"/);

  // Another language replaces English: its size minus English is added, and a smaller pack lowers the total.
  addons.handle(control({ addonLanguage: 'german' }));
  assert.equal(addons.extraBytes(), 150e6 + (900e6 - 340e6));
  addons.handle(control({ addonLanguage: 'french' }));
  assert.equal(addons.extraBytes(), 150e6 + (325e6 - 340e6), 'French replaces English and is a little smaller, so the total drops');
  addons.handle(control({ addonLanguage: 'english' }));

  // Select all skips what you don't own; Select none clears the rest.
  addons.handle(control({ addonAll: 'on' }));
  assert.equal(addons.extraBytes(), 7e9 + 150e6);
  assert.equal(addons.selection.dlc['5003'], false);
  addons.handle(control({ addonAll: 'off' }));
  assert.equal(addons.extraBytes(), 0);
  assert.match(addons.markup(), /No extra space for your choices/);

  // Saving sends only add-ons that can be installed, with the language.
  addons.handle(control({ addonToggle: '5002' }));
  addons.handle(control({ addonLanguage: 'german' }));
  await addons.save();
  assert.deepEqual(JSON.parse(JSON.stringify(saved[0])), { id: 'steam-311210', choices: { dlc: { 5001: false, 5002: true }, language: 'german' } });

  // Nothing to choose means no section, so the sheet stays the plain drive picker.
  sandbox.window.launcher.getInstallAddons = async () => ({ dlc: [], languages: [], noDownloadCount: 0 });
  assert.equal(await sandbox.gLoadInstallAddons({ id: 'x', title: 'Simple game' }), null);
  // Without Steam's own list no add-ons are offered, and the sheet says how to see yours.
  sandbox.window.launcher.getInstallAddons = async () => ({ dlc: [], languages: [], noDownloadCount: 0, ownershipKnown: false, dlcHidden: true });
  const unknown = await sandbox.gLoadInstallAddons({ id: 'x', title: 'Game' });
  assert.match(unknown.markup(), /Your add-ons appear here once Steam is open/);
  assert.equal(unknown.extraBytes(), 0);
  // A DLC with language copies is sized for the language picked.
  sandbox.window.launcher.getInstallAddons = async () => ({ dlc: [{ appId: '6', title: 'Zombies', installBytes: 3296e6, downloadBytes: 1, owned: true, checked: true,
    base: { installBytes: 2941e6, downloadBytes: 1 }, languageSizes: { english: { installBytes: 355e6 }, french: { installBytes: 317e6 } } }],
    languages: [{ code: 'english', label: 'English', installBytes: 340e6 }, { code: 'french', label: 'French', installBytes: 340e6 }], language: 'english', englishInstallBytes: 340e6, ownershipKnown: true });
  const perLanguage = await sandbox.gLoadInstallAddons({ id: 'x', title: 'Game' });
  assert.equal(perLanguage.extraBytes(), 3296e6);
  perLanguage.handle(control({ addonLanguage: 'french' }));
  assert.equal(perLanguage.extraBytes(), 2941e6 + 317e6);
  assert.match(perLanguage.markup(), /3\.3 GB/);
  console.log('install-addons-ui tests passed');
})().catch(error => { console.error(error); process.exit(1); });
