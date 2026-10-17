// Runs a page expression in a hidden demo window and saves the result. Usage: EXPR_FILE=... electron scripts/theme-eval.cjs
// EVAL_SIZE=1920,1080 matches the review captures' window size; the default is a smaller window.
// DEMO_ART=1 paints the same stand-in artwork the review captures use.
const { app } = require('electron');
const fs = require('node:fs'), path = require('node:path');
const out = path.resolve(__dirname, '../.visual-review/theme-eval.txt');
const [width, height] = (process.env.EVAL_SIZE || '1600,900').split(',').map(Number);
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1'; process.env.NEBULA_DEMO_USER_DATA = path.resolve(__dirname, '../.visual-review/themes/profile');
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 6000));
    win.setContentSize(width, height);
    if (process.env.DEMO_ART === '1') await win.webContents.executeJavaScript(fs.readFileSync(path.join(__dirname, 'theme-demo-art.js'), 'utf8')).catch(() => {});
    try { fs.writeFileSync(out, String(await win.webContents.executeJavaScript(fs.readFileSync(process.env.EXPR_FILE, 'utf8')))); } catch (e) { fs.writeFileSync(out, 'ERR ' + e); }
    app.exit(0);
  });
});
require('../src/main.cjs');
