// Exercise the real renderer navigation and cache paths in a credential-free
// demo. No controller injection, host pairing, or game launch is performed.
const {app, ipcMain} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const output = path.resolve(__dirname, '../.visual-review/home-navigation');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile-' + process.pid);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const watchdog = setTimeout(() => {console.error('Home review timed out');app.exit(1);}, 90000);
app.on('browser-window-created', (_, win) => win.webContents.once('did-finish-load', async () => {
  const errors = [];
  win.webContents.on('console-message', event => {if (/Uncaught|ReferenceError|SyntaxError|TypeError/.test(event.message)) errors.push(event.message);});
  try {
    await fs.mkdir(output, {recursive:true}); await pause(1800);
    win.setFullScreen(false); win.webContents.setZoomFactor(1);
    const run = code => win.webContents.executeJavaScript(`(async()=>{${code}})()`);
    const mock = (name, handler) => {ipcMain.removeHandler(name);ipcMain.handle(name, handler);};
    const tile = pathToFileURL(path.resolve(__dirname, '../src/renderer/assets/collections/series/far-cry.jpg')).href;
    const changedTile = pathToFileURL(path.resolve(__dirname, '../src/renderer/assets/collections/series/call-of-duty.jpg')).href;
    await fs.access(require('node:url').fileURLToPath(changedTile));
    const game = {id:'remote:review:1',appId:'1',remoteHostId:'review',title:'Remote review game',provider:'Remote PC',installed:true,lastPlayed:Date.now()+1000,artwork:{tile,hero:tile}};
    const host = {id:'review',name:'Review PC',address:'192.0.2.1',paired:true,status:'ready',currentGame:'0',games:[game]};
    let detailCalls = 0, coverCalls = 0, logoCalls = 0, failDetails = false;
    const details = {description:'Cached review description',fullDescription:'Cached review description',publisher:'Review publisher',screenshots:[],categories:[],genres:[],metadataSource:'Review fixture',playableOn:['PC']};
    const getDetails = async () => {detailCalls++;await pause(50);if(failDetails)throw Error('Fixture offline');return details;};
    for (const route of ['game:details','remote-play:details','steam:discovery-details','catalog:details']) mock(route, getDetails);
    for (const route of ['remote-play:snapshot','remote-play:check-hosts']) mock(route, () => ({available:true,hosts:[host],session:null}));
    mock('remote-play:covers', () => {coverCalls++;return [];});
    mock('artwork:logo', () => {logoCalls++;return null;});
    mock('news:get', () => []); mock('game:achievements', () => ({items:[]}));
    await run(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#startup-screen').hidden=true;state.soundEffects=false;state.activeGameSession=null;state.remotePlaySession=null;scanLibrary=async()=>{};Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>true});state.games=Array.from({length:10},(_,i)=>({...state.games.find(g=>!g.isApp),id:'review-'+i,title:'Review game '+i,lastPlayed:Date.now()-i*1000,installed:true,artwork:{tile:${JSON.stringify(tile)},hero:${JSON.stringify(tile)},logo:${JSON.stringify(tile)}}}));await performAction('remote-settings-refresh',document.querySelector('[data-action=remote-settings-refresh]'));renderLibrary();showView('home');`);
    await run(`for(const game of state.games)delete game.artwork.logo;logoRequested.clear();`);
    const checks = [];
    for (const [width,height,scale,reduce] of [[1920,1080,1,false],[1280,800,1,false],[1024,640,1,false],[1280,800,1.25,true]]) {
      win.setContentSize(width,height);
      await run(`document.body.style.setProperty('--g-scale','${scale}');document.documentElement.classList.toggle('reduce-motion',${reduce});showView('home');setFocusedElement(recentRow.querySelector('.focusable'));state.navRepeat=true;for(let i=0;i<8;i++)moveFocus('right');state.navRepeat=false;`);
      await pause(650);
      const end = await run(`const tile=recentRow.querySelector('.g-library-tile'),box=tile.getBoundingClientRect(),row=recentRow.getBoundingClientRect();return {focused:document.activeElement===tile,left:box.left,right:box.right,rowLeft:row.left,rowRight:row.right,scroll:recentRow.scrollLeft,tiles:recentRow.querySelectorAll('.focusable').length};`);
      assert(end.focused && end.tiles===7 && end.left>=end.rowLeft-1 && end.right<=end.rowRight+1, JSON.stringify({width,scale,end}));
      await run(`moveFocus('left');`); await pause(650);
      assert(await run(`return document.activeElement===recentRow.querySelectorAll('.game-card')[5];`), 'Left from My games must return to the last game');
      await run(`moveFocus('right');`);await pause(650);
      // Cover events and host status changes must preserve both the focused
      // button identity and the row's horizontal scroll position.
      await run(`window.reviewFocused=document.activeElement;window.reviewLeft=recentRow.scrollLeft;window.reviewRow=recentRow.firstElementChild;window.reviewCollection=gHomeRows.firstElementChild;`);
      game.artwork={tile:changedTile,hero:changedTile};
      win.webContents.send('remote-play:status',{phase:'artwork',hostId:host.id,appId:'1',artwork:game.artwork});
      await pause(50);
      assert(await run(`return document.activeElement===window.reviewFocused&&recentRow.firstElementChild===window.reviewRow&&gHomeRows.firstElementChild===window.reviewCollection&&Math.abs(recentRow.scrollLeft-window.reviewLeft)<1;`),'An artwork update must not rebuild Home or reset controller focus');
      host.status='offline';await run(`await performAction('remote-settings-refresh',document.querySelector('[data-action=remote-settings-refresh]'));`);
      assert(await run(`return document.activeElement===window.reviewFocused&&recentRow.firstElementChild===window.reviewRow;`),'A status poll must retain Home nodes');host.status='ready';
      if(width===1280&&scale===1)await fs.writeFile(path.join(output,'my-games-handheld.png'),(await win.webContents.capturePage()).toPNG());
      await run(`await performAction(document.activeElement.dataset.action,document.activeElement);`);
      assert(await run(`return state.view==='library';`),'My games must activate with the normal controller action');
      await run(`showView('home');setFocusedElement(recentRow.querySelector('.g-library-tile'));state.navRepeat=true;for(let i=0;i<8;i++)moveFocus('left');state.navRepeat=false;`);await pause(650);
      assert(await run(`const b=recentRow.firstElementChild.getBoundingClientRect();return document.activeElement===recentRow.firstElementChild&&b.left>=recentRow.getBoundingClientRect().left;`),'Held left must reveal the first game');
      checks.push({width,height,scale,reduce,end});
    }
    assert.equal(logoCalls,0,'Controller focus must not fetch artwork for the hidden legacy Home wordmark');
    await run(`clearTimeout(gPrefetchTimer);gamePageDetails.clear();gPrefetched.clear();`);await pause(100);detailCalls=0;
    await run(`const game=state.remoteGames[0];await Promise.all([loadGamePageDetails(game),loadGamePageDetails(game),loadGamePageDetails(game)]);await loadGamePageDetails(game);`);
    assert.equal(detailCalls,1,'Repeated remote details calls must share one IPC request');
    await run(`openGameDetails(state.remoteGames[0].id);`);await pause(100);
    assert.equal(detailCalls,1,'Opening a prefetched page must reuse its details');
    assert.equal(await run(`return document.querySelector('#detail-description').textContent;`),details.description);
    await run(`state.region='au';await loadGamePageDetails(state.remoteGames[0]);state.region='de';await loadGamePageDetails(state.remoteGames[0]);`);
    assert.equal(detailCalls,3,'Changing region must not reuse another region’s classifications');
    await run(`state.region='retry';`);failDetails=true;
    await run(`await loadGamePageDetails(state.remoteGames[0]).catch(()=>{});`);failDetails=false;
    await run(`await loadGamePageDetails(state.remoteGames[0]);`);assert.equal(detailCalls,5,'Failed details must remain retryable');
    const before = detailCalls;
    await run(`state.region='prefetch';gPrefetched.clear();await gPrefetchGame(state.remoteGames[0].id);await loadGamePageDetails(state.remoteGames[0]);`);
    assert.equal(detailCalls,before+1,'Remote focus prefetch and page loading must share a request');
    await run(`for(let i=0;i<90;i++)await loadGamePageDetails({...state.remoteGames[0],id:'bounded-'+i});`);
    assert(await run(`return gamePageDetails.size<=80;`),'The page cache must have a fixed memory bound');
    assert.equal(errors.length,0,errors.join('\n'));
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({checks,detailCalls,coverCalls,logoCalls,errors},null,2));
    console.log('PASS Home end-tile navigation, held directions, handheld/large-text scrolling, stable cover/status updates, shared regional details cache and retry/size bounds.');
    clearTimeout(watchdog);app.exit(0);
  } catch(error) {console.error(error);await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:error.stack,errors},null,2));clearTimeout(watchdog);app.exit(1);}
}));
require('../src/main.cjs');
