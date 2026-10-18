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
  // Every button prompt is drawn by the one glyph helper (garrison-glyphs.js, task G1), so the four retro skins
  // and the shared settings shell can never print a different console's buttons.
  const gRow = (id, items) => window.gGlyphs?.row?.(id, items) || '';
  // Note: do not add a local binding named gIcon — `icon()` below delegates to the launcher's global gIcon, and
  // a local binding with that name would shadow it for every existing call (drawn settings icons became keycaps).
  const homePrompts = id => window.gGlyphs?.prompts?.[id]?.home || [];
  const games = () => (typeof homeRecentGames === 'function' ? homeRecentGames() : []).filter(game => !game.isApp && !game.remoteHostId);
  const allGames = () => (state.games || []).filter(game => !game.isApp && game.installed !== false);
  const cover = game => game?.artwork?.tile || game?.artwork?.grid || '';
  const url = value => value ? `url(&quot;${esc(value).replaceAll('"', '%22')}&quot;)` : 'none';
  // `none` rather than an empty CSS url(): Chromium and Electron's security-warning helper both treat an
  // empty resource URL badly (Electron's own logSecurityWarnings throws on new URL('')), so never emit one.
  const cssUrl = value => value ? `url("${String(value).replaceAll('"', '%22')}")` : 'none';
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
  // The one motion table (garrison-theme-motion.js). Every timer that used to hold a hand-typed millisecond
  // value reads the console's own duration instead, so a theme change cannot leave the CSS and JS out of step.
  const motionMs = (which = 'page') => window.gMotion?.ms?.(which) || 200;
  const swapMs = () => motionMs('page') + 60;

  // ---------- Packs ----------
  let pack = { available: {}, base: '', sounds: {}, music: {} };
  // The pack is read once at start-up; the audio engine waits for this promise before it decides whether a theme
  // has pack music, so the first press can never miss a track that is already installed.
  let packReadyPromise = null;
  const P = (id, rel) => pack.available[id] && pack.base ? pack.base + rel.split('/').map(encodeURIComponent).join('/') : '';
  const PS3I = file => P('ps3', `ps3/PS3-Simulator-main/icons/${file}.png`);
  const PS4I = file => P('ps4', `ps4/Ps4-UI-master/assets/img/${file}.png`);
  const WIII = file => P('wii', `wii/Wii.JS-gh-pages/assets/images/${file}`);
  const img = (src, fallback, cls = '') => src ? `<img class="rp-img ${cls}" src="${esc(src)}" alt="" draggable="false">` : fallback;
  async function loadPack() {
    try { pack = await window.launcher?.getRetroPack?.() || pack; } catch { /* No packs. */ }
    // Opt in to the pack's own button pictures when it hands over a glyph map; the drawn SVG is the fallback.
    window.gGlyphs?.usePack?.(pack);
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
    return pack;
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
      { id: 'photo', label: 'Photo', file: 'photo', glyph: 'photo', items: [{ label: 'Backgrounds', action: 'gsh-page', data: { page: 'theme' }, file: 'photo-gallery', glyph: 'color' }, ...captureItems('photo')] },
      { id: 'music', label: 'Music', file: 'music', glyph: 'music', items: [{ label: 'Menu Sounds', action: 'gsh-page', data: { page: 'sound' }, file: 'playlist', glyph: 'volume' }] },
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
    // The Settings column's items do not depend on the library or its artwork, so a refresh keeps the existing
    // nodes while the shared shell is open. That keeps the opener element (and the focus handed back on close)
    // alive instead of detaching it under the open sub-list.
    if (cat.id === 'settings' && window.gShell?.isOpen?.('ps3')) rebuild = false;
    // While the shared shell owns the Settings page, the XMB column follows the shell's own page cursor, so a page
    // opened from a press and a page opened by a move land on the same highlight.
    const shellState = window.gShell?.state?.();
    if (cat.id === 'settings' && shellState?.console === 'ps3') xmbItem.settings = shellState.level === 'page' ? shellState.pageIndex : shellState.focus;
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
        xmbSwapTimer = setTimeout(() => list.classList.remove('xmb-swap'), swapMs());
      }
    }
    [...list.children].forEach((el, i) => {
      el.style.setProperty('--y', String(pos[i]));
      el.classList.toggle('on', i === sel);
      el.classList.toggle('above', i < sel);
    });
    chrome.innerHTML = `<div class="xmb-clock"><span class="xmb-me"><i></i>${esc(name())}</span><span class="xmb-time">${esc(dayMonth())} ${esc(time())}</span><i class="xmb-dial"></i></div>
      <div class="xmb-hints">${gRow('ps3', homePrompts('ps3'))}</div>`;
    // The shell paints its own sub-list/pop-up and owns the focus while it is open; otherwise the column item does.
    if (!window.gShell?.isOpen?.('ps3')) focusEl(list.querySelector('.xmb-item.on'));
    xmbBackdrop(items[sel]);
    loadCaptures();
    xmbWave.start();
  }
  // The selected game's background image fades in after a moment, as PIC1 did.
  let picTimer = 0;
  // PS3 SND0: after resting on a game for 1.5 s the game's trailer audio plays quietly, without its video.
  // Every move off the game (or away from the XMB) cancels the wait and stops whatever was playing.
  let gameAudioTimer = 0;
  function xmbBackdrop(item) {
    clearTimeout(picTimer);
    clearTimeout(gameAudioTimer);
    window.gAudio?.stopGameAudio?.();
    if (item?.game) gameAudioTimer = setTimeout(() => window.gAudio?.gameAudioStart?.(item.game), 1500);
    const layer = host.querySelector('.xmb-pic');
    host.classList.remove('pic-on');
    if (!layer || !item?.game || !window.gWideArt) return;
    picTimer = setTimeout(() => window.gWideArt(item.game).then(src => {
      if (!src || !layer.isConnected) return;
      layer.style.backgroundImage = cssUrl(src);
      host.classList.add('pic-on');
    }).catch(() => {}), 900);
  }
  // ---------- PS3: Settings, the XMB skin (garrison-settings-shell.js owns the model) ----------
  // The Settings column is the registry's PS3 layout: one XMB item per page. Choosing a page slides the column
  // left and opens that page's rows in the XMB's right-hand panel; choosing a row opens the console's option
  // pop-up. The shared shell owns the page/row/value state, availability, Back grammar and focus restore; this
  // block only paints the XMB's own chrome and moves its column.
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
  // The Enter Button pref swaps the PlayStation face buttons the same way the input layer already does.
  const ps3Glyphs = () => (window.gSettings?.cached?.('enterButton') === 'o' ? { confirm: '○', back: '✕' } : { confirm: '✕', back: '○' });
  function ps3SettingsItems() {
    return window.gShell.pageList('ps3').map(page => ({
      label: page.title, action: 'gsh-page', data: { page: page.id },
      file: PS3_PAGE_ICONS[page.id] || 'settings', glyph: PS3_PAGE_GLYPHS[page.id] || 'settings'
    }));
  }
  function renderPs3Sub(state) {
    const panel = host.querySelector('.xmb-sub');
    if (!panel) { renderXmb(true); return; }
    const open = state.level === 'page';
    host.classList.toggle('sub-open', open);
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    if (!open) { panel.innerHTML = ''; panel.removeAttribute('data-key'); return; }
    const rows = state.rows || [];
    const glyphs = ps3Glyphs();
    const format = row => window.gShell.valueText(row, row.value);
    const key = [state.page?.id, state.loading ? 1 : 0, state.error, state.focus, glyphs.confirm, glyphs.back, rows.map(row => `${row.id}:${row.kind}:${row.value}`).join(',')].join('|');
    if (panel.dataset.key === key) return;
    panel.dataset.key = key;
    panel.innerHTML = `<div class="xmb-sub-head"><span class="xmb-sub-kicker">${esc(state.page?.title || 'Settings')}</span><small>${rows.length ? `${state.focus + 1} / ${rows.length}` : ''}</small></div>
      <div class="xmb-sub-list">${rows.length ? rows.map((row, index) => `<button class="xmb-sub-item focusable${index === state.focus ? ' on' : ''}" type="button" data-action="gsh-row" data-row="${index}" data-setting-id="${esc(row.id)}" data-kind="${row.kind}" aria-label="${esc(row.label)}${format(row) ? `, ${esc(format(row))}` : ''}">
        <span class="xmb-sub-icon" aria-hidden="true">${img(PS3I(PS3_ROW_ICONS[row.id] || 'settings'), icon(PS3_ROW_GLYPHS[row.id] || 'settings'))}</span>
        <span class="xmb-sub-label">${esc(row.label)}</span>
        <span class="xmb-sub-value">${esc(format(row))}</span>
        ${row.kind === 'action' ? '<span class="xmb-sub-open" aria-hidden="true">›</span>' : ''}
      </button>`).join('') : `<p class="xmb-sub-empty">${state.loading ? 'Reading settings…' : esc(state.error || 'Nothing on this page is available on this PC.')}</p>`}</div>
      <p class="xmb-sub-hint"><span class="xmb-hint-open"><b class="xmb-glyph" data-g-role="confirm" aria-hidden="true">${glyphs.confirm}</b> Select</span><button class="xmb-pop-action focusable" type="button" data-action="gsh-back"><b class="xmb-glyph" data-g-role="back" aria-hidden="true">${glyphs.back}</b> Back</button></p>`;
  }
  function renderPs3Pop(state) {
    const panel = host.querySelector('.xmb-pop');
    if (!panel) { renderXmb(true); return; }
    const open = Boolean(state.overlay);
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
    const overlay = state.overlay, row = overlay.row, glyphs = ps3Glyphs();
    const key = [row.id, overlay.mode, overlay.selected, overlay.value, overlay.focus, overlay.saving ? 1 : 0, overlay.error, glyphs.confirm, glyphs.back].join('|');
    if (panel.dataset.key === key) return;
    panel.dataset.key = key;
    if (overlay.mode === 'info') { panel.setAttribute('tabindex', '-1'); panel.dataset.action = 'gsh-cancel'; }
    else { panel.removeAttribute('tabindex'); delete panel.dataset.action; }
    let body = '';
    if (overlay.mode === 'slider') {
      const p = window.gShell.percent({ min: overlay.min, max: overlay.max }, overlay.value);
      body = `<div class="xmb-bar-dialog focusable" role="slider" data-action="gsh-slider" aria-label="${esc(row.label)}" aria-valuemin="${overlay.min}" aria-valuemax="${overlay.max}" aria-valuenow="${overlay.value}">
        <span class="xmb-bar-arrow" aria-hidden="true">◀</span><span class="xmb-bar-track" data-gsh-track><i style="width:${p}%"></i><b style="left:${p}%"></b></span><span class="xmb-bar-arrow" aria-hidden="true">▶</span></div>
        <strong class="xmb-bar-value">${esc(window.gShell.valueText(row, overlay.value))}</strong>`;
    } else if (overlay.mode === 'choice') {
      body = `<div class="xmb-pop-list" role="listbox" aria-label="${esc(row.label)}">${overlay.options.map((option, index) => `<button class="xmb-pop-option focusable${index === overlay.selected ? ' on' : ''}" type="button" role="option" aria-selected="${index === overlay.selected}" data-action="gsh-option" data-option="${index}"><span>${esc(option.label)}</span>${index === overlay.selected ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>`;
    } else {
      body = `<p class="xmb-pop-info">${esc(window.gShell.valueText(row, row.value) || 'Unavailable')}</p>`;
    }
    const buttons = overlay.mode === 'info'
      ? `<button class="xmb-pop-action focusable" type="button" data-action="gsh-cancel"><b class="xmb-glyph" data-g-role="back" aria-hidden="true">${glyphs.back}</b> Back</button>`
      : `<button class="xmb-pop-action focusable" type="button" data-action="gsh-commit"><b class="xmb-glyph" data-g-role="confirm" aria-hidden="true">${glyphs.confirm}</b> Set</button>
        <button class="xmb-pop-action focusable" type="button" data-action="gsh-cancel"><b class="xmb-glyph" data-g-role="back" aria-hidden="true">${glyphs.back}</b> Cancel</button>`;
    panel.innerHTML = `<div class="xmb-pop-head"><strong>${esc(row.label)}</strong><small>${esc(state.page?.title || '')}</small></div>${body}
      <p class="xmb-pop-hint">${overlay.error ? `<span class="xmb-pop-error">${esc(overlay.error)}</span>` : ''}${buttons}${overlay.saving ? '<span class="xmb-pop-saving">Saving…</span>' : ''}</p>`;
  }
  function ps3MoveRoot(state, direction) {
    const cats = xmbCategories();
    if (direction === 'left' || direction === 'right') {
      const next = Math.max(0, Math.min(cats.length - 1, xmbCat + (direction === 'right' ? 1 : -1)));
      if (next === xmbCat) return false;
      xmbCat = next;
      if (xmbItem[cats[next].id] == null) xmbItem[cats[next].id] = Math.min(cats[next].start || 0, cats[next].items.length - 1);
      play('category');
      if (cats[next].id !== 'settings') {
        window.gShell.close({ silent: true, sound: false, restore: false });
        renderXmb(false);
        return true;
      }
      renderXmb(false);
      return true;
    }
    if (direction !== 'up' && direction !== 'down') return false;
    const count = ps3SettingsItems().length;
    if (!count) return false;
    const focus = Math.max(0, Math.min(count - 1, state.focus + (direction === 'down' ? 1 : -1)));
    if (focus === state.focus) return false;
    state.focus = focus;
    xmbItem.settings = focus;
    play('navigate');
    renderXmb(false);
    try { setFocusedElement(host.querySelector('.xmb-item.on'), { scroll: false }); } catch { /* Focus model mid-paint. */ }
    return true;
  }
  function ps3Target(state) {
    if (state.overlay) {
      const overlay = state.overlay;
      if (overlay.mode === 'info') return host.querySelector('.xmb-pop');
      // The hint order is Set then Cancel; the shell's footer order is Back then Confirm.
      const buttons = host.querySelectorAll('.xmb-pop-hint .xmb-pop-action');
      if (overlay.mode === 'slider') {
        if (overlay.focus === 0) return host.querySelector('.xmb-bar-dialog');
        return overlay.focus === 1 ? buttons[1] || buttons[0] : buttons[0];
      }
      const count = overlay.options.length;
      if (overlay.focus < count) return host.querySelector(`.xmb-pop-option[data-option="${overlay.focus}"]`);
      if (overlay.focus === count) return buttons[1] || buttons[0];
      return buttons[0];
    }
    if (state.level === 'page') return host.querySelector('.xmb-sub-item.on') || host.querySelector('.xmb-sub [data-action="gsh-back"]');
    return host.querySelector('.xmb-item.on');
  }
  gShell.define('ps3', {
    root: 'pages',
    backOnLeft: true,
    inlineToggles: false,
    glyphs: ps3Glyphs,
    container: () => host,
    enter(state) {
      xmbCat = Math.max(0, xmbCategories().findIndex(cat => cat.id === 'settings'));
      xmbItem.settings = state.focus;
    },
    render(state) {
      if (!host.querySelector('.xmb-list')) renderXmb(true);
      else renderXmb(false);
      renderPs3Sub(state);
      renderPs3Pop(state);
    },
    target: ps3Target,
    leave(state) {
      // The column highlight follows the item the focus is handed back to, so a rebuilt list cannot show one page
      // selected while the focus sits on another.
      const openerPage = state.opener?.dataset?.page;
      const openerIndex = openerPage ? ps3SettingsItems().findIndex(item => item.data?.page === openerPage) : -1;
      xmbItem.settings = openerIndex >= 0 ? openerIndex : (state.level === 'root' ? state.focus : state.pageIndex);
      host.classList.remove('sub-open', 'pop-open');
      const sub = host.querySelector('.xmb-sub'), pop = host.querySelector('.xmb-pop');
      if (sub) { sub.innerHTML = ''; sub.classList.remove('open'); sub.setAttribute('aria-hidden', 'true'); sub.removeAttribute('data-key'); }
      if (pop) { pop.innerHTML = ''; pop.classList.remove('open'); pop.setAttribute('aria-hidden', 'true'); pop.removeAttribute('data-key'); }
      renderXmb(false);
    },
    returnFocus(previous) {
      // If a library/artwork refresh rebuilt the XMB list while Settings was open, the original node is gone; put
      // the focus back on the same page's item, or the selected one, instead of leaving it inside the closed shell.
      const page = previous?.opener?.dataset?.page;
      if (page) {
        const match = [...host.querySelectorAll('.xmb-item')].find(item => item.dataset.page === page);
        if (match) return match;
      }
      return host.querySelector('.xmb-item.on');
    }
  });

  // Entering the Settings column opens the shared shell at its root; pressing a page item then opens that page.
  function openPs3Shell() {
    const shell = window.gShell;
    if (!shell || shell.isOpen('ps3')) return;
    const opener = host.querySelector('.xmb-item.on') || document.activeElement;
    Promise.resolve(shell.open('ps3', { opener, silent: true })).catch(() => {});
  }
  function xmbMove(direction) {
    if (window.gShell?.isOpen?.('ps3')) { window.gShell.move(direction); return; }
    const cats = xmbCategories();
    if (direction === 'left' || direction === 'right') {
      const next = Math.max(0, Math.min(cats.length - 1, xmbCat + (direction === 'right' ? 1 : -1)));
      if (next === xmbCat) return;
      xmbCat = next; play('category');
    } else {
      const cat = cats[xmbCat];
      const current = xmbItem[cat.id] ?? (cat.start || 0);
      const next = Math.max(0, Math.min(cat.items.length - 1, current + (direction === 'down' ? 1 : -1)));
      if (next === current) return;
      xmbItem[cat.id] = next; play('navigate');
    }
    renderXmb(false);
    if (cats[xmbCat].id === 'settings') openPs3Shell();
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

  // The shared settings shell (garrison-settings-shell.js) owns the registry plumbing these four consoles used
  // to repeat here. The skins below are pure presentation.

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
    if (window.gShell?.isOpen?.('ps4')) { window.gShell.render(); return; }
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
      ps4SwapTimer = setTimeout(() => under.classList.remove('ps4-swap'), swapMs());
    }
    ps4LastUnder = ps4Focus;
    host.querySelector('.ps4-hints').innerHTML = gRow('ps4', homePrompts('ps4'));
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
    if (window.gShell?.isOpen?.('ps4')) { window.gShell.move(direction); return; }
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

  // ---------- PS4: Settings, the full-screen list skin ----------
  // The console's Settings app: registry pages with icons down the left and a blue focus bar, then the page's rows
  // sliding in from the right. The shared shell owns pages, values, availability, option dialogs and Back; this
  // block paints the PS4 screen.
  const PS4_PAGE_GLYPHS = { account: 'contact', notifications: 'bell', devices: 'controller', 'sound-screen': 'volume', network: 'globe', themes: 'color', system: 'settings', accessibility: 'ease', advanced: 'settings' };
  const ps4SetGlyphs = () => (window.gSettings?.cached?.('enterButton') === 'o' ? { confirm: '○', back: '✕' } : { confirm: '✕', back: '○' });
  function ps4BuildShell() {
    let shell = host.querySelector('.ps4-set');
    if (shell) return shell;
    const background = document.createElement('i');
    background.className = 'ps4-set-bg';
    background.setAttribute('aria-hidden', 'true');
    shell = document.createElement('div');
    shell.className = 'ps4-set';
    shell.innerHTML = `<div class="ps4-set-head"><button class="ps4-set-back focusable" type="button" data-action="gsh-back" aria-label="Back"><span aria-hidden="true">‹</span></button><span class="ps4-set-kicker"></span><strong class="ps4-set-title"></strong></div>
      <div class="ps4-set-pages" role="list"></div>
      <div class="ps4-set-rows" role="list"></div>
      <div class="ps4-set-load" role="status"></div>
      <div class="ps4-set-hints"></div>
      <div class="ps4-set-overlay" aria-hidden="true"><div class="ps4-set-dialog" role="dialog" aria-modal="false" aria-label="Setting"></div></div>`;
    host.append(background, shell);
    return shell;
  }
  let ps4SetPageKey = '', ps4SetRowKey = '', ps4SetOverlayKey = '';
  function renderPs4Settings(state) {
    const shell = ps4BuildShell();
    const glyphs = ps4SetGlyphs();
    const pages = state.pages || [];
    const rows = state.rows || [];
    const deep = state.level === 'page';
    const current = state.page || pages[state.pageIndex] || null;
    shell.dataset.level = state.level;
    shell.classList.toggle('is-deep', deep);
    shell.dataset.anim = state.anim || '';
    shell.querySelector('.ps4-set-kicker').textContent = deep ? 'Settings' : 'PlayStation 4';
    shell.querySelector('.ps4-set-title').textContent = deep ? (current?.title || 'Settings') : 'Settings';
    shell.querySelector('.ps4-set-back').setAttribute('aria-label', deep ? 'Back to Settings' : 'Close Settings');
    // Pages
    const pageEl = shell.querySelector('.ps4-set-pages');
    const pageKey = `${state.loading && !pages.length ? 'load' : ''}|${state.error}|${pages.map(page => `${page.id}:${page.title}`).join('|')}`;
    if (pageKey !== ps4SetPageKey) {
      ps4SetPageKey = pageKey;
      const scroll = pageEl.scrollTop;
      pageEl.innerHTML = pages.length
        ? pages.map((page, index) => `<button class="ps4-set-item focusable${index === state.focus && !deep ? ' sel' : ''}${current && page.id === current.id ? ' on' : ''}" type="button" data-action="gsh-page" data-page="${esc(page.id)}" data-index="${index}" role="listitem" aria-label="${esc(page.title)}">
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
    const rowKey = `${current?.id || ''}|${state.loading ? 'load' : ''}|${state.error}|${rows.map(row => `${row.id}:${row.kind}:${row.value}`).join('|')}`;
    if (rowKey !== ps4SetRowKey) {
      ps4SetRowKey = rowKey;
      const scroll = rowsEl.scrollTop;
      rowsEl.innerHTML = rows.length
        ? rows.map((row, index) => {
          const value = window.gShell.valueText(row, row.value);
          const meter = row.kind === 'slider' ? `<span class="ps4-set-meter" aria-hidden="true"><i style="width:${window.gShell.percent(row, row.value)}%"></i></span>` : '';
          const check = row.kind === 'toggle' ? `<span class="ps4-set-check${row.value ? ' on' : ''}" aria-hidden="true">${row.value ? '✓' : ''}</span>` : '';
          return `<button class="ps4-set-row focusable" type="button" data-action="gsh-row" data-row="${index}" data-setting-id="${esc(row.id)}" data-kind="${row.kind}" role="listitem" aria-label="${esc(row.label)}${value ? `, ${esc(value)}` : ''}">
            <span class="ps4-set-icon" aria-hidden="true">${icon(window.gShell.settingGlyph(row.id))}</span>
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
    shell.querySelector('.ps4-set-hints').innerHTML = gRow('ps4', deep
      ? [{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Back' }]
      : [{ button: '@confirm', label: 'Open' }, { button: '@back', label: 'Close' }]);
    // The option dialog
    const overlayEl = shell.querySelector('.ps4-set-overlay');
    const dialog = shell.querySelector('.ps4-set-dialog');
    const overlay = state.overlay;
    overlayEl.classList.toggle('open', Boolean(overlay));
    overlayEl.setAttribute('aria-hidden', String(!overlay));
    const overlayKey = overlay ? `${overlay.mode}|${overlay.row.id}|${overlay.selected}|${overlay.value}|${overlay.focus}|${overlay.saving ? 1 : 0}|${overlay.error}` : '';
    if (overlayKey !== ps4SetOverlayKey) {
      ps4SetOverlayKey = overlayKey;
      if (!overlay) {
        dialog.innerHTML = '';
        dialog.removeAttribute('tabindex');
        delete dialog.dataset.action;
      } else {
        let body = '';
        if (overlay.mode === 'slider') {
          const p = window.gShell.percent({ min: overlay.min, max: overlay.max }, overlay.value);
          body = `<div class="ps4-set-slider focusable" role="slider" data-action="gsh-slider" aria-label="${esc(overlay.row.label)}" aria-valuemin="${overlay.min}" aria-valuemax="${overlay.max}" aria-valuenow="${overlay.value}">
            <span class="ps4-set-arrow" aria-hidden="true">◀</span><span class="ps4-set-track" data-gsh-track><i style="width:${p}%"></i><b style="left:${p}%"></b></span><span class="ps4-set-arrow" aria-hidden="true">▶</span></div>
            <strong class="ps4-set-slider-value">${esc(window.gShell.valueText(overlay.row, overlay.value))}</strong>`;
        } else if (overlay.mode === 'choice') {
          body = `<div class="ps4-set-options" role="listbox" aria-label="${esc(overlay.row.label)}">${overlay.options.map((option, index) => `<button class="ps4-set-option focusable${index === overlay.selected ? ' on' : ''}" type="button" role="option" aria-selected="${index === overlay.selected}" data-action="gsh-option" data-option="${index}"><span>${esc(option.label)}</span>${index === overlay.selected ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>`;
        } else {
          body = `<p class="ps4-set-info">${esc(window.gShell.valueText(overlay.row, overlay.row.value) || 'Unavailable')}</p>`;
        }
        const hint = overlay.mode === 'info'
          ? `<button class="ps4-set-action focusable" type="button" data-action="gsh-cancel"><b data-g-role="back">${glyphs.back}</b> Back</button>`
          : `<button class="ps4-set-action focusable" type="button" data-action="gsh-commit"><b data-g-role="confirm">${glyphs.confirm}</b> Select</button><button class="ps4-set-action focusable" type="button" data-action="gsh-cancel"><b data-g-role="back">${glyphs.back}</b> Back</button>`;
        dialog.innerHTML = `<h3>${esc(overlay.row.label)}</h3>${body}<p class="ps4-set-dialog-hint">${overlay.error ? `<span class="ps4-set-error">${esc(overlay.error)}</span>` : ''}${hint}${overlay.saving ? '<span class="ps4-set-saving">Saving…</span>' : ''}</p>`;
        if (overlay.mode === 'info') { dialog.setAttribute('tabindex', '-1'); dialog.dataset.action = 'gsh-cancel'; }
        else { dialog.removeAttribute('tabindex'); delete dialog.dataset.action; }
      }
    }
    // The console's list scrolls under the focus bar; keep the chosen row in view without moving the page.
    const target = ps4SetTarget(state);
    const pane = overlay ? null : deep ? rowsEl : pageEl;
    if (pane && target) {
      const top = target.offsetTop, bottom = top + target.offsetHeight;
      if (top < pane.scrollTop) pane.scrollTop = top;
      else if (bottom > pane.scrollTop + pane.clientHeight) pane.scrollTop = bottom - pane.clientHeight;
    }
  }
  function ps4SetTarget(state) {
    const shell = host.querySelector('.ps4-set');
    if (!shell) return null;
    if (state.overlay) {
      const overlay = state.overlay;
      if (overlay.mode === 'info') return shell.querySelector('.ps4-set-dialog');
      // The dialog's action order is Select then Back; the shell's footer order is Back then Confirm.
      const buttons = shell.querySelectorAll('.ps4-set-dialog-hint .ps4-set-action');
      if (overlay.mode === 'slider') {
        if (overlay.focus === 0) return shell.querySelector('.ps4-set-slider');
        return overlay.focus === 1 ? buttons[1] || buttons[0] : buttons[0];
      }
      const options = shell.querySelectorAll('.ps4-set-option');
      const count = overlay.options.length;
      if (overlay.focus < count) return options[overlay.focus] || options[overlay.selected];
      if (overlay.focus === count) return buttons[1] || buttons[0];
      return buttons[0] || options[overlay.selected] || shell.querySelector('.ps4-set-back');
    }
    if (state.level === 'page') return shell.querySelector('.ps4-set-row.sel') || shell.querySelector('.ps4-set-back');
    return shell.querySelector('.ps4-set-item.sel') || shell.querySelector('.ps4-set-back');
  }
  gShell.define('ps4', {
    root: 'pages',
    backOnLeft: true,
    inlineToggles: true,
    glyphs: ps4SetGlyphs,
    container: () => host,
    render: renderPs4Settings,
    target: ps4SetTarget,
    leave() {
      host.querySelectorAll('.ps4-set, .ps4-set-bg').forEach(node => node.remove());
      ps4SetPageKey = ps4SetRowKey = ps4SetOverlayKey = '';
    },
    returnFocus() { return host.querySelector('.ps4-fn[data-action="settings"]') || host.querySelector('.ps4-tile.sel'); }
  });

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
    if (window.gShell?.isOpen?.('wii')) { window.gShell.render(); return; }
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
      <button class="wii-mail focusable${wiiBar === 1 ? ' sel' : ''}" type="button" data-action="g-notifications" aria-label="Wii Message Board">${img(WIII('mail-button.png'), '<i></i>')}</button></div>
      <div class="wii-hints">${gRow('wii', homePrompts('wii'))}</div>`;
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
    if (window.gShell?.isOpen?.('wii')) { window.gShell.move(direction); return; }
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

  // ---------- Wii: Wii Settings, the light pill-page skin ----------
  // The console's three Wii Settings pages, extended with the rest of the registry layout. Pages are turned with
  // the blue arrows (or left/right at the edge of the grid); a value opens the light sub-screen with pill choices
  // and Back / Confirm. The shared shell owns the model, values, availability and Back; this block paints the Wii.
  const wiiPillParts = () => WIII('btn-texture.png')
    ? `<i class="cap l" style="background-image:${url(WIII('btn-left.png'))}"></i><i class="mid" style="background-image:${url(WIII('btn-texture.png'))}"></i><i class="cap r" style="background-image:${url(WIII('btn-right.png'))}"></i>`
    : '';
  const wiiSetGlyphs = () => ({ confirm: 'A', back: 'B' });
  function wiiBuildShell() {
    let shell = host.querySelector('.wii-set');
    if (shell) return shell;
    const wall = document.createElement('i');
    wall.className = 'wii-set-wall';
    wall.setAttribute('aria-hidden', 'true');
    shell = document.createElement('div');
    shell.className = 'wii-set';
    shell.innerHTML = `<div class="wii-set-head"><span class="wii-set-icon" aria-hidden="true">${img(WIII('settings-icon.png'), icon('repair'))}</span><span class="wii-set-head-copy"><strong>Wii Settings</strong><small class="wii-set-page-name"></small></span></div>
      <button class="wii-set-arrow left focusable" type="button" data-action="gsh-page-turn" data-dir="-1" aria-label="Previous page"></button>
      <div class="wii-set-grid"></div>
      <button class="wii-set-arrow right focusable" type="button" data-action="gsh-page-turn" data-dir="1" aria-label="Next page"></button>
      <div class="wii-set-foot"><button class="wii-pbtn wii-set-back focusable" type="button" data-action="gsh-back">${wiiPillParts()}<span>Back</span></button>
        <span class="wii-set-dots" aria-hidden="true"></span><span class="wii-set-pages"></span><span class="wii-set-hint">${gRow('wii', homePrompts('wii').filter(item => item.label !== 'Page'))}</span></div>
      <div class="wii-set-sub" aria-hidden="true"><div class="wii-set-panel" role="dialog" aria-modal="false" aria-label="Setting"></div></div>`;
    host.append(wall, shell);
    return shell;
  }
  let wiiSetGridKey = '', wiiSetSubKey = '';
  function renderWiiSettings(state) {
    const shell = wiiBuildShell();
    const pages = state.pages || [];
    const page = state.page || pages[state.pageIndex] || null;
    const rows = state.rows || [];
    shell.dataset.anim = state.anim || '';
    shell.querySelector('.wii-set-page-name').textContent = page ? page.title.replace(/^Wii Settings · /, '') : '';
    const grid = shell.querySelector('.wii-set-grid');
    const gridKey = `${page?.id || ''}|${state.loading ? 'load' : ''}|${state.error}|${rows.map(row => `${row.id}:${row.kind}:${row.value}`).join('|')}`;
    if (gridKey !== wiiSetGridKey) {
      wiiSetGridKey = gridKey;
      grid.innerHTML = rows.length
        ? rows.map((row, index) => {
          const value = window.gShell.valueText(row, row.value);
          return `<button class="wii-set-pill focusable${index === state.focus ? ' sel' : ''}" type="button" data-action="gsh-row" data-row="${index}" data-setting-id="${esc(row.id)}" data-kind="${row.kind}" aria-label="${esc(row.label)}${value ? `, ${esc(value)}` : ''}">
            ${wiiPillParts()}<span class="wii-set-pill-icon" aria-hidden="true">${icon(window.gShell.settingGlyph(row.id))}</span>
            <span class="wii-set-pill-copy"><strong>${esc(row.label)}</strong>${value ? `<small>${esc(value)}</small>` : ''}</span></button>`;
        }).join('')
        : `<p class="wii-set-note">${state.loading ? 'Reading settings…' : esc(state.error || 'Nothing on this page is available on this PC.')}</p>`;
    }
    [...grid.querySelectorAll('.wii-set-pill')].forEach((el, index) => el.classList.toggle('sel', index === state.focus));
    const arrows = shell.querySelectorAll('.wii-set-arrow');
    if (arrows[0]) arrows[0].hidden = state.pageIndex <= 0;
    if (arrows[1]) arrows[1].hidden = state.pageIndex >= pages.length - 1;
    const dots = shell.querySelector('.wii-set-dots');
    dots.innerHTML = pages.map((item, index) => `<i${index === state.pageIndex ? ' class="on"' : ''}></i>`).join('');
    shell.querySelector('.wii-set-pages').textContent = pages.length ? `Page ${state.pageIndex + 1} of ${pages.length}` : '';
    shell.querySelector('.wii-set-hint').innerHTML = gRow('wii', pages.length
      ? [{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Back' }]
      : [{ button: '@back', label: 'Back' }]);
    // The value sub-screen: title, pill choices or the Wii bar, and Back / Confirm at the bottom.
    const overlayEl = shell.querySelector('.wii-set-sub');
    const panel = shell.querySelector('.wii-set-panel');
    const overlay = state.overlay;
    overlayEl.classList.toggle('open', Boolean(overlay));
    overlayEl.setAttribute('aria-hidden', String(!overlay));
    const subKey = overlay ? [overlay.row.id, overlay.mode, overlay.selected, overlay.value, overlay.focus, overlay.saving ? 1 : 0, overlay.error].join('|') : '';
    if (subKey !== wiiSetSubKey) {
      wiiSetSubKey = subKey;
      if (!overlay) panel.innerHTML = '';
      else {
        const valueText = overlay.mode === 'slider' ? window.gShell.valueText(overlay.row, overlay.value)
          : overlay.mode === 'info' ? (window.gShell.valueText(overlay.row, overlay.row.value) || 'Unavailable') : '';
        let body = '';
        if (overlay.mode === 'choice') {
          const n = overlay.options.length;
          const footer = { back: n, confirm: n + 1 };
          body = `<div class="wii-set-options" role="listbox" aria-label="${esc(overlay.row.label)}">${overlay.options.map((option, index) => `<button class="wii-set-opt focusable${index === overlay.selected ? ' on' : ''}${index === overlay.focus ? ' focused' : ''}" type="button" role="option" aria-selected="${index === overlay.selected}" data-action="gsh-option" data-option="${index}"><span>${esc(option.label)}</span>${index === overlay.selected ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>`;
          panel.dataset.footerBack = String(footer.back);
          panel.dataset.footerConfirm = String(footer.confirm);
        } else if (overlay.mode === 'slider') {
          body = `<div class="wii-set-slider focusable${overlay.focus === 0 ? ' focused' : ''}" role="slider" data-action="gsh-slider" aria-label="${esc(overlay.row.label)}" aria-valuemin="${overlay.min}" aria-valuemax="${overlay.max}" aria-valuenow="${overlay.value}">
            <span class="wii-set-track" data-gsh-track><i style="width:${window.gShell.percent({ min: overlay.min, max: overlay.max }, overlay.value)}%"></i><b style="left:${window.gShell.percent({ min: overlay.min, max: overlay.max }, overlay.value)}%"></b></span></div>
            <strong class="wii-set-slider-value">${esc(valueText)}</strong>`;
          panel.dataset.footerBack = '1';
          panel.dataset.footerConfirm = '2';
        } else {
          body = `<p class="wii-set-sub-value">${esc(valueText)}</p><p class="wii-set-sub-copy">This is read-only information from this PC.</p>`;
          panel.dataset.footerBack = '0';
          panel.dataset.footerConfirm = '-1';
        }
        const backIndex = Number(panel.dataset.footerBack);
        const confirmIndex = Number(panel.dataset.footerConfirm);
        panel.innerHTML = `<h3><span class="wii-set-panel-icon" aria-hidden="true">${icon(window.gShell.settingGlyph(overlay.row.id))}</span>${esc(overlay.row.label)}</h3>${body}
          <p class="wii-set-sub-error">${overlay.error ? esc(overlay.error) : ''}</p>
          <div class="wii-set-panel-foot"><button class="wii-pbtn focusable${overlay.focus === backIndex ? ' focused' : ''}" type="button" data-action="gsh-cancel">${wiiPillParts()}<span>Back</span></button>
            ${confirmIndex >= 0 ? `<button class="wii-pbtn focusable${overlay.focus === confirmIndex ? ' focused' : ''}" type="button" data-action="gsh-commit">${wiiPillParts()}<span>Confirm</span></button>` : ''}
            ${overlay.saving ? '<span class="wii-set-saving">Saving…</span>' : ''}</div>`;
      }
    }
  }
  function wiiSetTarget(state) {
    const shell = host.querySelector('.wii-set');
    if (!shell) return null;
    if (state.overlay) {
      const overlay = state.overlay;
      const panel = shell.querySelector('.wii-set-panel');
      if (!panel) return shell.querySelector('.wii-set-back');
      if (overlay.mode === 'choice') {
        if (overlay.focus < overlay.options.length) return panel.querySelectorAll('.wii-set-opt')[overlay.focus];
        return panel.querySelectorAll('.wii-pbtn')[overlay.focus - overlay.options.length] || panel.querySelector('.wii-pbtn');
      }
      if (overlay.mode === 'slider') {
        if (overlay.focus === 0) return panel.querySelector('.wii-set-slider');
        return panel.querySelectorAll('.wii-pbtn')[overlay.focus - 1] || panel.querySelector('.wii-pbtn');
      }
      return panel.querySelector('.wii-pbtn');
    }
    return shell.querySelector('.wii-set-pill.sel') || shell.querySelector('.wii-set-back');
  }
  gShell.define('wii', {
    root: 'rows',
    pageCols: 3,
    paged: true,
    inlineToggles: false,
    glyphs: wiiSetGlyphs,
    container: () => host,
    render: renderWiiSettings,
    target: wiiSetTarget,
    leave() {
      host.querySelectorAll('.wii-set, .wii-set-wall').forEach(node => node.remove());
      wiiSetGridKey = wiiSetSubKey = '';
    },
    returnFocus() { return chrome.querySelector('.wii-btn') || host.querySelector('.wii-ch.focusable'); }
  });

  // =========================== 3DS: the HOME Menu ===========================
  // The console, not a picture of it: a light 400x240 top screen above a light 320x240 bottom screen inside a
  // dark body. The stylesheet carries the 1080p geometry for the three Screen Layout arrangements; the top
  // screen shows the status bar, the selected software's banner and its title plate, the bottom screen carries
  // the toolbar and the three-row icon rail. Five columns are in view at Small icon size, four at Large; the rail
  // slides one column at a time instead of being rebuilt.
  let dsFocus = 0, dsTool = -1, dsArtToken = 0;
  const dsHeld = new Set();
  // Wide art is resolved only after the window's load event (see dsBanner): it keeps Electron's security-warning
  // helper from reading the empty resource entry the launcher's image probe leaves behind during load.
  let dsArtReady = document.readyState === 'complete';
  window.addEventListener('load', () => {
    dsArtReady = true;
    if (theme() !== '3ds' || state.view !== 'home' || window.gShell?.isOpen?.('3ds')) return;
    const list = dsList();
    if (list[dsFocus]) dsBanner(list[dsFocus]);
  }, { once: true });
  const DS_ROWS = 3;
  // Screen Layout (registry `screenLayout3ds`): the console arrangement and two 16:9 alternatives.
  const DS_LAYOUTS = ['stacked', 'side-by-side', 'large-top'];
  // The console's two grid sizes in bottom-screen native pixels. The rail is 304px wide, so five 50px columns
  // fit at Small and four 58px columns at Large; both keep three rows so the D-pad grammar never changes.
  const DS_ZOOM = { small: { cell: 44, pitch: 50, cols: 5 }, large: { cell: 52, pitch: 58, cols: 4 } };
  let dsZoom = 'small';
  try { if (localStorage.getItem('g-3ds-zoom') === 'large') dsZoom = 'large'; } catch { /* No storage. */ }
  const dsSpec = () => DS_ZOOM[dsZoom] || DS_ZOOM.small;
  // Toolbar order is the console's: the HOME Menu settings tab, Game Notes, Friend List, Notifications, the
  // Internet Browser, Miiverse, then the two icon-size buttons on the right. Every one is a real action; the
  // two size buttons are real controls that change the grid (and persist), not a picture.
  const DS_TOOLS = [
    ['settings', 'HOME Menu settings', 'tabSettings'],
    ['library', 'Game Notes', 'notes'],
    ['g-friends', 'Friend List', 'friends'],
    ['g-notifications', 'Notifications', 'notes2'],
    ['toggle-search', 'Internet Browser', 'web'],
    ['g-account', 'Miiverse', 'miiverse'],
    ['g-ds-zoom', 'Small icons', 'zoomSmall', 'small'],
    ['g-ds-zoom', 'Large icons', 'zoomLarge', 'large']
  ];
  // D2: the 3ds pack on this machine holds only reference captures, so every system app uses a drawn icon in
  // the console's own colours and shapes. These are original SVGs, never console artwork, and the theme asks
  // for no pack file it cannot see. 48x48 is the console's icon size; the rail draws them in a white cell.
  const DS_ICON = {
    health: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#dcdcd6" stroke-width="1.6"/><path d="M24 9 41 38H7Z" fill="#ffd535" stroke="#c79a00" stroke-width="2.2" stroke-linejoin="round"/><path d="M24 18v10" stroke="#3c3422" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="33" r="2.2" fill="#3c3422"/></svg>`,
    camera: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#ff9f1c"/><rect x="9" y="16" width="30" height="21" rx="4" fill="#fff"/><rect x="17" y="12" width="14" height="5" rx="2" fill="#fff"/><circle cx="24" cy="27" r="7" fill="#ff9f1c"/><circle cx="24" cy="27" r="3" fill="#fff" opacity=".55"/></svg>`,
    sound: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#dcdcd6" stroke-width="1.6"/><path d="M19 34V16l15-3.5V31" fill="none" stroke="#2f9ade" stroke-width="3.2" stroke-linejoin="round"/><ellipse cx="15" cy="35" rx="5" ry="4" fill="#2f9ade"/><ellipse cx="30" cy="32" rx="5" ry="4" fill="#ff9f1c"/></svg>`,
    mii: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#e0e0da" stroke-width="1.6"/><circle cx="24" cy="20" r="9.5" fill="#f7cfa4"/><path d="M14.5 19c.4-6.2 4.4-9.5 9.5-9.5s9.1 3.3 9.5 9.5c-2.8-3-5.6-4.4-9.5-4.4s-6.7 1.4-9.5 4.4z" fill="#6b4a2f"/><path d="M11.5 40c1.4-8 6.2-11.5 12.5-11.5S35.1 32 36.5 40z" fill="#4ec06b"/><circle cx="20.3" cy="20.6" r="1.25" fill="#5a4432"/><circle cx="27.7" cy="20.6" r="1.25" fill="#5a4432"/><path d="M20.5 24.5q3.5 2.4 7 0" fill="none" stroke="#5a4432" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    plaza: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#eef7dc"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#d7e6bd" stroke-width="1.6"/><path d="M4 33h40v11H4z" fill="#9bd45a"/><circle cx="17" cy="23" r="6.4" fill="#f7cfa4"/><path d="M8 40c0-5.4 3.6-8.5 9-8.5s9 3.1 9 8.5" fill="#48ae3a"/><path d="M12 17c.4-4 2.6-6.2 5-6.2s4.6 2.2 5 6.2c-1.6-1.8-3-2.8-5-2.8s-3.4 1-5 2.8z" fill="#7a4b2a"/><circle cx="33" cy="25" r="5.4" fill="#eab98d"/><path d="M26 40c0-4.6 3-7.2 7-7.2s7 2.6 7 7.2" fill="#3f9e6a"/><path d="M28.5 20.5c.3-3.3 2.2-5 4.5-5s4.2 1.7 4.5 5c-1.4-1.5-2.7-2.3-4.5-2.3s-3.1.8-4.5 2.3z" fill="#d8b45a"/></svg>`,
    eshop: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#ff8a1e"/><path d="M13 18h22l-2.2 20H15.2z" fill="#fff"/><path d="M18.5 18v-2a5.5 5.5 0 0 1 11 0v2" fill="none" stroke="#fff" stroke-width="3.2"/></svg>`,
    wrench: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#f4efd8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#d9d2b4" stroke-width="1.6"/><path d="M32 9a7 7 0 0 0-8.6 8.8L11 30.2l5.8 5.8 12.4-12.4A7 7 0 0 0 38 15l-4.4 4.4-3.5-3.5z" fill="#4a4a44"/></svg>`,
    download: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#b96a2f"/><rect x="6" y="16" width="17" height="21" rx="2.4" fill="#f6ead9"/><rect x="9" y="19" width="11" height="9" rx="1.2" fill="#7a4a26"/><rect x="25" y="19" width="17" height="21" rx="2.4" fill="#f6ead9"/><rect x="28" y="22" width="11" height="9" rx="1.2" fill="#7a4a26"/><path d="M24 7v12m-4.5-4.5L24 19l4.5-4.5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    activity: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#deded8" stroke-width="1.6"/><rect x="8" y="27" width="8" height="12" rx="1.6" fill="#7ac94f"/><rect x="20" y="19" width="8" height="20" rx="1.6" fill="#48b34a"/><rect x="32" y="11" width="8" height="28" rx="1.6" fill="#8bd45a"/><path d="M7 15 21 8" fill="none" stroke="#3f9e3a" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    notes2: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#deded8" stroke-width="1.6"/><path d="M9 11h30v19H22l-8 7v-7H9z" fill="#fff" stroke="#3fbf8f" stroke-width="2.6" stroke-linejoin="round"/><path d="M15 18h18M15 23h13" stroke="#3fbf8f" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    friends: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fff8ef"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#f0a54a" stroke-width="2"/><circle cx="18" cy="21" r="2.4" fill="#f2912a"/><circle cx="30" cy="21" r="2.4" fill="#f2912a"/><path d="M16.5 28.5q7.5 6.5 15 0" fill="none" stroke="#f2912a" stroke-width="2.8" stroke-linecap="round"/></svg>`,
    notes: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#deded8" stroke-width="1.6"/><rect x="10" y="9" width="24" height="29" rx="2.4" fill="#fff" stroke="#e5e5dc" stroke-width="1.4"/><path d="M14 16h16M14 21h16M14 26h11" stroke="#d9d9cf" stroke-width="2" stroke-linecap="round"/><path d="M26 35 37 24l3.2 3.2L29.2 38z" fill="#f7cf1f" stroke="#c9a400" stroke-width="1.4" stroke-linejoin="round"/><path d="M26 35l3.2 3.2-4.6 1.4z" fill="#5a5a55"/></svg>`,
    web: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#deded8" stroke-width="1.6"/><circle cx="24" cy="24" r="14" fill="#2f8fe0"/><path d="M10 24h28M24 10c-5 5.6-5 22.4 0 28M24 10c5 5.6 5 22.4 0 28" fill="none" stroke="#fff" stroke-width="1.8"/></svg>`,
    miiverse: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#dbead2" stroke-width="1.6"/><circle cx="15" cy="19" r="4.2" fill="#5cbf3f"/><circle cx="24" cy="16.5" r="4.6" fill="#4bb332"/><circle cx="33" cy="19" r="4.2" fill="#5cbf3f"/><path d="M8 38c0-6 3.2-9.5 7-9.5s4.6 1.6 9 1.6 5.2-1.6 9-1.6 7 3.5 7 9.5z" fill="#4bb332"/></svg>`,
    tabSettings: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M8 24 24 9l16 15" fill="none" stroke="#2f9ade" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 22v17h22V22" fill="none" stroke="#2f9ade" stroke-width="3.6" stroke-linejoin="round"/><circle cx="34" cy="34" r="10" fill="#eaf6fd"/><path d="M38.5 28.5a5 5 0 0 0-6.2 6.2l-4.6 4.6 2.2 2.2 4.6-4.6a5 5 0 0 0 6.2-6.2l-2.6 2.6-2.2-2.2z" fill="#2f9ade"/></svg>`,
    library: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fff"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#d9e4f4" stroke-width="1.6"/><g fill="#3d74d9">${[0, 1, 2].flatMap(row => [0, 1, 2].map(col => `<rect x="${11 + col * 9}" y="${11 + row * 9}" width="7" height="7" rx="1.4"/>`)).join('')}</g></svg>`,
    folder: `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><rect x="1" y="1" width="46" height="46" rx="10" fill="#fbfbf8"/><rect x="1" y="1" width="46" height="46" rx="10" fill="none" stroke="#deded8" stroke-width="1.6"/><path d="M7 15h12l3 4h19v21H7z" fill="#bfe3f4"/><g fill="#fff"><rect x="12" y="23" width="9" height="8" rx="1"/><rect x="23" y="23" width="9" height="8" rx="1"/><rect x="12" y="33" width="9" height="6" rx="1"/><rect x="23" y="33" width="9" height="6" rx="1"/></g></svg>`,
    zoomSmall: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor">${[0, 1, 2].flatMap(row => [0, 1, 2].map(col => `<rect x="${3 + col * 6.4}" y="${3 + row * 6.4}" width="4.6" height="4.6" rx=".9"/>`)).join('')}</g></svg>`,
    zoomLarge: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.4"/><rect x="13" y="3" width="8" height="8" rx="1.4"/><rect x="3" y="13" width="8" height="8" rx="1.4"/><rect x="13" y="13" width="8" height="8" rx="1.4"/></g></svg>`,
    cameraHint: `<svg viewBox="0 0 24 17" aria-hidden="true" focusable="false"><rect x="1.5" y="4" width="15" height="11" rx="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="5.6" y="1.8" width="6.8" height="3.4" rx="1.2" fill="currentColor"/><circle cx="9" cy="9.6" r="3.3" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M19.5 6.5a5.2 5.2 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`
  };
  // The Screen Layout pref is read through the registry's synchronous cache, so the first paint already has it.
  const dsLayoutPref = () => {
    const value = window.gSettings?.cached?.('screenLayout3ds');
    return DS_LAYOUTS.includes(value) ? value : 'stacked';
  };
  // The setting's consumer probe. The registry keeps the row unavailable unless this exists, and the eval reads
  // the applied layout straight off the theme's root element.
  function dsApplyLayout() {
    const layout = dsLayoutPref();
    host.dataset.dsLayout = layout;
    document.body.dataset.g3dsLayout = layout;
    return layout;
  }
  window.g3dsLayout = () => dsApplyLayout();
  // A folder is a real launcher collection: its cell shows the first four covers, and pressing it opens the
  // collection in the library. The console put user folders on the HOME Menu; this is the same thing.
  function dsFolders() {
    return (state.customCollections || []).slice(0, 6).map(collection => ({
      label: collection.name || 'Folder', sub: `${(collection.gameIds || []).length} titles`, folder: true, id: collection.id,
      action: 'collection-open', data: { collection: `custom:${collection.id}` },
      covers: (collection.gameIds || []).map(findGame).filter(Boolean).slice(0, 4)
    }));
  }
  // The bottom-screen grid: folders, then the library, then the console's own apps. Every app is a real action
  // behind a drawn console-style icon (D2); nothing here is a tile that only decorates the screen.
  function dsList() {
    const friends = Number(state.gFriends?.online) || 0;
    const apps = [
      { label: 'Health and Safety', sub: 'System information', action: 'gsh-page', data: { page: 'system' }, svg: 'health' },
      { label: 'Nintendo 3DS Camera', sub: 'Screenshots and clips', action: 'g-retro-captures', svg: 'camera' },
      { label: 'Nintendo 3DS Sound', sub: 'Volume, sounds and music', action: 'gsh-page', data: { page: 'sound' }, svg: 'sound' },
      { label: 'Mii Maker', sub: 'Name and picture', action: 'g-account', svg: 'mii' },
      { label: 'StreetPass Mii Plaza', sub: `${friends} friends online`, action: 'g-friends', svg: 'plaza' },
      { label: 'Nintendo eShop', sub: 'Store', action: 'dashboard-store', svg: 'eshop' },
      { label: 'System Settings', sub: 'Every launcher setting', action: 'settings', svg: 'wrench' },
      { label: 'Download Play', sub: 'Downloads and queue', action: 'console-library-section', data: { section: 'queue' }, svg: 'download' },
      { label: 'Activity Log', sub: 'Play time and all software', action: 'library', svg: 'activity' },
      { label: 'Notifications', sub: 'Recent notices', action: 'g-notifications', svg: 'notes2' },
      { label: 'Friend List', sub: `${friends} online`, action: 'g-friends', svg: 'friends' }
    ];
    return [...dsFolders(), ...games().slice(0, 24).map(gameItem), ...apps];
  }
  // The rail's offset: the selection keeps two columns of context on either side, and the view is centred
  // whatever the number of columns or the icon size. `pad` is the native-pixel inset of the first column.
  function dsRail(list) {
    const spec = dsSpec();
    const cols = Math.max(1, Math.ceil(list.length / DS_ROWS));
    const col = Math.floor(dsFocus / DS_ROWS);
    const view = spec.cols;
    return {
      cols, col, view, cell: spec.cell, pitch: spec.pitch,
      start: Math.max(0, Math.min(col - Math.floor(view / 2), Math.max(0, cols - view))),
      pad: Math.max(0, (304 - view * spec.pitch) / 2)
    };
  }
  const dsFolderMarkup = item => `<span class="ds-folder" aria-hidden="true">${[0, 1, 2, 3].map(index => `<i${item.covers[index] ? ` style="background-image:${url(cover(item.covers[index]))}"` : ''}></i>`).join('')}</span>`;
  function dsSetZoom(next) {
    const value = next === 'large' ? 'large' : 'small';
    if (value === dsZoom) return false;
    dsZoom = value;
    try { localStorage.setItem('g-3ds-zoom', value); } catch { /* No storage. */ }
    renderDs();
    return true;
  }
  // The Camera hint (Y) opens the newest capture; the size buttons and L+R change the grid's icon size.
  function openDsCamera() {
    if (theme() !== '3ds' || state.view !== 'home' || document.querySelector('dialog[open]')) return false;
    play('confirm');
    loadCaptures();
    openLatestCapture();
    return true;
  }
  function renderDs() {
    if (window.gShell?.isOpen?.('3ds')) { window.gShell.render(); return; }
    const layout = dsApplyLayout();
    const list = dsList();
    const spec = dsSpec();
    dsFocus = Math.max(0, Math.min(dsFocus, list.length - 1));
    const rail = dsRail(list);
    const coins = Math.min(300, 10 + allGames().length);
    const tools = DS_TOOLS.slice(0, 6).map(([action, label, svg], index) => `<button class="ds-tool${index === 0 ? ' tab' : ''} focusable${dsTool === index ? ' sel' : ''}" type="button" data-action="${action}" data-ds-tool="${index}" aria-label="${esc(label)}">${DS_ICON[svg] || ''}</button>`).join('');
    const sizes = DS_TOOLS.slice(6).map(([action, label, svg, size], index) => {
      const toolIndex = index + 6, on = size === dsZoom;
      return `<button class="ds-tool ds-size-btn focusable${dsTool === toolIndex ? ' sel' : ''}${on ? ' on' : ''}" type="button" data-action="${action}" data-size="${size}" data-ds-tool="${toolIndex}" aria-label="${esc(label)}" aria-pressed="${on}">${DS_ICON[svg] || ''}</button>`;
    }).join('');
    const cells = list.map((item, index) => `<button class="ds-icon focusable${index === dsFocus && dsTool < 0 ? ' sel' : ''}" type="button" ${attrs(item)} data-ds-index="${index}" aria-label="${esc(item.label)}" style="--c:${Math.floor(index / DS_ROWS)};--r:${index % DS_ROWS}">
          ${item.folder ? dsFolderMarkup(item) : item.game ? `<span class="ds-cover" style="background-image:${url(cover(item.game))}"></span>` : `<span class="ds-app">${DS_ICON[item.svg] || icon('game')}</span>`}</button>`).join('');
    host.classList.toggle('ds-still', reducedMotion());
    host.innerHTML = `<div class="ds-device" role="group" aria-label="Nintendo 3DS">
        <i class="ds-hinge" aria-hidden="true"></i><i class="ds-cam-dot" aria-hidden="true"></i><i class="ds-led" aria-hidden="true"></i>
        <section class="ds-screen ds-top" aria-label="Top screen">
          <div class="ds-statusbar"><span class="ds-signal" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="ds-pill">Internet</span><span class="ds-coin" aria-label="${coins} Play Coins"><i>P</i>${coins}</span>
            <span class="ds-when">${esc(dayMonth())} (${esc(weekday())})</span><span class="ds-clock">${esc(time()).replace(':', '<b>:</b>')}</span><span class="ds-battery" aria-hidden="true"><i></i></span></div>
          <div class="ds-banner"><i class="ds-art" aria-hidden="true"></i><div class="ds-plate"><i class="ds-plate-icon" aria-hidden="true"></i><span><strong></strong><small></small></span></div></div>
          <div class="ds-hints">
            <span class="ds-hint ds-hint-l"><span class="ds-hint-cam" aria-hidden="true">${DS_ICON.cameraHint}</span>${gRow('3ds', [{ button: 'y', label: 'Camera' }])}</span>
            <span class="ds-hint ds-hint-r">${gRow('3ds', [{ buttons: ['l', 'r'], label: 'Icon size' }])}</span>
          </div>
        </section>
        <section class="ds-screen ds-bot" aria-label="Bottom screen">
          <div class="ds-toolbar">${tools}<span class="ds-gap"></span><span class="ds-sizes" role="group" aria-label="Icon size">${sizes}</span></div>
          <div class="ds-field"><div class="ds-grid" style="--cell:${spec.cell};--pitch:${spec.pitch};--cols:${rail.cols};--start:${rail.start};--pad:${rail.pad}">${cells}
            <span class="ds-cursor" style="--c:${rail.col};--r:${dsFocus % DS_ROWS}" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div></div>
          <div class="ds-scroll" aria-hidden="true"><i style="--p:${rail.cols > rail.view ? rail.start / (rail.cols - rail.view) : 0}"></i></div>
        </section>
      </div>`;
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
    grid.style.setProperty('--cols', rail.cols);
    host.querySelectorAll('.ds-icon').forEach((button, i) => button.classList.toggle('sel', i === dsFocus && dsTool < 0));
    const cursor = host.querySelector('.ds-cursor');
    if (cursor) { cursor.style.setProperty('--c', rail.col); cursor.style.setProperty('--r', dsFocus % DS_ROWS); }
    host.querySelectorAll('.ds-tool').forEach((button, i) => button.classList.toggle('sel', i === dsTool));
    const bar = host.querySelector('.ds-scroll i');
    if (bar) bar.style.setProperty('--p', rail.cols > rail.view ? rail.start / (rail.cols - rail.view) : 0);
    dsBanner(list[dsFocus]);
    focusEl(dsTool >= 0 ? host.querySelector(`[data-ds-tool="${dsTool}"]`) : host.querySelector('.ds-icon.sel'));
  }
  function dsBanner(item) {
    const banner = host.querySelector('.ds-banner');
    const plate = host.querySelector('.ds-plate');
    if (!banner || !plate || !item) return;
    const token = ++dsArtToken;
    plate.querySelector('strong').textContent = item.label;
    // The white plate carries the software's publisher, or the system app's own line.
    plate.querySelector('small').textContent = item.game
      ? [item.game.developer || item.game.publisher || (item.game.provider === 'PC' ? '' : item.game.provider), playtime(item.game)].filter(Boolean).join(' · ')
      : item.sub || '';
    const iconEl = plate.querySelector('.ds-plate-icon');
    iconEl.innerHTML = item.game ? '' : DS_ICON[item.folder ? 'folder' : item.svg] || '';
    iconEl.style.backgroundImage = item.game && cover(item.game) ? cssUrl(cover(item.game)) : '';
    const art = host.querySelector('.ds-art');
    art.style.backgroundImage = ''; art.innerHTML = '';
    banner.classList.toggle('system', !item.game);
    banner.classList.remove('preload');
    banner.style.setProperty('--px', 0); banner.style.setProperty('--py', 0);
    if (!item.game) {
      // A system app has no wide art, so its own drawn icon stands in on the light banner.
      art.innerHTML = DS_ICON[item.folder ? 'folder' : item.svg] || '';
      return;
    }
    // The wide-art resolver probes candidates with <img> loads. The launcher's probe clears a failed image with
    // `src = ''`, and Electron 39's security-warning helper throws on the resulting empty resource entry when it
    // runs at the window load event. Resolve art after load instead, showing the square cover in the frame first.
    if (!dsArtReady) {
      art.style.backgroundImage = cover(item.game) ? cssUrl(cover(item.game)) : '';
      banner.classList.add('preload');
      return;
    }
    banner.classList.remove('preload');
    if (!window.gWideArt) { art.style.backgroundImage = cover(item.game) ? cssUrl(cover(item.game)) : ''; return; }
    window.gWideArt(item.game).then(src => {
      // A quick move can land this lookup after the next game's; only the latest selection may paint.
      if (token !== dsArtToken || !art.isConnected) return;
      art.style.backgroundImage = cssUrl(src || cover(item.game));
    }).catch(() => {});
  }
  function dsMove(direction) {
    if (window.gShell?.isOpen?.('3ds')) { window.gShell.move(direction); return; }
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
  // The banner has depth: the wide art drifts a few native pixels against the pointer while the white plate
  // stays still. It is pointer-driven only (no loop), and reduce-motion turns it off with the rest of the theme.
  host.addEventListener('pointermove', event => {
    if (theme() !== '3ds' || reducedMotion()) return;
    const banner = event.target.closest?.('.ds-banner');
    if (!banner) return;
    const rect = banner.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    banner.style.setProperty('--px', (((event.clientX - rect.left) / rect.width) - .5).toFixed(3));
    banner.style.setProperty('--py', (((event.clientY - rect.top) / rect.height) - .5).toFixed(3));
  }, { passive: true });
  host.addEventListener('pointerleave', () => {
    const banner = host.querySelector('.ds-banner');
    if (!banner) return;
    banner.style.setProperty('--px', 0);
    banner.style.setProperty('--py', 0);
  }, { passive: true });
  // Screen Layout changes the device live (task D1): the pref drives a data attribute on the root element, so
  // the screens are only rebuilt when the registry reports a new value. If System Settings is open, the Home
  // screen underneath is hidden; it is rebuilt when the shell closes instead of fighting the shell's painter.
  document.addEventListener('g-setting-change', event => {
    if (event.detail?.id !== 'screenLayout3ds' || theme() !== '3ds') return;
    dsApplyLayout();
    if (state.view === 'home' && !window.gShell?.isOpen?.('3ds')) renderDs();
  });
  document.addEventListener('g-settings-ready', () => {
    if (theme() !== '3ds') return;
    dsApplyLayout();
    if (state.view === 'home' && !window.gShell?.isOpen?.('3ds')) renderDs();
  });
  // Y is the console's Camera shortcut (printed on the top screen); L+R changes the icon size (printed beside
  // it). X stays the Options button handled above. The pad paths are the toggle-search redirect and the poll.
  document.addEventListener('keydown', event => {
    if (!on() || theme() !== '3ds' || state.view !== 'home' || document.querySelector('dialog[open]')
      || (typeof isTextEntry === 'function' && isTextEntry(event.target))) return;
    const key = String(event.key || '').toLowerCase();
    if (key === 'y' && openDsCamera()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (key === 'l' || key === 'r') {
      dsHeld.add(key);
      if (dsHeld.has('l') && dsHeld.has('r')) {
        dsSetZoom(dsZoom === 'small' ? 'large' : 'small');
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }
  }, true);
  document.addEventListener('keyup', event => dsHeld.delete(String(event.key || '').toLowerCase()), true);
  window.addEventListener('blur', () => dsHeld.clear());

  // ---------- 3DS: System Settings, the two-screen skin ----------
  // The top screen describes the focused option; the bottom screen holds the console's large white buttons. Its
  // root is the four buttons the console grouped there — Internet Settings, Data Management, Other Settings and
  // Advanced (launcher); Other Settings lists the rest of the registry layout. The shared shell owns the model,
  // values, availability and Back grammar; this block paints the two screens.
  const DS_SET_ICONS = {
    internet: { svg: 'web' }, data: { svg: 'library' }, profile: { svg: 'mii' },
    'date-time': { glyph: 'language' }, sound: { glyph: 'volume' }, display: { glyph: 'tv' }, theme: { glyph: 'color' },
    controls: { glyph: 'controller' }, notifications: { glyph: 'bell' }, system: { glyph: 'settings' }, advanced: { glyph: 'settings' }
  };
  const DS_SET_COPY = {
    internet: 'Set up and test this PC\'s Internet connection, and see who is online.',
    data: 'See how much space is free and how many games and apps the launcher knows about.',
    profile: 'Change the name and picture shown around the launcher.',
    'date-time': 'Choose how the clock and dates are written everywhere.',
    sound: 'Set the volume, mute the PC, and choose interface and menu music.',
    display: 'Adjust screen brightness, interface size and the two-screen layout.',
    theme: 'Choose the background picture behind the HOME Menu.',
    controls: 'Set the button layout and vibration, and see the connected controller.',
    notifications: 'Choose which friend, download and achievement notifications appear.',
    system: 'See the version, check for updates and reset the launcher\'s data.',
    advanced: 'Open the launcher\'s own settings for everything else.',
    other: 'Profile, Date & Time, Sound, Display, Theme, Controls, Notifications and System live here.'
  };
  const dsSetIcon = pageId => {
    const spec = DS_SET_ICONS[pageId] || {};
    if (spec.svg && DS_ICON[spec.svg]) return DS_ICON[spec.svg];
    return icon(spec.glyph || 'settings');
  };
  const dsSetPageCopy = page => DS_SET_COPY[page?.id] || 'Each row here changes something real in the launcher.';
  const dsSetGlyphs = () => ({ confirm: 'A', back: 'B' });
  function dsRootItems(state) {
    const pages = state.pages || [];
    const find = id => pages.find(page => page.id === id);
    const list = [];
    const internet = find('internet');
    if (internet) list.push({ kind: 'page', id: 'internet', pageId: 'internet', label: internet.title, copy: DS_SET_COPY.internet, icon: dsSetIcon('internet') });
    const data = find('data');
    if (data) list.push({ kind: 'page', id: 'data', pageId: 'data', label: data.title, copy: DS_SET_COPY.data, icon: dsSetIcon('data') });
    if (pages.some(page => !['internet', 'data', 'advanced'].includes(page.id))) list.push({ kind: 'other', id: 'other', label: 'Other Settings', copy: DS_SET_COPY.other, icon: DS_ICON.wrench });
    const advanced = find('advanced');
    if (advanced) list.push({ kind: 'advanced', id: 'advanced', pageId: 'advanced', label: advanced.title, copy: DS_SET_COPY.advanced, icon: icon('settings') });
    return list;
  }
  function dsBuildShell() {
    let shell = host.querySelector('.ds-set');
    if (shell) return shell;
    const device = document.createElement('i');
    device.className = 'ds-set-device';
    device.setAttribute('aria-hidden', 'true');
    shell = document.createElement('div');
    shell.className = 'ds-set';
    shell.innerHTML = `<section class="ds-set-top" aria-label="System Settings description">
        <div class="ds-set-topbar"><span class="ds-set-brand">System Settings</span><span class="ds-set-when"></span></div>
        <div class="ds-set-copy"><span class="ds-set-kicker"></span><h2></h2><p></p><span class="ds-set-readout" hidden></span></div>
        <div class="ds-set-art" aria-hidden="true"><span class="ds-set-art-icon"></span></div>
      </section>
      <section class="ds-set-bottom" aria-label="System Settings options">
        <div class="ds-set-buttons"></div>
        <button class="ds-set-back focusable" type="button" data-action="gsh-back">‹ Back</button>
        <span class="ds-set-hint">${gRow('3ds', [{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Back' }])}</span>
        <div class="ds-set-sub" aria-hidden="true"><div class="ds-set-panel" role="dialog" aria-modal="false" aria-label="Setting"></div></div>
      </section>`;
    host.append(device, shell);
    return shell;
  }
  let dsSetButtonsKey = '', dsSetSubKey = '', dsSetArtKey = '';
  function renderDsSettings(state) {
    const shell = dsBuildShell();
    const pages = state.pages || [];
    const page = state.page || null;
    const root = dsRootItems(state);
    const other = pages.filter(item => !['internet', 'data', 'advanced'].includes(item.id));
    const rows = state.rows || [];
    const overlay = state.overlay;
    // Top screen: the focused option in the console's own words.
    let kicker = 'System Settings', title = 'System Settings', copy = '', readout = '', art = 'settings';
    if (overlay) {
      kicker = page?.title || 'System Settings';
      title = overlay.row.label;
      art = overlay.row.id;
      if (overlay.mode === 'slider') { readout = window.gShell.valueText(overlay.row, overlay.value); copy = 'Use left and right to change the value, then press A on OK.'; }
      else if (overlay.mode === 'choice') {
        const chosen = overlay.options[overlay.selected];
        readout = chosen?.label || '';
        copy = overlay.focus >= overlay.options.length ? 'Press A on OK to keep this value, or Back to leave it as it was.' : 'Choose a value with A, then confirm with OK.';
      } else {
        readout = window.gShell.valueText(overlay.row, overlay.row.value) || 'Unavailable';
        copy = 'This is read-only information from this PC. Press A or B to go back.';
      }
    } else if (state.level === 'page') {
      kicker = page?.title || 'System Settings';
      const row = rows[state.focus];
      if (row) {
        title = row.label;
        art = row.id;
        readout = window.gShell.valueText(row, row.value) || '';
        copy = row.kind === 'toggle' ? 'Press A to turn it on or off.'
          : row.kind === 'choice' ? 'Press A to choose a value.'
            : row.kind === 'slider' ? 'Press A, then use left and right to change it.'
              : row.kind === 'action' ? 'Press A to start. It opens the launcher\'s own control with all of its confirmation steps.'
                : 'This is read-only information from this PC.';
      } else {
        title = page?.title || 'System Settings';
        copy = state.loading ? 'Reading settings…' : state.error || 'Nothing on this page is available on this PC.';
      }
    } else if (state.level === 'other') {
      kicker = 'Other Settings';
      const target = other[state.focus];
      if (target) { title = target.title; copy = dsSetPageCopy(target); art = target.id; }
      else copy = 'Nothing else is available on this PC right now.';
    } else {
      const target = root[state.focus];
      if (target) { title = target.label; copy = target.copy; art = target.kind === 'other' ? 'other' : target.kind === 'advanced' ? 'advanced' : target.pageId; }
      else copy = state.loading ? 'Reading settings…' : state.error || 'No settings are available on this PC right now.';
    }
    shell.querySelector('.ds-set-when').textContent = `${dayMonth()} ${time()}`;
    shell.querySelector('.ds-set-kicker').textContent = kicker;
    shell.querySelector('.ds-set-top h2').textContent = title;
    shell.querySelector('.ds-set-top p').textContent = copy || '';
    const readoutEl = shell.querySelector('.ds-set-readout');
    readoutEl.hidden = !readout;
    readoutEl.textContent = readout;
    const artKey = String(art);
    if (artKey !== dsSetArtKey) {
      dsSetArtKey = artKey;
      const artEl = shell.querySelector('.ds-set-art-icon');
      artEl.innerHTML = DS_SET_ICONS[art]?.svg ? dsSetIcon(art) : DS_SET_ICONS[art]?.glyph ? icon(DS_SET_ICONS[art].glyph) : icon(window.gShell.settingGlyph(art));
    }
    // Bottom screen: the buttons for this level.
    const buttons = shell.querySelector('.ds-set-buttons');
    const gridKey = [state.level, state.page?.id || '', state.loading ? 1 : 0, state.error, state.focus,
      state.level === 'page' ? rows.map(row => `${row.id}:${row.kind}:${row.value}`).join('|') : state.level === 'other' ? other.map(item => item.id).join('|') : root.map(item => item.kind + (item.pageId || '')).join('|')].join('~');
    if (gridKey !== dsSetButtonsKey) {
      dsSetButtonsKey = gridKey;
      buttons.className = `ds-set-buttons ${state.level === 'page' ? 'rows' : state.level === 'other' ? 'other' : 'categories'}`;
      if (state.level === 'page') {
        buttons.innerHTML = rows.length
          ? rows.map((row, index) => {
            const value = window.gShell.valueText(row, row.value);
            return `<button class="ds-set-tile row focusable${index === state.focus ? ' sel' : ''}" type="button" data-action="gsh-row" data-row="${index}" data-setting-id="${esc(row.id)}" data-kind="${row.kind}" aria-label="${esc(row.label)}${value ? `, ${esc(value)}` : ''}">
              <span class="ds-set-tile-icon" aria-hidden="true">${icon(window.gShell.settingGlyph(row.id))}</span>
              <span class="ds-set-tile-copy"><strong>${esc(row.label)}</strong>${value ? `<small>${esc(value)}</small>` : ''}</span>
              ${row.kind === 'toggle' ? `<span class="ds-set-check${row.value ? ' on' : ''}" aria-hidden="true">${row.value ? '✓' : ''}</span>` : ''}
              ${row.kind === 'choice' || row.kind === 'action' ? '<span class="ds-set-chevron" aria-hidden="true">›</span>' : ''}
            </button>`;
          }).join('')
          : `<p class="ds-set-note">${state.loading ? 'Reading settings…' : esc(state.error || 'Nothing on this page is available on this PC.')}</p>`;
      } else if (state.level === 'other') {
        buttons.innerHTML = other.length
          ? other.map((item, index) => `<button class="ds-set-tile category small focusable${index === state.focus ? ' sel' : ''}" type="button" data-action="gsh-page" data-page="${esc(item.id)}" data-index="${index}" aria-label="${esc(item.title)}">
              <span class="ds-set-tile-icon" aria-hidden="true">${dsSetIcon(item.id)}</span><strong>${esc(item.title)}</strong></button>`).join('')
          : `<p class="ds-set-note">Nothing else is available on this PC right now.</p>`;
      } else {
        buttons.innerHTML = root.length
          ? root.map((item, index) => `<button class="ds-set-tile category focusable${index === state.focus ? ' sel' : ''}" type="button" data-action="gsh-root" data-index="${index}" aria-label="${esc(item.label)}">
              <span class="ds-set-tile-icon" aria-hidden="true">${item.icon}</span><strong>${esc(item.label)}</strong></button>`).join('')
          : `<p class="ds-set-note">${state.loading ? 'Reading settings…' : esc(state.error || 'No settings are available on this PC right now.')}</p>`;
      }
    }
    const back = shell.querySelector('.ds-set-back');
    back.textContent = state.level === 'root' ? '‹ Close' : '‹ Back';
    // The sub-screen on the bottom screen: values, or the 3DS slider, with Back and OK.
    const overlayEl = shell.querySelector('.ds-set-sub');
    const panel = shell.querySelector('.ds-set-panel');
    overlayEl.classList.toggle('open', Boolean(overlay));
    overlayEl.setAttribute('aria-hidden', String(!overlay));
    const subKey = overlay ? [overlay.row.id, overlay.mode, overlay.selected, overlay.value, overlay.focus, overlay.saving ? 1 : 0, overlay.error].join('|') : '';
    if (subKey !== dsSetSubKey) {
      dsSetSubKey = subKey;
      if (!overlay) panel.innerHTML = '';
      else {
        const n = overlay.options.length;
        let body = '';
        if (overlay.mode === 'choice') {
          body = `<div class="ds-set-options" role="listbox" aria-label="${esc(overlay.row.label)}">${overlay.options.map((option, index) => `<button class="ds-set-option focusable${index === overlay.selected ? ' on' : ''}${index === overlay.focus ? ' focused' : ''}" type="button" role="option" aria-selected="${index === overlay.selected}" data-action="gsh-option" data-option="${index}"><span>${esc(option.label)}</span>${index === overlay.selected ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('')}</div>`;
        } else if (overlay.mode === 'slider') {
          body = `<div class="ds-set-slider focusable${overlay.focus === 0 ? ' focused' : ''}" role="slider" data-action="gsh-slider" aria-label="${esc(overlay.row.label)}" aria-valuemin="${overlay.min}" aria-valuemax="${overlay.max}" aria-valuenow="${overlay.value}"><span class="ds-set-track" data-gsh-track><i style="width:${window.gShell.percent({ min: overlay.min, max: overlay.max }, overlay.value)}%"></i><b style="left:${window.gShell.percent({ min: overlay.min, max: overlay.max }, overlay.value)}%"></b></span></div><strong class="ds-set-slider-value">${esc(window.gShell.valueText(overlay.row, overlay.value))}</strong>`;
        } else {
          body = `<p class="ds-set-info">${esc(window.gShell.valueText(overlay.row, overlay.row.value) || 'Unavailable')}</p>`;
        }
        const backIndex = overlay.mode === 'slider' ? 1 : overlay.mode === 'choice' ? n : 0;
        const okIndex = overlay.mode === 'info' ? -1 : overlay.mode === 'slider' ? 2 : n + 1;
        panel.innerHTML = `<h3><span class="ds-set-panel-icon" aria-hidden="true">${icon(window.gShell.settingGlyph(overlay.row.id))}</span>${esc(overlay.row.label)}</h3>${body}
          <p class="ds-set-sub-error">${overlay.error ? esc(overlay.error) : ''}</p>
          <div class="ds-set-panel-foot">
            <button class="ds-set-action focusable${overlay.focus === backIndex ? ' focused' : ''}" type="button" data-action="gsh-cancel">Back</button>
            ${okIndex >= 0 ? `<button class="ds-set-action ok focusable${overlay.focus === okIndex ? ' focused' : ''}" type="button" data-action="gsh-commit">OK</button>` : ''}
            ${overlay.saving ? '<span class="ds-set-saving">Saving…</span>' : ''}</div>`;
      }
    }
  }
  function dsSetTarget(state) {
    const shell = host.querySelector('.ds-set');
    if (!shell) return null;
    if (state.overlay) {
      const overlay = state.overlay;
      const panel = shell.querySelector('.ds-set-panel');
      if (!panel) return shell.querySelector('.ds-set-back');
      if (overlay.mode === 'choice') {
        if (overlay.focus < overlay.options.length) return panel.querySelectorAll('.ds-set-option')[overlay.focus];
        return panel.querySelectorAll('.ds-set-action')[overlay.focus - overlay.options.length] || panel.querySelector('.ds-set-action');
      }
      if (overlay.mode === 'slider') {
        if (overlay.focus === 0) return panel.querySelector('.ds-set-slider');
        return panel.querySelectorAll('.ds-set-action')[overlay.focus - 1] || panel.querySelector('.ds-set-action');
      }
      return panel.querySelector('.ds-set-action');
    }
    return shell.querySelector('.ds-set-tile.sel') || shell.querySelector('.ds-set-back');
  }
  gShell.define('3ds', {
    root: 'tiles',
    rootCols: 2,
    otherCols: 4,
    pageCols: 2,
    inlineToggles: true,
    glyphs: dsSetGlyphs,
    container: () => host,
    rootItems: dsRootItems,
    render: renderDsSettings,
    target: dsSetTarget,
    leave() {
      host.querySelectorAll('.ds-set, .ds-set-device').forEach(node => node.remove());
      dsSetButtonsKey = dsSetSubKey = dsSetArtKey = '';
    },
    returnFocus() { return host.querySelector('.ds-tool[data-ds-tool="0"]') || host.querySelector('.ds-icon.sel'); }
  });

  // =========================== Rendering, navigation, sounds ===========================
  const reducedMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderedTheme = '', enterTimer = 0;
  function render(rebuild = true) {
    const id = theme();
    // A settings shell belongs to one console; leaving that console closes it (the shell also watches the theme).
    if (window.gShell?.isOpen() && !window.gShell.isOpen(id)) window.gShell.close({ restore: false, silent: true, sound: false });
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
        enterTimer = setTimeout(() => document.body.classList.remove('retro-enter'), motionMs('fade') + 500);
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
  // Closing a dialog returns the focus to the console screen. The shell's own close listener reloads its rows.
  document.addEventListener('close', event => {
    if (!on() || state.view !== 'home' || !event.target?.matches?.('dialog')) return;
    requestAnimationFrame(() => {
      if (!on() || state.view !== 'home') return;
      render();
    });
  }, true);
  if (typeof navigateConsoleHome === 'function') {
    const base = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (window.gShell?.isOpen()) { window.gShell.move(direction); return true; }
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
  // Mouse and touch on the console Home. The settings shell's own controls (gsh-*) are left to the global action
  // dispatcher, so a click and Enter take exactly the same path through gShell.
  document.addEventListener('click', event => {
    if (!on()) return;
    const el = event.target.closest?.('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action.startsWith('gsh-')) return;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    // A first click on an XMB item, PS4 tile or 3DS icon that isn't selected selects it, as the pointer did.
    if (theme() === 'ps3' && el.classList.contains('xmb-item') && !el.classList.contains('on')) { stop(); xmbItem[xmbCategories()[xmbCat].id] = Number(el.dataset.xmbIndex); play('navigate'); renderXmb(false); return; }
    if (theme() === '3ds' && el.classList.contains('ds-icon') && !el.classList.contains('sel')) { stop(); dsFocus = Number(el.dataset.dsIndex); dsTool = -1; play('navigate'); dsUpdate(); return; }
    if (theme() === 'ps4' && el.classList.contains('ps4-tile') && !el.classList.contains('sel')) { stop(); ps4Focus = Number(el.dataset.ps4Index); ps4Area = 'row'; play('navigate'); renderPs4(false); return; }
    if (action === 'g-ps4-overview') { stop(); play('confirm'); if (typeof openGameDetails === 'function') openGameDetails(el.dataset.gameId); return; }
    if (action === 'g-retro-preview') { stop(); play('confirm'); wiiPreview = el.dataset.gameId; render(); return; }
    if (action === 'g-wii-back') { stop(); play('back'); wiiPreview = null; render(); return; }
    if (action === 'g-wii-page') { stop(); play('category'); wiiPage += Number(el.dataset.dir); wiiFocus = 0; render(); return; }
    if (action === 'g-retro-captures') { stop(); play('confirm'); loadCaptures(); openLatestCapture(); return; }
    if (action === 'g-ds-zoom') { stop(); if (dsSetZoom(el.dataset.size === 'large' ? 'large' : 'small')) play('category'); return; }
    if (action === 'g-retro-weather') { stop(); if (typeof showToast === 'function') showToast(`Forecast · ${now().toLocaleDateString([], { weekday: 'long' })} · Have a great day of gaming`); return; }
    // Items that are games boot straight into them, as on these consoles.
    if (el.dataset.retroBoot && el.dataset.gameId) {
      const game = findGame(el.dataset.gameId);
      if (game && game.installed !== false) { stop(); play('launch'); wiiPreview = null; selectGame(game.id, false, el); launchSelectedGame(); }
    }
  }, true);
  // Back: the shared shell handles its own levels first; the Home-level previews and toolbars keep their old grammar.
  if (typeof navigateBack === 'function') {
    const back = navigateBack;
    navigateBack = function (...args) {
      if (window.gShell?.isOpen()) return back.apply(this, args);
      if (on() && state.view === 'home') {
        if (theme() === 'wii' && wiiPreview) { play('back'); wiiPreview = null; render(); return; }
        if (theme() === 'ps4' && ps4Area !== 'row') { play('back'); ps4Area = 'row'; render(); return; }
        if (theme() === '3ds' && dsTool >= 0) { play('back'); dsTool = -1; dsUpdate(); return; }
      }
      return back.apply(this, args);
    };
  }

  // ---------- G1: each console's own Options / page buttons ----------
  // The shared launcher maps Y (pad button 3) to search, but a PS3's triangle and a 3DS's X are that
  // console's Options button. This keeps the prompt honest: the glyph on the hint bar and the pad do the
  // same thing. The 3DS X is pad button 2, which the launcher does not read, so a tiny focused poll covers it.
  function selectedHomeGameId() {
    if (theme() === 'ps3') return document.querySelector('#g-retro .xmb-item.on[data-game-id]')?.dataset.gameId || '';
    if (theme() === '3ds') return document.querySelector('#g-retro .ds-icon.sel[data-game-id]')?.dataset.gameId || '';
    return '';
  }
  function openHomeOptions() {
    const gameId = selectedHomeGameId();
    if (!gameId || typeof openGameOptions !== 'function') return false;
    if (!document.querySelector('#launch-overlay')?.hidden || document.querySelector('dialog[open]')) return false;
    play('confirm');
    openGameOptions(gameId);
    return true;
  }
  if (typeof performAction === 'function') {
    const performBase = performAction;
    performAction = async function (action, source) {
      // A controller press arrives without a source element; the XMB's own Internet Search tile passes one.
      // On the 3DS Y is the Camera shortcut the top screen prints, while X (pad button 2, polled below) is
      // that console's Options button.
      if (action === 'toggle-search' && !source && state.view === 'home') {
        if (theme() === '3ds' && openDsCamera()) return true;
        if (theme() === 'ps3' && openHomeOptions()) return true;
      }
      return performBase.apply(this, arguments);
    };
  }
  let dsOptionsTimer = 0, dsOptionsHeld = false, dsSizeHeld = false;
  function pollDsOptions() {
    if (theme() !== '3ds' || document.hidden || !document.hasFocus() || state.view !== 'home' || document.querySelector('dialog[open]')) { dsOptionsHeld = dsSizeHeld = false; return; }
    const pads = navigator.getGamepads?.() || [];
    const pad = [...pads].find(candidate => candidate?.connected);
    const pressed = Boolean(pad?.buttons?.[2]?.pressed || pad?.buttons?.[2]?.value > .55);
    if (pressed && !dsOptionsHeld) openHomeOptions();
    dsOptionsHeld = pressed;
    // L+R (the two shoulder buttons the top screen prints) changes the icon size while both are held.
    const held = index => Boolean(pad?.buttons?.[index]?.pressed || pad?.buttons?.[index]?.value > .55);
    const both = held(4) && held(5);
    if (both && !dsSizeHeld) dsSetZoom(dsZoom === 'small' ? 'large' : 'small');
    dsSizeHeld = both;
  }
  function syncDsOptionsPoll() {
    // Only while the 3DS is the theme, the window is in use and a controller is actually connected.
    const padConnected = [...(navigator.getGamepads?.() || [])].some(pad => pad?.connected);
    const wanted = theme() === '3ds' && document.visibilityState === 'visible' && document.hasFocus() && padConnected;
    if (wanted && !dsOptionsTimer) dsOptionsTimer = setInterval(pollDsOptions, 40);
    else if (!wanted && dsOptionsTimer) { clearInterval(dsOptionsTimer); dsOptionsTimer = 0; dsOptionsHeld = dsSizeHeld = false; }
  }
  syncDsOptionsPoll();
  window.addEventListener('gamepadconnected', syncDsOptionsPoll);
  window.addEventListener('gamepaddisconnected', syncDsOptionsPoll);
  new MutationObserver(syncDsOptionsPoll).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  window.addEventListener('focus', syncDsOptionsPoll);
  window.addEventListener('blur', syncDsOptionsPoll);
  document.addEventListener('visibilitychange', syncDsOptionsPoll);
  document.addEventListener('keydown', event => {
    if (!on() || document.querySelector('dialog[open]') || (typeof isTextEntry === 'function' && isTextEntry(event.target))) return;
    const key = String(event.key || '');
    if (theme() === '3ds' && key.toLowerCase() === 'x' && state.view === 'home') {
      if (openHomeOptions()) { event.preventDefault(); event.stopImmediatePropagation(); }
      return;
    }
    if (theme() === 'ps3' && key.toLowerCase() === 'y' && state.view === 'home') {
      if (openHomeOptions()) { event.preventDefault(); event.stopImmediatePropagation(); }
      return;
    }
    if (theme() === 'wii' && state.view === 'home' && !wiiPreview && !window.gShell?.isOpen?.()) {
      const pages = Math.max(1, Math.ceil(wiiChannels().length / 12));
      if (key === '+' || key === '=' || key === '−' || key === '-' || key === '_') {
        const next = Math.max(0, Math.min(pages - 1, wiiPage + (key === '+' || key === '=' ? 1 : -1)));
        if (next !== wiiPage) { wiiPage = next; wiiFocus = 0; play('category'); renderWii(); }
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  }, true);

  // =========================== Shared audio engine (task A1, plan §2.3) ===========================
  // One engine for every theme. `window.gAudio.play(kind)` replaces the per-file synth wrappers; it picks the
  // theme's pack recording when one exists and a drawn cue otherwise. Every sound and the menu music go through
  // one master GainNode scaled by the registry's Volume and Mute, so the Settings rows are the only volume
  // authority in the app. Menu music loops from the theme's pack (or a drawn fallback loop), fades in after the
  // first input while the window is focused, and fades out on launch and blur. Everything stops and the context
  // suspends when the window is hidden or unfocused, and nothing is left on a timer.
  //
  // The per-theme maps cover navigate, category/page, confirm, back, error, launch, notify, achievement/trophy,
  // boot and power-off. Helix deliberately keeps the launcher's original interface sounds.
  const gAudio = (() => {
    const THEMES = ['series', 'one', 'x360', 'ps3', 'ps4', 'ps5', 'wii', '3ds'];
    const KINDS = ['navigate', 'category', 'confirm', 'back', 'error', 'launch', 'notify', 'achievement', 'boot', 'powerOff'];
    // The launcher asks for a few names that mean the same sound; map them onto the map's own names.
    const ALIASES = {
      select: 'confirm', cancel: 'back', failure: 'error', start: 'launch', trophy: 'achievement', unlock: 'achievement',
      startup: 'boot', 'power-on': 'boot', 'power-off': 'powerOff', shutdown: 'powerOff',
      pageLeft: 'category', pageRight: 'category', pageleft: 'category', pageright: 'category'
    };
    const SHORT = new Set(['navigate', 'category', 'confirm', 'back']);
    // Each theme has its own synth character, so a machine without packs still sounds like that console: the
    // Series' airy sine ticks, the One's woody triangles, the 360's bright pluck, the XMB's glassy bells, and so on.
    const PROFILES = {
      series: { type: 'sine', nav: [1760, 1500], cat: [1320, 1175], ok: [988, 1480], back: [1175, 740], err: [392, 262], launch: [523, 784, 1046], notify: [987, 1318, 1975], trophy: [1046, 1318, 1568, 2093], boot: [110, 220, 330, 440], off: [740, 494, 330], gain: .03, filter: 0 },
      one: { type: 'triangle', nav: [660, 600], cat: [523, 494], ok: [784, 1046], back: [523, 392], err: [392, 294], launch: [392, 784], notify: [392, 1046], trophy: [659, 880, 1046], boot: [98, 196, 294, 392], off: [587, 392, 262], gain: .045, filter: 2400 },
      x360: { type: 'triangle', nav: [880, 830], cat: [740, 660], ok: [988, 1319], back: [659, 523], err: [330, 247], launch: [587, 880, 1175], notify: [659, 988, 1319], trophy: [784, 1046, 1319, 1568], boot: [123, 246, 370, 494], off: [659, 494, 330], gain: .04, filter: 3200 },
      ps3: { type: 'sine', nav: [1320, 1180], cat: [880, 784], ok: [660, 990], back: [520, 390], err: [440, 294], launch: [440, 880], notify: [1175, 1568], trophy: [1046, 1318, 1760], boot: [130, 196, 261, 392], off: [523, 392, 261], gain: .03, filter: 0 },
      ps4: { type: 'sine', nav: [1760, 1580], cat: [1320, 1175], ok: [1047, 1568], back: [784, 587], err: [523, 349], launch: [523, 1047], notify: [1319, 1760], trophy: [1047, 1319, 1760], boot: [131, 196, 262, 392], off: [660, 440, 262], gain: .035, filter: 0 },
      // PS5: the same glassy family, tighter and a little higher — short ticks, a clean rising confirm, and a
      // boot chord built on a low pedal that rises through the mark.
      ps5: { type: 'sine', nav: [1760, 1660], cat: [1480, 1320], ok: [1174.7, 1760], back: [880, 659.3], err: [523.25, 349.23], launch: [587.33, 880, 1174.7], notify: [1318.5, 1760, 2217.5], trophy: [1046.5, 1318.5, 1760, 2093], boot: [110, 164.81, 220, 329.63], off: [987.77, 659.25, 440], gain: .028, filter: 0 },
      wii: { type: 'triangle', nav: [1568, 1480], cat: [1175, 1046], ok: [988, 1319], back: [784, 523], err: [523, 392], launch: [523, 1047], notify: [1319, 1760], trophy: [988, 1319, 1568], boot: [262, 392, 523, 659], off: [784, 523, 349], gain: .04, filter: 0 },
      '3ds': { type: 'square', nav: [2093, 1975], cat: [1568, 1400], ok: [1319, 1760], back: [1047, 784], err: [880, 659], launch: [784, 1568], notify: [1760, 2349], trophy: [1568, 2093, 2637], boot: [523, 784, 1047, 1319], off: [1047, 784, 523], gain: .012, filter: 0 }
    };
    // Drawn menu loops for themes whose pack has no music (Series, One, 360, 3DS; PS3/PS4/Wii use their packs).
    // The pad is built from partials that complete a whole number of cycles in the loop, and the arpeggio notes
    // are enveloped to silence before the loop point, so the 8-second buffer loops without a click.
    const FALLBACK_MUSIC = {
      series: { root: 110, chord: [1, 1.5, 2, 2.5], notes: [220, 330, 440, 330] },
      one: { root: 98, chord: [1, 1.2, 1.5, 2], notes: [196, 247, 294, 247] },
      x360: { root: 131, chord: [1, 1.25, 1.5, 2], notes: [262, 330, 392, 523] },
      ps3: { root: 130.81, chord: [1, 1.5, 2, 3], notes: [261.63, 392, 523.25, 392] },
      ps4: { root: 87.31, chord: [1, 1.5, 2, 2.5], notes: [174.61, 220, 261.63, 220] },
      // PS5: a slow, airy pad with a soft fifth; the loop is deliberately quieter than the consoles' themes.
      ps5: { root: 98, chord: [1, 1.5, 2, 3], notes: [196, 293.66, 392, 293.66] },
      wii: { root: 130.81, chord: [1, 1.25, 1.5, 2], notes: [261.63, 329.63, 392, 329.63] },
      '3ds': { root: 130.81, chord: [1, 1.5, 2, 2.5], notes: [523.25, 659.25, 783.99, 659.25] }
    };
    const MUSIC_TRIM = .35;
    let ctx = null, master = null, musicGain = null, gameGain = null;
    let volume = 0, muted = true, musicEnabled = true, musicVolume = 60, gameAudioEnabled = false;
    let settingsLoaded = false, hadInput = false, outputSilenced = false;
    let musicPlaying = false, musicId = '', musicSource = null, musicStartedAt = 0, musicResume = null, startPromise = null;
    let launchDucked = false, suspendTimer = 0;
    let lastAt = -Infinity, lastKind = '';
    const voices = new Set();
    const buffers = new Map();
    const musicBuffers = new Map();
    let themePackData = null, themePackPromise = null;
    let gameVideo = null, gameHls = null, gameElementSource = null, gameGainConnected = false, gameAudioToken = 0;
    const gameState = { playing: false, attempts: 0, reason: 'idle', gameId: '', stream: '' };

    function ensureContext() {
      if (ctx) return ctx;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(master);
      return ctx;
    }
    // The one place output level is decided. Silence until the registry has been read, so a slow or missing
    // settings file can never make the launcher louder than the player's own Volume/Mute values.
    function intendedMaster() { return muted ? 0 : Math.max(0, Math.min(100, Number(volume) || 0)) / 100; }
    function masterTarget() { return outputSilenced ? 0 : intendedMaster(); }
    function applyMaster() {
      if (!master) return;
      // Set the intrinsic value as well as the timeline: an AudioParam only advances while the context renders,
      // and the launcher is often suspended (hidden or unfocused) when Settings changes, so the node itself has
      // to carry the new level. Volume and mute must be correct the moment they are changed.
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.value = masterTarget();
    }
    function musicTarget() { return MUSIC_TRIM * Math.max(0, Math.min(100, Number(musicVolume) || 0)) / 100; }
    function rampMusic(target, seconds) {
      if (!musicGain) return;
      const now = ctx.currentTime;
      musicGain.gain.cancelScheduledValues(now);
      musicGain.gain.setValueAtTime(musicGain.gain.value, now);
      musicGain.gain.linearRampToValueAtTime(Math.max(.0001, target), now + seconds);
    }
    async function readOutputSettings() {
      try {
        if (window.gSettings) {
          const [v, m, mm, mmv, ga] = await Promise.all([
            window.gSettings.get('volume').catch(() => null), window.gSettings.get('mute').catch(() => null),
            window.gSettings.get('menuMusic').catch(() => null), window.gSettings.get('menuMusicVolume').catch(() => null),
            window.gSettings.get('ps3GameAudio').catch(() => null)
          ]);
          volume = v == null ? 100 : Math.max(0, Math.min(100, Number(v)));
          muted = Boolean(m);
          musicEnabled = mm !== false;
          musicVolume = mmv == null ? 60 : Math.max(0, Math.min(100, Number(mmv)));
          gameAudioEnabled = Boolean(ga);
        } else { volume = 100; muted = false; }
      } catch { volume = 100; muted = false; }
      settingsLoaded = true;
      applyMaster(true);
      if (!musicPlaying) {
        const now = ctx.currentTime;
        musicGain?.gain.cancelScheduledValues(now);
        if (musicGain) musicGain.gain.value = 0;
      }
      if (hadInput && musicEnabled && !musicPlaying) startMusic();
    }
    // ---------- Voices and synthesised cues ----------
    function register(source, nodes, kind) {
      const voice = { source, nodes, kind, at: performance.now() };
      voices.add(voice);
      source.onended = () => {
        voices.delete(voice);
        for (const node of nodes) { try { node.disconnect(); } catch { /* Already gone. */ } }
      };
      return voice;
    }
    function tone(c, { type = 'sine', freq = 660, to = freq, at = 0, dur = .08, gain = .03, attack = .004, filter = 0, q = .7 }, kind) {
      const start = c.currentTime + at;
      const osc = c.createOscillator(), amp = c.createGain();
      const nodes = [amp];
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), start);
      if (to && to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
      amp.gain.setValueAtTime(.0001, start);
      amp.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), start + attack);
      amp.gain.exponentialRampToValueAtTime(.0001, start + dur);
      let tail = osc.connect(amp);
      if (filter) {
        const lowpass = c.createBiquadFilter();
        lowpass.type = 'lowpass'; lowpass.frequency.value = filter; lowpass.Q.value = q;
        tail.connect(lowpass); nodes.push(lowpass); tail = lowpass;
      }
      tail.connect(master);
      register(osc, nodes, kind);
      osc.start(start);
      osc.stop(start + dur + .03);
    }
    function noise(c, { at = 0, dur = .2, gain = .02, from = 800, to = 2400, kind = 'bandpass', q = 1.2 }, voiceKind) {
      const start = c.currentTime + at;
      const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = c.createBufferSource(), band = c.createBiquadFilter(), amp = c.createGain();
      source.buffer = buffer;
      band.type = kind; band.Q.value = q;
      band.frequency.setValueAtTime(from, start);
      band.frequency.exponentialRampToValueAtTime(to, start + dur);
      amp.gain.setValueAtTime(.0001, start);
      amp.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), start + dur * .35);
      amp.gain.exponentialRampToValueAtTime(.0001, start + dur);
      source.connect(band).connect(amp).connect(master);
      register(source, [band, amp], voiceKind);
      source.start(start);
      source.stop(start + dur + .02);
    }
    const note = (notes, index, fallback = 660) => Math.max(20, Number(notes?.[index] ?? notes?.[0] ?? fallback));
    function synthCue(kind, profile) {
      return c => {
        const gain = profile.gain;
        switch (kind) {
          case 'navigate':
            tone(c, { type: profile.type, freq: note(profile.nav, 0), to: note(profile.nav, 1), dur: .05, gain, filter: profile.filter }, kind);
            tone(c, { type: profile.type, freq: note(profile.nav, 0) * 2, dur: .035, gain: gain * .3, filter: profile.filter }, kind);
            break;
          case 'category':
            noise(c, { dur: .12, gain: gain * .35, from: 900, to: 2600 }, kind);
            tone(c, { type: profile.type, freq: note(profile.cat, 0), to: note(profile.cat, 1), dur: .09, gain: gain * .8, filter: profile.filter }, kind);
            break;
          case 'confirm':
            tone(c, { type: profile.type, freq: note(profile.ok, 0), dur: .12, gain, filter: profile.filter }, kind);
            tone(c, { type: profile.type, freq: note(profile.ok, 1), at: .05, dur: .16, gain: gain * .8, filter: profile.filter }, kind);
            break;
          case 'back':
            tone(c, { type: profile.type, freq: note(profile.back, 0), to: note(profile.back, 1), dur: .12, gain, filter: profile.filter }, kind);
            break;
          case 'error':
            tone(c, { type: 'triangle', freq: note(profile.err, 0), to: note(profile.err, 1), dur: .22, gain: gain * .9, filter: profile.filter }, kind);
            tone(c, { type: 'square', freq: note(profile.err, 1) * .5, dur: .28, gain: gain * .35 }, kind);
            break;
          case 'launch':
            noise(c, { dur: .7, gain: gain * 1.4, from: 400, to: 5200 }, kind);
            profile.launch.forEach((freq, index) => tone(c, { type: profile.type, freq, at: .12 + index * .06, dur: .9, gain: gain * .55, attack: .08, filter: profile.filter }, kind));
            break;
          case 'notify':
            profile.notify.forEach((freq, index) => tone(c, { type: profile.type, freq, at: index * .07, dur: .55 - index * .1, gain: gain * .8, attack: .01, filter: profile.filter }, kind));
            noise(c, { at: .05, dur: .45, gain: gain * .3, from: 6000, to: 12000, kind: 'highpass' }, kind);
            break;
          case 'achievement':
            profile.trophy.forEach((freq, index) => tone(c, { type: profile.type, freq, at: index * .09, dur: .65, gain: gain * .7, attack: .01, filter: profile.filter }, kind));
            tone(c, { type: 'sine', freq: note(profile.trophy, 1) * 2, at: .35, dur: .8, gain: gain * .25, attack: .05 }, kind);
            break;
          case 'boot':
            tone(c, { type: 'sine', freq: 55, to: 82, dur: 1.5, gain: .06, attack: .25, filter: 400 }, kind);
            profile.boot.forEach((freq, index) => tone(c, { type: profile.type, freq, at: .25 + index * .09, dur: 1.4, gain: gain * .5, attack: .2, filter: profile.filter }, kind));
            noise(c, { at: .2, dur: 1.1, gain: .018, from: 2000, to: 9000, kind: 'highpass' }, kind);
            break;
          case 'powerOff':
            profile.off.forEach((freq, index) => tone(c, { type: profile.type, freq, at: index * .11, dur: .5, gain: gain * (1 - index * .2), filter: profile.filter }, kind));
            tone(c, { type: 'sine', freq: 55, to: 36, at: .1, dur: .9, gain: .03, attack: .02 }, kind);
            break;
          default: break;
        }
      };
    }
    // ---------- Pack recordings ----------
    function themePack() {
      themePackPromise ||= Promise.resolve(window.launcher?.getThemePack?.()).catch(() => null).then(data => { themePackData = data || null; return themePackData; });
      return themePackPromise;
    }
    function packHas(id, kind) {
      if (id === 'x360') return Boolean(themePackData?.sounds?.includes(kind));
      return Boolean(pack.available?.[id] && pack.sounds?.[id]?.includes(kind) && window.launcher?.getRetroSound);
    }
    function packSound(id, kind) {
      const key = `${id}:${kind}`;
      if (!buffers.has(key)) {
        buffers.set(key, null);
        const request = id === 'x360'
          ? window.launcher?.getThemePackSound?.(kind)
          : window.launcher?.getRetroSound?.(id, kind);
        Promise.resolve(request).then(async sound => {
          if (!sound?.base64) return;
          const bytes = Uint8Array.from(atob(sound.base64), character => character.charCodeAt(0));
          buffers.set(key, await ensureContext().decodeAudioData(bytes.buffer));
        }).catch(() => {});
      }
      return buffers.get(key);
    }
    function playBuffer(c, buffer, kind) {
      const source = c.createBufferSource(), amp = c.createGain();
      amp.gain.value = .55;
      source.buffer = buffer;
      source.connect(amp).connect(master);
      register(source, [amp], kind);
      source.start();
    }
    // ---------- Menu music ----------
    function buildFallbackMusic(id) {
      const c = ensureContext();
      const seconds = 8, rate = c.sampleRate, length = Math.round(rate * seconds);
      const config = FALLBACK_MUSIC[id] || FALLBACK_MUSIC.series;
      const data = new Float32Array(length);
      // Snap every partial to a whole number of cycles across the loop, so the pad is periodic and gapless.
      const snapped = frequency => Math.max(1, Math.round(frequency * seconds)) / seconds;
      const partials = config.chord.map((ratio, index) => ({ frequency: snapped(config.root * ratio), amp: .06 / (1 + index * .65) }));
      for (let i = 0; i < length; i++) {
        const t = i / rate;
        let value = 0;
        for (const partial of partials) value += Math.sin(2 * Math.PI * partial.frequency * t) * partial.amp;
        data[i] = value * (.78 + .22 * Math.sin(2 * Math.PI * (1 / seconds) * t));
      }
      // One soft note a second, silent before the loop point, so the drawn loop has a pulse without a seam.
      const noteLength = .9;
      for (let second = 0; second < seconds; second++) {
        const frequency = config.notes[second % config.notes.length];
        const from = Math.round(second * rate), to = Math.min(length, Math.round((second + noteLength) * rate));
        for (let i = from; i < to; i++) {
          const t = (i - from) / rate;
          const envelope = Math.min(1, t / .08) * Math.exp(-2.4 * t) * Math.min(1, Math.max(0, (noteLength - t) / .15));
          data[i] += Math.sin(2 * Math.PI * frequency * t) * .05 * envelope;
        }
      }
      // A 12 ms fade at each end makes the loop point a breath rather than a click.
      const fade = Math.round(rate * .012);
      for (let i = 0; i < fade; i++) { data[i] *= i / fade; data[length - 1 - i] *= i / fade; }
      const buffer = c.createBuffer(2, length, rate);
      for (let channel = 0; channel < 2; channel++) buffer.getChannelData(channel).set(data);
      return buffer;
    }
    async function loadMusicBuffer(id) {
      if (!musicBuffers.has(id)) {
        musicBuffers.set(id, (async () => {
          try {
            if (packReadyPromise) await packReadyPromise.catch(() => {});
            let sound = null;
            if (pack.available?.[id] && pack.music?.[id] && window.launcher?.getRetroSound) sound = await window.launcher.getRetroSound(id, 'music');
            else if (id === 'x360' && window.launcher?.getThemePackSound) {
              const data = await themePack();
              if (data?.music) sound = await window.launcher.getThemePackSound('music');
            }
            if (sound?.base64) {
              const bytes = Uint8Array.from(atob(sound.base64), character => character.charCodeAt(0));
              return await ensureContext().decodeAudioData(bytes.buffer);
            }
          } catch { /* A pack track that won't decode falls back to the drawn loop. */ }
          // PS5's optional drop-in slot: %APPDATA%\xbox-preview-ui\theme-packs\ps5\music\menu.*. The main-process
          // pack lists cannot know this folder without a main.cjs entry, so the renderer reads it itself. It is
          // optional: a missing file costs one failed request and the drawn loop below plays instead.
          if (id === 'ps5' && pack.base) {
            try {
              const base = pack.base;
              for (const name of ['menu.mp3', 'menu.ogg', 'menu.wav']) {
                let response;
                try { response = await fetch(`${base}ps5/music/${name}`); } catch { continue; }
                if (!response.ok) continue;
                const bytes = new Uint8Array(await response.arrayBuffer());
                if (!bytes.length) continue;
                return await ensureContext().decodeAudioData(bytes.buffer);
              }
            } catch { /* No optional track. */ }
          }
          return buildFallbackMusic(id);
        })());
      }
      return musicBuffers.get(id);
    }
    async function startMusic() {
      if (!settingsLoaded || !musicEnabled || !(musicVolume > 0)) return false;
      if (!hadInput || document.hidden || !document.hasFocus() || launchDucked) return false;
      if (musicPlaying && musicId === theme()) return true;
      if (startPromise) return startPromise;
      startPromise = (async () => {
        try {
          const id = theme();
          if (!THEMES.includes(id)) return false;
          const c = ensureContext();
          // Never await resume(): a context waiting for a user gesture would otherwise hold the whole start
          // promise open. The source starts on a suspended context and plays the moment it resumes.
          if (c.state === 'suspended') c.resume().catch(() => {});
          const buffer = await loadMusicBuffer(id);
          if (!buffer || !musicEnabled || !(musicVolume > 0) || !hadInput || document.hidden || !document.hasFocus() || launchDucked || theme() !== id) return false;
          stopMusic(0);
          musicId = id;
          const source = c.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(musicGain);
          const offset = musicResume?.id === id ? musicResume.offset % buffer.duration : 0;
          musicResume = null;
          source.start(0, offset);
          musicSource = source;
          musicPlaying = true;
          musicStartedAt = c.currentTime - offset;
          source.onended = () => {
            if (musicSource === source) { musicSource = null; musicPlaying = false; }
            try { source.disconnect(); } catch { /* Already disconnected. */ }
          };
          musicGain.gain.cancelScheduledValues(c.currentTime);
          musicGain.gain.setValueAtTime(.0001, c.currentTime);
          musicGain.gain.linearRampToValueAtTime(Math.max(.0001, musicTarget()), c.currentTime + 1.1);
          return true;
        } catch { return false; } finally { startPromise = null; }
      })();
      return startPromise;
    }
    function stopMusic(fade = .18) {
      if (ctx && musicSource) {
        const source = musicSource;
        const duration = source.buffer?.duration || 0;
        if (duration && musicStartedAt) musicResume = { id: musicId, offset: Math.max(0, (ctx.currentTime - musicStartedAt) % duration) };
        musicSource = null;
        const now = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(now);
        musicGain.gain.setValueAtTime(Math.max(.0001, musicGain.gain.value), now);
        musicGain.gain.linearRampToValueAtTime(0, now + fade);
        try { source.stop(now + fade + .02); } catch { try { source.stop(); } catch { /* Already stopped. */ } }
      }
      musicPlaying = false;
      musicStartedAt = 0;
    }
    // ---------- Lifecycle: nothing runs while hidden or unfocused ----------
    function stopVoices(selector) {
      for (const voice of [...voices]) {
        if (selector && !selector(voice)) continue;
        try { voice.source.stop(0); } catch { /* Already stopped. */ }
        for (const node of voice.nodes) { try { node.disconnect(); } catch { /* Already gone. */ } }
        voices.delete(voice);
      }
    }
    function sleepAudio() {
      stopGameAudio();
      stopVoices();
      stopMusic(.12);
      clearTimeout(suspendTimer);
      // Let the music fade finish, then park the context: zero CPU while the launcher is in the background.
      suspendTimer = setTimeout(() => { if (ctx?.state === 'running') ctx.suspend().catch(() => {}); }, 160);
    }
    function wakeAudio() {
      clearTimeout(suspendTimer);
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (launchDucked && document.querySelector('#launch-overlay')?.hidden) launchDucked = false;
      if (hadInput) startMusic();
      prefetch();
    }
    function noteInput() {
      hadInput = true;
      if (launchDucked && document.querySelector('#launch-overlay')?.hidden) launchDucked = false;
      if (ctx?.state === 'suspended' && !document.hidden && document.hasFocus()) ctx.resume().catch(() => {});
      if (!musicPlaying) startMusic();
    }
    function themeChanged() {
      stopGameAudio();
      if (!THEMES.includes(theme())) { stopMusic(0); return; }
      if (musicPlaying && musicId !== theme()) stopMusic(.15);
      if (hadInput) startMusic();
      prefetch();
    }
    function prefetch() {
      const id = theme();
      if (!THEMES.includes(id) || document.hidden || !document.hasFocus()) return;
      const kinds = id === 'x360' ? themePackData?.sounds : pack.sounds?.[id];
      for (const kind of kinds || []) packSound(id, kind);
    }
    // ---------- PS3 SND0: the selected game's trailer audio, quietly, no video ----------
    function gameAudioState() { return { ...gameState, enabled: gameAudioEnabled }; }
    function stopGameAudio() {
      gameAudioToken++;
      if (gameHls) { try { gameHls.destroy(); } catch { /* Already gone. */ } gameHls = null; }
      if (gameVideo) { try { gameVideo.pause(); } catch { /* Optional. */ } try { gameVideo.removeAttribute('src'); gameVideo.load(); } catch { /* Optional. */ } try { gameVideo.remove(); } catch { /* Optional. */ } gameVideo = null; }
      if (gameElementSource) { try { gameElementSource.disconnect(); } catch { /* Optional. */ } gameElementSource = null; }
      gameState.playing = false;
      gameState.gameId = '';
      gameState.stream = '';
      if (!gameAudioEnabled && gameState.reason === 'playing') gameState.reason = 'disabled';
    }
    async function startGameAudio(game) {
      gameState.attempts++;
      if (!gameAudioEnabled) { gameState.reason = 'disabled'; return false; }
      if (theme() !== 'ps3') { gameState.reason = 'not-ps3'; return false; }
      if (!game || document.hidden || !document.hasFocus()) { gameState.reason = 'unfocused'; return false; }
      if (gameState.playing && gameState.gameId === game.id) return true;
      stopGameAudio();
      const token = ++gameAudioToken;
      gameState.reason = 'loading';
      let details = null;
      try { details = await window.launcher?.getGameDetails?.(game.id); } catch { /* No details means no trailer. */ }
      if (token !== gameAudioToken) return false;
      const videos = details?.videos || game.videos || [];
      const stream = videos.find(video => video?.stream)?.stream;
      if (!stream) { gameState.reason = 'no-trailer-audio'; return false; }
      if (typeof Hls === 'undefined' || !Hls.isSupported()) { gameState.reason = 'no-hls'; return false; }
      const c = ensureContext();
      gameGain ||= c.createGain();
      gameGain.gain.value = .3;
      if (!gameGainConnected) { gameGain.connect(master); gameGainConnected = true; }
      gameVideo = document.createElement('video');
      gameVideo.muted = false;
      gameVideo.volume = 1;
      gameVideo.playsInline = true;
      gameVideo.setAttribute('aria-hidden', 'true');
      gameVideo.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      document.body.append(gameVideo);
      try { gameElementSource = c.createMediaElementSource(gameVideo); gameElementSource.connect(gameGain); }
      catch { gameState.reason = 'no-audio-route'; stopGameAudio(); return false; }
      gameHls = new Hls({ enableWorker: false, capLevelToPlayerSize: false });
      gameHls.on(Hls.Events.ERROR, (_event, data) => { if (data.fatal) { gameState.reason = 'stream-error'; stopGameAudio(); } });
      gameHls.loadSource(stream);
      gameHls.attachMedia(gameVideo);
      gameVideo.addEventListener('playing', () => { gameState.playing = true; gameState.reason = 'playing'; gameState.gameId = game.id; gameState.stream = stream; }, { once: true });
      gameHls.on(Hls.Events.MANIFEST_PARSED, () => { gameVideo.play().catch(() => { gameState.reason = 'blocked'; }); });
      return true;
    }
    // ---------- Wiring ----------
    window.addEventListener('pointerdown', noteInput, true);
    window.addEventListener('keydown', noteInput, true);
    window.addEventListener('blur', sleepAudio);
    window.addEventListener('focus', wakeAudio);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || document.visibilityState === 'hidden') sleepAudio();
      else if (document.hasFocus()) wakeAudio();
    });
    document.addEventListener('g-setting-change', event => {
      const id = event.detail?.id, value = event.detail?.value;
      if (id === 'volume') { volume = value == null ? 100 : Math.max(0, Math.min(100, Number(value))); applyMaster(); }
      else if (id === 'mute') { muted = Boolean(value); applyMaster(); }
      else if (id === 'menuMusic') { musicEnabled = Boolean(value); if (!musicEnabled) stopMusic(); else if (hadInput) startMusic(); }
      else if (id === 'menuMusicVolume') {
        musicVolume = Math.max(0, Math.min(100, Number(value) || 0));
        if (!(musicVolume > 0)) stopMusic();
        else if (musicPlaying) rampMusic(musicTarget(), .15);
        else if (hadInput) startMusic();
      } else if (id === 'ps3GameAudio') { gameAudioEnabled = Boolean(value); if (!gameAudioEnabled) stopGameAudio(); }
    });
    document.addEventListener('g-settings-ready', () => { readOutputSettings().catch(() => {}); });
    // The console's power-off sound belongs to the one real power confirmation in the app.
    document.addEventListener('click', event => {
      if (event.target.closest?.('[data-action="power-confirm"]')) play('powerOff');
    }, true);
    // Achievements and failures already announce themselves through toasts; give them their own cues.
    if (typeof showToast === 'function') {
      const toastBase = showToast;
      showToast = function (message, ...rest) {
        try {
          const text = String(message || '');
          if (/achievement unlocked|trophy (unlocked|earned)|earned a trophy/i.test(text)) play('achievement');
          else if (/^(could not|couldn.t|unable to|cannot|can't|failed)/i.test(text)) play('error');
        } catch { /* Sound is optional. */ }
        return toastBase.call(this, message, ...rest);
      };
    }
    function play(kind = 'navigate') {
      const id = theme();
      if (!THEMES.includes(id)) return false;
      if (typeof interfaceAudio === 'object' && interfaceAudio?.customCount?.() > 0) return false;
      const canonical = ALIASES[kind] || kind;
      if (!KINDS.includes(canonical)) return false;
      if (state.soundEffects === false) return true;
      if (document.hidden || !document.hasFocus()) return true;
      const now = performance.now();
      if (kind === 'navigate' && now - lastAt < (lastKind === 'navigate' ? 55 : 180)) return true;
      if (canonical === lastKind && now - lastAt < 45) return true;
      lastAt = now;
      lastKind = canonical;
      if (canonical === 'launch') { launchDucked = true; stopMusic(.3); stopGameAudio(); }
      if (canonical === 'powerOff') { stopMusic(.4); stopGameAudio(); }
      if (SHORT.has(canonical)) { hadInput = true; if (!musicPlaying) startMusic(); }
      try {
        const c = ensureContext();
        if (c.state === 'suspended') c.resume().catch(() => {});
        if (SHORT.has(canonical)) stopVoices(voice => SHORT.has(voice.kind));
        if (packHas(id, canonical)) {
          const buffer = packSound(id, canonical);
          if (buffer) { playBuffer(c, buffer, canonical); return true; }
          if (buffers.has(`${id}:${canonical}`)) return true;
        }
        synthCue(canonical, PROFILES[id])(c);
        return true;
      } catch { return true; }
    }
    function inspect() {
      return {
        theme: theme(),
        context: ctx ? ctx.state : 'not-created',
        master: master ? Boolean(master) : false,
        masterGain: master ? master.gain.value : null,
        intendedMaster: intendedMaster(),
        silenced: outputSilenced,
        settingsLoaded,
        routing: {
          master: Boolean(master), musicGain: Boolean(musicGain), gameGain: Boolean(gameGain),
          destination: Boolean(master && master.context && master.context.destination),
          destinationInputs: 1,
          edges: ['effects -> master', 'music -> musicGain', 'musicGain -> master', 'game audio -> gameGain', 'gameGain -> master', 'master -> destination']
        },
        effects: { running: voices.size, kinds: [...new Set([...voices].map(voice => voice.kind))] },
        packs: {
          decoded: [...buffers].filter(([, buffer]) => Boolean(buffer)).map(([key]) => key).sort(),
          pending: [...buffers].filter(([, buffer]) => !buffer).map(([key]) => key).sort()
        },
        music: {
          enabled: musicEnabled, volume: musicVolume, playing: musicPlaying, theme: musicId,
          gain: musicGain ? musicGain.gain.value : 0, target: musicTarget(), source: Boolean(musicSource), loop: Boolean(musicSource?.loop),
          duration: musicSource?.buffer?.duration || 0
        },
        gameAudio: gameAudioState(),
        running: voices.size + (musicPlaying ? 1 : 0) + (gameState.playing ? 1 : 0)
      };
    }
    const debug = {
      get context() { return ctx; },
      get master() { return master; },
      get musicGain() { return musicGain; },
      get gameGain() { return gameGain; },
      get voices() { return [...voices]; },
      get gains() { return [master, musicGain, gameGain].filter(Boolean); },
      edges: ['effects -> master', 'music -> musicGain', 'musicGain -> master', 'game audio -> gameGain', 'gameGain -> master', 'master -> destination']
    };
    const ready = (async () => {
      ensureContext();
      await Promise.all([readOutputSettings(), themePack()]);
      applyMaster(true);
      if (document.hidden || !document.hasFocus()) sleepAudio(); else if (hadInput) startMusic();
      prefetch();
      return inspect();
    })();
    const api = {
      play,
      menuMusic: () => ({ enabled: musicEnabled, playing: musicPlaying, volume: musicVolume, theme: musicId, gain: musicGain ? musicGain.gain.value : 0 }),
      gameAudio: gameAudioState,
      gameAudioStart: startGameAudio,
      stopGameAudio,
      startMusic,
      stopMusic,
      themeChanged,
      prefetch,
      ready,
      inspect,
      maps: () => Object.fromEntries(THEMES.map(id => [id, KINDS.slice()])),
      debug,
      // The hidden harness (and a future panic button) can silence the engine without touching the player's
      // settings: the graph keeps running so tests can read node state, but the master gain is pinned to 0.
      setOutputSilenced: value => { outputSilenced = Boolean(value); applyMaster(true); return outputSilenced; }
    };
    return api;
  })();
  window.gAudio = gAudio;
  // The rest of this file (and the other theme files) still call play(kind): every one of those now goes through
  // the shared engine, so no console screen can keep a private oscillator or bypass the master gain.
  const play = kind => gAudio.play(kind);
  // Everything that used to call interfaceAudio now asks the shared engine first. It declines Helix (which keeps
  // the launcher's own sounds) and themes with a player-installed custom sound pack, so those paths still work.
  if (typeof interfaceAudio === 'object' && interfaceAudio) {
    const base = interfaceAudio.play.bind(interfaceAudio);
    interfaceAudio.play = function (kind = 'navigate') { return gAudio.play(kind) ? undefined : base(kind); };
  }

  if (typeof renderRecentGames === 'function') {
    const recentBase = renderRecentGames;
    renderRecentGames = function (...args) { const result = recentBase.apply(this, args); if (on() && state.view === 'home') render(); return result; };
  }
  if (typeof showView === 'function') {
    const viewBase = showView;
    showView = function (next, ...rest) {
      const result = viewBase.call(this, next, ...rest);
      if (next !== 'home') { clearTimeout(gameAudioTimer); window.gAudio?.stopGameAudio?.(); }
      if (next === 'home' && on()) requestAnimationFrame(render);
      return result;
    };
  }
  // The clocks tick over each minute; the 3DS colon blinks in CSS.
  setInterval(() => {
    if (!on() || state.view !== 'home' || document.hidden) return;
    const t = theme();
    if (t === 'ps3') { const el = chrome.querySelector('.xmb-time'); if (el) el.textContent = `${dayMonth()} ${time()}`; }
    if (t === 'ps4') { const el = chrome.querySelector('.ps4-s.clock'); if (el) el.textContent = time(); }
    if (t === 'wii') { const el = chrome.querySelector('.wii-clock'); if (el) el.innerHTML = segClock(); }
    if (t === '3ds') {
      const el = host.querySelector('.ds-clock'); if (el) el.innerHTML = esc(time()).replace(':', '<b>:</b>');
      const when = host.querySelector('.ds-when'); if (when) when.textContent = `${dayMonth()} (${weekday()})`;
      const setWhen = host.querySelector('.ds-set-when'); if (setWhen) setWhen.textContent = `${dayMonth()} ${time()}`;
    }
  }, 15000);
  new MutationObserver(() => { wiiPreview = null; ps4Area = 'row'; dsTool = -1; wiiBar = -1; syncDsOptionsPoll(); gAudio.themeChanged(); render(); }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  window.gRetro = { render, play: kind => gAudio.play(kind), pack: () => pack };
  render();
  packReadyPromise = loadPack();
})();
