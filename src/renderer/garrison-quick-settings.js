// Quick settings: a button in the top bar opens a panel with battery, Wi-Fi, volume, brightness and power plan.
// Controls are buttons, so they work with a controller. Changes show at once and are sent to Windows a moment
// later (each one takes a second to apply). A part this PC doesn't have, such as a battery on a desktop, is left out.
(function buildQuickSettings() {
  const actions = document.querySelector('.top-actions');
  if (!actions || typeof gFlyout !== 'function') return;
  const settingsButton = actions.querySelector('.g-icon-button[data-action="settings"]');
  const button = document.createElement('button');
  button.id = 'g-quick-button';
  button.type = 'button';
  button.className = 'g-icon-button focusable';
  button.dataset.action = 'g-quick';
  button.dataset.gLabel = 'Quick settings';
  button.setAttribute('aria-label', 'Quick settings');
  button.setAttribute('aria-haspopup', 'dialog');
  button.innerHTML = gIcon('volume');
  actions.insertBefore(button, settingsButton || actions.firstChild);

  const menu = gFlyout('g-quick-dialog', 'g-quick-flyout', 'Quick settings');
  let quick = null, pollTimer = 0;
  const pending = new Map();

  // Status tiles (Wi-Fi, battery) along the top, a meter row for each level you can change, then the power plan
  // as one segmented control.
  const tile = (icon, title, detail) => `<div class="g-quick-tile">${gIcon(icon)}<strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>`;
  const stepper = (action, label) => `<button class="g-quick-step focusable" type="button" data-action="${action}" data-delta="-1" aria-label="Lower ${label}">−</button><button class="g-quick-step focusable" type="button" data-action="${action}" data-delta="1" aria-label="Raise ${label}">+</button>`;
  const slider = (icon, title, level, value, controls, muted = false) => `<div class="g-quick-slider${muted ? ' muted' : ''}">${gIcon(icon)}<span class="g-quick-meter"><span><b>${escapeHtml(title)}</b><em>${escapeHtml(value)}</em></span><i class="g-quick-track"><i style="width:${Math.max(0, Math.min(100, level))}%"></i></i></span><span class="g-quick-controls">${controls}</span></div>`;
  // Windows' own plan names are long; the control has room for one short word each.
  const planName = name => ({ 'high performance': 'Performance', 'ultimate performance': 'Ultimate', 'power saver': 'Saver' })[String(name).toLowerCase()] || name;

  function markup() {
    if (!quick) return '<header><h2>Quick settings</h2></header><p class="g-quick-note" role="status">Reading this PC…</p>';
    const tiles = [];
    if (quick.wifi) tiles.push(tile('wifi', 'Wi-Fi', quick.wifi.connected ? `${quick.wifi.ssid || 'Connected'}${quick.wifi.signal !== null ? ` · ${quick.wifi.signal}%` : ''}` : 'Not connected'));
    if (quick.battery) tiles.push(tile('battery', `${quick.battery.percent}%`, quick.battery.charging ? 'Charging' : 'On battery'));
    const sliders = [];
    if (quick.volume) sliders.push(slider(quick.volume.muted ? 'mute' : 'volume', 'Volume', quick.volume.muted ? 0 : quick.volume.level, quick.volume.muted ? 'Muted' : `${quick.volume.level}%`,
      `${stepper('g-quick-volume', 'volume')}<button class="g-quick-step focusable${quick.volume.muted ? ' on' : ''}" type="button" data-action="g-quick-mute" aria-label="${quick.volume.muted ? 'Unmute' : 'Mute'}" aria-pressed="${quick.volume.muted}">${gIcon('mute')}</button>`, quick.volume.muted));
    if (quick.brightness !== null) sliders.push(slider('brightness', 'Brightness', quick.brightness, `${quick.brightness}%`, stepper('g-quick-brightness', 'brightness')));
    const plans = quick.plans.length ? `<h3>Power mode</h3><div class="g-quick-plans" role="radiogroup" aria-label="Power mode">${quick.plans.map(plan =>
      `<button class="g-quick-plan focusable${plan.active ? ' on' : ''}" type="button" role="radio" aria-checked="${plan.active}" aria-label="${escapeHtml(plan.name)}" data-action="g-quick-plan" data-guid="${escapeHtml(plan.guid)}">${escapeHtml(planName(plan.name))}</button>`).join('')}</div>` : '';
    const body = (tiles.length ? `<div class="g-quick-tiles">${tiles.join('')}</div>` : '') + (sliders.length ? `<div class="g-quick-sliders">${sliders.join('')}</div>` : '');
    return `<header><h2>Quick settings</h2></header>${body || '<p class="g-quick-note">This PC has nothing to adjust here.</p>'}${plans}`;
  }
  function draw(keep) {
    menu.innerHTML = markup();
    refreshFocusables();
    if (keep) setFocusedElement(menu.querySelector(keep) || menu.querySelector('.focusable'), { scroll: false });
  }
  async function load(withVolume) {
    try {
      const fresh = await window.launcher.getQuickSettings({ volume: withVolume });
      // A background refresh keeps the volume you are adjusting, which it doesn't re-read.
      quick = { ...fresh, volume: withVolume ? fresh.volume : (quick?.volume || null) };
    } catch { quick = quick || { battery: null, wifi: null, brightness: null, volume: null, plans: [] }; }
    if (menu.open) draw(document.activeElement?.closest?.('#g-quick-dialog') ? `[data-action="${document.activeElement.dataset.action}"]${document.activeElement.dataset.delta ? `[data-delta="${document.activeElement.dataset.delta}"]` : ''}${document.activeElement.dataset.guid ? `[data-guid="${CSS.escape(document.activeElement.dataset.guid)}"]` : ''}` : '');
  }
  // Windows applies a change about a second after it's asked for; wait until the presses stop.
  function send(kind, value) {
    clearTimeout(pending.get(kind));
    pending.set(kind, setTimeout(() => { window.launcher.setQuickSetting(kind, value).catch(error => showToast(error.message || 'Could not change this setting')); }, 350));
  }

  menu.addEventListener('close', () => { clearInterval(pollTimer); pollTimer = 0; });
  const perform = performAction;
  performAction = async function (action, source) {
    if (action === 'g-quick') {
      if (menu.open) { menu.close(); return; }
      quick = null;
      openGFlyout(menu, button, markup(), button);
      const box = button.getBoundingClientRect();
      menu.style.cssText = `right:${Math.max(12, innerWidth - box.right)}px;left:auto;top:${box.bottom + 8}px;bottom:auto`;
      await load(true);
      draw('.focusable');
      pollTimer = setInterval(() => { if (menu.open && document.hasFocus()) load(false); }, 8000);
      return;
    }
    if (action === 'g-quick-volume' && quick?.volume) {
      quick.volume.level = Math.max(0, Math.min(100, quick.volume.level + 5 * Number(source.dataset.delta)));
      if (quick.volume.level > 0) quick.volume.muted = false;
      draw(`[data-action="g-quick-volume"][data-delta="${source.dataset.delta}"]`);
      send('volume', quick.volume.level);
      return;
    }
    if (action === 'g-quick-mute' && quick?.volume) {
      quick.volume.muted = !quick.volume.muted;
      draw('[data-action="g-quick-mute"]');
      send('mute', quick.volume.muted);
      return;
    }
    if (action === 'g-quick-brightness' && quick?.brightness !== null && quick) {
      quick.brightness = Math.max(0, Math.min(100, quick.brightness + 10 * Number(source.dataset.delta)));
      draw(`[data-action="g-quick-brightness"][data-delta="${source.dataset.delta}"]`);
      send('brightness', quick.brightness);
      return;
    }
    if (action === 'g-quick-plan' && quick) {
      for (const plan of quick.plans) plan.active = plan.guid === source.dataset.guid;
      draw(`[data-guid="${CSS.escape(source.dataset.guid)}"]`);
      send('plan', source.dataset.guid);
      return;
    }
    return perform(action, source);
  };
})();
