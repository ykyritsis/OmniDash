// UI regression review with an isolated profile and mocked launches/Store metadata.
const { app, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const output=path.resolve(__dirname,'../.visual-review/app-refinement');
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const watchdog=setTimeout(()=>{console.error('UI review timed out');app.exit(1);},90000);
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
  const errors=[];
  win.webContents.on('console-message',event=>{if(/Uncaught|ReferenceError|SyntaxError|TypeError/.test(event.message))errors.push(event.message);});
  try {
    await fs.mkdir(output,{recursive:true});await pause(1800);win.setFullScreen(false);
    const run=code=>win.webContents.executeJavaScript(code);
    const mock=(name,handler)=>{ipcMain.removeHandler(name);ipcMain.handle(name,handler);};
    mock('game:details',()=>({ageRating:'18+',rating:{system:'COB-AU',label:'R18+',value:'18'},screenshots:[],videos:[],genres:[],categories:[],dlcStatus:'none-listed'}));
    mock('xbox:store',()=>({status:'ready',popular:[],newReleases:[],free:[]}));
    mock('game:storage',()=>({sizeBytes:123456789,version:'Review build',folder:'C:/Games/Review',library:'Local library'}));
    const saves=[];mock('game:launch-options:save',(_,id,value)=>{saves.push({id,value});return true;});
    await run(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#startup-screen').hidden=true;scanLibrary=async()=>{};state.soundEffects=false;document.documentElement.classList.add('reduce-motion');state.games.push({...state.games.find(g=>!g.isApp),id:'duplicate-fixture',provider:'PC'});renderLibrary();`);
    const game=await run(`state.games.find(g=>!g.isApp&&g.provider==='Steam')`);
    const capture=async name=>{await pause(150);await fs.writeFile(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());};
    const check=async selector=>{
      const geometry=await run(`(()=>{const d=document.querySelector(${JSON.stringify(selector)}),r=d.getBoundingClientRect();refreshFocusables();return {open:d.open,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:d.scrollWidth-d.clientWidth,escaped:state.focusables.some(e=>!d.contains(e))};})()`);
      assert(geometry.open&&geometry.left>=0&&geometry.right<=geometry.width+1&&geometry.top>=0&&geometry.bottom<=geometry.height+1,JSON.stringify(geometry));
      assert(geometry.overflow<=1,'Dialog overflow: '+JSON.stringify(geometry));assert.equal(geometry.escaped,false,'Controller focus escaped the modal');
    };
    for(const [width,height] of [[1920,1080],[1280,800],[1024,640]]) {
      win.setContentSize(width,height);win.webContents.setZoomFactor(1);
      await run(`openManageGame(state.games.find(g=>g.id===${JSON.stringify(game.id)}));true`);await check('#g-manage-dialog');await capture('manage-current-'+width);
      await run(`setFocusedElement(document.querySelector('#g-launch-options'));document.querySelector('#g-launch-options').scrollIntoView({block:'center',behavior:'instant'});`);await capture('launch-options-current-'+width);
      await run(`gManage.close();gOpenGameOptions(${JSON.stringify(game.id)});`);await check('#game-options-dialog');await capture('manage-'+width);
      await run(`showOptionsPage('advanced');setFocusedElement(document.querySelector('#steam-launch-options'),{scroll:false});`);await check('#game-options-dialog');await capture('launch-options-'+width);
      await run(`gameOptionsDialog.close();openSettings();`);await pause(150);
      await run(`showSettingsPage('duplicates');`);await check('#settings-dialog');await capture('duplicates-'+width);
      await run(`openConsoleChoice(document.querySelector('[data-duplicate-choice]'));`);await check('#console-choice-dialog');await capture('copy-choice-'+width);
      await run(`navigateBack();showSettingsPage('connection-steam');`);await check('#settings-dialog');await capture('steam-library-'+width);
      await run(`showSettingsPage('g-language');setFocusedElement(document.querySelector('#player-region'),{scroll:false});`);
      assert.equal(await run(`document.querySelector('#player-region').offsetParent!==null`),true);await capture('region-'+width);
      await run(`settingsDialog.close();steamLaunchUI.choose({title:'Choose a launch mode',body:'Call of Duty: WWII',options:[{value:0,label:'Campaign'},{value:1,label:'Multiplayer'},{value:2,label:'Zombies'},{value:null,label:'Cancel'}]});true`);await check('#steam-game-launch-dialog');await capture('launch-modes-'+width);
      await run(`steamLaunchUI.reset();`);
    }
    // Launch-once must not call the persistence API.
    await run(`gOpenGameOptions(${JSON.stringify(game.id)});document.querySelector('#steam-launch-options').value='-windowed';window.reviewLaunchArguments=[];launchSelectedGame=async value=>reviewLaunchArguments.push(value);performAction('launch-with-options',document.querySelector('[data-action=launch-with-options]'));`);
    assert.equal(saves.length,0);assert.equal(await run(`reviewLaunchArguments[0]`),'-windowed');
    await run(`performAction('save-launch-options',document.querySelector('[data-action=save-launch-options]'));`);assert.equal(saves.length,1);
    await run(`gameOptionsDialog.close();renderGarrisonTrailers(state.games[0],{videos:[{title:'Reveal Trailer',preview:'',stream:'https://video.akamai.steamstatic.com/reveal.m3u8?t=1'},{title:'Reveal Trailer',preview:'',stream:'https://video.akamai.steamstatic.com/reveal.m3u8?t=2'}]});`);
    assert.equal(await run(`state.gTrailers.length`),1);
    // Clearing while a previous search is pending cannot repaint stale results.
    let searchResolve;mock('store:search',()=>new Promise(resolve=>{searchResolve=resolve;}));
    await run(`state.view='store';gRunStoreSearch('old query');true`);await pause(50);
    await run(`gRunStoreSearch('a');true`);searchResolve({xbox:[],steam:[{id:'stale',title:'Stale',artwork:{}}]});await pause(100);
    assert.equal(await run(`gStoreSearch.results===null&&gStoreSearch.query==='a'`),true);
    assert.deepEqual(errors,[]);clearTimeout(watchdog);
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({ok:true,sizes:[1920,1280,1024],savedLaunchOptions:saves.length,errors},null,2));
    console.log('PASS management, duplicate chooser, region selector and launch modes at desktop/handheld sizes; launch-once persistence, gallery dedupe and stale search protection');app.exit(0);
  } catch(error) {console.error(error);await fs.writeFile(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
}));
require('../src/main.cjs');
