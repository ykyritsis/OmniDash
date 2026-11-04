// Settings: one clear screen for Helix and every Xbox dashboard (Series, Aero, One, 360), instead of a console
// shell for some and the launcher's long dialog for others. The PlayStation and Nintendo themes draw the same
// sections in their own native menus (garrison-settings-shell.js); the list itself is gSettings.sections.
//
// Eight plainly named sections down the left, each with a line saying what is in it; the right side lists that
// section's settings, every one with a short description and its control (switch, slider, choice or button).
// Every row is a gSettings registry entry (garrison-settings-registry.js), so a row changes exactly what the
// launcher's own controls change. Rows this PC cannot use are left out. "All launcher settings" is the only way
// into the launcher's full dialog, for the rarely used extras (libraries, remote play, privacy).
//
// Controller: up/down move, right or A enters a category, left/right change a slider or choice, A opens a
// choice's list or runs a button, B steps back (list → rows → categories → closed).
(() => {
  'use strict';
  const UNIFIED = ['helix', 'series', 'one', 'x360'];
  const on = () => UNIFIED.includes(document.body.dataset.gTheme || 'helix');
  const esc = text => (typeof escapeHtml === 'function' ? escapeHtml(text) : String(text ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])));
  const icon = name => (typeof gIcon === 'function' ? gIcon(name) : '');
  const S = () => window.gSettings;
  const focus = el => { if (!el) return; try { setFocusedElement(el, { scroll: false }); } catch { el.focus?.({ preventScroll: true }); } el.scrollIntoView?.({ block: 'nearest' }); };
  const sound = kind => { try { if (typeof playUiSound === 'function') playUiSound(kind); } catch { /* Sound is optional. */ } };

  // ---------- What is where, in plain words ----------
  // The sections and their rows come from the registry (the same list every console uses); this file only adds
  // an icon and a one-line summary for each. "All launcher settings" sits at the end of System.
  const LOOK = {
    appearance: { icon: 'color', blurb: 'Theme, background, pack and clock' },
    'display-sound': { icon: 'tv', blurb: 'Screen size, brightness and sound' },
    controller: { icon: 'controller', blurb: 'Connection and vibration' },
    notifications: { icon: 'bell', blurb: 'Which pop-ups you see' },
    library: { icon: 'library', blurb: 'Scanning, what shows and artwork' },
    account: { icon: 'contact', blurb: 'Your profile and connected stores' },
    accessibility: { icon: 'ease', blurb: 'Text size, motion and focus' },
    system: { icon: 'settings', blurb: 'Start-up, updates, backup and reset' }
  };
  const CATEGORIES = (window.gSettings?.sections || []).filter(section => LOOK[section.id]).map(section => ({
    id: section.id, name: section.title, icon: LOOK[section.id].icon, blurb: LOOK[section.id].blurb,
    rows: section.rows.slice()
  }));
  const LABEL = {
    uiScale: 'Screen size', textSize: 'Text size', fullscreen: 'Open in full screen', startupAnimation: 'Startup animation',
    soundEffects: 'Interface sounds', menuMusic: 'Menu music', menuMusicVolume: 'Menu music volume', powerPlan: 'Power mode',
    accent: 'Accent colour', background: 'Background', screensaverDelay: 'Dim the screen after', clockFormat: 'Clock', dateOrder: 'Date format',
    controllerStatus: 'Controller', controllerVibration: 'Vibration', libraryCounts: 'Library', freeDisk: 'Free space',
    showUninstalledSteam: 'Show uninstalled Steam games', showUninstalledEpic: 'Show uninstalled Epic games', pauseDownloadsWhilePlaying: 'Pause downloads while playing',
    profile: 'Name and gamerpic', steamAccount: 'Steam Web API key', epicAccount: 'Epic Games', artworkKey: 'SteamGridDB key', friendsOnline: 'Friends online',
    notifyFriends: 'Friends coming online', notifyDownloads: 'Downloads finishing', notifyAchievements: 'Achievements unlocked',
    highContrastFocus: 'High-contrast focus', reducedMotion: 'Reduce motion', wifi: 'Network', appVersion: 'Version',
    checkForUpdates: 'Check for updates', exportSettings: 'Back up settings', importSettings: 'Restore settings', copyDiagnostics: 'Copy diagnostics',
    rescanLibrary: 'Scan for games', consolePack: 'Console pack', clearArtwork: 'Reset chosen artwork', resetLauncherData: 'Reset OmniDash'
  };
  const DESC = {
    theme: 'The whole dashboard style. Your games and settings stay the same.',
    background: 'The picture behind Home.',
    accent: 'The highlight colour used for selected items.',
    uiScale: 'Makes everything on screen bigger or smaller.',
    clockFormat: 'How the time is shown in the corner.',
    dateOrder: 'How dates are written.',
    screensaverDelay: 'Minutes without input before the screen dims.',
    volume: 'Windows volume for this PC.',
    mute: 'Silences this PC.',
    soundEffects: 'Clicks and chimes as you move around the dashboard.',
    menuMusic: 'Background music on the dashboard.',
    menuMusicVolume: 'How loud the menu music plays.',
    brightness: 'Screen brightness, on displays that support it.',
    fullscreen: 'OmniDash fills the screen when it opens.',
    startupAnimation: 'Plays the boot animation when OmniDash starts.',
    powerPlan: 'The Windows power plan: balanced, best performance or battery saving.',
    controllerStatus: 'The controller OmniDash can see right now.',
    controllerVibration: 'Rumble when you move around and select things.',
    libraryCounts: 'Games and apps OmniDash found on this PC.',
    freeDisk: 'Space left on your game drives.',
    showUninstalledSteam: 'Also list Steam games you own but have not installed.',
    showUninstalledEpic: 'Also list Epic games you own but have not installed.',
    pauseDownloadsWhilePlaying: 'Keeps Steam downloads from slowing your game down.',
    profile: 'Change the name and picture shown in the corner.',
    steamAccount: 'Optional. Adds uninstalled games you own, verified Gamerscore and friends.',
    epicAccount: 'Found automatically through Legendary or Heroic.',
    artworkKey: 'Optional. A free key that fills in missing artwork.',
    friendsOnline: 'Steam friends who are online now.',
    notifyFriends: 'Show a pop-up when a friend comes online.',
    notifyDownloads: 'Show a pop-up when a download or update finishes.',
    notifyAchievements: 'Show a pop-up when you unlock an achievement.',
    textSize: 'Makes text bigger without changing anything else.',
    highContrastFocus: 'A thicker, brighter outline around the selected item.',
    reducedMotion: 'Turns off zooms, slides and moving backgrounds.',
    wifi: 'The network this PC is connected to.',
    appVersion: 'The OmniDash version you are running.',
    checkForUpdates: 'Look for a newer OmniDash and install it.',
    exportSettings: 'Save your settings to a file.',
    importSettings: 'Load settings from a backup file.',
    copyDiagnostics: 'Copies a report (without keys) to send with a bug.',
    rescanLibrary: 'Look again for games installed on this PC.',
    consolePack: 'Original icons, fonts and sounds for this dashboard, from its author’s project.',
    clearArtwork: 'Go back to the artwork OmniDash picks for every game.',
    resetLauncherData: 'Clears your settings, artwork and caches. Your games are not touched.'
  };
  const UNIT = { volume: '%', menuMusicVolume: '%', brightness: '%', uiScale: '%', textSize: '%', screensaverDelay: ' min', tileRadius: ' px' };

  // ---------- Screen ----------
  const screen = document.createElement('section');
  screen.id = 'g-aero-settings';
  screen.hidden = true;
  screen.setAttribute('aria-label', 'Settings');
  screen.innerHTML = `
    <header class="as-head"><div><h1>Settings</h1><p>Change how OmniDash looks, sounds and plays.</p></div>
      <button class="as-close focusable" type="button" data-action="aero-set-close" aria-label="Close settings"><kbd data-g-role="back"></kbd>Close</button></header>
    <nav class="as-cats" aria-label="Categories">${CATEGORIES.map(cat => `
      <button class="as-cat focusable" type="button" data-action="aero-set-cat" data-cat="${cat.id}">${icon(cat.icon)}<span><strong>${esc(cat.name)}</strong><small>${esc(cat.blurb)}</small></span></button>`).join('')}</nav>
    <div class="as-page"><div class="as-page-head"><span class="as-orb" aria-hidden="true"></span><h2></h2><p></p></div><div class="as-rows" role="list"></div></div>
    <footer class="as-hints"><span><kbd data-g-role="confirm"></kbd>Select</span><span><kbd data-g-role="dpad"></kbd>Change</span><span><kbd data-g-role="back"></kbd>Back</span></footer>`;
  document.body.append(screen);
  const rowsHost = screen.querySelector('.as-rows');
  const cats = [...screen.querySelectorAll('.as-cat')];

  let current = CATEGORIES[0];
  let area = 'cats';
  let list = null; // { id, options, value } while a choice's list is open
  let token = 0;
  let returnFocus = null;
  let launcherPass = false;
  const rowData = new Map();

  const label = id => LABEL[id] || S()?.label?.(id, 'series') || id;
  const optionLabel = (options, value) => options.find(option => String(option.value) === String(value))?.label ?? (value ?? '—');
  function control(id, kind, value, options, entry) {
    if (kind === 'toggle') return `<span class="as-switch${value ? ' on' : ''}"><b></b></span><em>${value ? 'On' : 'Off'}</em>`;
    if (kind === 'slider') {
      const min = entry.min ?? 0, max = entry.max ?? 100, num = Number(value);
      const pct = Number.isFinite(num) ? Math.max(0, Math.min(100, ((num - min) / (max - min)) * 100)) : 0;
      return `<span class="as-slider" data-aero-track><i style="width:${pct}%"></i></span><em>${Number.isFinite(num) ? `${num}${UNIT[id] || ''}` : '—'}</em>`;
    }
    if (kind === 'choice') return `<span class="as-choice"><i class="prev" data-aero-step="-1">‹</i><em>${esc(optionLabel(options, value))}</em><i class="next" data-aero-step="1">›</i></span>`;
    if (kind === 'action') return `${typeof value === 'string' && value ? `<em>${esc(value)}</em>` : ''}<span class="as-go">›</span>`;
    return `<em>${esc(value == null || value === '' ? '—' : typeof value === 'object' ? (value.label || value.text || JSON.stringify(value)) : String(value))}</em>`;
  }
  function rowMarkup(id) {
    const data = rowData.get(id);
    if (!data) return '';
    const { kind, value, options, entry } = data;
    const tag = kind === 'info' ? 'div' : 'button';
    return `<${tag} class="as-row as-k-${kind}${kind === 'info' ? '' : ' focusable'}" ${tag === 'button' ? 'type="button" data-action="aero-set-row"' : ''} data-id="${esc(id)}" role="listitem">
      <span class="as-text"><strong>${esc(label(id))}</strong><small>${esc(DESC[id] || '')}</small></span>
      <span class="as-ctl">${control(id, kind, value, options || [], entry)}</span></${tag}>`;
  }
  async function load(id) {
    const settings = S();
    const entry = settings?.entry?.(id);
    if (!entry) return null;
    try { if (!(await settings.available(id))) return null; } catch { return null; }
    let value = null, options = [];
    try { value = await settings.get(id); } catch { /* Shown as a dash. */ }
    if (entry.kind === 'choice') { try { options = await settings.options(id); } catch { options = []; } if (!options.length) return null; }
    return { kind: entry.kind, value, options, entry };
  }
  async function showCategory(cat, { keepFocusId = '' } = {}) {
    current = cat;
    for (const button of cats) button.classList.toggle('on', button.dataset.cat === cat.id);
    const orb = screen.querySelector('.as-page-head .as-orb');
    orb.innerHTML = icon(cat.icon);
    orb.dataset.orb = cat.id;
    screen.querySelector('.as-page-head h2').textContent = cat.name;
    screen.querySelector('.as-page-head p').textContent = cat.blurb;
    const mine = ++token;
    if (!keepFocusId) rowsHost.innerHTML = cat.rows.map(() => '<div class="as-row as-ghost"></div>').join('');
    const loaded = await Promise.all(cat.rows.map(load));
    if (mine !== token) return;
    rowData.clear();
    cat.rows.forEach((id, index) => { if (loaded[index]) rowData.set(id, loaded[index]); });
    rowsHost.innerHTML = cat.rows.filter(id => rowData.has(id)).map(rowMarkup).join('') || '<p class="as-empty">Nothing to change here on this PC.</p>';
    rowsHost.classList.remove('as-in'); void rowsHost.offsetWidth; rowsHost.classList.add('as-in');
    try { refreshFocusables(); } catch { /* Not ready yet. */ }
    if (keepFocusId && area === 'rows') focus(rowsHost.querySelector(`.as-row[data-id="${CSS.escape(keepFocusId)}"]`) || rowsHost.querySelector('.focusable'));
  }
  async function refreshRow(id) {
    const data = await load(id);
    const row = rowsHost.querySelector(`.as-row[data-id="${CSS.escape(id)}"]`);
    if (!data || !row) return;
    rowData.set(id, data);
    row.querySelector('.as-ctl').innerHTML = control(id, data.kind, data.value, data.options, data.entry);
  }

  // ---------- Changing things ----------
  async function apply(id, value) {
    try { await S().set(id, value); } catch (error) { if (typeof showToast === 'function') showToast(error?.message || 'That setting could not be changed.'); }
    if (!on()) return; // The theme changed: the screen has already closed.
    await refreshRow(id);
  }
  function step(id, direction) {
    const data = rowData.get(id);
    if (!data) return false;
    if (data.kind === 'slider') {
      const { min = 0, max = 100, step: by = 1 } = data.entry;
      const now = Number.isFinite(Number(data.value)) ? Number(data.value) : min;
      const next = Math.max(min, Math.min(max, now + direction * by));
      if (next === now) return true;
      data.value = next;
      sound('navigate');
      const row = rowsHost.querySelector(`.as-row[data-id="${CSS.escape(id)}"]`);
      if (row) row.querySelector('.as-ctl').innerHTML = control(id, 'slider', next, [], data.entry);
      apply(id, next);
      return true;
    }
    if (data.kind === 'choice') {
      const at = data.options.findIndex(option => String(option.value) === String(data.value));
      const next = data.options[(Math.max(0, at) + direction + data.options.length) % data.options.length];
      if (!next) return true;
      data.value = next.value;
      sound('navigate');
      apply(id, next.value);
      return true;
    }
    return false;
  }
  async function activate(id) {
    const data = rowData.get(id);
    if (!data) return;
    sound('select');
    if (data.kind === 'toggle') { data.value = !data.value; await apply(id, data.value); return; }
    if (data.kind === 'choice') { openList(id); return; }
    if (data.kind === 'action') {
      launcherPass = true;
      try { await apply(id, null); } finally { launcherPass = false; }
    }
  }
  function openList(id) {
    const data = rowData.get(id);
    const row = rowsHost.querySelector(`.as-row[data-id="${CSS.escape(id)}"]`);
    if (!data || !row) return;
    closeList();
    list = { id };
    row.insertAdjacentHTML('afterend', `<div class="as-list" role="listbox" aria-label="${esc(label(id))}">${data.options.map(option => `
      <button class="as-option focusable${String(option.value) === String(data.value) ? ' on' : ''}" type="button" role="option" data-action="aero-set-pick" data-value="${esc(option.value)}">${esc(option.label)}</button>`).join('')}</div>`);
    try { refreshFocusables(); } catch { /* Not ready yet. */ }
    focus(rowsHost.querySelector('.as-option.on') || rowsHost.querySelector('.as-option'));
  }
  function closeList(refocus = false) {
    const box = rowsHost.querySelector('.as-list');
    const id = list?.id;
    box?.remove();
    list = null;
    try { refreshFocusables(); } catch { /* Not ready yet. */ }
    if (refocus && id) focus(rowsHost.querySelector(`.as-row[data-id="${CSS.escape(id)}"]`));
  }

  // ---------- Open and close ----------
  const PAGE_TO_CAT = { personalization: 'appearance', appearance: 'appearance', sound: 'display-sound', services: 'account', accessibility: 'accessibility', notifications: 'notifications' };
  async function open(catId = '') {
    if (!screen.hidden) { if (catId) enterCategory(catId); return; }
    returnFocus = document.activeElement;
    screen.hidden = false;
    document.body.classList.add('g-aero-settings-open');
    sound('confirm');
    area = 'cats';
    const cat = CATEGORIES.find(item => item.id === catId) || CATEGORIES[0];
    focus(cats.find(button => button.dataset.cat === cat.id));
    await showCategory(cat);
  }
  function enterCategory(catId) {
    const cat = CATEGORIES.find(item => item.id === catId);
    if (!cat) return;
    focus(cats.find(button => button.dataset.cat === cat.id));
    showCategory(cat);
  }
  function close() {
    if (screen.hidden) return;
    closeList();
    screen.hidden = true;
    document.body.classList.remove('g-aero-settings-open');
    sound('back');
    try { refreshFocusables(); } catch { /* Not ready yet. */ }
    if (returnFocus?.isConnected && returnFocus.offsetParent) focus(returnFocus);
    else focus(document.querySelector('#recent-row .selected') || document.querySelector('#recent-row .focusable'));
  }
  const isOpen = () => !screen.hidden && !document.querySelector('dialog[open]');

  // ---------- Controller and keyboard ----------
  function move(direction) {
    const focused = document.activeElement;
    if (list) {
      const options = [...rowsHost.querySelectorAll('.as-option')];
      const at = options.indexOf(focused);
      if (direction === 'up' || direction === 'down') focus(options[Math.max(0, Math.min(options.length - 1, at + (direction === 'up' ? -1 : 1)))]);
      return;
    }
    if (area === 'cats' || !rowsHost.contains(focused)) {
      area = 'cats';
      const at = Math.max(0, cats.indexOf(focused));
      if (direction === 'up' || direction === 'down') {
        const next = cats[Math.max(0, Math.min(cats.length - 1, at + (direction === 'up' ? -1 : 1)))];
        if (next && next !== focused) { focus(next); sound('navigate'); showCategory(CATEGORIES.find(cat => cat.id === next.dataset.cat)); }
        else if (direction === 'up' && at === 0) focus(screen.querySelector('.as-close'));
      } else if (direction === 'right') enterRows();
      return;
    }
    const rows = [...rowsHost.querySelectorAll('.as-row.focusable')];
    const at = rows.indexOf(focused);
    if (direction === 'up' || direction === 'down') {
      const next = rows[at + (direction === 'up' ? -1 : 1)];
      if (next) { focus(next); sound('navigate'); }
      return;
    }
    const id = focused?.dataset.id;
    if (step(id, direction === 'left' ? -1 : 1)) return;
    if (direction === 'left') backToCats();
  }
  function enterRows() {
    const first = rowsHost.querySelector('.as-row.focusable');
    if (!first) return;
    area = 'rows';
    focus(first);
    sound('navigate');
  }
  function backToCats() {
    area = 'cats';
    focus(cats.find(button => button.dataset.cat === current.id));
  }
  function back() {
    if (list) { closeList(true); sound('back'); return; }
    if (area === 'rows') { backToCats(); sound('back'); return; }
    close();
  }

  if (typeof navigateConsoleHome === 'function') {
    const navBase = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (isOpen()) { move(direction); return true; }
      return navBase.call(this, direction, focused);
    };
  }
  if (typeof navigateBack === 'function') {
    const backBase = navigateBack;
    navigateBack = function (...args) {
      if (isOpen()) { back(); return true; }
      return backBase.apply(this, args);
    };
  }
  if (typeof performAction === 'function') {
    const actionBase = performAction;
    performAction = async function (action, source) {
      if (action === 'aero-set-close') { close(); return; }
      if (action === 'aero-set-cat') {
        const cat = CATEGORIES.find(item => item.id === source?.dataset.cat);
        if (!cat) return;
        if (cat === current && rowData.size) { enterRows(); return; }
        focus(source);
        area = 'cats';
        await showCategory(cat);
        enterRows();
        return;
      }
      if (action === 'aero-set-row') { area = 'rows'; await activate(source?.dataset.id); return; }
      if (action === 'aero-set-pick') {
        const id = list?.id;
        const value = source?.dataset.value;
        const data = rowData.get(id);
        closeList(true);
        if (!data) return;
        const option = data.options.find(item => String(item.value) === value);
        if (option) { data.value = option.value; sound('select'); await apply(id, option.value); }
        return;
      }
      return actionBase.call(this, action, source);
    };
  }
  // Pointer: the arrows on a choice step it, a press on a slider's track seeks; both instead of the row's action.
  document.addEventListener('click', event => {
    if (!isOpen()) return;
    const arrow = event.target.closest?.('[data-aero-step]');
    const track = event.target.closest?.('[data-aero-track]');
    const row = (arrow || track)?.closest('.as-row');
    if (!row) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    area = 'rows';
    focus(row);
    if (arrow) { step(row.dataset.id, Number(arrow.dataset.aeroStep)); return; }
    const data = rowData.get(row.dataset.id);
    if (!data) return;
    const box = track.getBoundingClientRect();
    const { min = 0, max = 100, step: by = 1 } = data.entry;
    const value = Math.round((min + ((event.clientX - box.left) / box.width) * (max - min)) / by) * by;
    data.value = Math.max(min, Math.min(max, value));
    row.querySelector('.as-ctl').innerHTML = control(row.dataset.id, 'slider', data.value, [], data.entry);
    apply(row.dataset.id, data.value);
  }, true);
  // Hovering a category with the mouse shows it, like moving onto it with the controller.
  screen.addEventListener('pointerover', event => {
    const cat = event.target.closest?.('.as-cat');
    if (!cat || cat.dataset.cat === current.id || list) return;
    showCategory(CATEGORIES.find(item => item.id === cat.dataset.cat));
  });
  // A change made elsewhere (the quick menu, a hotkey) shows up in the open list straight away.
  document.addEventListener('g-setting-change', event => {
    const id = event.detail?.id;
    if (!isOpen() || !id || !rowData.has(id) || list?.id === id) return;
    refreshRow(id);
  });

  // ---------- The Settings button, Customize and the launcher's own pages all come here ----------
  if (typeof openSettings === 'function') {
    const openBase = openSettings;
    openSettings = async function (...args) {
      if (on()) { await open(); return undefined; }
      return openBase.apply(this, args);
    };
  }
  if (typeof showSettingsPage === 'function') {
    const pageBase = showSettingsPage;
    showSettingsPage = function (page, ...rest) {
      if (on() && !screen.hidden && !document.querySelector('dialog[open]') && PAGE_TO_CAT[page]) { enterCategory(PAGE_TO_CAT[page]); return undefined; }
      return pageBase.apply(this, [page, ...rest]);
    };
  }
  // Choosing a PlayStation or Nintendo theme closes this screen and opens that theme's own Settings; choosing
  // another Xbox theme or Helix keeps you here, restyled.
  new MutationObserver(() => {
    if (screen.hidden) return;
    if (on()) { showCategory(current, { keepFocusId: document.activeElement?.dataset?.id || '' }); return; }
    screen.hidden = true;
    document.body.classList.remove('g-aero-settings-open');
    setTimeout(() => { try { openSettings(); } catch { /* Not ready. */ } }, 60);
  }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme', 'data-g-skin'] });

  window.gAeroSettings = { open, close, isOpen: () => !screen.hidden };
})();
