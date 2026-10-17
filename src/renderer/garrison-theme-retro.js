// PlayStation and Nintendo dashboards: PS3 (XMB), PS4, Wii and 3DS. Original recreations of each console's
// home screen, built over the launcher's own library and actions, so every item launches, opens the Store,
// Settings, friends and so on. Each has its own layout, focus style, sounds and controller navigation.
(() => {
  const RETRO = ['ps3', 'ps4', 'wii', '3ds'];
  const theme = () => document.body.dataset.gTheme || 'helix';
  const on = () => RETRO.includes(theme());
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text));
  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  const games = () => (typeof homeRecentGames === 'function' ? homeRecentGames() : []).filter(game => !game.isApp && !game.remoteHostId);
  const allGames = () => (state.games || []).filter(game => !game.isApp && game.installed !== false);
  const cover = game => game?.artwork?.tile || game?.artwork?.grid || '';
  const url = value => value ? `url(&quot;${esc(value).replaceAll('"', '%22')}&quot;)` : 'none';
  const name = () => state.displayName || document.querySelector('#dashboard-player-name')?.textContent || 'Player';
  const avatar = () => document.querySelector('#profile-avatar')?.innerHTML || '';
  const now = () => new Date();
  const time = () => now().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const day = () => now().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'numeric' });

  const host = document.createElement('section');
  host.id = 'g-retro';
  host.setAttribute('aria-label', 'Home');
  document.querySelector('#home-view')?.prepend(host);
  const chrome = document.createElement('div');
  chrome.id = 'g-retro-chrome';
  chrome.setAttribute('aria-hidden', 'true');
  document.body.append(chrome);

  // An item: { label, sub, action, data, glyph, art (wide game id), cover (url), boot }
  const attrs = item => `data-action="${esc(item.action)}"${Object.entries(item.data || {}).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}${item.boot ? ' data-retro-boot="1"' : ''}`;
  const gameItem = game => ({ label: game.title, sub: game.installed === false ? 'Not installed' : game.provider === 'PC' ? '' : game.provider, action: 'select-game', data: { 'game-id': game.id }, game, boot: true });

  // ---------- PS3: the XrossMediaBar ----------
  const MONTH = ['#9da3ab', '#c8a136', '#5f9e3d', '#d77ea8', '#2f8f62', '#7d4fb0', '#2aa4a0', '#2f7fd8', '#8a5a2b', '#d0702c', '#6d3d99', '#b62a2a'];
  let xmbCat = 2, xmbItem = [0, 0, 0, 0, 0];
  const xmbCategories = () => [
    { id: 'users', label: 'Users', glyph: 'contact', items: [{ label: name(), sub: 'Signed in', action: 'g-account', glyph: 'contact' }, { label: 'Turn Off System', action: 'power-menu', glyph: 'power' }] },
    { id: 'settings', label: 'Settings', glyph: 'settings', items: [
      { label: 'Theme Settings', action: 'g-retro-settings', data: { page: 'personalization' }, glyph: 'color' },
      { label: 'Sound Settings', action: 'g-retro-settings', data: { page: 'audio' }, glyph: 'volume' },
      { label: 'Display Settings', action: 'g-retro-settings', data: { page: 'accessibility' }, glyph: 'tv' },
      { label: 'Network Settings', action: 'g-retro-settings', data: { page: 'g-streaming' }, glyph: 'globe' },
      { label: 'Accessory Settings', action: 'g-retro-settings', data: { page: 'g-input' }, glyph: 'controller' },
      { label: 'System Settings', action: 'g-retro-settings', data: { page: 'g-storage' }, glyph: 'settings' }] },
    { id: 'game', label: 'Game', glyph: 'game', items: [...allGames().slice(0, 40).map(gameItem), { label: 'Game Data Utility', action: 'library', glyph: 'library' }] },
    { id: 'store', label: 'Store', glyph: 'shop', items: [{ label: 'Store', sub: 'Games and add-ons', action: 'dashboard-store', glyph: 'shop' }, { label: 'Game Pass', action: 'dashboard-gamepass', glyph: 'game' }, { label: 'Downloads', action: 'console-library-section', data: { section: 'queue' }, glyph: 'download' }] },
    { id: 'friends', label: 'Friends', glyph: 'friends', items: [{ label: 'Friends', sub: `${(state.gFriends?.online || 0)} online`, action: 'g-friends', glyph: 'friends' },
      ...(state.gFriends?.friends || []).filter(f => f.state !== 'offline' && f.state !== 'unknown').slice(0, 8).map(f => ({ label: f.name || 'Friend', sub: f.game ? `Playing ${f.game}` : 'Online', action: 'g-friend-chat', data: { 'friend-id': f.id }, image: f.avatar, glyph: 'contact' }))] }
  ];
  function renderXmb() {
    const cats = xmbCategories();
    xmbCat = Math.min(xmbCat, cats.length - 1);
    const items = cats[xmbCat].items;
    xmbItem[xmbCat] = Math.min(xmbItem[xmbCat] || 0, Math.max(0, items.length - 1));
    const sel = xmbItem[xmbCat];
    document.body.style.setProperty('--xmb-tint', MONTH[now().getMonth()]);
    const itemHtml = (item, index) => {
      const offset = index - sel;
      const visual = item.game ? `<span class="xmb-icon game" data-g-wide-art="${esc(item.game.id)}"></span>` : item.image ? `<span class="xmb-icon pic" style="background-image:${url(item.image)}"></span>` : `<span class="xmb-icon">${icon(item.glyph)}</span>`;
      return `<button class="xmb-item focusable${offset === 0 ? ' on' : ''}" type="button" ${attrs(item)} data-xmb-index="${index}" style="--o:${offset}" aria-label="${esc(item.label)}">${visual}<span class="xmb-copy"><strong>${esc(item.label)}</strong>${item.sub ? `<small>${esc(item.sub)}</small>` : ''}</span></button>`;
    };
    host.innerHTML = `<div class="xmb-wave" aria-hidden="true"><svg viewBox="0 0 1600 500" preserveAspectRatio="none"><path class="w1" d="M0 260 C 260 160, 520 360, 800 250 S 1340 140, 1600 250"/><path class="w2" d="M0 290 C 300 210, 560 380, 820 280 S 1360 190, 1600 290"/><path class="w3" d="M0 240 C 240 300, 600 170, 860 250 S 1380 330, 1600 220"/></svg></div>
      <div class="xmb-bar">${cats.map((cat, i) => `<span class="xmb-cat${i === xmbCat ? ' on' : ''}" style="--c:${i - xmbCat}">${icon(cat.glyph)}<b>${esc(cat.label)}</b></span>`).join('')}</div>
      <div class="xmb-list">${items.map(itemHtml).join('')}</div>`;
    chrome.innerHTML = `<span class="xmb-clock">${esc(day())} ${esc(time())}</span>`;
    const current = host.querySelector('.xmb-item.on');
    if (current && host.contains(document.activeElement) === false && state.view === 'home') setFocusedElement(current, { scroll: false });
    else if (current) setFocusedElement(current, { scroll: false });
  }
  function xmbMove(direction) {
    const cats = xmbCategories();
    if (direction === 'left' || direction === 'right') { xmbCat = Math.max(0, Math.min(cats.length - 1, xmbCat + (direction === 'right' ? 1 : -1))); play('category'); }
    else { const count = cats[xmbCat].items.length; xmbItem[xmbCat] = Math.max(0, Math.min(count - 1, (xmbItem[xmbCat] || 0) + (direction === 'down' ? 1 : -1))); play('navigate'); }
    renderXmb();
  }

  // ---------- PS4: the home screen ----------
  let ps4Focus = 0;
  function renderPs4() {
    const list = [{ label: "What's New", sub: 'See what your friends are up to', action: 'g-friends', glyph: 'friends', system: true }, ...games().slice(0, 14).map(gameItem),
      { label: 'Library', sub: 'All your games and apps', action: 'library', glyph: 'library', system: true }, { label: 'PlayStation Store', sub: 'Games and add-ons', action: 'dashboard-store', glyph: 'shop', system: true, store: true }];
    ps4Focus = Math.min(ps4Focus, list.length - 1);
    const fns = [['dashboard-store', 'shop', 'PlayStation Store'], ['g-notifications', 'bell', 'Notifications'], ['g-friends', 'friends', 'Friends'], ['g-account', 'contact', 'Profile'], ['settings', 'settings', 'Settings'], ['power-menu', 'power', 'Power']];
    host.innerHTML = `<div class="ps4-bg" aria-hidden="true"><i class="ps4-art"></i><i class="ps4-p1"></i><i class="ps4-p2"></i></div>
      <nav class="ps4-functions" aria-label="Function area">${fns.map(([action, glyph, label]) => `<button class="ps4-fn focusable" type="button" data-action="${action}" aria-label="${label}">${icon(glyph)}<span>${label}</span></button>`).join('')}</nav>
      <div class="ps4-row" role="list">${list.map((item, i) => `<button class="ps4-tile focusable${item.system ? ' system' : ''}${item.store ? ' store' : ''}${i === ps4Focus ? ' sel' : ''}" type="button" ${attrs(item)} data-ps4-index="${i}" aria-label="${esc(item.label)}"
        ${item.game ? `style="--cover:${url(cover(item.game))}"` : ''}>${item.game ? '' : icon(item.glyph)}<span class="ps4-name"><strong>${esc(item.label)}</strong>${item.sub ? `<small>${esc(item.sub)}</small>` : ''}${item.game ? '<em>Start</em>' : ''}</span></button>`).join('')}</div>`;
    chrome.innerHTML = `<span class="ps4-user"><i>${avatar()}</i>${esc(name())}</span><span class="ps4-clock">${esc(time())}</span>`;
    ps4Background();
  }
  function ps4Background() {
    const tile = host.querySelector('.ps4-tile.focused, .ps4-tile.sel');
    const id = tile?.dataset.gameId;
    const layer = host.querySelector('.ps4-art');
    if (!layer) return;
    if (!id) { layer.style.opacity = '0'; return; }
    const game = state.games.find(item => item.id === id);
    (window.gWideArt ? window.gWideArt(game) : Promise.resolve('')).then(src => { if (layer.isConnected && src) { layer.style.backgroundImage = `url("${src.replaceAll('"', '%22')}")`; layer.style.opacity = '1'; } else if (layer.isConnected) layer.style.opacity = '0'; });
  }

  // ---------- Wii: the Wii Menu ----------
  let wiiPage = 0, wiiPreview = null;
  function wiiChannels() {
    const recent = games();
    return [
      { label: 'Disc Channel', sub: recent[0] ? recent[0].title : 'Insert a disc', action: recent[0] ? 'g-retro-preview' : 'g-disc-tray', data: recent[0] ? { 'game-id': recent[0].id } : {}, disc: true, game: recent[0] },
      { label: 'Mii Channel', action: 'g-account', mii: true },
      { label: 'Photo Channel', action: 'g-retro-settings', data: { page: 'personalization' }, glyph: 'photo' },
      { label: 'Wii Shop Channel', action: 'dashboard-store', shop: true },
      ...recent.slice(1, 40).map(game => ({ label: game.title, action: 'g-retro-preview', data: { 'game-id': game.id }, game })),
      { label: 'Forecast Channel', action: 'g-retro-weather', glyph: 'globe' }, { label: 'News Channel', action: 'g-friends', glyph: 'chat' }
    ];
  }
  function renderWii() {
    if (wiiPreview) { renderWiiPreview(); return; }
    const channels = wiiChannels();
    const pages = Math.max(1, Math.ceil(channels.length / 12));
    wiiPage = Math.min(wiiPage, pages - 1);
    const shown = channels.slice(wiiPage * 12, wiiPage * 12 + 12);
    while (shown.length < 12) shown.push(null);
    host.innerHTML = `<div class="wii-grid">${shown.map(ch => !ch ? '<span class="wii-ch empty" aria-hidden="true"></span>' : `<button class="wii-ch focusable${ch.disc ? ' disc' : ''}${ch.mii ? ' mii' : ''}${ch.shop ? ' shop' : ''}" type="button" ${attrs(ch)} aria-label="${esc(ch.label)}"${ch.game ? ` data-g-wide-art="${esc(ch.game.id)}"` : ''}>
        ${ch.game && !ch.disc ? '' : ch.disc ? '<span class="wii-disc" aria-hidden="true"></span>' : ch.mii ? '<span class="wii-mii" aria-hidden="true"><i></i></span>' : ch.shop ? '<span class="wii-bag" aria-hidden="true"></span>' : `<span class="wii-glyph">${icon(ch.glyph)}</span>`}
        <span class="wii-label">${esc(ch.label)}</span></button>`).join('')}</div>
      ${pages > 1 ? `<button class="wii-arrow left focusable" type="button" data-action="g-wii-page" data-dir="-1" aria-label="Previous page"${wiiPage === 0 ? ' hidden' : ''}></button><button class="wii-arrow right focusable" type="button" data-action="g-wii-page" data-dir="1" aria-label="Next page"${wiiPage >= pages - 1 ? ' hidden' : ''}></button>` : ''}`;
    chrome.innerHTML = `<div class="wii-bar"><button class="wii-btn focusable" type="button" data-action="settings" aria-label="Wii Settings">Wii</button><span class="wii-time"><strong>${esc(time())}</strong><small>${esc(now().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'numeric' }))}</small></span><button class="wii-mail focusable" type="button" data-action="g-notifications" aria-label="Messages"></button></div>`;
    chrome.removeAttribute('aria-hidden');
  }
  function renderWiiPreview() {
    const game = state.games.find(item => item.id === wiiPreview);
    if (!game) { wiiPreview = null; renderWii(); return; }
    host.innerHTML = `<div class="wii-preview"><div class="wii-banner" data-g-wide-art="${esc(game.id)}"><strong>${esc(game.title)}</strong></div>
      <div class="wii-preview-buttons"><button class="wii-pbtn focusable" type="button" data-action="g-wii-back">Wii Menu</button><button class="wii-pbtn start focusable" type="button" data-action="select-game" data-game-id="${esc(game.id)}" data-retro-boot="1">Start</button></div></div>`;
    chrome.innerHTML = '';
    setFocusedElement(host.querySelector('.wii-pbtn.start'), { scroll: false });
  }

  // ---------- 3DS: the HOME Menu ----------
  let dsFocus = 0;
  function renderDs() {
    const list = [...games().slice(0, 20).map(gameItem), { label: 'Nintendo eShop', action: 'dashboard-store', glyph: 'shop', eshop: true }, { label: 'System Settings', action: 'settings', glyph: 'repair' },
      { label: 'Friend List', action: 'g-friends', glyph: 'friends' }, { label: 'Notifications', action: 'g-notifications', glyph: 'bell' }, { label: 'Game Notes', action: 'library', glyph: 'library' }];
    dsFocus = Math.min(dsFocus, list.length - 1);
    host.innerHTML = `<div class="ds-device"><div class="ds-top"><div class="ds-banner"><i class="ds-art"></i><strong></strong><small></small></div></div>
      <div class="ds-bottom"><div class="ds-status"><span>${esc(time())}</span><span>${esc(now().toLocaleDateString([], { day: 'numeric', month: 'numeric' }))}</span><span class="ds-battery"><i></i></span></div>
      <div class="ds-grid">${list.map((item, i) => `<button class="ds-icon focusable${item.eshop ? ' eshop' : ''}" type="button" ${attrs(item)} data-ds-index="${i}" aria-label="${esc(item.label)}"${item.game ? ` style="--cover:${url(cover(item.game))}"` : ''}>${item.game ? '' : icon(item.glyph)}</button>`).join('')}</div>
      <button class="ds-open focusable" type="button" data-action="g-ds-open">Open</button></div></div>`;
    chrome.innerHTML = '';
    dsBanner(host.querySelectorAll('.ds-icon')[dsFocus]);
  }
  function dsBanner(iconEl) {
    const banner = host.querySelector('.ds-banner');
    if (!banner || !iconEl) return;
    const id = iconEl.dataset.gameId, game = id && state.games.find(item => item.id === id);
    banner.querySelector('strong').textContent = iconEl.getAttribute('aria-label');
    banner.querySelector('small').textContent = game ? (game.provider === 'PC' ? '' : game.provider) : '';
    const art = banner.querySelector('.ds-art');
    art.style.backgroundImage = '';
    if (game && window.gWideArt) window.gWideArt(game).then(src => { if (art.isConnected) art.style.backgroundImage = src ? `url("${src.replaceAll('"', '%22')}")` : `url("${cover(game).replaceAll('"', '%22')}")`; });
  }

  // ---------- Rendering, navigation, sounds ----------
  function render() {
    document.body.classList.toggle('g-retro', on());
    if (!on()) { host.innerHTML = ''; chrome.innerHTML = ''; return; }
    ({ ps3: renderXmb, ps4: renderPs4, wii: renderWii, '3ds': renderDs })[theme()]();
    try { refreshFocusables(); } catch { /* Not ready. */ }
  }
  const firstFocus = () => host.querySelector('.xmb-item.on, .ps4-tile.sel, .wii-ch.focusable, .wii-pbtn.start, .ds-icon');
  if (typeof navigateConsoleHome === 'function') {
    const base = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (!on() || state.view !== 'home') return base.call(this, direction, focused);
      if (theme() === 'ps3') { xmbMove(direction); return true; }
      if (!focused || !host.contains(focused) && !chrome.contains(focused)) { const first = firstFocus(); if (first) { setFocusedElement(first, { scroll: false }); return true; } }
      return false;
    };
  }
  // Following focus: the PS4 background and the 3DS top screen show what's selected.
  document.addEventListener('focusin', event => {
    if (!on()) return;
    const tile = event.target.closest?.('.ps4-tile');
    if (tile) { host.querySelectorAll('.ps4-tile.sel').forEach(el => el.classList.remove('sel')); tile.classList.add('sel'); ps4Focus = Number(tile.dataset.ps4Index); ps4Background(); tile.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }
    const ds = event.target.closest?.('.ds-icon');
    if (ds) { dsFocus = Number(ds.dataset.dsIndex); dsBanner(ds); }
  });
  document.addEventListener('click', event => {
    if (!on()) return;
    const el = event.target.closest?.('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const stop = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (action === 'g-retro-settings') { stop(); Promise.resolve(typeof openSettings === 'function' ? openSettings() : settingsDialog.showModal()).then(() => { try { showSettingsPage(el.dataset.page); } catch { /* Missing. */ } }); return; }
    if (action === 'g-retro-preview') { stop(); play('confirm'); wiiPreview = el.dataset.gameId; render(); return; }
    if (action === 'g-wii-back') { stop(); play('back'); wiiPreview = null; render(); setFocusedElement(firstFocus(), { scroll: false }); return; }
    if (action === 'g-wii-page') { stop(); play('category'); wiiPage += Number(el.dataset.dir); render(); setFocusedElement(firstFocus(), { scroll: false }); return; }
    if (action === 'g-retro-weather') { stop(); if (typeof showToast === 'function') showToast(`Forecast · ${now().toLocaleDateString([], { weekday: 'long' })} · Have a great day of gaming`); return; }
    if (action === 'g-ds-open') { stop(); host.querySelectorAll('.ds-icon')[dsFocus]?.click(); return; }
    // Items that are games boot straight into them, as on these consoles.
    if (el.dataset.retroBoot && el.dataset.gameId) {
      const game = state.games.find(item => item.id === el.dataset.gameId);
      if (game && game.installed !== false) { stop(); wiiPreview = null; selectGame(game.id, false, el); launchSelectedGame(); }
    }
  }, true);
  // B on the Wii channel preview goes back to the Wii Menu.
  if (typeof navigateBack === 'function') {
    const back = navigateBack;
    navigateBack = function (...args) { if (theme() === 'wii' && wiiPreview && state.view === 'home') { wiiPreview = null; render(); setFocusedElement(firstFocus(), { scroll: false }); return; } return back.apply(this, args); };
  }

  // Sounds: short, era-style cues, synthesised (no console recordings).
  let ctx;
  const SOUNDS = {
    ps3: { navigate: [1320, .045, 'sine', .03], category: [880, .07, 'sine', .035], confirm: [660, .16, 'triangle', .04, 990], back: [520, .12, 'triangle', .035, 390], launch: [440, .5, 'sine', .04, 880], notify: [1175, .3, 'sine', .03, 1568] },
    ps4: { navigate: [1760, .035, 'sine', .025], category: [1320, .05, 'sine', .03], confirm: [1047, .12, 'sine', .04, 1568], back: [784, .1, 'sine', .03, 587], launch: [523, .6, 'sine', .04, 1047], notify: [1319, .35, 'sine', .03, 1760] },
    wii: { navigate: [1568, .06, 'triangle', .035], category: [1175, .08, 'triangle', .04], confirm: [988, .18, 'square', .02, 1319], back: [784, .14, 'triangle', .035, 523], launch: [523, .7, 'triangle', .04, 1047], notify: [1319, .3, 'triangle', .035, 1760] },
    '3ds': { navigate: [2093, .04, 'square', .012], category: [1568, .06, 'square', .014], confirm: [1319, .12, 'square', .015, 1760], back: [1047, .1, 'square', .014, 784], launch: [784, .5, 'square', .015, 1568], notify: [1760, .25, 'square', .014, 2349] }
  };
  function play(kind) {
    const set = SOUNDS[theme()];
    const spec = set?.[kind];
    if (!spec || state.soundEffects === false || !document.hasFocus() || document.hidden) return;
    try {
      ctx ||= new AudioContext();
      const [freq, dur, type, gain, to] = spec;
      const start = ctx.currentTime, osc = ctx.createOscillator(), amp = ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, start); if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
      amp.gain.setValueAtTime(.0001, start); amp.gain.exponentialRampToValueAtTime(gain, start + .005); amp.gain.exponentialRampToValueAtTime(.0001, start + dur);
      osc.connect(amp).connect(ctx.destination); osc.start(start); osc.stop(start + dur + .02);
    } catch { /* Optional. */ }
  }
  if (typeof interfaceAudio === 'object' && interfaceAudio) {
    const base = interfaceAudio.play.bind(interfaceAudio);
    interfaceAudio.play = function (kind = 'navigate') { if (on() && SOUNDS[theme()][kind] && !(interfaceAudio.customCount?.() > 0)) return play(kind); return base(kind); };
  }

  if (typeof renderRecentGames === 'function') {
    const recentBase = renderRecentGames;
    renderRecentGames = function (...args) { const result = recentBase.apply(this, args); if (on() && !host.contains(document.activeElement)) render(); return result; };
  }
  if (typeof showView === 'function') {
    const viewBase = showView;
    showView = function (next, ...rest) { const result = viewBase.call(this, next, ...rest); if (next === 'home' && on()) requestAnimationFrame(() => { render(); setFocusedElement(firstFocus(), { scroll: false }); }); return result; };
  }
  setInterval(() => { if (on() && theme() !== 'wii' && !host.contains(document.activeElement)) render(); else if (on()) { const clock = chrome.querySelector('.xmb-clock, .ps4-clock, .wii-time strong'); if (clock) clock.textContent = clock.classList.contains('xmb-clock') ? `${day()} ${time()}` : time(); } }, 30000);
  new MutationObserver(() => { wiiPreview = null; render(); if (on()) requestAnimationFrame(() => setFocusedElement(firstFocus(), { scroll: false })); }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  render();
})();
