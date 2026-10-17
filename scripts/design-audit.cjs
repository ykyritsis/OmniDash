// Design audit: opens every dialog, settings page and full-screen surface in a hidden demo window, saves a
// screenshot of each, and compares its real computed styles with the current Garrison look (the flyouts):
// corner radius, font, border, button shape and leftover colours from the old green theme.
// Output: .visual-review/design-audit/report.json and one PNG per surface.
const { app } = require('electron');
const fs = require('node:fs/promises'), path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review/design-audit');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1'; process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');

const PAGE_SCRIPT = String.raw`(async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rgb = c => c; // computed styles are already rgb()
  // Reference: a real Garrison flyout.
  const ref = (() => {
    const d = gFlyout('audit-ref', 'g-flyout', 'Reference'); d.innerHTML = '<header><h2>Reference</h2></header><button class="g-menu-item focusable"><span>Item</span></button><div class="g-choice-actions"><button class="g-control-button primary focusable">Primary</button><button class="g-control-button focusable">Other</button></div>';
    d.showModal();
    const c = getComputedStyle(d), item = getComputedStyle(d.querySelector('.g-menu-item')), primary = getComputedStyle(d.querySelector('.primary')), h = getComputedStyle(d.querySelector('h2'));
    const out = { bg: c.backgroundColor, radius: c.borderRadius, font: c.fontFamily, border: c.borderTopWidth + ' ' + c.borderTopStyle, shadow: c.boxShadow !== 'none', itemRadius: item.borderRadius, primaryBg: primary.backgroundColor, primaryRadius: primary.borderRadius, h2Font: h.fontFamily, h2Weight: h.fontWeight };
    d.close(); d.remove();
    return out;
  })();
  const OLD = [/rgb\(155, 240, 11\)/, /rgb\(153, 206, 172\)/, /rgb\(104, 113, 108\)/, /rgb\(23, 29, 26\)/, /rgb\(156, 190, 168\)/, /rgb\(205, 216, 209\)/];
  const measure = root => {
    const c = getComputedStyle(root);
    const buttons = [...root.querySelectorAll('button')].filter(b => b.offsetParent !== null).slice(0, 8).map(b => { const s = getComputedStyle(b); return { text: (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 24), radius: s.borderRadius, font: s.fontFamily.slice(0, 30), bg: s.backgroundColor, h: Math.round(b.getBoundingClientRect().height) }; });
    const heads = [...root.querySelectorAll('h1, h2, h3')].filter(h => h.offsetParent !== null).slice(0, 4).map(h => { const s = getComputedStyle(h); return { text: h.textContent.trim().slice(0, 24), font: s.fontFamily.slice(0, 30), weight: s.fontWeight, size: s.fontSize }; });
    let oldColors = 0; const all = root.querySelectorAll('*');
    for (const el of all) { const s = getComputedStyle(el); const blob = s.color + s.backgroundColor + s.borderTopColor; if (OLD.some(rx => rx.test(blob))) oldColors++; }
    const isGreen = value => { const m = String(value).match(/rgba?\((\d+), (\d+), (\d+)/); if (!m) return false; const r = +m[1], g = +m[2], b = +m[3]; return g > r + 25 && g > b + 25 && g > 120; };
    const greens = new Set();
    for (const el of root.querySelectorAll('*')) {
      if (!el.offsetParent) continue;
      const st = getComputedStyle(el);
      const hit = isGreen(st.color) && el.textContent.trim() ? 'text' : isGreen(st.backgroundColor) ? 'fill' : isGreen(st.borderTopColor) && parseFloat(st.borderTopWidth) > 0 ? 'border' : '';
      if (hit) greens.add(hit + ' ' + el.tagName.toLowerCase() + '.' + [...el.classList].slice(0, 3).join('.'));
    }
    return { greens: [...greens].slice(0, 10), bg: c.backgroundColor, radius: c.borderRadius, font: c.fontFamily.slice(0, 40), border: c.borderTopWidth + ' ' + c.borderTopStyle, buttons, heads, oldColors, size: Math.round(root.getBoundingClientRect().width) + 'x' + Math.round(root.getBoundingClientRect().height) };
  };
  const closeAll = () => { for (const d of document.querySelectorAll('dialog[open]')) { try { d.close(); } catch {} } for (const id of ['importing-screen', 'empty-state']) { const e = document.getElementById(id); if (e) { e.hidden = true; e.classList?.remove('visible', 'active'); } } };
  const games = state.games.filter(g => !g.isApp), anyGame = games[0];
  const surfaces = [
    ['game-options-dialog', () => { state.optionsGameId = anyGame.id; const d = document.querySelector('#game-options-dialog'); d.showModal(); return d; }],
    ['collections-dialog', () => { const d = document.querySelector('#collections-dialog'); d.showModal(); return d; }],
    ['steam-launch-dialog', () => { const d = document.querySelector('#steam-launch-dialog'); d.showModal(); return d; }],
    ['achievement-dialog', () => { const d = document.querySelector('#achievement-dialog'); d.showModal(); return d; }],
    ['gallery-dialog', () => { const d = document.querySelector('#gallery-dialog'); d.showModal(); return d; }],
    ['news-preview-dialog', () => { const d = document.querySelector('#news-preview-dialog'); d.showModal(); return d; }],
    ['avatar-dialog (profile)', () => { const d = document.querySelector('#avatar-dialog'); d.showModal(); return d; }],
    ['onboarding-dialog', () => { const d = document.querySelector('#onboarding-dialog'); d.showModal(); return d; }],
    ['power-dialog', () => { const d = document.querySelector('#power-dialog'); d.showModal(); return d; }],
    ['controller-status-dialog', () => { const d = document.querySelector('#controller-status-dialog'); d.showModal(); return d; }],
    ['console-choice-dialog', () => { const d = document.querySelector('#console-choice-dialog'); d.showModal(); return d; }],
    ['console-file-dialog', () => { const d = document.querySelector('#console-file-dialog'); d.showModal(); return d; }],
    ['install-dialog', () => { const d = document.querySelector('#install-dialog'); d.showModal(); return d; }],
    ['steam-game-launch-dialog', () => { const d = document.querySelector('#steam-game-launch-dialog'); d.querySelector('h2').textContent = 'What would you like to launch?'; d.showModal(); return d; }],
    ['console-search-dialog', () => { openConsoleSearch(); return document.querySelector('#console-search-dialog'); }],
    ['g-update-dialog', () => { const d = document.querySelector('#g-update-dialog'); if (!d) return null; d.showModal(); return d; }],
    ['settings-dialog', () => { settingsDialog.showModal(); return settingsDialog; }],
    ['importing-screen', () => { const e = document.querySelector('#importing-screen'); e.hidden = false; e.classList.add('visible'); return e; }],
    ['empty-state', () => { const e = document.querySelector('#empty-state'); e.hidden = false; return e; }],
    ['launch-overlay', () => { launchOverlay.hidden = false; launchOverlay.classList.add('active'); return launchOverlay; }],
    ['toast', () => { showToast('Settings saved'); return document.querySelector('#toast'); }]
  ];
  const settingsPages = ['g-account', 'g-privacy', 'g-notifications', 'g-language', 'audio', 'accessibility', 'personalization', 'g-streaming', 'services', 'g-input', 'duplicates', 'data'];
  window.__audit = {
    names: [...surfaces.map(item => item[0]), ...settingsPages.map(page => 'settings:' + page)],
    async run(name) {
      closeAll(); await wait(150);
      let root = null, error = '';
      if (name.startsWith('settings:')) {
        const page = name.slice(9);
        try { settingsDialog.showModal(); showSettingsPage(page); } catch (e) { error = String(e.message || e); }
        await wait(500);
        const el = document.querySelector('[data-settings-page="' + page + '"]');
        root = el && !el.hidden ? el : null;
      } else {
        try { root = surfaces.find(item => item[0] === name)[1](); } catch (e) { error = String(e.message || e); }
        await wait(500);
      }
      return JSON.stringify({ name, error, found: Boolean(root), metrics: root ? measure(root) : null });
    },
    ref, closeAll
  };
  return JSON.stringify({ names: window.__audit.names, ref });
})()`;

