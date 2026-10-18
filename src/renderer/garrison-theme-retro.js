// PlayStation and Nintendo dashboards: PS3 (XMB), PS4, Wii and 3DS. Recreations of each console's home
// screen, laid out from reference screenshots, built over the launcher's own library and actions, so every
// item launches, opens the Store, Settings, friends and so on. Each has its own layout, focus, sounds and
// controller navigation.
// Optional packs in %APPDATA%\xbox-preview-ui\theme-packs (theme:retro-pack) add the real icons, fonts and
// sounds. Without them the themes fall back to drawn icons and synthesised sounds.
(() => {
  const RETRO = ['ps3', 'ps4', 'wii', '3ds'];
  const theme = () => document.body.dataset.gTheme || 'helix';
  const on = () => RETRO.includes(theme());
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text ?? ''));
  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  const games = () => (typeof homeRecentGames === 'function' ? homeRecentGames() : []).filter(game => !game.isApp && !game.remoteHostId);
  const allGames = () => (state.games || []).filter(game => !game.isApp && game.installed !== false);
  const cover = game => game?.artwork?.tile || game?.artwork?.grid || '';
  const url = value => value ? `url(&quot;${esc(value).replaceAll('"', '%22')}&quot;)` : 'none';
  const cssUrl = value => `url("${String(value).replaceAll('"', '%22')}")`;
  const name = () => state.displayName || document.querySelector('#dashboard-player-name')?.textContent || 'Player';
  const avatar = () => document.querySelector('#profile-avatar')?.innerHTML || '';
  const now = () => new Date();
  // Every console clock reads the registry's clock/date settings (Clock format, Date format), so changing one
  // changes the XMB, PS4, Wii and 3DS clocks together.
  const time = () => window.gSettings?.formatClock ? window.gSettings.formatClock(now()) : now().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayMonth = () => window.gSettings?.formatDate ? window.gSettings.formatDate(now()) : now().toLocaleDateString([], { day: 'numeric', month: 'numeric' });
  const weekday = () => now().toLocaleDateString([], { weekday: 'short' });
  const focusEl = el => { if (el) setFocusedElement(el, { scroll: false }); };
  const findGame = id => (state.games || []).find(item => item.id === id);

  // ---------- Packs ----------
  let pack = { available: {}, base: '', sounds: {} };
  const P = (id, rel) => pack.available[id] && pack.base ? pack.base + rel.split('/').map(encodeURIComponent).join('/') : '';
  const PS3I = file => P('ps3', `ps3/PS3-Simulator-main/icons/${file}.png`);
  const PS4I = file => P('ps4', `ps4/Ps4-UI-master/assets/img/${file}.png`);
  const WIII = file => P('wii', `wii/Wii.JS-gh-pages/assets/images/${file}`);
  const img = (src, fallback, cls = '') => src ? `<img class="rp-img ${cls}" src="${esc(src)}" alt="" draggable="false">` : fallback;
  async function loadPack() {
    try { pack = await window.launcher?.getRetroPack?.() || pack; } catch { /* No packs. */ }
    const fonts = [['g-retro-xmb', P('ps3', 'ps3/PS3-Simulator-main/fonts/SCE-PS3-RD-R-LATIN2.woff')], ['g-retro-sst', P('ps4', 'ps4/Ps4-UI-master/assets/font/sst.ttf')],
      ['g-retro-rodin', P('wii', 'wii/Liink-main/fonts/FOT-RodinProN-DB.otf')], ['g-retro-rodin-b', P('wii', 'wii/Liink-main/fonts/FOT-RodinProN-B.otf')]];
    let css = fonts.filter(([, src]) => src).map(([family, src]) => `@font-face{font-family:"${family}";src:${cssUrl(src)};font-display:swap}`).join('');
    if (pack.available.wii) css += `body[data-g-theme="wii"],body[data-g-theme="wii"] *{cursor:${cssUrl(WIII('cursor.png'))} 14 4,auto!important}`;
    if (pack.available.wii) css += `#g-retro .wii-ch::before{background:${cssUrl(WIII('channel-border.png'))} center/100% 100% no-repeat}#g-retro .wii-ch:is(.focused,:focus-visible)::before{background-image:${cssUrl(WIII('channel-hover.png'))}}`
      + `#g-retro .wii-ch{box-shadow:0 calc(2*var(--cpx)) calc(5*var(--cpx)) rgba(0,0,0,.08)}#g-retro .wii-ch.empty{background:${cssUrl(WIII('channel-icon.png'))} center/100% 100% no-repeat;box-shadow:none}#g-retro .wii-ch.empty::after{display:none}`;
    if (pack.available.ps4) css += `body[data-g-theme="ps4"] #g-theme-wall{background:#0b4fae ${cssUrl(PS4I('background'))} center/cover no-repeat!important}`;
    let style = document.querySelector('#g-retro-pack');
    if (!style) { style = document.createElement('style'); style.id = 'g-retro-pack'; document.head.append(style); }
    style.textContent = css;
    document.body.classList.toggle('g-retro-pack', Object.values(pack.available).some(Boolean));
    if (on()) render();
  }

  const host = document.createElement('section');
  host.id = 'g-retro';
  host.setAttribute('aria-label', 'Home');
  document.querySelector('#home-view')?.prepend(host);
  const chrome = document.createElement('div');
  chrome.id = 'g-retro-chrome';
  document.body.append(chrome);

  // An item: { label, sub, action, data, glyph, image, game, boot }
  const attrs = item => `data-action="${esc(item.action)}"${Object.entries(item.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}${item.boot ? ' data-retro-boot="1"' : ''}`;
  // "12 h", "3.5 h", "40 min": the play time each console prints next to a game.
  const playtime = game => {
    const minutes = Number(game?.steamPlaytimeMinutes) || 0;
    if (!minutes) return '';
    const hours = minutes / 60;
    return hours >= 10 ? `${Math.round(hours)} h` : hours >= 1 ? `${hours.toFixed(1).replace(/\.0$/, '')} h` : `${Math.round(minutes)} min`;
  };
  // The line under a game's name: how much it has been played, then where it came from, as the consoles did.
  const gameLine = (game, extra = '') => [extra, playtime(game), game?.installed === false ? 'Not installed' : game?.provider === 'PC' ? '' : game?.provider]
    .filter(Boolean).join(' · ');
  const gameItem = game => ({ label: game.title, sub: gameLine(game), action: 'select-game', data: { 'game-id': game.id }, game, boot: true });
  const settingsItem = (label, page, file, glyph) => ({ label, action: 'g-retro-settings', data: { page }, file, glyph });

  // Achievements for the PS4 content cards and the 3DS banner, cached per game.
  const achCache = new Map();
  function achievements(game) {
    if (!game || !window.launcher?.getGameAchievements) return Promise.resolve([]);
    if (!achCache.has(game.id)) achCache.set(game.id, window.launcher.getGameAchievements(game.id).then(result => result?.items || []).catch(() => []));
    return achCache.get(game.id);
  }

  // Captures from the most recent games, for the XMB Photo and Video categories and the Wii and 3DS apps.
  let captures = null;
  function loadCaptures() {
    if (captures || !window.launcher?.listCaptures) return;
    captures = [];
    Promise.all(games().slice(0, 6).map(game => window.launcher.listCaptures(game.id).then(list => (Array.isArray(list) ? list : list?.items || []).map(item => ({ ...item, game }))).catch(() => [])))
      .then(lists => { captures = lists.flat().slice(0, 40); if (theme() === 'ps3' && ['photo', 'video'].includes(xmbCategories()[xmbCat]?.id)) renderXmb(); });
  }
  const captureItems = kind => (captures || []).filter(item => (item.kind === 'video') === (kind === 'video'))
    .map(item => ({ label: item.name, sub: item.game.title, action: 'g-capture-open', data: { 'game-id': item.game.id, index: item.index }, image: item.thumb, glyph: kind === 'video' ? 'video' : 'photo' }));
  function openLatestCapture() {
    const latest = (captures || [])[0];
    if (latest) window.launcher.openCapture(latest.game.id, Number(latest.index)).catch(() => {});
    else if (typeof showToast === 'function') showToast('No screenshots or clips yet. Captures from Steam and Game Bar show up here.');
  }

  // =========================== PS3: the XrossMediaBar ===========================
  // Measured from a 1080p XMB, then scaled up to the console's bold living-room size: categories on a row
  // 292px down, the selected column at 560 with 224px between icons; items above the selection stack to the
  // top of the screen, the selection sits at 468, the rest from 650 and step by 118.
  const MONTH = ['#a7adb5', '#c9a227', '#6c9d2f', '#d780a9', '#3e8e41', '#8d4fb3', '#2a9d97', '#3d8fd6', '#2f62c9', '#7a43b8', '#9a6230', '#b8302d'];
  // Theme Settings → Theme Colour: the month's own XMB tint, or one fixed colour from the registry.
  const xmbTint = () => {
    const fixed = window.gSettings?.cached?.('ps3ThemeColour');
    return typeof fixed === 'string' && /^#[\da-f]{6}$/i.test(fixed) ? fixed : MONTH[now().getMonth()];
  };
  document.addEventListener('g-setting-change', event => {
    if (event.detail?.id === 'ps3ThemeColour' && theme() === 'ps3') document.body.style.setProperty('--xmb-tint', xmbTint());
  });
  document.addEventListener('g-settings-ready', () => {
    if (theme() === 'ps3') document.body.style.setProperty('--xmb-tint', xmbTint());
  });
  let xmbCat = 6, xmbItem = {};
  const xmbCategories = () => {
    const friends = (state.gFriends?.friends || []).filter(f => f.state !== 'offline' && f.state !== 'unknown');
    const list = allGames().slice(0, 60);
    return [
      { id: 'users', label: 'Users', file: 'users', glyph: 'contact', items: [{ label: name(), sub: 'Signed in', action: 'g-account', file: 'current-user', glyph: 'contact' }, { label: 'Turn Off System', action: 'power-menu', file: 'power', glyph: 'power' }] },
      // The Settings column is the registry's PS3 layout (task S2): one XMB item per settings page, each row
      // backed by a real gSettings entry. Nothing here is hand-written; gSettings.layout('ps3') owns the order.
      { id: 'settings', label: 'Settings', file: 'settings', glyph: 'settings', items: ps3SettingsItems() },
      { id: 'photo', label: 'Photo', file: 'photo', glyph: 'photo', items: [settingsItem('Backgrounds', 'personalization', 'photo-gallery', 'color'), ...captureItems('photo')] },
      { id: 'music', label: 'Music', file: 'music', glyph: 'music', items: [settingsItem('Menu Sounds', 'audio', 'playlist', 'volume')] },
      { id: 'video', label: 'Video', file: 'video', glyph: 'video', items: [{ label: 'Game Clips', sub: captures?.some(item => item.kind === 'video') ? 'Recorded from your games' : 'No clips yet', action: 'g-retro-captures', file: 'video', glyph: 'video' }, ...captureItems('video')] },
      { id: 'tv', label: 'TV/Video Services', file: 'remote', glyph: 'tv', items: [{ label: 'Game Pass', sub: 'Stream and download', action: 'dashboard-gamepass', file: 'remote', glyph: 'game' }] },
      { id: 'game', label: 'Game', file: 'play', glyph: 'game', start: 2, items: [{ label: 'Trophy Collection', action: 'g-account', file: 'trophy', glyph: 'trophy' }, { label: 'Game Data Utility', sub: 'All games and apps', action: 'library', file: 'folder-game', glyph: 'library' }, ...list.map(gameItem)] },
      { id: 'network', label: 'Network', file: 'network', glyph: 'globe', items: [{ label: 'Internet Search', action: 'toggle-search', file: 'search', glyph: 'search' }, { label: 'Downloads', action: 'console-library-section', data: { section: 'queue' }, file: 'upload', glyph: 'download' }] },
      { id: 'psn', label: 'PlayStation®Network', file: 'psn', glyph: 'shop', items: [{ label: 'PlayStation®Store', action: 'dashboard-store', file: 'store-logo', glyph: 'shop' }, { label: "What's New", action: 'g-notifications', file: 'whats-new', glyph: 'bell' },
        { label: 'PlayStation®Plus', sub: 'Game Pass', action: 'dashboard-gamepass', file: 'psplus', glyph: 'game' }, { label: 'Account Management', action: 'g-account', file: 'psn', glyph: 'contact' }] },
      { id: 'friends', label: 'Friends', file: 'friends', glyph: 'friends', items: [{ label: 'Friends', sub: `${state.gFriends?.online || 0} online`, action: 'g-friends', file: 'add-user', glyph: 'friends' },
        ...friends.slice(0, 12).map(f => ({ label: f.name || 'Friend', sub: f.game ? f.game : 'Online', action: 'g-friends', image: f.avatar, glyph: 'contact' }))] }
    ];
  };
  function xmbIcon(item, big) {
    if (item.game) return `<span class="xmb-icon game${big ? ' big' : ''}"${cover(item.game) ? ` style="--cover:${url(cover(item.game))}"` : ''}></span>`;
    if (item.image) return `<span class="xmb-icon pic" style="background-image:${url(item.image)}"></span>`;
    return `<span class="xmb-icon${big ? ' big' : ''}">${img(item.file && PS3I(item.file), icon(item.glyph))}</span>`;
  }
  // The XMB shell is built once and then only its positions and classes change. Rebuilding the markup on
  // every press (which is what this did) throws the old nodes away, so the CSS transitions never run and
  // everything snaps; the console slides its categories and its item column.
  let xmbBuiltBar = '', xmbBuiltList = '', xmbSwapTimer = 0;
  function renderXmb(rebuild = true) {
    const cats = xmbCategories();
    xmbCat = Math.max(0, Math.min(xmbCat, cats.length - 1));
    const cat = cats[xmbCat], items = cat.items;
    // A settings page only belongs to the Settings column; a library refresh that lands on another category
    // closes the sub-list instead of leaving it floating over a different column.
    if (ps3Open && cat.id !== 'settings') { ps3Open = null; ps3Sub = 0; ps3Popup = null; }
    if (xmbItem[cat.id] == null) xmbItem[cat.id] = Math.min(cat.start || 0, items.length - 1);
    const sel = xmbItem[cat.id] = Math.max(0, Math.min(xmbItem[cat.id], items.length - 1));
    document.body.style.setProperty('--xmb-tint', xmbTint());
    const hour = now().getHours();
    document.body.style.setProperty('--xmb-night', String(hour >= 21 || hour < 5 ? .42 : hour >= 18 || hour < 7 ? .22 : 0));
    // Vertical positions: the selection, the items under it, and the ones above that climb over the row.
    const step = 118;
    let below = 650;
    const pos = items.map((item, index) => {
      if (index === sel) return 468;
      if (index > sel) { const y = below; below += step; return y; }
      return 172 - (sel - 1 - index) * 116;
    });
    if (!host.querySelector('.xmb-list')) {
      host.innerHTML = `<i class="xmb-pic" aria-hidden="true"></i><canvas class="xmb-wave" aria-hidden="true"></canvas>
        <div class="xmb-bar"></div><div class="xmb-list"></div>
        <div class="xmb-sub" role="group" aria-label="Settings options" aria-hidden="true"></div>
        <div class="xmb-pop" role="dialog" aria-modal="false" aria-hidden="true"></div>`;
      xmbBuiltBar = xmbBuiltList = '';
    }
    const bar = host.querySelector('.xmb-bar'), list = host.querySelector('.xmb-list');
    const barKey = cats.map(c => c.id).join('|');
    if (rebuild || xmbBuiltBar !== barKey) {
      bar.innerHTML = cats.map(c => `<span class="xmb-cat">${img(PS3I(c.file), icon(c.glyph))}<b>${esc(c.label)}</b></span>`).join('');
      xmbBuiltBar = barKey;
    }
    [...bar.children].forEach((el, i) => {
      el.style.setProperty('--x', String(560 + (i - xmbCat) * 224));
      el.classList.toggle('on', i === xmbCat);
    });
    const listKey = `${cat.id}|${items.map(item => `${item.label}:${item.action}:${item.sub || ''}`).join('|')}`;
    if (rebuild || xmbBuiltList !== listKey) {
      list.innerHTML = items.map((item, index) => `<button class="xmb-item focusable${item.game ? ' is-game' : ''}" type="button" ${attrs(item)} data-xmb-index="${index}" aria-label="${esc(item.label)}">
        ${xmbIcon(item, index === sel)}<span class="xmb-copy"><strong>${esc(item.label)}</strong>${item.sub ? `<small>${esc(item.sub)}</small>` : ''}</span></button>`).join('');
      xmbBuiltList = listKey;
      // A new column (another category, or the same one after the library changed) fades up from below.
      // The class is dropped once the animation has finished, or its fill would override the item transitions.
      if (!reducedMotion()) {
        list.classList.remove('xmb-swap'); void list.offsetWidth; list.classList.add('xmb-swap');
        clearTimeout(xmbSwapTimer);
        xmbSwapTimer = setTimeout(() => list.classList.remove('xmb-swap'), 420);
      }
    }
    [...list.children].forEach((el, i) => {
      el.style.setProperty('--y', String(pos[i]));
      el.classList.toggle('on', i === sel);
      el.classList.toggle('above', i < sel);
    });
    chrome.innerHTML = `<div class="xmb-clock"><span class="xmb-me"><i></i>${esc(name())}</span><span class="xmb-time">${esc(dayMonth())} ${esc(time())}</span><i class="xmb-dial"></i></div>`;
    renderXmbSub();
    renderXmbPop();
    // The Settings column's own pop-up owns the focus while it is open; otherwise the selected row or item.
    const focusTarget = ps3Popup
      ? (ps3Popup.mode === 'info' ? host.querySelector('.xmb-pop') : ps3Popup.mode === 'slider' ? host.querySelector('.xmb-bar-dialog') : host.querySelector('.xmb-pop-option.on'))
      : ps3Open ? host.querySelector('.xmb-sub-item.on') : list.querySelector('.xmb-item.on');
    focusEl(focusTarget);
    if (cat.id === 'settings') scanPs3Settings();
    xmbBackdrop(items[sel]);
    loadCaptures();
    xmbWave.start();
  }
  // The selected game's background image fades in after a moment, as PIC1 did.
  let picTimer = 0;
  function xmbBackdrop(item) {
    clearTimeout(picTimer);
    const layer = host.querySelector('.xmb-pic');
    host.classList.remove('pic-on');
    if (!layer || !item?.game || !window.gWideArt) return;
    picTimer = setTimeout(() => window.gWideArt(item.game).then(src => {
      if (!src || !layer.isConnected) return;
      layer.style.backgroundImage = cssUrl(src);
      host.classList.add('pic-on');
    }).catch(() => {}), 900);
  }
  // ---------- PS3: Settings, driven by gSettings (task S2) ----------
  // The Settings column is the registry's PS3 layout: one XMB item per settings page, in the layout's order.
  // Choosing a page slides the XMB column left and opens that page's rows in the XMB's right-hand panel. Choosing
  // a row opens the console's option pop-up: a translucent black panel of values for a choice, On/Off for a
  // toggle, and the horizontal bar dialog for a slider. Actions run as soon as they are chosen; read-only facts
  // open a panel showing the real value. Only rows whose available() is true are listed, and every value comes
  // from gSettings, so nothing on this screen can drift from what the launcher can actually do.
  const PS3_PAGE_ICONS = { display: 'display-settings', sound: 'sound-settings', theme: 'theme-settings', time: 'time-settings', system: 'system-settings', accessory: 'acc-settings', network: 'network-settings', notifications: 'chat-settings', game: 'game-settings', account: 'psn', advanced: 'settings' };
  const PS3_PAGE_GLYPHS = { display: 'tv', sound: 'volume', theme: 'color', time: 'language', system: 'settings', accessory: 'controller', network: 'globe', notifications: 'bell', game: 'game', account: 'contact', advanced: 'settings' };
  const PS3_ROW_ICONS = {
    uiScale: 'display-settings', brightness: 'display-settings', fullscreen: 'display-settings',
    volume: 'sound-settings', mute: 'sound-settings', soundEffects: 'sound-settings', menuMusic: 'music-settings', menuMusicVolume: 'music-settings',
    ps3ThemeColour: 'theme-settings', background: 'photo-gallery', clockFormat: 'time-settings', dateOrder: 'time-settings', screensaverDelay: 'time-settings',
    appVersion: 'system-settings', freeDisk: 'system-settings', powerPlan: 'power-settings', checkForUpdates: 'system-update', resetLauncherData: 'setting-edit',
    controllerStatus: 'acc-settings', controllerVibration: 'acc-settings', enterButton: 'acc-settings', wifi: 'network-settings', friendsOnline: 'network-settings',
    notifyFriends: 'chat-settings', notifyDownloads: 'chat-settings', notifyAchievements: 'chat-settings',
    pauseDownloadsWhilePlaying: 'game-settings', libraryCounts: 'folder-game',
    profile: 'current-user', steamAccount: 'sign-up', epicAccount: 'sign-up', artworkKey: 'photo-gallery', launcherSettings: 'settings'
  };
  const PS3_ROW_GLYPHS = {
    uiScale: 'tv', brightness: 'tv', fullscreen: 'fullscreen', volume: 'volume', mute: 'volume', soundEffects: 'volume', menuMusic: 'stream', menuMusicVolume: 'volume',
    ps3ThemeColour: 'color', background: 'photo', clockFormat: 'language', dateOrder: 'language', screensaverDelay: 'tv',
    appVersion: 'info', freeDisk: 'drive', powerPlan: 'power', checkForUpdates: 'refresh', resetLauncherData: 'delete',
    controllerStatus: 'controller', controllerVibration: 'controller', enterButton: 'controller', wifi: 'globe', friendsOnline: 'friends',
    notifyFriends: 'bell', notifyDownloads: 'bell', notifyAchievements: 'bell', pauseDownloadsWhilePlaying: 'download', libraryCounts: 'library',
    profile: 'contact', steamAccount: 'shop', epicAccount: 'shop', artworkKey: 'photo', launcherSettings: 'settings'
  };
  // The launcher's Settings form is only filled from disk when its dialog opens, but saveSettingsForm() saves
  // every field at once. A console form row must not show (or save) those defaults over the player's real
  // account and display settings, so fill the form from disk once before the XMB reads or writes a form row.
  const PS3_FORM_ROWS = new Set(['uiScale', 'textSize', 'tileRadius', 'reducedMotion', 'highContrastFocus', 'fullscreen', 'startupAnimation', 'soundEffects', 'showUninstalledSteam', 'showUninstalledEpic', 'shuffleHomeScreenshots', 'randomScreenshotBackground']);
  let ps3FormReady = null;
  function ps3SyncLauncherForm() {
    if (ps3FormReady) return ps3FormReady;
    ps3FormReady = (async () => {
      if (typeof window.launcher?.getSettings !== 'function') return;
      const settings = await window.launcher.getSettings();
      const value = (id, input) => { const el = document.getElementById(id); if (el) { el.value = String(input); return el; } return null; };
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
      // The launcher's previews and its "did this field change?" baseline follow the values now in the form.
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
    })().catch(() => { ps3FormReady = null; });
    return ps3FormReady;
  }
  // Percent, milliseconds and console words, as the console printed them beside a value.
  const PS3_UNITS = { uiScale: '%', textSize: '%', volume: '%', brightness: '%', menuMusicVolume: '%', tileRadius: ' px', screensaverDelay: ' min' };
  // The Enter Button setting swaps the PlayStation face buttons the same way the input layer already does.
  const ps3Glyphs = () => (window.gSettings?.cached?.('enterButton') === 'o' ? { enter: '○', back: '✕' } : { enter: '✕', back: '○' });
  const ps3LayoutPages = () => (window.gSettings?.layout ? window.gSettings.layout('ps3') : []);
  let ps3Layout = null, ps3LayoutAt = 0, ps3LayoutPromise = null, ps3ScanSeq = 0, ps3RowsSeq = 0;
  let ps3Open = null, ps3Sub = 0, ps3Popup = null;
  const ps3PageList = () => ps3Layout || ps3LayoutPages();
  function ps3SettingsItems() {
    return ps3PageList().map(page => ({
      label: page.title, action: 'xmb-settings-page', data: { page: page.id },
      file: PS3_PAGE_ICONS[page.id] || 'settings', glyph: PS3_PAGE_GLYPHS[page.id] || 'settings'
    }));
  }
  // Find out which rows this PC can really honour. The Settings column only lists a page that still has at
  // least one live row (Advanced always stays, even if every other row were unavailable).
  function scanPs3Settings(force = false) {
    if (!window.gSettings) return;
    if (!force && ps3Layout && Date.now() - ps3LayoutAt < 30000) return;
    if (ps3LayoutPromise) return ps3LayoutPromise;
    const layout = ps3LayoutPages();
    if (!layout.length) return;
    const token = ++ps3ScanSeq;
    const selectedId = ps3Layout?.[Number(xmbItem.settings)]?.id;
    ps3LayoutPromise = (async () => {
      const pages = [];
      for (const page of layout) {
        const rows = [];
        for (const row of page.rows) {
          let available = false;
          try { available = await window.gSettings.available(row.id); } catch { available = false; }
          rows.push({ id: row.id, available });
        }
        pages.push({ id: page.id, title: page.title, rows });
      }
      if (token !== ps3ScanSeq) return;
      ps3Layout = pages.filter(page => page.rows.some(row => row.available) || page.id === 'advanced');
      ps3LayoutAt = Date.now();
      if (selectedId) {
        const index = ps3Layout.findIndex(page => page.id === selectedId);
        if (index >= 0) xmbItem.settings = index;
      }
      if (theme() === 'ps3' && state.view === 'home') {
        const cat = xmbCategories()[xmbCat];
        if (cat?.id === 'settings' && ps3Open && !ps3PageList().some(page => page.id === ps3Open.id)) ps3ClosePage();
        else renderXmb(false);
      }
    })().catch(() => {}).finally(() => { ps3LayoutPromise = null; });
    return ps3LayoutPromise;
  }
  // Read one page's real rows: availability first, then the value and (for a choice) the list of values.
  async function ps3LoadPageRows(page) {
    const rows = [];
    const g = window.gSettings;
    if (page.rows.some(row => PS3_FORM_ROWS.has(row.id))) await ps3SyncLauncherForm();
    for (const row of page.rows) {
      let available = row.available !== false;
      if (row.available === undefined) { try { available = await g.available(row.id); } catch { available = false; } }
      if (!available) continue;
      const entry = g.entry(row.id);
      if (!entry) continue;
      let value = null;
      try { value = await g.get(row.id); } catch { value = null; }
      let options = [];
      if (entry.kind === 'choice') { try { options = await g.options(row.id); } catch { options = []; } }
      rows.push({ id: row.id, kind: entry.kind, label: g.label(row.id, 'ps3'), min: entry.min, max: entry.max, step: entry.step, value, options });
    }
    return rows;
  }
  // The console printed a number and its unit, On/Off, or the chosen value's own wording.
  function ps3Format(row, value) {
    if (value === null || value === undefined || value === '') return '';
    if (row.kind === 'slider') return `${Math.round(Number(value))}${PS3_UNITS[row.id] || ''}`;
    if (row.kind === 'toggle') return value ? 'On' : 'Off';
    if (row.kind === 'choice') {
      const option = (row.options || []).find(item => String(item.value) === String(value));
      return option?.label || String(value);
    }
    return String(value);
  }
  function ps3Hint(mode) {
    const glyphs = ps3Glyphs();
    if (mode === 'info') return `<button class="xmb-pop-action focusable" type="button" data-action="xmb-pop-cancel" aria-label="Back"><b class="xmb-glyph" aria-hidden="true">${glyphs.back}</b> Back</button>`;
    return `<button class="xmb-pop-action focusable" type="button" data-action="xmb-pop-commit"><b class="xmb-glyph" aria-hidden="true">${glyphs.enter}</b> Set</button>
      <button class="xmb-pop-action focusable" type="button" data-action="xmb-pop-cancel"><b class="xmb-glyph" aria-hidden="true">${glyphs.back}</b> Cancel</button>`;
  }
  function ps3OpenPage(id) {
    const pages = ps3PageList();
    const index = pages.findIndex(page => page.id === id);
    const page = pages[index];
    if (!page) return;
    // Advanced (launcher) is one real action: run it instead of opening a page with a single row.
    if (page.rows.length === 1 && page.rows[0].id === 'launcherSettings') { ps3RunAction('launcherSettings'); return; }
    play('confirm');
    const token = ++ps3RowsSeq;
    ps3Open = {
      id: page.id, title: page.title, loading: true, error: '',
      rows: page.rows.filter(row => row.available !== false).map(row => ({
        id: row.id, kind: window.gSettings?.entry(row.id)?.kind || 'info', label: window.gSettings?.label(row.id, 'ps3') || row.id, value: null, options: [], pending: true
      }))
    };
    ps3Sub = 0;
    ps3Popup = null;
    renderXmb(false);
    ps3LoadPageRows(page).then(rows => {
      if (token !== ps3RowsSeq || ps3Open?.id !== page.id) return;
      ps3Open.rows = rows;
      ps3Open.loading = false;
      ps3Sub = Math.min(ps3Sub, Math.max(0, rows.length - 1));
      renderXmb(false);
    }).catch(error => {
      if (token !== ps3RowsSeq || ps3Open?.id !== page.id) return;
      ps3Open.loading = false;
      ps3Open.error = error?.message || 'Could not read these settings.';
      renderXmb(false);
    });
  }
  function ps3ClosePage() {
    if (!ps3Open) return;
    play('back');
    ps3Open = null; ps3Sub = 0; ps3Popup = null;
    renderXmb(false);
  }
  function ps3RunAction(id) {
    play('confirm');
    // Open the launcher's own dialog from the XMB's normal state, so closing it lands back on the pages list.
    if (id === 'launcherSettings') { ps3Open = null; ps3Sub = 0; ps3Popup = null; renderXmb(false); }
    Promise.resolve(window.gSettings?.set(id, null)).catch(error => {
      if (typeof showToast === 'function') showToast(error?.message || 'That action is unavailable.');
    }).then(() => {
      const row = ps3Open?.rows?.find(item => item.id === id);
      if (!row) return;
      window.gSettings.get(id).then(value => { row.value = value; if (ps3Open) renderXmb(false); }).catch(() => {});
    });
  }
  function ps3OpenRow(index) {
    const row = ps3Open?.rows?.[index];
    if (!row || row.pending) return;
    if (row.kind === 'action') { ps3RunAction(row.id); return; }
    if (row.kind === 'info') {
      play('confirm');
      ps3Popup = { mode: 'info', row };
    } else if (row.kind === 'toggle') {
      play('confirm');
      ps3Popup = { mode: 'toggle', row, options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }], selected: row.value ? 0 : 1, saving: false, error: '' };
    } else if (row.kind === 'slider') {
      play('confirm');
      const min = Number.isFinite(Number(row.min)) ? Number(row.min) : 0;
      const max = Number.isFinite(Number(row.max)) ? Number(row.max) : 100;
      const raw = Number(row.value);
      const value = Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : min;
      ps3Popup = { mode: 'slider', row, min, max, step: Number(row.step) || 1, value, original: value, saving: false, error: '' };
    } else if (row.kind === 'choice') {
      if (!row.options?.length) { if (typeof showToast === 'function') showToast('That setting has no choices right now.'); return; }
      play('confirm');
      ps3Popup = { mode: 'choice', row, options: row.options, selected: Math.max(0, row.options.findIndex(option => option.value === row.value)), saving: false, error: '' };
    } else return;
    renderXmb(false);
  }
  function ps3SubMove(direction) {
    if (direction === 'left') { ps3ClosePage(); return; }
    if (direction !== 'up' && direction !== 'down') return;
    const count = ps3Open?.rows?.length || 0;
    if (!count) return;
    const next = Math.max(0, Math.min(count - 1, ps3Sub + (direction === 'down' ? 1 : -1)));
    if (next === ps3Sub) return;
    ps3Sub = next;
    play('navigate');
    renderXmb(false);
  }
  function ps3PopupMove(direction) {
    const popup = ps3Popup;
    if (!popup || popup.saving || popup.mode === 'info') return;
    if (popup.mode === 'slider') {
      if (direction !== 'left' && direction !== 'right') return;
      const next = Math.max(popup.min, Math.min(popup.max, popup.value + (direction === 'right' ? popup.step : -popup.step)));
      if (next === popup.value) return;
      popup.value = Number(next.toFixed(6));
      play('navigate');
      renderXmb(false);
      return;
    }
    if (direction !== 'up' && direction !== 'down') return;
    const next = Math.max(0, Math.min(popup.options.length - 1, popup.selected + (direction === 'down' ? 1 : -1)));
    if (next === popup.selected) return;
    popup.selected = next;
    play('navigate');
    renderXmb(false);
  }
  function ps3CancelPopup() {
    if (!ps3Popup || ps3Popup.saving) return;
    play('back');
    ps3Popup = null;
    renderXmb(false);
  }
  async function ps3ConfirmPopup() {
    const popup = ps3Popup;
    if (!popup || popup.saving) return;
    if (popup.mode === 'info') { ps3CancelPopup(); return; }
    const value = popup.mode === 'slider' ? popup.value : popup.options[popup.selected]?.value;
    popup.saving = true; popup.error = '';
    renderXmb(false);
    try {
      if (PS3_FORM_ROWS.has(popup.row.id)) await ps3SyncLauncherForm();
      await window.gSettings.set(popup.row.id, value);
      popup.row.value = await window.gSettings.get(popup.row.id).catch(() => value);
      ps3Popup = null;
      play('confirm');
      renderXmb(false);
    } catch (error) {
      popup.saving = false;
      popup.error = error?.message || 'Could not change this setting.';
      play('back');
      renderXmb(false);
    }
  }
  function ps3Seek(event) {
    const popup = ps3Popup;
    const track = host.querySelector('.xmb-bar-track');
    if (!popup || popup.mode !== 'slider' || !track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const step = popup.step || 1;
    const value = popup.min + Math.round((fraction * (popup.max - popup.min)) / step) * step;
    popup.value = Number(Math.max(popup.min, Math.min(popup.max, value)).toFixed(6));
    play('navigate');
    renderXmb(false);
  }
  function renderXmbSub() {
    const panel = host.querySelector('.xmb-sub');
    if (!panel) return;
    const open = Boolean(ps3Open);
    host.classList.toggle('sub-open', open);
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    if (!open) { panel.innerHTML = ''; panel.removeAttribute('data-key'); return; }
    const page = ps3Open;
    const rows = page.rows || [];
    const glyphs = ps3Glyphs();
    const key = [page.id, page.loading ? 1 : 0, page.error, ps3Sub, glyphs.enter, glyphs.back, rows.map(row => `${row.id}:${row.kind}:${row.pending ? 1 : 0}:${row.value}`).join(',')].join('|');
    if (panel.dataset.key === key) return;
    panel.dataset.key = key;
    panel.innerHTML = `<div class="xmb-sub-head"><span class="xmb-sub-kicker">${esc(page.title)}</span><small>${rows.length ? `${ps3Sub + 1} / ${rows.length}` : ''}</small></div>
      <div class="xmb-sub-list">${rows.length ? rows.map((row, index) => `<button class="xmb-sub-item focusable${index === ps3Sub ? ' on' : ''}" type="button" data-action="xmb-settings-row" data-row="${index}" aria-label="${esc(row.label)}${row.pending ? '' : `, ${esc(ps3Format(row, row.value))}`}">
        <span class="xmb-sub-icon" aria-hidden="true">${row.pending ? '' : img(PS3I(PS3_ROW_ICONS[row.id] || 'settings'), icon(PS3_ROW_GLYPHS[row.id] || 'settings'))}</span>
        <span class="xmb-sub-label">${esc(row.label)}</span>
        <span class="xmb-sub-value">${row.pending ? '…' : esc(ps3Format(row, row.value))}</span>
        ${row.kind === 'action' ? '<span class="xmb-sub-open" aria-hidden="true">›</span>' : ''}
      </button>`).join('') : `<p class="xmb-sub-empty">${page.loading ? 'Reading settings…' : esc(page.error || 'Nothing on this page is available on this PC.')}</p>`}</div>
      <p class="xmb-sub-hint"><span class="xmb-hint-open"><b class="xmb-glyph" aria-hidden="true">${glyphs.enter}</b> Open</span><button class="xmb-pop-action focusable" type="button" data-action="xmb-settings-back"><b class="xmb-glyph" aria-hidden="true">${glyphs.back}</b> Back</button></p>`;
  }
  function renderXmbPop() {
    const panel = host.querySelector('.xmb-pop');
    if (!panel) return;
    const open = Boolean(ps3Popup);
    host.classList.toggle('pop-open', open);
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    if (!open) {
      panel.innerHTML = '';
      panel.removeAttribute('data-key');
      panel.removeAttribute('tabindex');
      delete panel.dataset.action;
      return;
    }
    const popup = ps3Popup, row = popup.row;
    const glyphs = ps3Glyphs();
    const key = [row.id, popup.mode, popup.selected, popup.value, popup.saving ? 1 : 0, popup.error, glyphs.enter, glyphs.back].join('|');
    if (panel.dataset.key === key) return;
    panel.dataset.key = key;
    // The read-only panel is its own close target; the others focus their value list.
    if (popup.mode === 'info') { panel.setAttribute('tabindex', '-1'); panel.dataset.action = 'xmb-pop-close'; }
    else { panel.removeAttribute('tabindex'); delete panel.dataset.action; }
    let body = '';
    if (popup.mode === 'slider') {
      const span = popup.max - popup.min || 1;
      const percent = Math.max(0, Math.min(100, ((popup.value - popup.min) / span) * 100));
      body = `<div class="xmb-bar-dialog" role="slider" tabindex="-1" data-action="xmb-bar" aria-label="${esc(row.label)}" aria-valuemin="${popup.min}" aria-valuemax="${popup.max}" aria-valuenow="${popup.value}">
        <span class="xmb-bar-arrow" aria-hidden="true">◀</span><span class="xmb-bar-track"><i style="width:${percent}%"></i><b style="left:${percent}%"></b></span><span class="xmb-bar-arrow" aria-hidden="true">▶</span></div>
        <strong class="xmb-bar-value">${esc(ps3Format(row, popup.value))}</strong>`;
    } else if (popup.mode === 'toggle' || popup.mode === 'choice') {
      body = `<div class="xmb-pop-list" role="listbox" aria-label="${esc(row.label)}">${popup.options.map((option, index) => `<button class="xmb-pop-option focusable${index === popup.selected ? ' on' : ''}" type="button" role="option" aria-selected="${index === popup.selected}" data-action="xmb-pop-option" data-option="${index}"><span>${esc(option.label)}</span>${index === popup.selected ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>`;
    } else {
      body = `<p class="xmb-pop-info">${esc(ps3Format(row, row.value) || 'Unavailable')}</p>`;
    }
    panel.innerHTML = `<div class="xmb-pop-head"><strong>${esc(row.label)}</strong><small>${esc(ps3Open?.title || '')}</small></div>${body}
      <p class="xmb-pop-hint">${popup.error ? `<span class="xmb-pop-error">${esc(popup.error)}</span>` : ''}${ps3Hint(popup.mode)}${popup.saving ? '<span class="xmb-pop-saving">Saving…</span>' : ''}</p>`;
  }
  function xmbMove(direction) {
    if (ps3Popup) { ps3PopupMove(direction); return; }
    if (ps3Open) { ps3SubMove(direction); return; }
    const cats = xmbCategories();
    if (direction === 'left' || direction === 'right') {
      const next = Math.max(0, Math.min(cats.length - 1, xmbCat + (direction === 'right' ? 1 : -1)));
      if (next === xmbCat) return;
      xmbCat = next; play('category');
      if (cats[xmbCat].id === 'settings') scanPs3Settings();
    } else {
      const cat = cats[xmbCat];
      const current = xmbItem[cat.id] ?? (cat.start || 0);
      const next = Math.max(0, Math.min(cat.items.length - 1, current + (direction === 'down' ? 1 : -1)));
      if (next === current) return;
      xmbItem[cat.id] = next; play('navigate');
    }
    renderXmb(false);
  }
  // The wave: translucent ribbons with a bright crest and drifting sparkles, drawn at 30fps on half-size
  // canvas. The crest glow is a wide faint stroke under a thin bright one rather than a canvas shadow, which
  // costs a fraction of the time on integrated graphics. It stops whenever the window is hidden or unfocused,
  // or the XMB isn't showing.
  const xmbWave = (() => {
    let raf = 0, last = 0, t = 0;
    const sparks = Array.from({ length: 54 }, () => ({ x: Math.random(), y: .28 + Math.random() * .55, s: .4 + Math.random() * 1.5, p: Math.random() * 6.28, v: .003 + Math.random() * .009 }));
    // base height, amplitude, wavelength, drift, opacity, band thickness, slope (all fractions of the canvas)
    const ribbons = [[.515, .02, 1.1, .0003, .23, .2, -.05], [.6, .013, 1.65, .00042, .105, .14, -.08], [.66, .01, .92, .00025, .062, .11, -.115]];
    function frame(stamp) {
      const canvas = host.querySelector('canvas.xmb-wave');
      if (!canvas || theme() !== 'ps3' || state.view !== 'home') { raf = 0; return; }
      // Unfocused or hidden: draw one still frame and stop until the window is back.
      const paused = document.hidden || !document.hasFocus();
      raf = paused ? 0 : requestAnimationFrame(frame);
      if (!paused && stamp - last < 33) return;
      t += Math.min(80, stamp - last || 33); last = stamp;
      const w = canvas.width = Math.round(innerWidth / 2), h = canvas.height = Math.round(innerHeight / 2);
      const g = canvas.getContext('2d');
      g.clearRect(0, 0, w, h);
      for (const [base, amp, freq, speed, alpha, thick, slope] of ribbons) {
        const y = (x, k) => h * (base + slope * (x / w) + amp * Math.sin((x / w) * freq * Math.PI + t * speed + k) + .011 * Math.sin((x / w) * 4.3 - t * speed * 1.9 + k));
        const body = new Path2D(), crest = new Path2D();
        for (let x = 0; x <= w; x += 8) crest.lineTo(x, y(x, 0));
        body.addPath(crest);
        for (let x = w; x >= 0; x -= 8) body.lineTo(x, y(x, 1.1) + h * thick);
        body.closePath();
        const fill = g.createLinearGradient(0, h * (base - .05), 0, h * (base + thick + .03));
        fill.addColorStop(0, 'rgba(255,255,255,0)');
        fill.addColorStop(.14, `rgba(255,255,255,${alpha})`);
        fill.addColorStop(.46, `rgba(255,255,255,${alpha * .46})`);
        fill.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = fill; g.fill(body);
        const bright = Math.min(.92, alpha * 2.2);
        g.lineCap = 'round';
        g.strokeStyle = `rgba(255,255,255,${bright * .14})`; g.lineWidth = 6; g.stroke(crest);
        g.strokeStyle = `rgba(255,255,255,${bright * .3})`; g.lineWidth = 2.4; g.stroke(crest);
        g.strokeStyle = `rgba(255,255,255,${bright})`; g.lineWidth = 1.2; g.stroke(crest);
      }
      for (const spark of sparks) {
        spark.x = (spark.x + spark.v * .05) % 1;
        const a = .22 + .3 * Math.sin(t * .002 + spark.p);
        g.fillStyle = `rgba(255,255,255,${Math.max(0, a)})`;
        g.beginPath(); g.arc(spark.x * w, (spark.y + .02 * Math.sin(t * .001 + spark.p)) * h, spark.s, 0, 6.28); g.fill();
      }
    }
    return { start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } } };
  })();
  addEventListener('focus', () => { if (theme() === 'ps3') xmbWave.start(); });
  document.addEventListener('visibilitychange', () => { if (theme() === 'ps3') xmbWave.start(); });

  // ---------- Settings shells: registry plumbing shared by PS4, Wii and 3DS (task S3) ----------
  // The three shells read the same registry as the PS3's: rows come from gSettings.layout(console), a row is only
  // drawn while gSettings.available(id) is true, and every value is read and written through gSettings. These
  // helpers hold the parts all three need, so each shell below owns only its own layout and navigation.
  const SETTING_GLYPHS = {
    volume: 'volume', mute: 'volume', soundEffects: 'volume', menuMusic: 'stream', menuMusicVolume: 'volume',
    brightness: 'tv', uiScale: 'fullscreen', textSize: 'language', tileRadius: 'grid', reducedMotion: 'ease',
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
  const settingGlyph = id => SETTING_GLYPHS[id] || 'settings';
  // Availability is asked once per console and cached for a few seconds: a screen with thirty rows would
  // otherwise ask Windows about the volume thirty times while it paints.
  const shellScans = new Map();
  async function scanShellLayout(id, force = false) {
    const g = window.gSettings;
    if (!g?.layout) return [];
    const cached = shellScans.get(id);
    if (!force && cached && Date.now() - cached.at < 30000) return cached.pages;
    const pages = [];
    for (const page of g.layout(id)) {
      const rows = [];
      for (const row of page.rows) {
        let available = false;
        try { available = await g.available(row.id); } catch { available = false; }
        rows.push({ id: row.id, available });
      }
      pages.push({ id: page.id, title: page.title, rows });
    }
    // A page none of whose rows can do anything here is not a place the player can go.
    const live = pages.filter(page => page.rows.some(row => row.available));
    shellScans.set(id, { at: Date.now(), pages: live });
    return live;
  }
  function forgetShellScan(id) { shellScans.delete(id); }
  // Read one page's real rows: availability first, then the value and, for a choice, the list of values. The
  // launcher's Settings form is filled from disk before a form-backed row is read, so saveSettingsForm cannot
  // save the dialog's unopened defaults over the player's accounts and display settings.
  async function loadShellRows(page, consoleId) {
    const rows = [];
    const g = window.gSettings;
    if (page.rows.some(row => PS3_FORM_ROWS.has(row.id))) await ps3SyncLauncherForm();
    for (const row of page.rows) {
      let available = row.available !== false;
      if (row.available === undefined) { try { available = await g.available(row.id); } catch { available = false; } }
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
  // A slider's filled fraction, for the small meters the shells draw beside a value.
  function settingPercent(row, value) {
    const min = Number.isFinite(Number(row.min)) ? Number(row.min) : 0;
    const max = Number.isFinite(Number(row.max)) ? Number(row.max) : 100;
    const span = max - min || 1;
    return Math.max(0, Math.min(100, ((Number(value) - min) / span) * 100));
  }
  // "40%", "On", "24-hour": the registry's value in the console's own words (PS3's formatter).
  const settingText = (row, value) => ps3Format(row, value);

  // =========================== PS4: the home screen ===========================
  // Measured from the 2013 home: the status/function row sits 78px down, square tiles are 214px from y 222,
  // the chosen tile grows to 376x433 from (328, 177) with its Start bar, the game name at y 536 and the
  // content cards from 611, and the dark hint bar starts at 944.
  let ps4Focus = 1, ps4Area = 'row', ps4Fn = 0, ps4Sub = 0;
  const PS4_FUNCTIONS = [['dashboard-store', 'shop', 'PlayStation Store', 'ps'], ['g-notifications', 'bell', 'Notifications', 'info'], ['g-friends', 'friends', 'Friends', 'friends'],
    ['g-account', 'contact', 'Profile', 'user'], ['g-account', 'trophy', 'Trophies', 'trophy'], ['settings', 'settings', 'Settings', 'settings'], ['power-menu', 'power', 'Power', 'off']];
  function ps4List() {
    return [{ label: "What's New", sub: 'See what your friends are up to', action: 'g-notifications', file: 'ps', glyph: 'friends', system: true, glass: true },
      ...games().slice(0, 14).map(gameItem),
      { label: 'PlayStation™Store', sub: 'Games and add-ons', action: 'dashboard-store', file: 'plus', glyph: 'shop', system: true, store: true },
      { label: 'Library', sub: 'All your games and apps', action: 'library', glyph: 'library', system: true, library: true }];
  }
  // The PlayStation button shapes, as the What's New tile showed them.
  const PS4_SHAPES = '<svg class="ps4-shapes" viewBox="0 0 48 48" aria-hidden="true"><rect x="5" y="5" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"/><path d="M35 5 L43 18 H27 Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="13" cy="35" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M30 28 L42 40 M42 28 L30 40" stroke="currentColor" stroke-width="2"/></svg>';
  // Same rule as the XMB: the shell, the tile row and the function area are built once, then only their
  // classes and offsets change, so the tiles can grow and slide and the function area can drop in.
  let ps4BuiltTiles = '';
  function renderPs4(rebuild = true) {
    if (ps4Set) { renderPs4Settings(); return; }
    const list = ps4List();
    ps4Focus = Math.max(0, Math.min(ps4Focus, list.length - 1));
    const sel = list[ps4Focus];
    const tileX = i => (i === ps4Focus ? 328 : i < ps4Focus ? 328 - (ps4Focus - i) * 232 : 709 + (i - ps4Focus - 1) * 226);
    const tile = (item, i) => `<button class="ps4-tile focusable${item.system ? ' system' : ''}${item.store ? ' store' : ''}${item.glass ? ' glass' : ''}${item.library ? ' library' : ''}" type="button" ${attrs(item)} data-ps4-index="${i}" aria-label="${esc(item.label)}"
      style="--x:${tileX(i)}${item.game ? `;--cover:${url(cover(item.game))}` : ''}">${item.game ? '' : item.store ? img(PS4I('ps'), icon('shop'), 'bag') : item.glass ? PS4_SHAPES : item.library ? '<span class="ps4-lib" aria-hidden="true"><i></i><i></i><i></i></span>' : icon(item.glyph)}<em>${item.game ? 'Start' : 'Open'}</em></button>`;
    const shell = host.querySelector('.ps4-home');
    if (!shell) {
      host.innerHTML = `<i class="ps4-art" aria-hidden="true"></i><i class="ps4-art" aria-hidden="true"></i>
        <div class="ps4-functions" aria-label="Function area"></div>
        <div class="ps4-home"><div class="ps4-row" role="list"></div><div class="ps4-under"></div></div>
        <div class="ps4-hints"></div>`;
      ps4BuiltTiles = '';
      ps4ArtFront = 1;
      // The shell was thrown away, so the two backdrop layers are empty again: forget which game's art the
      // old shell had, or the next render would think it is already showing and leave the screen flat.
      host.dataset.ps4Art = '';
      ps4ArtWanted = '';
    }
    const row = host.querySelector('.ps4-row'), functions = host.querySelector('.ps4-functions');
    const tilesKey = list.map(item => (item.game ? item.game.id : item.label)).join('|');
    if (rebuild || ps4BuiltTiles !== tilesKey) {
      row.innerHTML = list.map(tile).join('');
      ps4BuiltTiles = tilesKey;
    }
    [...row.children].forEach((el, i) => {
      el.style.setProperty('--x', String(tileX(i)));
      el.classList.toggle('sel', i === ps4Focus);
    });
    if (!functions.children.length) functions.innerHTML = PS4_FUNCTIONS.map(([action, glyph, label, file], i) => `<button class="ps4-fn focusable" type="button" data-action="${action}" data-ps4-fn="${i}" aria-label="${label}">${img(PS4I(file), icon(glyph))}<span>${label}</span></button>`).join('');
    [...functions.children].forEach((el, i) => el.classList.toggle('sel', ps4Area === 'fn' && i === ps4Fn));
    functions.classList.toggle('open', ps4Area === 'fn');
    host.querySelector('.ps4-home').classList.toggle('away', ps4Area === 'fn');
    host.querySelector('.ps4-under').innerHTML = `<div class="ps4-menu">${sel.game ? ['Overview', 'Recent Activity', 'Related Items'].map((label, i) => `<button class="ps4-sub focusable${ps4Area === 'sub' && ps4Sub === i ? ' sel' : ''}" type="button" data-action="g-ps4-overview" data-game-id="${esc(sel.game.id)}" data-ps4-sub="${i}">${label}</button>`).join('') : ''}</div>
      <div class="ps4-info"><h2>${esc(sel.label)}${sel.game && playtime(sel.game) ? `<em>${esc(playtime(sel.game))}</em>` : ''}</h2><div class="ps4-cards">${sel.game ? `<button class="ps4-card wide focusable${ps4Area === 'sub' && ps4Sub === 3 ? ' sel' : ''}" type="button" data-action="g-ps4-overview" data-game-id="${esc(sel.game.id)}" data-ps4-sub="3" data-g-wide-art="${esc(sel.game.id)}"><b>${esc(sel.game.lastPlayed ? 'Recently played' : 'Overview')}</b><small>${esc(sel.game.title)}</small></button><span class="ps4-ach"></span>` : `<p class="ps4-sub-copy">${esc(sel.sub || '')}</p>`}</div></div>`;
    // The content row is new text every time, so it comes in rather than swapping under the eye.
    if (!reducedMotion() && ps4LastUnder !== ps4Focus) {
      const under = host.querySelector('.ps4-under');
      under.classList.remove('ps4-swap'); void under.offsetWidth; under.classList.add('ps4-swap');
      clearTimeout(ps4SwapTimer);
      ps4SwapTimer = setTimeout(() => under.classList.remove('ps4-swap'), 420);
    }
    ps4LastUnder = ps4Focus;
    host.querySelector('.ps4-hints').innerHTML = `<span><i class="ps4-x"></i>Enter</span>${sel.game ? '<span><i class="ps4-opt">OPTIONS</i></span>' : ''}`;
    const online = state.gFriends?.online || 0;
    const alerts = online + (window.gDownloads?.active?.length || 0);
    const note = window.gDownloads?.active?.[0] ? `Downloading ${window.gDownloads.active[0].title}` : online ? `${online} friend${online === 1 ? ' is' : 's are'} online` : 'Welcome back';
    chrome.innerHTML = `<div class="ps4-status"><span class="ps4-s store">${img(PS4I('ps'), icon('shop'))}</span><span class="ps4-s note">${img(PS4I('info'), icon('bell'))}${alerts ? `<b>${alerts}</b>` : ''}<em>${esc(note)}</em></span>
      <span class="ps4-s friends">${img(PS4I('friends'), icon('friends'))}${online ? `<sup>${online}</sup>` : ''}</span><span class="ps4-s party"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a1 1 0 0 1-1-1zm16 0h-3v6h2a1 1 0 0 0 1-1z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></span>
      <span class="ps4-s me"><i>${avatar()}</i>${esc(name())}</span><span class="ps4-s trophy">${img(PS4I('trophy'), icon('trophy'))}<em>${esc(document.querySelector('#dashboard-gamerscore, .g-gamerscore')?.textContent?.replace(/\D/g, '') || '')}</em></span><span class="ps4-s clock">${esc(time())}</span></div>`;
    ps4Background(sel);
    if (sel.game) ps4Achievements(sel.game);
    const target = ps4Area === 'fn' ? host.querySelector('.ps4-fn.sel') : ps4Area === 'sub' ? host.querySelector(`[data-ps4-sub="${ps4Sub}"]`) : host.querySelector('.ps4-tile.sel');
    focusEl(target || host.querySelector('.ps4-tile.sel'));
  }
  let ps4LastUnder = -1, ps4SwapTimer = 0;
  function ps4Achievements(game) {
    achievements(game).then(items => {
      const slot = host.querySelector('.ps4-ach');
      if (!slot || host.querySelector('.ps4-card.wide')?.dataset.gameId !== game.id) return;
      const pick = [...items].sort((a, b) => (Number(b.unlocked) || 0) - (Number(a.unlocked) || 0) || (a.rarity ?? 100) - (b.rarity ?? 100)).slice(0, 2);
      // A game with no achievement data should still show the same rhythm as the console's three content
      // cards: the wide art card plus two square cards, rather than one lonely card and a gap.
      const cards = pick.length ? pick.map((a, i) => ({ label: a.title, sub: a.unlocked ? 'Trophy earned' : a.description || 'Not yet earned', subIndex: 4 + i, art: a.unlocked ? a.icon : a.lockedIcon || a.icon }))
        : [{ label: 'Trophy Collection', sub: 'Achievements and progress', subIndex: 4, glyph: 'trophy' }, { label: 'Captures', sub: 'Screenshots and clips', subIndex: 5, glyph: 'photo' }];
      slot.outerHTML = cards.map(card => `<button class="ps4-card focusable${card.glyph ? ' generic' : ''}${ps4Area === 'sub' && ps4Sub === card.subIndex ? ' sel' : ''}" type="button" data-action="g-ps4-overview" data-game-id="${esc(game.id)}" data-ps4-sub="${card.subIndex}"${card.art ? ` style="--ach:${url(card.art)}"` : ''}>${card.glyph ? `<span class="ps4-card-glyph" aria-hidden="true">${card.glyph === 'trophy' ? img(PS4I('trophy'), icon('star')) : icon(card.glyph)}</span>` : ''}<b>${esc(card.label)}</b><small>${esc(card.sub)}</small></button>`).join('');
      try { refreshFocusables(); } catch { /* Not ready. */ }
      // Moving right from the wide card can land on a card that the first paint did not have yet; put the
      // focus on the freshly inserted card so the d-pad does not appear to do nothing.
      if (ps4Area === 'sub' && ps4Sub >= 4) { const card = host.querySelector(`[data-ps4-sub="${ps4Sub}"]`); if (card) focusEl(card); }
    });
  }
  // Two stacked layers so the backdrop crossfades as the selection moves, instead of popping from one
  // game's art to the next. The layer only commits if its game is still the wanted one when the art
  // arrives, so moving quickly along the row can never put an earlier game's art back on top.
  let ps4ArtFront = 1, ps4ArtWanted = '';
  function ps4Background(item) {
    if (!item?.game || !window.gWideArt) return;
    const gameId = item.game.id;
    // Already on screen: claim it as the wanted art so a slower fetch for a tile the player has since
    // skipped past cannot land on top of it.
    if (host.dataset.ps4Art === gameId) { ps4ArtWanted = gameId; return; }
    if (ps4ArtWanted === gameId) return;
    ps4ArtWanted = gameId;
    window.gWideArt(item.game).then(src => {
      const layers = host.querySelectorAll('.ps4-art');
      if (!src || layers.length < 2 || !layers[0].isConnected || ps4ArtWanted !== gameId) return;
      host.dataset.ps4Art = gameId;
      const next = 1 - ps4ArtFront;
      layers[next].style.backgroundImage = cssUrl(src);
      layers[next].classList.add('on');
      layers[ps4ArtFront].classList.remove('on');
      ps4ArtFront = next;
    }).catch(() => {});
  }
  function ps4Move(direction) {
    if (ps4Set) { ps4SetMove(direction); return; }
    const list = ps4List();
    if (ps4Area === 'fn') {
      if (direction === 'down') { ps4Area = 'row'; play('back'); }
      else if (direction === 'left' || direction === 'right') { const next = Math.max(0, Math.min(PS4_FUNCTIONS.length - 1, ps4Fn + (direction === 'right' ? 1 : -1))); if (next === ps4Fn) return; ps4Fn = next; play('navigate'); }
      else return;
    } else if (ps4Area === 'sub') {
      const subs = [...host.querySelectorAll('[data-ps4-sub]')].map(el => Number(el.dataset.ps4Sub));
      if (direction === 'up' && ps4Sub > 0 && ps4Sub < 3) ps4Sub -= 1;
      else if (direction === 'up' && ps4Sub >= 3) { ps4Area = 'row'; }
      else if (direction === 'up') { ps4Area = 'fn'; }
      else if (direction === 'down' && ps4Sub < 2) ps4Sub += 1;
      else if (direction === 'down' && ps4Sub === 2) ps4Sub = 3;
      else if (direction === 'right' && ps4Sub < 3) ps4Sub = 3;
      else if (direction === 'right' && subs.includes(ps4Sub + 1)) ps4Sub += 1;
      else if (direction === 'left' && ps4Sub > 3) ps4Sub -= 1;
      else if (direction === 'left' && ps4Sub === 3) ps4Sub = 0;
      else return;
      play('navigate');
    } else {
      if (direction === 'up') { ps4Area = 'fn'; play('category'); }
      else if (direction === 'down') { if (!list[ps4Focus]?.game) return; ps4Area = 'sub'; ps4Sub = 0; play('navigate'); }
      else { const next = Math.max(0, Math.min(list.length - 1, ps4Focus + (direction === 'right' ? 1 : -1))); if (next === ps4Focus) return; ps4Focus = next; play('navigate'); }
    }
    renderPs4(false);
  }

  // ---------- PS4: Settings, driven by gSettings (task S3) ----------
  // The console's Settings app: a full-screen list of registry pages with their icons down the left and a blue
  // focus bar. Choosing a page slides the category column away and brings its rows in from the right; choosing a
  // row with a value opens the PS4 option dialog, while a toggle is a check box that changes in place. The
  // layout's last page, Advanced (launcher), runs the launcher's own Settings dialog — nothing here is fake.
  const PS4_PAGE_GLYPHS = { account: 'contact', notifications: 'bell', devices: 'controller', 'sound-screen': 'volume', network: 'globe', themes: 'color', system: 'settings', accessibility: 'ease', advanced: 'settings' };
  let ps4Set = null, ps4ScanToken = 0, ps4RowsToken = 0, ps4ReloadTimer = 0;
  const ps4SetGlyphs = () => (window.gSettings?.cached?.('enterButton') === 'o' ? { enter: '○', back: '✕' } : { enter: '✕', back: '○' });
  function ps4OpenSettings() {
    if (ps4Set) return;
    play('confirm');
    ps4Set = { level: 'pages', pages: null, page: null, rows: [], focus: 0, loading: true, error: '', overlay: null, anim: 'in' };
    renderPs4(false);
    ps4ScanSettings();
  }
  function ps4CloseSettings() {
    if (!ps4Set) return;
    play('back');
    ps4Set = null; ps4ReloadTimer && clearTimeout(ps4ReloadTimer); ps4ReloadTimer = 0;
    // Land back on the Settings function that opened it, not on a tile.
    ps4Area = 'fn'; ps4Fn = PS4_FUNCTIONS.findIndex(item => item[0] === 'settings');
    if (ps4Fn < 0) ps4Fn = 0;
    renderPs4(false);
  }
  function ps4ScanSettings(force = false) {
    if (!ps4Set) return;
    const token = ++ps4ScanToken;
    scanShellLayout('ps4', force).then(pages => {
      if (token !== ps4ScanToken || !ps4Set || ps4Set.level !== 'pages') return;
      ps4Set.pages = pages;
      ps4Set.loading = false;
      ps4Set.focus = Math.min(ps4Set.focus, Math.max(0, pages.length - 1));
      renderPs4(false);
    }).catch(error => {
      if (token !== ps4ScanToken || !ps4Set) return;
      ps4Set.loading = false;
      ps4Set.error = error?.message || 'Could not read the settings on this PC.';
      renderPs4(false);
    });
  }
  function ps4SetBack() {
    if (!ps4Set) return false;
    if (ps4Set.overlay) { ps4CancelOverlay(); return true; }
    if (ps4Set.level === 'rows') {
      play('back');
      ps4Set.level = 'pages'; ps4Set.page = null; ps4Set.rows = []; ps4Set.anim = 'back';
      ps4Set.focus = Math.max(0, Math.min(ps4Set.pageIndex || 0, (ps4Set.pages?.length || 1) - 1));
      renderPs4(false);
      return true;
    }
    ps4CloseSettings();
    return true;
  }
  async function ps4OpenPage(id) {
    const page = ps4Set?.pages?.find(item => item.id === id);
    if (!page) return;
    // Advanced (launcher) is one real action, not a page with a single row to open.
    if (page.rows.length === 1 && page.rows[0].id === 'launcherSettings') { ps4RunLauncher(); return; }
    play('confirm');
    ps4Set.pageIndex = ps4Set.focus;
    ps4Set.level = 'rows'; ps4Set.page = page; ps4Set.rows = []; ps4Set.focus = 0;
    ps4Set.loading = true; ps4Set.error = ''; ps4Set.overlay = null; ps4Set.anim = 'deep';
    renderPs4(false);
    const token = ++ps4RowsToken;
    try {
      const rows = await loadShellRows(page, 'ps4');
      if (token !== ps4RowsToken || !ps4Set || ps4Set.page !== page) return;
      ps4Set.rows = rows;
      ps4Set.loading = false;
      ps4Set.focus = Math.min(ps4Set.focus, Math.max(0, rows.length - 1));
      renderPs4(false);
    } catch (error) {
      if (token !== ps4RowsToken || !ps4Set || ps4Set.page !== page) return;
      ps4Set.loading = false;
      ps4Set.error = error?.message || 'Could not read these settings.';
      renderPs4(false);
    }
  }
  function ps4RunLauncher() {
    play('confirm');
    ps4Set = null; ps4ReloadTimer && clearTimeout(ps4ReloadTimer); ps4ReloadTimer = 0;
    renderPs4(false);
    Promise.resolve(window.gSettings?.set('launcherSettings', null)).catch(error => {
      if (typeof showToast === 'function') showToast(error?.message || 'The launcher settings are unavailable.');
    });
  }
  async function ps4SetValue(id, value) {
    const state = ps4Set;
    const row = state?.rows.find(item => item.id === id);
    if (!state || !row) return;
    const previous = row.value;
    row.value = value;
    renderPs4(false);
    try {
      if (PS3_FORM_ROWS.has(id)) await ps3SyncLauncherForm();
      await window.gSettings.set(id, value);
      const fresh = await window.gSettings.get(id).catch(() => value);
      if (ps4Set !== state) return;
      row.value = fresh;
      play('confirm');
    } catch (error) {
      if (ps4Set !== state) return;
      row.value = previous;
      play('back');
      if (typeof showToast === 'function') showToast(error?.message || 'Could not change this setting.');
    }
    if (ps4Set === state) renderPs4(false);
  }
  function ps4OpenRow(index) {
    const row = ps4Set?.rows?.[index];
    if (!row) return;
    if (row.kind === 'action') {
      play('confirm');
      Promise.resolve(window.gSettings.set(row.id, null)).catch(error => {
        if (typeof showToast === 'function') showToast(error?.message || 'That action is unavailable.');
      }).then(() => window.gSettings.get(row.id).then(value => {
        if (ps4Set?.rows[index] === row) { row.value = value; renderPs4(false); }
      }).catch(() => {}));
      return;
    }
    if (row.kind === 'toggle') { ps4SetValue(row.id, !row.value); return; }
    if (row.kind === 'info') {
      play('confirm');
      ps4Set.overlay = { mode: 'info', row, options: [], selected: 0, value: null, saving: false, error: '' };
    } else if (row.kind === 'slider') {
      play('confirm');
      const min = Number.isFinite(Number(row.min)) ? Number(row.min) : 0;
      const max = Number.isFinite(Number(row.max)) ? Number(row.max) : 100;
      const raw = Number(row.value);
      ps4Set.overlay = { mode: 'slider', row, options: [], selected: 0, min, max, step: Number(row.step) || 1, value: Number.isFinite(raw) ? Math.max(min, Math.min(max, raw)) : min, saving: false, error: '' };
    } else if (row.kind === 'choice') {
      if (!row.options?.length) { if (typeof showToast === 'function') showToast('That setting has no choices right now.'); return; }
      play('confirm');
      ps4Set.overlay = { mode: 'choice', row, options: row.options, selected: Math.max(0, row.options.findIndex(option => option.value === row.value)), value: null, saving: false, error: '' };
    } else return;
    renderPs4(false);
  }
  function ps4CancelOverlay() {
    if (!ps4Set?.overlay || ps4Set.overlay.saving) return;
    play('back');
    ps4Set.overlay = null;
    renderPs4(false);
  }
  async function ps4ConfirmOverlay() {
    const state = ps4Set;
    const overlay = state?.overlay;
    if (!state || !overlay || overlay.saving) return;
    if (overlay.mode === 'info') { ps4CancelOverlay(); return; }
    const value = overlay.mode === 'slider' ? overlay.value : overlay.options[overlay.selected]?.value;
    overlay.saving = true; overlay.error = '';
    renderPs4(false);
    try {
      if (PS3_FORM_ROWS.has(overlay.row.id)) await ps3SyncLauncherForm();
      await window.gSettings.set(overlay.row.id, value);
      const fresh = await window.gSettings.get(overlay.row.id).catch(() => value);
      if (ps4Set !== state) return;
      overlay.row.value = fresh;
      ps4Set.overlay = null;
      play('confirm');
    } catch (error) {
      if (ps4Set !== state) return;
      overlay.saving = false;
      overlay.error = error?.message || 'Could not change this setting.';
      play('back');
    }
    if (ps4Set === state) renderPs4(false);
  }
  function ps4OverlayMove(direction) {
    const overlay = ps4Set?.overlay;
    if (!overlay || overlay.saving || overlay.mode === 'info') return;
    if (overlay.mode === 'slider') {
      if (direction !== 'left' && direction !== 'right') return;
      const next = Math.max(overlay.min, Math.min(overlay.max, overlay.value + (direction === 'right' ? overlay.step : -overlay.step)));
      if (next === overlay.value) return;
      overlay.value = Number(next.toFixed(6));
      play('navigate');
      renderPs4(false);
      return;
    }
    if (direction !== 'up' && direction !== 'down') return;
    const next = Math.max(0, Math.min(overlay.options.length - 1, overlay.selected + (direction === 'down' ? 1 : -1)));
    if (next === overlay.selected) return;
    overlay.selected = next;
    play('navigate');
    renderPs4(false);
  }
  function ps4Seek(event) {
    const overlay = ps4Set?.overlay;
    const track = host.querySelector('.ps4-set-track');
    if (!overlay || overlay.mode !== 'slider' || !track) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const step = overlay.step || 1;
    const value = overlay.min + Math.round((fraction * (overlay.max - overlay.min)) / step) * step;
    overlay.value = Number(Math.max(overlay.min, Math.min(overlay.max, value)).toFixed(6));
    play('navigate');
    renderPs4(false);
  }
  function ps4SetMove(direction) {
    if (!ps4Set) return;
    if (ps4Set.overlay) { ps4OverlayMove(direction); return; }
    const count = ps4Set.level === 'pages' ? (ps4Set.pages?.length || 0) : ps4Set.rows.length;
    if (!count) return;
    if (ps4Set.level === 'rows' && direction === 'left') { ps4SetBack(); return; }
    if (direction !== 'up' && direction !== 'down') return;
    const next = Math.max(0, Math.min(count - 1, ps4Set.focus + (direction === 'down' ? 1 : -1)));
    if (next === ps4Set.focus) return;
    ps4Set.focus = next;
    ps4Set.anim = '';
    play('navigate');
    renderPs4(false);
  }
  function ps4QueueReload() {
    if (!ps4Set || ps4ReloadTimer) return;
    ps4ReloadTimer = setTimeout(() => {
      ps4ReloadTimer = 0;
      if (!ps4Set || theme() !== 'ps4' || document.querySelector('dialog[open]')) return;
      forgetShellScan('ps4');
      const state = ps4Set;
      if (state.level === 'rows' && state.page) {
        const page = state.page, focus = state.focus, token = ++ps4RowsToken;
        loadShellRows(page, 'ps4').then(rows => {
          if (token !== ps4RowsToken || ps4Set !== state) return;
          state.rows = rows;
          state.loading = false;
          state.focus = Math.min(focus, Math.max(0, rows.length - 1));
          if (!rows.length) { state.level = 'pages'; state.page = null; ps4ScanSettings(true); }
          renderPs4(false);
        }).catch(() => {});
      } else if (state.level === 'pages') {
        ps4ScanSettings(true);
      }
    }, 180);
  }
  let ps4SetPageKey = '', ps4SetRowKey = '', ps4SetOverlayKey = '', ps4SetAnimTimer = 0;
  function renderPs4Settings() {
    if (!ps4Set) { renderPs4(); return; }
    chrome.innerHTML = '';
    let shell = host.querySelector('.ps4-set');
    if (!shell) {
      host.innerHTML = `<i class="ps4-set-bg" aria-hidden="true"></i>
        <div class="ps4-set">
          <div class="ps4-set-head"><button class="ps4-set-back focusable" type="button" data-action="ps4-set-back" aria-label="Back"><span aria-hidden="true">‹</span></button><span class="ps4-set-kicker"></span><strong class="ps4-set-title"></strong></div>
          <div class="ps4-set-pages" role="list"></div>
          <div class="ps4-set-rows" role="list"></div>
          <div class="ps4-set-load" role="status"></div>
          <div class="ps4-set-hints"></div>
          <div class="ps4-set-overlay" aria-hidden="true"><div class="ps4-set-dialog" role="dialog" aria-modal="false" aria-label="Setting"></div></div>
        </div>`;
      ps4SetPageKey = ps4SetRowKey = ps4SetOverlayKey = '';
      shell = host.querySelector('.ps4-set');
    }
    const state = ps4Set;
    const pages = state.pages || [];
    const rows = state.rows || [];
    shell.dataset.level = state.level;
    shell.classList.toggle('is-deep', state.level === 'rows');
    shell.dataset.anim = state.anim || '';
    if (state.anim) {
      clearTimeout(ps4SetAnimTimer);
      ps4SetAnimTimer = setTimeout(() => {
        if (!ps4Set) return;
        ps4Set.anim = '';
        const node = host.querySelector('.ps4-set');
        if (node) node.dataset.anim = '';
      }, 420);
    }
    const deep = state.level === 'rows';
    shell.querySelector('.ps4-set-kicker').textContent = deep ? 'Settings' : 'PlayStation 4';
    shell.querySelector('.ps4-set-title').textContent = deep ? (state.page?.title || 'Settings') : 'Settings';
    shell.querySelector('.ps4-set-back').setAttribute('aria-label', deep ? 'Back to Settings' : 'Close Settings');
    // Pages
    const pageEl = shell.querySelector('.ps4-set-pages');
    const pageKey = `${state.loading && !pages.length ? 'load' : ''}|${state.error}|${pages.map(page => `${page.id}:${page.title}`).join('|')}`;
    if (pageKey !== ps4SetPageKey) {
      ps4SetPageKey = pageKey;
      const scroll = pageEl.scrollTop;
      pageEl.innerHTML = pages.length
        ? pages.map((page, index) => `<button class="ps4-set-item focusable" type="button" data-action="ps4-set-page" data-page="${esc(page.id)}" data-index="${index}" role="listitem" aria-label="${esc(page.title)}">
            <span class="ps4-set-icon" aria-hidden="true">${icon(PS4_PAGE_GLYPHS[page.id] || 'settings')}</span>
            <span class="ps4-set-label">${esc(page.title)}</span>
            <span class="ps4-set-chevron" aria-hidden="true">›</span>
          </button>`).join('')
        : `<p class="ps4-set-note">${state.loading ? 'Reading settings…' : esc(state.error || 'No settings are available on this PC right now.')}</p>`;
      pageEl.scrollTop = scroll;
    }
    [...pageEl.querySelectorAll('.ps4-set-item')].forEach((el, index) => el.classList.toggle('sel', !deep && index === state.focus));
    // Rows
    const rowsEl = shell.querySelector('.ps4-set-rows');
    const rowKey = `${state.page?.id || ''}|${state.loading ? 'load' : ''}|${state.error}|${rows.map(row => `${row.id}:${row.kind}:${row.value}`).join('|')}`;
    if (rowKey !== ps4SetRowKey) {
      ps4SetRowKey = rowKey;
      const scroll = rowsEl.scrollTop;
      rowsEl.innerHTML = rows.length
        ? rows.map((row, index) => {
          const value = settingText(row, row.value);
          const meter = row.kind === 'slider' ? `<span class="ps4-set-meter" aria-hidden="true"><i style="width:${settingPercent(row, row.value)}%"></i></span>` : '';
          const check = row.kind === 'toggle' ? `<span class="ps4-set-check${row.value ? ' on' : ''}" aria-hidden="true">${row.value ? '✓' : ''}</span>` : '';
          return `<button class="ps4-set-row focusable" type="button" data-action="ps4-set-row" data-row="${index}" role="listitem" aria-label="${esc(row.label)}${value ? `, ${esc(value)}` : ''}">
            <span class="ps4-set-icon" aria-hidden="true">${icon(settingGlyph(row.id))}</span>
            <span class="ps4-set-label">${esc(row.label)}</span>
            ${meter}${value ? `<span class="ps4-set-value">${esc(value)}</span>` : ''}${check}
            ${row.kind === 'choice' || row.kind === 'action' ? '<span class="ps4-set-chevron" aria-hidden="true">›</span>' : ''}
          </button>`;
        }).join('')
        : `<p class="ps4-set-note">${state.loading ? 'Reading settings…' : esc(state.error || 'Nothing on this page is available on this PC.')}</p>`;
      rowsEl.scrollTop = scroll;
    }
    [...rowsEl.querySelectorAll('.ps4-set-row')].forEach((el, index) => el.classList.toggle('sel', deep && index === state.focus));
    shell.querySelector('.ps4-set-load').textContent = state.error || '';
    // Hints
    const glyphs = ps4SetGlyphs();
    shell.querySelector('.ps4-set-hints').innerHTML = deep
      ? `<span><b>${glyphs.enter}</b> Select</span><span><b>${glyphs.back}</b> Back</span>`
      : `<span><b>${glyphs.enter}</b> Open</span><span><b>${glyphs.back}</b> Close</span>`;
    // The option dialog
    const overlayEl = shell.querySelector('.ps4-set-overlay');
    const dialog = shell.querySelector('.ps4-set-dialog');
    const overlay = state.overlay;
    overlayEl.classList.toggle('open', Boolean(overlay));
    overlayEl.setAttribute('aria-hidden', String(!overlay));
    const overlayKey = overlay ? `${overlay.mode}|${overlay.row.id}|${overlay.selected}|${overlay.value}|${overlay.saving ? 1 : 0}|${overlay.error}` : '';
    if (overlayKey !== ps4SetOverlayKey) {
      ps4SetOverlayKey = overlayKey;
      if (!overlay) {
        dialog.innerHTML = '';
        dialog.removeAttribute('tabindex');
        delete dialog.dataset.action;
      } else {
        let body = '';
        if (overlay.mode === 'slider') {
          body = `<div class="ps4-set-slider focusable" role="slider" tabindex="-1" data-action="ps4-set-slider" aria-label="${esc(overlay.row.label)}" aria-valuemin="${overlay.min}" aria-valuemax="${overlay.max}" aria-valuenow="${overlay.value}">
            <span class="ps4-set-arrow" aria-hidden="true">◀</span><span class="ps4-set-track"><i style="width:${settingPercent(overlay, overlay.value)}%"></i><b style="left:${settingPercent(overlay, overlay.value)}%"></b></span><span class="ps4-set-arrow" aria-hidden="true">▶</span></div>
            <strong class="ps4-set-slider-value">${esc(settingText(overlay.row, overlay.value))}</strong>`;
        } else if (overlay.mode === 'choice') {
          body = `<div class="ps4-set-options" role="listbox" aria-label="${esc(overlay.row.label)}">${overlay.options.map((option, index) => `<button class="ps4-set-option focusable${index === overlay.selected ? ' on' : ''}" type="button" role="option" aria-selected="${index === overlay.selected}" data-action="ps4-set-option" data-option="${index}"><span>${esc(option.label)}</span>${index === overlay.selected ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>`;
        } else {
          body = `<p class="ps4-set-info">${esc(settingText(overlay.row, overlay.row.value) || 'Unavailable')}</p>`;
        }
        const hint = overlay.mode === 'info'
          ? `<button class="ps4-set-action focusable" type="button" data-action="ps4-set-cancel"><b>${glyphs.back}</b> Back</button>`
          : `<button class="ps4-set-action focusable" type="button" data-action="ps4-set-commit"><b>${glyphs.enter}</b> Select</button><button class="ps4-set-action focusable" type="button" data-action="ps4-set-cancel"><b>${glyphs.back}</b> Back</button>`;
        dialog.innerHTML = `<h3>${esc(overlay.row.label)}</h3>${body}<p class="ps4-set-dialog-hint">${overlay.error ? `<span class="ps4-set-error">${esc(overlay.error)}</span>` : ''}${hint}${overlay.saving ? '<span class="ps4-set-saving">Saving…</span>' : ''}</p>`;
        if (overlay.mode === 'info') { dialog.setAttribute('tabindex', '-1'); dialog.dataset.action = 'ps4-set-cancel'; }
        else { dialog.removeAttribute('tabindex'); delete dialog.dataset.action; }
      }
    }
    // Focus: the open dialog's own control, else the chosen row, else the chosen page.
    let target = null;
    if (overlay) target = overlay.mode === 'slider' ? shell.querySelector('.ps4-set-slider') : overlay.mode === 'info' ? dialog : shell.querySelector('.ps4-set-option.on');
    else if (deep) target = rowsEl.querySelector('.ps4-set-row.sel');
    else target = pageEl.querySelector('.ps4-set-item.sel');
    focusEl(target || shell.querySelector('.ps4-set-back'));
    // The console's list scrolls under the focus bar; keep the chosen row in view without moving the page.
    const pane = overlay ? null : deep ? rowsEl : pageEl;
    if (pane && target) {
      const top = target.offsetTop, bottom = top + target.offsetHeight;
      if (top < pane.scrollTop) pane.scrollTop = top;
      else if (bottom > pane.scrollTop + pane.clientHeight) pane.scrollTop = bottom - pane.clientHeight;
    }
  }
  function ps4SetEnter() {
    if (!ps4Set) return false;
    if (ps4Set.overlay) { if (ps4Set.overlay.mode === 'info') ps4CancelOverlay(); else ps4ConfirmOverlay(); return true; }
    if (ps4Set.level === 'rows') { ps4OpenRow(ps4Set.focus); return true; }
    const page = ps4Set.pages?.[ps4Set.focus];
    if (page) ps4OpenPage(page.id);
    return true;
  }

  // =========================== Wii: the Wii Menu ===========================
  // Measured from the Wii Menu at 1080p: 4×3 channels of 384×206 from (160, 91), 18px apart; the bottom bar
  // starts at 780 and dips to 896 under the clock; the Wii and mail buttons are centred at 908.
  let wiiPage = 0, wiiFocus = 0, wiiPreview = null, wiiBar = -1;
  let wiiShownPage = -1, wiiPageDir = 0;
  function wiiChannels() {
    const recent = games();
    return [
      { label: 'Disc Channel', sub: recent[0]?.title, action: recent[0] ? 'g-retro-preview' : 'g-disc-tray', data: recent[0] ? { 'game-id': recent[0].id } : {}, kind: 'disc', game: recent[0] },
      { label: 'Mii Channel', action: 'g-account', kind: 'mii' },
      { label: 'Photo Channel', action: 'g-retro-captures', kind: 'photo' },
      { label: 'Wii Shop Channel', action: 'dashboard-store', kind: 'shop' },
      { label: 'Forecast Channel', action: 'g-retro-weather', kind: 'forecast' },
      { label: 'News Channel', action: 'g-notifications', kind: 'news' },
      ...recent.slice(1, 42).map(game => ({ label: game.title, action: 'g-retro-preview', data: { 'game-id': game.id }, game, kind: 'game' }))
    ];
  }
  const wiiArt = ch => ({
    disc: '<span class="wii-disc" aria-hidden="true"></span>',
    mii: WIII('miichannel.jpg') ? `<span class="wii-fill" style="background-image:${url(WIII('miichannel.jpg'))}"></span>` : '<span class="wii-mii" aria-hidden="true"><i></i></span><span class="wii-title dark">Mii Channel</span>',
    photo: '<span class="wii-photo" aria-hidden="true"><i></i><i></i><i></i></span><span class="wii-title">Photo Channel</span>',
    shop: '<span class="wii-bag" aria-hidden="true"><b>Wii</b></span><span class="wii-title shop">Wii Shop Channel</span>',
    forecast: '<span class="wii-title">Forecast Channel</span><span class="wii-globe" aria-hidden="true"></span>',
    news: '<span class="wii-title">News Channel</span><span class="wii-globe news" aria-hidden="true"></span>',
    game: ''
  })[ch.kind] || '';
  function renderWii() {
    if (wiiPreview) { renderWiiPreview(); return; }
    const channels = wiiChannels();
    const pages = Math.max(1, Math.ceil(channels.length / 12));
    wiiPage = Math.max(0, Math.min(wiiPage, pages - 1));
    const shown = channels.slice(wiiPage * 12, wiiPage * 12 + 12);
    while (shown.length < 12) shown.push(null);
    wiiFocus = Math.min(wiiFocus, 11);
    // A page arrives from the side the player moved toward; focus moves within a page never rebuild it.
    wiiPageDir = wiiShownPage >= 0 && wiiPage !== wiiShownPage ? (wiiPage > wiiShownPage ? 1 : -1) : 0;
    wiiShownPage = wiiPage;
    const staticArt = WIII('channel-spritesheet.png');
    const tile = (ch, i) => !ch
      ? `<span class="wii-ch empty${staticArt ? ' textured' : ''}" data-wii-index="${i}" style="--i:${i}" aria-hidden="true"></span>`
      : `<button class="wii-ch focusable ${ch.kind}" type="button" ${attrs(ch)} data-wii-index="${i}" style="--i:${i}" aria-label="${esc(ch.label)}"${ch.kind === 'game' ? ` data-g-wide-art="${esc(ch.game.id)}"` : ''}><span class="wii-drift" aria-hidden="true">${wiiArt(ch)}</span><span class="wii-balloon">${esc(ch.label)}${ch.game && playtime(ch.game) ? `<em>${esc(playtime(ch.game))}</em>` : ''}</span></button>`;
    host.innerHTML = `<div class="wii-bands" aria-hidden="true">${[0, 1, 2].map(r => `<span style="--row:${r}"></span>`).join('')}</div>
      <div class="wii-grid${wiiPageDir ? (wiiPageDir > 0 ? ' wii-next' : ' wii-prev') : ''}"${staticArt ? ` style="--wii-static:${url(staticArt)}"` : ''}>${shown.map(tile).join('')}
        ${[0, 1, 2].map(r => `<span class="wii-ch empty peek${staticArt ? ' textured' : ''}" style="--i:${12 + r};--r:${r}" aria-hidden="true"></span>`).join('')}</div>
      ${wiiPage > 0 ? '<button class="wii-arrow left focusable" type="button" data-action="g-wii-page" data-dir="-1" aria-label="Previous page"></button>' : ''}${wiiPage < pages - 1 ? '<button class="wii-arrow right focusable" type="button" data-action="g-wii-page" data-dir="1" aria-label="Next page"></button>' : ''}`;
    const ring = (side, file) => `<span class="wii-ring ${side}${WIII(file) ? ' art' : ''}" aria-hidden="true"${WIII(file) ? ` style="background-image:${url(WIII(file))}"` : ''}></span>`;
    chrome.innerHTML = `<div class="wii-bar"><span class="wii-glow" aria-hidden="true"></span><svg class="wii-bar-shape" viewBox="0 0 1920 300" preserveAspectRatio="none" aria-hidden="true"><defs>
      <linearGradient id="wii-bar-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4b8bc"/><stop offset=".07" stop-color="#c8cbcf"/><stop offset=".42" stop-color="#d5d7da"/><stop offset=".84" stop-color="#d3d5d9"/><stop offset="1" stop-color="#c9ccd2"/></linearGradient>
      <radialGradient id="wii-bar-sheen" cx=".5" cy=".04" r=".62"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <pattern id="wii-bar-grain" width="8" height="4" patternUnits="userSpaceOnUse"><rect width="8" height="1" fill="rgba(0,0,0,.028)"/></pattern>
      <clipPath id="wii-bar-clip"><path d="M0 0H360C400 0 470 116 630 116H1290C1450 116 1520 0 1560 0H1920V300H0Z"/></clipPath></defs>
      <path d="M0 0H360C400 0 470 116 630 116H1290C1450 116 1520 0 1560 0H1920V300H0Z" fill="url(#wii-bar-fill)"/>
      <path d="M0 0H360C400 0 470 116 630 116H1290C1450 116 1520 0 1560 0H1920V300H0Z" fill="url(#wii-bar-sheen)"/>
      <path d="M0 0H360C400 0 470 116 630 116H1290C1450 116 1520 0 1560 0H1920V300H0Z" fill="url(#wii-bar-grain)"/>
      <g clip-path="url(#wii-bar-clip)"><path d="M0 0H360C400 0 470 116 630 116H1290C1450 116 1520 0 1560 0H1920" fill="none" stroke="#f4fbff" stroke-width="11" transform="translate(0 5)"/></g>
      <path d="M0 0H360C400 0 470 116 630 116H1290C1450 116 1520 0 1560 0H1920" fill="none" stroke="#38c2ef" stroke-width="4"/></svg>
      ${ring('left', 'left-button.png')}${ring('right', 'right-button.png')}
      <button class="wii-btn focusable${wiiBar === 0 ? ' sel' : ''}" type="button" data-action="settings" aria-label="Wii Options">${img(WIII('wii-button.png'), '<b>Wii</b>')}</button>
      <span class="wii-sd" aria-hidden="true"></span>
      <span class="wii-clock">${segClock()}</span><span class="wii-date">${esc(weekday())} ${esc(dayMonth())}</span>
      <button class="wii-mail focusable${wiiBar === 1 ? ' sel' : ''}" type="button" data-action="g-notifications" aria-label="Wii Message Board">${img(WIII('mail-button.png'), '<i></i>')}</button></div>`;
    const target = wiiBar >= 0 ? chrome.querySelector(wiiBar === 0 ? '.wii-btn' : '.wii-mail') : host.querySelector(`.wii-ch[data-wii-index="${wiiFocus}"].focusable`) || host.querySelector('.wii-ch.focusable');
    focusEl(target);
  }
  // The Wii clock is a seven-segment display: soft bevelled segments, each digit grouped so the entry can
  // count them in one at a time.
  const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const SEG_RECT = { a: [9, 2, 22, 5], b: [32, 8, 5, 26], c: [32, 38, 5, 26], d: [9, 65, 22, 5], e: [3, 38, 5, 26], f: [3, 8, 5, 26], g: [9, 33.5, 22, 5] };
  function segClock() {
    // Read the chosen clock format through the registry instead of the locale's own 12/24-hour choice.
    const text = window.gSettings?.formatClock ? window.gSettings.formatClock(now()) : new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).format(now());
    const [, hour = '12', minute = '00', period = ''] = /(\d{1,2})[:.](\d{2})\s*([AP]M)?/i.exec(text) || [];
    const digit = (d, x) => [...(SEGMENTS[d] || '')].map(s => { const [rx, ry, w, h] = SEG_RECT[s]; return `<rect x="${x + rx}" y="${ry}" width="${w}" height="${h}" rx="2"/>`; }).join('');
    const clockText = hour.padStart(2, ' ') + minute;
    let x = 0, out = '', step = 0;
    [...clockText].forEach((d, i) => {
      if (i === 2) {
        out += `<g class="wii-seg" style="--d:${step++};fill:url(#wii-seg-fill)"><rect x="${x + 4}" y="20" width="5" height="5" rx="1"/><rect x="${x + 4}" y="46" width="5" height="5" rx="1"/></g>`;
        x += 16;
      }
      if (d !== ' ') out += `<g class="wii-seg" style="--d:${step++};fill:url(#wii-seg-fill)">${digit(d, x)}</g>`;
      x += 46;
    });
    return `<svg viewBox="0 0 ${x} 72" aria-label="${esc(time())}"><defs><linearGradient id="wii-seg-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0c0c0"/><stop offset=".55" stop-color="#a4a4a4"/><stop offset="1" stop-color="#8d8d8d"/></linearGradient></defs>${out}</svg>${period ? `<em>${esc(period.toUpperCase())}</em>` : ''}`;
  }
  function renderWiiPreview() {
    const game = findGame(wiiPreview);
    if (!game) { wiiPreview = null; renderWii(); return; }
    // The preview grows out of the channel that was chosen, so the screen has a sense of place.
    const source = host.querySelector(`.wii-ch[data-wii-index="${wiiFocus}"].focusable`) || host.querySelector('.wii-ch.focused');
    const rect = source?.getBoundingClientRect();
    const calm = document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = rect && !calm
      ? `--wii-from-x:${Math.round(rect.left + rect.width / 2 - innerWidth / 2)}px;--wii-from-y:${Math.round(rect.top + rect.height / 2 - innerHeight / 2)}px;--wii-from-s:${Math.max(.18, Math.min(.42, rect.width / innerWidth)).toFixed(3)}`
      : '';
    const pill = (label, action, extra = '') => `<button class="wii-pbtn focusable" type="button" data-action="${action}"${extra}>${WIII('btn-texture.png') ? `<i class="cap l" style="background-image:${url(WIII('btn-left.png'))}"></i><i class="mid" style="background-image:${url(WIII('btn-texture.png'))}"></i><i class="cap r" style="background-image:${url(WIII('btn-right.png'))}"></i>` : ''}<span>${label}</span></button>`;
    host.innerHTML = `<div class="wii-preview"${from ? ` style="${from}"` : ''}><div class="wii-banner" data-g-wide-art="${esc(game.id)}"><strong>${esc(game.title)}</strong></div>
      <div class="wii-preview-bar"><span class="wii-preview-glow" aria-hidden="true"></span>${pill('Wii Menu', 'g-wii-back')}${pill('Start', 'select-game', ` data-game-id="${esc(game.id)}" data-retro-boot="1" data-start="1"`)}</div></div>`;
    chrome.innerHTML = '';
    focusEl(host.querySelector('.wii-pbtn[data-start]'));
  }
  function wiiMove(direction) {
    if (wiiPreview) { const buttons = [...host.querySelectorAll('.wii-pbtn')]; const index = buttons.indexOf(document.activeElement.closest?.('.wii-pbtn')); const next = buttons[Math.max(0, Math.min(buttons.length - 1, index + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0)))]; if (next && next !== buttons[index]) { play('navigate'); focusEl(next); } return; }
    const channels = wiiChannels(), pages = Math.max(1, Math.ceil(channels.length / 12));
    const filled = index => index < Math.max(0, channels.length - wiiPage * 12);
    if (wiiBar >= 0) {
      if (direction === 'up') { wiiBar = -1; play('navigate'); }
      else if (direction === 'left' || direction === 'right') { const next = direction === 'right' ? 1 : 0; if (next === wiiBar) return; wiiBar = next; play('navigate'); }
      else return;
      renderWii(); return;
    }
    const col = wiiFocus % 4, row = Math.floor(wiiFocus / 4);
    let next = wiiFocus;
    if (direction === 'right') { if (col < 3) next += 1; else if (wiiPage < pages - 1) { wiiPage += 1; wiiFocus = row * 4; play('category'); renderWii(); return; } }
    if (direction === 'left') { if (col > 0) next -= 1; else if (wiiPage > 0) { wiiPage -= 1; wiiFocus = row * 4 + 3; play('category'); renderWii(); return; } }
    if (direction === 'down') { if (row < 2 && filled(wiiFocus + 4)) next += 4; else { wiiBar = col < 2 ? 0 : 1; play('navigate'); renderWii(); return; } }
    if (direction === 'up' && row > 0) next -= 4;
    if (next === wiiFocus || !filled(next)) return;
    wiiFocus = next; play('navigate');
    focusEl(host.querySelector(`.wii-ch[data-wii-index="${wiiFocus}"]`));
  }

  // =========================== 3DS: the HOME Menu ===========================
  // One full-bleed screen after iiSU: three rows of large square icons under the selected app's banner.
  // Five columns are in view at a time; the rail slides one column at a time instead of being rebuilt.
  let dsFocus = 0, dsTool = -1, dsArtToken = 0;
  const DS_ROWS = 3, DS_COLS = 5, DS_PITCH = 300;
  const DS_TOOLS = [['settings', 'System Settings', 'home'], ['library', 'Game Notes', 'notes'], ['g-friends', 'Friend List', 'friends'], ['g-notifications', 'Notifications', 'notes2'], ['toggle-search', 'Internet Browser', 'web'], ['g-account', 'Miiverse', 'miiverse']];
  const DS_SVG = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 12 12 4l9 8h-3v7H6v-7z" fill="#8aa7c7"/><path d="M14 13l5 5-1.6 1.6-5-5z" fill="#6c87a8"/></svg>',
    notes: '<svg viewBox="0 0 24 24"><path d="M5 19l1-4L16 5l3 3L9 18z" fill="#f7cf1f" stroke="#c9a400" stroke-width="1"/><path d="M5 19l1-4 3 3z" fill="#555"/></svg>',
    friends: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="#fff" stroke="#f08b1e" stroke-width="2"/><circle cx="9" cy="10" r="1.3" fill="#f08b1e"/><circle cx="15" cy="10" r="1.3" fill="#f08b1e"/><path d="M8 14q4 3.5 8 0" fill="none" stroke="#f08b1e" stroke-width="1.6" stroke-linecap="round"/></svg>',
    notes2: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H11l-4 3v-3H4z" fill="#fff" stroke="#1fb3a8" stroke-width="2" stroke-linejoin="round"/><path d="M8 9h8M8 12h6" stroke="#1fb3a8" stroke-width="1.6" stroke-linecap="round"/></svg>',
    web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#2f7fe6"/><path d="M3 12h18M12 3c-4 4.5-4 13.5 0 18M12 3c4 4.5 4 13.5 0 18" fill="none" stroke="#fff" stroke-width="1.3"/></svg>',
    miiverse: '<svg viewBox="0 0 24 24"><circle cx="7" cy="9" r="2.6" fill="#55b52e"/><circle cx="12" cy="7.5" r="2.8" fill="#55b52e"/><circle cx="17" cy="9" r="2.6" fill="#55b52e"/><path d="M3 19c0-4 2-6 4-6s3 1 5 1 3-1 5-1 4 2 4 6z" fill="#55b52e"/></svg>',
    eshop: '<svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="5" fill="#ff8b1a"/><path d="M11 15h18l-1.5 16h-15z" fill="#fff"/><path d="M15 16v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" stroke-width="2.2"/></svg>',
    wrench: '<svg viewBox="0 0 40 40"><defs><linearGradient id="ds-w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4efd8"/><stop offset="1" stop-color="#b9b190"/></linearGradient></defs><rect x="2" y="2" width="36" height="36" rx="5" fill="url(#ds-w)"/><path d="M27 8a6 6 0 0 0-7.5 7.6L9 26.1l3.9 3.9 10.5-10.5A6 6 0 0 0 31 12l-3.6 3.6-3-3L28 9z" fill="#3a3a3a"/></svg>',
    mii: '<svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="5" fill="#f4f7f6"/><text x="20" y="27" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="700" font-size="17" fill="#fff" stroke="#3aa58c" stroke-width="1.6" paint-order="stroke">Mii</text></svg>',
    camera: '<svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="5" fill="#ffa419"/><rect x="8" y="13" width="24" height="17" rx="3" fill="#fff"/><rect x="15" y="10" width="10" height="4" rx="1.5" fill="#fff"/><circle cx="20" cy="21.5" r="5" fill="#ffa419"/></svg>',
    library: '<svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="5" fill="#fff" stroke="#3d74d9" stroke-width="2.5"/><g fill="#3d74d9">' + [0, 1, 2].flatMap(r => [0, 1, 2].map(c => `<rect x="${10 + c * 7.5}" y="${10 + r * 7.5}" width="5" height="5" rx="1.2"/>`)).join('') + '</g></svg>',
    gamepass: '<svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="5" fill="#107c10"/><circle cx="20" cy="20" r="10" fill="none" stroke="#fff" stroke-width="3"/><path d="M14 14q6 4 12 12M26 14q-6 4-12 12" stroke="#fff" stroke-width="3" fill="none"/></svg>'
  };
  function dsList() {
    return [...games().slice(0, 30).map(gameItem), { label: 'Nintendo eShop', sub: 'Store', action: 'dashboard-store', svg: 'eshop' }, { label: 'Game Pass', sub: 'Subscription', action: 'dashboard-gamepass', svg: 'gamepass' },
      { label: 'System Settings', sub: 'Settings', action: 'settings', svg: 'wrench' }, { label: 'Mii Maker', sub: 'Profile', action: 'g-account', svg: 'mii' }, { label: 'Nintendo 3DS Camera', sub: 'Screenshots', action: 'g-retro-captures', svg: 'camera' },
      { label: 'All Software', sub: 'Library', action: 'library', svg: 'library' }];
  }
  // The rail's offset: the selection keeps two columns of context on either side, and a library too short
  // to fill five columns is padded so the icons stay centred.
  function dsRail(list) {
    const cols = Math.max(1, Math.ceil(list.length / DS_ROWS));
    const col = Math.floor(dsFocus / DS_ROWS);
    return { cols, col, start: Math.max(0, Math.min(col - 2, cols - DS_COLS)), pad: Math.max(0, DS_COLS - cols) * DS_PITCH / 2 };
  }
  function renderDs() {
    const list = dsList();
    dsFocus = Math.max(0, Math.min(dsFocus, list.length - 1));
    const rail = dsRail(list);
    const coins = Math.min(300, 10 + allGames().length);
    host.classList.toggle('ds-still', reducedMotion());
    host.innerHTML = `<i class="ds-bg" aria-hidden="true"></i>
        <div class="ds-statusbar"><span class="ds-signal" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="ds-pill">Internet</span><span class="ds-coin"><i>P</i>${coins}</span>
          <span class="ds-when">${esc(dayMonth())} (${esc(weekday())})</span><span class="ds-clock">${esc(time()).replace(':', '<b>:</b>')}</span><span class="ds-battery" aria-hidden="true"><i></i></span></div>
        <div class="ds-banner"><i class="ds-art"></i><div class="ds-plate"><i class="ds-plate-icon"></i><span><em class="ds-kicker"></em><strong></strong><small></small></span></div></div>
        <div class="ds-field"><div class="ds-grid" style="--start:${rail.start};--pad:${rail.pad}">${list.map((item, i) => `<button class="ds-icon focusable${i === dsFocus && dsTool < 0 ? ' sel' : ''}" type="button" ${attrs(item)} data-ds-index="${i}" aria-label="${esc(item.label)}" style="--c:${Math.floor(i / DS_ROWS)};--r:${i % DS_ROWS}">
          ${item.game ? `<span class="ds-cover" style="background-image:${url(cover(item.game))}"></span>` : DS_SVG[item.svg] || icon('game')}</button>`).join('')}<span class="ds-cursor" style="--c:${rail.col};--r:${dsFocus % DS_ROWS}" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div></div>
        <div class="ds-bottom"><div class="ds-toolbar">${DS_TOOLS.map(([action, label, svg], i) => `<button class="ds-tool focusable${i === 0 ? ' tab' : ''}${dsTool === i ? ' sel' : ''}" type="button" data-action="${action}" data-ds-tool="${i}" aria-label="${label}">${DS_SVG[svg]}</button>`).join('')}</div>
          <span class="ds-gap"></span><span class="ds-size" aria-hidden="true"><i></i><i class="grid"></i></span>
          <div class="ds-foot"><span class="ds-cam"></span><kbd>Y</kbd><span class="ds-cam"></span><kbd>L</kbd>+<kbd>R</kbd></div></div>
        <div class="ds-scroll" aria-hidden="true"><i style="--p:${rail.cols > DS_COLS ? rail.start / (rail.cols - DS_COLS) : 0}"></i></div>`;
    chrome.innerHTML = '';
    dsBanner(list[dsFocus]);
    focusEl(dsTool >= 0 ? host.querySelector(`[data-ds-tool="${dsTool}"]`) : host.querySelector('.ds-icon.sel'));
  }
  // Movement retunes classes and the rail offset only, so the grid slides in CSS instead of being rebuilt.
  function dsUpdate() {
    const list = dsList();
    dsFocus = Math.max(0, Math.min(dsFocus, list.length - 1));
    const rail = dsRail(list);
    const grid = host.querySelector('.ds-grid');
    if (!grid) { renderDs(); return; }
    grid.style.setProperty('--start', rail.start);
    grid.style.setProperty('--pad', rail.pad);
    host.querySelectorAll('.ds-icon').forEach((button, i) => button.classList.toggle('sel', i === dsFocus && dsTool < 0));
    const cursor = host.querySelector('.ds-cursor');
    if (cursor) { cursor.style.setProperty('--c', rail.col); cursor.style.setProperty('--r', dsFocus % DS_ROWS); }
    host.querySelectorAll('.ds-tool').forEach((button, i) => button.classList.toggle('sel', i === dsTool));
    const bar = host.querySelector('.ds-scroll i');
    if (bar) bar.style.setProperty('--p', rail.cols > DS_COLS ? rail.start / (rail.cols - DS_COLS) : 0);
    dsBanner(list[dsFocus]);
    focusEl(dsTool >= 0 ? host.querySelector(`[data-ds-tool="${dsTool}"]`) : host.querySelector('.ds-icon.sel'));
  }
  function dsBanner(item) {
    const plate = host.querySelector('.ds-plate');
    if (!plate || !item) return;
    const token = ++dsArtToken;
    plate.querySelector('strong').textContent = item.label;
    plate.querySelector('.ds-kicker').textContent = item.game ? 'Now Playing' : 'System App';
    // The plate carries the software's publisher, and the play time once it has been played.
    plate.querySelector('small').textContent = item.game
      ? [item.game.developer || item.game.publisher || (item.game.provider === 'PC' ? '' : item.game.provider), playtime(item.game)].filter(Boolean).join(' · ')
      : item.sub || '';
    const iconEl = plate.querySelector('.ds-plate-icon');
    iconEl.innerHTML = item.game ? '' : DS_SVG[item.svg] || '';
    iconEl.style.backgroundImage = item.game ? cssUrl(cover(item.game)) : '';
    const art = host.querySelector('.ds-art');
    const backdrop = host.querySelector('.ds-bg');
    art.style.backgroundImage = ''; art.innerHTML = '';
    art.parentElement.classList.toggle('system', !item.game);
    if (!item.game) {
      art.innerHTML = DS_SVG[item.svg] || '';
      // A system app has no wallpaper of its own, so the library's first game stays behind it.
      const fallback = dsList().find(entry => entry.game)?.game;
      if (backdrop && !backdrop.style.backgroundImage && fallback && window.gWideArt) {
        window.gWideArt(fallback).then(src => { if (src && backdrop.isConnected) backdrop.style.backgroundImage = cssUrl(src); }).catch(() => {});
      }
      return;
    }
    if (!window.gWideArt) return;
    window.gWideArt(item.game).then(src => {
      // A quick move can land this lookup after the next game's; only the latest selection may paint.
      if (token !== dsArtToken || !art.isConnected) return;
      art.style.backgroundImage = cssUrl(src || cover(item.game));
      if (src && backdrop?.isConnected) backdrop.style.backgroundImage = cssUrl(src);
    }).catch(() => {});
  }
  function dsMove(direction) {
    const list = dsList();
    if (dsTool >= 0) {
      if (direction === 'left' || direction === 'right') { const next = Math.max(0, Math.min(DS_TOOLS.length - 1, dsTool + (direction === 'right' ? 1 : -1))); if (next === dsTool) return; dsTool = next; play('navigate'); }
      else if (direction === 'up' || direction === 'down') { dsTool = -1; play('navigate'); }
      else return;
      dsUpdate(); return;
    }
    const row = dsFocus % DS_ROWS;
    let next = dsFocus;
    if (direction === 'down') { if (row < DS_ROWS - 1) next += 1; else { dsTool = Math.min(DS_TOOLS.length - 1, Math.floor(dsFocus / DS_ROWS)); play('navigate'); dsUpdate(); return; } }
    if (direction === 'up' && row > 0) next -= 1;
    if (direction === 'right') next += DS_ROWS;
    if (direction === 'left') next -= DS_ROWS;
    if (next < 0 || next >= list.length) { if (direction === 'right' && Math.floor(dsFocus / DS_ROWS) < Math.floor((list.length - 1) / DS_ROWS)) next = list.length - 1; else return; }
    if (next === dsFocus) return;
    dsFocus = next; play('navigate');
    dsUpdate();
  }

  // =========================== Rendering, navigation, sounds ===========================
  const reducedMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderedTheme = '', enterTimer = 0;
  function render(rebuild = true) {
    const id = theme();
    // Leaving PS3 gives up its open settings page and pop-up; coming back starts from the column again.
    if (id !== 'ps3') { ps3Open = null; ps3Sub = 0; ps3Popup = null; }
    // The other console settings shells are per-theme screens too; leaving the theme closes them.
    if (id !== 'ps4') ps4Set = null;
    document.body.classList.toggle('g-retro', on());
    // The dashboard's visibility is keyed on .home-active, which only showView() sets; keep it honest when
    // the theme changes while the launcher is already sitting on Home.
    document.body.classList.toggle('home-active', state.view === 'home');
    if (!on()) { host.innerHTML = ''; chrome.innerHTML = ''; renderedTheme = ''; return; }
    // Picking a console redraws the whole dashboard with a short entrance, the way the console's own
    // home screen arrived. It is only for a theme change, not for a library or artwork refresh.
    if (id !== renderedTheme) {
      renderedTheme = id;
      if (!reducedMotion()) {
        document.body.classList.remove('retro-enter');
        void document.body.offsetWidth;
        document.body.classList.add('retro-enter');
        clearTimeout(enterTimer);
        enterTimer = setTimeout(() => document.body.classList.remove('retro-enter'), 1100);
      }
    }
    try {
      ({ ps3: renderXmb, ps4: renderPs4, wii: renderWii, '3ds': renderDs })[id](rebuild);
    } catch (error) {
      // A console screen that cannot be built must never leave the dashboard hidden behind an empty
      // overlay: drop back to the launcher's own Home and say so in the console.
      console.error('Theme screen failed to build:', error);
      document.body.classList.remove('g-retro');
      host.innerHTML = '';
      chrome.innerHTML = '';
      return;
    }
    try { refreshFocusables(); } catch { /* Not ready. */ }
  }
  // Covers, names and counts arrive after the first paint, and the Game column is built from what is on
  // disk, so refresh once the library or its artwork changes instead of showing empty squares until the
  // player presses a direction. Batches are coalesced and never stolen from a dialog.
  let refreshTimer = 0;
  function scheduleRefresh(delay = 300) {
    if (!on() || refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = 0;
      if (!on() || state.view !== 'home' || document.querySelector('dialog[open]')) return;
      render();
    }, delay);
  }
  window.launcher?.onLibraryArtwork?.(() => scheduleRefresh());
  window.launcher?.onLibraryInitial?.(() => scheduleRefresh(600));
  // Closing Settings after picking a theme leaves the focus on the closed dialog's own controls; put it back
  // on the console screen so the first press does something.
  document.addEventListener('close', event => {
    if (!on() || state.view !== 'home' || !event.target?.matches?.('dialog')) return;
    requestAnimationFrame(() => { if (on() && state.view === 'home') render(); });
  }, true);
  const firstFocus = () => host.querySelector('.xmb-item.on, .ps4-tile.sel, .wii-pbtn[data-start], .wii-ch.focusable, .ds-icon.sel');
  if (typeof navigateConsoleHome === 'function') {
    const base = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (!on() || state.view !== 'home') return base.call(this, direction, focused);
      ({ ps3: xmbMove, ps4: ps4Move, wii: wiiMove, '3ds': dsMove })[theme()](direction);
      return true;
    };
  }
  // Mouse and touch: hovering or clicking an item moves the console's own selection to it.
  document.addEventListener('focusin', event => {
    if (!on() || !host.contains(event.target) && !chrome.contains(event.target)) return;
    const t = theme(), el = event.target;
    if (t === 'ps4' && el.closest('.ps4-tile') && Number(el.dataset.ps4Index) !== ps4Focus) { ps4Focus = Number(el.dataset.ps4Index); ps4Area = 'row'; renderPs4(false); }
    if (t === 'wii' && el.closest('.wii-ch')) { wiiFocus = Number(el.dataset.wiiIndex); wiiBar = -1; }
  });
  document.addEventListener('click', event => {
    if (!on()) return;
    const el = event.target.closest?.('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    // A console's own Settings entry opens its registry-driven shell, not the launcher's dialog.
    if (action === 'settings' && el.closest('#g-retro, #g-retro-chrome')) {
      if (theme() === 'ps4' && !ps4Set) { stop(); ps4OpenSettings(); return; }
    }
    // PS4 Settings: its rows, pages and option dialog are real controls.
    if (theme() === 'ps4' && ps4Set) {
      if (action === 'ps4-set-back') { stop(); ps4SetBack(); return; }
      if (action === 'ps4-set-page') { stop(); ps4Set.focus = Number(el.dataset.index) || 0; ps4OpenPage(el.dataset.page); return; }
      if (action === 'ps4-set-row') { stop(); ps4Set.focus = Number(el.dataset.row); ps4OpenRow(ps4Set.focus); return; }
      if (action === 'ps4-set-option') {
        stop();
        const overlay = ps4Set.overlay;
        if (!overlay || overlay.saving) return;
        overlay.selected = Number(el.dataset.option);
        ps4ConfirmOverlay();
        return;
      }
      if (action === 'ps4-set-commit') { stop(); ps4ConfirmOverlay(); return; }
      if (action === 'ps4-set-cancel') { stop(); ps4CancelOverlay(); return; }
      // A controller press confirms the slider; a pointer press moves the knob to where it landed.
      if (action === 'ps4-set-slider') { stop(); if (state.controllerClick || event.detail === 0) ps4ConfirmOverlay(); else ps4Seek(event); return; }
    }
    // A first click on an XMB item, PS4 tile or 3DS icon that isn't selected selects it, as the pointer did.
    if (theme() === 'ps3' && el.classList.contains('xmb-item') && !el.classList.contains('on')) { stop(); xmbItem[xmbCategories()[xmbCat].id] = Number(el.dataset.xmbIndex); if (ps3Open) { ps3Open = null; ps3Popup = null; ps3Sub = 0; } play('navigate'); renderXmb(false); return; }
    if (theme() === '3ds' && el.classList.contains('ds-icon') && !el.classList.contains('sel')) { stop(); dsFocus = Number(el.dataset.dsIndex); dsTool = -1; play('navigate'); dsUpdate(); return; }
    if (theme() === 'ps4' && el.classList.contains('ps4-tile') && !el.classList.contains('sel')) { stop(); ps4Focus = Number(el.dataset.ps4Index); ps4Area = 'row'; play('navigate'); renderPs4(false); return; }
    if (theme() === 'ps3' && el.classList.contains('xmb-sub-item') && !el.classList.contains('on')) { stop(); ps3Sub = Number(el.dataset.row); play('navigate'); renderXmb(false); return; }
    if (theme() === 'ps3' && action === 'xmb-settings-page') { stop(); ps3OpenPage(el.dataset.page); return; }
    if (theme() === 'ps3' && action === 'xmb-settings-row') { stop(); ps3OpenRow(Number(el.dataset.row)); return; }
    if (theme() === 'ps3' && action === 'xmb-pop-option') {
      stop();
      const popup = ps3Popup;
      if (!popup || popup.saving) return;
      popup.selected = Number(el.dataset.option);
      ps3ConfirmPopup();
      return;
    }
    // A controller press confirms the bar; a pointer press moves the knob to where it landed.
    if (theme() === 'ps3' && action === 'xmb-bar') { stop(); if (state.controllerClick || event.detail === 0) ps3ConfirmPopup(); else ps3Seek(event); return; }
    if (theme() === 'ps3' && action === 'xmb-pop-commit') { stop(); ps3ConfirmPopup(); return; }
    if (theme() === 'ps3' && (action === 'xmb-pop-close' || action === 'xmb-pop-cancel')) { stop(); ps3CancelPopup(); return; }
    if (theme() === 'ps3' && action === 'xmb-settings-back') { stop(); ps3ClosePage(); return; }
    if (action === 'g-retro-settings') { stop(); play('confirm'); Promise.resolve(typeof openSettings === 'function' ? openSettings() : settingsDialog.showModal()).then(() => { try { showSettingsPage(el.dataset.page); } catch { /* Missing. */ } }); return; }
    if (action === 'g-ps4-overview') { stop(); play('confirm'); if (typeof openGameDetails === 'function') openGameDetails(el.dataset.gameId); return; }
    if (action === 'g-retro-preview') { stop(); play('confirm'); wiiPreview = el.dataset.gameId; render(); return; }
    if (action === 'g-wii-back') { stop(); play('back'); wiiPreview = null; render(); return; }
    if (action === 'g-wii-page') { stop(); play('category'); wiiPage += Number(el.dataset.dir); wiiFocus = 0; render(); return; }
    if (action === 'g-retro-captures') { stop(); play('confirm'); loadCaptures(); openLatestCapture(); return; }
    if (action === 'g-retro-weather') { stop(); if (typeof showToast === 'function') showToast(`Forecast · ${now().toLocaleDateString([], { weekday: 'long' })} · Have a great day of gaming`); return; }
    // Items that are games boot straight into them, as on these consoles.
    if (el.dataset.retroBoot && el.dataset.gameId) {
      const game = findGame(el.dataset.gameId);
      if (game && game.installed !== false) { stop(); play('launch'); wiiPreview = null; selectGame(game.id, false, el); launchSelectedGame(); }
    }
  }, true);
  // Back: the Wii channel preview returns to the Wii Menu; the PS4 function area and sub-menu close.
  if (typeof navigateBack === 'function') {
    const back = navigateBack;
    navigateBack = function (...args) {
      if (on() && state.view === 'home') {
        if (theme() === 'ps3') {
          if (ps3Popup) { ps3CancelPopup(); return; }
          if (ps3Open) { ps3ClosePage(); return; }
        }
        if (theme() === 'ps4' && ps4Set) { ps4SetBack(); return; }
        if (theme() === 'wii' && wiiPreview) { play('back'); wiiPreview = null; render(); return; }
        if (theme() === 'ps4' && ps4Area !== 'row') { play('back'); ps4Area = 'row'; render(); return; }
        if (theme() === '3ds' && dsTool >= 0) { play('back'); dsTool = -1; dsUpdate(); return; }
      }
      return back.apply(this, args);
    };
  }

  // The console's keyboard/controller Enter path calls performAction() with the focused item's data-action.
  // Handle the XMB settings actions here so Enter behaves exactly like the controller's ✕ press.
  if (typeof performAction === 'function') {
    const actionBase = performAction;
    performAction = async function (action, source) {
      if (on() && state.view === 'home' && action === 'settings' && source?.closest?.('#g-retro, #g-retro-chrome')) {
        if (theme() === 'ps4' && !ps4Set) { ps4OpenSettings(); return true; }
      }
      if (on() && state.view === 'home' && theme() === 'ps4' && ps4Set) {
        if (action === 'ps4-set-back') { ps4SetBack(); return true; }
        if (action === 'ps4-set-page') { ps4Set.focus = Number(source?.dataset?.index) || 0; ps4OpenPage(source?.dataset?.page); return true; }
        if (action === 'ps4-set-row') {
          const index = Number(source?.dataset?.row);
          ps4Set.focus = index;
          ps4OpenRow(index);
          return true;
        }
        if (action === 'ps4-set-option') {
          if (ps4Set.overlay) { ps4Set.overlay.selected = Number(source?.dataset?.option); await ps4ConfirmOverlay(); }
          return true;
        }
        if (action === 'ps4-set-commit') { await ps4ConfirmOverlay(); return true; }
        if (action === 'ps4-set-cancel') { ps4CancelOverlay(); return true; }
        if (action === 'ps4-set-slider') { await ps4ConfirmOverlay(); return true; }
      }
      if (on() && state.view === 'home' && theme() === 'ps3') {
        if (action === 'xmb-settings-page') { ps3OpenPage(source?.dataset?.page); return true; }
        if (action === 'xmb-settings-row') {
          const index = Number(source?.dataset?.row);
          if (index !== ps3Sub) { ps3Sub = index; play('navigate'); renderXmb(false); return true; }
          ps3OpenRow(index);
          return true;
        }
        if (action === 'xmb-pop-option') {
          if (ps3Popup) { ps3Popup.selected = Number(source?.dataset?.option); await ps3ConfirmPopup(); }
          return true;
        }
        if (action === 'xmb-bar') { await ps3ConfirmPopup(); return true; }
        if (action === 'xmb-pop-commit') { await ps3ConfirmPopup(); return true; }
        if (action === 'xmb-pop-close' || action === 'xmb-pop-cancel') { ps3CancelPopup(); return true; }
        if (action === 'xmb-settings-back') { ps3ClosePage(); return true; }
      }
      return actionBase.call(this, action, source);
    };
  }
  // The console screens stay in step with every other way a setting can change (the launcher's own Settings
  // dialog, a quick-settings shortcut, another theme's shell). Availability is re-checked on the next scan.
  document.addEventListener('g-setting-change', event => {
    if (theme() !== 'ps3' || !event.detail?.id) return;
    ps3LayoutAt = 0;
    const row = ps3Open?.rows?.find(item => item.id === event.detail.id);
    if (row) row.value = event.detail.value;
    // A launcher dialog owns the screen while it is open; the close handler repaints the XMB for it.
    if (document.querySelector('dialog[open]')) return;
    if (ps3Open || ps3Popup || event.detail.id === 'enterButton') renderXmb(false);
  });
  document.addEventListener('g-settings-ready', () => {
    if (theme() !== 'ps3') return;
    ps3Layout = null; ps3LayoutAt = 0;
    if (state.view === 'home') renderXmb(false);
  });
  // The PS4 shell follows every other way a setting can change, and re-checks what this PC can do when a
  // preference that decides availability (an account key, say) changes.
  document.addEventListener('g-setting-change', event => {
    if (theme() !== 'ps4' || !event.detail?.id) return;
    ps4QueueReload();
  });
  document.addEventListener('g-settings-ready', () => {
    if (theme() !== 'ps4' || !ps4Set) return;
    forgetShellScan('ps4');
    ps4QueueReload();
  });

  // Sounds: the pack's recordings when present, otherwise short synthesised cues.
  let ctx;
  const buffers = new Map();
  const SYNTH = {
    ps3: { navigate: [1320, .045, 'sine', .03], category: [880, .07, 'sine', .035], confirm: [660, .16, 'triangle', .04, 990], back: [520, .12, 'triangle', .035, 390], launch: [440, .5, 'sine', .04, 880], notify: [1175, .3, 'sine', .03, 1568] },
    ps4: { navigate: [1760, .035, 'sine', .025], category: [1320, .05, 'sine', .03], confirm: [1047, .12, 'sine', .04, 1568], back: [784, .1, 'sine', .03, 587], launch: [523, .6, 'sine', .04, 1047], notify: [1319, .35, 'sine', .03, 1760] },
    wii: { navigate: [1568, .06, 'triangle', .035], category: [1175, .08, 'triangle', .04], confirm: [988, .18, 'square', .02, 1319], back: [784, .14, 'triangle', .035, 523], launch: [523, .7, 'triangle', .04, 1047], notify: [1319, .3, 'triangle', .035, 1760] },
    '3ds': { navigate: [2093, .04, 'square', .012], category: [1568, .06, 'square', .014], confirm: [1319, .12, 'square', .015, 1760], back: [1047, .1, 'square', .014, 784], launch: [784, .5, 'square', .015, 1568], notify: [1760, .25, 'square', .014, 2349] }
  };
  function packSound(id, kind) {
    const key = `${id}:${kind}`;
    if (!buffers.has(key)) {
      buffers.set(key, null);
      window.launcher.getRetroSound(id, kind).then(async sound => {
        if (!sound) return;
        const bytes = Uint8Array.from(atob(sound.base64), c => c.charCodeAt(0));
        ctx ||= new AudioContext();
        buffers.set(key, await ctx.decodeAudioData(bytes.buffer));
      }).catch(() => {});
    }
    return buffers.get(key);
  }
  function play(kind) {
    const id = theme();
    if (!SYNTH[id]?.[kind] || state.soundEffects === false || !document.hasFocus() || document.hidden) return;
    try {
      ctx ||= new AudioContext();
      if (pack.sounds?.[id]?.includes(kind) && pack.available[id] && window.launcher?.getRetroSound) {
        const buffer = packSound(id, kind);
        if (buffer) { const source = ctx.createBufferSource(), amp = ctx.createGain(); amp.gain.value = .55; source.buffer = buffer; source.connect(amp).connect(ctx.destination); source.start(); return; }
        if (buffers.has(`${id}:${kind}`)) return;
      }
      const [freq, dur, type, gain, to] = SYNTH[id][kind];
      const start = ctx.currentTime, osc = ctx.createOscillator(), amp = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, start); if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
      amp.gain.setValueAtTime(.0001, start); amp.gain.exponentialRampToValueAtTime(gain, start + .005); amp.gain.exponentialRampToValueAtTime(.0001, start + dur);
      osc.connect(amp).connect(ctx.destination); osc.start(start); osc.stop(start + dur + .02);
    } catch { /* Optional. */ }
  }
  // Decode the pack's sounds ahead of time once the window is in use, so the first press isn't silent.
  addEventListener('focus', () => { const id = theme(); if (on() && pack.available[id]) (pack.sounds?.[id] || []).forEach(kind => packSound(id, kind)); });
  if (typeof interfaceAudio === 'object' && interfaceAudio) {
    const base = interfaceAudio.play.bind(interfaceAudio);
    interfaceAudio.play = function (kind = 'navigate') { if (on() && SYNTH[theme()][kind] && !(interfaceAudio.customCount?.() > 0)) return play(kind); return base(kind); };
  }

  if (typeof renderRecentGames === 'function') {
    const recentBase = renderRecentGames;
    renderRecentGames = function (...args) { const result = recentBase.apply(this, args); if (on() && state.view === 'home') render(); return result; };
  }
  if (typeof showView === 'function') {
    const viewBase = showView;
    showView = function (next, ...rest) { const result = viewBase.call(this, next, ...rest); if (next === 'home' && on()) requestAnimationFrame(render); return result; };
  }
  // The clocks tick over each minute; the 3DS colon blinks in CSS.
  setInterval(() => {
    if (!on() || state.view !== 'home' || document.hidden) return;
    const t = theme();
    if (t === 'ps3') { const el = chrome.querySelector('.xmb-time'); if (el) el.textContent = `${dayMonth()} ${time()}`; }
    if (t === 'ps4') { const el = chrome.querySelector('.ps4-s.clock'); if (el) el.textContent = time(); }
    if (t === 'wii') { const el = chrome.querySelector('.wii-clock'); if (el) el.innerHTML = segClock(); }
    if (t === '3ds') { const el = host.querySelector('.ds-clock'); if (el) el.innerHTML = esc(time()).replace(':', '<b>:</b>'); }
  }, 15000);
  new MutationObserver(() => { wiiPreview = null; ps4Area = 'row'; dsTool = -1; wiiBar = -1; render(); }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  window.gRetro = { render, play, pack: () => pack };
  render();
  loadPack();
})();
