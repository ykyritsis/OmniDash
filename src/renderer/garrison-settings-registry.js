// Settings registry: one source of truth for every setting the launcher can actually change.
//
// The console settings shells (docs/NEXT-LEVEL-PLAN.md §2.2, tasks S2–S5) draw their rows from here instead of
// hard-coded text. Each entry wraps the real control — the same IPC, or the same launcher input, fired the same
// way the launcher's own Settings dialog fires it — so a console row can never say "Dolby Digital" while the
// machine does something else. A capability this PC does not have (brightness on a desktop, no music engine)
// reports available() === false and the shells leave its row out.
//
// Entry shape (plan §2.1):
//   { id, kind: 'slider' | 'toggle' | 'choice' | 'action' | 'info', min, max, step,
//     options: [{ value, label }], get: async () => value, set: async value => {},
//     available: async () => bool, label: { default, ps3, ps4, wii, '3ds', series, one, x360 } }
// Dynamic choices (power plans, the accent swatches, backgrounds, themes) use getOptions() because the list is
// only known at run time; gSettings.options(id) resolves either form.
//
// API:
//   gSettings.entries                 every entry, in menu order
//   gSettings.entry(id)               one entry (or null)
//   gSettings.get(id)                 current value
//   gSettings.set(id, value)          change it; fires 'g-setting-change' { id, value, kind }
//   gSettings.available(id)           can this setting do anything here?
//   gSettings.options(id)             [{ value, label }]
//   gSettings.label(id, console)      the console's wording, falling back to the default
//   gSettings.layouts                 per-console page and row order (rows name registry ids)
//   gSettings.layout(console)         one console's pages
//   gSettings.cached(id)              last persisted pref value, for clocks and other synchronous code
//   gSettings.ready                   promise resolved when the saved prefs have been read
//   gSettings.formatClock(date)       the clock format the player chose
//   gSettings.formatDate(date, opts)  the date order the player chose
//   gSettings.refresh()               re-read the saved prefs
(() => {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;

  // Prefs this file adds, with the same defaults as src/main.cjs SETTINGS_DEFAULTS. Menu music and its volume
  // are read by the shared audio engine (window.gAudio); the 3DS screen layout is read by window.g3dsLayout
  // in garrison-theme-retro.js (task D1), which applies it to the two-screen dashboard live.
  const DEFAULTS = {
    clockFormat: '12h', dateOrder: 'locale', enterButton: 'x', nintendoLayout: false,
    menuMusic: true, menuMusicVolume: 60, ps3GameAudio: false, screensaverDelay: 4,
    notifyFriends: true, notifyDownloads: true, notifyAchievements: true,
    screenLayout3ds: 'stacked', ps3ThemeColour: 'month',
    pauseDownloadsWhilePlaying: true, controllerVibration: true
  };
  const PS3_COLOURS = [
    { value: 'month', label: 'By month' }, { value: '#3d8fd6', label: 'Blue' }, { value: '#6c9d2f', label: 'Green' },
    { value: '#8d4fb3', label: 'Purple' }, { value: '#b8302d', label: 'Red' }, { value: '#c9a227', label: 'Gold' }
  ];

  // ---------- Shared helpers ----------
  const qs = selector => {
    try { return typeof document !== 'undefined' ? document.querySelector(selector) : null; } catch { return null; }
  };
  const qsa = selector => {
    try { return typeof document !== 'undefined' ? [...document.querySelectorAll(selector)] : []; } catch { return []; }
  };
  // app.js keeps its state in a top-level const (so it is a global binding, not a window property).
  const appState = () => {
    try { if (typeof state !== 'undefined' && state) return state; } catch { /* Not loaded yet. */ }
    return root.state || null;
  };
  const emit = (name, detail) => {
    try {
      if (typeof document === 'undefined' || typeof root.CustomEvent !== 'function') return;
      document.dispatchEvent(new root.CustomEvent(name, { detail, bubbles: true }));
    } catch { /* A missing event target must never break a setting change. */ }
  };
  const has = (object, key) => Boolean(object && Object.prototype.hasOwnProperty.call(object, key));

  function numberValue(value, min, max, step) {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('Choose a number.');
    let result = Math.max(min, Math.min(max, number));
    // Snap to the control's own step grid so a console shell can never store a value its slider can't show.
    if (step) result = min + Math.round((result - min) / step) * step;
    return Number(result.toFixed(6));
  }

  // ---------- Saved prefs (settings.json through the existing prefs:get / prefs:set path) ----------
  let prefCache = {}, prefAt = 0, prefPromise = null;
  function mergePrefs(saved) {
    if (!saved || typeof saved !== 'object') return;
    for (const [key, value] of Object.entries(saved)) if (value !== undefined) prefCache[key] = value;
    prefAt = Date.now();
  }
  function pref(id) {
    return has(prefCache, id) ? prefCache[id] : DEFAULTS[id];
  }
  function readPrefs(force = false) {
    if (typeof root.launcher?.getPrefs !== 'function') return Promise.resolve(prefCache);
    // A short cache keeps a screen with ten rows from asking ten times while it paints.
    if (!force && prefAt && Date.now() - prefAt < 2000) return Promise.resolve(prefCache);
    if (prefPromise) return prefPromise;
    prefPromise = root.launcher.getPrefs()
      .then(saved => { mergePrefs(saved); return prefCache; })
      .catch(() => prefCache)
      .finally(() => { prefPromise = null; });
    return prefPromise;
  }

  // ---------- Quick settings (Windows volume, mute, brightness and power plan) ----------
  // One read feeds every quick-settings row and is reused for a few seconds: the main process asks Windows,
  // which takes about a second, so a screen that asks per row would crawl.
  let quickData = null, quickAt = 0, quickPromise = null;
  function readQuick(force = false) {
    if (typeof root.launcher?.getQuickSettings !== 'function') return Promise.resolve(null);
    if (!force && quickData && Date.now() - quickAt < 5000) return Promise.resolve(quickData);
    if (quickPromise) return quickPromise;
    quickPromise = root.launcher.getQuickSettings({ volume: true })
      .then(data => { quickData = data || null; quickAt = Date.now(); return quickData; })
      .catch(() => null)
      .finally(() => { quickPromise = null; });
    return quickPromise;
  }
  const quickVolume = async () => (await readQuick())?.volume || null;
  const quickPlans = async () => (await readQuick())?.plans || [];
  // Optimistic cache: the Windows call takes a moment, but the row the player just moved must not jump back.
  function noteQuick(kind, value) {
    if (!quickData) return;
    if (kind === 'volume' && quickData.volume) quickData.volume.level = value;
    if (kind === 'mute' && quickData.volume) quickData.volume.muted = Boolean(value);
    if (kind === 'brightness') quickData.brightness = value;
    if (kind === 'plan') for (const plan of quickData.plans || []) plan.active = plan.guid === value;
    quickAt = Date.now();
  }

  // ---------- The launcher's own Settings form ----------
  // Form-backed settings go through the input the launcher itself uses: set its value, fire input/change so the
  // live preview runs, then save with the existing form save path. The mapping (percent to 0.9…1.3, checkbox to
  // boolean) stays in app.js, not here.
  function formInput(inputId) { return qs('#' + inputId); }
  async function persistForm() {
    if (typeof root.saveSettingsForm !== 'function') throw new Error('The launcher settings form is not ready.');
    await root.saveSettingsForm({ close: false });
  }
  function formEntry({ id, kind, inputId, label, min, max, step, enabled }) {
    const read = () => {
      const input = formInput(inputId);
      if (!input) return null;
      return kind === 'toggle' ? Boolean(input.checked) : Number(input.value);
    };
    return {
      id, kind, min, max, step, label,
      get: async () => read(),
      // A disabled control (Show uninstalled without a Steam Web API key, for example) cannot do anything.
      // The form only paints its disabled state when Settings opens, so `enabled` checks the same prerequisite
      // from the app's own data instead of trusting a stale attribute.
      available: async () => {
        const input = formInput(inputId);
        if (!input) return false;
        return typeof enabled === 'function' ? enabled() : !input.disabled;
      },
      set: async value => {
        const input = formInput(inputId);
        if (!input) throw new Error(`The launcher's ${id} control is unavailable.`);
        if (kind === 'toggle') input.checked = Boolean(value);
        else input.value = String(numberValue(value, min, max, step));
        input.dispatchEvent(new root.Event('input', { bubbles: true }));
        input.dispatchEvent(new root.Event('change', { bubbles: true }));
        await persistForm();
        return read();
      }
    };
  }

  // ---------- Pref-backed settings (prefs:set writes them into settings.json) ----------
  function prefEntry({ id, kind, label, options = [], min, max, step, enabled }) {
    return {
      id, kind, min, max, step, options, label,
      get: async () => { await readPrefs(); return pref(id); },
      // A pref is persisted for its consumer. A row whose consumer does not exist yet is honestly unavailable
      // instead of being a switch that does nothing (the 3DS layout's consumer is window.g3dsLayout, task D1).
      available: async () => typeof root.launcher?.setPref === 'function' && (typeof enabled !== 'function' || enabled()),
      set: async value => {
        if (typeof root.launcher?.setPref !== 'function') throw new Error('Saved settings are unavailable.');
        let applied;
        if (kind === 'toggle') applied = Boolean(value);
        else if (kind === 'choice') {
          if (!options.some(option => option.value === value)) throw new Error(`Unknown value for ${id}.`);
          applied = value;
        } else applied = numberValue(value, min, max, step);
        await root.launcher.setPref(id, applied);
        prefCache[id] = applied;
        prefAt = Date.now();
        return applied;
      }
    };
  }

  // ---------- Actions: the same buttons the launcher already has ----------
  // Clicking the real row keeps its confirmation dialog, toasts and file pickers instead of re-implementing them.
  function clickAction(selector, fallback) {
    return async () => {
      const control = qs(selector);
      if (control) { control.click(); return null; }
      if (typeof fallback === 'function') return fallback();
      throw new Error('That control is not available yet.');
    };
  }
  function actionEntry({ id, label, run, status }) {
    let last = null;
    return {
      id, kind: 'action', label,
      get: async () => (typeof status === 'function' ? status() : last),
      set: async value => { last = await run(value); return last; },
      available: async () => true
    };
  }

  // ---------- Account setup (the launcher's Settings → Game libraries fields) ----------
  // The field wins, then the app's own "this is configured" flag (Steam keys and Epic helpers are detected
  // during the library scan, before Settings has ever been opened).
  function accountStatus(fieldId, appFlag) {
    const field = qs('#' + fieldId);
    if (field && field.value.trim()) return 'Set up';
    return appFlag && appState()?.[appFlag] ? 'Set up' : 'Not set up';
  }
  async function openAccountField(fieldId, appFlag) {
    if (typeof root.performAction === 'function') await root.performAction('settings', null);
    if (typeof root.showSettingsPage === 'function') root.showSettingsPage('services');
    const field = qs('#' + fieldId);
    if (!field) throw new Error('That account control is unavailable.');
    const details = typeof field.closest === 'function' ? field.closest('details') : null;
    if (details) details.open = true;
    if (typeof root.setFocusedElement === 'function') root.setFocusedElement(field, { scroll: true });
    else field.focus?.();
    return accountStatus(fieldId, appFlag);
  }
  const fieldStatus = (fieldId, appFlag) => () => accountStatus(fieldId, appFlag);

  // ---------- Entries ----------
  const entries = [
    // Sound
    {
      id: 'volume', kind: 'slider', min: 0, max: 100, step: 5,
      label: { default: 'Volume' },
      get: async () => (await quickVolume())?.level ?? null,
      set: async value => {
        const level = numberValue(value, 0, 100, 5);
        await root.launcher.setQuickSetting('volume', level);
        noteQuick('volume', level);
        return level;
      },
      available: async () => Boolean(await quickVolume())
    },
    {
      id: 'mute', kind: 'toggle',
      label: { default: 'Mute' },
      get: async () => Boolean((await quickVolume())?.muted),
      set: async value => {
        await root.launcher.setQuickSetting('mute', Boolean(value));
        noteQuick('mute', Boolean(value));
        return Boolean(value);
      },
      available: async () => Boolean(await quickVolume())
    },
    formEntry({ id: 'soundEffects', kind: 'toggle', inputId: 'sound-toggle', label: { default: 'Interface sounds' } }),
    prefEntry({ id: 'menuMusic', kind: 'toggle', label: { default: 'Menu music', ps4: 'Home Music', wii: 'Wii Menu Music', '3ds': 'Theme Music' }, enabled: () => typeof root.gAudio?.menuMusic === 'function' }),
    prefEntry({ id: 'menuMusicVolume', kind: 'slider', min: 0, max: 100, step: 5, label: { default: 'Menu music volume' }, enabled: () => typeof root.gAudio?.menuMusic === 'function' }),
    // PS3 only: after resting on a game, play its trailer audio quietly with no video (the console's SND0).
    prefEntry({ id: 'ps3GameAudio', kind: 'toggle', label: { default: 'Game trailer audio', ps3: 'Game Audio (SND0)' }, enabled: () => typeof root.gAudio?.gameAudio === 'function' }),

    // Display and comfort
    {
      id: 'brightness', kind: 'slider', min: 0, max: 100, step: 5,
      label: { default: 'Brightness', wii: 'Screen Brightness' },
      get: async () => (await readQuick())?.brightness ?? null,
      set: async value => {
        const level = numberValue(value, 0, 100, 5);
        await root.launcher.setQuickSetting('brightness', level);
        noteQuick('brightness', level);
        return level;
      },
      // A desktop has no WMI brightness control; quick:get reports null there and the shells hide the row.
      available: async () => {
        const quick = await readQuick();
        return Boolean(quick && quick.brightness !== null && quick.brightness !== undefined);
      }
    },
    {
      id: 'powerPlan', kind: 'choice', options: [],
      label: { default: 'Power mode', ps3: 'Power Save Settings', ps4: 'Power Save Settings' },
      get: async () => (await quickPlans()).find(plan => plan.active)?.guid ?? '',
      getOptions: async () => (await quickPlans()).map(plan => ({ value: plan.guid, label: plan.name })),
      set: async value => {
        const plans = await quickPlans();
        if (!plans.some(plan => plan.guid === value)) throw new Error('Unknown power plan.');
        await root.launcher.setQuickSetting('plan', value);
        noteQuick('plan', value);
        return value;
      },
      available: async () => (await quickPlans()).length > 0
    },
    formEntry({ id: 'uiScale', kind: 'slider', inputId: 'ui-scale', min: 75, max: 150, step: 5, label: { default: 'Screen size', ps3: 'Display Area', ps4: 'Display Area' } }),
    formEntry({ id: 'textSize', kind: 'slider', inputId: 'text-size', min: 100, max: 130, step: 5, label: { default: 'Text size' } }),
    formEntry({ id: 'tileRadius', kind: 'slider', inputId: 'tile-radius', min: 0, max: 24, step: 2, label: { default: 'Tile corners' } }),
    formEntry({ id: 'reducedMotion', kind: 'toggle', inputId: 'reduced-motion-toggle', label: { default: 'Reduced motion' } }),
    formEntry({ id: 'highContrastFocus', kind: 'toggle', inputId: 'high-contrast-focus-toggle', label: { default: 'High-contrast focus' } }),
    formEntry({ id: 'fullscreen', kind: 'toggle', inputId: 'fullscreen-toggle', label: { default: 'Fullscreen on launch' } }),
    // The launcher's #startup-toggle is the Xbox boot animation, not a start-with-Windows switch; label it as it is.
    formEntry({ id: 'startupAnimation', kind: 'toggle', inputId: 'startup-toggle', label: { default: 'Startup animation' } }),

    // Scrolling and library pictures
    formEntry({ id: 'showUninstalledSteam', kind: 'toggle', inputId: 'show-uninstalled-toggle', label: { default: 'Include uninstalled Steam games' }, enabled: () => Boolean(appState()?.steamApiKeyConfigured || qs('#steam-api-key')?.value.trim()) }),
    formEntry({ id: 'showUninstalledEpic', kind: 'toggle', inputId: 'show-uninstalled-epic-toggle', label: { default: 'Include uninstalled Epic games' }, enabled: () => Boolean(appState()?.epicHelperPath || qs('#legendary-path')?.value.trim()) }),
    formEntry({ id: 'shuffleHomeScreenshots', kind: 'toggle', inputId: 'shuffle-home-screenshots-toggle', label: { default: 'Shuffle home backgrounds' } }),
    formEntry({ id: 'randomScreenshotBackground', kind: 'toggle', inputId: 'random-screenshot-background-toggle', label: { default: 'Shuffle game page screenshots' } }),

    // Theme, colour and background
    {
      id: 'theme', kind: 'choice', options: [],
      label: { default: 'Theme' },
      get: async () => (typeof root.gTheme === 'function' ? root.gTheme() : null),
      getOptions: async () => (root.gThemes || []).map(theme => ({ value: theme.id, label: theme.name })),
      set: async value => {
        if (typeof root.gSetTheme !== 'function') throw new Error('The theme picker is not ready.');
        if (!(root.gThemes || []).some(theme => theme.id === value)) throw new Error('Unknown theme.');
        root.gSetTheme(value);
        return value;
      },
      available: async () => typeof root.gSetTheme === 'function'
    },
    {
      id: 'accent', kind: 'choice', options: [],
      label: { default: 'Colour', series: 'Colour', one: 'Colour', x360: 'Colour' },
      get: async () => qs('.g-accent-section .g-accent-option.on')?.dataset.gAccent || qsa('.g-accent-section .g-accent-option')[0]?.dataset.gAccent || '',
      getOptions: async () => qsa('.g-accent-section .g-accent-option').map(button => ({ value: button.dataset.gAccent, label: button.getAttribute('aria-label') || button.dataset.gAccent })),
      // The swatch's own click handler writes g-accent:<theme> and repaints, exactly as a press does.
      set: async value => {
        const option = qsa('.g-accent-section .g-accent-option').find(button => button.dataset.gAccent === value);
        if (!option) throw new Error('That colour is not available on this theme.');
        option.click();
        return value;
      },
      available: async () => Boolean(qs('.g-accent-section') && !qs('.g-accent-section').hidden && qsa('.g-accent-section .g-accent-option').length)
    },
    {
      id: 'background', kind: 'choice', options: [],
      label: { default: 'Background', '3ds': 'Theme' },
      get: async () => qs('.g-bg-section .g-bg-option.on')?.dataset.gBg || 'default',
      getOptions: async () => qsa('.g-bg-section .g-bg-option').map(button => ({
        value: button.dataset.gBg,
        label: button.querySelector('span:last-child')?.textContent?.trim() || button.dataset.gBg
      })),
      set: async value => {
        const option = qsa('.g-bg-section .g-bg-option').find(button => button.dataset.gBg === value);
        if (!option) throw new Error('That background is not available on this theme.');
        option.click();
        return value;
      },
      available: async () => Boolean(qs('.g-bg-section') && !qs('.g-bg-section').hidden && qsa('.g-bg-section .g-bg-option').length)
    },
    prefEntry({
      id: 'ps3ThemeColour', kind: 'choice', options: PS3_COLOURS,
      label: { default: 'Theme Colour', ps3: 'Theme Colour' }
    }),

    // Clock, saver and notifications (read by every console clock and by the existing toasts)
    prefEntry({ id: 'clockFormat', kind: 'choice', options: [{ value: '12h', label: '12-hour' }, { value: '24h', label: '24-hour' }], label: { default: 'Clock format', ps4: 'Time Format', wii: 'Clock', '3ds': 'Time Format' } }),
    prefEntry({ id: 'dateOrder', kind: 'choice', options: [{ value: 'locale', label: 'Match Windows' }, { value: 'dmy', label: 'Day / Month / Year' }, { value: 'mdy', label: 'Month / Day / Year' }], label: { default: 'Date format', wii: 'Date' } }),
    prefEntry({ id: 'screensaverDelay', kind: 'slider', min: 1, max: 60, step: 1, label: { default: 'Screen saver delay', series: 'Screen dimming after', one: 'Screen dimming after', ps3: 'Screensaver' } }),
    prefEntry({ id: 'notifyFriends', kind: 'toggle', label: { default: 'Friends online notifications' } }),
    prefEntry({ id: 'notifyDownloads', kind: 'toggle', label: { default: 'Download notifications' } }),
    prefEntry({ id: 'notifyAchievements', kind: 'toggle', label: { default: 'Achievement notifications' } }),

    // Controller and input
    prefEntry({ id: 'controllerVibration', kind: 'toggle', label: { default: 'Controller vibration', wii: 'Rumble' } }),
    prefEntry({ id: 'pauseDownloadsWhilePlaying', kind: 'toggle', label: { default: 'Pause downloads while I play' } }),
    prefEntry({ id: 'enterButton', kind: 'choice', options: [{ value: 'x', label: '✕ confirm · ○ back' }, { value: 'o', label: '○ confirm · ✕ back' }], label: { default: 'Enter button', ps3: 'Enter Button', ps4: 'Enter Button' } }),
    prefEntry({ id: 'nintendoLayout', kind: 'toggle', label: { default: 'Nintendo button layout', wii: 'Button Layout', '3ds': 'Button Layout' } }),
    prefEntry({ id: 'screenLayout3ds', kind: 'choice', options: [{ value: 'stacked', label: 'Stacked' }, { value: 'side-by-side', label: 'Side by side' }, { value: 'large-top', label: 'Large top screen' }], label: { default: 'Screen layout', '3ds': 'Screen Layout' }, enabled: () => typeof root.g3dsLayout === 'function' }),

    // Actions (the launcher's existing controls)
    actionEntry({ id: 'profile', label: { default: 'Profile name and gamerpic' }, run: async () => {
      if (typeof root.performAction !== 'function') throw new Error('The profile editor is not ready.');
      await root.performAction('avatar-picker', null);
      return null;
    } }),
    actionEntry({ id: 'steamAccount', label: { default: 'Steam account' }, run: () => openAccountField('steam-api-key', 'steamApiKeyConfigured'), status: fieldStatus('steam-api-key', 'steamApiKeyConfigured') }),
    actionEntry({ id: 'epicAccount', label: { default: 'Epic account' }, run: () => openAccountField('legendary-path', 'epicHelperPath'), status: fieldStatus('legendary-path', 'epicHelperPath') }),
    actionEntry({ id: 'artworkKey', label: { default: 'Artwork services' }, run: () => openAccountField('sgdb-key'), status: fieldStatus('sgdb-key') }),
    actionEntry({ id: 'checkForUpdates', label: { default: 'Check for updates', ps3: 'System Update', ps4: 'System Update', wii: 'Wii System Update', '3ds': 'System Update', x360: 'System Update' }, run: clickAction('#g-update-check', () => root.launcher.checkForUpdates()) }),
    actionEntry({ id: 'copyDiagnostics', label: { default: 'Copy diagnostics' }, run: clickAction('[data-action="g-support-copy"]', () => root.launcher.copyDiagnostics()) }),
    actionEntry({ id: 'exportSettings', label: { default: 'Export settings' }, run: clickAction('[data-action="g-support-export"]', () => root.launcher.exportSettings()) }),
    actionEntry({ id: 'importSettings', label: { default: 'Restore settings' }, run: clickAction('[data-action="g-support-import"]', () => root.launcher.importSettings()) }),
    actionEntry({ id: 'resetLauncherData', label: { default: 'Reset launcher data', ps3: 'Restore Default Settings' }, run: clickAction('[data-action="reset-launcher-data"]') }),
    actionEntry({ id: 'launcherSettings', label: { default: 'Advanced (launcher)' }, run: async () => {
      if (typeof root.performAction !== 'function') throw new Error('The launcher settings dialog is not ready.');
      await root.performAction('settings', null);
      return null;
    } }),

    // Real read-only information
    {
      id: 'wifi', kind: 'info',
      label: { default: 'Wi-Fi', ps3: 'Wireless LAN', wii: 'Internet', '3ds': 'Internet', x360: 'Network' },
      get: async () => {
        const wifi = (await readQuick())?.wifi;
        if (!wifi) return 'Unavailable';
        return wifi.connected ? `${wifi.ssid || 'Connected'}${wifi.signal !== null ? ` · ${wifi.signal}%` : ''}` : 'Not connected';
      },
      set: async () => { throw new Error('Wi-Fi is read-only.'); },
      available: async () => Boolean((await readQuick())?.wifi)
    },
    {
      id: 'battery', kind: 'info',
      label: { default: 'Battery' },
      get: async () => {
        const battery = (await readQuick())?.battery;
        return battery ? `${battery.percent}% · ${battery.charging ? 'Charging' : 'On battery'}` : 'Unavailable';
      },
      set: async () => { throw new Error('The battery is read-only.'); },
      available: async () => Boolean((await readQuick())?.battery)
    },
    {
      id: 'appVersion', kind: 'info',
      label: { default: 'Version' },
      get: async () => {
        try { return (await root.launcher.getUpdateStatus())?.currentVersion || ''; } catch { return ''; }
      },
      set: async () => { throw new Error('The version is read-only.'); },
      available: async () => typeof root.launcher?.getUpdateStatus === 'function'
    },
    {
      id: 'freeDisk', kind: 'info',
      label: { default: 'Free disk space', ps3: 'Free Space', ps4: 'Storage', x360: 'Storage', '3ds': 'Data Management' },
      get: async () => {
        try {
          const overview = await root.launcher.getStorageOverview();
          const drive = (overview?.drives || []).find(item => /^c:/i.test(item.root)) || (overview?.drives || []).find(item => item.free !== null);
          if (!drive || drive.free === null || drive.free === undefined) return 'Unavailable';
          const size = typeof root.formatBytes === 'function' ? root.formatBytes(drive.free) : `${Math.round(drive.free / 1e9)} GB`;
          return `${size} free on ${drive.root}`;
        } catch { return 'Unavailable'; }
      },
      set: async () => { throw new Error('Free space is read-only.'); },
      available: async () => typeof root.launcher?.getStorageOverview === 'function'
    },
    {
      id: 'libraryCounts', kind: 'info',
      label: { default: 'Library' },
      get: async () => {
        const library = appState()?.games || [];
        const games = library.filter(game => !game.isApp).length;
        const apps = library.length - games;
        return `${games} game${games === 1 ? '' : 's'} · ${apps} app${apps === 1 ? '' : 's'}`;
      },
      set: async () => { throw new Error('The library count is read-only.'); },
      available: async () => Boolean(appState())
    },
    {
      id: 'friendsOnline', kind: 'info',
      label: { default: 'Friends online' },
      get: async () => {
        const friends = appState()?.gFriends;
        if (!friends) return 'Unavailable';
        const online = Number(friends.online) || 0;
        return `${online} online`;
      },
      set: async () => { throw new Error('Friend status is read-only.'); },
      available: async () => Boolean(appState()?.gFriends)
    },
    {
      id: 'controllerStatus', kind: 'info',
      label: { default: 'Controller' },
      get: async () => {
        const pads = [...(root.navigator?.getGamepads?.() || [])].filter(pad => pad?.connected);
        const usable = typeof root.isUsableController === 'function' ? pads.filter(pad => root.isUsableController(pad)) : pads;
        return usable.length ? usable[0].id || `Controller ${usable[0].index + 1}` : 'Not connected';
      },
      set: async () => { throw new Error('Controller status is read-only.'); },
      available: async () => true
    }
  ];

  // ---------- Console layouts (plan §2.1 and §2.2) ----------
  // Each console names only its pages, their order and the registry ids in them. Wording stays on the entry's
  // label object, so every shell says "Sound Settings" the console's way without owning a second copy of it.
  const LAYOUTS = {
    series: [
      { id: 'general', title: 'General', rows: [{ id: 'fullscreen' }, { id: 'startupAnimation' }, { id: 'uiScale' }, { id: 'textSize' }, { id: 'highContrastFocus' }, { id: 'reducedMotion' }] },
      { id: 'display-sound', title: 'Display & sound', rows: [{ id: 'brightness' }, { id: 'volume' }, { id: 'mute' }, { id: 'soundEffects' }, { id: 'menuMusic' }, { id: 'menuMusicVolume' }, { id: 'powerPlan' }] },
      { id: 'personalization', title: 'Personalization', rows: [{ id: 'accent' }, { id: 'background' }, { id: 'screensaverDelay' }, { id: 'clockFormat' }, { id: 'dateOrder' }] },
      { id: 'devices', title: 'Devices & connections', rows: [{ id: 'controllerStatus' }, { id: 'controllerVibration' }] },
      { id: 'network', title: 'Network', rows: [{ id: 'wifi' }, { id: 'friendsOnline' }] },
      { id: 'notifications', title: 'Notifications', rows: [{ id: 'notifyFriends' }, { id: 'notifyDownloads' }, { id: 'notifyAchievements' }] },
      { id: 'account', title: 'Profile & system', rows: [{ id: 'profile' }, { id: 'steamAccount' }, { id: 'epicAccount' }, { id: 'artworkKey' }] },
      { id: 'system', title: 'System', rows: [{ id: 'appVersion' }, { id: 'freeDisk' }, { id: 'libraryCounts' }, { id: 'pauseDownloadsWhilePlaying' }, { id: 'checkForUpdates' }] },
      { id: 'advanced', title: 'Advanced (launcher)', rows: [{ id: 'launcherSettings' }] }
    ],
    one: [
      { id: 'network', title: 'Network', rows: [{ id: 'wifi' }, { id: 'friendsOnline' }] },
      { id: 'display-sound', title: 'Display & sound', rows: [{ id: 'brightness' }, { id: 'volume' }, { id: 'mute' }, { id: 'soundEffects' }, { id: 'menuMusic' }, { id: 'menuMusicVolume' }, { id: 'uiScale' }] },
      { id: 'preferences', title: 'Preferences', rows: [{ id: 'accent' }, { id: 'background' }, { id: 'screensaverDelay' }, { id: 'clockFormat' }, { id: 'dateOrder' }] },
      { id: 'ease', title: 'Ease of Access', rows: [{ id: 'textSize' }, { id: 'highContrastFocus' }, { id: 'reducedMotion' }] },
      { id: 'devices', title: 'Devices', rows: [{ id: 'controllerStatus' }, { id: 'controllerVibration' }] },
      { id: 'notifications', title: 'Notifications', rows: [{ id: 'notifyFriends' }, { id: 'notifyDownloads' }, { id: 'notifyAchievements' }] },
      { id: 'system', title: 'System', rows: [{ id: 'appVersion' }, { id: 'freeDisk' }, { id: 'libraryCounts' }, { id: 'powerPlan' }, { id: 'pauseDownloadsWhilePlaying' }, { id: 'fullscreen' }, { id: 'startupAnimation' }, { id: 'checkForUpdates' }] },
      { id: 'account', title: 'Account', rows: [{ id: 'profile' }, { id: 'steamAccount' }, { id: 'epicAccount' }, { id: 'artworkKey' }] },
      { id: 'advanced', title: 'Advanced (launcher)', rows: [{ id: 'launcherSettings' }] }
    ],
    x360: [
      { id: 'console', title: 'Console Settings', rows: [{ id: 'uiScale' }, { id: 'volume' }, { id: 'mute' }, { id: 'soundEffects' }, { id: 'menuMusic' }, { id: 'menuMusicVolume' }, { id: 'clockFormat' }, { id: 'dateOrder' }, { id: 'screensaverDelay' }] },
      { id: 'display', title: 'Display', rows: [{ id: 'accent' }, { id: 'background' }, { id: 'textSize' }, { id: 'reducedMotion' }] },
      { id: 'controllers', title: 'Controllers', rows: [{ id: 'controllerStatus' }, { id: 'controllerVibration' }] },
      { id: 'network', title: 'Network Settings', rows: [{ id: 'wifi' }, { id: 'friendsOnline' }] },
      { id: 'notifications', title: 'Notifications', rows: [{ id: 'notifyFriends' }, { id: 'notifyDownloads' }, { id: 'notifyAchievements' }] },
      { id: 'profile', title: 'Profile', rows: [{ id: 'profile' }, { id: 'steamAccount' }, { id: 'epicAccount' }, { id: 'artworkKey' }] },
      { id: 'storage', title: 'Storage', rows: [{ id: 'freeDisk' }, { id: 'libraryCounts' }] },
      { id: 'system', title: 'System', rows: [{ id: 'appVersion' }, { id: 'checkForUpdates' }, { id: 'pauseDownloadsWhilePlaying' }, { id: 'fullscreen' }, { id: 'startupAnimation' }] },
      { id: 'advanced', title: 'Advanced (launcher)', rows: [{ id: 'launcherSettings' }] }
    ],
    ps3: [
      { id: 'display', title: 'Display Settings', rows: [{ id: 'uiScale' }, { id: 'brightness' }, { id: 'fullscreen' }] },
      { id: 'sound', title: 'Sound Settings', rows: [{ id: 'volume' }, { id: 'mute' }, { id: 'soundEffects' }, { id: 'menuMusic' }, { id: 'menuMusicVolume' }, { id: 'ps3GameAudio' }] },
      { id: 'theme', title: 'Theme Settings', rows: [{ id: 'ps3ThemeColour' }, { id: 'background' }] },
      { id: 'time', title: 'Date and Time Settings', rows: [{ id: 'clockFormat' }, { id: 'dateOrder' }, { id: 'screensaverDelay' }] },
      { id: 'system', title: 'System Settings', rows: [{ id: 'appVersion' }, { id: 'freeDisk' }, { id: 'powerPlan' }, { id: 'checkForUpdates' }, { id: 'resetLauncherData' }] },
      { id: 'accessory', title: 'Accessory Settings', rows: [{ id: 'controllerStatus' }, { id: 'controllerVibration' }, { id: 'enterButton' }] },
      { id: 'network', title: 'Network Settings', rows: [{ id: 'wifi' }, { id: 'friendsOnline' }] },
      { id: 'notifications', title: 'Notification Settings', rows: [{ id: 'notifyFriends' }, { id: 'notifyDownloads' }, { id: 'notifyAchievements' }] },
      { id: 'game', title: 'Game Settings', rows: [{ id: 'pauseDownloadsWhilePlaying' }, { id: 'libraryCounts' }] },
      { id: 'account', title: 'Account Management', rows: [{ id: 'profile' }, { id: 'steamAccount' }, { id: 'epicAccount' }, { id: 'artworkKey' }] },
      { id: 'advanced', title: 'Advanced (launcher)', rows: [{ id: 'launcherSettings' }] }
    ],
    ps5: [
      { id: 'display', title: 'Display', rows: [{ id: 'uiScale' }, { id: 'brightness' }, { id: 'fullscreen' }] },
      { id: 'sound', title: 'Sound', rows: [{ id: 'volume' }, { id: 'mute' }, { id: 'soundEffects' }, { id: 'menuMusic' }, { id: 'menuMusicVolume' }] },
      { id: 'network', title: 'Network', rows: [{ id: 'wifi' }, { id: 'friendsOnline' }] },
      { id: 'system', title: 'System', rows: [{ id: 'clockFormat' }, { id: 'dateOrder' }, { id: 'screensaverDelay' }, { id: 'appVersion' }, { id: 'freeDisk' }, { id: 'libraryCounts' }, { id: 'powerPlan' }, { id: 'pauseDownloadsWhilePlaying' }, { id: 'checkForUpdates' }, { id: 'resetLauncherData' }] },
      { id: 'accessibility', title: 'Accessibility', rows: [{ id: 'textSize' }, { id: 'highContrastFocus' }, { id: 'reducedMotion' }] },
      { id: 'account', title: 'Account', rows: [{ id: 'profile' }, { id: 'steamAccount' }, { id: 'epicAccount' }, { id: 'artworkKey' }] },
      { id: 'advanced', title: 'Advanced (launcher)', rows: [{ id: 'launcherSettings' }] }
    ],
    ps4: [
      { id: 'account', title: 'Account Management', rows: [{ id: 'profile' }, { id: 'steamAccount' }, { id: 'epicAccount' }, { id: 'artworkKey' }] },
      { id: 'notifications', title: 'Notifications', rows: [{ id: 'notifyFriends' }, { id: 'notifyDownloads' }, { id: 'notifyAchievements' }] },
      { id: 'devices', title: 'Devices', rows: [{ id: 'controllerStatus' }, { id: 'controllerVibration' }, { id: 'enterButton' }] },
      { id: 'sound-screen', title: 'Sound & Screen', rows: [{ id: 'volume' }, { id: 'mute' }, { id: 'soundEffects' }, { id: 'menuMusic' }, { id: 'menuMusicVolume' }, { id: 'brightness' }, { id: 'uiScale' }] },
      { id: 'network', title: 'Network', rows: [{ id: 'wifi' }, { id: 'friendsOnline' }] },
      { id: 'themes', title: 'Themes', rows: [{ id: 'background' }] },
      { id: 'system', title: 'System', rows: [{ id: 'clockFormat' }, { id: 'dateOrder' }, { id: 'screensaverDelay' }, { id: 'appVersion' }, { id: 'freeDisk' }, { id: 'libraryCounts' }, { id: 'powerPlan' }, { id: 'pauseDownloadsWhilePlaying' }, { id: 'fullscreen' }, { id: 'checkForUpdates' }, { id: 'resetLauncherData' }] },
      { id: 'accessibility', title: 'Accessibility', rows: [{ id: 'textSize' }, { id: 'highContrastFocus' }, { id: 'reducedMotion' }] },
      { id: 'advanced', title: 'Advanced (launcher)', rows: [{ id: 'launcherSettings' }] }
    ],
    wii: [
      { id: 'page-1', title: 'Wii Settings · Page 1', rows: [{ id: 'uiScale' }, { id: 'brightness' }, { id: 'volume' }, { id: 'mute' }, { id: 'menuMusic' }, { id: 'menuMusicVolume' }] },
      { id: 'page-2', title: 'Wii Settings · Page 2', rows: [{ id: 'clockFormat' }, { id: 'dateOrder' }, { id: 'screensaverDelay' }, { id: 'soundEffects' }] },
      { id: 'page-3', title: 'Wii Settings · Page 3', rows: [{ id: 'nintendoLayout' }, { id: 'controllerVibration' }, { id: 'controllerStatus' }] },
      { id: 'internet', title: 'Internet', rows: [{ id: 'wifi' }, { id: 'friendsOnline' }] },
      { id: 'message-board', title: 'Wii Message Board', rows: [{ id: 'notifyFriends' }, { id: 'notifyDownloads' }, { id: 'notifyAchievements' }] },
      { id: 'system', title: 'Wii System', rows: [{ id: 'appVersion' }, { id: 'freeDisk' }, { id: 'pauseDownloadsWhilePlaying' }, { id: 'fullscreen' }, { id: 'checkForUpdates' }, { id: 'resetLauncherData' }] },
      { id: 'advanced', title: 'Advanced (launcher)', rows: [{ id: 'launcherSettings' }] }
    ],
    '3ds': [
      { id: 'internet', title: 'Internet Settings', rows: [{ id: 'wifi' }, { id: 'friendsOnline' }] },
      { id: 'data', title: 'Data Management', rows: [{ id: 'freeDisk' }, { id: 'libraryCounts' }] },
      { id: 'profile', title: 'Profile', rows: [{ id: 'profile' }] },
      { id: 'date-time', title: 'Date & Time', rows: [{ id: 'clockFormat' }, { id: 'dateOrder' }, { id: 'screensaverDelay' }] },
      { id: 'sound', title: 'Sound', rows: [{ id: 'volume' }, { id: 'mute' }, { id: 'soundEffects' }, { id: 'menuMusic' }, { id: 'menuMusicVolume' }] },
      { id: 'display', title: 'Display', rows: [{ id: 'brightness' }, { id: 'uiScale' }, { id: 'screenLayout3ds' }] },
      { id: 'theme', title: 'Theme', rows: [{ id: 'background' }] },
      { id: 'controls', title: 'Controls', rows: [{ id: 'nintendoLayout' }, { id: 'controllerVibration' }, { id: 'controllerStatus' }] },
      { id: 'notifications', title: 'Notifications', rows: [{ id: 'notifyFriends' }, { id: 'notifyDownloads' }, { id: 'notifyAchievements' }] },
      { id: 'system', title: 'System', rows: [{ id: 'appVersion' }, { id: 'checkForUpdates' }, { id: 'pauseDownloadsWhilePlaying' }, { id: 'resetLauncherData' }] },
      { id: 'advanced', title: 'Advanced (launcher)', rows: [{ id: 'launcherSettings' }] }
    ]
  };

  // ---------- API ----------
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  function entry(id) { return byId.get(id) || null; }
  function requireEntry(id) {
    const found = entry(id);
    if (!found) throw new Error(`Unknown setting: ${id}`);
    return found;
  }
  async function options(id) {
    const found = requireEntry(id);
    if (typeof found.getOptions !== 'function') return (found.options || []).slice();
    try { return (await found.getOptions()) || []; } catch { return []; }
  }
  async function set(id, value) {
    const found = requireEntry(id);
    let applied = value;
    if (found.kind === 'slider') applied = numberValue(value, found.min, found.max, found.step);
    else if (found.kind === 'toggle') applied = Boolean(value);
    else if (found.kind === 'choice') {
      const list = await options(id);
      if (list.length && !list.some(option => option.value === value)) throw new Error(`Unknown value for ${id}.`);
    }
    applied = await found.set(applied);
    emit('g-setting-change', { id, value: applied, kind: found.kind });
    return applied;
  }
  function label(id, console) {
    const found = entry(id);
    if (!found) return '';
    const labels = found.label || {};
    return labels[console] || labels.default || id;
  }
  function layout(console) { return LAYOUTS[console] || []; }
  function cached(id) {
    if (has(prefCache, id)) return prefCache[id];
    return has(DEFAULTS, id) ? DEFAULTS[id] : undefined;
  }
  // The consoles' clocks all read these two, so the setting changes every clock at once.
  function formatClock(date = new Date()) {
    const value = date instanceof Date ? date : new Date(date);
    const twentyFour = cached('clockFormat') === '24h';
    try {
      return twentyFour
        ? value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        : value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch { return value.toTimeString().slice(0, 5); }
  }
  function formatDate(date = new Date(), { year = false } = {}) {
    const value = date instanceof Date ? date : new Date(date);
    const order = cached('dateOrder');
    const day = value.getDate(), month = value.getMonth() + 1;
    if (order === 'dmy' || order === 'mdy') {
      const first = String(order === 'dmy' ? day : month).padStart(2, '0');
      const second = String(order === 'dmy' ? month : day).padStart(2, '0');
      return year ? `${first}/${second}/${value.getFullYear()}` : `${first}/${second}`;
    }
    try {
      return value.toLocaleDateString([], year ? { day: 'numeric', month: 'numeric', year: 'numeric' } : { day: 'numeric', month: 'numeric' });
    } catch { return `${day}/${month}${year ? `/${value.getFullYear()}` : ''}`; }
  }
  async function refresh() {
    await readPrefs(true);
    emit('g-settings-ready', { prefs: { ...prefCache } });
    return { ...prefCache };
  }

  root.gSettings = {
    entries: entries.slice(),
    entry,
    ids: () => entries.map(item => item.id),
    get: async id => requireEntry(id).get(),
    set,
    available: async id => Boolean(await requireEntry(id).available()),
    options,
    label,
    layouts: LAYOUTS,
    layout,
    cached,
    formatClock,
    formatDate,
    refresh,
    defaults: { ...DEFAULTS }
  };

  // Read the saved prefs once so clocks and toasts have real values before a console screen is opened.
  root.gSettings.ready = (async () => {
    if (typeof root.launcher?.getPrefs !== 'function') return { ...prefCache };
    try {
      mergePrefs(await root.launcher.getPrefs());
      emit('g-settings-ready', { prefs: { ...prefCache } });
    } catch { /* The launcher can start without saved settings. */ }
    return { ...prefCache };
  })();
})();
