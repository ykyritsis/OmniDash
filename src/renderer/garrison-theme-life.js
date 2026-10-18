// Small things that make the Series and One themes behave like the consoles, beyond how they look.
//
//  - Screen dimming: left alone on the dashboard, both consoles dimmed the screen. After a few idle minutes
//    the Series fades to its green swirl and the One to a dark screen with a slowly drifting Xbox logo, both
//    with the time. Any input wakes it, and that first press only wakes, the way the console did.
//  - Series profile corner: your gamerpic and name sit top left, like the Series dashboard.
//  - Notifications: toasts get the console's icon tab (styled in garrison-themes.css).
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  // The screen saver delay is a registry setting now ({ id: 'screensaverDelay' }, in minutes); 4 minutes is the
  // value this screen used before the setting existed.
  const idleMs = () => {
    const minutes = Number(window.gSettings?.cached?.('screensaverDelay'));
    return (Number.isFinite(minutes) && minutes > 0 ? minutes : 4) * 60 * 1000;
  };
  const clockText = () => window.gSettings?.formatClock
    ? window.gSettings.formatClock(new Date())
    : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // ---------- Screen dimming ----------
  const saver = document.createElement('div');
  saver.id = 'g-theme-saver';
  saver.setAttribute('aria-hidden', 'true');
  saver.hidden = true;
  saver.innerHTML = '<div class="g-saver-drift"><img src="assets/xbox.svg" alt="" /></div><time class="g-saver-clock"></time>';
  document.body.append(saver);
  let lastInput = Date.now(), wokeAt = 0;
  const clock = saver.querySelector('.g-saver-clock');
  const busy = () => !document.querySelector('#launch-overlay')?.hidden || document.querySelector('dialog[open]') || state.activeGameSession || state.remotePlaySession
    || !document.querySelector('#startup-screen')?.hidden || !document.hasFocus() || document.hidden;
  function wake() {
    lastInput = Date.now();
    if (saver.hidden) return false;
    saver.classList.remove('on');
    wokeAt = Date.now();
    setTimeout(() => { if (!saver.classList.contains('on')) saver.hidden = true; }, 600);
    return true;
  }
  // The press that wakes the screen does nothing else.
  for (const type of ['keydown', 'pointerdown', 'click']) {
    window.addEventListener(type, event => {
      const sleeping = !saver.hidden && saver.classList.contains('on');
      if (sleeping || Date.now() - wokeAt < 250) { event.preventDefault(); event.stopImmediatePropagation(); }
      wake();
    }, true);
  }
  window.addEventListener('mousemove', () => { if (saver.hidden) lastInput = Date.now(); else wake(); }, { passive: true });
  // Controllers: any button or stick movement counts as input.
  let lastPad = '';
  setInterval(() => {
    const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean);
    const now = pads.map(pad => pad.buttons.map(button => (button.pressed ? 1 : 0)).join('') + pad.axes.map(axis => Math.round(axis * 2)).join('')).join('|');
    if (now !== lastPad) {
      if (lastPad && !saver.hidden && wake() && typeof state === 'object') state.previousButtons = pads[0]?.buttons.map(button => button.pressed) || [];
      lastPad = now;
      lastInput = Date.now();
    }
    if (theme() === 'helix' || busy()) { lastInput = Math.max(lastInput, Date.now() - idleMs() + 30000); return; }
    if (saver.hidden && Date.now() - lastInput > idleMs()) {
      clock.textContent = clockText();
      saver.hidden = false;
      requestAnimationFrame(() => saver.classList.add('on'));
    }
    if (!saver.hidden) clock.textContent = clockText();
  }, 1000);
  window.gThemeSaver = { show: () => { lastInput = 0; }, wake };

  // ---------- Sign-in greeting ----------
  // Both consoles greeted you by name as the dashboard came up.
  setTimeout(() => {
    if (theme() === 'helix' || !document.hasFocus()) return;
    const name = state.displayName || document.querySelector('#dashboard-player-name')?.textContent || 'Player';
    if (typeof showToast === 'function') showToast(`Hi, ${name}`);
  }, 3400);

  // ---------- Series profile corner ----------
  const left = document.querySelector('.topbar .g-top-left');
  if (left) {
    const me = document.createElement('button');
    me.id = 'g-series-me';
    me.className = 'focusable';
    me.type = 'button';
    me.dataset.action = 'g-account';
    me.setAttribute('aria-label', 'Profile');
    me.innerHTML = '<span class="g-me-avatar"></span><span class="g-me-copy"><strong></strong><small>OmniDash</small></span>';
    left.prepend(me);
    const sync = () => {
      me.querySelector('.g-me-avatar').innerHTML = document.querySelector('#profile-avatar')?.innerHTML || '';
      me.querySelector('strong').textContent = state.displayName || document.querySelector('#dashboard-player-name')?.textContent || 'Player';
    };
    sync();
    const avatar = document.querySelector('#profile-avatar');
    if (avatar) new MutationObserver(sync).observe(avatar, { childList: true, subtree: true, attributes: true });
    const name = document.querySelector('#dashboard-player-name');
    if (name) new MutationObserver(sync).observe(name, { childList: true, characterData: true, subtree: true });
  }
})();
