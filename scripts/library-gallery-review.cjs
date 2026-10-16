const {app,ipcMain}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const output=path.resolve(__dirname,'../.visual-review',process.env.GARRISON_OUT||'library-gallery');
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile-'+process.pid);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const watchdog=setTimeout(()=>{console.error('Review timed out');app.exit(1);},90000);
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
  try {
    await fs.mkdir(output,{recursive:true});await pause(1800);win.setFullScreen(false);win.setContentSize(1280,800);win.webContents.setZoomFactor(1);
    const run=code=>win.webContents.executeJavaScript(`(async()=>{${code}})()`);
    ipcMain.removeHandler('news:get');ipcMain.handle('news:get',()=>[]);
    await run(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#startup-screen').hidden=true;state.soundEffects=false;scanLibrary=async()=>{};clearTimeout(gPrefetchTimer);gPrefetchGame=async()=>{};state.games=state.games.filter(g=>!g.isApp);showView('library');renderLibraryView();`);
    const results=[];
    for(const selector of ['.console-library-nav button','.console-library-nav button[data-section="games"]','.g-chip','#g-sort-button','#library-filter-button','#g-view-button','#library-grid .game-card']) {
      await run(`setFocusedElement(document.querySelector(${JSON.stringify(selector)}),{scroll:false});`);await pause(200);
      results.push(await run(`const el=document.activeElement,s=getComputedStyle(el),b=el.getBoundingClientRect();const ancestors=[];for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const c=getComputedStyle(p),r=p.getBoundingClientRect();if(c.overflowX!=='visible'||c.overflowY!=='visible'||c.maskImage!=='none')ancestors.push({className:p.className,overflow:c.overflow,mask:c.maskImage,top:b.top-r.top,bottom:r.bottom-b.bottom,left:b.left-r.left,right:r.right-b.right});}return {selector:${JSON.stringify(selector)},radius:s.borderRadius,shadow:s.boxShadow,height:b.height,ancestors};`));
      await fs.writeFile(path.join(output,`focus-${results.length}.png`),(await win.webContents.capturePage()).toPNG());
    }
    await fs.writeFile(path.join(output,'focus.json'),JSON.stringify(results,null,2));
    for (const result of results.slice(0,2)) {
      assert.equal(result.radius,'999px');
      const viewport=result.ancestors.find(item=>item.className.includes('console-library-nav'));
      assert(viewport.top>=24&&viewport.bottom>=24,'Tab glow needs clearance above and below the pill');
    }
    const layouts=[];
    for(const [width,height,zoom] of [[1024,640,1],[1280,800,1.25],[1920,1080,1]]) {
      win.setContentSize(width,height);win.webContents.setZoomFactor(zoom);await pause(250);
      await run(`showView('library');renderLibraryView();setFocusedElement(document.querySelector('.console-library-nav button'));`);
      const count=await run(`return document.querySelectorAll('.console-library-nav button').length;`);
      for(let i=1;i<count;i++){await run(`moveFocus('right');`);await pause(100);}
      await pause(350);
      const end=await run(`const buttons=document.querySelectorAll('.console-library-nav button');const el=document.activeElement,b=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return {last:el===buttons[buttons.length-1],top:b.top-p.top,bottom:p.bottom-b.bottom,left:b.left-p.left,right:p.right-b.right};`);
      assert(end.last,`All library tabs must be controller reachable at ${width}/${zoom}`);
      assert(end.top>=24&&end.bottom>=24&&end.left>=23&&end.right>=23,JSON.stringify(end));
      layouts.push({width,height,zoom,...end});
    }
    win.setContentSize(1280,800);win.webContents.setZoomFactor(1);
    const galleries=[];
    for(const fixture of require('./fixtures/steam-trailers.json')) {
      const game={id:`steam-${fixture.appId}`,appId:fixture.appId,title:fixture.title,provider:'Steam',artwork:{}};
      const details={title:game.title,description:'Gallery regression fixture',screenshots:[],videos:fixture.videos.map(video=>({...video,preview:video.preview.replace('293x165','600x338')}))};
      ipcMain.removeHandler('game:details');ipcMain.handle('game:details',()=>details);
      await run(`state.games.push(${JSON.stringify(game)});openGameDetails(${JSON.stringify(game.id)});`);await pause(400);
      await run(`const game=${JSON.stringify(game)},details=${JSON.stringify(details)};for(let i=0;i<3;i++)renderGarrisonTrailers(game,details);document.querySelector('#detail-gallery').scrollIntoView({block:'center'});`);
      // Scroll every lazy preview into view and verify the real Steam image loads.
      for(let i=0;i<6;i++) {
        await run(`document.querySelectorAll('.g-trailer')[${i}].scrollIntoView({block:'nearest',inline:'center'});`);
        for(let n=0;n<30;n++){if(await run(`return document.querySelectorAll('.g-trailer img')[${i}].naturalWidth>0;`))break;await pause(200);}
      }
      const gallery=await run(`const cards=[...document.querySelectorAll('.g-trailer')];return cards.map(card=>({caption:card.querySelector('.g-trailer-caption').textContent,preview:card.querySelector('img').currentSrc,loaded:card.querySelector('img').naturalWidth>0}));`);
      assert.equal(gallery.length,6,'Rerendering must replace trailers without multiplying them');
      assert(gallery.every(item=>item.loaded),`Steam thumbnails must load for ${game.title}`);
      assert.equal(new Set(gallery.map(item=>item.preview)).size,6);
      assert.equal(new Set(gallery.map(item=>item.caption)).size,6);
      const streams=await run(`const original=window.Hls;window.reviewStreams=[];window.Hls=class{static Events={ERROR:'error',MANIFEST_PARSED:'manifest'};static isSupported(){return true}on(){}loadSource(url){window.reviewStreams.push(url)}attachMedia(){}destroy(){}};try{for(const card of document.querySelectorAll('.g-trailer')){await performAction(card.dataset.action,card);gPlayer.close();await new Promise(r=>setTimeout(r,10));}return window.reviewStreams;}finally{window.Hls=original;}`);
      assert.deepEqual(streams,fixture.videos.map(video=>video.stream),'Each card must dispatch its own stream');
      await run(`setFocusedElement(document.querySelector('.g-trailer'));`);await pause(350);
      await fs.writeFile(path.join(output,`gallery-${fixture.appId}.png`),(await win.webContents.capturePage()).toPNG());
      galleries.push({title:game.title,gallery,streams});
    }
    await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({layouts,galleries},null,2));
    console.log('PASS rounded library glow, controller navigation at three layouts, real Steam previews, gallery rerendering and distinct trailer playback dispatch');
    clearTimeout(watchdog);app.exit(0);
  }catch(error){console.error(error);clearTimeout(watchdog);app.exit(1);}
}));
require('../src/main.cjs');
