// Like garrison-shot.cjs, but with a copy of the real profile (library, settings, artwork cache) in a
// hidden window, so navigation can be checked on a full library. The real profile is never written.
// GARRISON_PROFILE: folder holding the copy. GARRISON_SCRIPT runs before the capture.
const { app } = require('electron');
const fs = require('node:fs/promises'), path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review/garrison-shot');
process.env.NEBULA_REVIEW = '1';
app.setPath('userData', process.env.GARRISON_PROFILE);
app.on('browser-window-created', (_, win) => {
  const errors = []; win.webContents.on('console-message', e => { if (e.level === 'error') errors.push(e.message + ' @ ' + e.sourceId.split('/').pop() + ':' + e.lineNumber); });
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, Number(process.env.GARRISON_SETTLE || 9000)));
    const [w, h] = (process.env.GARRISON_SIZE || '1920x1080').split('x').map(Number); win.setContentSize(w, h);
    await fs.mkdir(output, { recursive: true });
    let result;
    try { result = await win.webContents.executeJavaScript(`(async()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();${process.env.GARRISON_SCRIPT || ''}})()`); } catch (e) { result = 'ERR ' + e.message; }
    await new Promise(r => setTimeout(r, Number(process.env.GARRISON_WAIT || 1500)));
    await fs.writeFile(path.join(output, (process.env.GARRISON_NAME || 'shot') + '.png'), (await win.webContents.capturePage()).toPNG());
    await fs.writeFile(path.join(output, (process.env.GARRISON_NAME || 'shot') + '.json'), JSON.stringify({ result, errors }, null, 2));
    app.exit(0);
  });
});
require('../src/main.cjs');
