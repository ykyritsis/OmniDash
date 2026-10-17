// Prints computed styles for chosen selectors under a theme (hidden demo window). Usage: THEME=one SEL='a;b' electron scripts/theme-inspect.cjs
const { app } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const out = path.resolve(__dirname, '../.visual-review/theme-inspect.json');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1'; process.env.NEBULA_DEMO_USER_DATA = path.resolve(__dirname, '../.visual-review/themes/profile');
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 6000));
    win.setContentSize(1600, 900);
    const script = `(() => { gSetTheme(${JSON.stringify(process.env.THEME || 'one')}); showView('home');
      const extra = { lastRecent: document.querySelector("#recent-row > :last-child")?.outerHTML.slice(0, 200), navAfter: getComputedStyle(document.querySelector(".top-nav-button"), "::after").content + " / " + getComputedStyle(document.querySelector(".top-nav-button"), "::after").display + " / " + getComputedStyle(document.querySelector(".top-nav-button"), "::after").fontSize, card: (() => { const c = document.querySelector("#recent-row > .game-card"); const s = getComputedStyle(c); return [s.width, s.height, s.flexBasis, s.getPropertyValue("--g-tile")]; })() };
      return JSON.stringify([extra, ...${JSON.stringify((process.env.SEL || 'main').split(';'))}.map(sel => { const el = document.querySelector(sel); if (!el) return [sel, 'missing'];
        const s = getComputedStyle(el), r = el.getBoundingClientRect(); return [sel, { bg: s.backgroundColor, bgi: s.backgroundImage.slice(0, 60), display: s.display, pos: s.position, z: s.zIndex, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top), op: s.opacity, vis: s.visibility, ${process.env.PROP ? `prop: s.getPropertyValue(${JSON.stringify(process.env.PROP)})` : ''} }]; })]); })()`;
    try { await new Promise(r => setTimeout(r, 10)); const res = await win.webContents.executeJavaScript(script); await new Promise(r => setTimeout(r, 800)); fs.writeFileSync(out, await win.webContents.executeJavaScript(script)); } catch (e) { fs.writeFileSync(out, String(e)); }
    app.exit(0);
  });
});
require('../src/main.cjs');
