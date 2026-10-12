// Capture the full-screen console surfaces with an isolated demo profile. No real games launch.
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review', process.env.GARRISON_OUT || 'garrison');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  const errors = [];
  win.webContents.on('console-message', (event) => { if (event.level === 'error' || event.level === 3) errors.push(`${event.message} @ ${event.sourceId}:${event.lineNumber}`); });
  win.webContents.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      await pause(5000);
      const [width, height] = (process.env.GARRISON_SIZE || '1920x1080').split('x').map(Number);
      win.setContentSize(width, height);
      const run = script => win.webContents.executeJavaScript(script);
      const capture = async name => {
        await pause(900);
        await run(`Promise.race([Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,4000))])`);
        await fs.writeFile(path.join(output, `${name}.png`), (await win.webContents.capturePage()).toPNG());
      };
      await run(`(async()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();await window.launcher.saveSettings({onboardingComplete:true});state.steamBannerDismissed=true;document.querySelector('#startup-screen')?.setAttribute('hidden','');showView('home');})()`);
      await capture('home');
      await run(`showView('library')`);
      await capture('library');
      await run(`(()=>{const g=state.games.find(g=>!g.isApp);if(g)openGameDetails(g.id);})()`);
      await capture('detail');
      await run(`(async()=>{showView('home');await openSettings();})()`);
      await capture('settings');
      await run(`showSettingsPage('personalization')`);
      await capture('settings-appearance');
      await run(`showSettingsPage('services')`);
      await capture('settings-manage-games');
      await run(`settingsDialog.close();showView('library');performAction('console-library-section',document.querySelector('[data-section="installed"]'))`);
      await capture('library-installed');
      await run(`setFocusedElement(libraryGrid.querySelector('.game-card'));openGameOptions(libraryGrid.querySelector('.game-card').dataset.gameId)`);
      await capture('game-menu');
      await run(`performAction('g-game-manage',document.querySelector('#g-game-dialog .focusable'))`);
      await pause(1200);
      await capture('manage');
      await run(`document.querySelector('#g-manage-dialog').close();performAction('console-library-section',document.querySelector('[data-section="games"]'));state.gLayout='list';renderLibraryView()`);
      await capture('library-list');
      await run(`state.gLayout='grid';performAction('console-library-section',document.querySelector('[data-section="queue"]'))`);
      await capture('library-queue');
      await run(`performAction('console-library-section',document.querySelector('[data-section="games"]'));showView('store')`);
      await capture('store');
      await run(`(async()=>{showView('home');await performAction('g-account',document.querySelector('#profile-button'));})()`);
      await capture('account');
      await run(`performAction('g-account-calculator',document.querySelector('#g-account-dialog .focusable'))`);
      await capture('calculator');
      await run(`document.querySelector('#g-score-dialog')?.close();pcScoreCalculator.close()`);
      // Controller path: Home row → top nav → Library → tabs → chips → grid, then back.
      const nav = await run(`(async()=>{document.querySelector('#g-account-dialog').close();await new Promise(r=>setTimeout(r,50));showView('home');const log=[];const at=()=>{const e=document.activeElement;return (e.dataset.action||'')+':'+(e.dataset.section||e.dataset.source||e.dataset.gameId||e.textContent.trim().slice(0,14));};
        moveFocus('down');log.push(at());moveFocus('up');log.push(at());moveFocus('up');log.push(at());
        await performAction('library',document.activeElement);log.push(at());
        moveFocus('up');log.push(at());moveFocus('up');log.push(at());moveFocus('up');log.push(at());moveFocus('up');log.push(at());moveFocus('down');log.push(at());moveFocus('down');log.push(at());moveFocus('right');moveFocus('right');log.push(at());
        await performAction('g-source',document.activeElement);log.push('count='+document.querySelector('#library-count').textContent);
        moveFocus('down');log.push(at());moveFocus('down');log.push(at());return log;})()`);
      await capture('library-nav');
      await fs.writeFile(path.join(output, 'navigation.json'), JSON.stringify(nav, null, 2));
      await fs.writeFile(path.join(output, 'errors.json'), JSON.stringify(errors, null, 2));
      app.exit(0);
    } catch (error) {
      await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack, errors }, null, 2));
      app.exit(1);
    }
  });
});
require('../src/main.cjs');
