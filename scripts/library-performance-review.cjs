// Large-library timings and interaction regressions in an isolated demo profile.
// No personal library, remote host, or game process is touched.
const {app, ipcMain} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const output = path.resolve(__dirname, '../.visual-review', process.env.GARRISON_OUT || 'library-performance');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile-' + process.pid);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const watchdog = setTimeout(() => {console.error('Library review timed out');app.exit(1);}, 90000);
app.on('browser-window-created', (_, win) => win.webContents.once('did-finish-load', async () => {
  const errors = [];
  win.webContents.on('console-message', event => {if (/Uncaught|ReferenceError|SyntaxError|TypeError/.test(event.message)) errors.push(event.message);});
  try {
    await fs.mkdir(output, {recursive:true}); await pause(6500);
    win.setFullScreen(false); win.setContentSize(1280,800); win.webContents.setZoomFactor(1);
    const run = code => win.webContents.executeJavaScript(`(async()=>{${code}})()`);
    const tile = pathToFileURL(path.resolve(__dirname, '../src/renderer/assets/collections/series/far-cry.jpg')).href;
    const nextTile = pathToFileURL(path.resolve(__dirname, '../src/renderer/assets/collections/series/call-of-duty.jpg')).href;
    ipcMain.removeHandler('news:get');ipcMain.handle('news:get',()=>[]);
    await run(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#startup-screen').hidden=true;state.soundEffects=false;scanLibrary=async()=>{};clearTimeout(gPrefetchTimer);gPrefetchGame=async()=>{};
      state.games=Array.from({length:1500},(_,i)=>({id:'perf-'+i,title:'Performance game '+(i%750),provider:i<750?'Steam':'Epic Games',installed:true,controls:'controller',addedAt:1500-i,lastPlayed:1500-i,artwork:{tile:${JSON.stringify(tile)}}}));
      state.remoteGames=[];state.duplicateMode='preferred';state.duplicatePreferredProvider='Steam';state.duplicatePreferences={};state.favoriteGameIds=state.games.slice(0,20).map(g=>g.id);state.customCollections=[];state.xboxStore={};state.searchQuery='';state.libraryCategory='games';state.libraryTab='my-games';state.librarySort='name';state.sourceFilter='all';state.installFilter='all';state.collectionFilter='all';showView('home');renderLibrary();`);
    const timings = await run(`
      const measure=async(fn)=>{const samples=[];for(let i=0;i<9;i++){await new Promise(r=>requestAnimationFrame(r));const t=performance.now();fn();samples.push(performance.now()-t);}return {medianMs:+samples.sort((a,b)=>a-b)[4].toFixed(2),samplesMs:samples.map(x=>+x.toFixed(2))};};
      const result={};
      result.preferredLookups100=await measure(()=>{for(let i=0;i<100;i++)displayedLibraryGames();});
      result.refreshHome=await measure(()=>renderLibrary());
      showView('library');renderLibrary();result.refreshLibrary=await measure(()=>renderLibrary());
      result.libraryNavigation20=await measure(()=>{setFocusedElement(libraryGrid.querySelector('.game-card'));for(let i=0;i<10;i++){moveFocus('right');moveFocus('down');}});
      showView('home');renderLibrary();result.domNodes=document.getElementsByTagName('*').length;return result;`);
    await fs.writeFile(path.join(output,'timings.json'),JSON.stringify(timings,null,2));
    console.log(JSON.stringify(timings));
    if (!process.env.GARRISON_PERF_BASELINE) {
      const checks = [];
      assert(await run(`return !document.querySelector('#dashboard-features img');`),'Hidden legacy Home shortcuts still load artwork');
      assert(await run(`return libraryGrid.querySelectorAll(':scope > .game-card').length<=LIBRARY_PAGE;`),'Home retained offscreen pages from a long library browsing session');
      await run(`showView('library');appendLibraryPage();window.reviewDeepCard=libraryGrid.querySelectorAll('.game-card')[100];setFocusedElement(window.reviewDeepCard,{scroll:false});showView('detail');showView('library',{restore:{element:window.reviewDeepCard,scrollTop:300}});`);
      assert(await run(`return window.reviewDeepCard.isConnected&&document.activeElement===window.reviewDeepCard;`),'Returning from game details lost a deep-library card');
      await run(`showView('home');`);
      checks.push('Hidden grid pages are bounded while Back from game details retains its card');
      // Refreshing one page must not recreate the other page's cards. Visiting
      // the other page must nevertheless reflect new library contents.
      assert(await run(`const old=libraryGrid.firstElementChild;state.games=[{...state.games[0],id:'new-game',title:'A newly installed game'},...state.games];renderLibrary();return libraryGrid.firstElementChild===old;`),'Home refresh rebuilt the hidden Library');
      await run(`showView('library');`);
      assert(await run(`return !!libraryGrid.querySelector('[data-game-id="new-game"]');`),'Deferred Library did not include the new game');
      assert(await run(`const old=recentRow.firstElementChild;state.games=state.games.filter(g=>g.id!=='new-game');renderLibrary();return recentRow.firstElementChild===old;`),'Library refresh rebuilt hidden Home');
      await run(`showView('home');`);
      assert(await run(`return !recentRow.querySelector('[data-game-id="new-game"]');`),'Deferred Home retained a removed game');
      checks.push('Hidden pages stay untouched; deferred pages show additions/removals on entry');
      // A repeated cache notification must preserve decoded images, collection
      // rows, the My games tile, and the controller's actual focused button.
      await run(`setFocusedElement(recentRow.querySelector('.g-library-tile'));`); await pause(650);
      await run(`window.reviewFocus=document.activeElement;window.reviewRow=gHomeRows.firstElementChild;window.reviewImages=[...recentRow.querySelectorAll('img')];window.reviewScroll=recentRow.scrollLeft;`);
      const unchanged = await run(`return state.games.slice(0,12).map(g=>({id:g.id,artwork:g.artwork}));`);
      win.webContents.send('library:artwork',unchanged); await pause(2800);
      const unchangedState = await run(`return {focus:document.activeElement===window.reviewFocus,rows:gHomeRows.firstElementChild===window.reviewRow,images:window.reviewImages.every(n=>n.isConnected),scroll:Math.abs(recentRow.scrollLeft-window.reviewScroll)<1};`);
      assert(Object.values(unchangedState).every(Boolean),'Unchanged artwork reset decoded images, rows, or controller focus: '+JSON.stringify(unchangedState));
      win.webContents.send('library:artwork',unchanged.map(change=>({...change,artwork:{tile:nextTile}}))); await pause(2800);
      assert(await run(`return document.activeElement===window.reviewFocus&&gHomeRows.firstElementChild===window.reviewRow&&Math.abs(recentRow.scrollLeft-window.reviewScroll)<1&&[...recentRow.querySelectorAll('[data-art-game-id]')].every(n=>n.getAttribute('src')===${JSON.stringify(nextTile)});`),'New covers did not patch all visible cards and the My games collage in place');
      checks.push('Repeated artwork is ignored; changed covers patch cards/collage without rebuilding rows or losing focus');
      // Unknown controller support affects collection membership, unlike art.
      const controllerCount = await run(`state.games[20].controls='unknown';renderLibrary();return Number(document.querySelector('[aria-labelledby="home-controller-title"] .collection-count').textContent.split(' ')[0]);`);
      win.webContents.send('library:artwork',[{id:'perf-20',artwork:{tile:nextTile,controls:'controller'}}]); await pause(2800);
      assert(await run(`return state.games[20].controls==='controller';`),'Artwork metadata lost controller support');
      assert.equal(await run(`return Number(document.querySelector('[aria-labelledby="home-controller-title"] .collection-count').textContent.split(' ')[0]);`),controllerCount+1,'New controller support must update collection membership');
      // Source-specific browsing must retain every copy even in preferred mode.
      assert(await run(`return displayedLibraryGames().length===750&&displayedLibraryGames('Epic Games').length===1500;`),'Preferred copies/source browsing changed');
      await run(`state.games[0].installed=false;`);
      assert(await run(`return displayedLibraryGames().some(g=>g.id==='perf-750')&&!displayedLibraryGames().some(g=>g.id==='perf-0');`),'Installed-copy preference became stale');
      checks.push('Controller metadata and live duplicate preferences remain accurate');
      const history = await run(`
        const original=Storage.prototype.getItem;let reads=0;
        Storage.prototype.getItem=function(key){if(key==='lastLaunched')reads++;return original.call(this,key);};
        try {
          const values=Object.fromEntries(state.games.map((game,i)=>[game.id,10000+i]));localStorage.setItem('lastLaunched',JSON.stringify(values));window.dispatchEvent(new StorageEvent('storage',{key:'lastLaunched',storageArea:localStorage}));
          const times=state.games.map(game=>lastPlayedAt(game));state.games.forEach(game=>lastPlayedAt(game));const coldReads=reads;
          rememberLaunch('perf-0');const recorded=lastPlayedAt(state.games[0])>10000&&JSON.parse(original.call(localStorage,'lastLaunched'))['perf-0']===lastPlayedAt(state.games[0]);
          localStorage.setItem('lastLaunched',JSON.stringify({'perf-0':Date.now()+1000}));window.dispatchEvent(new StorageEvent('storage',{key:'lastLaunched',storageArea:localStorage}));const external=lastPlayedAt(state.games[0])>Date.now();
          localStorage.setItem('lastLaunched','invalid');window.dispatchEvent(new StorageEvent('storage',{key:'lastLaunched',storageArea:localStorage}));const invalid=lastPlayedAt({id:'unknown'})===0;
          return {coldReads,recorded,external,invalid,values:times.every((time,i)=>time===10000+i)};
        } finally {Storage.prototype.getItem=original;localStorage.removeItem('lastLaunched');window.dispatchEvent(new StorageEvent('storage',{key:'lastLaunched',storageArea:localStorage}));}`);
      assert.equal(history.coldReads,1,'Reading play history during sorting must access storage once');
      assert(history.recorded&&history.external&&history.invalid&&history.values,JSON.stringify(history));
      checks.push('Play history reads once; launches, external changes and corrupt storage stay safe');
      await fs.writeFile(path.join(output,'home.png'),(await win.webContents.capturePage()).toPNG());
      await run(`state.games=[{id:'only-app',title:'Only an app',provider:'PC',isApp:true,installed:true}];state.remoteGames=[];renderLibrary();`);
      assert(await run(`return state.view==='library'&&!!libraryGrid.querySelector('[data-game-id="only-app"]');`),'An app-only library must open its apps');
      await run(`showView('home');state.games=[];renderLibrary();showView('library');`);
      assert(await run(`return !!libraryGrid.querySelector('.console-library-empty');`),'Removing the last item must show the Library empty state');
      checks.push('App-only and empty-library navigation remain usable');
      assert.deepEqual(errors,[]);
      await fs.writeFile(path.join(output,'checks.json'),JSON.stringify({checks,errors},null,2));
      console.log('PASS: '+checks.join('; '));
    }
    clearTimeout(watchdog);app.exit(0);
  } catch(error) {console.error(error);clearTimeout(watchdog);app.exit(1);}
}));
require(process.env.GARRISON_MAIN || '../src/main.cjs');
