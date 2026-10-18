// One source of truth for every on-screen button prompt (task G1, plan §2.5).
//
// The console skins print the buttons of the console they are imitating: PlayStation crosses and circles,
// Nintendo's A/B and +/−, Xbox's coloured A/B/X/Y and View/Menu. The drawn sets below are original inline SVG,
// because no console art is shipped in the repo. A player's theme pack can override any glyph by handing the
// helper an explicit map (or a folder it has verified):
//
//   gGlyphs.usePack({ glyphs: { ps3: { cross: 'file:///…/cross.png', … } } })
//   gGlyphs.setPackBase('ps3', 'file:///…/theme-packs/glyphs/ps3/')
//
// Discovery is opt-in: OmniDash never guesses at a pack path, so a pack with no glyphs costs zero requests and
// never writes a failed-load error into the review log. The drawn set is always the fallback.
//
// Public API (window.gGlyphs):
//   icon(console, name)         inline SVG (or the pack image) for one button
//   row(console, items)         a hint row, [{ button, label }] or [{ buttons: [...], label }]
//   face(console)               { confirm, back, confirmIndex, backIndex } from Enter Button / Nintendo Layout
//   name(console, token)        resolve a button name, including @confirm/@back/@options/@menu/@search
//   prompts[console].home       the console's canonical home prompt row
//   has(console, name)          whether the console's drawn set covers a name
//   usePack(pack)               opt in to a pack ({ base, available } from theme:retro-pack / theme:pack)
//   setPackBase(console, base)  opt in one console to a pack base URL
//   refresh()                   repaint every generated row (called on g-setting-change too)
//
// The module also upgrades the prompts owned by the files that cannot be changed for this task (the keyboard,
// the shared bottom hint bar, the settings shell footer and the account overlays): on every DOM change it finds
// the known hint containers and replaces their text token with the current console's glyph, live.
(function (root, factory) {
  const api = factory(root && root.document ? root : null, root && root.document ? root.document : null);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.gGlyphs = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (win, doc) {
  'use strict';

  const CONSOLES = ['ps3', 'ps4', 'wii', '3ds', 'series', 'one', 'x360'];
  const PLAYSTATION = ['ps3', 'ps4'];
  const NINTENDO = ['wii', '3ds'];
  const XBOX = ['series', 'one', 'x360'];
  const GHOST = 'rgba(255,255,255,.16)';
  const esc = text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- SVG ----------
  const svg = (box, body) => `<svg viewBox="0 0 ${box[0]} ${box[1]}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
  const stroke = 'fill="none" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"';
  const text = (x, y, size, value, weight = 700, fill = 'currentColor', extra = '') =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra}>${esc(value)}</text>`;
  // A pill button with a word on it (L1, OPTIONS, LB, View...). Width follows the word's length.
  const pill = (word, size = 8.5, boxW = 44) => svg([boxW, 32], `<rect x="2" y="7" width="${boxW - 4}" height="18" rx="7" fill="${GHOST}" stroke="currentColor" stroke-width="1.6"/>${text(boxW / 2, 16.5, size, word, 700)}`);
  // A trigger: the flatter cap above a shoulder button.
  const trigger = (word, size = 8, boxW = 44) => svg([boxW, 32], `<path d="M4 17c0-4.5 2-7 5-8h${boxW - 18}c3 1 5 3.5 5 8l-2 8H6Z" fill="${GHOST}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>${text(boxW / 2, 17, size, word, 700)}`);
  // A round face button with a letter (Xbox, Nintendo).
  const faceButton = (letter, fill, letterFill = '#fff', ring = 'rgba(0,0,0,.28)') => svg([32, 32],
    `<circle cx="16" cy="16" r="12" fill="${fill}" stroke="${ring}" stroke-width="1.2"/>${text(16, 16.7, 15, letter, 700, letterFill)}`);
  // A PlayStation symbol, drawn the way the console prints it in a hint: the shape alone, no button ring.
  const psSymbol = body => svg([32, 32], body);
  const dPad = svg([32, 32], `<path d="M12.6 5.5h6.8v7.1h7.1v6.8h-7.1v7.1h-6.8v-7.1H5.5v-6.8h7.1Z" fill="currentColor" opacity=".9"/>`);
  const keycap = value => {
    const boxW = Math.max(30, 12 + String(value).length * 8.5);
    return svg([boxW, 32], `<rect x="2" y="6" width="${boxW - 4}" height="20" rx="5" fill="${GHOST}" stroke="currentColor" stroke-width="1.5"/>${text(boxW / 2, 16.6, String(value).length > 4 ? 7 : 9, value, 600)}`);
  };

  const PS = {
    cross: psSymbol(`<path d="M7 7 25 25M25 7 7 25" ${stroke} stroke-width="3.4"/>`),
    circle: psSymbol(`<circle cx="16" cy="16" r="10" ${stroke} stroke-width="3"/>`),
    triangle: psSymbol(`<path d="M16 5.5 27 24.5H5Z" ${stroke} stroke-width="3"/>`),
    square: psSymbol(`<rect x="6" y="6" width="20" height="20" ${stroke} stroke-width="3"/>`),
    l1: pill('L1', 9, 38), r1: pill('R1', 9, 38),
    l2: trigger('L2', 8.5, 40), r2: trigger('R2', 8.5, 40),
    options: pill('OPTIONS', 6.6, 56),
    share: pill('SHARE', 7, 48),
    ps: svg([32, 32], `<circle cx="16" cy="16" r="12.5" fill="currentColor" opacity=".18"/><circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" stroke-width="1.2"/>${text(16, 16.6, 9.5, 'PS', 700)}`),
    touchpad: svg([44, 32], `<rect x="4" y="5" width="36" height="22" rx="4" ${stroke} stroke-width="1.8"/>`),
    dpad: dPad,
    up: svg([32, 32], `<path d="M16 7 26 20H6Z" fill="currentColor"/>`),
    down: svg([32, 32], `<path d="M16 25 6 12h20Z" fill="currentColor"/>`),
    left: svg([32, 32], `<path d="M7 16 20 6v20Z" fill="currentColor"/>`),
    right: svg([32, 32], `<path d="M25 16 12 26V6Z" fill="currentColor"/>`)
  };

  const NINTENDO_FACE = {
    a: faceButton('A', 'rgba(255,255,255,.14)', 'currentColor', 'currentColor'),
    b: faceButton('B', 'rgba(255,255,255,.14)', 'currentColor', 'currentColor'),
    x: faceButton('X', 'rgba(255,255,255,.14)', 'currentColor', 'currentColor'),
    y: faceButton('Y', 'rgba(255,255,255,.14)', 'currentColor', 'currentColor')
  };
  const plus = svg([32, 32], `<circle cx="16" cy="16" r="11.5" fill="${GHOST}" stroke="currentColor" stroke-width="1.6"/><path d="M16 9v14M9 16h14" ${stroke} stroke-width="2.8"/>`);
  const minus = svg([32, 32], `<circle cx="16" cy="16" r="11.5" fill="${GHOST}" stroke="currentColor" stroke-width="1.6"/><path d="M9 16h14" ${stroke} stroke-width="2.8"/>`);
  const home = svg([32, 32], `<path d="M6 15 16 6l10 9v11H6Z" ${stroke} stroke-width="2.6"/><path d="M12.5 26v-7h7v7" ${stroke} stroke-width="2.2"/>`);
  const NINTENDO_COMMON = {
    ...NINTENDO_FACE,
    plus, minus,
    '＋': plus, '−': minus,
    home,
    l: pill('L', 10, 34), r: pill('R', 10, 34),
    zl: trigger('ZL', 8.5, 40), zr: trigger('ZR', 8.5, 40),
    dpad: dPad,
    up: PS.up, down: PS.down, left: PS.left, right: PS.right
  };

  const XB = { a: '#6cc644', b: '#e5464b', x: '#2f7fe6', y: '#e8c21c' };
  const xboxFace = letter => faceButton(letter.toUpperCase(), XB[letter]);
  const XBOX_SET = {
    a: xboxFace('a'), b: xboxFace('b'), x: xboxFace('x'), y: xboxFace('y'),
    lb: pill('LB', 9, 38), rb: pill('RB', 9, 38),
    lt: trigger('LT', 8.5, 40), rt: trigger('RT', 8.5, 40),
    view: svg([44, 32], `<rect x="5" y="9" width="17" height="14" rx="2.5" ${stroke} stroke-width="2"/><rect x="18" y="7" width="20" height="11" rx="2.5" ${stroke} stroke-width="2"/>`),
    menu: svg([32, 32], `<path d="M7 10h18M7 16h18M7 22h18" ${stroke} stroke-width="3"/>`),
    start: svg([32, 32], `<path d="M9 8h5l9 8-9 8H9l9-8Z" ${stroke} stroke-width="2.4"/><path d="M23 9v14" ${stroke} stroke-width="2.4"/>`),
    back: svg([32, 32], `<path d="M23 8h-5l-9 8 9 8h5l-9-8Z" fill="currentColor"/>`),
    guide: svg([32, 32], `<circle cx="16" cy="16" r="12" ${stroke} stroke-width="2"/><path d="M9 10q7 5 14 12M23 10Q16 15 9 22" ${stroke} stroke-width="1.8"/>`),
    dpad: dPad,
    up: PS.up, down: PS.down, left: PS.left, right: PS.right
  };

  // Every console owns a complete, independent set so a skin can never accidentally borrow another's glyph.
  const SETS = {
    ps3: { ...PS },
    ps4: { ...PS },
    wii: { ...NINTENDO_COMMON },
    '3ds': { ...NINTENDO_COMMON },
    series: { ...XBOX_SET },
    one: { ...XBOX_SET },
    x360: { ...XBOX_SET }
  };

  const LABELS = {
    cross: 'Cross', circle: 'Circle', triangle: 'Triangle', square: 'Square',
    l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', options: 'OPTIONS', share: 'SHARE', ps: 'PS', touchpad: 'Touch pad',
    a: 'A', b: 'B', x: 'X', y: 'Y', plus: '+', minus: '-', home: 'HOME', l: 'L', r: 'R', zl: 'ZL', zr: 'ZR',
    lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', view: 'View', menu: 'Menu', start: 'Menu', guide: 'Guide',
    dpad: 'D-pad', up: 'Up', down: 'Down', left: 'Left', right: 'Right'
  };
  const REQUIRED = {
    ps3: ['cross', 'circle', 'triangle', 'square', 'l1', 'r1', 'l2', 'r2', 'options', 'share', 'ps', 'dpad'],
    ps4: ['cross', 'circle', 'triangle', 'square', 'l1', 'r1', 'l2', 'r2', 'options', 'share', 'ps', 'dpad'],
    wii: ['a', 'b', 'x', 'y', 'plus', 'minus', 'home', 'l', 'r', 'zl', 'zr', 'dpad'],
    '3ds': ['a', 'b', 'x', 'y', 'plus', 'minus', 'home', 'l', 'r', 'zl', 'zr', 'dpad'],
    series: ['a', 'b', 'x', 'y', 'lb', 'rb', 'view', 'menu', 'lt', 'rt', 'dpad'],
    one: ['a', 'b', 'x', 'y', 'lb', 'rb', 'view', 'menu', 'lt', 'rt', 'dpad'],
    x360: ['a', 'b', 'x', 'y', 'lb', 'rb', 'view', 'menu', 'lt', 'rt', 'dpad']
  };

  // The canonical home rows from the task. The settings shells and the shared bar use the same helper, so the
  // wording and the order are defined here once. @confirm/@back follow the live settings; the rest are fixed.
  const PROMPTS = {
    ps3: { home: [{ button: '@confirm', label: 'Enter' }, { button: '@back', label: 'Back' }, { button: '@options', label: 'Options' }] },
    ps4: { home: [{ button: '@confirm', label: 'Enter' }, { button: '@back', label: 'Back' }, { button: '@options', label: 'Options' }] },
    wii: { home: [{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Back' }, { buttons: ['plus', 'minus'], label: 'Page' }] },
    '3ds': { home: [{ button: '@confirm', label: 'OK' }, { button: '@back', label: 'Back' }, { button: '@options', label: 'Options' }] },
    series: { home: [{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Back' }, { button: 'menu', label: 'Options' }] },
    one: { home: [{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Back' }, { button: 'menu', label: 'Options' }] },
    x360: { home: [{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Back' }, { button: 'menu', label: 'Options' }, { button: 'y', label: 'Search' }] }
  };

  const currentConsole = () => {
    const id = doc?.body?.dataset?.gTheme || win?.document?.body?.dataset?.gTheme || '';
    return SETS[id] ? id : null;
  };

  // PlayStation's Enter Button and Nintendo's A/B layout change both the picture and which physical button is
  // confirm. The pad layer already reads the same two prefs in app.js pollGamepad(); this is the one place the
  // hints read them, so the prompt and the pad can never disagree.
  function face(consoleId) {
    const id = consoleId || currentConsole() || 'series';
    const settings = win?.gSettings;
    const enterO = settings?.cached?.('enterButton') === 'o';
    const nintendo = settings?.cached?.('nintendoLayout') === true;
    if (PLAYSTATION.includes(id)) {
      return enterO
        ? { confirm: 'circle', back: 'cross', confirmIndex: 1, backIndex: 0, layout: 'playstation-o' }
        : { confirm: 'cross', back: 'circle', confirmIndex: 0, backIndex: 1, layout: 'playstation-x' };
    }
    if (NINTENDO.includes(id)) {
      // Nintendo layout moves A to the right-hand button (physical index 1). The prompt prints the button the
      // pad will send, so the row reads "B Select  A Back" while the setting is on and flips back live.
      return nintendo
        ? { confirm: 'b', back: 'a', confirmIndex: 1, backIndex: 0, layout: 'nintendo' }
        : { confirm: 'a', back: 'b', confirmIndex: 0, backIndex: 1, layout: 'xbox' };
    }
    return { confirm: 'a', back: 'b', confirmIndex: 0, backIndex: 1, layout: 'xbox' };
  }

  // Physical-button letters in legacy markup become the console's own glyph: on a PlayStation kbd "B" means
  // circle, on a Nintendo theme the layout setting decides whether B is the back button.
  function physical(id, token) {
    const t = String(token || '').trim();
    if (!t) return null;
    if (PLAYSTATION.includes(id)) return { A: 'cross', B: 'circle', X: 'square', Y: 'triangle' }[t.toUpperCase()] || null;
    if (NINTENDO.includes(id)) {
      const up = t.toUpperCase();
      if (up === 'A') return face(id).confirm;
      if (up === 'B') return face(id).back;
      if (up === 'X') return 'x';
      if (up === 'Y') return 'y';
    }
    return null;
  }

  function name(id, token) {
    const set = SETS[id];
    if (!set || token == null) return null;
    const t = String(token).trim();
    if (!t) return null;
    if (t[0] === '@') {
      if (t === '@confirm') return face(id).confirm;
      if (t === '@back') return face(id).back;
      if (t === '@options') return id === 'ps3' ? 'triangle' : id === 'ps4' ? 'options' : id === '3ds' ? 'x' : id === 'wii' ? 'plus' : 'menu';
      if (t === '@menu') return 'menu';
      if (t === '@search') return id === 'x360' ? 'y' : 'view';
      if (t === '@page') return 'plus';
      if (t === '@dpad') return 'dpad';
      return null;
    }
    const key = t.toLowerCase();
    if (set[key]) return key;
    if (key === '+' || key === '＋') return set.plus ? 'plus' : null;
    if (key === '-' || key === '−' || key === '–') return set.minus ? 'minus' : null;
    if (key === '✕' || key === '×' || key === 'cross') return set.cross ? 'cross' : null;
    if (key === '○' || key === 'o' || key === 'circle') return set.circle ? 'circle' : (set.a ? 'a' : null);
    if (key === '△' || key === 'triangle') return set.triangle ? 'triangle' : (set.y ? 'y' : null);
    if (key === '□' || key === 'square') return set.square ? 'square' : (set.x ? 'x' : null);
    const byLetter = physical(id, t);
    if (byLetter) return byLetter;
    if (key === 'start') return set.start ? 'start' : (set.menu ? 'menu' : null);
    if (key === 'back') return set.back ? 'back' : (set.b ? 'b' : null);
    return null;
  }

  // ---------- Pack override ----------
  // The drawn set is the fallback. A pack opts in by telling the helper where its pictures are:
  //   usePack({ glyphs: { ps3: { cross: 'file:///.../cross.png', circle: '...' } } })   — one URL per glyph
  //   setPackBase('ps3', 'file:///.../theme-packs/glyphs/ps3/')                       — folder convention
  // Discovery is explicit: OmniDash never requests a file a pack did not say it has, so a pack without glyphs
  // costs no 404s and never writes an error into the review log. A future pack manifest can fill this map.
  const packBase = {}, packUrls = {}, packState = {};
  function packUrl(consoleId, glyphName) {
    const explicit = packUrls[consoleId]?.[glyphName];
    if (explicit) return String(explicit);
    const base = packBase[consoleId];
    if (!base) return '';
    const safe = encodeURIComponent(glyphName);
    return `${base}glyphs/${consoleId}/${safe}.png`;
  }
  function setPackBase(consoleId, base) {
    if (!SETS[consoleId] || !base) return;
    packBase[consoleId] = String(base).endsWith('/') ? String(base) : `${base}/`;
    packState[consoleId] = 'idle';
    schedule();
  }
  function usePack(pack) {
    if (!pack || typeof pack !== 'object') return;
    // A pack may hand over a per-console map of glyph URLs. That is the only automatic path: it costs no guess.
    const maps = pack.glyphs && typeof pack.glyphs === 'object' ? pack.glyphs : null;
    if (maps) {
      for (const id of CONSOLES) {
        if (!maps[id] || typeof maps[id] !== 'object') continue;
        packUrls[id] = { ...(packUrls[id] || {}), ...maps[id] };
        packState[id] = 'yes';
      }
      schedule();
    }
    const bases = pack.glyphBase && typeof pack.glyphBase === 'object' ? pack.glyphBase : null;
    if (bases) for (const id of CONSOLES) if (typeof bases[id] === 'string') setPackBase(id, bases[id]);
  }
  const packImage = (consoleId, glyphName) => {
    const explicit = Boolean(packUrls[consoleId]?.[glyphName]);
    if (!win || (!explicit && !packBase[consoleId]) || packState[consoleId] === 'no') return '';
    if (packState[consoleId] !== 'yes' && packState[consoleId] !== 'idle') return '';
    if (!explicit && packState[consoleId] === 'idle') packState[consoleId] = 'probe';
    const src = packUrl(consoleId, glyphName);
    return `<img class="g-glyph-img" src="${esc(src)}" alt="" draggable="false" data-pack-console="${consoleId}" hidden>`;
  };

  function glyphHtml(consoleId, glyphName, extra = '', tag = 'span') {
    const set = SETS[consoleId];
    if (!set) return '';
    const body = set[glyphName];
    if (!body) return '';
    const label = LABELS[glyphName] || glyphName;
    const width = Number((body.match(/viewBox="0 0 ([\d.]+)/) || [])[1]) || 32;
    const w = (1.5 * width / 32).toFixed(2), h = '1.5';
    return `<${tag} class="g-glyph${extra}" data-glyph="${esc(glyphName)}" data-console="${esc(consoleId)}" style="--gw:${w}em;--gh:${h}em" role="img" aria-label="${esc(label)}">${body}${packImage(consoleId, glyphName)}</${tag}>`;
  }
  function icon(consoleId, glyphName) {
    const id = SETS[consoleId] ? consoleId : currentConsole();
    const key = name(id, glyphName) || (SETS[id] && SETS[id][String(glyphName).toLowerCase()] ? String(glyphName).toLowerCase() : null);
    if (key) return glyphHtml(id, key);
    return `<span class="g-glyph g-glyph-key" data-glyph="${esc(glyphName)}" data-console="${esc(id || '')}" role="img" aria-label="${esc(glyphName)}">${keycap(glyphName)}</span>`;
  }

  const buttonsOf = item => item.buttons || [item.button];
  const itemHtml = (consoleId, item) => {
    const buttons = buttonsOf(item).filter(Boolean).map(token => icon(consoleId, token)).join('');
    return `<span class="g-glyph-item" data-buttons="${esc(buttonsOf(item).filter(Boolean).join('+'))}"><span class="g-glyph-buttons">${buttons}</span>${item.label ? `<span class="g-glyph-label">${esc(item.label)}</span>` : ''}</span>`;
  };
  const itemsHtml = (consoleId, items) => items.map(item => itemHtml(consoleId, item)).join('');
  const row = (consoleId, items) => {
    const id = SETS[consoleId] ? consoleId : currentConsole();
    if (!id || !Array.isArray(items) || !items.length) return '';
    return `<span class="g-glyph-row" data-g-glyph-row data-console="${esc(id)}" data-glyph-spec="${esc(JSON.stringify(items))}" role="group" aria-label="${esc(id)} button prompts">${itemsHtml(id, items)}</span>`;
  };

  // ---------- Live refresh ----------
  let scheduled = false, installed = false;
  function refreshRows() {
    if (!doc) return;
    for (const element of doc.querySelectorAll('[data-g-glyph-row]')) {
      let items;
      try { items = JSON.parse(element.dataset.glyphSpec || '[]'); } catch { continue; }
      const id = element.dataset.console;
      const key = `${id}|${JSON.stringify(items)}|${JSON.stringify(face(id))}`;
      if (element.dataset.glyphKey === key) continue;
      element.dataset.glyphKey = key;
      element.innerHTML = itemsHtml(id, items);
    }
  }
  function decorate(element, consoleId, role, listIndex = 0) {
    const token = typeof role === 'function' ? role(element, listIndex) : role;
    if (!token) return;
    const glyphName = token === 'confirm' || token === 'back' ? face(consoleId)[token] : name(consoleId, token);
    if (!glyphName) return;
    const key = `${consoleId}|${token}|${glyphName}`;
    if (element.dataset.gGlyphKey === key && element.querySelector('.g-glyph')) return;
    element.dataset.gGlyphKey = key;
    element.dataset.gAutoRole = token;
    // app.js writes the shared bar's wording with element.querySelector('span'). If the glyph were a <span>
    // inside the kbd, that write would land on the picture instead of the label (and print "OpenSelect").
    // The shared bar therefore gets a <b> glyph; every other prompt keeps the usual span.
    const tag = element.closest?.('#controller-prompts') ? 'b' : 'span';
    element.innerHTML = glyphHtml(consoleId, glyphName, ' g-glyph-inline', tag);
  }
  // Prompt containers owned by files outside this task (keyboard, dialogs, shell footer, overlays). The rules
  // are roles rather than letters, so flipping a setting repaints them with the new face immediately.
  const AUTO_RULES = [
    ['#controller-prompts #prompt-a kbd', () => 'confirm'],
    ['#controller-prompts #prompt-b kbd', () => 'back'],
    ['#controller-prompts #prompt-x kbd', () => 'x'],
    ['#controller-prompts #prompt-y kbd', () => 'y'],
    ['#controller-prompts #prompt-menu kbd', () => 'menu'],
    ['.g-osk-hints kbd', () => 'back'],
    ['[data-g-role]', element => element.dataset.gRole],
    ['.g-close-hint kbd', () => 'back'],
    ['.g-add-hint kbd', () => 'back'],
    ['.g-launch-hint kbd', () => 'back'],
    ['.options-footer kbd', () => 'back'],
    ['.power-footer kbd', () => 'back'],
    ['#console-choice-dialog footer kbd', () => 'back'],
    ['.g-trailer-hints kbd', () => 'back'],
    ['.g-xset-hints b', (element, index) => index === 0 ? 'confirm' : 'back'],
    ['.g-xset-actions b, .g-xset-action b', element => /back|cancel|close/i.test(element.closest('button')?.textContent || '') ? 'back' : 'confirm'],
    ['#g-console-account .g-ov-key', (element, index) => index === 0 ? 'confirm' : 'back']
  ];
  function paintSharedPrompts(consoleId) {
    const bar = doc.querySelector('#controller-prompts');
    if (!bar) return;
    bar.dataset.gConsole = consoleId;
    if (!['series', 'one'].includes(consoleId)) return;
    const label = (selector, value) => {
      const span = bar.querySelector(`${selector} > span:last-child`);
      if (span && span.textContent !== value) span.textContent = value;
    };
    const home = (win.state?.view || 'home') === 'home';
    label('#prompt-a', home ? 'Select' : 'Open');
    label('#prompt-b', 'Back');
    label('#prompt-y', 'Search');
    label('#prompt-menu', 'Options');
    // The console's own footprint keeps Back visible on Home; app.js hides it there because the launcher's
    // Home is a root page. The pad still sends back (and plays the back cue), so the prompt is not dead.
    const back = bar.querySelector('#prompt-b');
    if (back) back.hidden = false;
  }
  // Two footers are whole sentences rather than a single kbd token: the update prompt and the Steam Store
  // footer. Rebuild them as the console's own row, because the files that write them cannot be edited for G1.
  const ROW_FOOTERS = [
    ['.g-update-hints', () => [{ button: '@confirm', label: 'Select' }, { button: '@back', label: 'Later' }]],
    ['#steam-shop footer > span:last-child', () => [{ button: '@back', label: 'Close' }, { button: '@confirm', label: 'Select' }, { button: 'dpad', label: 'Navigate' }]]
  ];
  function upgrade(root) {
    if (!doc || !doc.body) return;
    const consoleId = currentConsole();
    if (!consoleId) return;
    const scope = root && root.querySelectorAll ? root : doc;
    for (const [selector, role] of AUTO_RULES) {
      let elements = [];
      try { elements = [...scope.querySelectorAll(selector)]; } catch { continue; }
      elements.forEach((element, index) => decorate(element, consoleId, role, index));
    }
    for (const [selector, items] of ROW_FOOTERS) {
      let elements = [];
      try { elements = [...scope.querySelectorAll(selector)]; } catch { continue; }
      for (const element of elements) {
        if (element.dataset.gGlyphFooter === 'yes') continue;
        element.dataset.gGlyphFooter = 'yes';
        element.innerHTML = row(consoleId, items());
      }
    }
    paintSharedPrompts(consoleId);
  }
  function refresh() {
    refreshRows();
    upgrade(doc);
  }
  function schedule() {
    if (!doc || scheduled) return;
    scheduled = true;
    const run = () => { scheduled = false; refresh(); };
    if (typeof win.requestAnimationFrame === 'function') win.requestAnimationFrame(run); else setTimeout(run, 0);
  }

  // ---------- Install (browser only) ----------
  function install() {
    if (!doc || installed) return;
    installed = true;
    // A pack image that fails (wrong name, removed file) drops back to the drawn glyph and stops further
    // requests for that console; an explicit map is trusted, while a caller-supplied folder is probed once.
    doc.addEventListener('load', event => {
      const image = event.target;
      if (!image?.classList?.contains?.('g-glyph-img')) return;
      const consoleId = image.dataset.packConsole;
      if (consoleId) packState[consoleId] = 'yes';
      image.hidden = false;
      image.closest('.g-glyph')?.classList.add('has-pack');
    }, true);
    doc.addEventListener('error', event => {
      const image = event.target;
      if (!image?.classList?.contains?.('g-glyph-img')) return;
      const consoleId = image.dataset.packConsole;
      if (consoleId) packState[consoleId] = 'no';
      image.remove();
    }, true);
    doc.addEventListener('g-setting-change', event => {
      if (['enterButton', 'nintendoLayout', 'theme'].includes(event.detail?.id)) schedule();
    });
    doc.addEventListener('g-settings-ready', schedule);
    new MutationObserver(() => schedule()).observe(doc.body, { childList: true, subtree: true });
    new MutationObserver(() => schedule()).observe(doc.body, { attributes: true, attributeFilter: ['data-g-theme', 'class'] });
    schedule();
  }

  const api = {
    consoles: CONSOLES.slice(),
    sets: SETS,
    prompts: PROMPTS,
    required: REQUIRED,
    face,
    name,
    icon,
    row,
    has: (consoleId, glyphName) => Boolean(SETS[consoleId] && SETS[consoleId][name(consoleId, glyphName) || '']),
    labels: LABELS,
    current: currentConsole,
    usePack,
    setPackBase,
    refresh,
    // A test/harness hook: the drawn set without any pack image markup.
    svg: (consoleId, glyphName) => SETS[consoleId]?.[name(consoleId, glyphName) || ''] || ''
  };
  if (doc) install();
  return api;
});
