// Exercise the real Store renderer in a fresh demo profile, without personal data or live services.
const {app, ipcMain} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const output = path.resolve(__dirname, '../.visual-review', process.env.GARRISON_OUT || 'store-performance');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile-' + process.pid);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const watchdog = setTimeout(() => {console.error('Store review timed out');app.exit(1);}, 90000);
app.on('browser-window-created', (_, win) => win.webContents.once('did-finish-load', async () => {
  const errors = [];
  win.webContents.on('console-message', event => {if (/Uncaught|ReferenceError|SyntaxError|TypeError/.test(event.message)) errors.push(event.message);});
  try {
    let requests = 0, fail = false, release;
    ipcMain.removeHandler('xbox:store');
    ipcMain.handle('xbox:store', async () => { requests++; await pause(20); return fail ? {status:'unavailable'} : {status:'ready',popular:[],newReleases:[],free:[]}; });
    ipcMain.removeHandler('store:search');
    ipcMain.handle('store:search', () => new Promise(resolve => {release = resolve;}));
    await fs.mkdir(output,{recursive:true}); await pause(6500);
    win.setFullScreen(false); win.setContentSize(1280,800); win.webContents.setZoomFactor(1);
    const run = code => win.webContents.executeJavaScript(`(async()=>{${code}})()`);
    const tile = pathToFileURL(path.resolve(__dirname,'../src/renderer/assets/collections/series/far-cry.jpg')).href;
    await run(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#startup-screen').hidden=true;state.soundEffects=false;scanLibrary=async()=>{};clearTimeout(gPrefetchTimer);gPrefetchGame=async()=>{};
      state.games=Array.from({length:1500},(_,i)=>({id:'owned-'+i,appId:String(10000+i),title:'Library game '+i,provider:'Steam',installed:true}));
      window.reviewStoreGames=Array.from({length:36},(_,i)=>({id:'xbox-review-'+i,xboxProductId:'REVIEW'+i,title:'Store game '+i,provider:'Xbox',discoveryOnly:true,price:{list:59.95,currency:'AUD'},artwork:{tile:${JSON.stringify(tile)}}}));
      state.xboxStore={status:'ready',popular:reviewStoreGames};state.consoleStoreMode='steam';consoleStoreTab='popular';showView('store');renderConsoleStore();`);
    const timings = await run(`const measure=async fn=>{const samples=[];for(let i=0;i<9;i++){await new Promise(r=>requestAnimationFrame(r));const t=performance.now();fn();samples.push(performance.now()-t);}return {medianMs:+samples.sort((a,b)=>a-b)[4].toFixed(2),samplesMs:samples.map(x=>+x.toFixed(2))};};
      const result={browse36:await measure(()=>renderConsoleStore())};
      gStoreSearch.query='store';gStoreSearch.results={xbox:reviewStoreGames.slice(0,30),steam:reviewStoreGames.slice(0,30).map((g,i)=>({...g,id:'steam-review-'+i,provider:'Steam',appId:String(20000+i),xboxProductId:undefined}))};
      result.search60=await measure(()=>renderConsoleStore());return result;`);
    await fs.writeFile(path.join(output,'timings.json'),JSON.stringify(timings,null,2)); console.log(JSON.stringify(timings));
    if (process.env.GARRISON_PERF_BASELINE === '1') {clearTimeout(watchdog);app.exit(0);return;}
    const checks=[];
    const focus = await run(`const grid=document.querySelector('#console-store-grid');const target=grid.querySelectorAll('.g-store-card')[20];setFocusedElement(target,{scroll:false});const image=target.querySelector('img');renderConsoleStore();return {same:target===document.activeElement,connected:target.isConnected,image:image===target.querySelector('img'),count:grid.querySelectorAll('.g-store-card').length};`);
    assert(focus.same&&focus.connected&&focus.image&&focus.count===60,JSON.stringify(focus));checks.push('Unchanged search keeps the focused card and decoded artwork');
    await run(`gClearStoreSearch();state.consoleStoreMode='gamepass';state.gamePassCatalog=[{id:'catalog-review',title:'A catalog game'}];renderConsoleStore();`);
    assert(await run(`return document.querySelector('.g-store-toolbar').hidden&&!document.querySelector('#store-view').classList.contains('g-store-searching');`),'Game Pass must not retain Store search controls');
    checks.push('Game Pass has no leftover Store search field');
    // Failed initial loading must stop instead of recursively retrying from its own completion render.
    fail=true;requests=0;
    await run(`state.consoleStoreMode='steam';state.xboxStore=null;renderConsoleStore();`); await pause(350);
    assert.equal(requests,1,'An unavailable Store must not retry itself');
    assert(await run(`return !!document.querySelector('[data-action="g-store-retry"]');`));
    await run(`performAction('g-store-retry',document.querySelector('[data-action="g-store-retry"]'));`);await pause(150);
    assert.equal(requests,2,'One retry action must make one request');checks.push('Offline load stops; explicit retry makes one request');
    // Search data added while the browse request is in flight must survive that response.
    fail=false;
    await run(`window.reviewRemembered={id:'remembered',title:'Remembered game'};const pending=loadXboxStore(true);gRememberXboxGame(reviewRemembered);await pending;`);
    assert(await run(`return findGameForDetails('remembered')?.title==='Remembered game';`));checks.push('Browse completion preserves searched and remembered game pages');
    await run(`state.xboxStore={status:'ready',popular:reviewStoreGames};renderConsoleStore();window.reviewSearch=gRunStoreSearch('new search',true);`);
    await pause(50);
    assert(await run(`return !!document.querySelector('#console-store-grid .g-score-loading')&&!document.querySelector('#console-store-grid .g-store-card');`),'New searches cannot show stale previous results');
    await run(`showView('home');`);release({xbox:[{id:'late',title:'Late result'}],steam:[]});await pause(60);
    assert(await run(`return state.view==='home'&&!document.activeElement.closest('#store-view');`),'Late Store response cannot steal focus from another page');checks.push('New search clears stale results; late responses respect the current page');
    await run(`openConsoleSearch();librarySearch.value='UPPERCASE';librarySearch.dispatchEvent(new Event('input',{bubbles:true}));`);await pause(450);
    const oldSearch=release;
    await run(`librarySearch.value='DIFFERENT';librarySearch.dispatchEvent(new Event('input',{bubbles:true}));`);
    oldSearch({xbox:[{id:'obsolete',title:'Obsolete result'}],steam:[]});await pause(50);
    assert(await run(`return !document.querySelector('#console-search-results [data-game-id="obsolete"]');`),'Typing must invalidate the previous response before debounce');
    await pause(400);release({xbox:[{id:'global-result',title:'Different result',provider:'Xbox',discoveryOnly:true}],steam:[]});await pause(50);
    assert(await run(`return !!document.querySelector('#console-search-results [data-game-id="global-result"]');`),'Capital letters must not hide global Store results');
    assert(await run(`return gStoreSearch.query==='new search';`),'Global search must not replace the Store search state');
    await run(`setFocusedElement(librarySearch,{scroll:false});moveFocus('down');`);
    assert.equal(await run(`return document.activeElement.dataset.gameId;`),'global-result','Controller down must enter the search result cards');
    assert(await run(`const card=document.activeElement;renderConsoleSearch();return document.activeElement===card&&card.isConnected;`));
    const opened=await run(`const original=openGameDetails;let opened;openGameDetails=async id=>{opened=id;};try{await performAction('g-store-result',document.activeElement);}finally{openGameDetails=original;}return {opened,known:findGameForDetails('global-result')?.title,closed:!document.querySelector('#console-search-dialog').open};`);
    assert.deepEqual(opened,{opened:'global-result',known:'Different result',closed:true});checks.push('Global search handles capitals, debounce races, controller selection and independent result opening');
    await run(`state.consoleStoreMode='steam';state.xboxStore={status:'ready',popular:reviewStoreGames};gStoreSearch.query='';gStoreSearch.results=null;showView('store');renderConsoleStore();setFocusedElement(document.querySelector('#console-store-grid .g-store-card'),{scroll:false});`);
    for(const [width,height,scale] of [[1280,800,1],[1024,640,1],[1280,800,1.25]]) {
      win.setContentSize(width,height);win.webContents.setZoomFactor(scale);await pause(150);
      assert(await run(`return document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#g-store-query').getBoundingClientRect().right<=innerWidth;`),'Store search must fit handheld layouts');
      await fs.writeFile(path.join(output,`store-${width}-${scale}.png`),(await win.webContents.capturePage()).toPNG());
    }
    assert.deepEqual(errors,[]);await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors},null,2));console.log('PASS '+checks.join('; '));
    clearTimeout(watchdog);app.exit(0);
  } catch(error) {console.error(error);clearTimeout(watchdog);app.exit(1);}
}));
require(process.env.GARRISON_MAIN || '../src/main.cjs');
