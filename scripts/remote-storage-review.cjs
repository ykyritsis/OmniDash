const {app,ipcMain}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../.visual-review/remote-storage');
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const watchdog=setTimeout(()=>{console.error('Remote/storage UI review timed out');app.exit(1);},90000);
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
  const errors=[];win.webContents.on('console-message',event=>{if(/Uncaught|ReferenceError|SyntaxError|TypeError/.test(event.message))errors.push(event.message);});
  try{
    await fs.mkdir(output,{recursive:true});await pause(1800);win.setFullScreen(false);win.webContents.setZoomFactor(1);
    const run=code=>win.webContents.executeJavaScript(code.includes('await ')?`(async()=>{${code}})()`:code).catch(error=>{console.error('Renderer review code:',code.slice(0,160),errors);throw error;});
    const mock=(name,handler)=>{ipcMain.removeHandler(name);ipcMain.handle(name,handler);};
    const art=await run('state.games.find(g=>g.artwork?.tile)?.artwork || {}');
    const games=Array.from({length:45},(_,i)=>({id:`remote:fixture:${i+1}`,appId:String(i+1),title:['Forza Horizon 5','Hades II','Call of Duty: WWII','DOOM Eternal','Baldur’s Gate 3'][i%5]+(i>4?' '+i:''),provider:'Remote PC',remoteHostId:'fixture',hostName:'Gaming PC',installed:true,artwork:art}));
    const host={id:'fixture',name:'Gaming PC',address:'192.168.1.20',paired:true,games};let cancels=0,starts=0,stops=0;
    mock('remote-play:snapshot',()=>({available:true,hosts:[host],session:null}));
    mock('remote-play:refresh',()=>({hostId:host.id,name:host.name,games}));mock('remote-play:covers',()=>[]);
    mock('remote-play:add',()=>({hostId:host.id}));mock('remote-play:pair',()=>({pin:'0123',hostId:host.id,name:host.name}));
    mock('remote-play:cancel-pair',()=>{cancels++;return true;});mock('remote-play:stop',()=>{stops++;return true;});
    mock('remote-play:start',()=>{starts++;return {hostId:host.id,appId:'1',title:games[0].title,phase:'connecting'};});
    const libraryGame=await run('state.games.find(g=>!g.isApp&&g.provider==="Steam")');
    mock('storage:overview',()=>({drives:[{root:'C:\\',label:'Windows',total:1e12,free:182e9,used:818e9,knownGameBytes:300e9,unknownGames:1,libraries:['C:\\Steam'],games:[{id:libraryGame.id,title:libraryGame.title,provider:'Steam',folder:'C:\\Steam\\steamapps\\common\\Game',bytes:120e9},{id:'unknown',title:'A game with its size still being measured',provider:'Epic',folder:'C:\\Games\\Unknown',bytes:null}]},{root:'D:\\',label:'Games',total:2e12,free:1.21e12,used:790e9,knownGameBytes:600e9,unknownGames:0,libraries:['D:\\SteamLibrary'],games:[]}]}));
    mock('steam:install-targets',()=>({libraries:[{root:'C:\\Steam',drive:'C:',free:20e9,total:1e12},{root:'D:\\SteamLibrary',drive:'D:',free:200e9,total:2e12}],downloadBytes:48.3e9,installBytes:71.8e9,needed:75e9,preferred:'C:\\Steam'}));mock('steam:remember-library',()=>true);
    await run('document.querySelectorAll("dialog[open]").forEach(d=>d.close());document.querySelector("#startup-screen").hidden=true;scanLibrary=async()=>{};state.soundEffects=false;document.documentElement.classList.add("reduce-motion");');
    const capture=async name=>{await pause(120);await fs.writeFile(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());};
    async function check(selector){const value=await run(`(()=>{const d=document.querySelector(${JSON.stringify(selector)}),r=d.getBoundingClientRect();refreshFocusables();return {open:d.open,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,overflow:d.scrollWidth-d.clientWidth,scoped:state.focusables.every(e=>d.contains(e))};})()`);assert(value.open&&value.left>=-1&&value.right<=value.width+1&&value.top>=-1&&value.bottom<=value.height+1&&value.overflow<=1&&value.scoped,JSON.stringify(value));}
    for(const [width,height] of [[1920,1080],[1280,800],[1024,640]]){
      win.setContentSize(width,height);
      await run('await openSettings();showSettingsPage("g-storage");');await pause(150);await check('#settings-dialog');
      assert(await run('document.querySelector("#storage-overview").textContent.includes("Size pending")'));await capture('storage-'+width);
      await run('showSettingsPage("g-streaming");');await pause(100);assert(await run('document.querySelector("#remote-hosts").textContent.includes("Gaming PC")'));await capture('hosts-'+width);
      await run('await performAction("remote-open-library",document.querySelector("[data-action=remote-open-library]"));');await pause(100);await check('#remote-library-dialog');await capture('remote-library-'+width);
      await run('document.querySelector("#remote-game-search").value="hades";document.querySelector("#remote-game-search").dispatchEvent(new Event("input",{bubbles:true}));');
      assert.equal(await run('document.querySelectorAll(".remote-game-card").length'),9);
      await run('document.querySelector("#remote-library-dialog").close();performAction("remote-add",document.querySelector("[data-action=remote-add]"));');await check('#remote-pair-dialog');
      await run('document.querySelector("#remote-host-address").value="192.168.1.20";await performAction("remote-connect",document.querySelector("[data-action=remote-connect]"));');
      assert.equal(await run('document.querySelector(".remote-pin").textContent'),'0123');await capture('pairing-'+width);
      await run('navigateBack();');await pause(30);assert.equal(await run('document.querySelector("#remote-pair-dialog").open'),false);
      await run(`settingsDialog.close();window.reviewInstallResult='pending';gInstallTo(state.games.find(g=>g.id===${JSON.stringify(libraryGame.id)})).then(v=>window.reviewInstallResult=v);true`);await pause(80);await check('.g-install-to');
      assert.equal(await run('document.querySelector("[data-install-confirm]").disabled'),true,'Low space must disable installation');
      assert(await run('document.querySelector(".g-install-sizes").textContent.includes("Download")'));await capture('install-size-'+width);
      await run('document.querySelectorAll(".g-drive")[1].click();');assert.equal(await run('document.querySelector("[data-install-confirm]").disabled'),false);
      await run('document.querySelector("[data-install-confirm]").click();');await pause(20);assert.equal(await run('window.reviewInstallResult'),'D:\\SteamLibrary');
    }
    let resolveTargets;mock('steam:install-targets',()=>new Promise(resolve=>{resolveTargets=resolve;}));
    await run(`window.cancelledInstallResult='pending';gInstallTo(state.games.find(g=>g.id===${JSON.stringify(libraryGame.id)})).then(v=>window.cancelledInstallResult=v);true`);await pause(30);
    assert(await run('document.querySelector(".g-install-to").textContent.includes("Checking download sizes")'));
    await run('navigateBack();');resolveTargets({libraries:[{root:'D:\\SteamLibrary',free:100e9,total:1e12}],preferred:'D:\\SteamLibrary'});await pause(30);
    assert.equal(await run('window.cancelledInstallResult'),null);assert.equal(await run('Boolean(document.querySelector(".g-install-to"))'),false,'Late size lookup must not reopen a cancelled install');
    await run('document.querySelector("#remote-game-search").value="";await performAction("remote-open-library",document.querySelector(".console-library-nav [data-action=remote-open-library]"));');
    await pause(50);await run('setFocusedElement(document.querySelector(".remote-game-card"));await performAction("remote-library-refresh",document.querySelector("[data-action=remote-library-refresh]"));');
    assert.equal(await run('document.activeElement.classList.contains("remote-game-card")'),true,'Library refresh must preserve the focused game');
    await run('await performAction("remote-play-game",document.querySelector(".remote-game-card"));');
    assert.equal(starts,1);assert.equal(await run('launchOverlay.hidden'),false,'Launch curtain must remain until stream-ready');
    win.webContents.send('remote-play:status',{phase:'playing',session:{hostId:host.id,appId:'1',title:games[0].title,phase:'playing'}});await pause(30);
    assert.equal(await run('launchOverlay.hidden&&remotePlayUI.playing'),true);
    win.webContents.send('remote-play:status',{phase:'ended',hostId:host.id,appId:'1',title:games[0].title,reason:'game-closed'});await pause(120);
    assert.equal(await run('document.querySelector("#remote-library-dialog").open&&!remotePlayUI.active'),true);
    await run('await performAction("remote-play-game",document.querySelector(".remote-game-card"));cancelLaunchWait();');assert.equal(stops,1);assert.equal(await run('launchOverlay.hidden&&!remotePlayUI.active'),true);
    assert(cancels>=3);assert.deepEqual(errors,[]);clearTimeout(watchdog);
    await fs.writeFile(path.join(output,'result.json'),JSON.stringify({ok:true,sizes:[1920,1280,1024],starts,stops,errors},null,2));
    console.log('PASS remote host browser/search/PIN, storage and install-size dialogs at desktop and handheld sizes; scoped controller focus, low-space prevention, launch curtain, stream completion and cancellation');app.exit(0);
  }catch(error){console.error(error);await fs.writeFile(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
}));
require('../src/main.cjs');
