// Settings the way each console named and grouped them. The pages are the launcher's own; only the
// sidebar's names, order and group headings change with the theme, and Helix gets its own labels back.
//  - Series: General, Account, Devices & connections, Preferences, Accessibility, System.
//  - One (2013): Network, Display & sound, Preferences, Ease of Access, System, Privacy & online safety, Account.
//  - 360: the System Settings list (Console Settings, Network Settings, Storage...) in lowercase-free 360 wording.
//  - PS3: the XMB's Settings column. PS4: Settings. Wii: the three Wii Settings pages. 3DS: System Settings.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const sidebar = document.querySelector('#settings-dialog .settings-sidebar');
  if (!sidebar) return;
  // [page id, label, group]
  const ERAS = {
    series: [['personalization', 'Personalization', 'General'], ['audio', 'Volume & audio output', 'General'], ['g-account', 'Profile & system', 'Account'], ['g-privacy', 'Privacy & online safety', 'Account'],
      ['g-input', 'Controllers & headsets', 'Devices & connections'], ['g-streaming', 'Remote features', 'Devices & connections'], ['g-notifications', 'Notifications', 'Preferences'], ['services', 'Manage games & add-ons', 'Preferences'],
      ['accessibility', 'Accessibility', 'Accessibility'], ['g-language', 'Language & location', 'System'], ['g-storage', 'Storage devices', 'System']],
    one: [['g-streaming', 'Network', ''], ['audio', 'Display & sound', ''], ['personalization', 'Preferences', ''], ['accessibility', 'Ease of Access', ''], ['g-input', 'Devices', ''],
      ['g-storage', 'System', ''], ['g-language', 'Language & location', ''], ['g-notifications', 'Notifications', ''], ['g-privacy', 'Privacy & online safety', ''], ['g-account', 'Account', ''], ['services', 'Games & apps', '']],
    x360: [['personalization', 'Console Settings', 'System'], ['g-streaming', 'Network Settings', 'System'], ['g-storage', 'Storage', 'System'], ['g-input', 'Controllers', 'System'],
      ['audio', 'Audio', 'System'], ['g-language', 'Language and Locale', 'System'], ['g-account', 'Profile', 'Account'], ['g-privacy', 'Privacy', 'Account'], ['g-notifications', 'Notifications', 'Preferences'],
      ['accessibility', 'Ease of Access', 'Preferences'], ['services', 'Game Libraries', 'Preferences']],
    // The XMB's Settings column, top to bottom.
    ps3: [['services', 'Game Settings', ''], ['accessibility', 'Display Settings', ''], ['audio', 'Sound Settings', ''], ['personalization', 'Theme Settings', ''],
      ['g-language', 'Date and Time Settings', ''], ['g-storage', 'System Settings', ''], ['g-input', 'Accessory Settings', ''], ['g-streaming', 'Network Settings', ''],
      ['g-privacy', 'Security Settings', ''], ['g-notifications', 'Notification Settings', ''], ['g-account', 'Account Management', '']],
    // Settings as the PS4 lists them.
    ps4: [['g-account', 'Account Management', 'Account'], ['g-privacy', 'Privacy & Security', 'Account'], ['g-notifications', 'Notifications', 'Account'],
      ['g-input', 'Devices', 'Devices'], ['audio', 'Sound & Screen', 'Devices'], ['g-streaming', 'Network', 'Devices'], ['personalization', 'Themes', 'Devices'],
      ['g-storage', 'System', 'System'], ['g-language', 'Language', 'System'], ['accessibility', 'Accessibility', 'System'], ['services', 'Application Data', 'System']],
    // Wii Options: the three pages of Wii Settings, then data management and the channels.
    wii: [['audio', 'Wii Settings · Page 1', 'Wii Settings'], ['g-language', 'Calendar', 'Wii Settings'], ['g-streaming', 'Internet', 'Wii Settings'],
      ['personalization', 'Screen', 'Wii Settings'], ['g-input', 'Sensor Bar', 'Wii Settings'], ['g-privacy', 'Parental Controls', 'Wii Settings'],
      ['accessibility', 'Wii Remote Settings', 'Wii Settings'], ['g-notifications', 'WiiConnect24', 'Data'], ['g-storage', 'Data Management', 'Data'],
      ['services', 'Wii Channels', 'Data'], ['g-account', 'Wii Shop Account', 'Data']],
    // System Settings as the 3DS lays them out.
    '3ds': [['g-streaming', 'Internet Settings', 'System'], ['g-privacy', 'Parental Controls', 'System'], ['g-storage', 'Data Management', 'System'],
      ['g-account', 'Profile', 'System'], ['g-language', 'Date & Time', 'System'], ['audio', 'Sound', 'System'], ['accessibility', 'Region Settings', 'System'],
      ['personalization', 'Theme', 'System'], ['g-input', 'amiibo Settings', 'System'], ['g-notifications', 'Notifications', 'System'], ['services', 'Software', 'System']]
  };
  const original = new Map();
  function apply() {
    const tabs = [...sidebar.querySelectorAll('.settings-tab[data-settings-tab]')];
    if (!tabs.length) return;
    tabs.forEach((tab, index) => { if (!original.has(tab)) original.set(tab, { label: tab.textContent, index }); });
    sidebar.querySelectorAll('.g-settings-group').forEach(el => el.remove());
    const era = ERAS[theme()];
    const anchor = sidebar.querySelector('.g-settings-player') || sidebar.firstElementChild;
    if (!era) {
      [...original].sort((a, b) => a[1].index - b[1].index).forEach(([tab, info]) => { tab.textContent = info.label; tab.hidden = false; sidebar.append(tab); });
      return;
    }
    let group = null, last = anchor;
    const listed = new Set();
    for (const [id, label, heading] of era) {
      const tab = tabs.find(item => item.dataset.settingsTab === id);
      if (!tab) continue;
      if (heading && heading !== group) {
        const header = document.createElement('span');
        header.className = 'g-settings-group';
        header.textContent = heading;
        last.after(header); last = header; group = heading;
      }
      tab.textContent = label; tab.hidden = false;
      last.after(tab); last = tab; listed.add(tab);
    }
    // Pages a console never had keep their place at the end.
    tabs.filter(tab => !listed.has(tab)).forEach(tab => { tab.textContent = original.get(tab).label; last.after(tab); last = tab; });
  }
  new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  document.querySelector('#settings-dialog')?.addEventListener('toggle', apply);
  setTimeout(apply, 0);

  // =========================== Xbox era settings (task S4) ===========================
  // Series and One keep the launcher's two-pane Garrison list, restyled as the era's dashboard: the console's
  // page rail on the left and that page's rows on the right. The 360 gets the blade-free Metro "System Settings"
  // screen instead: one light grey list of pages, then that page's rows. Every row, value and choice comes from
  // window.gSettings; a row whose available() is false is never drawn, and the layout's last page is always
  // Advanced (launcher), which opens the launcher's own Settings dialog. Nothing here is hand-written data.
  const XSET_CONSOLES = ['series', 'one', 'x360'];
  const xsetTheme = () => (XSET_CONSOLES.includes(theme()) ? theme() : '');
  const XSET_BRAND = {
    series: { name: 'Xbox Series X|S', kicker: 'Settings' },
    one: { name: 'Xbox One', kicker: 'Settings' },
    x360: { name: 'Xbox 360', kicker: 'System Settings' }
  };
  // The page a launcher Settings tab opens when a dashboard tile asks for it (the 360 hub's tiles, the One's
  // settings shortcuts). Unknown pages fall through to the launcher's own dialog.
  const XSET_LAUNCHER_PAGES = {
    series: { 'g-account': 'account', personalization: 'personalization', audio: 'display-sound', 'g-input': 'devices', 'g-streaming': 'network', 'g-notifications': 'notifications', 'g-storage': 'system', accessibility: 'general', services: 'system', 'g-language': 'system', 'g-privacy': 'account' },
    one: { 'g-account': 'account', personalization: 'preferences', audio: 'display-sound', 'g-input': 'devices', 'g-streaming': 'network', 'g-notifications': 'notifications', 'g-storage': 'system', accessibility: 'ease', services: 'system', 'g-language': 'system', 'g-privacy': 'account' },
    x360: { 'g-account': 'profile', personalization: 'display', audio: 'console', 'g-input': 'controllers', 'g-streaming': 'network', 'g-notifications': 'notifications', 'g-storage': 'storage', accessibility: 'display', services: 'system', 'g-language': 'system', 'g-privacy': 'profile' }
  };
  // Icons only ever name a gIcon glyph; the shells never invent a row's picture.
  const XSET_PAGE_GLYPHS = {
    general: 'settings', 'display-sound': 'volume', personalization: 'color', devices: 'controller', network: 'globe',
    notifications: 'bell', account: 'contact', system: 'settings', advanced: 'settings', preferences: 'color',
    ease: 'ease', console: 'settings', display: 'tv', controllers: 'controller', profile: 'contact', storage: 'drive'
  };
  const XSET_ROW_GLYPHS = {
    volume: 'volume', mute: 'volume', soundEffects: 'volume', menuMusic: 'stream', menuMusicVolume: 'volume',
    brightness: 'tv', uiScale: 'tv', textSize: 'language', tileRadius: 'grid', reducedMotion: 'ease',
    highContrastFocus: 'show', fullscreen: 'fullscreen', startupAnimation: 'play', powerPlan: 'power',
    theme: 'color', accent: 'color', background: 'photo', ps3ThemeColour: 'color', clockFormat: 'language',
    dateOrder: 'language', screensaverDelay: 'tv', notifyFriends: 'bell', notifyDownloads: 'bell',
    notifyAchievements: 'bell', controllerStatus: 'controller', controllerVibration: 'controller',
    pauseDownloadsWhilePlaying: 'download', enterButton: 'controller', nintendoLayout: 'controller',
    screenLayout3ds: 'fullscreen', profile: 'contact', steamAccount: 'shop', epicAccount: 'shop',
    artworkKey: 'photo', checkForUpdates: 'refresh', copyDiagnostics: 'info', exportSettings: 'download',
    importSettings: 'download', resetLauncherData: 'delete', launcherSettings: 'settings', wifi: 'globe',
    battery: 'power', appVersion: 'info', freeDisk: 'drive', libraryCounts: 'library', friendsOnline: 'friends'
  };
  const xsetEscape = value => String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const xsetIcon = name => (typeof gIcon === 'function' ? gIcon(XSET_ROW_GLYPHS[name] || 'settings') : '');
  const xsetPageIcon = id => (typeof gIcon === 'function' ? gIcon(XSET_PAGE_GLYPHS[id] || 'settings') : '');
  // Units as the consoles printed them beside a value.
  const XSET_UNITS = { uiScale: '%', textSize: '%', volume: '%', brightness: '%', menuMusicVolume: '%', tileRadius: ' px', screensaverDelay: ' min' };
  // The launcher's Settings form saves every field at once, so a registry form row must fill the form from disk
  // first or it would write the dialog's unopened defaults over the player's accounts and display settings.
  const XSET_FORM_ROWS = new Set([
    'uiScale', 'textSize', 'tileRadius', 'reducedMotion', 'highContrastFocus', 'fullscreen', 'startupAnimation',
    'soundEffects', 'showUninstalledSteam', 'showUninstalledEpic', 'shuffleHomeScreenshots', 'randomScreenshotBackground'
  ]);
  let xsetFormReady = null;
  function xsetSyncLauncherForm() {
    if (xsetFormReady) return xsetFormReady;
    xsetFormReady = (async () => {
      if (typeof window.launcher?.getSettings !== 'function') return;
      const settings = await window.launcher.getSettings();
      const value = (id, next) => { const el = document.getElementById(id); if (el) el.value = String(next); };
      const checked = (id, on) => { const el = document.getElementById(id); if (el) el.checked = Boolean(on); };
      const region = document.getElementById('player-region');
      if (region) {
        const savedRegion = settings.region || 'auto';
        if (![...region.options].some(option => option.value === savedRegion)) region.add(new Option(savedRegion, savedRegion));
        region.value = savedRegion;
      }
      value('sgdb-key', settings.steamGridDbKey || '');
      value('steam-api-key', settings.steamApiKey || '');
      value('steam-id64', settings.steamId64 || '');
      checked('show-uninstalled-toggle', settings.showUninstalledSteam);
      checked('steam-family-toggle', settings.includeSteamFamily !== false);
      checked('show-uninstalled-epic-toggle', settings.showUninstalledEpic);
      checked('uninstalled-ubisoft', settings.showUninstalledUbisoft);
      checked('uninstalled-ea', settings.showUninstalledEA);
      checked('uninstalled-battlenet', settings.showUninstalledBattleNet);
      value('legendary-path', settings.legendaryPath || '');
      checked('fullscreen-toggle', settings.fullscreen);
      checked('sound-toggle', settings.soundEffects !== false);
      checked('startup-toggle', settings.startupAnimation !== false);
      value('ui-scale', Math.round((settings.uiScale || 1) * 100));
      value('tile-radius', settings.tileRadius ?? 8);
      checked('reduced-motion-toggle', settings.reducedMotion);
      value('text-size', Math.round((settings.textScale || 1) * 100));
      checked('high-contrast-focus-toggle', settings.highContrastFocus);
      checked('random-screenshot-background-toggle', settings.useRandomScreenshotBackground !== false);
      checked('shuffle-home-screenshots-toggle', settings.shuffleHomeScreenshots !== false);
      if (typeof renderDuplicateSettings === 'function') renderDuplicateSettings(settings);
      try { if (typeof previewPersonalization === 'function') previewPersonalization(); } catch { /* Preview only. */ }
      try {
        if (typeof state !== 'undefined' && state) state.settingsOriginal = {
          uiScale: Number(document.querySelector('#ui-scale')?.value) / 100,
          tileRadius: Number(document.querySelector('#tile-radius')?.value),
          reducedMotion: Boolean(document.querySelector('#reduced-motion-toggle')?.checked),
          textScale: Number(document.querySelector('#text-size')?.value) / 100,
          highContrastFocus: Boolean(document.querySelector('#high-contrast-focus-toggle')?.checked),
          steamGridDbKey: document.querySelector('#sgdb-key')?.value.trim() || '',
          libraryKey: typeof librarySettingsKey === 'function' ? librarySettingsKey() : ''
        };
      } catch { /* The launcher's own state is optional here. */ }
    })().catch(() => { xsetFormReady = null; });
    return xsetFormReady;
  }

  let xset = null, xsetScanToken = 0, xsetRowsToken = 0, xsetReloadTimer = 0, xsetAnimTimer = 0;
  let xsetKeepAlive = 0, xsetClockTimer = 0, xsetLauncherOpening = false;
  const xsetScans = new Map();
  // Xbox keeps the standard A/B layout: app.js's swapsConfirmBack() applies the Enter Button pref
  // ('enterButton') only to PS3/PS4 and the Nintendo layout to Wii/3DS, so A/B are the buttons that really
  // confirm and back here. The hints print those, never a PlayStation glyph the pad cannot send.
  const xsetGlyphs = () => ({ enter: 'A', back: 'B' });
  const xsetPlay = kind => { try { interfaceAudio?.play?.(kind); } catch { /* Sound is optional. */ } };

  function xsetText(row, value) {
    if (value === null || value === undefined || value === '') return '';
    if (row.kind === 'toggle') return value ? 'On' : 'Off';
    if (row.kind === 'choice') {
      const option = (row.options || []).find(item => item.value === value);
      if (option) return option.label;
      if (value === 'default') return 'Default';
      return String(value);
    }
    if (row.kind === 'slider') {
      const number = Number(value);
      return `${Number.isFinite(number) ? number : String(value)}${XSET_UNITS[row.id] || ''}`;
    }
    return String(value);
  }
  function xsetPercent(row, value) {
    const min = Number.isFinite(Number(row.min)) ? Number(row.min) : 0;
    const max = Number.isFinite(Number(row.max)) ? Number(row.max) : 100;
    const span = max - min || 1;
    return Math.max(0, Math.min(100, ((Number(value) - min) / span) * 100));
  }
  // Ask once which rows this PC can really honour; a page with nothing live is not a place the player can go.
  async function xsetScanPages(consoleId, force = false) {
    const g = window.gSettings;
    if (!g?.layout) return [];
    const cached = xsetScans.get(consoleId);
    if (!force && cached && Date.now() - cached.at < 30000) return cached.pages;
    const pages = [];
    for (const page of g.layout(consoleId)) {
      const live = [];
      for (const row of page.rows) {
        let available = false;
        try { available = await g.available(row.id); } catch { available = false; }
        if (available) live.push({ id: row.id });
      }
      if (live.length) pages.push({ id: page.id, title: page.title, rows: live });
    }
    xsetScans.set(consoleId, { at: Date.now(), pages });
    return pages;
  }
  async function xsetLoadRows(page, consoleId) {
    const g = window.gSettings;
    if (!g || !page) return [];
    if (page.rows.some(row => XSET_FORM_ROWS.has(row.id))) await xsetSyncLauncherForm();
    const rows = [];
    for (const row of page.rows) {
      let available = true;
      try { available = await g.available(row.id); } catch { available = false; }
      if (!available) continue;
      const entry = g.entry(row.id);
      if (!entry) continue;
      let value = null;
      try { value = await g.get(row.id); } catch { value = null; }
      let options = [];
      if (entry.kind === 'choice') { try { options = await g.options(row.id); } catch { options = []; } }
      rows.push({ id: row.id, kind: entry.kind, label: g.label(row.id, consoleId), min: entry.min, max: entry.max, step: entry.step, value, options });
    }
    return rows;
  }

  function xsetBuild() {
    let shell = document.getElementById('g-xset');
    if (shell) return shell;
    shell = document.createElement('section');
    shell.id = 'g-xset';
    shell.hidden = true;
    shell.setAttribute('aria-label', 'Settings');
    shell.innerHTML = `<div class="g-xset-bg" aria-hidden="true"></div>
      <div class="g-xset-frame">
        <aside class="g-xset-rail">
          <div class="g-xset-brand"><img class="g-xset-mark" src="assets/xbox.svg" alt="" /><div><strong></strong><small></small></div></div>
          <nav class="g-xset-pages" aria-label="Settings pages"></nav>
          <p class="g-xset-railnote" aria-hidden="true"></p>
        </aside>
        <main class="g-xset-main">
          <header class="g-xset-head">
            <button class="g-xset-back focusable" type="button" data-action="g-xset-back" aria-label="Back"><span aria-hidden="true">‹</span></button>
            <div class="g-xset-heading"><p class="g-xset-kicker"></p><h2 class="g-xset-title"></h2></div>
            <time class="g-xset-clock"></time>
          </header>
          <div class="g-xset-body">
            <div class="g-xset-rows" role="list"></div>
            <p class="g-xset-note" role="status"></p>
          </div>
          <footer class="g-xset-hints" aria-hidden="true"></footer>
        </main>
      </div>
      <div class="g-xset-overlay" hidden><div class="g-xset-dialog" role="dialog" aria-modal="true" aria-label="Setting"></div></div>`;
    document.body.append(shell);
    return shell;
  }

  function xsetFocus() {
    const shell = document.getElementById('g-xset');
    if (!xset || !shell) return;
    let target = null;
    if (xset.overlay) {
      target = xset.overlay.mode === 'choice' ? shell.querySelector('.g-xset-option.on') || shell.querySelector('.g-xset-option')
        : xset.overlay.mode === 'slider' ? shell.querySelector('[data-action="g-xset-commit"]')
        : shell.querySelector('[data-action="g-xset-cancel"]');
    } else if (xset.console === 'x360' && xset.level === 'pages') {
      target = shell.querySelector('.g-xset-page-row.sel');
    } else if (xset.console !== 'x360' && xset.level === 'pages') {
      target = shell.querySelector('.g-xset-page.sel');
    } else {
      target = shell.querySelector('.g-xset-row.sel') || shell.querySelector('.g-xset-row');
    }
    if (!target) target = shell.querySelector('.g-xset-back');
    if (!target) return;
    try { setFocusedElement(target, { scroll: false }); } catch { /* The launcher focus model may be mid-paint. */ }
  }

  function xsetRender() {
    const state = xset;
    if (!state) return;
    const shell = xsetBuild();
    const brand = XSET_BRAND[state.console];
    const glyphs = xsetGlyphs();
    shell.dataset.console = state.console;
    shell.dataset.level = state.level;
    shell.dataset.anim = state.anim || '';
    shell.querySelector('.g-xset-brand strong').textContent = brand.name;
    shell.querySelector('.g-xset-brand small').textContent = brand.kicker;
    shell.querySelector('.g-xset-railnote').textContent = state.console === 'x360' ? '' : 'OmniDash';
    const pages = state.pages || [];
    const pageEl = shell.querySelector('.g-xset-pages');
    const pageKey = pages.map(page => `${page.id}:${page.title}`).join('|');
    if (pageEl.dataset.key !== pageKey) {
      pageEl.dataset.key = pageKey;
      pageEl.innerHTML = pages.map((page, index) => `<button class="g-xset-page focusable" type="button" data-action="g-xset-rail" data-page="${xsetEscape(page.id)}" data-index="${index}" aria-label="${xsetEscape(page.title)}">
        <span class="g-xset-icon" aria-hidden="true">${xsetPageIcon(page.id)}</span><span class="g-xset-pagelabel">${xsetEscape(page.title)}</span><span class="g-xset-chevron" aria-hidden="true">›</span>
      </button>`).join('');
    }
    [...pageEl.children].forEach((el, index) => {
      const page = pages[index];
      el.classList.toggle('on', Boolean(page && state.page && page.id === state.page.id));
      el.classList.toggle('sel', state.level === 'pages' && index === state.focus);
    });
    const x360Root = state.console === 'x360' && state.level === 'pages';
    const title = x360Root ? 'System Settings' : (state.page?.title || 'Settings');
    shell.querySelector('.g-xset-kicker').textContent = brand.name;
    shell.querySelector('.g-xset-title').textContent = title;
    shell.querySelector('.g-xset-back').setAttribute('aria-label', state.level === 'pages' ? 'Close Settings' : 'Back');
    shell.querySelector('.g-xset-clock').textContent = window.gSettings?.formatClock ? window.gSettings.formatClock() : '';
    const rowsEl = shell.querySelector('.g-xset-rows');
    if (x360Root) {
      const key = 'pages|' + pageKey;
      if (rowsEl.dataset.key !== key) {
        rowsEl.dataset.key = key;
        rowsEl.innerHTML = pages.map((page, index) => `<button class="g-xset-row g-xset-page-row focusable" type="button" data-action="g-xset-page" data-page="${xsetEscape(page.id)}" data-index="${index}" role="listitem" aria-label="${xsetEscape(page.title)}">
          <span class="g-xset-icon" aria-hidden="true">${xsetPageIcon(page.id)}</span><span class="g-xset-label">${xsetEscape(page.title)}</span><span class="g-xset-chevron" aria-hidden="true">›</span>
        </button>`).join('');
      }
      [...rowsEl.children].forEach((el, index) => el.classList.toggle('sel', index === state.focus));
    } else {
      const rows = state.rows || [];
      const rowKey = `${state.page?.id || ''}|${state.loading ? 'load' : ''}|${state.error}|${rows.map(row => `${row.id}:${row.kind}:${row.value}`).join('|')}`;
      if (rowsEl.dataset.key !== rowKey) {
        rowsEl.dataset.key = rowKey;
        rowsEl.innerHTML = rows.map((row, index) => {
          const value = xsetText(row, row.value);
          const meter = row.kind === 'slider' ? `<span class="g-xset-meter" aria-hidden="true"><i style="width:${xsetPercent(row, row.value)}%"></i></span>` : '';
          const toggle = row.kind === 'toggle' ? `<span class="g-xset-switch${row.value ? ' on' : ''}" aria-hidden="true"><i></i></span>` : '';
          const chevron = row.kind === 'choice' || row.kind === 'action' ? '<span class="g-xset-chevron" aria-hidden="true">›</span>' : '';
          return `<button class="g-xset-row focusable" type="button" data-action="g-xset-row" data-row="${index}" data-setting-id="${xsetEscape(row.id)}" data-kind="${row.kind}" role="listitem" aria-label="${xsetEscape(row.label)}${value ? `, ${xsetEscape(value)}` : ''}">
            <span class="g-xset-icon" aria-hidden="true">${xsetIcon(row.id)}</span><span class="g-xset-label">${xsetEscape(row.label)}</span>${meter}<span class="g-xset-value">${xsetEscape(value)}</span>${toggle}${chevron}
          </button>`;
        }).join('');
      }
      [...rowsEl.children].forEach((el, index) => el.classList.toggle('sel', index === state.focus));
    }
    const note = state.error || (state.loading ? 'Reading settings…' : (!x360Root && !(state.rows || []).length ? 'Nothing on this page is available on this PC.' : ''));
    shell.querySelector('.g-xset-note').textContent = note;
    shell.querySelector('.g-xset-hints').innerHTML = `<span><b>${glyphs.enter}</b>${state.level === 'pages' ? 'Open' : 'Select'}</span><span><b>${glyphs.back}</b>${state.level === 'pages' ? 'Close' : 'Back'}</span>`;
    xsetRenderOverlay(shell);
  }

  function xsetRenderOverlay(shell) {
    const state = xset;
    const overlayEl = shell.querySelector('.g-xset-overlay');
    const dialog = shell.querySelector('.g-xset-dialog');
    const overlay = state?.overlay;
    overlayEl.hidden = !overlay;
    overlayEl.classList.toggle('open', Boolean(overlay));
    if (!overlay) { dialog.innerHTML = ''; return; }
    const glyphs = xsetGlyphs();
    const row = overlay.row;
    let body = '';
    if (overlay.mode === 'choice') {
      body = `<div class="g-xset-options" role="listbox" aria-label="${xsetEscape(row.label)}">${overlay.options.map((option, index) => `<button class="g-xset-option focusable${index === overlay.selected ? ' on' : ''}" type="button" role="option" aria-selected="${index === overlay.selected}" data-action="g-xset-option" data-option="${index}"><span>${xsetEscape(option.label)}</span>${index === overlay.selected ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>`;
    } else if (overlay.mode === 'slider') {
      const percent = xsetPercent(overlay, overlay.value);
      body = `<div class="g-xset-slider"><span class="g-xset-track"><i style="width:${percent}%"></i><b style="left:${percent}%"></b></span><strong>${xsetEscape(xsetText(row, overlay.value))}</strong></div>`;
    } else {
      body = `<p class="g-xset-info">${xsetEscape(xsetText(row, row.value) || 'Unavailable')}</p>`;
    }
    const hints = overlay.mode === 'info'
      ? `<button class="g-xset-action focusable" type="button" data-action="g-xset-cancel"><b>${glyphs.back}</b> Back</button>`
      : overlay.mode === 'slider'
        ? `<button class="g-xset-action focusable" type="button" data-action="g-xset-commit"><b>${glyphs.enter}</b> Set</button><button class="g-xset-action focusable" type="button" data-action="g-xset-cancel"><b>${glyphs.back}</b> Cancel</button>`
        : `<button class="g-xset-action focusable" type="button" data-action="g-xset-commit"><b>${glyphs.enter}</b> Select</button><button class="g-xset-action focusable" type="button" data-action="g-xset-cancel"><b>${glyphs.back}</b> Back</button>`;
    dialog.innerHTML = `<h3>${xsetEscape(row.label)}</h3>${body}<p class="g-xset-dialog-note">${overlay.error ? `<span class="g-xset-error">${xsetEscape(overlay.error)}</span>` : ''}${overlay.saving ? '<span class="g-xset-saving">Saving…</span>' : ''}</p><div class="g-xset-actions">${hints}</div>`;
  }

  function xsetScanAndShow() {
    const state = xset;
    if (!state) return;
    const token = ++xsetScanToken;
    state.loading = true;
    state.error = '';
    xsetRender();
    xsetScanPages(state.console).then(pages => {
      if (token !== xsetScanToken || xset !== state) return;
      state.pages = pages;
      state.loading = false;
      const wanted = state.pendingPage;
      state.pendingPage = null;
      const page = (wanted && pages.find(item => item.id === wanted)) || pages[0] || null;
      xsetRender();
      if (!page) { state.error = 'No settings are available on this PC right now.'; xsetRender(); return; }
      if (state.console === 'x360' && !wanted) { state.focus = Math.max(0, pages.indexOf(page)); xsetRender(); xsetFocus(); return; }
      state.focus = 0;
      state.level = 'rows';
      xsetLoadPage(page);
    }).catch(error => {
      if (token !== xsetScanToken || xset !== state) return;
      state.loading = false;
      state.error = error?.message || 'Could not read the settings on this PC.';
      xsetRender();
    });
  }

  function xsetLoadPage(page, { stay = false, animate = true } = {}) {
    const state = xset;
    if (!state || !page) return;
    const token = ++xsetRowsToken;
    const focusId = state.rows[state.focus]?.id;
    state.page = page;
    state.rows = [];
    state.loading = true;
    state.error = '';
    state.overlay = null;
    if (state.console !== 'x360' && !stay) state.level = 'rows';
    xsetRender();
    xsetLoadRows(page, state.console).then(rows => {
      if (token !== xsetRowsToken || xset !== state) return;
      state.rows = rows;
      state.loading = false;
      const kept = focusId ? rows.findIndex(row => row.id === focusId) : -1;
      state.focus = kept >= 0 ? kept : Math.min(state.focus, Math.max(0, rows.length - 1));
      if (animate) { state.anim = 'deep'; }
      xsetRender();
      if (animate) xsetAnimate();
      xsetFocus();
    }).catch(error => {
      if (token !== xsetRowsToken || xset !== state) return;
      state.loading = false;
      state.error = error?.message || 'Could not read these settings.';
      xsetRender();
    });
  }

  function xsetAnimate() {
    clearTimeout(xsetAnimTimer);
    xsetAnimTimer = setTimeout(() => {
      if (!xset) return;
      xset.anim = '';
      const shell = document.getElementById('g-xset');
      if (shell) shell.dataset.anim = '';
    }, 420);
  }

  function xsetOpen(consoleId = xsetTheme()) {
    if (!consoleId || xset) return;
    xset = {
      console: consoleId, level: consoleId === 'x360' ? 'pages' : 'rows', pages: null, page: null, rows: [],
      focus: 0, loading: true, error: '', overlay: null, anim: 'in', pendingPage: null, opener: document.activeElement
    };
    const shell = xsetBuild();
    document.body.classList.add('g-xset-open');
    shell.hidden = false;
    shell.dataset.anim = 'in';
    xsetAnimate();
    document.querySelector('main')?.setAttribute('inert', '');
    document.querySelector('.topbar')?.setAttribute('inert', '');
    clearInterval(xsetClockTimer);
    xsetClockTimer = setInterval(() => {
      const clock = document.querySelector('#g-xset .g-xset-clock');
      if (!clock || !xset) return;
      clock.textContent = window.gSettings?.formatClock ? window.gSettings.formatClock() : '';
    }, 15000);
    // The console dimmed its screen while idle, not while the player was reading Settings.
    clearInterval(xsetKeepAlive);
    xsetKeepAlive = setInterval(() => { try { window.gThemeSaver?.wake?.(); } catch { /* Optional. */ } }, 10000);
    xsetPlay('confirm');
    xsetScanAndShow();
    xsetFocus();
  }

  function xsetCloseSilently() {
    if (!xset) return;
    clearTimeout(xsetReloadTimer); xsetReloadTimer = 0;
    clearTimeout(xsetAnimTimer); xsetAnimTimer = 0;
    clearInterval(xsetKeepAlive); xsetKeepAlive = 0;
    clearInterval(xsetClockTimer); xsetClockTimer = 0;
    const shell = document.getElementById('g-xset');
    if (shell) { shell.hidden = true; shell.dataset.anim = ''; }
    document.body.classList.remove('g-xset-open');
    document.querySelector('main')?.removeAttribute('inert');
    document.querySelector('.topbar')?.removeAttribute('inert');
    xset = null;
    try { refreshFocusables(); } catch { /* Not ready. */ }
  }

  function xsetClose() {
    if (!xset) return;
    const opener = xset.opener;
    xsetCloseSilently();
    xsetPlay('back');
    // Put the pad back on whatever opened Settings, without leaving the hidden shell focused.
    try {
      const target = opener?.isConnected && opener.offsetParent !== null ? opener : document.querySelector('.top-actions [data-action="settings"]');
      if (target) setFocusedElement(target, { scroll: false });
    } catch { /* The dashboard can fall back to its own first control. */ }
  }

  function xsetBack() {
    if (!xset) return false;
    if (xset.overlay) { xsetCancelOverlay(); return true; }
    if (xset.level === 'rows') {
      xsetPlay('back');
      xset.level = 'pages';
      xset.anim = 'back';
      xset.focus = Math.max(0, (xset.pages || []).findIndex(page => page.id === xset.page?.id));
      xsetRender();
      xsetAnimate();
      xsetFocus();
      return true;
    }
    xsetClose();
    return true;
  }

  function xsetSelectPage(pageId) {
    const state = xset;
    const page = state?.pages?.find(item => item.id === pageId);
    if (!state || !page) return;
    // Advanced (launcher) is one real action, not a page with a single row to open.
    if (page.rows.length === 1 && page.rows[0].id === 'launcherSettings') {
      xsetCloseSilently();
      xsetPlay('confirm');
      xsetLauncherOpening = true;
      Promise.resolve(window.gSettings?.set('launcherSettings', null)).catch(error => {
        if (typeof showToast === 'function') showToast(error?.message || 'The launcher settings are unavailable.');
      }).finally(() => { xsetLauncherOpening = false; });
      return;
    }
    state.focus = 0;
    state.level = 'rows';
    xsetLoadPage(page);
  }

  function xsetRunAction(row) {
    const state = xset;
    if (!state || !row) return;
    // Advanced (launcher) is the one action that deliberately leaves the shell for the real dialog: set the
    // flag so the openSettings wrapper below lets the registry's performAction('settings') through.
    if (row.id === 'launcherSettings') { xsetCloseSilently(); xsetPlay('confirm'); xsetLauncherOpening = true; }
    Promise.resolve(window.gSettings?.set(row.id, null)).catch(error => {
      if (typeof showToast === 'function') showToast(error?.message || 'That action is unavailable.');
    }).then(() => window.gSettings?.get(row.id).then(value => {
      if (xset !== state) return;
      row.value = value;
      xsetRender();
    }).catch(() => {})).catch(() => {}).finally(() => { xsetLauncherOpening = false; });
  }

  function xsetSetValue(id, value) {
    const state = xset;
    const row = state?.rows.find(item => item.id === id);
    if (!state || !row) return;
    const previous = row.value;
    row.value = value;
    xsetRender();
    (async () => {
      try {
        if (XSET_FORM_ROWS.has(id)) await xsetSyncLauncherForm();
        await window.gSettings.set(id, value);
        const fresh = await window.gSettings.get(id).catch(() => value);
        if (xset !== state) return;
        row.value = fresh;
        xsetPlay('confirm');
      } catch (error) {
        if (xset !== state) return;
        row.value = previous;
        xsetPlay('back');
        if (typeof showToast === 'function') showToast(error?.message || 'Could not change this setting.');
      }
      if (xset === state) xsetRender();
    })();
  }

  function xsetOpenRow(index) {
    const state = xset;
    const row = state?.rows?.[index];
    if (!state || !row) return;
    if (row.kind === 'action') { xsetPlay('confirm'); xsetRunAction(row); return; }
    if (row.kind === 'toggle') { xsetSetValue(row.id, !row.value); return; }
    if (row.kind === 'info') {
      xsetPlay('confirm');
      state.overlay = { mode: 'info', row, options: [], selected: 0, value: row.value, saving: false, error: '' };
    } else if (row.kind === 'slider') {
      xsetPlay('confirm');
      const min = Number.isFinite(Number(row.min)) ? Number(row.min) : 0;
      const max = Number.isFinite(Number(row.max)) ? Number(row.max) : 100;
      const raw = Number(row.value);
      state.overlay = { mode: 'slider', row, options: [], selected: 0, min, max, step: Number(row.step) || 1, value: Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : min, saving: false, error: '' };
    } else if (row.kind === 'choice') {
      if (!row.options?.length) { if (typeof showToast === 'function') showToast('That setting has no choices right now.'); return; }
      xsetPlay('confirm');
      state.overlay = { mode: 'choice', row, options: row.options, selected: Math.max(0, row.options.findIndex(option => option.value === row.value)), value: null, saving: false, error: '' };
    } else return;
    xsetRender();
    xsetFocus();
  }

  function xsetCancelOverlay() {
    if (!xset?.overlay || xset.overlay.saving) return;
    xsetPlay('back');
    xset.overlay = null;
    xsetRender();
    xsetFocus();
  }

  async function xsetConfirmOverlay() {
    const state = xset;
    const overlay = state?.overlay;
    if (!state || !overlay || overlay.saving) return;
    if (overlay.mode === 'info') { xsetCancelOverlay(); return; }
    const value = overlay.mode === 'slider' ? overlay.value : overlay.options[overlay.selected]?.value;
    if (value === undefined) return;
    overlay.saving = true;
    overlay.error = '';
    xsetRender();
    try {
      if (XSET_FORM_ROWS.has(overlay.row.id)) await xsetSyncLauncherForm();
      await window.gSettings.set(overlay.row.id, value);
      const fresh = await window.gSettings.get(overlay.row.id).catch(() => value);
      if (xset !== state) return;
      overlay.row.value = fresh;
      state.overlay = null;
      xsetPlay('confirm');
    } catch (error) {
      if (xset !== state) return;
      overlay.saving = false;
      overlay.error = error?.message || 'Could not change this setting.';
      xsetPlay('back');
    }
    if (xset === state) { xsetRender(); xsetFocus(); }
  }

  function xsetOverlayMove(direction) {
    const overlay = xset?.overlay;
    if (!overlay || overlay.saving || overlay.mode === 'info') return;
    if (overlay.mode === 'slider') {
      if (direction !== 'left' && direction !== 'right') return;
      const step = overlay.step || 1;
      const next = Math.max(overlay.min, Math.min(overlay.max, Number(overlay.value) + (direction === 'right' ? step : -step)));
      if (next === overlay.value) return;
      overlay.value = Number(Number(next).toFixed(6));
      xsetPlay('navigate');
      xsetRender();
      xsetFocus();
      return;
    }
    if (direction !== 'up' && direction !== 'down') return;
    const next = Math.max(0, Math.min(overlay.options.length - 1, overlay.selected + (direction === 'down' ? 1 : -1)));
    if (next === overlay.selected) return;
    overlay.selected = next;
    xsetPlay('navigate');
    xsetRender();
    xsetFocus();
  }

  function xsetSeek(event, track) {
    const overlay = xset?.overlay;
    if (!overlay || overlay.mode !== 'slider' || !track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const step = overlay.step || 1;
    const value = overlay.min + Math.round((fraction * (overlay.max - overlay.min)) / step) * step;
    overlay.value = Number(Math.max(overlay.min, Math.min(overlay.max, value)).toFixed(6));
    xsetPlay('navigate');
    xsetRender();
    xsetFocus();
  }

  function xsetMove(direction) {
    const state = xset;
    if (!state) return;
    if (state.overlay) { xsetOverlayMove(direction); return; }
    if (state.console === 'x360') {
      if (state.level === 'pages') {
        if (direction === 'up' || direction === 'down') {
          const count = state.pages?.length || 0;
          if (!count) return;
          const next = Math.max(0, Math.min(count - 1, state.focus + (direction === 'down' ? 1 : -1)));
          if (next === state.focus) return;
          state.focus = next;
          xsetPlay('navigate');
          xsetRender();
          xsetFocus();
        } else if (direction === 'right') {
          xsetSelectPage(state.pages[state.focus]?.id);
        }
        return;
      }
      if (direction === 'up' || direction === 'down') {
        const count = state.rows.length;
        if (!count) return;
        const next = Math.max(0, Math.min(count - 1, state.focus + (direction === 'down' ? 1 : -1)));
        if (next === state.focus) return;
        state.focus = next;
        xsetPlay('navigate');
        xsetRender();
        xsetFocus();
      } else if (direction === 'left') xsetBack();
      return;
    }
    // Series and One: a vertical page rail on the left, the page's rows on the right, like the launcher's list.
    if (state.level === 'pages') {
      if (direction === 'up' || direction === 'down') {
        const count = state.pages?.length || 0;
        if (!count) return;
        const next = Math.max(0, Math.min(count - 1, state.focus + (direction === 'down' ? 1 : -1)));
        if (next === state.focus) return;
        state.focus = next;
        xsetPlay('navigate');
        if (state.pages[next]) xsetLoadPage(state.pages[next], { stay: true, animate: false });
      } else if (direction === 'right') {
        state.level = 'rows';
        state.focus = Math.min(state.focus, Math.max(0, state.rows.length - 1));
        xsetPlay('navigate');
        xsetRender();
        xsetFocus();
      }
      return;
    }
    if (direction === 'up' || direction === 'down') {
      const count = state.rows.length;
      if (!count) return;
      const next = Math.max(0, Math.min(count - 1, state.focus + (direction === 'down' ? 1 : -1)));
      if (next === state.focus) return;
      state.focus = next;
      xsetPlay('navigate');
      xsetRender();
      xsetFocus();
    } else if (direction === 'left') {
      xsetPlay('back');
      state.level = 'pages';
      state.focus = Math.max(0, (state.pages || []).findIndex(page => page.id === state.page?.id));
      xsetRender();
      xsetFocus();
    }
  }

  function xsetEnter() {
    const state = xset;
    if (!state) return;
    if (state.overlay) { xsetConfirmOverlay(); return; }
    if (state.console === 'x360' && state.level === 'pages') { xsetSelectPage(state.pages[state.focus]?.id); return; }
    if (state.console !== 'x360' && state.level === 'pages') {
      state.level = 'rows';
      state.focus = 0;
      xsetRender();
      xsetFocus();
      return;
    }
    xsetOpenRow(state.focus);
  }

  function xsetGoPage(id) {
    const state = xset;
    if (!state || !id) return;
    if (!state.pages) { state.pendingPage = id; return; }
    if (!state.pages.some(page => page.id === id)) return;
    xsetSelectPage(id);
  }

  function xsetQueueReload() {
    if (!xset || xsetReloadTimer) return;
    xsetReloadTimer = setTimeout(() => {
      xsetReloadTimer = 0;
      const state = xset;
      if (!state) return;
      // A launcher dialog owns the screen while it is open; its close handler repaints us.
      if (document.querySelector('dialog[open]')) return;
      xsetScans.delete(state.console);
      xsetScanPages(state.console, true).then(pages => {
        if (xset !== state) return;
        state.pages = pages;
        const page = pages.find(item => item.id === state.page?.id) || pages[0];
        if (!page) { state.page = null; state.rows = []; xsetRender(); return; }
        if (state.level === 'rows') xsetLoadPage(page, { animate: false });
        else { state.page = page; xsetRender(); xsetFocus(); }
      }).catch(() => {});
    }, 180);
  }

  // The launcher's own Settings dialog is now the Xbox shell's Advanced page. While a console shell is open,
  // ask for the real dialog explicitly (account setup, launcherSettings) and keep the shell behind it.
  const xsetOpenSettingsBase = typeof openSettings === 'function' ? openSettings : null;
  if (xsetOpenSettingsBase) {
    openSettings = async function (...args) {
      if (xsetLauncherOpening) return xsetOpenSettingsBase.apply(this, args);
      if (xset) return xsetOpenSettingsBase.apply(this, args);
      if (!xsetTheme()) return xsetOpenSettingsBase.apply(this, args);
      xsetOpen();
      return undefined;
    };
  }
  // Dashboard tiles (the 360's Settings hub) ask for a launcher page after opening Settings. While the console
  // shell owns the screen, that request picks the shell's matching page instead of a closed dialog's.
  const xsetShowPageBase = typeof showSettingsPage === 'function' ? showSettingsPage : null;
  if (xsetShowPageBase) {
    showSettingsPage = function (page, ...rest) {
      if (xset && !document.querySelector('#settings-dialog')?.open) {
        const target = XSET_LAUNCHER_PAGES[xset.console]?.[page];
        if (target) { xsetGoPage(target); return; }
      }
      return xsetShowPageBase.apply(this, [page, ...rest]);
    };
  }
  // Every input route runs through these globals, so one wrapper makes the shell behave like a console screen.
  const xsetPerformBase = typeof performAction === 'function' ? performAction : null;
  if (xsetPerformBase) {
    performAction = async function (action, source) {
      if (xset) {
        if (action === 'g-xset-back') { xsetBack(); return true; }
        if (action === 'g-xset-page' || action === 'g-xset-rail') {
          if (action === 'g-xset-rail') xset.focus = Number(source?.dataset?.index) || 0;
          xsetSelectPage(source?.dataset?.page);
          return true;
        }
        if (action === 'g-xset-row') { xset.focus = Number(source?.dataset?.row) || 0; xsetOpenRow(xset.focus); return true; }
        if (action === 'g-xset-option') {
          if (xset.overlay) { xset.overlay.selected = Number(source?.dataset?.option) || 0; await xsetConfirmOverlay(); }
          return true;
        }
        if (action === 'g-xset-commit') { await xsetConfirmOverlay(); return true; }
        if (action === 'g-xset-cancel') { xsetCancelOverlay(); return true; }
      }
      return xsetPerformBase.call(this, action, source);
    };
  }
  const xsetNavBase = typeof navigateConsoleHome === 'function' ? navigateConsoleHome : null;
  if (xsetNavBase) {
    navigateConsoleHome = function (direction, focused) {
      if (xset) { xsetMove(direction); return true; }
      return xsetNavBase.call(this, direction, focused);
    };
  }
  const xsetBackBase = typeof navigateBack === 'function' ? navigateBack : null;
  if (xsetBackBase) {
    navigateBack = function (...args) {
      if (xset && !document.querySelector('dialog[open]')) return xsetBack();
      return xsetBackBase.apply(this, args);
    };
  }
  // A pointer seek on the slider track is one press at the clicked spot, not a commit.
  document.addEventListener('click', event => {
    if (!xset?.overlay || xset.overlay.mode !== 'slider' || xset.overlay.saving) return;
    const track = event.target.closest?.('.g-xset-track');
    if (!track) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    xsetSeek(event, track);
  }, true);
  // Keep the shell in step with every other way a setting can change (the launcher dialog, a quick setting, the
  // input layer), and re-check what this PC can do when a preference that decides availability changes.
  document.addEventListener('g-setting-change', event => {
    if (!xset || !event.detail?.id) return;
    xsetQueueReload();
  });
  document.addEventListener('g-settings-ready', () => { if (xset) xsetQueueReload(); });
  // A dialog opened from the shell (Advanced, the profile editor, a reset confirmation) returns to the shell.
  document.addEventListener('close', () => {
    if (!xset || document.querySelector('dialog[open]')) return;
    setTimeout(() => { if (xset && !document.querySelector('dialog[open]')) { xsetQueueReload(); xsetFocus(); } }, 0);
  }, true);
  new MutationObserver(() => {
    if (xset && theme() !== xset.console) xsetCloseSilently();
  }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
})();
