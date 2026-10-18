// PlayStation 5 (2020): the ninth console theme. One horizontal row of large square tiles for the most recent
// games; the focused tile grows out of the row under a soft white glow, its title beneath it, and the focused
// game's wide art drifts behind everything in two crossfading ambient layers. Activity Cards under the row are
// real launcher actions (Continue, Trophies, Captures); pressing a tile opens a full Game Hub; the Control Center
// is the PS5's bottom bar with real volume/mute, network, power and Settings. Every mark, icon, particle and
// sound is drawn or synthesised here. No Sony asset, font, icon or recording is used or required.
//
// Motion is 200 ms on cubic-bezier(.2,.9,.2,1), scale/opacity/parallax only, and every loop pauses while the
// window is hidden or unfocused. Boot/launch/return live in garrison-theme-motion.js (the shared gMotion table).
//
// Optional, never required: %APPDATA%\xbox-preview-ui\theme-packs\ps5\ may contain music/menu.mp3|ogg|wav (read
// through the audio engine's PS5 slot) and background.png|jpg (an ambient fallback for games with no wide art).
(() => {
  'use strict';
  const THEME = 'ps5';
  const theme = () => document.body.dataset.gTheme || 'helix';
  const on = () => theme() === THEME;
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])));
  const gRow = (items) => window.gGlyphs?.row?.(THEME, items) || '';
  const homePrompts = () => window.gGlyphs?.prompts?.[THEME]?.home || [];
  const play = kind => { try { return window.gAudio?.play?.(kind); } catch { return false; } };
  const focusEl = el => { if (!el) return; try { if (typeof setFocusedElement === 'function') setFocusedElement(el, { scroll: false }); else el.focus?.({ preventScroll: true }); } catch { /* Focus is optional. */ } };
  const motionMs = (which = 'page') => window.gMotion?.ms?.(which) || 200;
  const reducedMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => new Date();
  const time = () => window.gSettings?.formatClock ? window.gSettings.formatClock(now()) : now().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const playerName = () => state.displayName || document.querySelector('#dashboard-player-name')?.textContent || 'Player';
  const avatar = () => document.querySelector('#profile-avatar')?.innerHTML || '';
  const cover = game => game?.artwork?.tile || game?.artwork?.grid || '';
  const cssUrl = value => value ? `url("${String(value).replaceAll('"', '%22')}")` : 'none';
  const findGame = id => (state.games || []).find(game => game.id === id);
  const homeList = () => (typeof homeRecentGames === 'function' ? homeRecentGames() : []).filter(game => !game.isApp);
  const lastPlayed = game => typeof lastPlayedAt === 'function' ? Number(lastPlayedAt(game)) || 0 : Math.max(Number(game?.steamLastPlayed) || 0, Number(game?.lastPlayed) || 0);
  const playedText = game => {
    const minutes = Number(game?.steamPlaytimeMinutes) || 0;
    if (!minutes) return '';
    const hours = minutes / 60;
    return hours >= 10 ? `${Math.round(hours)} h` : hours >= 1 ? `${hours.toFixed(1).replace(/\.0$/, '')} h` : `${Math.round(minutes)} min`;
  };
  const lastPlayedText = game => { const at = lastPlayed(game); return at ? relativeTime(at) : ''; };

  // ---------- Our own line icons (no console artwork) ----------
  const svg = body => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  const P5_ICON = {
    play: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5Z" fill="currentColor"/></svg>`,
    trophy: svg('<path d="M8 4h8v4a4 4 0 0 1-8 0Z"/><path d="M8 5H5v2a3 3 0 0 0 3 3M16 5h3v2a3 3 0 0 1-3 3"/><path d="M12 12v4M9 20h6M10 20v-2h4v2"/>'),
    photo: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m5 17 5-5 4 4 2-2 3 3"/>'),
    bell: svg('<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10Z"/><path d="M10 19a2 2 0 0 0 4 0"/>'),
    volume: svg('<path d="M4 9.5h4l5-4v13l-5-4H4Z"/><path d="M16 9a4 4 0 0 1 0 6"/><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11"/>'),
    mute: svg('<path d="M4 9.5h4l5-4v13l-5-4H4Z"/><path d="m16.5 9 5 6M21.5 9l-5 6"/>'),
    wifi: svg('<path d="M4 9a12 12 0 0 1 16 0"/><path d="M7 12.5a8 8 0 0 1 10 0"/><path d="M10 16a3.5 3.5 0 0 1 4 0"/><circle cx="12" cy="19" r=".8" fill="currentColor" stroke="none"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/>'),
    person: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    power: svg('<path d="M12 4v8"/><path d="M7 6.5a7 7 0 1 0 10 0"/>'),
    chevron: svg('<path d="m9 5 7 7-7 7"/>'),
    capture: svg('<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="m8 6 1.5-2h5L16 6"/> <circle cx="12" cy="12" r="3"/>')
  };
  const p5icon = name => P5_ICON[name] || P5_ICON.settings;

  // ---------- Host elements ----------
  const host = document.createElement('section');
  host.id = 'g-ps5';
  host.setAttribute('aria-label', 'PlayStation 5 home');
  document.querySelector('#home-view')?.prepend(host);
  const chrome = document.createElement('div');
  chrome.id = 'g-ps5-chrome';
  document.body.append(chrome);
  const overlay = document.createElement('section');
  overlay.id = 'g-ps5-overlay';
  overlay.hidden = true;
  overlay.setAttribute('aria-label', 'PlayStation 5');
  document.body.append(overlay);

  // ---------- State ----------
  let list = [];
  let sel = 0;
  let area = 'row';
  let mode = '';
  let modeParent = '';
  let hubGameId = '';
  let builtKey = '';
  let ambFront = 1, ambWanted = '';
  let hostPaused = false;
  let clockTimer = 0, refreshTimer = 0;
  let ccFocus = 0, ccValues = { volume: null, muted: false, wifi: '', battery: '', alerts: 0 };
  let ccRefresh = 0;
  const achievementCache = new Map();
  let captures = null, capturesPromise = null;
  let optionalBackground = '';

  function achievements(game) {
    if (!game || !window.launcher?.getGameAchievements) return Promise.resolve(null);
    if (!achievementCache.has(game.id)) {
      achievementCache.set(game.id, window.launcher.getGameAchievements(game.id).then(result => {
        const items = result?.items || [];
        const total = Number(result?.totalAvailable) || items.length;
        const unlocked = Number(result?.unlockedCount) || items.filter(item => item.unlocked).length;
        return { items, total, unlocked, source: result?.source || '', available: total > 0 };
      }).catch(() => null));
    }
    return achievementCache.get(game.id);
  }
  function achievementText(info) {
    if (!info || !info.total) return 'Achievements unavailable';
    return `${info.unlocked} of ${info.total} · ${Math.round((info.unlocked / info.total) * 100)}%`;
  }
  function loadCaptures() {
    if (captures || capturesPromise || !window.launcher?.listCaptures) return capturesPromise;
    capturesPromise = Promise.all(homeList().slice(0, 6).map(game => window.launcher.listCaptures(game.id)
      .then(result => (Array.isArray(result) ? result : result?.items || []).map(item => ({ ...item, game })))
      .catch(() => []))).then(lists => {
      captures = lists.flat().slice(0, 40);
      updateCapturesCard();
      return captures;
    }).catch(() => { captures = []; return captures; });
    return capturesPromise;
  }

  // ---------- Home: row, selection, ambient and Activity Cards ----------
  function rootMarkup() {
    host.innerHTML = `<i class="p5-amb p5-amb-a" aria-hidden="true"></i><i class="p5-amb p5-amb-b" aria-hidden="true"></i>
      <i class="p5-grain" aria-hidden="true"></i><i class="p5-dust" aria-hidden="true"></i>
      <div class="p5-home">
        <div class="p5-row" role="list" aria-label="Recent games"></div>
        <div class="p5-title-wrap"><h1 class="p5-title"></h1><p class="p5-subtitle"></p></div>
        <div class="p5-cards" role="group" aria-label="Activity Cards"></div>
      </div>`;
    builtKey = '';
  }
  function renderHome() {
    if (!on()) { teardown(); return; }
    document.body.classList.add('g-ps5');
    document.body.classList.toggle('home-active', state.view === 'home');
    list = homeList().slice(0, 8);
    if (!host.querySelector('.p5-row')) rootMarkup();
    if (!list.length) {
      host.querySelector('.p5-row').innerHTML = '';
      host.querySelector('.p5-title').textContent = 'No games yet';
      host.querySelector('.p5-subtitle').textContent = 'Your installed games appear here once the library has been read.';
      host.querySelector('.p5-cards').innerHTML = `<button class="p5-card p5-card-action focusable" type="button" data-action="settings">${p5icon('settings')}<span class="p5-card-copy"><strong>Settings</strong><small>Add or import games</small></span></button>`;
      host.querySelector('.p5-title-wrap').hidden = false;
      updateChrome();
      focusEl(host.querySelector('.p5-card'));
      return;
    }
    sel = Math.max(0, Math.min(sel, list.length - 1));
    // The key carries a cheap signature of the artwork, not just the ids: the launcher paints covers after the
    // first library read, and a row built before that must be rebuilt with its images.
    const artSignature = art => { const value = String(art || ''); return `${value.length}:${value.slice(-18)}`; };
    const key = list.map(game => `${game.id}@${artSignature(cover(game))}`).join('|');
    const row = host.querySelector('.p5-row');
    if (key !== builtKey) {
      builtKey = key;
      host.dataset.p5Art = '';
      ambWanted = '';
      row.innerHTML = list.map((game, index) => {
        const art = cover(game);
        const letter = (game.title || '?').trim().charAt(0).toUpperCase();
        return `<button class="p5-tile focusable${index === sel ? ' sel' : ''}" type="button" role="listitem" data-action="g-ps5-tile" data-ps5-index="${index}" data-game-id="${esc(game.id)}" aria-label="${esc(game.title)}" style="--p5-cover:${cssUrl(art)}">
          <span class="p5-tile-art">${art ? `<img src="${esc(art)}" alt="" draggable="false" loading="lazy" />` : `<span class="p5-tile-letter" aria-hidden="true">${esc(letter)}</span>`}</span>
          <span class="p5-tile-gloss" aria-hidden="true"></span>
        </button>`;
      }).join('');
    }
    [...row.children].forEach((el, index) => el.classList.toggle('sel', index === sel));
    applySelection({ focus: false, force: true });
    updateChrome();
    scheduleAmbient(list[sel]);
    loadCaptures();
    if (!overlay.hidden || mode) return;
    if (!host.inert && !host.contains(document.activeElement) && !chrome.contains(document.activeElement) && document.body.classList.contains('home-active')) focusEl(row.children[sel]);
  }
  function teardown() {
    host.innerHTML = '';
    host.removeAttribute('inert');
    chrome.innerHTML = '';
    overlay.hidden = true;
    overlay.innerHTML = '';
    mode = '';
    modeParent = '';
    builtKey = '';
    list = [];
    sel = 0;
    area = 'row';
    document.body.classList.remove('g-ps5', 'p5-overlay-open');
    clearInterval(clockTimer); clockTimer = 0;
  }
  function updateChrome() {
    if (!chrome.querySelector('.p5-status')) {
      chrome.innerHTML = `<div class="p5-status"><time class="p5-clock"></time><button class="p5-me focusable" type="button" data-action="g-ps5-me" aria-label="Control Center"><span class="p5-avatar">${avatar()}</span><i class="p5-me-ring" aria-hidden="true"></i></button></div>
        <div class="p5-chrome-hints">${gRow(homePrompts())}</div>`;
      clockTimer ||= setInterval(() => { if (on() && !document.hidden) updateChrome(); }, 15000);
    }
    const clock = chrome.querySelector('.p5-clock');
    if (clock) clock.textContent = time();
    const avatarBox = chrome.querySelector('.p5-avatar');
    if (avatarBox && avatarBox.innerHTML !== avatar()) avatarBox.innerHTML = avatar();
    const hints = chrome.querySelector('.p5-chrome-hints');
    if (hints && !hints.firstElementChild) hints.innerHTML = gRow(homePrompts());
    chrome.querySelector('.p5-me')?.setAttribute('aria-label', `Control Center · ${playerName()}`);
  }
  function anchorFor(index, count) {
    const raw = (index - (count - 1) / 2) * (196 + 28);
    return Math.max(-330, Math.min(330, raw));
  }
  function applySelection({ focus = false, force = false } = {}) {
    if (!list.length) return;
    const game = list[sel];
    host.style.setProperty('--p5-anchor', String(anchorFor(sel, list.length)));
    [...host.querySelectorAll('.p5-tile')].forEach((el, index) => el.classList.toggle('sel', index === sel));
    const title = host.querySelector('.p5-title'), sub = host.querySelector('.p5-subtitle');
    if (title) title.textContent = game.title;
    if (sub) {
      const parts = [];
      if (playedText(game)) parts.push(`Played ${playedText(game)}`);
      const when = lastPlayedText(game);
      if (when) parts.push(`Last played ${when}`);
      sub.textContent = parts.join(' · ') || (game.installed === false ? 'Not installed' : 'Ready to play');
    }
    renderCards(game);
    if (force) scheduleAmbient(game);
    if (focus && !mode && overlay.hidden) focusEl(host.querySelector('.p5-tile.sel'));
  }
  function renderCards(game) {
    const cards = host.querySelector('.p5-cards');
    if (!cards) return;
    const when = lastPlayedText(game);
    const continueSub = [playedText(game) ? `Played ${playedText(game)}` : 'Ready to play', when ? `Last played ${when}` : ''].filter(Boolean).join(' · ');
    const info = achievementCache.get(game?.id);
    const trophySub = info ? achievementText(info) : 'Checking your trophies…';
    const percent = info && info.total ? Math.round((info.unlocked / info.total) * 100) : 0;
    const captureCount = captures ? captures.filter(item => item.game?.id === game?.id).length : null;
    const captureSub = captureCount === null ? 'Screenshots and clips' : captureCount ? `${captureCount} from this game` : 'No captures yet';
    cards.innerHTML = `
      <button class="p5-card p5-card-continue focusable" type="button" data-action="g-ps5-continue" data-card="0" aria-label="Continue ${esc(game.title)}">
        <span class="p5-card-icon" aria-hidden="true">${p5icon('play')}</span>
        <span class="p5-card-copy"><strong>Continue</strong><small>${esc(continueSub)}</small></span>
        <span class="p5-card-chevron" aria-hidden="true">${p5icon('chevron')}</span>
      </button>
      <button class="p5-card p5-card-trophies focusable" type="button" data-action="g-ps5-trophies" data-card="1" aria-label="Trophies, ${esc(trophySub)}">
        <span class="p5-card-icon" aria-hidden="true">${p5icon('trophy')}</span>
        <span class="p5-card-copy"><strong>Trophies</strong><small data-p5-trophy-text>${esc(trophySub)}</small></span>
        <span class="p5-card-meter" aria-hidden="true"><i data-p5-trophy-bar style="width:${percent}%"></i></span>
      </button>
      <button class="p5-card p5-card-captures focusable" type="button" data-action="g-ps5-captures" data-card="2" aria-label="Captures, ${esc(captureSub)}">
        <span class="p5-card-icon" aria-hidden="true">${p5icon('photo')}</span>
        <span class="p5-card-copy"><strong>Captures</strong><small data-p5-capture-text>${esc(captureSub)}</small></span>
        <span class="p5-card-chevron" aria-hidden="true">${p5icon('chevron')}</span>
      </button>`;
    if (game) achievements(game).then(result => {
      if (!on() || list[sel]?.id !== game.id) return;
      const node = host.querySelector('[data-p5-trophy-text]');
      if (node) node.textContent = achievementText(result);
      const bar = host.querySelector('[data-p5-trophy-bar]');
      if (bar) bar.style.width = result && result.total ? `${Math.round((result.unlocked / result.total) * 100)}%` : '0%';
    });
  }
  function updateCapturesCard() {
    if (!on() || !list.length) return;
    const node = host.querySelector('[data-p5-capture-text]');
    if (!node) return;
    const game = list[sel];
    const count = (captures || []).filter(item => item.game?.id === game?.id).length;
    node.textContent = count ? `${count} from this game` : 'No captures yet';
  }

  // Two ambient layers crossfade as the selection moves; the art is blurred, dimmed and slowly drifting. The
  // layer keeps the last successful art for a game it already shows, so moving quickly never puts an older
  // game's art on top of the wanted one.
  function scheduleAmbient(game) {
    if (!game) return;
    const id = game.id;
    if (host.dataset.p5Art === id) { ambWanted = id; return; }
    if (ambWanted === id) return;
    ambWanted = id;
    const commit = src => {
      if (ambWanted !== id) return;
      const layers = host.querySelectorAll('.p5-amb');
      if (layers.length < 2) return;
      if (!src) src = optionalBackground || cover(game);
      host.dataset.p5Art = id;
      const next = 1 - ambFront;
      layers[next].style.backgroundImage = src ? cssUrl(src) : 'none';
      layers[next].classList.toggle('on', Boolean(src));
      layers[ambFront].classList.remove('on');
      ambFront = next;
    };
    if (window.gWideArt) window.gWideArt(game).then(src => commit(src || '')).catch(() => commit(''));
    else commit('');
  }
  function probeOptionalBackground() {
    if (optionalBackground) return;
    window.launcher?.getRetroPack?.().then(pack => {
      const base = pack?.base;
      if (!base) return;
      (async () => {
        for (const name of ['background.jpg', 'background.png', 'background.jpeg']) {
          try {
            const response = await fetch(`${base}ps5/${name}`);
            if (response.ok) { optionalBackground = `${base}ps5/${name}`; if (on() && list[sel]) scheduleAmbient(list[sel]); return; }
          } catch { /* The optional folder is allowed to be absent. */ }
        }
      })();
    }).catch(() => {});
  }
  probeOptionalBackground();

  // ---------- Navigation on Home ----------
  function ps5Move(direction) {
    if (!on() || state.view !== 'home') return false;
    if (mode === 'cc') return ccMove(direction);
    if (mode) return false; // Hub, trophies and captures use the launcher's spatial focus.
    if (document.querySelector('dialog[open]')) return false;
    if (!list.length) return false;
    if (area === 'row') {
      if (direction === 'left' || direction === 'right') {
        const next = Math.max(0, Math.min(list.length - 1, sel + (direction === 'right' ? 1 : -1)));
        if (next === sel) return false;
        sel = next;
        applySelection();
        focusEl(host.querySelector('.p5-tile.sel'));
        return true;
      }
      if (direction === 'up') { area = 'me'; focusEl(chrome.querySelector('.p5-me')); return true; }
      if (direction === 'down') { area = 'cards'; focusEl(host.querySelector('.p5-card')); return true; }
      return false;
    }
    if (area === 'cards') {
      const cards = [...host.querySelectorAll('.p5-card.focusable')];
      const index = Math.max(0, cards.indexOf(document.activeElement.closest?.('.p5-card')));
      if (direction === 'up') { area = 'row'; focusEl(host.querySelector('.p5-tile.sel')); return true; }
      if (direction === 'left' || direction === 'right') {
        const next = cards[Math.max(0, Math.min(cards.length - 1, index + (direction === 'right' ? 1 : -1)))];
        if (!next || next === cards[index]) return false;
        focusEl(next);
        return true;
      }
      return false;
    }
    if (area === 'me') {
      if (direction === 'down') { area = 'row'; focusEl(host.querySelector('.p5-tile.sel')); return true; }
      return false;
    }
    return false;
  }

  // ---------- Control Center ----------
  function ccItems() {
    return [
      { id: 'profile', icon: 'person', label: playerName(), sub: 'Profile', action: 'g-ps5-cc-profile' },
      { id: 'notifications', icon: 'bell', label: 'Notifications', sub: ccValues.alerts ? `${ccValues.alerts} new` : 'Up to date', action: 'g-ps5-cc-notifications' },
      { id: 'sound', icon: ccValues.muted ? 'mute' : 'volume', label: ccValues.muted ? 'Muted' : (ccValues.volume == null ? 'Sound' : `${ccValues.volume}%`), sub: 'Sound', action: 'g-ps5-cc-sound' },
      { id: 'network', icon: 'wifi', label: ccValues.wifi || 'Network', sub: 'Network', action: 'g-ps5-cc-network' },
      { id: 'settings', icon: 'settings', label: 'Settings', sub: 'System', action: 'g-ps5-cc-settings' },
      { id: 'power', icon: 'power', label: 'Power', sub: 'Turn off', action: 'g-ps5-cc-power' }
    ];
  }
  function renderControlCenter() {
    const volume = ccValues.volume == null ? 0 : ccValues.volume;
    overlay.dataset.mode = 'cc';
    overlay.innerHTML = `<div class="p5-cc-scrim" aria-hidden="true"></div>
      <div class="p5-cc" role="group" aria-label="Control Center">
        <div class="p5-cc-bar">${ccItems().map((item, index) => `<button class="p5-cc-item focusable${index === ccFocus ? ' sel' : ''}" type="button" data-action="${item.action}" data-cc="${item.id}" data-cc-index="${index}" aria-label="${esc(item.label)}, ${esc(item.sub)}">
          <span class="p5-cc-icon${item.id === 'profile' ? ' p5-cc-avatar' : ''}" aria-hidden="true">${item.id === 'profile' ? (avatar() || p5icon('person')) : p5icon(item.icon)}</span>
          <span class="p5-cc-copy"><strong>${esc(item.label)}</strong><small>${esc(item.sub)}</small></span>
          ${item.id === 'sound' ? `<span class="p5-cc-meter" aria-hidden="true"><i style="width:${ccValues.muted ? 0 : volume}%"></i></span>` : ''}
          ${item.id === 'notifications' && ccValues.alerts ? `<span class="p5-cc-badge" aria-hidden="true">${ccValues.alerts}</span>` : ''}
        </button>`).join('')}</div>
        <div class="p5-cc-foot"><span class="p5-cc-hints">${gRow([{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Close' }])}</span></div>
      </div>`;
    [...overlay.querySelectorAll('.p5-cc-item')].forEach((el, index) => el.classList.toggle('sel', index === ccFocus));
    focusEl(overlay.querySelectorAll('.p5-cc-item')[ccFocus]);
  }
  function readControlValues() {
    const settings = window.gSettings;
    if (!settings) return;
    const token = ++ccRefresh;
    Promise.all([
      settings.get('volume').catch(() => null), settings.get('mute').catch(() => null),
      settings.get('wifi').catch(() => null), settings.get('battery').catch(() => null)
    ]).then(([volume, muted, wifi, battery]) => {
      if (token !== ccRefresh) return;
      ccValues.volume = Number.isFinite(Number(volume)) ? Number(volume) : null;
      ccValues.muted = Boolean(muted);
      ccValues.wifi = wifi ? String(wifi) : '';
      ccValues.battery = battery ? String(battery) : '';
      ccValues.alerts = (state.gFriends?.online || 0) + (window.gDownloads?.active?.length || 0);
      if (mode === 'cc') renderControlCenter();
    });
  }
  function openControlCenter() {
    if (!on()) return false;
    mode = 'cc'; modeParent = '';
    area = 'row';
    ccFocus = 0;
    overlay.hidden = false;
    document.body.classList.add('p5-overlay-open');
    host.inert = true; chrome.inert = true;
    play('confirm');
    renderControlCenter();
    readControlValues();
    return true;
  }
  function setVolume(next) {
    const value = Math.max(0, Math.min(100, Math.round(next / 5) * 5));
    if (ccValues.volume === value) return false;
    ccValues.volume = value;
    if (ccValues.muted) { ccValues.muted = false; window.gSettings?.set('mute', false).catch(() => {}); }
    window.gSettings?.set('volume', value).catch(() => {});
    play('navigate');
    renderControlCenter();
    return true;
  }
  function ccMove(direction) {
    const items = [...overlay.querySelectorAll('.p5-cc-item')];
    if (!items.length) return false;
    const focused = items[ccFocus];
    if (focused?.dataset.cc === 'sound' && (direction === 'up' || direction === 'down')) {
      const base = ccValues.volume == null ? 50 : ccValues.volume;
      return setVolume(base + (direction === 'up' ? 5 : -5));
    }
    if (direction === 'up') { closeOverlay(); return true; }
    if (direction === 'left' || direction === 'right') {
      const next = Math.max(0, Math.min(items.length - 1, ccFocus + (direction === 'right' ? 1 : -1)));
      if (next === ccFocus) return false;
      ccFocus = next;
      items.forEach((el, index) => el.classList.toggle('sel', index === ccFocus));
      focusEl(items[ccFocus]);
      return true;
    }
    return false;
  }

  // ---------- Game Hub ----------
  function openHub(gameId) {
    const game = findGame(gameId) || list.find(item => item.id === gameId);
    if (!game) return false;
    hubGameId = game.id;
    mode = 'hub'; modeParent = '';
    area = 'row';
    overlay.hidden = false;
    document.body.classList.add('p5-overlay-open');
    host.inert = true; chrome.inert = true;
    play('confirm');
    renderHub();
    loadHubDetails(game);
    return true;
  }
  function hubHero(game) {
    return new Promise(resolve => {
      if (!game) return resolve('');
      if (window.gWideArt) window.gWideArt(game).then(src => resolve(src || cover(game) || '')).catch(() => resolve(cover(game) || ''));
      else resolve(cover(game) || '');
    });
  }
  function renderHub() {
    const game = findGame(hubGameId);
    if (!game) { closeOverlay(); return; }
    const when = lastPlayedText(game);
    const info = achievementCache.get(game.id);
    const percent = info && info.total ? Math.round((info.unlocked / info.total) * 100) : 0;
    const related = homeList().filter(item => item.id !== game.id).slice(0, 4);
    overlay.dataset.mode = 'hub';
    overlay.innerHTML = `<div class="p5-hub">
      <div class="p5-hub-hero" data-p5-hero aria-hidden="true"></div>
      <div class="p5-hub-shade" aria-hidden="true"></div>
      <div class="p5-hub-top"><button class="p5-hub-back focusable" type="button" data-action="g-ps5-back" aria-label="Back to Home">${p5icon('chevron')}</button><span class="p5-hub-clock">${esc(time())}</span></div>
      <div class="p5-hub-body">
        <div class="p5-hub-head"><img class="p5-hub-logo" alt="" hidden /><h1>${esc(game.title)}</h1><p>${esc([playedText(game) ? `Played ${playedText(game)}` : '', when ? `Last played ${when}` : ''].filter(Boolean).join(' · ') || game.provider || '')}</p></div>
        <div class="p5-hub-actions"><button class="p5-hub-play focusable" type="button" data-action="g-ps5-hub-play">${p5icon('play')}<span>${state.activeGameSession?.gameId === game.id ? 'Resume' : 'Play'}</span></button>
          <button class="p5-hub-detail focusable" type="button" data-action="g-ps5-hub-details">Game details</button></div>
        <div class="p5-hub-progress" aria-label="Progress">
          <div class="p5-hub-stat"><small>Play time</small><strong>${esc(playedText(game) || '—')}</strong></div>
          <div class="p5-hub-stat"><small>Last played</small><strong>${esc(when || '—')}</strong></div>
          <div class="p5-hub-stat"><small>Trophies</small><strong data-p5-hub-trophy>${esc(achievementText(info))}</strong><span class="p5-hub-meter" aria-hidden="true"><i data-p5-hub-bar style="width:${percent}%"></i></span></div>
        </div>
        <div class="p5-hub-section"><div class="p5-hub-section-head"><h2>Trophies</h2><button class="p5-hub-more focusable" type="button" data-action="g-ps5-hub-trophies">View all</button></div>
          <div class="p5-hub-ach" data-p5-hub-ach>${hubAchievementsMarkup(info)}</div></div>
        <div class="p5-hub-section"><div class="p5-hub-section-head"><h2>Related</h2></div>
          <div class="p5-hub-related">${related.map(item => `<button class="p5-hub-related-tile focusable" type="button" data-action="g-ps5-hub-related" data-game-id="${esc(item.id)}" aria-label="${esc(item.title)}"><span class="p5-hub-related-art" style="--p5-cover:${cssUrl(cover(item))}">${cover(item) ? `<img src="${esc(cover(item))}" alt="" />` : esc((item.title || '?').charAt(0))}</span><small>${esc(item.title)}</small></button>`).join('') || '<p class="p5-hub-note">No other recent games yet.</p>'}</div></div>
      </div>
      <div class="p5-hub-hints">${gRow([{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Back' }, { button: '@options', label: 'Options' }])}</div>
    </div>`;
    hubHero(game).then(src => {
      const hero = overlay.querySelector('[data-p5-hero]');
      if (hero && src && mode === 'hub') hero.style.backgroundImage = cssUrl(src);
    });
    if (window.launcher?.getGameLogo) window.launcher.getGameLogo(game.id).then(logo => {
      if (!logo || mode !== 'hub' || hubGameId !== game.id) return;
      const img = overlay.querySelector('.p5-hub-logo');
      const heading = overlay.querySelector('.p5-hub-head h1');
      if (!img || !heading) return;
      img.onload = () => { img.hidden = false; heading.hidden = true; };
      img.src = logo;
    }).catch(() => {});
    focusEl(overlay.querySelector('.p5-hub-play'));
  }
  function hubAchievementsMarkup(info) {
    if (!info || !info.items?.length) return `<p class="p5-hub-note">No trophy data for this game yet.</p>`;
    return info.items.slice(0, 3).map(item => `<div class="p5-hub-ach-row${item.unlocked ? ' on' : ''}"><span class="p5-hub-ach-icon" aria-hidden="true">${item.unlocked && (item.icon) ? `<img src="${esc(item.icon)}" alt="" />` : p5icon('trophy')}</span><span class="p5-hub-ach-copy"><strong>${esc(item.title || 'Trophy')}</strong><small>${esc(item.description || (item.unlocked ? 'Earned' : 'Not yet earned'))}</small></span>${item.unlocked ? '<b class="p5-hub-ach-state">Earned</b>' : ''}</div>`).join('');
  }
  function loadHubDetails(game) {
    if (!game) return;
    achievements(game).then(info => {
      if (mode !== 'hub' || hubGameId !== game.id) return;
      const text = overlay.querySelector('[data-p5-hub-trophy]');
      if (text) text.textContent = achievementText(info);
      const bar = overlay.querySelector('[data-p5-hub-bar]');
      if (bar) bar.style.width = info && info.total ? `${Math.round((info.unlocked / info.total) * 100)}%` : '0%';
      const slot = overlay.querySelector('[data-p5-hub-ach]');
      if (slot) slot.innerHTML = hubAchievementsMarkup(info);
    });
  }

  // ---------- Trophies and Captures ----------
  function openTrophies(gameId, parent = '') {
    const game = findGame(gameId) || list.find(item => item.id === gameId);
    if (!game) return false;
    hubGameId = game.id;
    mode = 'trophies';
    modeParent = parent || (mode === 'hub' ? 'hub' : '');
    overlay.hidden = false;
    document.body.classList.add('p5-overlay-open');
    host.inert = true; chrome.inert = true;
    play('confirm');
    overlay.dataset.mode = 'trophies';
    overlay.innerHTML = `<div class="p5-panel"><i class="p5-panel-art" aria-hidden="true"></i><div class="p5-panel-top"><button class="p5-panel-back focusable" type="button" data-action="g-ps5-back" aria-label="Back">${p5icon('chevron')}</button><span class="p5-panel-kicker">Trophies</span><span class="p5-panel-clock">${esc(time())}</span></div>
      <div class="p5-panel-head"><h1>${esc(game.title)}</h1><p data-p5-panel-progress>Reading your trophies…</p><span class="p5-panel-meter" aria-hidden="true"><i data-p5-panel-bar></i></span></div>
      <div class="p5-panel-list" data-p5-panel-list><p class="p5-panel-note">Reading your trophies…</p></div>
      <div class="p5-panel-hints">${gRow([{ button: '@back', label: 'Back' }])}</div></div>`;
    hubHero(game).then(src => { const art = overlay.querySelector('.p5-panel-art'); if (art && src && mode === 'trophies') art.style.backgroundImage = cssUrl(src); });
    focusEl(overlay.querySelector('.p5-panel-back'));
    achievements(game).then(info => {
      if (mode !== 'trophies' || hubGameId !== game.id) return;
      const progress = overlay.querySelector('[data-p5-panel-progress]');
      if (progress) progress.textContent = info?.total ? `${info.unlocked} of ${info.total} earned · ${Math.round((info.unlocked / info.total) * 100)}%${info.source ? ` · ${info.source}` : ''}` : 'Achievements are not available for this game on this PC.';
      const bar = overlay.querySelector('[data-p5-panel-bar]');
      if (bar) bar.style.width = info?.total ? `${Math.round((info.unlocked / info.total) * 100)}%` : '0%';
      const panel = overlay.querySelector('[data-p5-panel-list]');
      if (!panel) return;
      panel.innerHTML = info?.items?.length
        ? info.items.map(item => `<div class="p5-trophy${item.unlocked ? ' on' : ''}"><span class="p5-trophy-icon" aria-hidden="true">${item.unlocked && item.icon ? `<img src="${esc(item.icon)}" alt="" />` : p5icon('trophy')}</span><span class="p5-trophy-copy"><strong>${esc(item.title || 'Trophy')}</strong><small>${esc(item.description || (item.unlocked ? 'Earned' : 'Not yet earned'))}</small></span><span class="p5-trophy-state">${item.unlocked ? 'Earned' : item.rarity != null ? `${Number(item.rarity).toFixed(0)}%` : ''}</span></div>`).join('')
        : `<p class="p5-panel-note">${esc(info?.source || 'No trophies have been recorded for this game yet.')}</p>`;
    });
    return true;
  }
  function openCaptures() {
    mode = 'captures';
    modeParent = '';
    overlay.hidden = false;
    document.body.classList.add('p5-overlay-open');
    host.inert = true; chrome.inert = true;
    play('confirm');
    overlay.dataset.mode = 'captures';
    overlay.innerHTML = `<div class="p5-panel"><i class="p5-panel-art" aria-hidden="true"></i><div class="p5-panel-top"><button class="p5-panel-back focusable" type="button" data-action="g-ps5-back" aria-label="Back">${p5icon('chevron')}</button><span class="p5-panel-kicker">Captures</span><span class="p5-panel-clock">${esc(time())}</span></div>
      <div class="p5-panel-head"><h1>Screenshots and clips</h1><p>From your recent games</p></div>
      <div class="p5-panel-list p5-capture-grid" data-p5-capture-grid><p class="p5-panel-note">Finding your captures…</p></div>
      <div class="p5-panel-hints">${gRow([{ button: '@confirm', label: 'Open' }, { button: '@back', label: 'Back' }])}</div></div>`;
    const current = list[sel];
    if (current) hubHero(current).then(src => { const art = overlay.querySelector('.p5-panel-art'); if (art && src && mode === 'captures') art.style.backgroundImage = cssUrl(src); });
    focusEl(overlay.querySelector('.p5-panel-back'));
    loadCaptures();
    (capturesPromise || Promise.resolve(captures || [])).then(items => {
      if (mode !== 'captures') return;
      const grid = overlay.querySelector('[data-p5-capture-grid]');
      if (!grid) return;
      if (!items?.length) {
        grid.innerHTML = '<p class="p5-panel-note">No captures yet. Screenshots from Steam and clips from Game Bar appear here.</p>';
        const hints = overlay.querySelector('.p5-panel-hints');
        if (hints) hints.innerHTML = gRow([{ button: '@back', label: 'Back' }]);
        return;
      }
      grid.innerHTML = items.map(item => `<button class="p5-capture focusable" type="button" data-action="g-ps5-capture" data-game-id="${esc(item.game.id)}" data-index="${Number(item.index)}" data-capture-index="${Number(item.index)}" aria-label="${esc(item.name || 'Capture')} from ${esc(item.game.title)}">
        <span class="p5-capture-art">${item.thumb ? `<img src="${esc(item.thumb)}" alt="" />` : `<i class="p5-capture-ph" aria-hidden="true">${p5icon(item.kind === 'video' ? 'play' : 'photo')}</i>`}</span>
        <span class="p5-capture-copy"><strong>${esc(item.game.title)}</strong><small>${esc(item.kind === 'video' ? 'Video clip' : 'Screenshot')}${item.at ? ` · ${esc(relativeTime(Number(item.at)))}` : ''}</small></span>
      </button>`).join('');
      focusEl(grid.querySelector('.p5-capture') || overlay.querySelector('.p5-panel-back'));
    });
    return true;
  }

  // ---------- Overlay lifecycle ----------
  function closeOverlay({ focus = true, silent = false } = {}) {
    if (!mode) return false;
    mode = '';
    modeParent = '';
    overlay.hidden = true;
    overlay.innerHTML = '';
    document.body.classList.remove('p5-overlay-open');
    if (on()) { host.inert = false; chrome.inert = false; }
    if (!silent) play('back');
    if (focus) {
      const tile = host.querySelector('.p5-tile.sel');
      if (tile) { area = 'row'; focusEl(tile); }
    }
    return true;
  }
  function backToHub() {
    mode = 'hub';
    modeParent = '';
    overlay.hidden = false;
    document.body.classList.add('p5-overlay-open');
    host.inert = true; chrome.inert = true;
    renderHub();
    loadHubDetails(findGame(hubGameId));
    return true;
  }

  // ---------- Actions ----------
  function continueGame() {
    const game = list[sel];
    if (!game) return false;
    if (game.installed === false) { openHub(game.id); return true; }
    closeOverlay({ focus: false, silent: true });
    try {
      state.selectedGameId = game.id;
      if (typeof selectGame === 'function') selectGame(game.id, false, host.querySelector('.p5-tile.sel'));
    } catch { /* Selection is best effort. */ }
    play('launch');
    if (typeof launchSelectedGame === 'function') launchSelectedGame();
    return true;
  }
  function hubPlay() {
    const game = findGame(hubGameId);
    if (!game) return false;
    closeOverlay({ focus: false, silent: true });
    try {
      state.selectedGameId = game.id;
      if (typeof selectGame === 'function') selectGame(game.id, false);
    } catch { /* Optional. */ }
    play('launch');
    if (typeof launchSelectedGame === 'function') launchSelectedGame();
    return true;
  }
  function openOptions() {
    const game = list[sel];
    if (!game || typeof openGameOptions !== 'function') return false;
    if (!document.querySelector('#launch-overlay')?.hidden || document.querySelector('dialog[open]')) return false;
    play('confirm');
    openGameOptions(game.id);
    return true;
  }
  function handleAction(action, el) {
    const index = Number(el.dataset.ps5Index);
    switch (action) {
      case 'g-ps5-tile': if (Number.isFinite(index)) { sel = Math.max(0, Math.min(list.length - 1, index)); applySelection(); } openHub(el.dataset.gameId); return true;
      case 'g-ps5-me': openControlCenter(); return true;
      case 'g-ps5-continue': continueGame(); return true;
      case 'g-ps5-trophies': openTrophies(list[sel]?.id, ''); return true;
      case 'g-ps5-captures': openCaptures(); return true;
      case 'g-ps5-back': {
        if (mode === 'trophies' || mode === 'captures') { if (modeParent === 'hub') return backToHub(); }
        closeOverlay(); return true;
      }
      case 'g-ps5-hub-play': hubPlay(); return true;
      case 'g-ps5-hub-details': if (findGame(hubGameId)) { play('confirm'); const id = hubGameId; closeOverlay({ focus: false, silent: true }); if (typeof openGameDetails === 'function') openGameDetails(id); } return true;
      case 'g-ps5-hub-trophies': openTrophies(hubGameId, 'hub'); return true;
      case 'g-ps5-hub-related': if (el.dataset.gameId) { hubGameId = el.dataset.gameId; renderHub(); loadHubDetails(findGame(hubGameId)); } return true;
      case 'g-ps5-capture': if (el.dataset.gameId) { play('confirm'); const request = window.launcher?.openCapture?.(el.dataset.gameId, Number(el.dataset.index)); request?.catch?.(() => {}); } return true;
      case 'g-ps5-cc-profile': closeOverlay({ focus: false, silent: true }); window.gSettings?.set('profile', null).catch(() => {}); return true;
      case 'g-ps5-cc-notifications': closeOverlay({ focus: false, silent: true }); if (typeof performAction === 'function') performAction('g-notifications'); return true;
      case 'g-ps5-cc-sound': {
        const next = !ccValues.muted;
        ccValues.muted = next;
        window.gSettings?.set('mute', next).catch(() => {});
        play('confirm');
        renderControlCenter();
        readControlValues();
        return true;
      }
      case 'g-ps5-cc-network': closeOverlay({ focus: false, silent: true }); window.gShell?.open?.(THEME, { pageId: 'network' }); return true;
      case 'g-ps5-cc-settings': closeOverlay({ focus: false, silent: true }); if (typeof openSettings === 'function') openSettings(); return true;
      case 'g-ps5-cc-power': closeOverlay({ focus: false, silent: true }); if (typeof performAction === 'function') performAction('power-menu'); return true;
      default: return false;
    }
  }

  // ---------- Wiring ----------
  document.addEventListener('click', event => {
    if (!on()) return;
    const el = event.target.closest?.('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (!action.startsWith('g-ps5-')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleAction(action, el);
  }, true);

  document.addEventListener('focusin', event => {
    if (!on() || state.view !== 'home') return;
    const tile = event.target.closest?.('.p5-tile');
    if (tile) {
      area = 'row';
      const index = Number(tile.dataset.ps5Index);
      if (Number.isFinite(index) && index !== sel) { sel = index; applySelection(); }
      return;
    }
    if (event.target.closest?.('.p5-card')) { area = 'cards'; return; }
    if (event.target.closest?.('.p5-me')) { area = 'me'; return; }
  });

  if (typeof renderRecentGames === 'function') {
    const recentBase = renderRecentGames;
    renderRecentGames = function (...args) {
      const result = recentBase.apply(this, args);
      if (on() && state.view === 'home') renderHome();
      return result;
    };
  }
  if (typeof showView === 'function') {
    const viewBase = showView;
    showView = function (next, ...rest) {
      const result = viewBase.call(this, next, ...rest);
      if (!on()) return result;
      if (next !== 'home') { if (mode) closeOverlay({ focus: false, silent: true }); }
      else requestAnimationFrame(() => renderHome());
      return result;
    };
  }
  if (typeof navigateConsoleHome === 'function') {
    const homeBase = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (!on()) return homeBase.call(this, direction, focused);
      if (ps5Move(direction)) return true;
      return homeBase.call(this, direction, focused);
    };
  }
  if (typeof navigateBack === 'function') {
    const backBase = navigateBack;
    navigateBack = function (...args) {
      if (!on()) return backBase.apply(this, args);
      if (document.querySelector('dialog[open]') || !document.querySelector('#launch-overlay')?.hidden) return backBase.apply(this, args);
      if (mode === 'cc') { closeOverlay(); return true; }
      if (mode === 'trophies' || mode === 'captures') {
        if (modeParent === 'hub') return backToHub();
        closeOverlay(); return true;
      }
      if (mode === 'hub') { closeOverlay(); return true; }
      if (state.view === 'home' && area !== 'row') { area = 'row'; play('back'); focusEl(host.querySelector('.p5-tile.sel') || chrome.querySelector('.p5-me')); return true; }
      return backBase.apply(this, args);
    };
  }
  if (typeof performAction === 'function') {
    const performBase = performAction;
    performAction = async function (action, source) {
      if (on() && state.view === 'home') {
        if (action === 'g-account') { openControlCenter(); return true; }
        if (action === 'toggle-search' && !source) return openOptions();
      }
      return performBase.apply(this, arguments);
    };
  }
  document.addEventListener('g-setting-change', event => {
    if (!on()) return;
    const id = event.detail?.id, value = event.detail?.value;
    if (mode === 'cc') {
      // Use the committed value the registry just wrote: the hub stays truthful even on a machine whose
      // quick-settings read-back lags the write by a moment.
      if (id === 'volume') { ccValues.volume = Math.max(0, Math.min(100, Number(value) || 0)); renderControlCenter(); }
      else if (id === 'mute') { ccValues.muted = Boolean(value); renderControlCenter(); }
      else if (id === 'wifi' || id === 'battery') readControlValues();
    }
    if (['clockFormat', 'dateOrder', 'enterButton'].includes(id)) updateChrome();
  });
  document.addEventListener('g-settings-ready', () => { if (on()) { updateChrome(); if (mode === 'cc') readControlValues(); } });
  // Closing a launcher dialog (profile, power, a settings row) puts the focus back on the PS5 screen.
  document.addEventListener('close', event => {
    if (!on() || !event.target?.matches?.('dialog')) return;
    requestAnimationFrame(() => {
      if (!on()) return;
      if (mode === 'cc') { focusEl(overlay.querySelectorAll('.p5-cc-item')[ccFocus]); return; }
      if (state.view === 'home' && !mode) focusEl(host.querySelector('.p5-tile.sel') || chrome.querySelector('.p5-me'));
    });
  }, true);
  // Ambient loops and the clock pause while the window is hidden or unfocused (plan §0 rules 1 and 6).
  const setPaused = paused => {
    hostPaused = paused;
    host.dataset.paused = paused ? '1' : '0';
    if (paused) clearInterval(clockTimer), clockTimer = 0;
    else if (on()) updateChrome();
  };
  window.addEventListener('blur', () => setPaused(true));
  window.addEventListener('focus', () => setPaused(false));
  document.addEventListener('visibilitychange', () => setPaused(document.hidden || !document.hasFocus()));
  setPaused(document.hidden || !document.hasFocus());

  let refreshTimerHandle = 0;
  function scheduleRefresh(delay = 300) {
    if (!on() || refreshTimerHandle) return;
    refreshTimerHandle = setTimeout(() => {
      refreshTimerHandle = 0;
      if (!on() || state.view !== 'home' || document.querySelector('dialog[open]') || mode) return;
      renderHome();
    }, delay);
  }
  window.launcher?.onLibraryArtwork?.(() => scheduleRefresh());
  window.launcher?.onLibraryInitial?.(() => scheduleRefresh(600));

  let renderedTheme = '';
  new MutationObserver(() => {
    const id = theme();
    if (id === THEME) {
      if (renderedTheme !== THEME) { renderedTheme = THEME; renderHome(); }
      else if (!mode) renderHome();
    } else {
      renderedTheme = '';
      teardown();
    }
  }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });

  // The launcher's prefs whitelist (main.cjs) predates this ninth theme, and this task may not edit main.cjs.
  // Until that one-word whitelist entry lands, remember the PS5 selection in localStorage so choosing it survives
  // a restart: garrison-themes.js applies the theme saved by the main process a moment after start-up, and this
  // re-applies PS5 only when the player has not touched anything. A real theme change writes localStorage too, so
  // switching away is never undone.
  let interacted = false;
  for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, () => { interacted = true; }, true);
  try {
    if (localStorage.getItem('g-theme') === THEME) {
      setTimeout(() => {
        if (interacted || on()) return;
        if (localStorage.getItem('g-theme') !== THEME) return;
        try { window.gSetTheme?.(THEME); } catch { /* Optional. */ }
      }, 1800);
    }
  } catch { /* Storage unavailable. */ }

  if (on()) { renderedTheme = THEME; renderHome(); }
  window.gPs5 = {
    render: renderHome,
    openControlCenter,
    closeControlCenter: () => mode === 'cc' && closeOverlay(),
    openHub,
    openTrophies,
    openCaptures,
    hub: () => ({ mode, gameId: hubGameId }),
    control: () => ({ open: mode === 'cc', focus: ccFocus, values: { ...ccValues } }),
    achievementCache,
    captures: () => captures,
    mode: () => mode,
    play
  };
})();
