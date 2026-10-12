// Deterministic UI fixtures; synthetic Steam hours/unlocks are test data only.
const { app, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const output = path.resolve(__dirname, '../.visual-review/refinement');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.resolve(__dirname, '../.visual-review/packaged-beta4-art-profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  win.webContents.on('console-message', (_, details) => { if (details.level === 3) console.error('Renderer:', details.message); });
  win.webContents.once('did-finish-load', async () => {
    const run = script => win.webContents.executeJavaScript(script);
    const capture = async name => { await pause(600); await fs.writeFile(path.join(output, name + '.png'), (await win.webContents.capturePage()).toPNG()); console.log('PASS', name); };
    try {
      await fs.mkdir(output, { recursive: true });
      await pause(6000);
      win.setContentSize(1920, 1080); win.webContents.setZoomFactor(1);
      const catalog = JSON.parse(await fs.readFile(path.resolve(__dirname, '../.visual-review/catalog-live/gamepass-catalog.json'), 'utf8')).games;
      const forza = catalog.find(game => /^Forza Horizon 5/i.test(game.title));
      const details = { ...forza.details, controllerSupport: 'controller', achievementCount: 3, metadataSource: 'Xbox catalog fixture', dlcStatus: 'none-listed' };
      ipcMain.removeHandler('game:details'); ipcMain.handle('game:details', () => details);
      ipcMain.removeHandler('steam:profile'); ipcMain.handle('steam:profile', () => ({ games: ['demo-1','demo-2','demo-5'].map((id, index) => ({ id, minutes: [7260,2400,930][index] })), localAvailable: true, personalAchievements: true, scope: 'Test profile · sample Steam activity' }));
      ipcMain.removeHandler('game:achievements'); ipcMain.handle('game:achievements', () => ({ status: 'ready', progressAvailable: true, source: 'Steam', items: [
        { id: 'one', title: 'First steps', description: 'Test achievement fixture', unlocked: true },
        { id: 'two', title: 'Keep exploring', description: 'Test achievement fixture', unlocked: false },
        { id: 'three', title: 'The road ahead', description: 'Test achievement fixture', unlocked: false }
      ] }));
      let installed = false;
      ipcMain.removeHandler('steam:install-status'); ipcMain.handle('steam:install-status', () => ({ state: installed ? 'ready' : 'downloading', percent: installed ? 100 : 42, installed }));
      let actions = [];
      ipcMain.removeHandler('game:action'); ipcMain.handle('game:action', (_, id, action) => { actions.push({ id, action }); return true; });
      await run(`state.soundEffects=false;state.games.find(g=>g.id==='demo-2').controls='kbm';renderLibrary();showView('home');selectGame('demo-1',false);setFocusedElement(recentRow.querySelector('.game-card'),{scroll:false});`);
      await pause(1600);
      await run(`(()=>{const a=recentRow.firstElementChild.getBoundingClientRect();const b=document.querySelector('#dashboard-features .library-card').getBoundingClientRect();if(Math.abs(a.left-b.left)>2)throw Error('Browse tile is not aligned left');const badge=recentRow.querySelector('[data-game-id="demo-2"] .control-kbm');if(!badge?.getClientRects().length)throw Error('KBM badge hidden on Home');})()`);
      await capture('home');
      await run(`openGameDetails('demo-1')`); await pause(2000); await capture('game-hero');
      await run(`if(document.querySelector('#detail-logo').hidden)throw Error('Game wordmark not visible');if(document.querySelector('#detail-gallery').getClientRects().length)throw Error('Inactive media pane visible');selectDetailTab('overview',true);`);
      await capture('game-overview');
      await run(`selectDetailTab('media',true);`); await capture('game-gallery');
      await run(`(()=>{const tile=document.querySelector('.detail-gallery-item');if(tile){setFocusedElement(tile);performAction('detail-gallery-select',tile);}})()`); await pause(250);
      await run(`if(document.querySelector('#gallery-dialog').open)navigateBack();selectDetailTab('achievements',true);`); await capture('game-achievements');
      await run(`openGameOptions('demo-1')`); await capture('game-options');
      await run(`(()=>{refreshFocusables();if(state.focusables.some(el=>!gameOptionsDialog.contains(el)))throw Error('Game options focus escaped');navigateBack();if(gameOptionsDialog.open)throw Error('B failed to close game options');})()`);
      await run(`performAction('avatar-picker')`); await pause(700); await capture('steam-profile');
      await run(`if(document.querySelector('#profile-installed-count').textContent!=='176.5')throw Error('Steam hours incorrect');if(!document.querySelector('#profile-achievement-total').textContent.includes('3 unlocked'))throw Error('Verified profile achievements missing');navigateBack();`);
      await run(`(()=>{const game=state.games.find(g=>g.id==='demo-1');game.installed=false;showSteamInstallation(game);})()`); await pause(300); await capture('steam-install');
      await run(`if(document.querySelector('#install-progress').value!==42)throw Error('Real install progress not rendered');navigateBack();if(document.querySelector('#install-dialog').open)throw Error('Install Back did not close dialog');`);
      installed = true;
      await run(`pollSteamInstalls()`); await pause(300);
      await run(`if(!state.games.find(g=>g.id==='demo-1').installed||installTracking.size)throw Error('Install completion did not update game');`);
      if (actions.length) throw Error('Review unexpectedly opened an external Steam command');
      // Broken, portrait and small art all use the dark ambient background.
      await run(`(async()=>{const url='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="800"><rect width="500" height="800" fill="red"/></svg>');applyAmbientImage({id:'portrait',title:'Portrait'},url,'test');await new Promise(r=>setTimeout(r,50));if(visibleAmbient.style.backgroundImage.includes('url('))throw Error('Portrait cover used as a wallpaper');})()`);
      win.setContentSize(1280,800); win.webContents.setZoomFactor(1);
      await run(`openGameDetails('demo-1')`); await pause(800); await capture('game-handheld');
      await run(`openGameOptions('demo-3')`); await capture('options-handheld');
      await run(`if(!document.querySelector('#steam-management-group').hidden)throw Error('Non-Steam game shows Steam management');navigateBack();performAction('avatar-picker');`); await pause(500); await capture('profile-handheld');
      await run(`navigateBack();onboardingDialog.showModal();showOnboardingStep(2);state.steamLocalStatus={ready:true,installed:true,accountDetected:true,clientRunning:true};renderSteamLocalStatus();`); await capture('onboarding-library');
      await run(`(()=>{if(document.querySelector('#onboard-steam-check').hidden)throw Error('Linked Steam check hidden');if([...document.querySelectorAll('.onboarding-optional')].some(el=>el.open))throw Error('Optional key setup should be collapsed');navigateBack();onboardingDialog.close();})()`);
      win.setContentSize(1024,640); win.webContents.setZoomFactor(1.25);
      await run(`openGameDetails('demo-1');selectDetailTab('media',true);`); await capture('gallery-small-scaled');
      await run(`(()=>{if(document.documentElement.scrollWidth>innerWidth+1)throw Error('Small-screen horizontal overflow');setFocusedElement(document.querySelector('#detail-tabs [data-tab=media]'));moveFocus('down');if(!state.focusedElement?.classList.contains('detail-gallery-item'))throw Error('Controller cannot reach screenshot grid');})()`);
      console.log('PASS Steam profile hours/progress, hidden-pane focus, KBM badges, left alignment, install completion, B dismissal, handheld scaling and onboarding');
      app.exit(0);
    } catch (error) {
      console.error(error);
      console.error(await run(`({view:state.view,focus:document.activeElement?.outerHTML.slice(0,300),modal:topmostOpenDialog()?.id})`).catch(()=>({})));
      await fs.writeFile(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG()); app.exit(1);
    }
  });
});
require('../src/main.cjs');
