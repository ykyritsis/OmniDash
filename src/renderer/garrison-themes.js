// Console themes. The launcher keeps one set of screens and behaviour; a theme only changes how they look.
//
//  - Helix: the full-screen Xbox PC look this launcher started with. Glassy, quiet, next-gen.
//  - Series: the Xbox Series X|S dashboard. The selected game's art fills the screen behind a low row of
//    square tiles, the icon bar names the focused item, and an idle screen shows the green swirl.
//  - One: the 2013 Xbox One dashboard. Flat Metro tiles, panorama headings across the top, a Pins wall,
//    a big "last played" tile, and the clock in the corner.
//
// The choice is saved with the other settings (prefs:set 'theme') and mirrored in localStorage, so the right
// theme paints before the settings file has been read.
(() => {
  // Era-correct icons: each Fluent icon also carries its Segoe MDL2 Assets twin (the Metro icon font of the
  // Xbox One and 360 era, built into Windows). The One and 360 themes show the MDL2 glyph; others the Fluent one.
  const MDL2 = { game: '', shop: '', friends: '', contact: '', settings: '', search: '', library: '',
    grid: '', headset: '', addFriend: '', power: '', shield: '', color: '', chat: '', download: '' };
  if (typeof gIcon === 'function') {
    const fluent = gIcon;
    gIcon = function (name, ...rest) {
      const svg = fluent.call(this, name, ...rest);
      return MDL2[name] ? `${svg}<i class="g-mdl2" aria-hidden="true">${MDL2[name]}</i>` : svg;
    };
  }
  const THEMES = [
    { id: 'helix', name: 'Helix', era: 'Next generation', blurb: 'The full-screen Xbox PC look. Clean, glassy and quiet.' },
    { id: 'series', name: 'Series', era: 'Xbox Series X|S', blurb: 'Your game’s art behind the dashboard, square tiles and the green swirl.' },
    { id: 'one', name: 'One', era: 'Xbox One, 2013', blurb: 'Flat Metro tiles, panorama headings and a wall of pins.' },
    { id: 'ps3', name: 'PS3', era: 'PlayStation 3 XMB', blurb: 'The XrossMediaBar: a glowing wave over the month\'s colour, categories across and items down.' },
    { id: 'ps4', name: 'PS4', era: 'PlayStation 4', blurb: 'The deep-blue home: a function row, then a row of square tiles with the game\'s art behind.' },
    { id: 'wii', name: 'Wii', era: 'Wii Menu', blurb: 'The channel grid, the Wii button and clock bar, and the channel preview with Start.' },
    { id: '3ds', name: '3DS', era: 'Nintendo 3DS HOME Menu', blurb: 'Both screens side by side on one display: the game\'s banner and status bar, and your icons on the touch screen.' },
    { id: 'x360', name: '360', era: 'Xbox 360 Metro, 2011', blurb: 'The lime-green Metro dashboard: lowercase pivots, a featured tile and the grey studio. With DashX360 assets by ZivvoZ when installed.' }
  ];
  const valid = id => THEMES.some(theme => theme.id === id);
  let current = 'helix';
  try { const saved = localStorage.getItem('g-theme'); if (valid(saved)) current = saved; } catch { /* Storage unavailable. */ }

  // Wallpaper behind everything: the Series swirl, or the Xbox One's planet horizon.
  const wall = document.createElement('div');
  wall.id = 'g-theme-wall';
  wall.setAttribute('aria-hidden', 'true');
  wall.innerHTML = `
    <svg class="g-wall-series" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="g-swirl-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d0b"/><stop offset=".55" stop-color="#1f8f1f"/><stop offset="1" stop-color="#062306"/></linearGradient>
        <linearGradient id="g-swirl-b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9bf00b" stop-opacity=".0"/><stop offset=".5" stop-color="#5dc21e" stop-opacity=".55"/><stop offset="1" stop-color="#107c10" stop-opacity="0"/></linearGradient>
        <radialGradient id="g-swirl-glow" cx=".7" cy=".75" r=".7"><stop offset="0" stop-color="#2d9b2d" stop-opacity=".55"/><stop offset="1" stop-color="#041004" stop-opacity="0"/></radialGradient>
        <filter id="g-swirl-soft"><feGaussianBlur stdDeviation="6"/></filter>
      </defs>
      <rect width="1600" height="900" fill="#041404"/>
      <rect width="1600" height="900" fill="url(#g-swirl-glow)"/>
      <g class="g-swirl-ribbons">
        <path d="M-120 700 C 260 520, 520 980, 900 760 S 1500 420, 1760 560 L 1760 1000 L -120 1000 Z" fill="url(#g-swirl-a)" opacity=".85"/>
        <path d="M-160 620 C 240 430, 620 860, 980 640 S 1480 300, 1780 430" fill="none" stroke="url(#g-swirl-b)" stroke-width="70" filter="url(#g-swirl-soft)"/>
        <path d="M-160 760 C 300 600, 640 1010, 1040 800 S 1520 520, 1800 640" fill="none" stroke="#7fd84a" stroke-opacity=".22" stroke-width="3"/>
        <path d="M-160 800 C 300 660, 700 1040, 1080 850 S 1560 600, 1800 700" fill="none" stroke="#b6f56a" stroke-opacity=".12" stroke-width="2"/>
      </g>
    </svg>
    <div class="g-wall-one"><i class="g-one-stars"></i><i class="g-one-planet"></i><i class="g-one-glow"></i></div>`;
  document.body.prepend(wall);

  // The One's Pins wall sits beside the last-played tiles on Home. Its tiles use the launcher's own actions.
  const pins = document.createElement('div');
  pins.id = 'g-one-pins';
  pins.setAttribute('role', 'group');
  pins.setAttribute('aria-label', 'Pins');
  const pin = (action, icon, label, tone = '') => `<button class="g-one-pin focusable${tone ? ' ' + tone : ''}" type="button" data-action="${action}" aria-label="${label}">${typeof gIcon === 'function' ? gIcon(icon) : ''}<span>${label}</span></button>`;
  pins.innerHTML = pin('library', 'library', 'My games & apps', 'wide') + pin('dashboard-store', 'shop', 'Store') + pin('dashboard-gamepass', 'game', 'Game Pass')
    + pin('g-friends', 'friends', 'Friends', 'blue') + pin('g-account', 'contact', 'Achievements') + pin('settings', 'settings', 'Settings') + pin('toggle-search', 'search', 'Search', 'blue');
  const recentShelf = document.querySelector('#home-view .dashboard-recent');
  recentShelf?.insertBefore(pins, recentShelf.querySelector('#recent-row'));

  // One: the clock lives in the bottom-right corner, as it did on the console.
  const clock = document.createElement('time');
  clock.id = 'g-one-clock';
  clock.setAttribute('aria-hidden', 'true');
  document.body.append(clock);
  const tick = () => { clock.textContent = window.gSettings?.formatClock ? window.gSettings.formatClock(new Date()) : new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };
  tick(); setInterval(tick, 15000);

  // Picker cards, shared by onboarding and Settings. Each preview is a tiny drawing of that dashboard.
  const preview = id => ['ps3', 'ps4', 'wii', '3ds'].includes(id) ? `<span class="g-tp g-tp-${id}"></span>` : id === 'x360'
    ? '<span class="g-tp g-tp-360"><b class="p"></b><b class="p on"></b><b class="p"></b><b class="p"></b><i class="g"></i><i class="g"></i><i class="big"></i><i class="ad"></i><i class="ad"></i></span>'
    : id === 'one'
    ? '<span class="g-tp g-tp-one"><b class="h"></b><b class="h dim"></b><b class="h dim"></b><i class="big"></i><i></i><i class="blue"></i><i></i><i></i><i class="blue"></i></span>'
    : id === 'series'
      ? '<span class="g-tp g-tp-series"><b class="bar"></b><span class="row"><i class="on"></i><i></i><i></i><i></i><i></i></span><span class="wide"><i></i><i></i><i></i></span></span>'
      : '<span class="g-tp g-tp-helix"><b class="bar"></b><span class="row"><i class="on"></i><i></i><i></i><i></i></span><span class="row low"><i></i><i></i><i></i></span></span>';
  const pickerMarkup = () => `<div class="g-theme-picker" role="radiogroup" aria-label="Theme">${THEMES.map(theme => `
    <button class="g-theme-card focusable${theme.id === current ? ' on' : ''}" type="button" role="radio" aria-checked="${theme.id === current}" data-g-theme-pick="${theme.id}">
      ${preview(theme.id)}
      <span class="g-theme-copy"><strong>${theme.name}</strong><em>${theme.era}</em><small>${theme.blurb}</small></span>
    </button>`).join('')}</div>`;
  function refreshPickers() {
    for (const card of document.querySelectorAll('[data-g-theme-pick]')) {
      const on = card.dataset.gThemePick === current;
      card.classList.toggle('on', on);
      card.setAttribute('aria-checked', String(on));
    }
  }

  const settingsPage = document.querySelector('[data-settings-page="personalization"]');
  if (settingsPage) settingsPage.insertAdjacentHTML('afterbegin', `<section class="g-setting-group g-theme-section" aria-labelledby="g-theme-heading">
    <h3 id="g-theme-heading">Theme</h3><p class="g-setting-note">Pick the console generation the dashboard looks like. Your games and settings stay the same.</p>
    ${pickerMarkup()}</section>`);
  // Onboarding's Welcome step: pick a dashboard before anything else.
  if (typeof renderOnboarding === 'function') {
    const onboardBase = renderOnboarding;
    renderOnboarding = function (...args) {
      const result = onboardBase.apply(this, args);
      const hero = onboardingDialog.querySelector('.g-onboard-stage[data-step="0"] .g-onboard-hero');
      if (hero && !hero.querySelector('.g-theme-onboard')) {
        hero.querySelector('.g-onboard-primary')?.insertAdjacentHTML('beforebegin', `<div class="g-theme-onboard"><strong>Choose your dashboard</strong>${pickerMarkup()}</div>`);
        if (typeof refreshFocusables === 'function') refreshFocusables();
      }
      return result;
    };
  }

  document.addEventListener('click', event => {
    const card = event.target.closest?.('[data-g-theme-pick]');
    if (!card) return;
    apply(card.dataset.gThemePick);
    if (typeof playUiSound === 'function') try { playUiSound('select'); } catch { /* Sound is optional. */ }
  });

  // One: the Home tiles form a Metro grid, so moving around them uses plain spatial navigation instead of the
  // Home row's left/right list order.
  if (typeof navigateConsoleHome === 'function') {
    const homeBase = navigateConsoleHome;
    navigateConsoleHome = function (direction, focused) {
      if (current === 'one' && focused?.closest?.('#recent-row, #g-one-pins')) {
        if (direction !== 'up') return false;
        // Up from the top row goes to the panorama headings, never to a neighbouring tile.
        const rowTop = Math.min(...[...document.querySelectorAll('#g-one-pins .focusable, #recent-row .focusable')].filter(el => el.offsetParent).map(el => el.getBoundingClientRect().top));
        if (focused.getBoundingClientRect().top - rowTop > 20) return false;
        setFocusedElement(document.querySelector('.top-center-nav .top-nav-button.active') || document.querySelector('.top-center-nav .focusable'), { scroll: false });
        return true;
      }
      return homeBase.call(this, direction, focused);
    };
  }

  function apply(id, save = true) {
    if (!valid(id)) return;
    const changed = id !== current;
    current = id;
    document.body.dataset.gTheme = id;
    // Every console theme shares the console behaviour (full-screen library, no hint bar, splash, no scrollbars).
    if (id === 'helix') delete document.body.dataset.gConsole; else document.body.dataset.gConsole = id;
    refreshPickers();
    if (!save) return;
    try { localStorage.setItem('g-theme', id); } catch { /* Storage unavailable. */ }
    window.launcher?.setPref?.('theme', id).catch(() => {});
    if (changed) {
      document.body.classList.add('g-theme-switching');
      setTimeout(() => document.body.classList.remove('g-theme-switching'), 420);
      try { if (typeof refreshFocusables === 'function') refreshFocusables(); } catch { /* Not ready. */ }
    }
  }
  apply(current, false);
  window.launcher?.getPrefs?.().then(prefs => {
    if (!valid(prefs?.theme) || prefs.theme === current) return;
    apply(prefs.theme, false);
    try { localStorage.setItem('g-theme', prefs.theme); } catch { /* Storage unavailable. */ }
  }).catch(() => {});

  window.gSetTheme = id => apply(id);
  window.gTheme = () => current;
  window.gThemes = THEMES;
})();
