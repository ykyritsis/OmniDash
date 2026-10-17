// The parts of the console themes that move on their own.
//
//  - Live tiles (One): every few seconds a tile slides its face up to show something live, the way 2013's
//    Metro tiles did. My games & apps shows a collage of your covers, Friends the number online,
//    Achievements your Gamerscore, Store and Game Pass a featured game. Then it slides back.
//  - Gamerscore: your Gamerscore sits beside your gamerpic in the corner, as on both consoles.
//  - Notifications: each toast plays the theme's notification sound and replays its entrance.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const escape = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text));
  const art = game => game?.artwork?.tile || game?.artwork?.grid || '';
  const games = () => (state.games || []).filter(game => !game.isApp && game.installed !== false && art(game));
  const shuffle = list => list.map(item => [Math.random(), item]).sort((a, b) => a[0] - b[0]).map(pair => pair[1]);
  const url = value => `url(&quot;${escape(value).replaceAll('"', '%22')}&quot;)`;
  const gamerscore = () => (document.querySelector('#profile-score-value')?.textContent || '').replace(/[^\d,]/g, '');
  const friendsOnline = () => Number(document.querySelector('#g-pill-count')?.textContent || 0);

  // ---------- Live tiles ----------
  function liveFace(tile) {
    const action = tile.dataset.action;
    if (action === 'library') {
      const covers = shuffle(games()).slice(0, 4);
      if (covers.length < 2) return '';
      return `<span class="g-live-collage">${covers.map(game => `<i style="background-image:${url(art(game))}"></i>`).join('')}</span><b>My games &amp; apps</b>`;
    }
    if (action === 'g-friends') {
      const count = friendsOnline();
      return `<strong class="g-live-big">${count}</strong><b>${count === 1 ? 'friend online' : 'friends online'}</b>`;
    }
    if (action === 'g-account') {
      const score = gamerscore();
      return score ? `<strong class="g-live-big"><span class="g-live-g">G</span>${escape(score)}</strong><b>Gamerscore</b>` : '';
    }
    if (action === 'dashboard-store' || action === 'dashboard-gamepass') {
      const game = shuffle(games())[0];
      return game ? `<span class="g-live-art" style="background-image:${url(art(game))}"></span><b>${escape(game.title)}</b>` : '';
    }
    return '';
  }
  function liveTiles() {
    return [...document.querySelectorAll('#g-one-pins .g-one-pin, #g-one-spotlight .g-one-spot:not(.art)')]
      .filter(tile => tile.offsetParent && ['library', 'g-friends', 'g-account', 'dashboard-store', 'dashboard-gamepass'].includes(tile.dataset.action));
  }
  function flip(tile) {
    const face = liveFace(tile);
    if (!face) return;
    let live = tile.querySelector(':scope > .g-live');
    if (!live) { live = document.createElement('span'); live.className = 'g-live'; live.setAttribute('aria-hidden', 'true'); tile.append(live); }
    live.innerHTML = face;
    tile.classList.add('g-live-on');
    setTimeout(() => tile.classList.remove('g-live-on'), 3200 + Math.random() * 1500);
  }
  let lastFlipped = null;
  setInterval(() => {
    if (theme() !== 'one' || !document.querySelector('#home-view:not([hidden])') || document.hidden || document.documentElement.classList.contains('reduce-motion')) return;
    const tiles = liveTiles().filter(tile => tile !== lastFlipped && !tile.classList.contains('g-live-on') && !tile.classList.contains('focused'));
    const tile = tiles[Math.floor(Math.random() * tiles.length)];
    if (!tile) return;
    lastFlipped = tile;
    flip(tile);
  }, 2600);

  // ---------- Gamerscore in the corner ----------
  function syncScore() {
    const me = document.querySelector('#g-series-me small');
    if (!me) return;
    const score = gamerscore();
    me.innerHTML = score ? `<span class="g-me-g">G</span> ${escape(score)}` : 'Xbox Preview';
  }
  const scoreNode = document.querySelector('#profile-score-value');
  if (scoreNode) new MutationObserver(syncScore).observe(scoreNode, { childList: true, characterData: true, subtree: true });
  setTimeout(syncScore, 0);

  // ---------- Notifications ----------
  if (typeof showToast === 'function') {
    const toastBase = showToast;
    showToast = function (message, ...rest) {
      const toast = document.querySelector('#toast');
      if (theme() !== 'helix' && toast) {
        toast.classList.remove('show', 'g-toast-in');
        void toast.offsetWidth;
      }
      const result = toastBase.call(this, message, ...rest);
      if (theme() !== 'helix' && toast) {
        toast.classList.add('g-toast-in');
        try { if (state.soundEffects !== false && typeof interfaceAudio === 'object') interfaceAudio.play('notify'); } catch { /* Sound is optional. */ }
      }
      return result;
    };
  }
})();
