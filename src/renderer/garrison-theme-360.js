// 360: the Xbox 360 Metro dashboard (2011-2013), laid out from DashX360's reference captures of the console.
//
//  - Lowercase pivots across the top: bing, home, social, games, game pass, marketplace, settings. LB/RB move
//    between them with the console's page sounds, and the neighbouring pivots peek in at the screen edges.
//  - Home is one band of tiles in the middle of the grey studio: two lime tiles (My Games, Game Marketplace),
//    the big featured tile that rotates through your recent games with page dots, and a column of
//    "advertisement" tiles.
//  - Friends, messages, Gamerscore and gamerpic top right; A Select / Y Search hints bottom left.
//  - With the DashX360 pack installed (theme:pack), its sounds, boot video and dashboard themes are used.
// Every tile runs an action the launcher already has, so all of it works.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const on = () => theme() === 'x360';
  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text));

  // ---------- Pivots ----------
  const nav = document.querySelector('.top-center-nav');
  const LABELS = { home: 'home', library: 'games', 'dashboard-gamepass': 'game pass', 'dashboard-store': 'marketplace', 'toggle-search': 'bing' };
  if (nav) {
    for (const button of nav.querySelectorAll('.top-nav-button')) if (LABELS[button.dataset.action]) button.dataset.g360 = LABELS[button.dataset.action];
    nav.insertAdjacentHTML('beforeend', '<button class="top-nav-button focusable g-360-only" type="button" data-action="g-friends" data-g360="social" aria-label="Social"></button>'
      + '<button class="top-nav-button focusable g-360-only" type="button" data-action="settings" data-g360="settings" aria-label="Settings"></button>');
  }

  // ---------- Top right: friends, messages, Gamerscore, gamerpic ----------
  const status = document.createElement('div');
  status.id = 'g-360-status';
  // The gamercard: your gamerpic opens it, as on the 360.
  const card = document.createElement('div');
  card.id = 'g-360-card';
  document.body.append(card);
  status.addEventListener('click', event => {
    if (!event.target.closest('.g-360-pic')) return;
    const name = state.displayName || document.querySelector('#dashboard-player-name')?.textContent || 'Player';
    const score = (document.querySelector('#profile-score-value')?.textContent || '0').replace(/[^\d,]/g, '') || '0';
    card.innerHTML = `<span class="pic">${document.querySelector('#profile-avatar')?.innerHTML || ''}</span><strong>${esc(name)}</strong><span>${esc(score)} G</span><span class="stars">★★★★★</span><span>Online · OmniDash</span>`;
    card.classList.toggle('on');
    try { interfaceAudio.play(card.classList.contains('on') ? 'confirm' : 'back'); } catch { /* Optional. */ }
  });
  document.addEventListener('pointerdown', event => { if (!event.target.closest?.('#g-360-card, .g-360-pic')) card.classList.remove('on'); });
  window.addEventListener('keydown', () => card.classList.remove('on'));
  document.querySelector('.topbar')?.append(status);
  function renderStatus() {
    const friends = Number(document.querySelector('#g-pill-count')?.textContent || 0);
    const messages = Number(document.querySelector('#g-notification-badge')?.textContent || 0);
    const score = (document.querySelector('#profile-score-value')?.textContent || '').replace(/[^\d]/g, '') || '0';
    const avatar = document.querySelector('#profile-avatar')?.innerHTML || '';
    status.innerHTML = `<span>${icon('contact')}${friends}</span><span>${icon('chat')}${messages}</span><span class="g-360-score">${esc(score)} <i>G</i></span><button class="g-360-pic focusable" type="button" aria-label="Gamercard">${avatar}</button>`;
  }

  // ---------- Bottom hints ----------
  // The console's own prompts, drawn from the one glyph helper so the 360, Series and One can never show
  // another console's buttons. The 360's home row is A Select / B Back / Menu Options / Y Search.
  const glyphPrompts = window.gGlyphs?.prompts?.x360?.home || [];
  document.body.insertAdjacentHTML('beforeend', `<div id="g-360-hints" aria-hidden="true">${window.gGlyphs?.row?.('x360', glyphPrompts) || ''}</div>`
    + '<div id="g-360-peek-left" class="g-360-peek" aria-hidden="true"><i></i><i class="avatar"></i></div><div id="g-360-peek-right" class="g-360-peek" aria-hidden="true"><i></i><i></i></div>');

  // ---------- Home band ----------
  const homeView = document.querySelector('#home-view');
  const band = document.createElement('section');
  band.id = 'g-360-home';
  band.setAttribute('aria-label', 'Home');
  homeView?.prepend(band);
  const wide = game => game?.artwork?.hero || game?.artwork?.wide || game?.artwork?.screenshots?.[0] || game?.artwork?.tile || '';
  const bg = url => url ? ` style="--g-art:url(&quot;${esc(url).replaceAll('"', '%22')}&quot;)"` : '';
  let featured = [], featureIndex = 0, rotateTimer = 0;
  function recent() { return typeof homeRecentGames === 'function' ? homeRecentGames().filter(game => !game.remoteHostId) : []; }
  function featureTile(game) {
    return `<button class="g-360-big g-boot-tile focusable" type="button" data-action="select-game" data-game-id="${esc(game.id)}" data-g-wide-art="${esc(game.id)}" aria-label="${esc(game.title)}">
      <span class="g-360-caption"><strong>${esc(game.title)}</strong><small>${game.installed === false ? 'Get it now' : 'Jump back in'}</small></span></button>`;
  }
  function renderHome() {
    if (!on()) return;
    const games = recent();
    featured = games.slice(0, 5);
    featureIndex = Math.min(featureIndex, Math.max(0, featured.length - 1));
    const second = games[featured.length] || games[1], third = games[featured.length + 1] || games[2];
    const small = (action, label, glyph) => `<button class="g-360-tile lime focusable" type="button" data-action="${action}" aria-label="${esc(label)}">${icon(glyph)}<span>${esc(label)}</span></button>`;
    const art = (game, label) => game ? `<button class="g-360-tile art g-boot-tile focusable" type="button" data-action="select-game" data-game-id="${esc(game.id)}" data-g-wide-art="${esc(game.id)}" aria-label="${esc(game.title)}"><span>${esc(label || game.title)}</span></button>` : '';
    band.innerHTML = `<div class="g-360-col">${small('library', 'My Games', 'game')}${small('dashboard-store', 'Game Marketplace', 'shop')}</div>
      <div class="g-360-feature">${featured.length ? featureTile(featured[featureIndex]) : `<button class="g-360-big focusable" type="button" data-action="library"><span class="g-360-caption"><strong>My Games</strong><small>Find something to play</small></span></button>`}
        <span class="g-360-dots">${featured.map((_, i) => `<i class="${i === featureIndex ? 'on' : ''}"></i>`).join('')}</span></div>
      <div class="g-360-col wide">${art(second) || small('dashboard-gamepass', 'Game Pass', 'game')}
        <button class="g-360-tile ad focusable" type="button" data-action="dashboard-gamepass" aria-label="Game Pass"><span>Game Pass</span><em>Hundreds of games</em></button>
        <small class="g-360-adlabel">ADVERTISEMENT</small></div>
      <div class="g-360-col">${art(third) || small('g-friends', 'Friends', 'friends')}<button class="g-360-tile lime g-360-tray focusable" type="button" data-action="g-disc-tray" aria-label="Open Tray">${window.gThemePack?.base ? `<img class="g-360-tray-img" src="${esc(window.gThemePack.base + 'Misc/disc-tray.png')}" alt="" />` : icon('download')}<span>Open Tray</span></button></div>`;
    renderStatus();
    try { refreshFocusables(); } catch { /* Not ready. */ }
    // If nothing is focused (first paint, or a click on the background), the band is the console's starting point.
    if (on() && state.view === 'home' && !document.querySelector('dialog[open]')) {
      const active = document.activeElement;
      if (!active || active === document.body || (active.closest?.('#g-360-home') && !active.classList.contains('focused'))) ensureBandFocus();
    }
  }
  // The big tile turns over to the next recent game every few seconds, as the console's featured tile did,
  // unless you're on it.
  rotateTimer = setInterval(() => {
    if (!on() || featured.length < 2 || document.hidden || !homeView || homeView.hidden) return;
    const big = band.querySelector('.g-360-big');
    if (!big || big.classList.contains('focused') || big === document.activeElement) return;
    featureIndex = (featureIndex + 1) % featured.length;
    big.classList.add('g-360-turn');
    setTimeout(() => { big.outerHTML = featureTile(featured[featureIndex]); band.querySelectorAll('.g-360-dots i').forEach((dot, i) => dot.classList.toggle('on', i === featureIndex)); try { refreshFocusables(); } catch { /* Not ready. */ } }, 260);
  }, 7000);

  if (typeof renderRecentGames === 'function') {
    const base = renderRecentGames;
    renderRecentGames = function (...args) { const result = base.apply(this, args); renderHome(); return result; };
  }
  // The band is a real 2-D place: the sticks move between the featured tile and its neighbours.
  const bandTiles = () => [...band.querySelectorAll('.focusable')].filter(el => el.offsetParent !== null);
  // Keep the app's focus model and the white frame in step with real focus, even when something focuses a tile directly.
  document.addEventListener('focusin', event => {
    if (!on()) return;
    const tile = event.target.closest?.('#g-360-home .focusable');
    if (!tile) return;
    if (!tile.classList.contains('focused')) {
      for (const node of band.querySelectorAll('.focused')) node.classList.remove('focused');
      tile.classList.add('focused');
    }
    state.focusedElement = tile;
  });
  function focusBandStart() {
    const target = band.querySelector('.g-360-big') || bandTiles()[0];
    if (target) setFocusedElement(target, { scroll: false });
  }
  // The band is the console's starting point whenever Home arrives; a tile can be document.activeElement
  // without carrying the app's .focused class, so check both before leaving focus alone.
  function ensureBandFocus() {
    if (!on() || state.view !== 'home' || band.offsetParent === null || document.querySelector('dialog[open]')) return;
    if (document.body.dataset.gHub && document.body.dataset.gHub !== 'home') return;
    const active = document.activeElement;
    if (!active || !active.closest?.('#g-360-home') || !active.classList.contains('focused')) focusBandStart();
  }
  function bandMove(direction, current) {
    const items = bandTiles();
    if (!items.includes(current)) return false;
    const box = current.getBoundingClientRect();
    const cx = box.left + box.width / 2, cy = box.top + box.height / 2;
    let best = null, bestScore = Infinity;
    for (const item of items) {
      if (item === current) continue;
      const rect = item.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - cx, dy = rect.top + rect.height / 2 - cy;
      const primary = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
      if (primary <= 4) continue;
      // Horizontal moves stay on the same top edge; vertical moves stay in the same column.
      const secondary = direction === 'up' || direction === 'down' ? Math.abs(rect.left - box.left) : Math.abs(rect.top - box.top);
      const score = primary + secondary * 1.4;
      if (score < bestScore) { best = item; bestScore = score; }
    }
    if (!best) return false;
    setFocusedElement(best, { scroll: false });
    return true;
  }
  // On the 360, Home's band is where Down from the pivots lands.
  if (typeof navigateConsoleHome === 'function') {
    const homeNav = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (on()) {
        if (focused?.closest?.('.topbar') && direction === 'down') { focusBandStart(); return true; }
        if (focused?.closest?.('#g-360-home')) {
          const box = focused.getBoundingClientRect();
          const top = Math.min(...bandTiles().map(el => el.getBoundingClientRect().top));
          if (direction === 'up' && box.top - top < 20) { setFocusedElement(nav.querySelector('.top-nav-button.active') || nav.querySelector('.focusable'), { scroll: false }); return true; }
          if (bandMove(direction, focused)) return true;
          return false;
        }
        // No visible focus (right after a theme switch, or the launcher's hidden recent cards): start on the feature.
        if (state.view === 'home' && band.offsetParent !== null && ['down', 'right', 'left'].includes(direction)) { focusBandStart(); return true; }
      }
      return homeNav.call(this, direction, focused);
    };
  }
  // Home should open with the featured tile selected, not with focus left on the hidden recent row.
  if (typeof showView === 'function') {
    const show = showView;
    showView = function (next, ...rest) {
      const result = show.call(this, next, ...rest);
      if (next === 'home' && on()) {
        ensureBandFocus();
        setTimeout(ensureBandFocus, 400);
      }
      return result;
    };
  }

  // ---------- Pack: sounds, boot video and dashboard themes ----------
  let pack = null;
  const packSounds = {};
  async function loadPack() {
    pack = await window.launcher?.getThemePack?.().catch(() => null);
    if (!pack?.available) return;
    window.gThemePack = pack;
    window.gGlyphs?.usePack?.(pack);
    document.dispatchEvent(new CustomEvent('g-theme-pack', { detail: pack }));
    // The shared audio engine reads the pack's own sounds and music and routes them through its master gain.
    if (window.gAudio) { packSounds.context = null; return; }
    let context;
    for (const kind of pack.sounds || []) {
      const sound = await window.launcher.getThemePackSound(kind).catch(() => null);
      if (!sound) continue;
      try {
        context ||= new AudioContext();
        const bytes = Uint8Array.from(atob(sound.base64), char => char.charCodeAt(0));
        packSounds[kind] = await context.decodeAudioData(bytes.buffer);
      } catch { /* A sound that won't decode is skipped. */ }
    }
    packSounds.context = context;
  }
  loadPack();
  if (typeof interfaceAudio === 'object' && interfaceAudio) {
    const play = interfaceAudio.play.bind(interfaceAudio);
    let lastAt = 0, voice = null;
    interfaceAudio.play = function (kind = 'navigate') {
      // The shared audio engine handles 360's pack sounds when it is loaded; this is the fallback path.
      if (window.gAudio?.play?.(kind)) return;
      if (!on() || !packSounds[kind] || interfaceAudio.customCount?.() > 0) return play(kind);
      if (document.hidden || !document.hasFocus()) return;
      if (kind === 'startup' && document.querySelector('#g-360-boot')) return;
      const now = performance.now();
      if (kind === 'navigate' && now - lastAt < 55) return;
      lastAt = now;
      try {
        const c = packSounds.context;
        if (c.state === 'suspended') c.resume().catch(() => {});
        if (kind !== 'notify') try { voice?.stop(); } catch { /* Already stopped. */ }
        const source = c.createBufferSource(), gain = c.createGain();
        source.buffer = packSounds[kind]; gain.gain.value = .55;
        source.connect(gain).connect(c.destination);
        source.start();
        voice = source;
      } catch { /* Audio is optional. */ }
    };
  }
  // The console's own boot: the pack's boot video, once, when the launcher opens in this theme.
  // Only ever in front of the player: a launcher that isn't focused (in the background, or a hidden window)
  // never plays it, and it waits a moment for focus on start-up.
  const whenFocused = (run, wait = 4000) => {
    if (document.hasFocus() && !document.hidden) return run();
    const go = () => { window.removeEventListener('focus', go); clearTimeout(timer); run(); };
    const timer = setTimeout(() => window.removeEventListener('focus', go), wait);
    window.addEventListener('focus', go);
  };
  document.addEventListener('g-theme-pack', ({ detail }) => whenFocused(() => {
    if (!on() || !detail.boot || sessionStorage.getItem('g-360-booted') || !document.hasFocus()) return;
    sessionStorage.setItem('g-360-booted', '1');
    const boot = document.createElement('div');
    boot.id = 'g-360-boot';
    boot.innerHTML = `<video src="${esc(detail.boot)}" autoplay playsinline></video>`;
    document.body.append(boot);
    const video = boot.querySelector('video');
    const end = () => { boot.classList.add('done'); setTimeout(() => boot.remove(), 600); window.removeEventListener('keydown', end, true); };
    video.addEventListener('ended', end);
    video.addEventListener('error', end);
    window.addEventListener('keydown', end, true);
    boot.addEventListener('pointerdown', end);
    setTimeout(end, 20000);
  }), { once: true });

  // LB / RB page sounds.
  const scroll = window.gPageScroll;
  window.gPageScroll = direction => {
    if (on() && !document.querySelector('dialog[open]')) { try { interfaceAudio.play(direction > 0 ? 'pageRight' : 'pageLeft'); } catch { /* Optional. */ } }
    return scroll?.(direction);
  };

  for (const id of ['#g-pill-count', '#profile-score-value', '#profile-avatar', '#g-notification-badge']) {
    const node = document.querySelector(id);
    if (node) new MutationObserver(() => { if (on()) renderStatus(); }).observe(node, { childList: true, characterData: true, subtree: true });
  }
  document.addEventListener('g-theme-pack', () => renderHome());
  new MutationObserver(() => { if (on()) renderHome(); }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  renderHome();
})();
