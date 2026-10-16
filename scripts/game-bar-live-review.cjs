// Explicit local overlay check only: no games, pairing or existing profile changes.
const {app}=require('electron');
const path=require('node:path');
process.env.NEBULA_DEMO='1';delete process.env.NEBULA_REVIEW;delete process.env.NEBULA_CAPTURE_SET;
process.env.NEBULA_DEMO_GPU='1';
process.env.NEBULA_DEMO_USER_DATA=path.resolve(__dirname,'../.visual-review/game-bar-live/profile-'+process.pid);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const watchdog=setTimeout(()=>app.exit(1),20000);
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
 try {
  await pause(2000);win.setFullScreen(false);win.show();win.focus();await pause(400);
  const start=Date.now();
  const result=await win.webContents.executeJavaScript('window.launcher.openGameBar()');
  console.log(JSON.stringify({gameBarForegroundConfirmed:result,elapsedMs:Date.now()-start}));
  clearTimeout(watchdog);app.exit(0);
 }catch(error){console.error(error.message);clearTimeout(watchdog);app.exit(1);}
}));
require('../src/main.cjs');
