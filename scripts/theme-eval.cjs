// Runs a page expression in a hidden demo window and saves the result. Usage: EXPR='...' electron scripts/theme-eval.cjs
const { app } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const out = path.resolve(__dirname, '../.visual-review/theme-eval.txt');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1'; process.env.NEBULA_DEMO_USER_DATA = path.resolve(__dirname, '../.visual-review/themes/profile');
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 6000));
    win.setContentSize(1600, 900);
    try { fs.writeFileSync(out, String(await win.webContents.executeJavaScript(fs.readFileSync(process.env.EXPR_FILE, 'utf8')))); } catch (e) { fs.writeFileSync(out, 'ERR ' + e); }
    app.exit(0);
  });
});
require('../src/main.cjs');
