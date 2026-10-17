// Console extras shared by the Series, One and 360 themes.
//
//  - Accent colour: One and Series let you choose the dashboard colour; the 360 theme follows it too.
//  - Live Store and Game Pass data for the hubs (window.gHubData), loaded once per session.
//  - Notifications the consoles gave you: friends coming online, downloads starting and "ready to play",
//    achievements you unlocked while playing (shown when you come back, never over the game), and a
//    "welcome back" note with how long you played.
//  - The controller-disconnected screen, Quick Resume on the Series tile of a running game, favourites as
//    the One's Pins, and the 360's disc tray.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const isConsole = () => theme() !== 'helix';
  const toast = message => { if (typeof showToast === 'function') showToast(message); };
  // Notification toggles from the settings registry. A missing/loading registry keeps today's behaviour (on).
  const notifyOn = id => window.gSettings?.cached?.(id) !== false;
  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const write = (key, value) => { try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); } catch { /* Storage unavailable. */ } };

  // ---------- Accent colour ----------
  const ACCENTS = {
    one: [['#107c10', 'Green'], ['#60a917', 'Lime'], ['#00aba9', 'Teal'], ['#1ba1e2', 'Cyan'], ['#0050ef', 'Cobalt'], ['#6a00ff', 'Indigo'], ['#aa00ff', 'Violet'], ['#d80073', 'Magenta'], ['#e51400', 'Red'], ['#fa6800', 'Orange'], ['#e3c800', 'Yellow'], ['#825a2c', 'Brown'], ['#647687', 'Steel']],
    series: [['#107c10', 'Xbox green'], ['#0078d4', 'Blue'], ['#8764b8', 'Purple'], ['#c239b3', 'Pink'], ['#e74856', 'Red'], ['#ff8c00', 'Orange'], ['#00b7c3', 'Seafoam'], ['#7a7574', 'Storm']],
    x360: [['#6cb344', 'Xbox 360 green'], ['#1ba1e2', 'Blue'], ['#f09609', 'Orange'], ['#e51400', 'Red'], ['#a200ff', 'Purple'], ['#ff0097', 'Pink'], ['#8cbf26', 'Lime'], ['#00aba9', 'Teal']]
  };
  function applyAccent() {
    const list = ACCENTS[theme()];
    const value = read(`g-accent:${theme()}`);
    if (list && value && list.some(([hex]) => hex === value)) { document.body.style.setProperty('--g-accent', value); document.body.dataset.gAccent = '1'; }
    else { document.body.style.removeProperty('--g-accent'); delete document.body.dataset.gAccent; }
  }
  const accentSection = document.createElement('section');
  accentSection.className = 'g-setting-group g-accent-section';
  accentSection.innerHTML = '<h3>Colour</h3><p class="g-setting-note">The colour of your tiles, highlights and buttons.</p><div class="g-accent-options" role="radiogroup" aria-label="Colour"></div>';
  (document.querySelector('.g-bg-section') || document.querySelector('.g-theme-section'))?.after(accentSection);
  function renderAccents() {
    const list = ACCENTS[theme()];
    accentSection.hidden = !list;
    if (!list) return;
    const current = read(`g-accent:${theme()}`) || list[0][0];
    accentSection.querySelector('.g-accent-options').innerHTML = list.map(([hex, name]) => `<button class="g-accent-option focusable${hex === current ? ' on' : ''}" type="button" role="radio" aria-checked="${hex === current}" aria-label="${name}" title="${name}" data-g-accent="${hex}" style="--swatch:${hex}"></button>`).join('');
  }
  accentSection.addEventListener('click', event => {
    const option = event.target.closest('[data-g-accent]');
    if (!option) return;
    const list = ACCENTS[theme()];
    write(`g-accent:${theme()}`, option.dataset.gAccent === list[0][0] ? '' : option.dataset.gAccent);
    applyAccent(); renderAccents();
    setFocusedElement?.(accentSection.querySelector(`[data-g-accent="${option.dataset.gAccent}"]`), { scroll: false });
  });

  // ---------- Live Store and Game Pass data for the hubs ----------
  window.gHubData = { store: null, gamePass: null };
  let loading = false;
  async function loadStoreData() {
    if (loading || !isConsole()) return;
    loading = true;
    const [store, pass] = await Promise.all([window.launcher.getXboxStore?.().catch(() => null), window.launcher.getGamePassCatalog?.().catch(() => null)]);
    if (store?.status === 'ready') { window.gHubData.store = store; state.xboxStore ||= store; }
    if (Array.isArray(pass) && pass.length) { window.gHubData.gamePass = pass; state.gamePassCatalog ||= pass; }
    document.dispatchEvent(new CustomEvent('g-hub-data'));
  }

  // ---------- Friends coming online ----------
  let known = null, lastFriendToast = 0;
  function friendsChanged() {
    const online = new Map((state.gFriends?.friends || []).filter(friend => friend.state !== 'offline' && friend.state !== 'unknown').map(friend => [friend.id, friend]));
    if (known && isConsole() && notifyOn('notifyFriends') && Date.now() - lastFriendToast > 20000) {
      const arrived = [...online.values()].filter(friend => !known.has(friend.id));
      if (arrived.length === 1) { toast(`${arrived[0].name || 'A friend'} is online`); lastFriendToast = Date.now(); }
      else if (arrived.length > 1) { toast(`${arrived.length} friends came online`); lastFriendToast = Date.now(); }
    }
    known = new Set(online.keys());
  }
  if (typeof renderPlayWithFriends === 'function') {
    const base = renderPlayWithFriends;
    renderPlayWithFriends = function (...args) { const result = base.apply(this, args); try { friendsChanged(); } catch { /* Optional. */ } return result; };
  }

  // ---------- Downloads: starting, finishing, and the Queue tile ----------
  window.gDownloads = [];
  let previous = new Map();
  async function pollDownloads() {
    if (!isConsole() || document.hidden) return;
    const list = await window.launcher.getSteamDownloads?.().catch(() => null);
    if (!Array.isArray(list)) return;
    window.gDownloads = list;
    const now = new Map(list.map(item => [String(item.appId), item]));
    for (const [id, item] of now) if (!previous.has(id) && item.state === 'downloading' && previous.size + now.size > 0 && pollDownloads.started) { if (notifyOn('notifyDownloads')) toast(`Downloading · ${item.title}`); }
    for (const [id, item] of previous) if (!now.has(id) && item.state !== 'queued') { if (notifyOn('notifyDownloads')) toast(`Ready to play · ${item.title}`); }
    previous = now;
    pollDownloads.started = true;
    document.dispatchEvent(new CustomEvent('g-downloads'));
  }
  setInterval(pollDownloads, 15000);

  // ---------- Achievements and "welcome back" when a game closes ----------
  let session = null;
  async function achievementCount(gameId) {
    const result = await window.launcher.getGameAchievements?.(gameId).catch(() => null);
    if (!result?.progressAvailable) return null;
    return { count: result.unlockedCount || 0, items: (result.items || []).filter(item => item.unlocked) };
  }
  setInterval(async () => {
    const active = state.activeGameSession;
    if (active?.gameId && !active.remote && !session) {
      const game = state.games.find(item => item.id === active.gameId);
      session = { gameId: active.gameId, title: game?.title || 'your game', at: Date.now(), before: game?.provider === 'Steam' ? await achievementCount(active.gameId) : null };
    } else if (!active && session) {
      const ended = session;
      session = null;
      if (!isConsole()) return;
      const minutes = Math.round((Date.now() - ended.at) / 60000);
      if (minutes >= 1) setTimeout(() => toast(`Welcome back · You played ${ended.title} for ${minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`}`), 1200);
      if (ended.before) {
        const after = await achievementCount(ended.gameId);
        const fresh = after ? after.items.filter(item => !ended.before.items.some(old => old.id === item.id)) : [];
        fresh.slice(0, 3).forEach((item, index) => { if (notifyOn('notifyAchievements')) setTimeout(() => toast(`Achievement unlocked · ${item.title}`), 4200 + index * 3200); });
        if (fresh.length > 3 && notifyOn('notifyAchievements')) setTimeout(() => toast(`${fresh.length - 3} more achievements unlocked`), 4200 + 3 * 3200);
      }
    }
  }, 5000);

  // ---------- Controller disconnected ----------
  const screen = document.createElement('div');
  screen.id = 'g-controller-lost';
  screen.hidden = true;
  screen.innerHTML = '<div class="g-lost-card"><img src="assets/controller.svg" alt="" /><strong></strong><p></p><small>Press any button to continue</small></div>';
  document.body.append(screen);
  const WORDS = {
    series: ['Reconnect your controller', 'Your controller lost its connection. Turn it on, or plug it in with a USB cable.'],
    one: ['Your controller disconnected', 'Press the Xbox button to turn it on, or connect it with a USB cable.'],
    x360: ['Reconnect Controller', 'Please reconnect your controller. Press the Xbox Guide button to turn it on.']
  };
  const hideScreen = () => { screen.classList.remove('on'); setTimeout(() => { screen.hidden = true; }, 300); };
  window.addEventListener('gamepaddisconnected', () => {
    if (!isConsole() || state.activeGameSession || !document.hasFocus() || [...(navigator.getGamepads?.() || [])].some(Boolean)) return;
    const [title, body] = WORDS[theme()];
    screen.querySelector('strong').textContent = title;
    screen.querySelector('p').textContent = body;
    screen.hidden = false;
    requestAnimationFrame(() => screen.classList.add('on'));
    try { interfaceAudio.play('back'); } catch { /* Optional. */ }
  });
  window.addEventListener('gamepadconnected', hideScreen);
  window.addEventListener('keydown', () => { if (!screen.hidden) hideScreen(); }, true);
  screen.addEventListener('pointerdown', hideScreen);

  // ---------- Quick Resume (Series) ----------
  function markQuickResume() {
    document.querySelectorAll('.g-quick-resume').forEach(el => el.classList.remove('g-quick-resume'));
    const id = state.activeGameSession?.gameId;
    if (!id || theme() !== 'series') return;
    document.querySelectorAll(`#recent-row .game-card[data-game-id="${CSS.escape(id)}"], .library-grid .game-card[data-game-id="${CSS.escape(id)}"]`).forEach(el => el.classList.add('g-quick-resume'));
  }
  setInterval(markQuickResume, 4000);

  // ---------- The 360's disc tray ----------
  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-action="g-disc-tray"]')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    try { interfaceAudio.play('confirm'); } catch { /* Optional. */ }
    toast('Open Tray · No disc. Insert a game disc to play.');
  }, true);

  // ---------- One: the Spotlight tile turns over every few seconds ----------
  let spotIndex = 0;
  setInterval(() => {
    if (theme() !== 'one' || document.hidden || state.view !== 'home') return;
    const big = document.querySelector('#g-one-spotlight .g-one-spot.big');
    if (!big || big.classList.contains('focused')) return;
    const games = (state.games || []).filter(game => !game.isApp && game.installed !== false && (game.artwork?.tile || game.artwork?.grid));
    if (games.length < 2) return;
    spotIndex = (spotIndex + 1) % games.length;
    const game = games[spotIndex];
    big.classList.add('g-spot-turn');
    setTimeout(() => {
      big.dataset.gameId = game.id;
      big.setAttribute('aria-label', game.title);
      big.style.setProperty('--g-card-art', `url("${String(game.artwork.tile || game.artwork.grid).replaceAll('"', '%22')}")`);
      const title = big.querySelector('strong');
      if (title) title.textContent = game.title;
      big.classList.remove('g-spot-turn');
    }, 280);
  }, 9000);

  // ---------- Favourites are the One's Pins ----------
  window.gPinnedGames = () => (state.games || []).filter(game => !game.isApp && (state.favoriteGameIds || []).includes(game.id));

  document.addEventListener('g-theme-pack', () => {});
  new MutationObserver(() => { applyAccent(); renderAccents(); loadStoreData(); markQuickResume(); }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  applyAccent(); renderAccents(); setTimeout(loadStoreData, 4000); setTimeout(pollDownloads, 6000);
})();
