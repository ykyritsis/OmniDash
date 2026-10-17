// Playing: two switches in Settings (pause downloads while a game runs, controller vibration), and the
// vibration itself: a light buzz on confirm and a firmer one when a game launches, as on a console.
(function buildPlayingPrefs() {
  const prefs = { pauseDownloadsWhilePlaying: true, controllerVibration: true };
  const page = document.querySelector('[data-settings-page="g-account"]') || document.querySelector('[data-settings-page="experience"]');
  const rows = [
    ['pauseDownloadsWhilePlaying', 'Pause downloads while I play', 'Downloads wait while a game is running and continue when it closes. Needs Steam download controls (turn them on in Queue).'],
    ['controllerVibration', 'Controller vibration', 'A light buzz when you confirm, and a firmer one when a game launches.']
  ];
  const stateText = key => (prefs[key] ? 'On' : 'Off');
  if (page) {
    page.insertAdjacentHTML('beforeend', `<section class="g-setting-group" id="g-playing"><h3>Playing</h3><div class="g-setting-list">${rows.map(([key, title, note]) =>
      `<button class="g-setting-row focusable" type="button" role="switch" aria-checked="true" data-action="g-pref-toggle" data-pref="${key}"><span><strong>${title}</strong><small>${note}</small></span><span class="g-pref-state">On</span></button>`).join('')}</div></section>`);
  }
  const paint = () => {
    for (const button of document.querySelectorAll('[data-action="g-pref-toggle"]')) {
      const key = button.dataset.pref;
      button.setAttribute('aria-checked', String(prefs[key]));
      button.querySelector('.g-pref-state').textContent = stateText(key);
    }
  };
  window.launcher.getPrefs().then(saved => { Object.assign(prefs, saved); paint(); }).catch(() => {});

  // Vibration: weak motor for a tick, strong for a launch. Only while the launcher is in front.
  function rumble(kind) {
    if (!prefs.controllerVibration || !document.hasFocus() || document.body.classList.contains('g-asleep')) return;
    const effect = kind === 'launch' ? { duration: 160, strongMagnitude: .5, weakMagnitude: .7 } : kind === 'confirm' ? { duration: 40, strongMagnitude: 0, weakMagnitude: .35 } : null;
    if (!effect) return;
    const pad = [...(navigator.getGamepads?.() || [])].find(item => item?.connected && item.vibrationActuator);
    try { pad?.vibrationActuator.playEffect('dual-rumble', { startDelay: 0, ...effect }); } catch { /* This controller can't vibrate. */ }
  }
  const soundBase = playUiSound;
  playUiSound = function (kind, ...rest) {
    rumble(kind);
    return soundBase.call(this, kind, ...rest);
  };

  const perform = performAction;
  performAction = async function (action, source) {
    if (action === 'g-pref-toggle') {
      const key = source.dataset.pref;
      const next = !prefs[key];
      try { await window.launcher.setPref(key, next); prefs[key] = next; paint(); }
      catch (error) { showToast(error.message || 'Could not change this setting'); }
      return;
    }
    return perform(action, source);
  };
})();
