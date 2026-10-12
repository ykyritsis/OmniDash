const {app,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const output=path.resolve(__dirname,'../.visual-review/connections-score');
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>{
 const errors=[];win.webContents.on('console-message',(_,details)=>{if(details.level===3)errors.push(details.message);});
 win.webContents.once('did-finish-load',async()=>{
  try{
   await fs.mkdir(output,{recursive:true});await pause(2500);win.setContentSize(1280,800);
   const run=async s=>{try{return await win.webContents.executeJavaScript(`try{${s}}catch(e){window.reviewError=e.stack;throw e;}`);}catch(error){throw Error(`${s}\n${await win.webContents.executeJavaScript('window.reviewError')}\n${errors.join('\n')}`);}};
   const capture=async name=>{await pause(300);await fs.writeFile(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());};
   await run(`(async()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();await window.launcher.saveSettings({onboardingComplete:true});await openSettings();showSettingsPage('services');if(document.querySelectorAll('.connection-tile').length!==7)throw Error('Missing library tiles');if(!settingsDialog.querySelector('button[value="save"]').hidden)throw Error('Redundant Save shown');refreshFocusables();if(state.focusables.some(e=>!settingsDialog.contains(e)))throw Error('Focus escaped hub');})()`);
   await capture('library-hub');
   await run(`(async()=>{await openLibraryConnection('ea');if(document.querySelector('[data-settings-page="connection-ea"]').hidden)throw Error('EA page missing');})()`);
   win.webContents.send('connection:progress',{provider:'ea',phase:'waiting',message:'Waiting for EA sign-in…'});await pause(50);
   await run(`if(document.querySelector('[data-account-provider="ea"] [data-connect-cancel]').hidden)throw Error('Cancel missing');`);
   win.webContents.send('connection:progress',{provider:'ea',phase:'connected',message:'EA app connected. 12 games found.'});await pause(100);
   await run(`if(document.querySelector('[data-account-provider="ea"] [data-account-badge]').textContent!=='Connected')throw Error('Confirmation missing');if(!document.querySelector('[data-account-provider="ea"] [data-connect-cancel]').hidden)throw Error('Cancel remained');`);
   await capture('account-connected');
   await run(`(async()=>{await openLibraryConnection('steam');if(!document.querySelector('#steam-api-key'))throw Error('Steam setup missing');})()`);await capture('steam-setup');
   await run(`(async()=>{await openLibraryConnection('drive');})()`);await capture('drive-setup');
   ipcMain.removeHandler('profile:score');ipcMain.handle('profile:score',()=>({points:2800,checked:3,total:3,unlocked:52,completed:2,level:2,canSync:true,lastSync:Date.now(),games:[{appId:'10',title:'Completed game',points:1000,possible:1000,unlocked:20,total:20,completed:true},{appId:'20',title:'Adventure game',points:800,possible:1000,unlocked:12,total:16,completed:false}]}));
   await run(`settingsDialog.close();performAction('avatar-picker');renderPlayerScore({points:2800,checked:3,total:3,unlocked:52,completed:2,level:2,canSync:true,lastSync:Date.now(),games:[{appId:'10',title:'Completed game',points:1000,possible:1000,unlocked:20,total:20,completed:true},{appId:'20',title:'Adventure game',points:800,possible:1000,unlocked:12,total:16,completed:false}]});document.querySelector('.pc-score-breakdown').open=true;`);await capture('profile-score');
   await run(`document.querySelector('#pc-score-calculator-open').click();refreshFocusables();if(!state.focusables.length||state.focusables.some(e=>!pcScoreCalculator.contains(e)))throw Error('Calculator focus escaped');if(Object.values(updateScoreCalculator().pointTable).reduce((n,a)=>n+a.points,0)!==1000)throw Error('Point budget wrong');`);await capture('score-calculator');
   await run(`for(const check of pcScoreCalculator.querySelectorAll('[data-score-earned]'))check.checked=true;if(updateScoreCalculator().points!==1000)throw Error('Completion score wrong');for(const check of pcScoreCalculator.querySelectorAll('[data-score-earned]'))check.checked=false;if(updateScoreCalculator().points!==0)throw Error('Locked score wrong');if(document.querySelector('#profile-score-value').textContent!=='2,800')throw Error('Calculator changed earned score');navigateBack();if(pcScoreCalculator.open)throw Error('Back did not close calculator');`);
   win.setContentSize(1024,640);win.webContents.setZoomFactor(1.25);
   await run(`(async()=>{avatarDialog.close();await openSettings();showSettingsPage('services');})()`);await capture('hub-small');
   await run(`if(document.documentElement.scrollWidth>innerWidth+1)throw Error('Horizontal overflow');const r=settingsDialog.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight+1)throw Error('Dialog overflow');`);
   if(errors.length)throw Error(errors.join('\n'));
   await fs.writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,rendererErrors:errors,checks:['seven service tiles','focused setup pages','connection confirmation/cancel','Steam/Drive setup','verified score breakdown','calculator 1000/0 totals','calculator never awards score','controller modal focus/back','small-screen layout']},null,2));app.exit(0);
  }catch(error){await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({error:error.stack},null,2));app.exit(1);}
 });
});
require(process.env.CONNECTIONS_REVIEW_MAIN||'../src/main.cjs');
