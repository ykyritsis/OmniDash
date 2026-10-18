// Garrison settings shell: one model and one renderer for every console's Settings screen.
//
// The owner's brief for this pass: "make settings much more streamlined across all of the themes — make the entire
// experience feel like a console, not just a PC app that mimics a console." Before this file, PS3, PS4, Wii and 3DS
// each carried their own copy of the same state machine in garrison-theme-retro.js (scan pages, load rows, push and
// pop levels, value dialogs, commit/cancel, reload on g-setting-change, focus) and Series/One/360 had a seventh copy
// in garrison-theme-settings.js. They drifted. This file owns that state machine once:
//
//   window.gShell.open(console)     open the console's settings root
//   window.gShell.pages(console)    the registry layouts for a console, with each row's live availability
//   window.gShell.rows(pageId)      the loaded rows of a page (values and options included)
//   window.gShell.focus             what is focused now: { level, index, id, kind, pageId, value, overlay }
//   window.gShell.move(direction)   up / down / left / right, in the console's own layout
//   window.gShell.activate()        A / ✕ / Enter: open a page, change a toggle, open a value dialog, run an action
//   window.gShell.back()            B / ○ / Esc: one level up, closing at the root
//   window.gShell.close()           leave the shell and restore focus
//   window.gShell.refresh()         re-scan availability and re-read the open page
//
// One renderer builds every row, page button, option list, slider and Back/Confirm control from
// gSettings.layout(console), gSettings.label(id, console), gSettings.options(id) and gSettings.available(id). A
// console supplies a skin (gShell.define) that only supplies its own chrome, class names, glyphs and navigation
// shape. The skin never owns state, never calls gSettings.set itself and never handles Back. The four retro skins
// live in garrison-theme-retro.js (they need its pack images, XMB wave and focus model), and the three Xbox era
// skins live below.
//
// Grammar shared by all seven consoles:
//   confirm = A / Enter / ✕, back = B / Esc / ○ (skin.glyphs decides which face button is printed, and the
//   Enter Button pref is read live). A toggle that the console changed in place is applied in place; every other
//   value opens the console's own value dialog and applies on confirm.
//   Rows whose available() is false are never rendered. A page always lists its rows immediately (no extra level
//   the console did not have). The focused row always shows its current value. A short hint line names the
//   console's buttons. The last page is always Advanced (launcher), and choosing it leaves the shell for the
//   launcher's real Settings dialog. Back always goes up exactly one level and closes at the root, handing focus
//   back to the element that opened the shell. Everything re-reads itself on g-setting-change/g-settings-ready,
//   works with keyboard, controller and pointer, and keeps the layout while dropping movement under
//   html.reduce-motion.
(() => {
  'use strict';

  const root = window;
  const THEMES = ['series', 'one', 'x360', 'ps3', 'ps4', 'wii', '3ds'];
  // The launcher's Settings form saves every field at once. Before a form-backed row is read or written, fill the
  // form from disk, or saveSettingsForm would write its unopened defaults over the player's accounts and display
  // settings. (This helper used to exist twice, once per shell family.)
  const FORM_ROWS = new Set([
    'uiScale', 'textSize', 'tileRadius', 'reducedMotion', 'highContrastFocus', 'fullscreen', 'startupAnimation',
    'soundEffects', 'showUninstalledSteam', 'showUninstalledEpic', 'shuffleHomeScreenshots', 'randomScreenshotBackground'
  ]);
  // Units as the consoles printed them beside a number.
  const UNITS = { uiScale: '%', textSize: '%', volume: '%', brightness: '%', menuMusicVolume: '%', tileRadius: ' px', screensaverDelay: ' min' };
  // One glyph vocabulary for every non-XMB skin. A row can only name an icon the launcher already draws.
  const SETTING_GLYPHS = {
    volume: 'volume', mute: 'volume', soundEffects: 'volume', menuMusic: 'stream', menuMusicVolume: 'volume',
    brightness: 'tv', uiScale: 'tv', textSize: 'language', tileRadius: 'grid', reducedMotion: 'ease',
    highContrastFocus: 'show', fullscreen: 'fullscreen', startupAnimation: 'play', powerPlan: 'power',
    showUninstalledSteam: 'library', showUninstalledEpic: 'library', shuffleHomeScreenshots: 'photo',
    randomScreenshotBackground: 'photo', theme: 'color', accent: 'color', background: 'photo', ps3ThemeColour: 'color',
    clockFormat: 'language', dateOrder: 'language', screensaverDelay: 'tv', notifyFriends: 'bell', notifyDownloads: 'bell',
    notifyAchievements: 'bell', controllerVibration: 'controller', pauseDownloadsWhilePlaying: 'download',
    enterButton: 'controller', nintendoLayout: 'controller', screenLayout3ds: 'fullscreen', profile: 'contact',
    steamAccount: 'shop', epicAccount: 'shop', artworkKey: 'photo', checkForUpdates: 'refresh', copyDiagnostics: 'info',
    exportSettings: 'download', importSettings: 'download', resetLauncherData: 'delete', launcherSettings: 'settings',
    wifi: 'globe', battery: 'power', appVersion: 'info', freeDisk: 'drive', libraryCounts: 'library',
    friendsOnline: 'friends', controllerStatus: 'controller'
  };

  // ---------- Small shared helpers ----------
  const theme = () => document.body.dataset.gTheme || 'helix';
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])));
  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  const settingGlyph = id => SETTING_GLYPHS[id] || 'settings';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const reduced = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motionMs = which => root.gMotion?.ms?.(which) || 240;
  const animate = kind => (reduced() ? '' : kind);
  function play(kind) {
    try {
      if (typeof root.gAudio?.play === 'function') root.gAudio.play(kind);
      else if (typeof interfaceAudio?.play === 'function') interfaceAudio.play(kind);
    } catch { /* Sound is optional. */ }
  }
  function toast(message) { try { if (typeof showToast === 'function') showToast(message); } catch { /* Optional. */ } }

  let formReady = null;
  function syncLauncherForm() {
    if (formReady) return formReady;
    formReady = (async () => {
      if (typeof root.launcher?.getSettings !== 'function') return;
      const settings = await root.launcher.getSettings();
      const value = (id, next) => { const el = document.getElementById(id); if (el) { el.value = String(next); return el; } return null; };
      const checked = (id, on) => { const el = document.getElementById(id); if (el) el.checked = Boolean(on); return el; };
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
    })().catch(() => { formReady = null; });
    return formReady;
  }

  // ---------- Skins ----------
  // A skin is presentation only. It receives the model and paints it into its own DOM; the shell owns every
  // decision. Required: root, render(state), target(state). Everything else has a console-neutral default.
  const skins = new Map();
  function define(consoleId, skin) {
    if (!THEMES.includes(consoleId) || !skin) return;
    skins.set(consoleId, {
      id: consoleId,
      root: 'pages',          // pages | rail | rows | tiles
      rootCols: 1,
      otherCols: 3,
      pageCols: 1,
      paged: false,           // left/right at the edge of a page turns the page (Wii)
      backOnLeft: false,      // left from a page goes back one level (PS4, Series, One, 360)
      inlineToggles: false,   // A changes the toggle in place instead of opening On/Off
      glyphs: () => ({ confirm: 'A', back: 'B' }),
      ...skin
    });
  }

  // ---------- Registry scans ----------
  // One availability pass per console, cached briefly. Every page stays in the model (so the page count always
  // matches gSettings.layout) but a row that cannot do anything on this PC is never handed to a skin.
  const scans = new Map();
  function pageList(consoleId) {
    const cached = scans.get(consoleId);
    if (cached) return cached.pages;
    const api = root.gSettings;
    if (!api?.layout) return [];
    return api.layout(consoleId).map(page => ({ id: page.id, title: page.title, rows: page.rows.map(row => ({ id: row.id, available: true })), live: page.rows.length }));
  }
  async function scanPages(consoleId, force = false) {
    const api = root.gSettings;
    if (!api?.layout) return [];
    const cached = scans.get(consoleId);
    if (!force && cached && Date.now() - cached.at < 30000) return cached.pages;
    const pages = [];
    for (const page of api.layout(consoleId)) {
      const rows = [];
      for (const row of page.rows) {
        let available = false;
        try { available = await api.available(row.id); } catch { available = false; }
        rows.push({ id: row.id, available });
      }
      pages.push({ id: page.id, title: page.title, rows, live: rows.filter(row => row.available).length });
    }
    scans.set(consoleId, { at: Date.now(), pages });
    return pages;
  }
  async function loadRows(page, consoleId) {
    const api = root.gSettings;
    if (!api || !page) return [];
    if (page.rows.some(row => FORM_ROWS.has(row.id))) await syncLauncherForm();
    const rows = [];
    for (const row of page.rows) {
      let available = row.available;
      if (available === undefined) { try { available = await api.available(row.id); } catch { available = false; } }
      if (!available) continue;
      const entry = api.entry(row.id);
      if (!entry) continue;
      let value = null;
      try { value = await api.get(row.id); } catch { value = null; }
      let options = [];
      if (entry.kind === 'choice') { try { options = (await api.options(row.id)) || []; } catch { options = []; } }
      rows.push({ id: row.id, kind: entry.kind, label: api.label(row.id, consoleId), min: entry.min, max: entry.max, step: entry.step, value, options });
    }
    return rows;
  }
  // The registry's value in the console's own words.
  function valueText(row, value) {
    if (value === null || value === undefined || value === '') return '';
    if (row.kind === 'slider') {
      const number = Number(value);
      return `${Number.isFinite(number) ? Math.round(number) : String(value)}${UNITS[row.id] || ''}`;
    }
    if (row.kind === 'toggle') return value ? 'On' : 'Off';
    if (row.kind === 'choice') {
      const option = (row.options || []).find(item => String(item.value) === String(value));
      return option?.label || String(value);
    }
    return String(value);
  }
  function percent(row, value) {
    const min = Number.isFinite(Number(row.min)) ? Number(row.min) : 0;
    const max = Number.isFinite(Number(row.max)) ? Number(row.max) : 100;
    const span = max - min || 1;
    return Math.max(0, Math.min(100, ((Number(value) - min) / span) * 100));
  }

  // ---------- The model ----------
  let state = null;
  let openToken = 0, rowsToken = 0, refreshToken = 0, reloadTimer = 0, animTimer = 0;
  let launcherOpening = false;

  function isOpen(consoleId) { return Boolean(state && (!consoleId || state.console === consoleId)); }
  function snapshot() { return state; }
  function pageRows(page) { return page?.rows || []; }
  function isAdvancedPage(page) {
    const rows = pageRows(page);
    return rows.length === 1 && rows[0].id === 'launcherSettings';
  }
  function otherItems() {
    if (!state) return [];
    return (state.pages || []).filter(page => !['internet', 'data', 'advanced'].includes(page.id));
  }
  function rootItems() {
    if (!state) return [];
    if (state.skin.rootItems) return state.skin.rootItems(state);
    return state.pages || [];
  }
  function itemCount() {
    if (!state) return 0;
    if (state.level === 'page') return state.rows.length;
    if (state.level === 'other') return otherItems().length;
    return rootItems().length;
  }
  function focusInfo() {
    if (!state) return null;
    const base = { console: state.console, level: state.level, index: state.focus, pageId: state.page?.id || null, overlay: state.overlay?.mode || null, loading: state.loading };
    if (state.overlay) {
      const row = state.overlay.row;
      return {
        ...base, id: row?.id || null, kind: row?.kind || 'info', label: row?.label || '',
        value: state.overlay.mode === 'slider' ? state.overlay.value : state.overlay.options[state.overlay.selected]?.value
      };
    }
    if (state.level === 'page') {
      const row = state.rows[state.focus];
      return row ? { ...base, id: row.id, kind: row.kind, label: row.label, value: row.value } : base;
    }
    if (state.level === 'other') {
      const page = otherItems()[state.focus];
      return page ? { ...base, id: page.id, kind: 'page', pageId: page.id, label: page.title } : base;
    }
    const item = rootItems()[state.focus];
    if (!item) return base;
    return { ...base, id: item.pageId || item.id, kind: item.kind || 'page', pageId: item.pageId || item.id, label: item.label || item.title || '' };
  }

  // ---------- Rendering and focus ----------
  function refocus() {
    if (!state) return;
    // A dialog opened from the shell owns the focus while it is up; the close handler repaints and re-focuses.
    if (document.querySelector('dialog[open]')) return;
    let target = null;
    try { target = state.skin.target?.(state) || null; } catch { target = null; }
    if (!target || !target.isConnected) {
      try { target = state.skin.fallbackTarget?.(state) || null; } catch { target = null; }
    }
    if (!target) return;
    try { setFocusedElement(target, { scroll: false }); } catch { try { target.focus?.({ preventScroll: true }); } catch { /* Gone. */ } }
  }
  function render() {
    const current = state;
    if (!current) return;
    document.body.classList.toggle('g-shell-screen', ['ps4', 'wii', '3ds'].includes(current.console));
    try { current.skin.render?.(current); } catch (error) {
      // A broken skin must never leave the console Home hidden behind an empty overlay.
      console.error('Settings shell failed to paint:', error);
      close({ restore: false, silent: true, sound: false });
      return;
    }
    refocus();
    if (current.anim) {
      clearTimeout(animTimer);
      animTimer = setTimeout(() => {
        if (state !== current) return;
        current.anim = '';
        try { current.skin.render?.(current); } catch { /* Keep the last frame. */ }
        refocus();
      }, motionMs('page') + 120);
    }
  }

  // ---------- Opening, pages, closing ----------
  async function open(consoleId, opts = {}) {
    const skin = skins.get(consoleId);
    if (!skin) return false;
    if (state?.console === consoleId) {
      if (opts.pageId) return openPage(opts.pageId);
      return true;
    }
    if (state) close({ restore: false, silent: true, sound: false });
    const opener = opts.opener || (document.activeElement && document.activeElement !== document.body ? document.activeElement : null);
    const token = ++openToken;
    state = {
      console: consoleId, skin, level: 'root', pages: null, pageIndex: 0, page: null, rows: [],
      focus: 0, rootFocus: 0, otherFocus: 0, parent: 'root', loading: true, error: '', overlay: null,
      opener, anim: opts.silent ? '' : animate('in'), pendingPage: opts.pageId || null
    };
    try { skin.enter?.(state); } catch (error) { console.error('Settings shell failed to open:', error); }
    render();
    if (!opts.silent) play('confirm');
    let pages = [];
    try { pages = await scanPages(consoleId, false); } catch { pages = []; }
    if (token !== openToken || !state || state.console !== consoleId) return false;
    state.pages = pages;
    state.loading = false;
    const pending = state.pendingPage;
    state.pendingPage = null;
    if (skin.root === 'rows') {
      // Wii: the root is the first Wii Settings page, with the blue arrows turning pages.
      const page = (pending && pages.find(item => item.id === pending)) || pages[0] || null;
      state.pageIndex = page ? pages.indexOf(page) : 0;
      if (page) await openPage(page.id, { silent: true, parent: 'root' });
      else { state.level = 'page'; render(); }
    } else if (skin.root === 'rail') {
      // Series and One: the rail and the first page's rows are one screen.
      state.level = 'page';
      state.rootFocus = 0;
      if (pages[0]) await openPage(pages[0].id, { silent: true, parent: 'root' });
      else render();
    } else if (skin.root === 'tiles') {
      // 3DS: the four big bottom-screen buttons.
      state.level = 'root';
      state.focus = 0;
      render();
    } else {
      // PS4, 360, PS3: the page list is the root.
      state.level = 'root';
      state.focus = pending ? Math.max(0, pages.findIndex(page => page.id === pending)) : 0;
      state.rootFocus = state.focus;
      render();
      if (pending) await openPage(pending, { silent: true, parent: 'root' });
    }
    return true;
  }

  async function loadCurrentPage() {
    const current = state;
    const page = current?.page;
    if (!current || !page) return false;
    const token = ++rowsToken;
    current.loading = true;
    current.error = '';
    render();
    try {
      const rows = await loadRows(page, current.console);
      if (token !== rowsToken || state !== current || current.page !== page) return false;
      current.rows = rows;
      current.loading = false;
      current.focus = Math.min(current.focus, Math.max(0, rows.length - 1));
      render();
    } catch (error) {
      if (token !== rowsToken || state !== current || current.page !== page) return false;
      current.loading = false;
      current.error = error?.message || 'Could not read these settings.';
      render();
    }
    return true;
  }

  async function openPage(pageId, opts = {}) {
    const current = state;
    if (!current) return false;
    const page = current.pages?.find(item => item.id === pageId);
    if (!page) return false;
    // Advanced (launcher) is one real action, never a page with a single dead row.
    if (isAdvancedPage(page) && !opts.keep) { runAction('launcherSettings', null); return true; }
    if (current.level === 'root') current.rootFocus = current.focus;
    else if (current.level === 'other') current.otherFocus = current.focus;
    if (!opts.parent) opts.parent = current.level === 'other' ? 'other' : 'root';
    if (opts.parent === 'root') current.rootFocus = Math.max(0, current.pages.indexOf(page));
    else if (opts.parent === 'other') current.otherFocus = Math.max(0, otherItems().findIndex(item => item.id === page.id));
    current.parent = opts.parent;
    current.level = 'page';
    current.page = page;
    current.pageIndex = current.pages.indexOf(page);
    current.rows = [];
    current.overlay = null;
    current.error = '';
    current.focus = 0;
    current.anim = opts.silent ? '' : animate('deep');
    if (!opts.silent) play('confirm');
    render();
    return loadCurrentPage();
  }

  async function turnPage(direction) {
    const current = state;
    if (!current?.pages?.length) return false;
    const next = clamp(current.pageIndex + (Number(direction) < 0 ? -1 : 1), 0, current.pages.length - 1);
    if (next === current.pageIndex) return false;
    current.pageIndex = next;
    current.page = current.pages[next];
    current.rows = [];
    current.overlay = null;
    current.error = '';
    current.focus = 0;
    current.anim = animate(direction > 0 ? 'next' : 'prev');
    play('category');
    render();
    loadCurrentPage();
    return true;
  }

  function restoreFocus(previous) {
    if (!previous) return;
    const candidates = [];
    try { if (previous.opener) candidates.push(previous.opener); } catch { /* Detached. */ }
    try { const fallback = previous.skin?.returnFocus?.(previous); if (fallback) candidates.push(fallback); } catch { /* Optional. */ }
    for (const element of candidates) {
      if (!element || !element.isConnected) continue;
      if (element.getClientRects && element.getClientRects().length === 0) continue;
      try { setFocusedElement(element, { scroll: false }); return; } catch { try { element.focus({ preventScroll: true }); return; } catch { /* Try the next. */ } }
    }
  }

  function close(opts = {}) {
    const previous = state;
    if (!previous) return false;
    ++openToken; ++rowsToken; ++refreshToken;
    clearTimeout(reloadTimer); reloadTimer = 0;
    clearTimeout(animTimer); animTimer = 0;
    state = null;
    try { previous.skin.leave?.(previous); } catch { /* A half-built skin must still close. */ }
    document.body.classList.remove('g-shell-screen', 'g-shell-open', 'g-xset-open');
    document.querySelector('main')?.removeAttribute('inert');
    document.querySelector('.topbar')?.removeAttribute('inert');
    if (opts.sound !== false) play('back');
    if (opts.restore !== false) restoreFocus(previous);
    return true;
  }

  function back() {
    const current = state;
    if (!current) return false;
    if (current.overlay) { cancelOverlay(); return true; }
    if (current.level === 'page') {
      // Wii's root is its first settings page, so Back at a page is the console's Back to the Wii Menu.
      if (current.skin.root === 'rows') { close({ sound: true }); return true; }
      play('back');
      current.level = current.parent === 'other' ? 'other' : 'root';
      current.page = null;
      current.rows = [];
      current.loading = false;
      current.error = '';
      current.overlay = null;
      current.anim = animate('back');
      current.focus = current.level === 'other' ? Math.min(current.otherFocus || 0, Math.max(0, otherItems().length - 1))
        : current.skin.root === 'rail' ? Math.min(current.pageIndex, Math.max(0, (current.pages || []).length - 1))
          : Math.min(current.rootFocus || 0, Math.max(0, rootItems().length - 1));
      render();
      return true;
    }
    if (current.level === 'other') {
      play('back');
      current.level = 'root';
      current.page = null;
      current.rows = [];
      current.focus = Math.min(current.rootFocus || 0, Math.max(0, rootItems().length - 1));
      current.anim = animate('back');
      render();
      return true;
    }
    return close({ sound: true });
  }

  // ---------- Movement ----------
  // A grid move shared by lists (columns 1) and tiles. It never wraps and never walks off the page; an edge with
  // paged=true turns the page instead, and an edge with backOnLeft=true backs out one level.
  function moveIndex(direction, count, columns, opts = {}) {
    const current = state;
    if (!current) return false;
    const cols = Math.max(1, columns || 1);
    if (!count) {
      if (opts.paged && (direction === 'left' || direction === 'right')) return turnPage(direction === 'right' ? 1 : -1);
      return false;
    }
    const focus = Math.min(current.focus, count - 1);
    let next = focus;
    if (direction === 'up') next = focus - cols;
    else if (direction === 'down') next = focus + cols;
    else if (direction === 'left') {
      if (cols === 1) {
        if (opts.backOnLeft) return back();
        if (opts.paged) return turnPage(-1);
        return false;
      }
      if (focus % cols > 0) next = focus - 1;
      else if (opts.paged) return turnPage(-1);
      else if (opts.backOnLeft) return back();
      else return false;
    } else if (direction === 'right') {
      if (cols === 1) {
        if (opts.paged) return turnPage(1);
        return false;
      }
      if (focus % cols < cols - 1 && focus + 1 < count) next = focus + 1;
      else if (opts.paged) return turnPage(1);
      else return false;
    } else return false;
    if (next < 0 || next >= count || next === focus) return false;
    current.focus = next;
    current.anim = '';
    play('navigate');
    render();
    return true;
  }
  function railMove(direction) {
    const current = state;
    const pages = current?.pages || [];
    if (!pages.length) return false;
    if (direction === 'up' || direction === 'down') {
      const next = clamp(current.pageIndex + (direction === 'down' ? 1 : -1), 0, pages.length - 1);
      if (next === current.pageIndex) return false;
      current.focus = next;
      current.rootFocus = next;
      current.pageIndex = next;
      current.page = pages[next];
      current.rows = [];
      current.overlay = null;
      current.error = '';
      current.loading = true;
      current.anim = '';
      play('navigate');
      render();
      loadCurrentPage();
      return true;
    }
    if (direction === 'right') {
      if (!current.rows.length) return false;
      current.level = 'page';
      current.focus = 0;
      current.anim = '';
      play('navigate');
      render();
      return true;
    }
    return false;
  }
  function move(direction) {
    const current = state;
    if (!current) return false;
    if (current.overlay) return overlayMove(direction);
    if (current.level === 'root') {
      if (current.skin.moveRoot) return current.skin.moveRoot(current, direction);
      if (current.skin.root === 'rail') return railMove(direction);
      return moveIndex(direction, rootItems().length, current.skin.rootCols || 1);
    }
    if (current.level === 'other') {
      if (current.skin.moveOther) return current.skin.moveOther(current, direction);
      return moveIndex(direction, otherItems().length, current.skin.otherCols || 3);
    }
    if (current.skin.movePage) return current.skin.movePage(current, direction);
    return moveIndex(direction, current.rows.length, current.skin.pageCols || 1, {
      paged: current.skin.paged,
      backOnLeft: current.skin.backOnLeft
    });
  }

  // ---------- Activation ----------
  function activate() {
    const current = state;
    if (!current) return false;
    if (current.overlay) return overlayActivate();
    if (current.level === 'root') {
      if (current.skin.activateRoot) return current.skin.activateRoot(current);
      if (current.skin.root === 'rail') {
        if (!current.rows.length) return false;
        current.level = 'page';
        current.focus = 0;
        play('confirm');
        render();
        return true;
      }
      const item = rootItems()[current.focus];
      if (!item) return false;
      if (item.kind === 'other') {
        current.rootFocus = current.focus;
        current.level = 'other';
        current.focus = Math.min(current.otherFocus || 0, Math.max(0, otherItems().length - 1));
        play('confirm');
        render();
        return true;
      }
      if (item.kind === 'advanced') { runAction('launcherSettings', null); return true; }
      const pageId = item.pageId || item.id;
      if (pageId) return openPage(pageId, { parent: 'root' });
      return false;
    }
    if (current.level === 'other') {
      const page = otherItems()[current.focus];
      if (!page) return false;
      return openPage(page.id, { parent: 'other' });
    }
    const row = current.rows[current.focus];
    if (!row) return false;
    if (row.kind === 'action') { runAction(row.id, row); return true; }
    if (row.kind === 'toggle' && current.skin.inlineToggles) { play('confirm'); setRowValue(row, !row.value); return true; }
    openOverlay(row);
    return true;
  }

  // ---------- Value dialogs ----------
  function openOverlay(row) {
    const current = state;
    if (!current || !row) return false;
    play('confirm');
    const overlay = { row, mode: 'info', options: [], selected: 0, focus: 0, min: 0, max: 100, step: 1, value: null, saving: false, error: '' };
    if (row.kind === 'toggle') {
      overlay.mode = 'choice';
      overlay.options = [{ value: true, label: 'On' }, { value: false, label: 'Off' }];
      overlay.selected = row.value ? 0 : 1;
      overlay.focus = overlay.selected;
    } else if (row.kind === 'choice') {
      if (!row.options?.length) { toast('That setting has no choices right now.'); return false; }
      overlay.mode = 'choice';
      overlay.options = row.options;
      overlay.selected = Math.max(0, row.options.findIndex(option => String(option.value) === String(row.value)));
      overlay.focus = overlay.selected;
    } else if (row.kind === 'slider') {
      overlay.mode = 'slider';
      overlay.min = Number.isFinite(Number(row.min)) ? Number(row.min) : 0;
      overlay.max = Number.isFinite(Number(row.max)) ? Number(row.max) : 100;
      overlay.step = Number(row.step) || 1;
      const raw = Number(row.value);
      overlay.value = Number.isFinite(raw) ? clamp(raw, overlay.min, overlay.max) : overlay.min;
      overlay.focus = 0;
    } else {
      overlay.mode = 'info';
      overlay.focus = 0;
    }
    current.overlay = overlay;
    render();
    return true;
  }
  function overlayFooter(overlay) {
    if (!overlay) return { back: 0, confirm: -1, count: 1 };
    if (overlay.mode === 'info') return { back: 0, confirm: -1, count: 1 };
    if (overlay.mode === 'slider') return { back: 1, confirm: 2, count: 3 };
    return { back: overlay.options.length, confirm: overlay.options.length + 1, count: overlay.options.length + 2 };
  }
  function overlayMove(direction) {
    const overlay = state?.overlay;
    if (!overlay || overlay.saving) return false;
    if (overlay.mode === 'slider' && overlay.focus === 0 && (direction === 'left' || direction === 'right')) {
      const next = clamp(overlay.value + (direction === 'right' ? overlay.step : -overlay.step), overlay.min, overlay.max);
      if (next === overlay.value) return false;
      overlay.value = Number(next.toFixed(6));
      play('navigate');
      render();
      return true;
    }
    if (overlay.mode === 'info') return false;
    const footer = overlayFooter(overlay);
    const focus = clamp(overlay.focus, 0, footer.count - 1);
    let next = focus;
    if (direction === 'up' || direction === 'left') next = focus - 1;
    else if (direction === 'down' || direction === 'right') next = focus + 1;
    else return false;
    if (next < 0 || next >= footer.count) return false;
    overlay.focus = next;
    play('navigate');
    render();
    return true;
  }
  function overlayActivate() {
    const current = state;
    const overlay = current?.overlay;
    if (!current || !overlay || overlay.saving) return false;
    if (overlay.mode === 'info') { cancelOverlay(); return true; }
    if (overlay.mode === 'slider') {
      if (overlay.focus === 1) { cancelOverlay(); return true; }
      commitOverlay();
      return true;
    }
    const footer = overlayFooter(overlay);
    if (overlay.focus < overlay.options.length) {
      overlay.selected = overlay.focus;
      // Choosing a value is the change, as it is in the consoles' own option lists; there is no second confirm
      // level between the player and the setting. Back/Confirm stay on screen for pointer and for sliders.
      commitOverlay();
      return true;
    }
    if (overlay.focus === footer.back) { cancelOverlay(); return true; }
    commitOverlay();
    return true;
  }
  function cancelOverlay() {
    const current = state;
    if (!current?.overlay || current.overlay.saving) return false;
    play('back');
    current.overlay = null;
    render();
    return true;
  }
  async function commitOverlay() {
    const current = state;
    const overlay = current?.overlay;
    if (!current || !overlay || overlay.saving) return false;
    if (overlay.mode === 'info') { cancelOverlay(); return true; }
    const value = overlay.mode === 'slider' ? overlay.value : overlay.options[overlay.selected]?.value;
    overlay.saving = true;
    overlay.error = '';
    render();
    try {
      if (FORM_ROWS.has(overlay.row.id)) await syncLauncherForm();
      await root.gSettings.set(overlay.row.id, value);
      const fresh = await root.gSettings.get(overlay.row.id).catch(() => value);
      if (state !== current) return false;
      overlay.row.value = fresh;
      current.overlay = null;
      play('confirm');
      render();
      return true;
    } catch (error) {
      if (state !== current) return false;
      overlay.saving = false;
      overlay.error = error?.message || 'Could not change this setting.';
      play('back');
      render();
      return false;
    }
  }
  async function setRowValue(row, value) {
    const current = state;
    if (!current || !row) return false;
    const previous = row.value;
    row.value = value;
    render();
    try {
      if (FORM_ROWS.has(row.id)) await syncLauncherForm();
      await root.gSettings.set(row.id, value);
      const fresh = await root.gSettings.get(row.id).catch(() => value);
      if (state !== current) return false;
      row.value = fresh;
      play('confirm');
    } catch (error) {
      if (state !== current) return false;
      row.value = previous;
      play('back');
      toast(error?.message || 'Could not change this setting.');
    }
    if (state === current) render();
    return true;
  }
  async function runAction(id, row) {
    if (!id) return false;
    if (id === 'launcherSettings') {
      // The one action that deliberately leaves the console shell: the launcher's real Settings dialog takes over.
      // Close without restoring focus (the dialog does) and let the openSettings wrapper pass through.
      close({ restore: false, silent: true, sound: false });
      launcherOpening = true;
      try { await root.gSettings.set(id, null); } catch (error) { toast(error?.message || 'That action is unavailable.'); } finally { launcherOpening = false; }
      return true;
    }
    play('confirm');
    try {
      await root.gSettings.set(id, null);
      if (row && state) {
        const fresh = await root.gSettings.get(id).catch(() => row.value);
        row.value = fresh;
        render();
      }
    } catch (error) { toast(error?.message || 'That action is unavailable.'); }
    return true;
  }
  function seek(event, track) {
    const overlay = state?.overlay;
    if (!overlay || overlay.mode !== 'slider' || overlay.saving || !track) return false;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return false;
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const step = overlay.step || 1;
    const raw = overlay.min + Math.round((fraction * (overlay.max - overlay.min)) / step) * step;
    overlay.value = Number(clamp(raw, overlay.min, overlay.max).toFixed(6));
    play('navigate');
    render();
    return true;
  }

  // ---------- Live refresh ----------
  async function refresh(force = true) {
    const current = state;
    if (!current) return false;
    const token = ++refreshToken;
    scans.delete(current.console);
    let pages = [];
    try { pages = await scanPages(current.console, true); } catch { pages = []; }
    if (token !== refreshToken || state !== current) return false;
    current.pages = pages;
    if (current.level === 'page') {
      const page = pages.find(item => item.id === current.page?.id);
      if (!page) {
        // The page stopped existing because nothing on it can be done here: go back one level.
        current.level = current.skin.root === 'rows' ? 'page' : (current.parent === 'other' ? 'other' : 'root');
        current.page = null;
        current.rows = [];
        current.focus = 0;
        current.loading = false;
        render();
        return true;
      }
      const focusId = current.rows[current.focus]?.id;
      current.page = page;
      const rows = await loadRows(page, current.console);
      if (token !== refreshToken || state !== current) return false;
      current.rows = rows;
      current.loading = false;
      current.error = '';
      const kept = focusId ? rows.findIndex(row => row.id === focusId) : -1;
      current.focus = kept >= 0 ? kept : Math.min(current.focus, Math.max(0, rows.length - 1));
    } else {
      current.focus = Math.min(current.focus, Math.max(0, (current.level === 'other' ? otherItems().length : rootItems().length) - 1));
      current.loading = false;
    }
    render();
    return true;
  }
  function scheduleReload() {
    if (!state || reloadTimer) return;
    reloadTimer = setTimeout(() => {
      reloadTimer = 0;
      // A launcher dialog owns the screen while it is open; its close handler reloads us.
      if (!state || state.overlay || document.querySelector('dialog[open]')) return;
      refresh(true);
    }, 180);
  }

  async function pages(consoleId) {
    if (state?.console === consoleId && state.pages) return state.pages;
    return scanPages(consoleId, false);
  }
  async function rows(pageId) {
    const current = state;
    if (!current) return [];
    if (current.page?.id === pageId) return current.rows;
    const page = (current.pages || []).find(item => item.id === pageId);
    return page ? loadRows(page, current.console) : [];
  }
  function goPageWhenReady(pageId) {
    const current = state;
    if (!current || !pageId) return;
    if (!current.pages) { current.pendingPage = pageId; return; }
    if (current.pages.some(page => page.id === pageId)) openPage(pageId, { parent: 'root' });
  }

  // ---------- Xbox era skins (Series, One, 360) ----------
  // These three used to live in garrison-theme-settings.js as a second copy of the whole shell. Their screen is
  // still #g-xset with the same markup and CSS; only the state machine moved here.
  const XSET_BRAND = {
    series: { name: 'Xbox Series X|S', kicker: 'Settings' },
    one: { name: 'Xbox One', kicker: 'Settings' },
    x360: { name: 'Xbox 360', kicker: 'System Settings' }
  };
  const XSET_PAGE_GLYPHS = {
    general: 'settings', 'display-sound': 'volume', personalization: 'color', devices: 'controller', network: 'globe',
    notifications: 'bell', account: 'contact', system: 'settings', advanced: 'settings', preferences: 'color',
    ease: 'ease', console: 'settings', display: 'tv', controllers: 'controller', profile: 'contact', storage: 'drive'
  };
  const XSET_LAUNCHER_PAGES = {
    series: { 'g-account': 'account', personalization: 'personalization', audio: 'display-sound', 'g-input': 'devices', 'g-streaming': 'network', 'g-notifications': 'notifications', 'g-storage': 'system', accessibility: 'general', services: 'system', 'g-language': 'system', 'g-privacy': 'account' },
    one: { 'g-account': 'account', personalization: 'preferences', audio: 'display-sound', 'g-input': 'devices', 'g-streaming': 'network', 'g-notifications': 'notifications', 'g-storage': 'system', accessibility: 'ease', services: 'system', 'g-language': 'system', 'g-privacy': 'account' },
    x360: { 'g-account': 'profile', personalization: 'display', audio: 'console', 'g-input': 'controllers', 'g-streaming': 'network', 'g-notifications': 'notifications', 'g-storage': 'storage', accessibility: 'display', services: 'system', 'g-language': 'system', 'g-privacy': 'profile' }
  };
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
            <button class="g-xset-back focusable" type="button" data-action="gsh-back" aria-label="Back"><span aria-hidden="true">‹</span></button>
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
  function xsetPageIcon(pageId) { return icon(XSET_PAGE_GLYPHS[pageId] || 'settings'); }
  function xsetRowIcon(rowId) { return icon(settingGlyph(rowId)); }
  function xsetHints(current) {
    const glyphs = current.skin.glyphs();
    const label = current.overlay ? 'Select' : current.level === 'page' ? 'Select' : 'Open';
    const back = current.overlay ? 'Cancel' : current.level === 'page' ? 'Back' : 'Close';
    return `<span><b>${esc(glyphs.confirm)}</b> ${label}</span><span><b>${esc(glyphs.back)}</b> ${back}</span>`;
  }
  function xsetOverlayHtml(overlay) {
    if (!overlay) return '';
    const row = overlay.row;
    const glyphs = overlay.row ? state.skin.glyphs() : { confirm: 'A', back: 'B' };
    let body = '';
    if (overlay.mode === 'choice') {
      body = `<div class="g-xset-options" role="listbox" aria-label="${esc(row.label)}">${overlay.options.map((option, index) => `<button class="g-xset-option focusable${index === overlay.selected ? ' on' : ''}" type="button" role="option" aria-selected="${index === overlay.selected}" data-action="gsh-option" data-option="${index}"><span>${esc(option.label)}</span>${index === overlay.selected ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>`;
    } else if (overlay.mode === 'slider') {
      const p = percent({ min: overlay.min, max: overlay.max }, overlay.value);
      body = `<div class="g-xset-slider"><span class="g-xset-track" data-gsh-track><i style="width:${p}%"></i><b style="left:${p}%"></b></span><strong>${esc(valueText(row, overlay.value))}</strong></div>`;
    } else {
      body = `<p class="g-xset-info">${esc(valueText(row, row.value) || 'Unavailable')}</p>`;
    }
    const buttons = overlay.mode === 'info'
      ? `<button class="g-xset-action focusable" type="button" data-action="gsh-cancel"><b>${esc(glyphs.back)}</b> Back</button>`
      : overlay.mode === 'slider'
        ? `<button class="g-xset-action focusable" type="button" data-action="gsh-commit"><b>${esc(glyphs.confirm)}</b> Set</button><button class="g-xset-action focusable" type="button" data-action="gsh-cancel"><b>${esc(glyphs.back)}</b> Cancel</button>`
        : `<button class="g-xset-action focusable" type="button" data-action="gsh-commit"><b>${esc(glyphs.confirm)}</b> Select</button><button class="g-xset-action focusable" type="button" data-action="gsh-cancel"><b>${esc(glyphs.back)}</b> Back</button>`;
    return `<h3>${esc(row.label)}</h3>${body}<p class="g-xset-dialog-note">${overlay.error ? `<span class="g-xset-error">${esc(overlay.error)}</span>` : ''}${overlay.saving ? '<span class="g-xset-saving">Saving…</span>' : ''}</p><div class="g-xset-actions">${buttons}</div>`;
  }
  let xsetOverlayKey = '', xsetClockTimer = 0;
  function renderXbox(current) {
    const shell = xsetBuild();
    const brand = XSET_BRAND[current.console] || { name: 'Xbox', kicker: 'Settings' };
    const x360Root = current.console === 'x360' && current.level === 'root';
    shell.hidden = false;
    shell.dataset.console = current.console;
    shell.dataset.level = current.level;
    shell.dataset.anim = current.anim || '';
    document.body.classList.add('g-xset-open');
    document.querySelector('main')?.setAttribute('inert', '');
    document.querySelector('.topbar')?.setAttribute('inert', '');
    if (!xsetClockTimer) xsetClockTimer = setInterval(() => {
      const clock = document.querySelector('#g-xset .g-xset-clock');
      if (!clock || !state) return;
      clock.textContent = root.gSettings?.formatClock ? root.gSettings.formatClock() : '';
    }, 15000);
    shell.querySelector('.g-xset-brand strong').textContent = brand.name;
    shell.querySelector('.g-xset-brand small').textContent = brand.kicker;
    shell.querySelector('.g-xset-railnote').textContent = current.console === 'x360' ? '' : 'OmniDash';
    const pages = current.pages || [];
    const pageEl = shell.querySelector('.g-xset-pages');
    const pageKey = pages.map(page => `${page.id}:${page.title}`).join('|');
    if (pageEl.dataset.key !== pageKey) {
      pageEl.dataset.key = pageKey;
      pageEl.innerHTML = pages.map((page, index) => `<button class="g-xset-page focusable" type="button" data-action="gsh-page" data-page="${esc(page.id)}" data-index="${index}" aria-label="${esc(page.title)}">
        <span class="g-xset-icon" aria-hidden="true">${xsetPageIcon(page.id)}</span><span class="g-xset-pagelabel">${esc(page.title)}</span><span class="g-xset-chevron" aria-hidden="true">›</span>
      </button>`).join('');
    }
    [...pageEl.children].forEach((el, index) => {
      const page = pages[index];
      el.classList.toggle('on', Boolean(page && current.page && page.id === current.page.id));
      el.classList.toggle('sel', current.level === 'root' && current.console !== 'x360' && index === current.focus);
    });
    shell.querySelector('.g-xset-kicker').textContent = brand.name;
    shell.querySelector('.g-xset-title').textContent = x360Root ? 'System Settings' : (current.page?.title || 'Settings');
    shell.querySelector('.g-xset-back').setAttribute('aria-label', current.level === 'root' ? 'Close Settings' : 'Back');
    shell.querySelector('.g-xset-clock').textContent = root.gSettings?.formatClock ? root.gSettings.formatClock() : '';
    const rowsEl = shell.querySelector('.g-xset-rows');
    if (x360Root) {
      const key = 'pages|' + pageKey;
      if (rowsEl.dataset.key !== key) {
        rowsEl.dataset.key = key;
        rowsEl.innerHTML = pages.map((page, index) => `<button class="g-xset-row g-xset-page-row focusable" type="button" data-action="gsh-page" data-page="${esc(page.id)}" data-index="${index}" role="listitem" aria-label="${esc(page.title)}">
          <span class="g-xset-icon" aria-hidden="true">${xsetPageIcon(page.id)}</span><span class="g-xset-label">${esc(page.title)}</span><span class="g-xset-chevron" aria-hidden="true">›</span>
        </button>`).join('');
      }
      [...rowsEl.children].forEach((el, index) => el.classList.toggle('sel', index === current.focus));
    } else {
      const rows = current.rows || [];
      const rowKey = `${current.page?.id || ''}|${current.loading ? 'load' : ''}|${current.error}|${rows.map(row => `${row.id}:${row.kind}:${row.value}`).join('|')}`;
      if (rowsEl.dataset.key !== rowKey) {
        rowsEl.dataset.key = rowKey;
        rowsEl.innerHTML = rows.map((row, index) => {
          const value = valueText(row, row.value);
          const meter = row.kind === 'slider' ? `<span class="g-xset-meter" aria-hidden="true"><i style="width:${percent(row, row.value)}%"></i></span>` : '';
          const toggle = row.kind === 'toggle' ? `<span class="g-xset-switch${row.value ? ' on' : ''}" aria-hidden="true"><i></i></span>` : '';
          const chevron = row.kind === 'choice' || row.kind === 'action' ? '<span class="g-xset-chevron" aria-hidden="true">›</span>' : '';
          return `<button class="g-xset-row focusable" type="button" data-action="gsh-row" data-row="${index}" data-setting-id="${esc(row.id)}" data-kind="${row.kind}" role="listitem" aria-label="${esc(row.label)}${value ? `, ${esc(value)}` : ''}">
            <span class="g-xset-icon" aria-hidden="true">${xsetRowIcon(row.id)}</span><span class="g-xset-label">${esc(row.label)}</span>${meter}<span class="g-xset-value">${esc(value)}</span>${toggle}${chevron}
          </button>`;
        }).join('');
      }
      [...rowsEl.children].forEach((el, index) => el.classList.toggle('sel', current.level === 'page' && index === current.focus));
    }
    shell.querySelector('.g-xset-note').textContent = current.error || (current.loading ? 'Reading settings…' : (!x360Root && current.level === 'page' && !(current.rows || []).length ? 'Nothing on this page is available on this PC.' : ''));
    shell.querySelector('.g-xset-hints').innerHTML = xsetHints(current);
    const overlayEl = shell.querySelector('.g-xset-overlay');
    const dialog = shell.querySelector('.g-xset-dialog');
    const overlay = current.overlay;
    overlayEl.hidden = !overlay;
    overlayEl.classList.toggle('open', Boolean(overlay));
    const overlayKey = overlay ? `${overlay.mode}|${overlay.row.id}|${overlay.selected}|${overlay.value}|${overlay.saving ? 1 : 0}|${overlay.error}` : '';
    if (overlayKey !== xsetOverlayKey) {
      xsetOverlayKey = overlayKey;
      dialog.innerHTML = overlay ? xsetOverlayHtml(overlay) : '';
    }
  }
  function xsetTarget(current) {
    const shell = document.getElementById('g-xset');
    if (!shell) return null;
    if (current.overlay) {
      if (current.overlay.mode === 'slider') return shell.querySelector('[data-action="gsh-commit"]');
      if (current.overlay.mode === 'info') return shell.querySelector('[data-action="gsh-cancel"]');
      const options = shell.querySelectorAll('.g-xset-option');
      const count = current.overlay.options.length;
      if (current.overlay.focus < count) return options[current.overlay.focus] || options[current.overlay.selected] || shell.querySelector('[data-action="gsh-commit"]');
      // The dialog's action order is Select then Back; the shell's footer order is Back then Confirm.
      const buttons = shell.querySelectorAll('.g-xset-actions .g-xset-action');
      return current.overlay.focus === count ? (buttons[1] || buttons[0]) : buttons[0];
    }
    if (current.console === 'x360' && current.level === 'root') return shell.querySelector('.g-xset-page-row.sel') || shell.querySelector('.g-xset-page-row');
    if (current.console !== 'x360' && current.level === 'root') return shell.querySelector('.g-xset-page.sel') || shell.querySelector('.g-xset-page');
    return shell.querySelector('.g-xset-row.sel') || shell.querySelector('.g-xset-row') || shell.querySelector('.g-xset-back');
  }
  function xsetLeave() {
    const shell = document.getElementById('g-xset');
    if (shell) { shell.hidden = true; shell.dataset.anim = ''; }
    clearInterval(xsetClockTimer); xsetClockTimer = 0;
    document.body.classList.remove('g-xset-open');
    document.querySelector('main')?.removeAttribute('inert');
    document.querySelector('.topbar')?.removeAttribute('inert');
    xsetOverlayKey = '';
  }
  const xsetContainer = () => document.getElementById('g-xset');
  const xsetReturnFocus = () => document.querySelector('.top-actions .g-icon-button[data-action="settings"]')
    || document.querySelector('.top-nav-button[data-action="settings"]')
    || document.querySelector('[data-action="settings"].focusable');
  define('series', { root: 'rail', backOnLeft: true, inlineToggles: true, container: xsetContainer, render: renderXbox, target: xsetTarget, leave: xsetLeave, returnFocus: xsetReturnFocus, launcherPages: XSET_LAUNCHER_PAGES.series });
  define('one', { root: 'rail', backOnLeft: true, inlineToggles: true, container: xsetContainer, render: renderXbox, target: xsetTarget, leave: xsetLeave, returnFocus: xsetReturnFocus, launcherPages: XSET_LAUNCHER_PAGES.one });
  define('x360', { root: 'pages', backOnLeft: true, inlineToggles: true, container: xsetContainer, render: renderXbox, target: xsetTarget, leave: xsetLeave, returnFocus: xsetReturnFocus, launcherPages: XSET_LAUNCHER_PAGES.x360 });

  // ---------- Launcher integration ----------
  // One wrapper for each input route. Every console screen (and the launcher's own gear) reaches these globals, so
  // the shell behaves like a console screen no matter how the press arrived: pointer, keyboard or controller.
  if (typeof openSettings === 'function') {
    const openSettingsBase = openSettings;
    openSettings = async function (...args) {
      if (launcherOpening || state) {
        if (launcherOpening) return openSettingsBase.apply(this, args);
        return undefined;
      }
      const consoleId = theme();
      if (!skins.has(consoleId)) return openSettingsBase.apply(this, args);
      await open(consoleId);
      return undefined;
    };
  }
  if (typeof showSettingsPage === 'function') {
    const showSettingsPageBase = showSettingsPage;
    showSettingsPage = function (page, ...rest) {
      if (state && !document.querySelector('dialog[open]')) {
        const target = state.skin.launcherPages?.[page];
        if (target) { goPageWhenReady(target); return; }
      }
      return showSettingsPageBase.apply(this, [page, ...rest]);
    };
  }
  if (typeof performAction === 'function') {
    const performActionBase = performAction;
    performAction = async function (action, source) {
      if (action && action.startsWith('gsh-')) {
        if (!state) {
          const consoleId = theme();
          if (skins.has(consoleId) && action === 'gsh-page' && source?.dataset?.page) {
            await open(consoleId, { opener: source, silent: true });
            if (state) await openPage(source.dataset.page, { silent: true });
          }
          return true;
        }
        const index = Number(source?.dataset?.index ?? source?.dataset?.row);
        if (action === 'gsh-back' || action === 'gsh-close') { back(); return true; }
        if (action === 'gsh-row') {
          if (Number.isFinite(index)) state.focus = clamp(index, 0, Math.max(0, state.rows.length - 1));
          activate();
          return true;
        }
        if (action === 'gsh-page') {
          if (Number.isFinite(index) && state.level === 'root') state.focus = index;
          if (source?.dataset?.page) openPage(source.dataset.page, { parent: state.level === 'other' ? 'other' : 'root' });
          else activate();
          return true;
        }
        if (action === 'gsh-root') {
          if (Number.isFinite(index)) state.focus = clamp(index, 0, Math.max(0, rootItems().length - 1));
          activate();
          return true;
        }
        if (action === 'gsh-page-turn') { turnPage(Number(source?.dataset?.dir) || 1); return true; }
        if (action === 'gsh-option') {
          const overlay = state.overlay;
          if (overlay && !overlay.saving) {
            overlay.selected = clamp(Number(source?.dataset?.option) || 0, 0, Math.max(0, overlay.options.length - 1));
            overlay.focus = overlay.selected;
            commitOverlay();
          }
          return true;
        }
        if (action === 'gsh-commit') { commitOverlay(); return true; }
        if (action === 'gsh-cancel') { cancelOverlay(); return true; }
        if (action === 'gsh-slider') { commitOverlay(); return true; }
        return true;
      }
      return performActionBase.call(this, action, source);
    };
  }
  if (typeof navigateConsoleHome === 'function') {
    const navigateConsoleHomeBase = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (state) { move(direction); return true; }
      return navigateConsoleHomeBase.call(this, direction, focused);
    };
  }
  if (typeof navigateBack === 'function') {
    const navigateBackBase = navigateBack;
    navigateBack = function (...args) {
      if (state && !document.querySelector('dialog[open]')) { back(); return true; }
      return navigateBackBase.apply(this, args);
    };
  }
  // Tab is trapped inside the shell (there is no modal dialog element to do it for us). Escape, Enter and the d-pad
  // already reach the wrappers above.
  document.addEventListener('keydown', event => {
    if (!state || event.key !== 'Tab' || document.querySelector('dialog[open]')) return;
    const shell = state.skin.container?.(state) || document;
    const focusables = [...shell.querySelectorAll('.focusable')].filter(el => el.getClientRects().length > 0 && !el.disabled && !el.hidden);
    if (!focusables.length) return;
    const index = focusables.indexOf(document.activeElement);
    const next = event.shiftKey ? (index <= 0 ? focusables.length - 1 : index - 1) : (index < 0 || index >= focusables.length - 1 ? 0 : index + 1);
    event.preventDefault();
    try { setFocusedElement(focusables[next], { scroll: false }); } catch { focusables[next].focus?.({ preventScroll: true }); }
  }, true);
  // A pointer press on a slider track seeks; the rest of the pointer path is the normal action dispatcher.
  document.addEventListener('click', event => {
    if (!state?.overlay || state.overlay.mode !== 'slider') return;
    const track = event.target.closest?.('[data-gsh-track]');
    if (!track) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    seek(event, track);
  }, true);
  document.addEventListener('g-setting-change', event => {
    if (!state || !event.detail?.id) return;
    scans.delete(state.console);
    scheduleReload();
  });
  document.addEventListener('g-settings-ready', () => {
    if (!state) return;
    scans.delete(state.console);
    scheduleReload();
  });
  // A dialog opened from a row (profile, an account key, a reset) closes back into the shell: reload its values and
  // put the focus back on the same row. The launcher dialog's own close path is left alone.
  document.addEventListener('close', event => {
    if (!state || !event.target?.matches?.('dialog')) return;
    requestAnimationFrame(() => {
      if (!state || document.querySelector('dialog[open]')) return;
      scans.delete(state.console);
      refresh(true).then(() => refocus()).catch(() => {});
    });
  }, true);
  new MutationObserver(() => {
    if (state && state.console !== theme()) close({ restore: false, silent: true, sound: false });
  }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });

  // ---------- Public API ----------
  root.gShell = {
    open,
    close,
    back,
    move,
    activate,
    refresh,
    render,
    pages,
    rows,
    pageList,
    define,
    isOpen,
    state: snapshot,
    get focus() { return focusInfo(); },
    valueText,
    percent,
    glyph: settingGlyph,
    icon,
    settingGlyph,
    hints() {
      if (!state) return { confirm: '', back: '' };
      const glyphs = state.skin.glyphs();
      return { confirm: glyphs.confirm, back: glyphs.back };
    },
    // Exposed so a skin can ask what the console's own layout says without duplicating the read.
    layout: consoleId => (root.gSettings?.layout?.(consoleId) || []),
    // Tests and a future guide can jump to a page without replaying every press.
    openPage
  };
})();
