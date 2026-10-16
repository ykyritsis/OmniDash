const {app,ipcMain,shell}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../.visual-review',process.env.GARRISON_OUT||'shell-performance');
const baseline=process.env.GARRISON_PERF_BASELINE==='1';
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile-'+process.pid);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const watchdog=setTimeout(()=>{console.error('Review timeout');app.exit(1);},70000);
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
 try {
  await fs.mkdir(output,{recursive:true});await pause(1800);win.setFullScreen(false);win.setContentSize(1280,800);win.focus();
  const run=code=>win.webContents.executeJavaScript(`(async()=>{${code}})()`);
  ipcMain.removeHandler('news:get');ipcMain.handle('news:get',()=>[]);
  ipcMain.removeHandler('game:achievements');ipcMain.handle('game:achievements',()=>({items:[],total:0,unlocked:0}));
  await run(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#startup-screen').hidden=true;state.soundEffects=false;scanLibrary=async()=>{};clearTimeout(gPrefetchTimer);gPrefetchGame=async()=>{};
    const base=state.games.find(g=>!g.isApp);state.games=Array.from({length:1500},(_,i)=>({...base,id:'shell-'+i,appId:String(i+1),title:'Game '+i,provider:'Steam',artwork:{},installed:true}));
    state.gFriends={status:'ready',online:60,friends:Array.from({length:60},(_,i)=>({id:String(i),name:'Friend '+i,game:'Game '+i,gameId:String(i+1),state:'online',avatar:''}))};showView('home');renderLibrary();renderFriendsActivity();`);
  const timings=await run(`const measure=fn=>{const values=[];for(let i=0;i<9;i++){const at=performance.now();fn();values.push(performance.now()-at);}return values.sort((a,b)=>a-b)[4];};return {friendsRefreshMs:measure(()=>renderFriendsActivity()),focus100Ms:measure(()=>{const cards=[...recentRow.querySelectorAll('.focusable')];for(let i=0;i<100;i++)setFocusedElement(cards[i%cards.length],{scroll:false});})};`);
  await run(`window.reviewFriend=document.querySelector('#g-friends-activity [data-friend-id]');setFocusedElement(window.reviewFriend,{scroll:false});renderFriendsActivity();`);
  const reuse=await run(`return document.activeElement===window.reviewFriend&&window.reviewFriend.isConnected;`);
  await run(`showView('library');window.reviewFriendMarkup=document.querySelector('#g-friends-activity').innerHTML;state.gFriends.friends[0].game='Changed game';renderFriendsActivity();`);
  const deferred=await run(`return document.querySelector('#g-friends-activity').innerHTML===window.reviewFriendMarkup;`);
  await run(`showView('home');`);
  const fresh=await run(`return document.querySelector('#g-friends-activity').textContent.includes('Changed game');`);
  let finishDetails;
  ipcMain.removeHandler('game:details');ipcMain.handle('game:details',()=>new Promise(resolve=>{finishDetails=resolve;}));
  await run(`gamePageDetails.clear();openGameDetails('shell-0');`);await pause(100);
  await run(`showView('home');window.reviewDescription=document.querySelector('#detail-description').textContent;`);
  assert(finishDetails);finishDetails({description:'Late hidden page response',screenshots:[],videos:[]});await pause(150);
  const staleIgnored=await run(`return document.querySelector('#detail-description').textContent===window.reviewDescription;`);
  await run(`window.reviewPadCalls=0;Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{window.reviewPadCalls++;return [];}});`);await pause(1100);
  const idlePadCalls=await run(`return window.reviewPadCalls;`);
  let statusCalls=0;ipcMain.removeHandler('steam:local-status');ipcMain.handle('steam:local-status',async()=>{statusCalls++;await pause(30);return {installed:true};});
  await run(`await Promise.all([refreshSteamLocalStatus(),refreshSteamLocalStatus(),refreshSteamLocalStatus()]);`);
  assert.equal(statusCalls,1,'Focus and visibility refreshes share the same Steam status request');
  const opened=[];shell.openExternal=async url=>{opened.push(url);};
  for(const action of ['give-feedback','request-feature','get-help','game-bar-settings'])await run(`await performAction(${JSON.stringify(action)},document.querySelector('[data-action="'+${JSON.stringify(action)}+'"]'));`);
  assert.deepEqual(opened,[...Object.values(require('../src/windows-shell.cjs').SUPPORT_LINKS),'ms-settings:gaming-gamebar']);
  const memoryBounded=await run(`for(let i=0;i<200;i++){cacheHomeScreenshots('review-'+i,['sample']);pickNewScreenshot(['sample'],'review-'+i,state.lastHomeScreenshotByGame);}return state.homeScreenshotCache.size===80&&state.lastHomeScreenshotByGame.size===80;`);
  await run(`window.reviewPadCalls=0;const pad={connected:true,index:99,id:'Review controller',mapping:'standard',buttons:Array.from({length:17},()=>({pressed:false,value:0})),axes:[0,0,0,0]};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>{window.reviewPadCalls++;return [pad];}});const event=new Event('gamepadconnected');Object.defineProperty(event,'gamepad',{value:pad});window.dispatchEvent(event);`);await pause(110);
  const connectedPadCalls=await run(`return window.reviewPadCalls;`);
  if(!baseline){assert(reuse,'Unchanged friends must preserve focused DOM');assert(deferred,'Hidden friend shelf must not rebuild');assert(fresh,'Home must apply deferred friend changes');assert(staleIgnored,'Late game-page response must not render a hidden page');assert(idlePadCalls<=8,`Idle polling too frequent: ${idlePadCalls}`);}
  if(!baseline){assert(memoryBounded);assert(connectedPadCalls>=3,'A connected controller resumes per-frame input immediately');}
  await run(`await performAction('settings',document.querySelector('[data-action="settings"]'));`);await pause(100);
  await run(`showSettingsPage('g-account');setFocusedElement(document.querySelector('[data-action="get-help"]'));`);await pause(150);
  assert(await run(`return document.activeElement.dataset.action==='get-help'&&document.activeElement.offsetParent!==null;`));
  await fs.writeFile(path.join(output,'settings-support.png'),(await win.webContents.capturePage()).toPNG());
  await run(`showSettingsPage('g-input');setFocusedElement(document.querySelector('[data-action="game-bar-settings"]'));`);await pause(150);
  assert(await run(`return document.activeElement.dataset.action==='game-bar-settings'&&document.activeElement.offsetParent!==null;`));
  await fs.writeFile(path.join(output,'settings-input.png'),(await win.webContents.capturePage()).toPNG());
  const result={timings,reuse,deferred,fresh,staleIgnored,idlePadCalls,connectedPadCalls,memoryBounded,statusCalls,opened};await fs.writeFile(path.join(output,'checks.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  clearTimeout(watchdog);app.exit(0);
 }catch(error){console.error(error);clearTimeout(watchdog);app.exit(1);}
}));
require('../src/main.cjs');
