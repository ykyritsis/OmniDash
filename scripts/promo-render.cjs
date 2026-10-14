// Render editable marketing layouts; screenshot pixels are never repainted by AI.
const {app,BrowserWindow} = require('electron');
const fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../docs/promo/beta25-v2');
app.setPath('userData',path.resolve(__dirname,'../.visual-review/promo-artboards'));
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-device-scale-factor','1');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 const report=[];
 for(const [mode,width,height,file] of [['hero',1920,1080,'github-hero'],['square',1080,1080,'discord-square'],['social',1280,640,'github-social'],['ally',1920,1080,'promo-rog-ally'],['laptop',1920,1080,'promo-laptop'],['desktop',1920,1080,'promo-desktop'],['onboarding',1920,1080,'promo-onboarding'],['libraries',1920,1080,'promo-libraries'],['library',1920,1080,'promo-library'],['game',1920,1080,'promo-game-page'],['wordmark',1500,300,'logo-wordmark']]){
  const win=new BrowserWindow({width,height,useContentSize:true,show:false,transparent:mode==='wordmark',backgroundColor:mode==='wordmark'?'#00000000':'#090d0b',webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false}});
  await win.loadURL(pathToFileURL(path.join(root,'artboards.html')).href+'#'+mode);
  await win.webContents.executeJavaScript('Promise.all([...document.images].map(i=>i.decode()))');
  await new Promise(r=>setTimeout(r,350));
  const shot=await win.webContents.capturePage();
  await fs.writeFile(path.join(root,file+'.png'),shot.toPNG());
  if(mode!=='wordmark') await fs.writeFile(path.join(root,file+'.jpg'),shot.toJPEG(92));
  report.push({file,width,height,size:shot.getSize()});win.destroy();
 }
 await fs.writeFile(path.resolve(__dirname,'../.visual-review/promo-render.json'),JSON.stringify(report,null,2));app.exit(0);
}).catch(e=>{console.error(e);app.exit(1)});
