// Launch-then-return check in a hidden demo window: after a launch finishes, the page must stay responsive.
const { app } = require('electron');
const out = require('node:path').resolve(__dirname, '../.visual-review/launch-hang.txt');
const log = text => require('node:fs').appendFileSync(out, text + String.fromCharCode(10));
const path = require('node:path');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.resolve(__dirname, '../.visual-review/launch-hang-profile');
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 6000));
    const timeout = (ms, label) => new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms));
    try {
      await Promise.race([win.webContents.executeJavaScript(`(() => { const g = state.games.find(x => !x.isApp && x.installed !== false); state.selectedGameId = g.id; launchSelectedGame(); return g.title; })()`), timeout(5000, 'launch call hung')]);
      await new Promise(r => setTimeout(r, 6000));
      const result = await Promise.race([win.webContents.executeJavaScript(`new Promise(r => setTimeout(() => r(JSON.stringify({ hidden: launchOverlay.hidden, cls: launchOverlay.className })), 50))`), timeout(5000, 'page unresponsive after launch')]);
      log('RESPONSIVE ' + result);
      app.exit(0);
    } catch (error) { log('FAIL ' + error.message); app.exit(1); }
  });
});
require('../src/main.cjs');
