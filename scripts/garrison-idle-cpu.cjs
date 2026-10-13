// Idle cost check: with a copy of the real profile in a hidden window, measures average CPU of every
// app process over GARRISON_SECONDS while awake on Home, then again with the launcher put to sleep as
// it is when a game is in front. GARRISON_PROFILE: folder holding the profile copy.
const { app } = require('electron');
const path = require('node:path');
process.env.NEBULA_REVIEW = '1';
app.setPath('userData', process.env.GARRISON_PROFILE);
const seconds = Number(process.env.GARRISON_SECONDS || 15);
async function sample() {
  app.getAppMetrics();
  await new Promise(resolve => setTimeout(resolve, seconds * 1000));
  const metrics = app.getAppMetrics();
  return Object.fromEntries(metrics.map(item => [item.type, `${item.cpu.percentCPUUsage.toFixed(2)}% ${Math.round(item.memory.workingSetSize / 1024)}MB`]));
}
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    await new Promise(resolve => setTimeout(resolve, Number(process.env.GARRISON_SETTLE || 12000)));
    // Browse the whole library first, as a player would, so images are loaded.
    await win.webContents.executeJavaScript(`(async () => { showView('library'); await performAction('console-library-section', document.querySelector('[data-section="games"]')); const main = document.querySelector('main'); for (let i = 0; i < 40; i++) { main.scrollTop += 1500; await new Promise(r => setTimeout(r, 150)); } main.scrollTop = 0; showView('home'); })()`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    const awake = await sample();
    await win.webContents.executeJavaScript(`Object.defineProperty(document, 'hasFocus', { value: () => false, configurable: true }); window.dispatchEvent(new Event('blur'));`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const asleep = await sample();
    const state = await win.webContents.executeJavaScript(`document.body.classList.contains('g-asleep')`);
    console.log(JSON.stringify({ awake, asleep, asleepClass: state }));
    app.exit(0);
  });
});
require(path.join(__dirname, '../src/main.cjs'));
