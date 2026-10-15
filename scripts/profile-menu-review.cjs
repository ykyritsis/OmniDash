const {app,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../.visual-review/profile-menu');
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile-'+process.pid);
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const watchdog=setTimeout(()=>{console.error('Profile review timed out');app.exit(1);},45000);
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
  const errors=[];win.webContents.on('console-message',event=>{if(/Uncaught|ReferenceError|TypeError|SyntaxError/.test(event.message))errors.push(event.message);});
  try{
    await fs.mkdir(output,{recursive:true});await pause(1800);win.setFullScreen(false);win.webContents.setZoomFactor(1);
    const run=code=>win.webContents.executeJavaScript(code.includes('await ')?`(async()=>{${code}})()`:code);
    const capture=async name=>{await pause(150);await fs.writeFile(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());};
    let reads=0,syncs=0;
    const summary={points:2800,checked:3,total:4,unlocked:52,completed:2,level:2,canSync:true,lastSync:Date.now(),status:'ready',remaining:1,games:[]};
    ipcMain.removeHandler('profile:score');ipcMain.handle('profile:score',async(_e,sync)=>{if(sync){syncs++;await pause(100);summary.points=syncs===1?2900:3500;summary.remaining=syncs===1?1:0;}else reads++;return {...summary};});
    await run('document.querySelectorAll("dialog[open]").forEach(d=>d.close());document.querySelector("#startup-screen").hidden=true;state.soundEffects=false;document.documentElement.classList.add("reduce-motion");window.reviewRefreshEligible=false;canRefreshScore=()=>reviewRefreshEligible;showView("home");scheduleScoreRefresh();');
    await pause(450);assert.equal(await run('scoreValue()'),'2,800');
    const cachedReads=reads;
    await run('await performAction("g-account",document.querySelector("#profile-button"));');
    assert.equal(reads,cachedReads,'Opening the PFP menu must use the already calculated score');
    assert.equal(syncs,0);assert.equal(await run('gAccountMenu.querySelectorAll(".g-menu-item").length'),4);
    assert(await run('gAccountMenu.textContent.includes("2,800")&&!/calculator|Scan for games|Give feedback|Online/.test(gAccountMenu.textContent)'));
    await run('setFocusedElement(gAccountMenu.querySelector("[data-action=g-account-settings]"));reviewRefreshEligible=true;scheduleBackgroundScore(1);');
    await pause(300);assert.equal(syncs,1);assert.equal(await run('document.activeElement.dataset.action'),'g-account-settings');
    assert(await run('gAccountMenu.textContent.includes("2,900")'),'Background score changes must update an open menu without moving focus');
    await run('gAccountMenu.close();');await pause(1700);assert.equal(syncs,2,'All score batches must continue after closing the menu');
    assert.equal(await run('scoreValue()'),'3,500');
    await run('reviewRefreshEligible=false;scheduleBackgroundScore(1);');await pause(60);assert.equal(syncs,2,'No background work during play or inactivity');
    for(const [width,height,zoom] of [[1280,800,1],[1024,640,1.25]]){
      win.setContentSize(width,height);win.webContents.setZoomFactor(zoom);
      await run('await performAction("g-account",document.querySelector("#profile-button"));refreshFocusables();');
      const box=await run('(()=>{const r=gAccountMenu.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,height:innerHeight,width:innerWidth,overflow:gAccountMenu.scrollWidth-gAccountMenu.clientWidth,scoped:state.focusables.every(e=>gAccountMenu.contains(e))};})()');
      assert(box.top>=0&&box.bottom<=box.height+1&&box.right<=box.width+1&&box.overflow<=1&&box.scoped,JSON.stringify(box));
      await capture('profile-menu-'+width);
      await run('await performAction("g-account-profile",gAccountMenu.querySelector("[data-action=g-account-profile]"));');
      assert(await run('avatarDialog.open&&document.querySelector("#profile-score-value").textContent==="3,500"&&document.querySelector("#profile-score-sync").hidden&&document.querySelector("#pc-score-calculator-open").hidden'));
      await capture('profile-overview-'+width);await run('avatarDialog.close();');
    }
    await run('renderPlayerScore({points:3500,checked:3,unlocked:52,canSync:false});await performAction("g-account",document.querySelector("#profile-button"));');
    assert(await run('gAccountMenu.textContent.includes("3,500")&&gAccountMenu.textContent.includes("Link Steam")'),'Offline/unlinked accounts must retain their verified score with an honest status');
    await run('gAccountMenu.close();renderPlayerScore({points:0,checked:0,canSync:false});');assert.equal(await run('scoreValue()'),'—','Unverified progress must not be presented as zero verified points');
    assert.deepEqual(errors,[]);clearTimeout(watchdog);console.log('PASS cached PFP score, automatic multi-batch sync without menu open, pause while inactive, focus-preserving updates, four simple actions and handheld/large-text layout.');app.exit(0);
  }catch(error){console.error(error);await fs.writeFile(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
}));
require('../src/main.cjs');
