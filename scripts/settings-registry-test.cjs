// Settings registry (§2.1): every entry must really be usable (get/set/available), every console layout row must
// name a real registry id, and the honesty rules must hold — a desktop has no brightness, read-only facts refuse
// set(), and a setting whose consumer has not landed yet reports unavailable instead of pretending.
//
// Runs in plain Node, no Electron: the registry is evaluated in a small fake browser whose launcher remembers the
// IPC calls it receives.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '../src/renderer/garrison-settings-registry.js'), 'utf8');
const KINDS = ['slider', 'toggle', 'choice', 'action', 'info'];
const CONSOLES = ['series', 'one', 'x360', 'ps3', 'ps4', 'wii', '3ds'];
const FORM_INPUTS = {
  'ui-scale': { value: '100' }, 'text-size': { value: '100' }, 'tile-radius': { value: '8' },
  'reduced-motion-toggle': { checked: false }, 'high-contrast-focus-toggle': { checked: false },
  'fullscreen-toggle': { checked: true }, 'startup-toggle': { checked: true }, 'sound-toggle': { checked: true },
  'show-uninstalled-toggle': { checked: false, disabled: true }, 'show-uninstalled-epic-toggle': { checked: false, disabled: true },
  'shuffle-home-screenshots-toggle': { checked: true }, 'random-screenshot-background-toggle': { checked: false },
  'steam-api-key': { value: '' }, 'legendary-path': { value: '' }, 'sgdb-key': { value: '' }
};

class FakeEvent {
  constructor(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); this.detail = init.detail; this.defaultPrevented = false; }
}

