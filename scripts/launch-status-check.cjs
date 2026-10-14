// Checks the launch screen shows the stage the main process reports (no game is launched).
const { app } = require('electron');
const path = require('node:path');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.resolve(__dirname, '../.visual-review/launch-status-profile');
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    await new Promise(resolve => setTimeout(resolve, 4000));
    await win.webContents.executeJavaScript(`launchOverlay.hidden = false; launchOverlay.dataset.gameId = 'g1'; true`);
    win.webContents.send('launch:status', { gameId: 'g1', text: 'Starting Steam in the background' });
    await new Promise(resolve => setTimeout(resolve, 300));
    const shown = await win.webContents.executeJavaScript(`document.querySelector('#launch-status')?.textContent + ' | live=' + launchOverlay.dataset.liveStatus`);
    win.webContents.send('launch:status', { gameId: 'other', text: 'Should be ignored' });
    await new Promise(resolve => setTimeout(resolve, 300));
    const after = await win.webContents.executeJavaScript(`document.querySelector('#launch-status')?.textContent`);
    const cancel = await win.webContents.executeJavaScript(`Boolean(document.querySelector('#launch-overlay .g-launch-cancel'))`);
    console.log(JSON.stringify({ shown, otherGameIgnored: after === 'Starting Steam in the background', cancelButton: cancel }));
    app.exit(0);
  });
});
require('../src/main.cjs');