app.on('browser-window-created', (_, win) => {
  const errors = []; win.webContents.on('console-message', e => { if (e.level === 'error') errors.push(e.message.slice(0, 200) + ' @ ' + e.sourceId.split('/').pop() + ':' + e.lineNumber); });
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 6000));
    win.setContentSize(1600, 900);
    await fs.mkdir(output, { recursive: true });
    let setup;
    try { setup = JSON.parse(await win.webContents.executeJavaScript(PAGE_SCRIPT)); } catch (e) { await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ error: String(e.message || e), errors })); app.exit(1); return; }
    const results = [], shots = [];
    for (const name of setup.names) {
      let item;
      try { item = JSON.parse(await win.webContents.executeJavaScript('window.__audit.run(' + JSON.stringify(name) + ')')); } catch (e) { item = { name, error: String(e.message || e), found: false, metrics: null }; }
      results.push(item);
      try { await fs.writeFile(path.join(output, name.replace(/[^a-z0-9-]+/gi, '_') + '.png'), (await win.webContents.capturePage()).toPNG()); shots.push(name); } catch { /* A surface that can't be captured is still measured. */ }
    }
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ result: { ref: setup.ref, results }, shots, errors }, null, 2));
    app.exit(0);
  });
});
require('../src/main.cjs');
