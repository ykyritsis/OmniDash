const { app } = require('electron');
const fs = require('node:fs/promises'), path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review/garrison-probe');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1'; process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
app.on('browser-window-created', (_, win) => {
  const errors = []; win.webContents.on('console-message', e => { if (e.level === 'error') errors.push(e.message + ' @ ' + e.sourceId.split('/').pop() + ':' + e.lineNumber); });
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 5000)); win.setContentSize(1920, 1080);
    const result = await win.webContents.executeJavaScript(process.env.PROBE).catch(e => 'ERR ' + e.message);
    await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'probe.json'), JSON.stringify({ result, errors }, null, 2)); app.exit(0);
  });
});
require('../src/main.cjs');