function createHarness({ brightness = 70, volume = { level: 45, muted: false }, plans = [] } = {}) {
  const calls = [];
  const events = [];
  const prefs = {
    pauseDownloadsWhilePlaying: true, controllerVibration: true, theme: 'helix',
    clockFormat: '12h', dateOrder: 'locale', enterButton: 'x', nintendoLayout: false,
    menuMusic: true, menuMusicVolume: 60, screensaverDelay: 4,
    notifyFriends: true, notifyDownloads: true, notifyAchievements: true,
    screenLayout3ds: 'stacked', ps3ThemeColour: 'month'
  };
  let theme = 'helix';
  const elements = {};
  for (const [id, shape] of Object.entries(FORM_INPUTS)) {
    elements[id] = {
      id, value: shape.value ?? '', checked: Boolean(shape.checked), disabled: Boolean(shape.disabled),
      dispatched: [],
      dispatchEvent(event) { this.dispatched.push(event.type); return true; },
      closest() { return null; },
      focus() {}
    };
  }
  const document = {
    querySelector(selector) {
      if (selector.startsWith('#')) return elements[selector.slice(1)] || null;
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener(type, listener) { document.listeners.push({ type, listener }); },
    dispatchEvent(event) { events.push(event); return true; },
    listeners: []
  };
  const quick = {
    battery: { percent: 64, charging: false },
    wifi: { connected: true, ssid: 'Home network', signal: 82 },
    brightness,
    volume,
    plans: plans.length ? plans : [
      { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced', active: true },
      { guid: '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', name: 'High performance', active: false }
    ]
  };
  const launcher = {
    getQuickSettings: async options => { calls.push(['quick:get', options]); return quick; },
    setQuickSetting: async (kind, value) => { calls.push(['quick:set', kind, value]); return true; },
    getPrefs: async () => { calls.push(['prefs:get']); return { ...prefs }; },
    setPref: async (key, value) => { calls.push(['prefs:set', key, value]); prefs[key] = value; return true; },
    getUpdateStatus: async () => ({ currentVersion: '0.6.0' }),
    getStorageOverview: async () => ({ drives: [{ root: 'C:\\', free: 182e9, total: 1e12 }] }),
    checkForUpdates: async () => { calls.push(['checkForUpdates']); return { state: 'current' }; },
    copyDiagnostics: async () => { calls.push(['copyDiagnostics']); },
    exportSettings: async () => { calls.push(['exportSettings']); },
    importSettings: async () => { calls.push(['importSettings']); }
  };
  const window = {
    launcher, navigator: { getGamepads: () => [] },
    gTheme: () => theme,
    gSetTheme: id => { calls.push(['gSetTheme', id]); theme = id; },
    gThemes: CONSOLES.concat('helix').map(id => ({ id, name: id })),
    saveSettingsForm: async options => { calls.push(['saveSettingsForm', options]); return {}; },
    performAction: async (action) => { calls.push(['performAction', action]); },
    showSettingsPage: page => { calls.push(['showSettingsPage', page]); },
    setFocusedElement: element => { calls.push(['setFocusedElement', element.id]); },
    formatBytes: bytes => `${Math.round(bytes / 1e9)} GB`,
    showToast: () => {},
    Event: FakeEvent, CustomEvent: FakeEvent
  };
  const state = {
    games: [
      { id: 'steam:1', title: 'Forza Horizon 5', provider: 'Steam' },
      { id: 'steam:2', title: 'Hades', provider: 'Steam' },
      { id: 'app:1', title: 'Discord', isApp: true }
    ],
    gFriends: { status: 'ready', online: 3, friends: [] },
    steamApiKeyConfigured: false,
    epicHelperPath: ''
  };
  const context = vm.createContext({ window, document, navigator: window.navigator, state, console, setTimeout, clearTimeout });
  vm.runInContext(source, context, { filename: 'garrison-settings-registry.js' });
  return { api: window.gSettings, calls, events, prefs, elements, window, getTheme: () => theme };
}

function eventFor(events, name, id) {
  return events.find(event => event.type === name && (!id || event.detail?.id === id));
}

(async () => {
  const { api, calls, events, elements } = createHarness();

  // ---------- Shape: every entry is complete ----------
  assert.ok(api, 'window.gSettings exists');
  assert.ok(Array.isArray(api.entries) && api.entries.length >= 35, `expected a full registry, got ${api.entries?.length}`);
  assert.equal(new Set(api.entries.map(entry => entry.id)).size, api.entries.length, 'entry ids are unique');
  for (const entry of api.entries) {
    const where = `entry ${entry.id}`;
    assert.equal(typeof entry.id, 'string', `${where} has an id`);
    assert.ok(entry.id.length > 0, `${where} id is not empty`);
    assert.ok(KINDS.includes(entry.kind), `${where} has a valid kind (${entry.kind})`);
    assert.equal(typeof entry.get, 'function', `${where} has get()`);
    assert.equal(typeof entry.set, 'function', `${where} has set()`);
    assert.equal(typeof entry.available, 'function', `${where} has available()`);
    assert.ok(entry.label && typeof entry.label.default === 'string' && entry.label.default.length, `${where} has default wording`);
    assert.equal(typeof await entry.available(), 'boolean', `${where} available() returns a boolean`);
    if (entry.kind === 'slider') {
      for (const key of ['min', 'max', 'step']) assert.ok(Number.isFinite(entry[key]), `${where} has a numeric ${key}`);
      assert.ok(entry.min < entry.max && entry.step > 0, `${where} has a usable range`);
    }
    if (entry.kind === 'choice') {
      assert.ok(Array.isArray(entry.options), `${where} options is an array`);
      for (const option of entry.options) {
        assert.equal(typeof option.value, 'string', `${where} option value is a string`);
        assert.equal(typeof option.label, 'string', `${where} option "${option.value}" has a label`);
      }
      if (!entry.options.length) assert.equal(typeof entry.getOptions, 'function', `${where} has dynamic getOptions()`);
      const options = await api.options(entry.id);
      assert.ok(Array.isArray(options), `${where} gSettings.options() returns a list`);
    }
  }

  // ---------- Console layouts: every row names a real id ----------
  assert.deepEqual(Object.keys(api.layouts).sort(), CONSOLES.slice().sort(), 'every console has a layout, Helix does not');
  for (const console of CONSOLES) {
    const pages = api.layout(console);
    assert.ok(Array.isArray(pages) && pages.length, `${console} has pages`);
    const pageIds = new Set();
    for (const page of pages) {
      assert.ok(!pageIds.has(page.id), `${console} page ids are unique (${page.id})`);
      pageIds.add(page.id);
      assert.equal(typeof page.title, 'string', `${console}/${page.id} has a title`);
      assert.ok(Array.isArray(page.rows) && page.rows.length, `${console}/${page.id} has rows`);
      for (const row of page.rows) {
        assert.ok(row && typeof row === 'object', `${console}/${page.id} rows are objects`);
        assert.equal(typeof row.id, 'string', `${console}/${page.id} every row names an id`);
        assert.ok(api.entry(row.id), `${console}/${page.id} row "${row.id}" is a real registry id`);
        assert.ok(api.label(row.id, console), `${console}/${page.id} row "${row.id}" has ${console} wording`);
      }
    }
  }
  // The plan's console-native wording really is per console.
  assert.equal(api.label('volume', 'ps3'), 'Volume');
  assert.equal(api.label('ps3ThemeColour', 'series'), 'Theme Colour', 'missing console wording falls back to the default');
  assert.equal(api.label('brightness', 'wii'), 'Screen Brightness');

  // ---------- get / set through the real IPC, and the g-setting-change event ----------
  assert.equal(await api.get('volume'), 45);
  await api.set('volume', 70);
  assert.deepEqual(calls.find(call => call[0] === 'quick:set'), ['quick:set', 'volume', 70], 'volume uses quick:set');
  assert.equal(await api.get('volume'), 70, 'volume reads back the new level');
  assert.ok(eventFor(events, 'g-setting-change', 'volume'), 'volume fires g-setting-change');
  await api.set('mute', true);
  assert.deepEqual(calls.filter(call => call[0] === 'quick:set').at(-1), ['quick:set', 'mute', true]);

  assert.equal(await api.get('theme'), 'helix');
  await api.set('theme', 'ps3');
  assert.equal(await api.get('theme'), 'ps3');
  assert.ok(calls.some(call => call[0] === 'gSetTheme' && call[1] === 'ps3'), 'theme goes through the theme picker');
  assert.ok(eventFor(events, 'g-setting-change', 'theme'));

  // A toggle goes through the launcher's own input + its save path, not a second copy of the mapping.
  assert.equal(await api.get('soundEffects'), true);
  await api.set('soundEffects', false);
  assert.deepEqual(elements['sound-toggle'].dispatched, ['input', 'change'], 'the launcher input receives input/change');
  assert.ok(calls.some(call => call[0] === 'saveSettingsForm' && call[1].close === false), 'the form save path is used');
  assert.equal(elements['sound-toggle'].checked, false);
  assert.equal(await api.get('soundEffects'), false, 'the toggle reads back');
  assert.ok(eventFor(events, 'g-setting-change', 'soundEffects'));

  // A slider is clamped to its control's range before it is stored.
  await api.set('uiScale', 999);
  assert.equal(elements['ui-scale'].value, '150');
  assert.equal(await api.get('uiScale'), 150);
  await api.set('tileRadius', 13);
  assert.equal(elements['tile-radius'].value, '14', 'sliders snap to their step');

  // Prefs are written through prefs:set and read back through the cached copy the clocks use.
  await api.set('screensaverDelay', 10);
  assert.ok(calls.some(call => call[0] === 'prefs:set' && call[1] === 'screensaverDelay' && call[2] === 10), 'screensaverDelay is persisted');
  assert.equal(api.cached('screensaverDelay'), 10);
  await api.set('clockFormat', '24h');
  assert.equal(api.cached('clockFormat'), '24h');
  const clock = api.formatClock(new Date(2026, 9, 18, 21, 5));
  assert.match(clock, /21[:.]05/, `24-hour clock formats as 21:05 (got ${clock})`);
  assert.doesNotMatch(clock, /am|pm/i);
  await api.set('dateOrder', 'dmy');
  assert.equal(api.formatDate(new Date(2026, 9, 18)), '18/10');
  await api.set('dateOrder', 'mdy');
  assert.equal(api.formatDate(new Date(2026, 9, 18)), '10/18');
  await api.set('dateOrder', 'locale');
  assert.ok(api.formatDate(new Date(2026, 9, 18)).length >= 3);

  // Choices refuse values the underlying capability does not accept.
  await assert.rejects(() => api.set('clockFormat', '25h'), /Unknown value/);
  await assert.rejects(() => api.set('unit-test-nope', 1), /Unknown setting/);
  await assert.rejects(() => api.set('appVersion', '9.9'), /read-only/, 'read-only facts refuse set()');

  // Power plans are discovered, not hard-coded.
  const planOptions = await api.options('powerPlan');
  assert.equal(planOptions.length, 2);
  assert.equal(planOptions[0].label, 'Balanced');
  await api.set('powerPlan', planOptions[1].value);
  assert.deepEqual(calls.filter(call => call[0] === 'quick:set').at(-1), ['quick:set', 'plan', planOptions[1].value]);

  // Actions use the launcher's existing buttons/IPC and report real status.
  assert.equal(await api.get('steamAccount'), 'Not set up');
  await api.set('steamAccount', null);
  assert.ok(calls.some(call => call[0] === 'performAction' && call[1] === 'settings'), 'account setup opens the launcher Settings');
  assert.ok(calls.some(call => call[0] === 'showSettingsPage' && call[1] === 'services'));
  assert.ok(calls.some(call => call[0] === 'setFocusedElement' && call[1] === 'steam-api-key'));
  await api.set('checkForUpdates', null);
  assert.ok(calls.some(call => call[0] === 'checkForUpdates'), 'Check for updates falls back to the existing IPC');
  await api.set('launcherSettings', null);
  assert.ok(calls.some(call => call[0] === 'performAction' && call[1] === 'settings'), 'Advanced (launcher) opens the real dialog');

  // Read-only facts are real values.
  assert.equal(await api.get('appVersion'), '0.6.0');
  assert.equal(await api.get('wifi'), 'Home network · 82%');
  assert.equal(await api.get('battery'), '64% · On battery');
  assert.equal(await api.get('freeDisk'), '182 GB free on C:\\');
  assert.equal(await api.get('libraryCounts'), '2 games · 1 app');
  assert.equal(await api.get('friendsOnline'), '3 online');
  assert.equal(await api.get('controllerStatus'), 'Not connected');

  // Settings whose consumer lands later are honestly unavailable until it does.
  assert.equal(await api.available('menuMusic'), false, 'menu music waits for the audio engine (task A1)');
  assert.equal(await api.available('menuMusicVolume'), false);
  assert.equal(await api.available('screenLayout3ds'), false, 'the 3DS layout waits for D1');
  assert.equal(await api.available('clockFormat'), true, 'the clocks read the clock setting today');
  assert.equal(await api.available('screensaverDelay'), true, 'the screen saver reads its delay today');
  assert.equal(await api.available('notifyFriends'), true, 'the friend toast reads its toggle today');
  assert.equal(await api.available('ps3ThemeColour'), true, 'the XMB tint reads its colour today');
  // A form control whose prerequisite is missing (Include uninstalled games without an API key) is unavailable.
  assert.equal(await api.available('showUninstalledSteam'), false, 'no Steam Web API key means the row is unavailable');
  elements['steam-api-key'].value = 'ABC123';
  assert.equal(await api.available('showUninstalledSteam'), true, 'the row comes back when the prerequisite is set');
  elements['steam-api-key'].value = '';
  assert.equal(await api.available('showUninstalledEpic'), false, 'no Legendary helper means the Epic row is unavailable');

  // ---------- available() is honest about this PC ----------
  const laptop = createHarness({ brightness: 70 });
  assert.equal(await laptop.api.available('brightness'), true, 'a laptop/handheld has brightness');
  await laptop.api.set('brightness', 55);
  assert.deepEqual(laptop.calls.filter(call => call[0] === 'quick:set').at(-1), ['quick:set', 'brightness', 55]);

  const desktop = createHarness({ brightness: null });
  assert.equal(await desktop.api.available('brightness'), false, 'a desktop has no brightness control');
  assert.equal(await desktop.api.available('volume'), true, 'a desktop still has volume');
  assert.equal(await desktop.api.get('brightness'), null);

  const noAudio = createHarness({ volume: null, brightness: null });
  assert.equal(await noAudio.api.available('volume'), false, 'no audio device means no volume row');
  assert.equal(await noAudio.api.available('mute'), false);

  console.log(`settings-registry tests passed: ${api.entries.length} entries, ${CONSOLES.length} console layouts`);
})().catch(error => { console.error(error); process.exit(1); });
