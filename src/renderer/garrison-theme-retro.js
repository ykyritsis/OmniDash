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
  const time = () => now().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayMonth = () => now().toLocaleDateString([], { day: 'numeric', month: 'numeric' });
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
  const gameItem = game => ({ label: game.title, sub: game.installed === false ? 'Not installed' : game.provider === 'PC' ? '' : game.provider, action: 'select-game', data: { 'game-id': game.id }, game, boot: true });
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
  // Measured from a 1080p XMB: categories on a row 285px down with the selected column at x 559 and 205px
  // apart; items above the selection stack up over the row, the selection sits at 479, the rest from 675.
  const MONTH = ['#a7adb5', '#c9a227', '#6c9d2f', '#d780a9', '#3e8e41', '#8d4fb3', '#2a9d97', '#3d8fd6', '#2f62c9', '#7a43b8', '#9a6230', '#b8302d'];
  let xmbCat = 6, xmbItem = {};
  const xmbCategories = () => {
    const friends = (state.gFriends?.friends || []).filter(f => f.state !== 'offline' && f.state !== 'unknown');
    const list = allGames().slice(0, 60);
    return [
      { id: 'users', label: 'Users', file: 'users', glyph: 'contact', items: [{ label: name(), sub: 'Signed in', action: 'g-account', file: 'current-user', glyph: 'contact' }, { label: 'Turn Off System', action: 'power-menu', file: 'power', glyph: 'power' }] },
      { id: 'settings', label: 'Settings', file: 'settings', glyph: 'settings', items: [
        { label: 'System Update', action: 'g-update-check', file: 'system-update', glyph: 'refresh' }, settingsItem('Game Settings', 'services', 'game-settings', 'game'),
        settingsItem('Display Settings', 'accessibility', 'display-settings', 'tv'), settingsItem('Sound Settings', 'audio', 'sound-settings', 'volume'),
        settingsItem('Theme Settings', 'personalization', 'theme-settings', 'color'), settingsItem('Date and Time Settings', 'g-language', 'time-settings', 'clock'),
        settingsItem('System Settings', 'g-storage', 'system-settings', 'settings'), settingsItem('Accessory Settings', 'g-input', 'acc-settings', 'controller'),
        settingsItem('Network Settings', 'g-streaming', 'network-settings', 'globe'), settingsItem('Security Settings', 'g-privacy', 'privacy-settings', 'lock'),
        settingsItem('Notification Settings', 'g-notifications', 'chat-settings', 'bell')] },
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
  function renderXmb() {
    const cats = xmbCategories();
    xmbCat = Math.max(0, Math.min(xmbCat, cats.length - 1));
    const cat = cats[xmbCat], items = cat.items;
    if (xmbItem[cat.id] == null) xmbItem[cat.id] = Math.min(cat.start || 0, items.length - 1);
    const sel = xmbItem[cat.id] = Math.max(0, Math.min(xmbItem[cat.id], items.length - 1));
    document.body.style.setProperty('--xmb-tint', MONTH[now().getMonth()]);
    const hour = now().getHours();
    document.body.style.setProperty('--xmb-night', String(hour >= 21 || hour < 5 ? .42 : hour >= 18 || hour < 7 ? .22 : 0));
    // Vertical positions: the selection, the items under it, and the ones above that climb over the row.
    const step = 94;
    let below = 604;
    const pos = items.map((item, index) => {
      if (index === sel) return 468;
      if (index > sel) { const y = below; below += step; return y; }
      return 124 - (sel - 1 - index) * 82;
    });
    host.innerHTML = `<i class="xmb-pic" aria-hidden="true"></i><canvas class="xmb-wave" aria-hidden="true"></canvas>
      <div class="xmb-bar">${cats.map((c, i) => `<span class="xmb-cat${i === xmbCat ? ' on' : ''}" style="--x:${560 + (i - xmbCat) * 210}">${img(PS3I(c.file), icon(c.glyph))}<b>${esc(c.label)}</b></span>`).join('')}</div>
      <div class="xmb-list">${items.map((item, index) => `<button class="xmb-item focusable${index === sel ? ' on' : index < sel ? ' above' : ''}${item.game ? ' is-game' : ''}" type="button" ${attrs(item)} data-xmb-index="${index}" style="--y:${pos[index]}" aria-label="${esc(item.label)}">
        ${xmbIcon(item, index === sel)}<span class="xmb-copy"><strong>${esc(item.label)}</strong>${item.sub ? `<small>${esc(item.sub)}</small>` : ''}</span></button>`).join('')}</div>`;
    chrome.innerHTML = `<div class="xmb-clock"><span class="xmb-me"><i></i>${esc(name())}</span><span class="xmb-time">${esc(dayMonth())} ${esc(time())}</span><i class="xmb-dial"></i></div>`;
    focusEl(host.querySelector('.xmb-item.on'));
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
    }), 900);
  }
  function xmbMove(direction) {
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
    renderXmb();
  }
  // The wave: translucent ribbons with a bright crest and drifting sparkles, drawn at 30fps on half-size
  // canvas. The crest glow is a wide faint stroke under a thin bright one rather than a canvas shadow, which
  // costs a fraction of the time on integrated graphics. It stops whenever the window is hidden or unfocused,
  // or the XMB isn't showing.
  const xmbWave = (() => {
    let raf = 0, last = 0, t = 0;
    const sparks = Array.from({ length: 54 }, () => ({ x: Math.random(), y: .28 + Math.random() * .55, s: .4 + Math.random() * 1.5, p: Math.random() * 6.28, v: .003 + Math.random() * .009 }));
    // base height, amplitude, wavelength, drift, opacity, band thickness, slope (all fractions of the canvas)
    const ribbons = [[.515, .02, 1.1, .0003, .3, .2, -.05], [.6, .013, 1.65, .00042, .14, .14, -.08], [.66, .01, .92, .00025, .085, .11, -.115]];
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
        const bright = Math.min(.95, alpha * 2.6);
        g.lineCap = 'round';
        g.strokeStyle = `rgba(255,255,255,${bright * .18})`; g.lineWidth = 7; g.stroke(crest);
        g.strokeStyle = `rgba(255,255,255,${bright * .34})`; g.lineWidth = 3; g.stroke(crest);
        g.strokeStyle = `rgba(255,255,255,${bright})`; g.lineWidth = 1.4; g.stroke(crest);
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

  // =========================== PS4: the home screen ===========================
  // Measured from the 2013 home: status bar at y 99, tiles 220px from y 222 with the selected tile 356px
  // (Start bar under it) from x 330, the game name and content cards below, a dark hint bar from y 940.
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
  function renderPs4() {
    const list = ps4List();
    ps4Focus = Math.max(0, Math.min(ps4Focus, list.length - 1));
    const sel = list[ps4Focus];
    const tile = (item, i) => `<button class="ps4-tile focusable${item.system ? ' system' : ''}${item.store ? ' store' : ''}${item.glass ? ' glass' : ''}${item.library ? ' library' : ''}${i === ps4Focus ? ' sel' : ''}" type="button" ${attrs(item)} data-ps4-index="${i}" aria-label="${esc(item.label)}"
      style="--x:${i === ps4Focus ? 337 : i < ps4Focus ? 337 - (ps4Focus - i) * 260 : 730 + (i - ps4Focus - 1) * 260}${item.game ? `;--cover:${url(cover(item.game))}` : ''}">${item.game ? '' : item.store ? img(PS4I('ps'), icon('shop'), 'bag') : item.glass ? PS4_SHAPES : item.library ? '<span class="ps4-lib" aria-hidden="true"><i></i><i></i><i></i></span>' : icon(item.glyph)}${i === ps4Focus ? '<em>Start</em>' : ''}</button>`;
    host.innerHTML = `<i class="ps4-art" aria-hidden="true"></i>
      <div class="ps4-functions${ps4Area === 'fn' ? ' open' : ''}" aria-label="Function area">${PS4_FUNCTIONS.map(([action, glyph, label, file], i) => `<button class="ps4-fn focusable${ps4Area === 'fn' && i === ps4Fn ? ' sel' : ''}" type="button" data-action="${action}" data-ps4-fn="${i}" aria-label="${label}">${img(PS4I(file), icon(glyph))}<span>${label}</span></button>`).join('')}</div>
      <div class="ps4-home${ps4Area === 'fn' ? ' away' : ''}"><div class="ps4-row" role="list">${list.map(tile).join('')}</div>
      <div class="ps4-under"><div class="ps4-menu">${sel.game ? ['Overview', 'Recent Activity', 'Related Items'].map((label, i) => `<button class="ps4-sub focusable${ps4Area === 'sub' && ps4Sub === i ? ' sel' : ''}" type="button" data-action="g-ps4-overview" data-game-id="${esc(sel.game.id)}" data-ps4-sub="${i}">${label}</button>`).join('') : ''}</div>
        <div class="ps4-info"><h2>${esc(sel.label)}</h2><div class="ps4-cards">${sel.game ? `<button class="ps4-card wide focusable${ps4Area === 'sub' && ps4Sub === 3 ? ' sel' : ''}" type="button" data-action="g-ps4-overview" data-game-id="${esc(sel.game.id)}" data-ps4-sub="3" data-g-wide-art="${esc(sel.game.id)}"><b>${esc(sel.game.lastPlayed ? 'Recently played' : 'Overview')}</b><small>${esc(sel.game.title)}</small></button><span class="ps4-ach"></span>` : `<p class="ps4-sub-copy">${esc(sel.sub || '')}</p>`}</div></div></div></div>
      <div class="ps4-hints"><span><i class="ps4-x"></i>Enter</span>${sel.game ? '<span><i class="ps4-opt">OPTIONS</i></span>' : ''}</div>`;
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
  function ps4Achievements(game) {
    achievements(game).then(items => {
      const slot = host.querySelector('.ps4-ach');
      if (!slot || host.querySelector('.ps4-card.wide')?.dataset.gameId !== game.id) return;
      const pick = [...items].sort((a, b) => (Number(b.unlocked) || 0) - (Number(a.unlocked) || 0) || (a.rarity ?? 100) - (b.rarity ?? 100)).slice(0, 2);
      slot.outerHTML = pick.map((a, i) => `<button class="ps4-card focusable${ps4Area === 'sub' && ps4Sub === 4 + i ? ' sel' : ''}" type="button" data-action="g-ps4-overview" data-game-id="${esc(game.id)}" data-ps4-sub="${4 + i}" style="--ach:${url(a.unlocked ? a.icon : a.lockedIcon || a.icon)}"><b>${esc(a.title)}</b><small>${esc(a.unlocked ? 'Trophy earned' : a.description || 'Not yet earned')}</small></button>`).join('');
      try { refreshFocusables(); } catch { /* Not ready. */ }
    });
  }
  function ps4Background(item) {
    const layer = host.querySelector('.ps4-art');
    if (!layer || !item?.game || !window.gWideArt) return;
    window.gWideArt(item.game).then(src => { if (layer.isConnected && src) { layer.style.backgroundImage = cssUrl(src); layer.classList.add('on'); } });
  }
  function ps4Move(direction) {
    const list = ps4List();
    if (ps4Area === 'fn') {
      if (direction === 'down') { ps4Area = 'row'; play('back'); }
      else if (direction === 'left' || direction === 'right') { const next = Math.max(0, Math.min(PS4_FUNCTIONS.length - 1, ps4Fn + (direction === 'right' ? 1 : -1))); if (next === ps4Fn) return; ps4Fn = next; play('navigate'); }
      else return;
    } else if (ps4Area === 'sub') {
      const subs = [...host.querySelectorAll('[data-ps4-sub]')].map(el => Number(el.dataset.ps4Sub));
      if (direction === 'up' && ps4Sub > 0 && ps4Sub < 3) ps4Sub -= 1;
      else if (direction === 'up') { ps4Area = 'row'; }
      else if (direction === 'down' && ps4Sub < 2) ps4Sub += 1;
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
    renderPs4();
  }

  // =========================== Wii: the Wii Menu ===========================
  // Measured from the Wii Menu at 1080p: 4×3 channels of 384×201 from (160, 91), 23px apart; the bottom bar
  // starts at 777 with a dip to 896 under the clock; Wii and mail buttons centred at 900.
  let wiiPage = 0, wiiFocus = 0, wiiPreview = null, wiiBar = -1;
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
    host.innerHTML = `<div class="wii-bands" aria-hidden="true">${[0, 1, 2].map(r => `<span style="--row:${r}"></span>`).join('')}</div>
      <div class="wii-grid">${shown.map((ch, i) => !ch ? `<span class="wii-ch empty" data-wii-index="${i}" aria-hidden="true"></span>` : `<button class="wii-ch focusable ${ch.kind}" type="button" ${attrs(ch)} data-wii-index="${i}" aria-label="${esc(ch.label)}"${ch.kind === 'game' ? ` data-g-wide-art="${esc(ch.game.id)}"` : ''}>${wiiArt(ch)}<span class="wii-balloon">${esc(ch.label)}</span></button>`).join('')}
        ${[0, 1, 2].map(r => `<span class="wii-ch empty peek" style="--r:${r}" aria-hidden="true"></span>`).join('')}</div>
      ${wiiPage > 0 ? '<button class="wii-arrow left focusable" type="button" data-action="g-wii-page" data-dir="-1" aria-label="Previous page"></button>' : ''}${wiiPage < pages - 1 ? '<button class="wii-arrow right focusable" type="button" data-action="g-wii-page" data-dir="1" aria-label="Next page"></button>' : ''}`;
    chrome.innerHTML = `<div class="wii-bar"><span class="wii-glow" aria-hidden="true"></span><svg class="wii-bar-shape" viewBox="0 0 1920 229" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="wii-bar-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdd0d4"/><stop offset=".16" stop-color="#b9bcc0"/><stop offset=".6" stop-color="#cdd0d4"/><stop offset="1" stop-color="#d8dadd"/></linearGradient></defs>
        <path d="M0 0 H500 C 560 0, 590 61, 660 61 H1260 C 1330 61, 1360 0, 1420 0 H1920 V229 H0 Z" fill="url(#wii-bar-fill)"/><path d="M0 0 H500 C 560 0, 590 61, 660 61 H1260 C 1330 61, 1360 0, 1420 0 H1920" fill="none" stroke="#39c1ef" stroke-width="3"/></svg>
      <span class="wii-ring left" aria-hidden="true"></span><span class="wii-ring right" aria-hidden="true"></span>
      <button class="wii-btn focusable${wiiBar === 0 ? ' sel' : ''}" type="button" data-action="settings" aria-label="Wii Options">${img(WIII('wii-button.png'), '<b>Wii</b>')}</button>
      <span class="wii-sd" aria-hidden="true"></span>
      <span class="wii-clock">${segClock()}</span><span class="wii-date">${esc(weekday())} ${esc(dayMonth())}</span>
      <button class="wii-mail focusable${wiiBar === 1 ? ' sel' : ''}" type="button" data-action="g-notifications" aria-label="Wii Message Board">${img(WIII('mail-button.png'), '<i></i>')}</button></div>`;
    const target = wiiBar >= 0 ? chrome.querySelector(wiiBar === 0 ? '.wii-btn' : '.wii-mail') : host.querySelector(`.wii-ch[data-wii-index="${wiiFocus}"].focusable`) || host.querySelector('.wii-ch.focusable');
    focusEl(target);
  }
  // The Wii clock is a seven-segment display.
  const SEGMENTS = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
  const SEG_RECT = { a: [9, 2, 22, 5], b: [32, 8, 5, 26], c: [32, 38, 5, 26], d: [9, 65, 22, 5], e: [3, 38, 5, 26], f: [3, 8, 5, 26], g: [9, 33.5, 22, 5] };
  function segClock() {
    const parts = new Intl.DateTimeFormat([], { hour: 'numeric', minute: '2-digit' }).formatToParts(now());
    const hour = parts.find(p => p.type === 'hour')?.value || '12', minute = parts.find(p => p.type === 'minute')?.value || '00';
    const period = parts.find(p => p.type === 'dayPeriod')?.value || '';
    const digit = (d, x) => [...(SEGMENTS[d] || '')].map(s => { const [rx, ry, w, h] = SEG_RECT[s]; return `<rect x="${x + rx}" y="${ry}" width="${w}" height="${h}" rx="1.5"/>`; }).join('');
    const text = hour.padStart(2, ' ') + minute;
    let x = 0, out = '';
    [...text].forEach((d, i) => { if (i === 2) { out += `<rect x="${x + 4}" y="20" width="5" height="5" rx="1"/><rect x="${x + 4}" y="46" width="5" height="5" rx="1"/>`; x += 16; } if (d !== ' ') out += digit(d, x); x += 46; });
    return `<svg viewBox="0 0 ${x} 72" aria-label="${esc(time())}">${out}</svg>${period ? `<em>${esc(period.toUpperCase())}</em>` : ''}`;
  }
  function renderWiiPreview() {
    const game = findGame(wiiPreview);
    if (!game) { wiiPreview = null; renderWii(); return; }
    const pill = (label, action, extra = '') => `<button class="wii-pbtn focusable" type="button" data-action="${action}"${extra}>${WIII('btn-texture.png') ? `<i class="cap l" style="background-image:${url(WIII('btn-left.png'))}"></i><i class="mid" style="background-image:${url(WIII('btn-texture.png'))}"></i><i class="cap r" style="background-image:${url(WIII('btn-right.png'))}"></i>` : ''}<span>${label}</span></button>`;
    host.innerHTML = `<div class="wii-preview"><div class="wii-banner" data-g-wide-art="${esc(game.id)}"><strong>${esc(game.title)}</strong></div>
      <div class="wii-preview-bar">${pill('Wii Menu', 'g-wii-back')}${pill('Start', 'select-game', ` data-game-id="${esc(game.id)}" data-retro-boot="1" data-start="1"`)}</div></div>`;
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
  // Native 3DS pixels times --k: top screen 400×240, bottom 320×240, stacked to fill the height.
  let dsFocus = 0, dsTool = -1;
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
  function renderDs() {
    const list = dsList();
    dsFocus = Math.max(0, Math.min(dsFocus, list.length - 1));
    const col = Math.floor(dsFocus / 3);
    const scroll = Math.max(0, col - 3);
    const coins = Math.min(300, 10 + allGames().length);
    host.innerHTML = `<i class="ds-bg" aria-hidden="true"></i><div class="ds-device"><div class="ds-top"><div class="ds-pattern" aria-hidden="true"></div>
        <div class="ds-statusbar"><span class="ds-signal" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="ds-pill">Internet</span><span class="ds-coin"><i>P</i>${coins}</span>
          <span class="ds-when">${esc(dayMonth())} (${esc(weekday())})</span><span class="ds-clock">${esc(time()).replace(':', '<b>:</b>')}</span><span class="ds-battery" aria-hidden="true"><i></i></span></div>
        <div class="ds-banner"><i class="ds-art"></i></div>
        <div class="ds-plate"><i class="ds-plate-icon"></i><span><strong></strong><small></small></span></div>
        <div class="ds-foot"><span class="ds-cam"></span><kbd>Y</kbd><span class="ds-gap"></span><span class="ds-cam"></span><kbd>L</kbd>+<kbd>R</kbd></div></div>
      <div class="ds-bottom"><div class="ds-toolbar">${DS_TOOLS.map(([action, label, svg], i) => `<button class="ds-tool focusable${i === 0 ? ' tab' : ''}${dsTool === i ? ' sel' : ''}" type="button" data-action="${action}" data-ds-tool="${i}" aria-label="${label}">${DS_SVG[svg]}</button>`).join('')}<span class="ds-size" aria-hidden="true"><i></i><i class="grid"></i></span></div>
        <div class="ds-field"><div class="ds-grid" style="--scroll:${scroll}">${list.map((item, i) => `<button class="ds-icon focusable${i === dsFocus && dsTool < 0 ? ' sel' : ''}" type="button" ${attrs(item)} data-ds-index="${i}" aria-label="${esc(item.label)}" style="--c:${Math.floor(i / 3)};--r:${i % 3}">
          ${item.game ? `<span class="ds-cover" style="background-image:${url(cover(item.game))}"></span>` : DS_SVG[item.svg] || icon('game')}</button>`).join('')}<span class="ds-cursor" style="--c:${col};--r:${dsFocus % 3}" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div></div>
        <div class="ds-scroll" aria-hidden="true"><i style="--p:${list.length > 18 ? col / Math.max(1, Math.ceil(list.length / 3) - 1) : 0}"></i></div></div></div>`;
    chrome.innerHTML = '';
    dsBanner(list[dsFocus]);
    focusEl(dsTool >= 0 ? host.querySelector(`[data-ds-tool="${dsTool}"]`) : host.querySelector('.ds-icon.sel'));
  }
  function dsBanner(item) {
    const plate = host.querySelector('.ds-plate');
    if (!plate || !item) return;
    plate.querySelector('strong').textContent = item.label;
    plate.querySelector('small').textContent = item.game ? (item.game.developer || item.game.publisher || (item.game.provider === 'PC' ? '' : item.game.provider) || '') : item.sub || '';
    const iconEl = plate.querySelector('.ds-plate-icon');
    iconEl.innerHTML = item.game ? '' : DS_SVG[item.svg] || '';
    iconEl.style.backgroundImage = item.game ? cssUrl(cover(item.game)) : '';
    const art = host.querySelector('.ds-art');
    art.style.backgroundImage = ''; art.innerHTML = '';
    art.parentElement.classList.toggle('system', !item.game);
    // The wallpaper behind the two screens keeps a game's art even while a system app is selected.
    const backdrop = host.querySelector('.ds-bg');
    const backdropGame = item.game || dsList().find(entry => entry.game)?.game || null;
    if (backdrop && backdropGame && !backdrop.style.backgroundImage && window.gWideArt) {
      window.gWideArt(backdropGame).then(src => { if (src && backdrop.isConnected) backdrop.style.backgroundImage = cssUrl(src); }).catch(() => {});
    }
    if (!item.game) { art.innerHTML = DS_SVG[item.svg] || ''; return; }
    if (window.gWideArt) window.gWideArt(item.game).then(src => {
      if (!art.isConnected) return;
      art.style.backgroundImage = cssUrl(src || cover(item.game));
      if (backdrop && src) backdrop.style.backgroundImage = cssUrl(src);
    });
  }
  function dsMove(direction) {
    const list = dsList();
    if (dsTool >= 0) {
      if (direction === 'down') { dsTool = -1; play('navigate'); }
      else if (direction === 'left' || direction === 'right') { const next = Math.max(0, Math.min(DS_TOOLS.length - 1, dsTool + (direction === 'right' ? 1 : -1))); if (next === dsTool) return; dsTool = next; play('navigate'); }
      else return;
      renderDs(); return;
    }
    const row = dsFocus % 3;
    let next = dsFocus;
    if (direction === 'up') { if (row > 0) next -= 1; else { dsTool = Math.min(DS_TOOLS.length - 1, Math.floor(dsFocus / 3) + 1); play('navigate'); renderDs(); return; } }
    if (direction === 'down' && row < 2) next += 1;
    if (direction === 'right') next += 3;
    if (direction === 'left') next -= 3;
    if (next < 0 || next >= list.length) { if (direction === 'right' && Math.floor(dsFocus / 3) < Math.floor((list.length - 1) / 3)) next = list.length - 1; else return; }
    if (next === dsFocus) return;
    dsFocus = next; play('navigate');
    renderDs();
  }

  // =========================== Rendering, navigation, sounds ===========================
  function render() {
    document.body.classList.toggle('g-retro', on());
    // The dashboard's visibility is keyed on .home-active, which only showView() sets; keep it honest when
    // the theme changes while the launcher is already sitting on Home.
    document.body.classList.toggle('home-active', state.view === 'home');
    if (!on()) { host.innerHTML = ''; chrome.innerHTML = ''; return; }
    try {
      ({ ps3: renderXmb, ps4: renderPs4, wii: renderWii, '3ds': renderDs })[theme()]();
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
    if (t === 'ps4' && el.closest('.ps4-tile') && Number(el.dataset.ps4Index) !== ps4Focus) { ps4Focus = Number(el.dataset.ps4Index); ps4Area = 'row'; renderPs4(); }
    if (t === 'wii' && el.closest('.wii-ch')) { wiiFocus = Number(el.dataset.wiiIndex); wiiBar = -1; }
  });
  document.addEventListener('click', event => {
    if (!on()) return;
    const el = event.target.closest?.('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    // A first click on an XMB item, PS4 tile or 3DS icon that isn't selected selects it, as the pointer did.
    if (theme() === 'ps3' && el.classList.contains('xmb-item') && !el.classList.contains('on')) { stop(); xmbItem[xmbCategories()[xmbCat].id] = Number(el.dataset.xmbIndex); play('navigate'); renderXmb(); return; }
    if (theme() === '3ds' && el.classList.contains('ds-icon') && !el.classList.contains('sel')) { stop(); dsFocus = Number(el.dataset.dsIndex); dsTool = -1; play('navigate'); renderDs(); return; }
    if (theme() === 'ps4' && el.classList.contains('ps4-tile') && !el.classList.contains('sel')) { stop(); ps4Focus = Number(el.dataset.ps4Index); ps4Area = 'row'; play('navigate'); renderPs4(); return; }
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
        if (theme() === 'wii' && wiiPreview) { play('back'); wiiPreview = null; render(); return; }
        if (theme() === 'ps4' && ps4Area !== 'row') { play('back'); ps4Area = 'row'; render(); return; }
        if (theme() === '3ds' && dsTool >= 0) { play('back'); dsTool = -1; render(); return; }
      }
      return back.apply(this, args);
    };
  }

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
