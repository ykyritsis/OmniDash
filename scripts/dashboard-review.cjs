// Exercise the console surfaces with an isolated profile. No real games launch.
const { app, ipcMain } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const output = path.resolve(__dirname, '../.visual-review/dashboard');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output,'profile');
const pause = ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.on('browser-window-created',(_,win)=>{
  win.webContents.on('console-message',(_event,details)=>{if(details.level===3)console.error('Renderer:',details.message);});
  win.webContents.once('did-finish-load',async()=>{
    try {
      await fs.mkdir(output,{recursive:true});
      const run=async script=>{
        try { return await win.webContents.executeJavaScript(script); }
        catch(error) { console.error('Review step:',script);throw error; }
      };
      await pause(6000);
      await run(`(()=>{const fixture={id:'cover-test',title:'Test cover',artwork:{tile:'https://cdn.akamai.steamstatic.com/steam/apps/1551360/library_600x900.jpg',logo:'logo.png',tileIsSquare:false,overlayLogo:false}};if(/fallback-title|tile-logo/.test(gameArt(fixture)))throw Error('Unchecked logo overlay added a duplicate title');fixture.artwork.overlayLogo=true;if(!gameArt(fixture).includes('tile-logo'))throw Error('Explicit logo overlay was ignored');fixture.artwork={};if(!gameArt(fixture).includes('Test cover'))throw Error('Missing cover did not show its title');})()`);
      await run(`(async()=>{const pack=await window.launcher.getSoundPack();const count=await interfaceAudio.load(pack);if(count!==Object.keys(pack).length)throw Error('Sound pack failed to decode');})()`);
      win.setContentSize(1920,1080);
      win.webContents.setZoomFactor(1);
      let catalog=[];
      try {catalog=JSON.parse(await fs.readFile(path.join(output,'../catalog-live/gamepass-catalog.json'),'utf8')).games;}catch{}
      // Real public catalog artwork is optional; the behavioral checks also run offline.
      if(catalog.length) {
        const priorities=['9NKX70BBCDRN','9NP1P1WFS0LB','9NFTC552K3GJ','9P2N57MC619K','9PMBB7NGHV95'];
        const games=[...priorities.map(id=>catalog.find(game=>game.xboxProductId===id)).filter(Boolean),...catalog.filter(game=>!priorities.includes(game.xboxProductId)).slice(0,8)]
          .map((game,index)=>({...game,id:'dashboard-fixture-'+index,installed:true,discoveryOnly:false,playCount:0}));
        ipcMain.removeHandler('game:details');ipcMain.handle('game:details',(_,id)=>games.find(game=>game.id===id)?.details||{});
        ipcMain.removeHandler('game:achievements');ipcMain.handle('game:achievements',()=>({items:[],status:'none-listed',progressAvailable:false}));
        await run(`state.games=${JSON.stringify(games)};state.soundEffects=false;state.shuffleHomeScreenshots=false;state.steamBannerDismissed=true;renderSteamConnectionStatus();state.selectedGameId=state.games[0].id;renderLibrary();selectGame(state.selectedGameId,false);`);
        // These are layout fixtures with actual catalog art, not fabricated live charts.
        await run(`state.steamDiscovery.mostPlayed=state.games.slice(0,5).map((game,index)=>({...game,id:'steam-discovery-'+['1551360','1240440','1817230','1172620','2461850'][index],appId:['1551360','1240440','1817230','1172620','2461850'][index],provider:'Steam',installed:false,discoveryOnly:true,currentPlayers:100000-index*12000}));state.steamDiscovery.topSellers=state.steamDiscovery.mostPlayed.map(game=>({...game}));state.steamDiscovery.upcoming=state.steamDiscovery.mostPlayed.map(game=>({...game}));`);
      }
      const capture=async name=>{
        await pause(650);
        await run(`Promise.race([Promise.all([...document.images].filter(image=>image.getBoundingClientRect().bottom>0&&image.getBoundingClientRect().top<innerHeight).map(image=>image.decode().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,5000))])`);
        await fs.writeFile(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());
        const result=await run(`(()=>{const dialog=topmostOpenDialog();return {overflow:document.documentElement.scrollWidth>innerWidth,dialog:dialog?.id,fits:!dialog||(dialog.getBoundingClientRect().top>=0&&dialog.getBoundingClientRect().bottom<=innerHeight+1)}})()`);
        if(result.overflow||!result.fits)throw Error(name+': '+JSON.stringify(result));
        console.log('PASS',name);
      };
      await run(`showView('home');setFocusedElement(recentRow.querySelector('.game-card'),{scroll:false})`);
      await capture('home-1920');
      await run(`moveFocus('up');if(recentRow.classList.contains('row-focused'))throw Error('Recent tiles did not settle when focus left');const widths=[...recentRow.children].map(tile=>tile.offsetWidth);if(Math.max(...widths)-Math.min(...widths)>1)throw Error('Unfocused Home tiles have different sizes');`);
      await capture('home-navigation');
      await run(`moveFocus('down');if(!recentRow.classList.contains('row-focused'))throw Error('Recent row did not expand on return');`);
      await run(`(async()=>{applyAmbientImage({id:'failed-art',title:'Failure'},'data:image/png;base64,bm90LWFuLWltYWdl','test');await new Promise(r=>setTimeout(r,50));if(!state.ambientKey.startsWith('failed-art:')||visibleAmbient.style.backgroundImage.includes('url('))throw Error('Failed image did not use the neutral fallback');applyAmbientImage({id:'slow-art',title:'Older'},'assets/xbox.svg','test');applyAmbientImage({id:'latest-art',title:'Latest'},null,'test');await new Promise(r=>setTimeout(r,100));if(!state.ambientKey.startsWith('latest-art:'))throw Error('Older background request won a race');updateAmbient(state.games[0],true);})()`);
      await run(`openConsoleStore(false)`);
      await capture('native-store');
      await run(`(()=>{if(document.querySelectorAll('[data-store-shelf]').length!==3)throw Error('Store is missing a collection');const first=document.querySelector('.native-store-products .focusable');setFocusedElement(first,{scroll:false});moveFocus('down');if(!state.focusedElement.closest('.store-shelf'))throw Error('Store secondary row unreachable');moveFocus('down');if(state.focusedElement.closest('[data-store-shelf]').dataset.storeShelf!=='upcoming')throw Error('Last Store shelf unreachable');moveFocus('up');moveFocus('up');if(state.focusedElement!==first)throw Error('Store row return lost column');})()`);
      await run(`(()=>{const cards=[...document.querySelectorAll('.native-store-products .store-product')];for(let index=0;index<16;index++)setFocusedElement(cards[index%cards.length],{scroll:false});if(document.querySelectorAll('.store-product-selected').length!==1)throw Error('Store selection was duplicated');const selected=state.steamDiscovery.mostPlayed[2];selected.artwork={...selected.artwork,hero:'assets/xbox.svg'};updateNativeStoreArtwork(selected.appId);if(!cards[2].querySelector('.store-wide-art').src.endsWith('assets/xbox.svg'))throw Error('Store artwork update missed the new cards');})()`);
      await pause(220);
      await run(`if(storeTileAnimations.size)throw Error('Store animation resources leaked');`);
      await run(`if(!document.querySelector('#store-view').classList.contains('native-store')||!document.querySelector('#store-rail'))throw Error('Native Store missing');navigateBack();setFocusedElement(recentRow.children[0],{scroll:false});`);
      await run(`(()=>{if(!document.fonts.check('26px "Segoe MDL2 Assets"'))throw Error('Microsoft icon font unavailable');const tiles=[...recentRow.children];for(let index=0;index<18;index++)setFocusedElement(tiles[index%tiles.length],{scroll:false});if(recentRow.querySelectorAll('.selected').length!==1)throw Error('Rapid focus left multiple selected cards');setFocusedElement(tiles[0],{scroll:false});})()`);
      await pause(350);
      console.log('Home motion state',await run(`[...tileAnimations.values()].map(animation=>({state:animation.playState,time:animation.currentTime}))`));
      await run(`(()=>{if(tileAnimations.size)throw Error('Tile animations were not released');document.documentElement.classList.add('reduce-motion');setFocusedElement(recentRow.children[1],{scroll:false});if(tileAnimations.size)throw Error('Reduced motion still animates tiles');document.documentElement.classList.remove('reduce-motion');setFocusedElement(recentRow.children[0],{scroll:false});})()`);
      await run(`(()=>{const first=recentRow.querySelector('.game-card');moveFocus('right');if(state.focusedElement!==first.nextElementSibling)throw Error('Recent row Right failed');moveFocus('left');moveFocus('up');if(!state.focusedElement.closest('.top-center-nav'))throw Error('Recent row Up failed');moveFocus('down');if(state.focusedElement!==first)throw Error('Top navigation Down failed');})()`);
      await run(`toggleNav();if(state.view!=='library')throw Error('View shortcut did not open library');navigateBack();if(state.view!=='home')throw Error('View shortcut Back failed');if(document.querySelector('.dashboard-guide-button'))throw Error('Custom Guide button remains');`);
      await run(`showView('library');openConsoleChoice(document.querySelector('#library-sort'));`);
      await capture('option-picker');
      await run(`(async()=>{await performAction('console-choice',document.querySelector('#console-choice-list [data-value=name]'));if(state.librarySort!=='name')throw Error('Choice did not apply');await new Promise(resolve=>setTimeout(resolve,20));if(document.activeElement.id!=='library-sort')throw Error('Choice focus not restored');await performAction('console-library-section',document.querySelector('.console-library-nav [data-section=groups]'));})()`);
      await capture('groups');
      await run(`(async()=>{await performAction('collection-open',document.querySelector('#library-grid .collection-open'));if(state.consoleLibraryGroups||state.collectionFilter!=='favorites')throw Error('Group did not open');await performAction('console-library-section',document.querySelector('.console-library-nav [data-section=games]'));})()`);
      await capture('library');
      await run(`(()=>{const first=libraryGrid.querySelector('.focusable');setFocusedElement(first);moveFocus('left');if(!state.focusedElement.closest('.console-library-nav'))throw Error('Library left edge missed sidebar');moveFocus('right');if(state.focusedElement!==first)throw Error('Sidebar did not return to first game');moveFocus('down');if(state.focusedElement.getBoundingClientRect().top<=first.getBoundingClientRect().top)throw Error('Library lower row unreachable');moveFocus('up');if(state.focusedElement!==first)throw Error('Library column was not preserved');setFocusedElement(document.querySelector('#library-filter-button'));performAction('console-library-filters');})()`);
      await capture('library-filters');
      await run(`if(document.querySelector('#library-source-filter').closest('label')?.textContent.startsWith('Source')!==true||document.querySelector('#library-filters-dialog').textContent.includes('null'))throw Error('Filter controls were not moved into labeled fields');`);
      await run(`(async()=>{openConsoleChoice(document.querySelector('#library-source-filter'));navigateBack();await new Promise(r=>setTimeout(r,30));if(topmostOpenDialog()?.id!=='library-filters-dialog')throw Error('Filter choice Back escaped sheet');await performAction('library-install-filter',document.querySelector('[data-installed=uninstalled]'));if(!libraryGrid.querySelector('.console-library-empty'))throw Error('No-results state missing');navigateBack();await new Promise(r=>setTimeout(r,30));if(document.activeElement.id!=='library-filter-button')throw Error('Filter focus did not return');})()`);
      await capture('library-empty-filter');
      await run(`performAction('console-library-clear');if(state.installFilter!=='all'||!libraryGrid.querySelector('.game-card'))throw Error('Reset filters did not restore games');setFocusedElement(libraryGrid.querySelector('.game-card'));window.reviewSearchOrigin=document.activeElement;openConsoleSearch();librarySearch.value=state.games[0].title;librarySearch.dispatchEvent(new Event('input'));if(state.view!=='library'||state.searchQuery)throw Error('Search changed the underlying page');`);
      await capture('library-search');
      await run(`(async()=>{const result=document.querySelector('.console-search-game');if(!result||result.dataset.gameId!==state.games[0].id)throw Error('Search results wrong');setFocusedElement(result);await performAction('console-search-game',result);await new Promise(r=>setTimeout(r,30));if(state.view!=='detail'||document.activeElement.id!=='detail-play')throw Error('Search result did not focus Play');navigateBack();await new Promise(r=>setTimeout(r,30));if(!document.querySelector('#console-search-dialog').open||document.activeElement.dataset.gameId!==result.dataset.gameId)throw Error('Game Back lost search results');navigateBack();await new Promise(r=>setTimeout(r,30));if(state.view!=='library'||document.activeElement!==reviewSearchOrigin)throw Error('Search Back did not restore original selection');librarySearch.value='';})()`);
      await run(`performAction('avatar-picker')`);
      await capture('profile-empty');
      await run(`navigateBack();state.games.slice(0,4).forEach(game=>game.playCount=1);performAction('avatar-picker');`);
      await capture('profile-recent');
      await run(`if(!document.querySelector('[data-action=profile-save]').closest('[hidden]'))throw Error('Save shown on profile overview');showProfilePage('customize');`);
      await capture('profile-customize');
      await run(`navigateBack()`);
      await run(`(()=>{const before=focusListBuilds;refreshFocusables();const baseline=focusListBuilds;for(let i=0;i<100;i++)refreshFocusables();if(focusListBuilds!==baseline)throw Error('Unchanged focus list was rebuilt');const control=libraryGrid.querySelector('.focusable');control.disabled=true;refreshFocusables();if(state.focusables.includes(control))throw Error('Disabled item remained in focus cache');control.disabled=false;refreshFocusables();if(!state.focusables.includes(control))throw Error('Re-enabled item missing from focus cache');})()`);
      await run(`void openConsoleFiles('game')`);
      await pause(300);
      await run(`browseConsoleFiles(${JSON.stringify(path.resolve(__dirname,'../node_modules/electron/dist'))})`);
      await capture('game-picker');
      await run(`(async()=>{const entry=[...document.querySelectorAll('.console-file-entry')].find(node=>node.dataset.path.endsWith('electron.exe'));if(!entry)throw Error('Executable not listed');const imported=await window.launcher.addGame(entry.dataset.path);if(!imported?.executable.endsWith('electron.exe'))throw Error('Import path was not accepted');navigateBack();})()`);
      await run(`showView('home');`);
      await run(`showView('library');searchPopover.hidden=false;navigateBack();if(state.view!=='home')throw Error('Deferred Search close swallowed Library Back');`);
      // Input is injected at the Gamepad API boundary; no physical-device claim.
      await run(`window.reviewPad={index:42,id:'Xbox Controller (review)',mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[window.reviewPad]});Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>true});state.gamepadIndex=42;state.previousButtons=[];window.reviewPress=async index=>{reviewPad.buttons[index]={pressed:true,value:1};pollGamepad();reviewPad.buttons[index]={pressed:false,value:0};await new Promise(r=>setTimeout(r,25));pollGamepad();};setFocusedElement(recentRow.querySelector('.game-card'),{scroll:false});`);
      await run(`(async()=>{await reviewPress(15);if(document.activeElement!==recentRow.querySelector('.game-card').nextElementSibling)throw Error('Gamepad D-pad failed');const before=state.focusedElement;await reviewPress(16);if(state.focusedElement!==before||state.view!=='home'||topmostOpenDialog())throw Error('Xbox button was intercepted');await reviewPress(9);if(!gameOptionsDialog.open)throw Error('Menu did not open game options');await reviewPress(1);if(document.activeElement!==before)throw Error('Options focus did not return');await reviewPress(3);if(!document.querySelector('#console-search-dialog').open||document.activeElement!==librarySearch)throw Error('Y did not focus native-keyboard search');await reviewPress(1);await reviewPress(1);await reviewPress(8);if(state.view!=='library')throw Error('Gamepad View shortcut failed');await reviewPress(1);if(state.view!=='home')throw Error('Library Back failed');await openSettings();openConsoleSettingsPage('audio',document.querySelector('[data-page=audio]'));void openConsoleFiles('image');})()`);
      await run(`(async()=>{await reviewPress(1);if(document.querySelector('#console-file-dialog').open||!settingsDialog.open||document.querySelector('[data-settings-page=audio]').hidden)throw Error('B did not return to the audio page');await reviewPress(1);if(!settingsDialog.open||document.querySelector('#console-settings-general').hidden||document.activeElement.dataset.page!=='audio')throw Error('B did not return to General');await reviewPress(1);if(settingsDialog.open)throw Error('B did not close Settings');Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>false});clearTimeout(gamepadPollTimer);gamepadPollTimer=null;})()`);
      await run(`(()=>{Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>true});showView('library');reviewPad.buttons[1]={pressed:true,value:1};focusForGamepad(reviewPad);pollGamepad();if(state.view!=='library')throw Error('Held Back was repeated after regaining focus');reviewPad.buttons[1]={pressed:false,value:0};pollGamepad();Object.defineProperty(document,'hasFocus',{configurable:true,value:()=>false});clearTimeout(gamepadPollTimer);gamepadPollTimer=null;})()`);
      if(catalog.length) {
        ipcMain.removeHandler('xbox:gamepass-catalog');ipcMain.handle('xbox:gamepass-catalog',()=>catalog.slice(0,30));
        ipcMain.removeHandler('xbox:catalog-details');ipcMain.handle('xbox:catalog-details',(_,id)=>catalog.find(game=>game.xboxProductId===id).details);
        await run('openConsoleStore(true)');
        await capture('game-pass');
        await run(`window.reviewCatalogCard=[...document.querySelectorAll('.console-catalog-card')].at(-1);setFocusedElement(reviewCatalogCard,{scroll:false});document.querySelector('main').scrollTo({top:220,behavior:'instant'});window.reviewCatalogScroll=document.querySelector('main').scrollTop;performAction('gamepass-game',reviewCatalogCard)`);
        await capture('catalog-detail');
        await run(`if(state.view!=='detail'||!document.querySelector('#detail-play').textContent.includes('View in Xbox'))throw Error('Game Pass detail failed');navigateBack();if(state.view!=='store'||document.activeElement!==reviewCatalogCard||Math.abs(document.querySelector('main').scrollTop-reviewCatalogScroll)>2)throw Error('Catalog Back did not restore focus and scroll');`);
      }
      win.setContentSize(1280,720);
      await run(`showView('home');selectGame(state.games[0].id,false);setFocusedElement(recentRow.querySelector('.game-card'),{scroll:false})`);
      await capture('home-handheld');
      await run(`showView('library');setFocusedElement(libraryGrid.querySelector('.focusable'));openConsoleSearch();`);
      await capture('search-handheld');
      await run(`navigateBack();performAction('avatar-picker');`);
      await capture('profile-handheld');
      await run(`(()=>{const footer=document.querySelector('.profile-overview-actions').getBoundingClientRect();const cards=[...document.querySelectorAll('.profile-recent-game')];if(cards.some(card=>card.getBoundingClientRect().bottom>footer.top))throw Error('Profile footer covers recent-game titles');})()`);
      await run(`navigateBack()`);
      await run(`openSettings()`);
      await capture('settings-handheld');
      await run(`openConsoleSettingsPage('display',document.querySelector('[data-page=display]'));`);
      await capture('settings-display-handheld');
      await run(`navigateBack();`);
      await run('navigateBack();onboardingDialog.showModal();showOnboardingStep(0)');
      await capture('onboarding-handheld');
      await run(`(async()=>{const logo=color=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="10"><rect x="5" width="20" height="10" fill="'+color+'"/></svg>');if(!await isDarkGameLogo(logo('black')))throw Error('Dark wordmark was not detected');if(await isDarkGameLogo(logo('white')))throw Error('Light wordmark was misclassified');if(await isDarkGameLogo(logo('#00ff00')))throw Error('Color wordmark was misclassified');const opaque='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="30" height="10"><rect width="30" height="10" fill="black"/></svg>');if(await isDarkGameLogo(opaque))throw Error('Opaque image would become a white box');})()`);
      console.log('PASS: console navigation, choices, file import, catalog, and injected controller input');
      app.exit(0);
    }catch(error){console.error(error);console.error('UI failure state',await win.webContents.executeJavaScript(`({view:state.view,focus:document.activeElement?.outerHTML.slice(0,500),modal:topmostOpenDialog()?.id,detail:state.detailGameId,open:[...document.querySelectorAll('dialog[open]')].map(node=>node.id)})`).catch(()=>({})));await fs.writeFile(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
  });
});
require('../src/main.cjs');
