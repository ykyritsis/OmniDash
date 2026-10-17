// The launch screen, the way an Xbox does it.
//
//  - It grows out of the tile you pressed, and the rest of the interface dims behind it.
//  - It is a splash: the game's art on a dark base taken from its colours, the logo, and nothing else.
//  - The status line, Cancel and the B hint stay hidden until you need them: after a few seconds, when
//    Steam asks something or reports progress, when you press B once, or when you move the mouse.
//  - One small ring appears after a couple of seconds, so a long wait never looks frozen.
//  - Everything fades away together once the game is really running (the launch code decides when).
//
// This wraps the launch flow without changing it, so Steam prompts and remote play keep working.
(function buildLaunchFeel() {
  const overlay = document.querySelector('#launch-overlay');
  if (!overlay) return;

  const REVEAL_AFTER = 6000;
  let revealTimer = 0, openingTimer = 0, token = 0;

  const scrim = document.createElement('div');
  scrim.id = 'g-launch-scrim';
  scrim.setAttribute('aria-hidden', 'true');
  document.body.append(scrim);
  overlay.insertAdjacentHTML('beforeend', '<span class="g-launch-ring" aria-hidden="true"></span>');

  const reduced = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Where the expansion starts: the art of the focused tile, or a centred window when launching from a game page.
  function sourceRect() {
    const w = innerWidth, h = innerHeight;
    const tile = document.querySelector('.game-card.focused, .g-store-card.focused, .g-friend-card.focused');
    if (tile && tile.offsetParent && state.view !== 'detail') {
      const art = tile.querySelector('img, .art-fallback, .g-friend-art') || tile;
      const r = art.getBoundingClientRect();
      if (r.width > 24 && r.height > 24 && r.bottom > 0 && r.top < h && r.right > 0 && r.left < w) return r;
    }
    const inset = Math.min(w, h) * .12;
    return { left: w * .5 - w * .3, top: h * .5 - h * .3, right: w * .5 + w * .3, bottom: h * .5 + h * .3, width: w * .6, height: h * .6, centred: true, inset };
  }

  // A dark base from the art's own colours. Remote images often refuse pixel access, so a hue from the
  // title is the fallback, and the real colour replaces it when it can be read.
  const hashBase = title => `hsl(${hashHue(title)}, 38%, 11%)`;
  function sampleBase(url, apply, myToken) {
    if (!url || !/^https?:/.test(url)) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 8;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        context.drawImage(image, 0, 0, 8, 8);
        const data = context.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 200) continue; r += data[i]; g += data[i + 1]; b += data[i + 2]; count++; }
        if (!count || myToken !== token) return;
        r /= count; g /= count; b /= count;
        const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, l = (max + min) / 2;
        const d = max - min;
        let hue = 0;
        if (d) {
          if (max === r / 255) hue = ((g - b) / 255 / d + (g < b ? 6 : 0));
          else if (max === g / 255) hue = (b - r) / 255 / d + 2;
          else hue = (r - g) / 255 / d + 4;
          hue *= 60;
        }
        const sat = d ? Math.min(.5, d / (1 - Math.abs(2 * l - 1))) : 0;
        apply(`hsl(${Math.round(hue)}, ${Math.round(sat * 100)}%, 11%)`);
      } catch { /* The picture can't be read; the title's hue stays. */ }
    };
    image.src = url;
  }

  function reveal() {
    clearTimeout(revealTimer);
    overlay.classList.add('g-revealed');
  }
  // Resets the screen for the next launch. It only writes when something is set: removing a class rewrites the
  // class attribute even when nothing changes, which would wake the observer below again, forever.
  const SPLASH_CLASSES = ['g-from-tile', 'g-opening', 'g-revealed', 'g-cancelling'];
  function cleanup() {
    token++;
    clearTimeout(revealTimer);
    clearTimeout(openingTimer);
    const stale = SPLASH_CLASSES.filter(name => overlay.classList.contains(name));
    if (stale.length) overlay.classList.remove(...stale);
    if (overlay.dataset.gSplash) delete overlay.dataset.gSplash;
    if (scrim.classList.contains('on')) scrim.classList.remove('on');
  }

  function begin(game) {
    cleanup();
    const myToken = ++token;
    overlay.dataset.gSplash = '1';
    scrim.classList.add('on');
    overlay.style.setProperty('--g-launch-base', hashBase(game.title));
    sampleBase(game.artwork?.hero || game.artwork?.wide || game.artwork?.tile, color => overlay.style.setProperty('--g-launch-base', color), myToken);
    if (!reduced()) {
      const w = innerWidth, h = innerHeight, r = sourceRect();
      const style = overlay.style;
      style.setProperty('--g-lt', `${Math.max(0, r.top)}px`);
      style.setProperty('--g-lr', `${Math.max(0, w - r.right)}px`);
      style.setProperty('--g-lb', `${Math.max(0, h - r.bottom)}px`);
      style.setProperty('--g-ll', `${Math.max(0, r.left)}px`);
      style.setProperty('--g-sx', String(Math.max(.15, r.width / w)));
      style.setProperty('--g-dx', `${(r.left + r.width / 2) - w / 2}px`);
      style.setProperty('--g-dy', `${(r.top + r.height / 2) - h / 2}px`);
      overlay.classList.add('g-from-tile', 'g-opening');
      // While it grows the overlay stays fully visible; afterwards the normal fade rules apply again.
      openingTimer = setTimeout(() => overlay.classList.remove('g-opening'), 750);
    }
    revealTimer = setTimeout(reveal, REVEAL_AFTER);
  }

  const launchBase = launchSelectedGame;
  launchSelectedGame = function (...args) {
    const game = state.games.find(item => item.id === state.selectedGameId);
    // Installs and anything already launching are not splashes.
    if (!overlay.hidden || !game || game.installed === false || installTracking?.has?.(game.id)) return launchBase.apply(this, args);
    begin(game);
    const result = launchBase.apply(this, args);
    // The launch code shows the screen before its first wait; if it didn't, nothing is launching.
    if (overlay.hidden) cleanup();
    return result;
  };

  // B once shows the controls, B again cancels. Remote play and other uses of the screen are left alone.
  const cancelBase = cancelLaunchWait;
  cancelLaunchWait = function (...args) {
    if (overlay.dataset.gSplash && !overlay.classList.contains('g-revealed') && !overlay.dataset.remote) { reveal(); return; }
    const result = cancelBase.apply(this, args);
    // The screen stays up, saying so, until the launch code confirms the game really stopped.
    if (overlay.dataset.gSplash && !overlay.dataset.remote) {
      overlay.classList.add('g-revealed', 'g-cancelling');
      overlay.dataset.liveStatus = '1';
      const status = document.querySelector('#launch-status'), via = document.querySelector('#launch-via');
      if (status) status.textContent = 'Cancelling';
      if (via) via.textContent = 'Making sure the game is closed';
    }
    return result;
  };

  // Mouse or touch shows the controls straight away; there is no button to find otherwise.
  overlay.addEventListener('pointermove', () => { if (overlay.dataset.gSplash) reveal(); });
  overlay.addEventListener('pointerdown', () => { if (overlay.dataset.gSplash) reveal(); });

  // Steam asking something or reporting progress shows it at once, so setup is never hidden.
  const status = overlay.querySelector('.g-launch-status');
  if (status) {
    new MutationObserver(() => {
      if (!overlay.dataset.gSplash) return;
      const detail = status.querySelector('#steam-launch-detail'), progress = status.querySelector('#steam-launch-progress');
      if ((detail && !detail.hidden) || (progress && !progress.hidden)) reveal();
    }).observe(status, { attributes: true, attributeFilter: ['hidden'], subtree: true, childList: true });
  }

  // Once the screen is gone, everything returns to its resting state for the next launch.
  let wasActive = false;
  new MutationObserver(() => {
    const active = overlay.classList.contains('active') && !overlay.hidden;
    if (overlay.hidden) { if (overlay.dataset.gSplash || SPLASH_CLASSES.some(name => overlay.classList.contains(name))) cleanup(); }
    // The screen starts to fade out: the interface comes back as it does.
    else if (wasActive && !active && overlay.dataset.gSplash) scrim.classList.remove('on');
    wasActive = active;
  }).observe(overlay, { attributes: true, attributeFilter: ['hidden', 'class'] });
})();
