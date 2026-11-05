// Handheld comforts: the battery in the top bar (with charging), a low-battery pop-up at 20% and 10%, and a clean
// return from sleep: the dashboard refreshes in place, without a reload, and forgets buttons held across sleep.
(() => {
  'use strict';
  let battery = null, warned = 0;
  const markup = () => {
    if (!battery) return '';
    const level = Math.round(battery.level * 100);
    const fill = Math.max(1.5, Math.round(battery.level * 13 * 10) / 10);
    const low = !battery.charging && level <= 20;
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.75" y="7" width="16.5" height="10" rx="2.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M20.5 10h.25c.55 0 1 .45 1 1v2c0 .55-.45 1-1 1h-.25v-4Z" fill="currentColor"/><rect x="4.5" y="8.75" width="${fill}" height="6.5" rx="1" fill="${low ? '#ff5a4f' : 'currentColor'}"/>${battery.charging ? '<path d="M12.2 7.6 8.6 12.4h2.6l-.9 4 3.7-4.9h-2.6l.8-3.9Z" fill="#fff" stroke="#000" stroke-width=".6" stroke-linejoin="round"/>' : ''}</svg><span>${level}%</span>`;
  };
  function paint() {
    if (!battery) return;
    const html = markup();
    const level = Math.round(battery.level * 100);
    const label = `Battery ${level}%${battery.charging ? ', charging' : ''}`;
    const spots = [document.querySelector('.top-actions'), document.querySelector('#g-ps5 .p5-status')].filter(Boolean);
    for (const spot of spots) {
      let el = spot.querySelector(':scope > .g-battery');
      if (!el) { el = document.createElement('span'); el.className = 'g-battery'; el.setAttribute('role', 'img'); spot.prepend(el); }
      if (el.innerHTML !== html) el.innerHTML = html;
      el.setAttribute('aria-label', label);
      el.classList.toggle('low', !battery.charging && level <= 20);
    }
  }
  function check() {
    paint();
    if (battery.charging) { warned = 0; return; }
    const level = Math.round(battery.level * 100);
    const threshold = level <= 10 ? 10 : level <= 20 ? 20 : 0;
    if (threshold && threshold !== warned && (!warned || threshold < warned)) {
      warned = threshold;
      window.gLive?.({ kind: 'battery', title: `Battery low · ${level}%`, detail: threshold === 10 ? 'Plug in soon to keep playing' : 'Plug in to charge' });
    }
  }
  // Only a PC with a battery shows one: Windows' own report (read once) tells a desktop from a full laptop.
  setTimeout(async () => {
    const quick = await window.launcher.getQuickSettings?.({ volume: false }).catch(() => null);
    if (!quick?.battery || typeof navigator.getBattery !== 'function') return;
    battery = await navigator.getBattery().catch(() => null);
    if (!battery) return;
    for (const event of ['levelchange', 'chargingchange']) battery.addEventListener(event, check);
    check();
    // Theme switches rebuild the top bars; put the battery back when they do.
    setInterval(paint, 15000);
    new MutationObserver(() => { if (!document.querySelector('.g-battery')) paint(); }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme', 'data-g-skin'] });
  }, 3500);

  // ---------- Sleep and wake ----------
  window.launcher.onSystemPower?.(async kind => {
    if (kind === 'suspend') { state.previousButtons = []; state.heldDirection = ''; return; }
    state.previousButtons = []; state.heldDirection = '';
    await new Promise(resolve => setTimeout(resolve, 1200));
    await refreshActiveGameSession().catch(() => {});
    if (state.activeGameSession) return;
    refreshGarrisonFriends?.().catch?.(() => {});
    const focused = document.activeElement;
    if (state.view === 'home' && typeof renderHomeLibrary === 'function') renderHomeLibrary();
    refreshFocusables();
    if (focused?.isConnected) setFocusedElement(focused, { scroll: false });
    else if (state.view === 'home') { const card = recentRow.querySelector(`.game-card[data-game-id="${CSS.escape(state.selectedGameId || '')}"]`) || recentRow.querySelector('.focusable'); if (card) setFocusedElement(card, { scroll: false }); }
    if (battery) check();
  });
})();
