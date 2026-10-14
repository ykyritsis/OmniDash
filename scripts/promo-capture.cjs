// Capture the actual renderer using a curated, anonymous demo library. Never launch games.
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/promo/beta25-v2');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(root, '.visual-review/promo-beta25/profile');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      await pause(6000);
      win.setContentSize(1920, 1080);
      const games = JSON.parse(await fs.readFile(path.join(root, '.visual-review/promo-v2/games.json')));
      games[0].id='demo-1'; // Match the main process's safe Forza demo entry for its real game page.
      const cachedArt=JSON.parse(await fs.readFile(path.join(root,'.visual-review/promo-v2/cached-games.json'))).find(g=>g.title==='Forza Horizon 5')?.art;
      if(cachedArt?.logo)games[0].artwork.logo=cachedArt.logo;
      const run = code => win.webContents.executeJavaScript(code);
      await run(`window.launcher.saveSettings({avatarId:'one-spark',profileAvatarCustomized:true,displayName:'Player',profileNameMode:'custom'})`);
      await run(`for(const d of document.querySelectorAll('dialog[open]'))d.close(); document.querySelector('#startup-screen').hidden=true; state.steamBannerDismissed=true; selectedAvatarId='one-spark'; renderAvatarChoices(); state.games=${JSON.stringify(games)}; state.favoriteGameIds=[]; state.customCollections=[]; state.selectedGameId=null; state.xboxStore={}; renderLibrary(); renderHomeCollections(); showView('home'); setFocusedElement(recentRow.querySelector('.game-card')); true`);
      const capture = async name => {
        await pause(1500);
        await run(`Promise.race([Promise.all([...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight).map(i=>i.decode().catch(()=>{}))),new Promise(r=>setTimeout(r,4000))])`);
        await fs.writeFile(path.join(output, name+'.png'), (await win.webContents.capturePage()).toPNG());
      };
      await capture('screenshot-home');
      await run(`showView('library'); setFocusedElement(libraryGrid.querySelector('.game-card'),{scroll:false}); document.querySelector('main').scrollTop=0; true`);
      await capture('screenshot-library');
      win.setContentSize(1280,720);
      await run(`showView('home'); setFocusedElement(recentRow.querySelector('.game-card')); document.querySelector('main').scrollTop=0; true`);
      await capture('screenshot-handheld');
      win.setContentSize(1920,1080);
      await run(`openGameDetails('demo-1'); true`);
      await pause(5000);
      await capture('screenshot-game-page');
      await run(`showView('home'); state.displayName='Player'; gOnboard.identity=null; gOnboard.step=0; renderOnboarding(); onboardingDialog.showModal(); true`);
      await capture('screenshot-onboarding');
      await run(`(async()=>{await refreshOnboardingAccounts(); gOnboard.step=2; renderOnboarding();return true})()`);
      await capture('screenshot-libraries');
      await fs.writeFile(path.join(root,'.visual-review/promo-beta25/result.json'), JSON.stringify({ok:true,version:require('../package.json').version,games:games.map(g=>g.title),screens:['home','library','handheld','game-page','onboarding','libraries'],note:'Curated demo data in the unmodified beta 25 renderer; no games launched.'},null,2));
      app.exit(0);
    } catch(error) { console.error(error);app.exit(1); }
  });
});
require('../src/main.cjs');
