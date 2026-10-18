// Console-native account overlays for the three 2013-era shells: the PS3 XMB options panel, the PS4 Quick
// Menu and the Wii HOME Menu. Before this, every theme opened the same Garrison account flyout ("View profile
// / Settings / Power options"), which is why no console felt like itself. This module leaves the launcher's
// shared dialogs for Helix/Xbox and gives PS3, PS4 and Wii their own panel, focus handling, wording and motion.
//
// Every row is a real action: profile opens the avatar editor, Settings opens the launcher's own dialog, Power
// opens the existing power dialog, the PS4 Sound/Devices section reads and writes volume/mute through
// gSettings, and the Wii remote panel reads the real battery and writes Volume/Rumble through gSettings.
// Nothing here is decorative and nothing fakes a console control the launcher cannot back.
(() => {
  'use strict';
  const THEMES = ['ps3', 'ps4', 'wii'];
  const theme = () => document.body.dataset.gTheme || 'helix';
  const on = () => THEMES.includes(theme());
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text ?? ''));
  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  const playerName = () => (typeof state !== 'undefined' && state.displayName) || document.querySelector('#dashboard-player-name')?.textContent || 'Player';
  const playerAvatar = () => document.querySelector('#profile-avatar')?.innerHTML || '';
  const volumeStep = 5;
  const reduceMotion = () => document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  const root = document.createElement('div');
  root.id = 'g-console-account';
  root.className = 'g-ov';
  root.hidden = true;
  root.setAttribute('aria-hidden', 'true');
  document.body.append(root);

  let open = false, state = null, opener = null, focusKey = '';

  function row(action, glyph, label, value = '') {
    return `<button class="g-ov-row focusable" type="button" data-action="g-ov" data-c-action="${action}" data-c-focus data-c-key="${action}">
      <span class="g-ov-ic" aria-hidden="true">${icon(glyph)}</span><span class="g-ov-label">${esc(label)}</span>${value ? `<b>${esc(value)}</b>` : ''}</button>`;
  }
  function userHead(action = 'profile') {
    return `<button class="g-ov-user focusable" type="button" data-action="g-ov" data-c-action="${action}" data-c-focus data-c-key="${action}">
      <span class="g-ov-avatar">${playerAvatar()}</span><span><strong>${esc(playerName())}</strong><small>${action === 'profile' ? 'View Profile' : ''}</small></span></button>`;
  }
  function slider(key, label, value) {
    const amount = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
    return `<div class="g-ov-slider" role="slider" tabindex="-1" data-c-focus data-c-key="${key}" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${amount}">
      <span class="g-ov-slider-label">${esc(label)}</span><span class="g-ov-meter"><i style="width:${amount}%"></i></span><b>${amount}%</b>
      <button class="g-ov-step" type="button" data-c-action="volume-down" aria-label="Turn ${esc(label)} down">−</button>
      <button class="g-ov-step" type="button" data-c-action="volume-up" aria-label="Turn ${esc(label)} up">+</button></div>`;
  }
  function noticeList() {
    const notices = typeof gNotices !== 'undefined' ? gNotices : [];
    notices.forEach(item => { item.read = true; });
    const badge = document.querySelector('#g-notification-badge');
    if (badge) badge.hidden = true;
    const when = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
    return notices.length
      ? `<div class="g-ov-notices">${notices.slice(0, 7).map(item => `<div class="g-ov-notice"><strong>${esc(item.message)}</strong><small>${esc(when.format(item.at))}</small></div>`).join('')}</div>`
      : `<p class="g-ov-empty">${icon('bell')} You're all caught up.</p>`;
  }
  function backRow(key = 'back') {
    return `<button class="g-ov-row focusable" type="button" data-action="g-ov" data-c-action="back" data-c-focus data-c-key="${key}"><span class="g-ov-ic" aria-hidden="true">${icon('chevronRight')}</span><span class="g-ov-label">Back</span></button>`;
  }
  function hint() {
    const swapped = window.gSettings?.cached?.('enterButton') === 'o';
    const enter = swapped ? '○' : '✕';
    const back = swapped ? '✕' : '○';
    return `<p class="g-ov-hint"><b class="g-ov-key">${enter}</b> Select <b class="g-ov-key">${back}</b> Back</p>`;
  }

  function ps3Markup() {
    const body = state.section === 'notices'
      ? `${noticeList()}${backRow('back')}`
      : `${row('profile', 'contact', 'View Profile')}${row('settings', 'settings', 'Settings')}${row('notifications', 'bell', 'Notifications')}${row('power', 'power', 'Turn Off System')}`;
    return `<div class="g-ov-dim"></div><section class="g-ov-panel" role="dialog" aria-modal="false" aria-label="Account options">
      <div class="g-ov-ps3-head"><span class="g-ov-avatar">${playerAvatar()}</span><span><strong>${esc(playerName())}</strong><small>Signed in</small></span></div>
      <p class="g-ov-kicker">${state.section === 'notices' ? 'Notifications' : 'Account Management'}</p>
      <div class="g-ov-list">${body}</div>${hint()}</section>`;
  }

  function ps4Markup() {
    const sound = state.section === 'sound';
    const notices = state.section === 'notices';
    const section = sound
      ? `${slider('volume', 'Volume', state.volume)}
         <button class="g-ov-row focusable" type="button" data-action="g-ov" data-c-action="mute" data-c-focus data-c-key="mute">
           <span class="g-ov-ic" aria-hidden="true">${icon('volume')}</span><span class="g-ov-label">Mute</span><b>${state.muted ? 'On' : 'Off'}</b></button>
         ${backRow('back')}`
      : notices ? `${noticeList()}${backRow('back')}`
      : `${row('sound', 'volume', 'Sound/Devices', state.muted ? 'Muted' : '')}
         ${row('notifications', 'bell', 'Notifications')}
         ${row('settings', 'settings', 'Settings')}
         ${row('power', 'power', 'Power')}`;
    return `<div class="g-ov-dim"></div><section class="g-ov-panel" role="dialog" aria-modal="false" aria-label="Quick Menu">
      ${userHead()}
      <p class="g-ov-kicker">${sound ? 'Sound/Devices' : notices ? 'Notifications' : 'Quick Menu'}</p>
      <div class="g-ov-list">${section}</div>${hint()}</section>`;
  }

  function wiiMarkup() {
    return `<div class="g-ov-dim"></div><section class="g-ov-panel" role="dialog" aria-modal="false" aria-label="HOME Menu">
      <div class="g-ov-wii-head">${userHead()}<span class="g-ov-wii-title">HOME Menu</span></div>
      <div class="g-ov-wii-big">
        <button class="g-ov-wii-pill focusable" type="button" data-action="g-ov" data-c-action="wii-menu" data-c-focus data-c-key="wii-menu"><span>Wii Menu</span></button>
        <button class="g-ov-wii-pill focusable" type="button" data-action="g-ov" data-c-action="reset" data-c-focus data-c-key="reset"><span>Reset</span></button>
      </div>
      <div class="g-ov-wii-remote">
        <div class="g-ov-wii-battery"><span class="g-ov-wii-remote-mark">Wii Remote</span><span class="g-ov-battery">${icon('power')}<b>${esc(state.battery || 'Battery unavailable')}</b></span></div>
        ${slider('volume', 'Volume', state.volume)}
        <button class="g-ov-row focusable" type="button" data-action="g-ov" data-c-action="rumble" data-c-focus data-c-key="rumble">
          <span class="g-ov-ic" aria-hidden="true">${icon('controller')}</span><span class="g-ov-label">Rumble</span><b>${state.rumble ? 'On' : 'Off'}</b></button>
        <div class="g-ov-wii-links">
          <button class="g-ov-wii-link focusable" type="button" data-action="g-ov" data-c-action="settings" data-c-focus data-c-key="settings">Wii Settings</button>
          <button class="g-ov-wii-link focusable" type="button" data-action="g-ov" data-c-action="power" data-c-focus data-c-key="power">Power</button>
        </div>
      </div>${hint()}</section>`;
  }

  function markup() {
    if (theme() === 'ps3') return ps3Markup();
    if (theme() === 'ps4') return ps4Markup();
    return wiiMarkup();
  }

  function render() {
    if (!open) return;
    const activeKey = document.activeElement?.dataset?.cKey || focusKey;
    root.className = `g-ov g-ov-${theme()}${open ? ' on' : ''}`;
    root.innerHTML = markup();
    const rows = [...root.querySelectorAll('[data-c-focus]')];
    const target = rows.find(element => element.dataset.cKey === activeKey) || rows[0];
    if (target) {
      focusKey = target.dataset.cKey;
      try { setFocusedElement(target, { scroll: false }); } catch { target.focus?.(); }
    }
  }

  function readValues() {
    const settings = window.gSettings;
    if (!settings) return;
    Promise.all([
      settings.get('volume').catch(() => null),
      settings.get('mute').catch(() => null),
      settings.get('battery').catch(() => null),
      settings.get('controllerVibration').catch(() => null)
    ]).then(([volume, muted, battery, rumble]) => {
      if (!open) return;
      if (Number.isFinite(Number(volume))) state.volume = Number(volume);
      if (typeof muted === 'boolean') state.muted = muted;
      if (battery) state.battery = String(battery);
      if (typeof rumble === 'boolean') state.rumble = rumble;
      render();
    });
  }

  function show(source, section = 'root') {
    if (!on()) return false;
    opener = source || document.activeElement;
    state = { section, volume: null, muted: false, battery: '', rumble: true };
    focusKey = '';
    open = true;
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('g-console-account-open');
    root.className = `g-ov g-ov-${theme()}${open ? ' on' : ''}`;
    render();
    // Let the panel's closed position paint once, then slide it in (the class is re-added next frame).
    root.classList.remove('on');
    void root.offsetWidth;
    requestAnimationFrame(() => { if (open) root.classList.add('on'); });
    readValues();
    return true;
  }

  function close(refocus = true) {
    if (!open) return;
    open = false;
    root.classList.remove('on');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('g-console-account-open');
    const done = () => { if (!open) { root.hidden = true; root.innerHTML = ''; } };
    if (reduceMotion()) done(); else setTimeout(done, 220);
    if (refocus && opener?.isConnected) {
      const target = opener;
      opener = null;
      requestAnimationFrame(() => { try { setFocusedElement(target, { scroll: false }); } catch { target.focus?.(); } });
    } else opener = null;
  }

  function setVolume(delta) {
    if (!Number.isFinite(Number(state.volume))) return;
    const next = Math.max(0, Math.min(100, Math.round((Number(state.volume) + delta) / volumeStep) * volumeStep));
    if (next === Number(state.volume)) return;
    state.volume = next;
    render();
    window.gSettings?.set('volume', next).catch(() => {});
  }

  function activate(action, source) {
    if (!open) return;
    if (action === 'back') { state.section = 'root'; focusKey = ''; render(); return; }
    if (action === 'sound') {
      state.section = state.section === 'sound' ? 'root' : 'sound';
      focusKey = state.section === 'sound' ? 'volume' : 'sound';
      render();
      return;
    }
    if (action === 'notifications') {
      state.section = state.section === 'notices' ? 'root' : 'notices';
      focusKey = state.section === 'notices' ? 'back' : 'notifications';
      render();
      return;
    }
    if (action === 'volume-up') { setVolume(volumeStep); return; }
    if (action === 'volume-down') { setVolume(-volumeStep); return; }
    if (action === 'mute') {
      state.muted = !state.muted;
      render();
      window.gSettings?.set('mute', state.muted).catch(() => {});
      return;
    }
    if (action === 'rumble') {
      state.rumble = !state.rumble;
      render();
      window.gSettings?.set('controllerVibration', state.rumble).catch(() => {});
      return;
    }
    if (action === 'wii-menu') { close(); return; }
    if (action === 'reset') {
      close(false);
      if (typeof showToast === 'function') showToast('Resetting the launcher…');
      setTimeout(() => window.location.reload(), 550);
      return;
    }
    const next = action === 'profile' ? 'avatar-picker' : action === 'power' ? 'power-menu' : action;
    if (action === 'settings' || action === 'power' || action === 'profile') {
      // The dialog owns the focus; do not pull it back to the account button behind a modal.
      close(false);
      if (typeof performAction === 'function') performAction(next, source);
    }
  }

  function move(direction) {
    if (!open) return;
    const rows = [...root.querySelectorAll('[data-c-focus]')];
    if (!rows.length) return;
    let index = rows.findIndex(element => element.dataset.cKey === (document.activeElement?.dataset?.cKey || focusKey));
    if (index < 0) index = 0;
    const current = rows[index];
    if ((direction === 'left' || direction === 'right') && current?.dataset?.cKey === 'volume') {
      setVolume(direction === 'right' ? volumeStep : -volumeStep);
      return;
    }
    if (direction === 'left' && state.section !== 'root') { state.section = 'root'; focusKey = ''; render(); return; }
    if (direction === 'right' && current?.dataset?.cKey === 'sound') { activate('sound', current); return; }
    if (direction !== 'up' && direction !== 'down') return;
    const next = Math.max(0, Math.min(rows.length - 1, index + (direction === 'down' ? 1 : -1)));
    if (next === index) return;
    focusKey = rows[next].dataset.cKey;
    try { setFocusedElement(rows[next], { scroll: false }); } catch { rows[next].focus?.(); }
  }

  root.addEventListener('click', event => {
    if (event.target === root || event.target.classList?.contains('g-ov-dim')) { close(); return; }
    const action = event.target.closest?.('[data-c-action]');
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    activate(action.dataset.cAction, action);
  }, true);

  // The generic Enter path calls performAction() with the focused element's data-action. Our rows carry a
  // shared g-ov action plus the console action in data-c-action.
  if (typeof performAction === 'function') {
    const actionBase = performAction;
    performAction = async function (action, source) {
      if (open && action === 'g-ov' && source?.dataset?.cAction) {
        activate(source.dataset.cAction, source);
        return true;
      }
      if (on() && action === 'g-account' && !document.querySelector('dialog[open]')) {
        show(source, 'root');
        return true;
      }
      if (on() && ['g-account-profile', 'g-account-settings', 'g-account-power'].includes(action)) {
        const key = action === 'g-account-profile' ? 'profile' : action === 'g-account-settings' ? 'settings' : 'power';
        show(source, 'root');
        activate(key, source);
        return true;
      }
      return actionBase.call(this, action, source);
    };
  }
  if (typeof moveFocus === 'function') {
    const focusBase = moveFocus;
    moveFocus = function (direction) {
      if (open) { move(direction); return; }
      return focusBase.call(this, direction);
    };
  }
  if (typeof navigateBack === 'function') {
    const backBase = navigateBack;
    navigateBack = function (...args) {
      if (open) { close(); return; }
      return backBase.apply(this, args);
    };
  }
  document.addEventListener('g-setting-change', event => {
    if (!open || !event.detail?.id) return;
    const id = event.detail.id;
    if (id === 'volume' && Number.isFinite(Number(event.detail.value))) state.volume = Number(event.detail.value);
    if (id === 'mute') state.muted = Boolean(event.detail.value);
    if (id === 'controllerVibration') state.rumble = Boolean(event.detail.value);
    if (['volume', 'mute', 'controllerVibration'].includes(id)) render();
  });
  new MutationObserver(() => { if (open && !on()) close(false); }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  // The shared power dialog keeps its real PC actions but takes each console's face button and header eyebrow.
  const powerDialog = document.querySelector('#power-dialog');
  function paintPowerChrome() {
    if (!powerDialog?.open || !on()) return;
    const key = powerDialog.querySelector('.power-footer kbd');
    if (key) key.textContent = theme() === 'wii' ? 'B' : '○';
    const eyebrow = powerDialog.querySelector('.power-header .eyebrow');
    if (eyebrow) eyebrow.textContent = theme() === 'wii' ? 'Wii' : theme() === 'ps3' ? 'System' : 'PS4';
  }
  powerDialog?.addEventListener('toggle', event => { if (event.newState === 'open') paintPowerChrome(); });
  window.gConsoleAccount = { open: () => show(document.activeElement), close: () => close(), isOpen: () => open };
})();
