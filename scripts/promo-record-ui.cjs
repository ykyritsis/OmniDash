// Record genuine renderer navigation and its launch animation in an isolated demo profile.
const {app}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.visual-review/promo-live-frames');
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';
process.env.NEBULA_DEMO_USER_DATA=path.join(root,'.visual-review/promo-beta25/profile');
app.commandLine.appendSwitch('force-device-scale-factor','1');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
 try{
  await fs.mkdir(out,{recursive:true}); await pause(6000); win.setContentSize(1920,1080);
  const run=s=>win.webContents.executeJavaScript(s);
  const games=JSON.parse(await fs.readFile(path.join(root,'.visual-review/promo-v2/games.json')));
  games[0].id='demo-1';
  const cached=JSON.parse(await fs.readFile(path.join(root,'.visual-review/promo-v2/cached-games.json'))).find(g=>g.title==='Forza Horizon 5');
  if(cached?.art?.logo)games[0].artwork.logo=cached.art.logo;
  await run(`for(const d of document.querySelectorAll('dialog[open]'))d.close();document.querySelector('#startup-screen').hidden=true;state.steamBannerDismissed=true;selectedAvatarId='one-spark';renderAvatarChoices();state.games=${JSON.stringify(games)};state.favoriteGameIds=[];state.customCollections=[];state.selectedGameId=null;state.xboxStore={};renderLibrary();renderHomeCollections();openGameDetails('demo-1');true`);
  await pause(5000);
  await run(`showView('home');state.displayName='Player';gOnboard.identity=null;gOnboard.step=0;renderOnboarding();onboardingDialog.showModal();true`);
  await pause(800);
  const actions=new Map([
   [24,`gOnboard.step=2;renderOnboarding();true`],
   [51,`onboardingDialog.close();showView('home');setFocusedElement(recentRow.querySelector('.game-card'));true`],
   [68,`setFocusedElement(recentRow.querySelectorAll('.game-card')[1]);true`],
   [81,`setFocusedElement(recentRow.querySelectorAll('.game-card')[2]);true`],
   [93,`showView('library');setFocusedElement(libraryGrid.querySelector('.game-card'),{scroll:false});document.querySelector('main').scrollTop=0;true`],
   [110,`setFocusedElement(libraryGrid.querySelectorAll('.game-card')[1],{scroll:false});true`],
   [123,`openGameDetails('demo-1');true`],
   [166,`launchSelectedGame();true`]
  ]);
  for(let f=0;f<225;f++){
   const start=Date.now();
   if(actions.has(f))await run(actions.get(f));
   await fs.writeFile(path.join(out,String(f).padStart(4,'0')+'.jpg'),(await win.webContents.capturePage()).toJPEG(94));
   await pause(Math.max(0,1000/30-(Date.now()-start)));
   if(f%30===0)console.log('Captured '+f+'/225');
  }
  await fs.writeFile(path.join(out,'capture.json'),JSON.stringify({frames:225,fps:30,source:'Actual beta25 renderer, isolated sample library. Launch animation runs in demo mode; no gameplay claimed.'},null,2));
  app.exit(0);
 }catch(e){console.error(e);app.exit(1)}
}));
require('../src/main.cjs');
