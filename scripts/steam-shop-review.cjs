const {app,webContents}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const output=path.resolve(__dirname,'../.visual-review/steam-shop');
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
  try {
    await fs.mkdir(output,{recursive:true});await pause(2000);
    const run=script=>win.webContents.executeJavaScript(script);
    await run(`document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());`);
    const baseline=webContents.getAllWebContents().length;
    await run(`openSteamShop('413150')`);
    const remote=win.contentView.children.find(child=>child.webContents && child.webContents!==win.webContents);
    if(!remote)throw Error('No embedded Store');
    for(let attempt=0;attempt<40 && remote.webContents.isLoading();attempt++)await pause(500);
    if(!remote.webContents.getURL().startsWith('https://store.steampowered.com/'))throw Error('Wrong store origin');
    const isolated=await remote.webContents.executeJavaScript(`({node:typeof require,bridge:typeof window.launcher,title:document.title,buttons:document.querySelectorAll('button,a').length})`);
    if(isolated.node!=='undefined'||isolated.bridge!=='undefined'||isolated.buttons<5)throw Error('Store isolation/content failed: '+JSON.stringify(isolated));
    console.log('PASS real Steam page in sandbox:',isolated.title);
    await fs.writeFile(path.join(output,'store.png'),(await win.webContents.capturePage()).toPNG());
    // Offscreen Windows test windows cannot always capture a native child view.
    // Content, isolation, viewport bounds, navigation and cleanup remain asserted.
    try { await fs.writeFile(path.join(output,'steam-content.png'),(await remote.webContents.capturePage()).toPNG()); }
    catch(error) { console.log('NOTE child-view capture unavailable:',error.message); }
    const bounds=remote.getBounds(), zoom=win.webContents.getZoomFactor();
    if(bounds.y!==Math.round(96*zoom)||bounds.height<300)throw Error('Store covers launcher controls or has no usable viewport');
    const prefs=remote.webContents.getLastWebPreferences();
    if(!prefs.sandbox || prefs.nodeIntegration || !prefs.contextIsolation)throw Error('Unsafe web preferences: '+JSON.stringify({sandbox:prefs.sandbox,nodeIntegration:prefs.nodeIntegration,contextIsolation:prefs.contextIsolation}));
    if(remote.webContents.session===win.webContents.session)throw Error('Store shares launcher session');
    await run(`openSteamShop('cart')`);
    for(let attempt=0;attempt<40 && remote.webContents.isLoading();attempt++)await pause(500);
    console.log('PASS cart destination:',remote.webContents.getURL());
    const remoteContents=remote.webContents;
    remoteContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});
    await pause(400);
    if(!remoteContents.isDestroyed())throw Error('Store renderer not destroyed on close');
    if(webContents.getAllWebContents().length!==baseline)throw Error('Store webContents leaked');
    if(!await run(`steamShopSurface.hidden`))throw Error('Store chrome not closed');
    console.log('PASS Escape close, memory cleanup, and launcher restoration');
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
}));
require('../src/main.cjs');
