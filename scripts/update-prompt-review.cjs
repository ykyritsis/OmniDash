// Exercise the actual update modal with mocked update IPC; no real app update runs.
const {app,ipcMain}=require('electron');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const output=path.resolve(__dirname,'../.visual-review/update-prompt');
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const watchdog=setTimeout(()=>{console.error('Update prompt review timed out');app.exit(1);},90000);
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
 const errors=[];win.webContents.on('console-message',event=>{if(/Uncaught|ReferenceError|SyntaxError|TypeError/.test(event.message))errors.push(event.message);});
 const run=code=>win.webContents.executeJavaScript(code);
 const common={currentVersion:'0.27.0-beta.26',version:'0.27.0-beta.27',readyVersion:'0.27.0-beta.27',ready:true,progress:1,error:'',state:'ready'};
 let checked=0,installs=0,rejectInstall,reply=common;
 const emit=async values=>{win.webContents.send('updater:status',{...common,...values});await pause(100);};
 try{
  await fs.mkdir(output,{recursive:true});await pause(2200);win.setFullScreen(false);win.webContents.setZoomFactor(1);
  ipcMain.removeHandler('updater:check');ipcMain.handle('updater:check',()=>{checked++;return reply;});
  ipcMain.removeHandler('updater:install');ipcMain.handle('updater:install',()=>{installs++;return new Promise((_resolve,reject)=>{rejectInstall=reject;});});
  await run(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#startup-screen').hidden=true;launchOverlay.hidden=true;steamShopSurface.hidden=true;state.soundEffects=false;state.activeGameSession=null;scanLibrary=async()=>{};document.documentElement.classList.add('reduce-motion');refreshFocusables();setFocusedElement(state.focusables.find(e=>!e.closest('dialog')));window.updateReviewOpener=document.activeElement;`);
  const isOpen=()=>run(`document.querySelector('#g-update-dialog').open`);
  await emit({});assert.equal(await isOpen(),true);
  assert.equal(await run(`document.activeElement.dataset.action`),'g-update-install');
  for(const [width,height]of [[1920,1080],[1280,800],[1024,640]]){
   win.setContentSize(width,height);await pause(150);
   const bounds=await run(`(()=>{const d=document.querySelector('#g-update-dialog'),r=d.getBoundingClientRect();refreshFocusables();return {x:Math.abs((r.left+r.right)/2-innerWidth/2),y:Math.abs((r.top+r.bottom)/2-innerHeight/2),fits:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,overflow:d.scrollWidth>d.clientWidth+1,scoped:state.focusables.length===2&&state.focusables.every(e=>d.contains(e))};})()`);
   assert(bounds.x<=1&&bounds.y<=1&&bounds.fits&&!bounds.overflow&&bounds.scoped,JSON.stringify(bounds));
   await fs.writeFile(path.join(output,'ready-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
  }
  await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));`);assert.equal(await run(`document.activeElement.dataset.action`),'g-update-later');
  await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));`);assert.equal(await run(`document.activeElement.dataset.action`),'g-update-install');
  await run(`moveFocus('right');`);assert.equal(await run(`document.activeElement.dataset.action`),'g-update-later');
  await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);await pause(80);
  assert.equal(await isOpen(),false);assert.equal(await run(`document.activeElement===updateReviewOpener`),true);
  await emit({});assert.equal(await isOpen(),false,'Dismissed version does not reopen on status refresh');

  await emit({state:'downloading',version:'0.27.0-beta.28',ready:false,readyVersion:'',progress:.1});
  assert.equal(await isOpen(),true);await run(`window.updateReviewButton=document.activeElement;`);
  await emit({state:'downloading',version:'0.27.0-beta.28',ready:false,readyVersion:'',progress:.5});
  assert.equal(await run(`document.activeElement===updateReviewButton&&document.querySelector('.g-update-bar').getAttribute('aria-valuenow')==='50'`),true,'Progress preserves focused button');
  await emit({version:'0.27.0-beta.28',readyVersion:'0.27.0-beta.28'});
  assert.equal(await run(`document.activeElement===updateReviewButton`),true,'Finishing the download does not move focus onto Restart');
  await run(`document.querySelector('.g-update-secondary').click();`);await pause(60);assert.equal(await isOpen(),false,'Mouse can defer');
  await emit({version:'0.27.0-beta.28',readyVersion:'0.27.0-beta.28'});assert.equal(await isOpen(),false);

  await run(`openSettings()`);await pause(80);
  await run(`showSettingsPage('g-account');setFocusedElement(document.querySelector('#g-update-check'));`);
  assert.equal(await run(`document.activeElement.id`),'g-update-check');
  await run(`performAction('g-update-check',document.querySelector('#g-update-check'));true`);await pause(150);
  assert.equal(checked,1);assert.equal(await isOpen(),true,'Manual check can open over Settings');
  await run(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));`);await pause(80);
  assert.equal(installs,1,'Repeated activation starts one install');rejectInstall(new Error('Close your game before restarting'));await pause(150);
  assert.equal(await run(`!document.querySelector('.g-update-primary').disabled&&!document.querySelector('.g-update-error').hidden&&document.activeElement.classList.contains('g-update-primary')`),true);
  await fs.writeFile(path.join(output,'install-error.png'),(await win.webContents.capturePage()).toPNG());
  await run(`navigateBack();`);await pause(80);assert.equal(await isOpen(),false);assert.equal(await run(`document.activeElement.id`),'g-update-check');
  await run(`settingsDialog.close();powerDialog.showModal();`);
  await emit({version:'0.27.0-beta.29',readyVersion:'0.27.0-beta.29'});assert.equal(await isOpen(),false,'Automatic prompt waits for another modal');
  await run(`powerDialog.close();`);await pause(100);assert.equal(await isOpen(),true);await run(`navigateBack();`);await pause(60);
  await run(`document.querySelector('#startup-screen').hidden=false;`);
  await emit({version:'0.27.0-beta.30',readyVersion:'0.27.0-beta.30'});assert.equal(await isOpen(),false,'Prompt waits for startup screen');
  await run(`document.querySelector('#startup-screen').hidden=true;`);await pause(100);assert.equal(await isOpen(),true);await run(`navigateBack();`);await pause(60);
  await emit({state:'current',ready:false,readyVersion:''});assert.equal(await isOpen(),false);
  await emit({state:'error',ready:false,readyVersion:'',error:'Network unavailable'});assert.equal(await isOpen(),false,'Offline startup stays usable');
  assert.deepEqual(errors,[]);clearTimeout(watchdog);
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({ok:true,sizes:[1920,1280,1024],checked,installs,errors},null,2));
  console.log('PASS centred updates, keyboard/controller focus, mouse and Back dismissal, progress focus, manual checks, modal/startup deferral and install error recovery');app.exit(0);
 }catch(error){console.error(error);await fs.writeFile(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
}));
require('../src/main.cjs');
