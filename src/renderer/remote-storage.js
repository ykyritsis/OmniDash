// Remote libraries and local storage share the dashboard's normal dialog and
// controller focus system. The decoder itself is a native child surface.
(() => {
  let remote={available:true,hosts:[],session:null}, selectedHost='', remoteBusy=false, launchPending=false, waitForControllerRelease=false;
  let storage=null, selectedDrive='', storageRequest=0, libraryRequest=0, coverTimer=0;
  let preferences;try{preferences=JSON.parse(localStorage.getItem('remote-play-preferences')||'{}');}catch{preferences={};}
  const fmt=value=>Number(value)>0?formatBytes(value):value===0?'0 B':'Unavailable';
  const escape=escapeHtml;
  const streaming=document.querySelector('[data-settings-page="g-streaming"]');
  streaming.innerHTML=`<div class="remote-intro"><h3>Your PC games, wherever you play</h3><p>Connect to a Sunshine, Apollo or Vibepollo PC. Pair once, then browse and play its shared games here.</p></div><div class="remote-tools"><button class="g-button primary focusable" data-action="remote-add">Add a PC</button><button class="g-button focusable" data-action="remote-open-library">Browse remote games</button><button class="g-button focusable" data-action="remote-settings-refresh">Refresh PCs</button></div><div id="remote-hosts" aria-live="polite"></div><section class="remote-quality"><h3>Stream quality</h3><p>These settings apply to the next stream.</p><div class="remote-quality-options"><label>Resolution<select class="focusable" id="remote-resolution"><option value="1280x720">720p</option><option value="1280x800">1280 × 800</option><option value="1920x1080">1080p</option><option value="1920x1200">1920 × 1200</option><option value="2560x1440">1440p</option><option value="3840x2160">4K</option></select></label><label>Frame rate<select class="focusable" id="remote-fps"><option value="30">30 fps</option><option value="60">60 fps</option><option value="90">90 fps</option><option value="120">120 fps</option></select></label><label>Bitrate<select class="focusable" id="remote-bitrate"><option value="10000">10 Mbps</option><option value="20000">20 Mbps</option><option value="40000">40 Mbps</option><option value="80000">80 Mbps</option></select></label></div><p class="remote-help">While playing, disconnect with Ctrl + Alt + Shift + Q or LB + RB + A. The host can keep your game running so you can resume.</p></section>`;
  for(const [id,value] of [['resolution',preferences.resolution||'1920x1080'],['fps',preferences.fps||'60'],['bitrate',preferences.bitrate||'20000']]){
    const select=document.querySelector('#remote-'+id);select.value=value;
    select.addEventListener('pointerdown',event=>{event.preventDefault();openConsoleChoice(select);});
    select.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();openConsoleChoice(select);}});
    select.addEventListener('change',()=>{preferences[id]=select.value;try{localStorage.setItem('remote-play-preferences',JSON.stringify(preferences));}catch{}});
  }
  const storagePage=document.createElement('div');storagePage.className='settings-page g-settings-page';storagePage.dataset.settingsPage='g-storage';storagePage.hidden=true;
  storagePage.innerHTML='<div class="storage-heading"><div><h3>Storage overview</h3><p>Drive space and installed games on this PC.</p></div><button class="g-button focusable" data-action="storage-refresh">Refresh</button></div><div id="storage-overview" aria-live="polite"><p>Opening storage…</p></div>';
  document.querySelector('.settings-scroll').append(storagePage);

  const library=document.createElement('dialog');library.id='remote-library-dialog';library.className='remote-library-dialog';library.setAttribute('aria-labelledby','remote-library-title');
  library.innerHTML='<header><div><h2 id="remote-library-title">Remote games</h2><p id="remote-library-status" role="status"></p></div><button class="g-button focusable" data-action="remote-add">Add a PC</button><button class="g-button focusable" data-action="remote-library-refresh">Refresh games</button><button class="g-button focusable" data-action="remote-library-close">Close</button></header><div id="remote-host-tabs" role="tablist" aria-label="Remote PCs"></div><label class="remote-search-label">Search this PC<input id="remote-game-search" class="focusable" type="search" placeholder="Search games" autocomplete="off" /></label><div id="remote-game-grid" class="remote-game-grid"></div><footer>Enter / A Play · Esc / B Back · The stream ends when the host reports that the game has closed.</footer>';
  document.body.append(library);
  const pairDialog=document.createElement('dialog');pairDialog.id='remote-pair-dialog';pairDialog.className='remote-pair-dialog';pairDialog.setAttribute('aria-labelledby','remote-pair-title');document.body.append(pairDialog);
  let pairHostId='', pairingSucceeded=false, pairOpener=null, libraryOpener=null;
  pairDialog.addEventListener('close',()=>{window.launcher.remotePlayCancelPair().catch(()=>{});if(pairOpener?.isConnected)setFocusedElement(pairOpener,{scroll:false});});
  library.addEventListener('close',()=>{coverObserver.disconnect();if(libraryOpener?.isConnected)setFocusedElement(libraryOpener,{scroll:false});});
  document.querySelector('.console-library-nav').insertAdjacentHTML('beforeend','<button class="focusable" type="button" data-action="remote-open-library">Remote PCs</button>');
  const restoreFocus=selector=>{refreshFocusables();const target=document.querySelector(selector);if(target)setFocusedElement(target,{scroll:false});};
  function renderHosts(){
    const target=document.querySelector('#remote-hosts');
    target.innerHTML=!remote.available?'<p class="remote-message">The streaming component is missing from this build. Install the full app to enable remote play.</p>':!remote.hosts.length?'<div class="remote-empty"><h3>Add your gaming PC</h3><p>Enter its local IP address or hostname, then approve the pairing PIN on the host.</p></div>':remote.hosts.map(host=>`<article class="remote-host-card"><div>${gIcon('stream')}<span><strong>${escape(host.name)}</strong><small>${escape(host.address)} · ${host.paired?'Paired':'Pairing required'}${host.paired?` · ${host.games.length} shared games`:''}</small>${host.error?`<small class="remote-error">${escape(host.error)}</small>`:''}</span></div><div><button class="g-button focusable" data-action="${host.paired?'remote-browse-host':'remote-pair-host'}" data-host-id="${escape(host.id)}">${host.paired?'Browse games':'Pair PC'}</button><button class="g-button focusable" data-action="remote-remove" data-host-id="${escape(host.id)}">Remove</button></div></article>`).join('');
    refreshFocusables();
  }
  async function refreshHosts(){remote=await window.launcher.remotePlaySnapshot();renderHosts();return remote;}
  function currentHost(){return remote.hosts.find(host=>host.id===selectedHost)||remote.hosts.find(host=>host.paired)||remote.hosts[0];}
  function renderLibrary(){
    const oldFocus=document.activeElement, focusedApp=oldFocus?.closest('.remote-game-card')?.dataset.appId, focusedHost=oldFocus?.closest('#remote-host-tabs [data-host-id]')?.dataset.hostId, scroll=library.scrollTop;
    const host=currentHost();if(host)selectedHost=host.id;
    const term=document.querySelector('#remote-game-search').value.trim().toLocaleLowerCase();
    document.querySelector('#remote-host-tabs').innerHTML=remote.hosts.map(item=>`<button class="g-button focusable${item.id===host?.id?' active':''}" role="tab" aria-selected="${item.id===host?.id}" data-action="remote-host-tab" data-host-id="${escape(item.id)}">${escape(item.name)}</button>`).join('');
    document.querySelector('#remote-library-title').textContent=host?`Games on ${host.name}`:'Remote games';
    document.querySelector('#remote-library-status').textContent=remoteBusy?'Getting the host’s game library…':host?.error?`${host.error} Showing saved games.`:host?`${host.games?.length||0} shared games · ${host.address}`:'Add a PC to get started.';
    const games=(host?.games||[]).filter(game=>!term||game.title.toLocaleLowerCase().includes(term));
    coverObserver.disconnect();
    document.querySelector('#remote-game-grid').innerHTML=games.length?games.map(game=>`<button class="remote-game-card focusable" data-action="remote-play-game" data-app-id="${escape(game.appId)}" data-host-id="${escape(host.id)}" aria-label="${escape(game.title)} — stream from ${escape(host.name)}"><span class="remote-game-art" ${game.artwork?.tile?'':`data-cover-app="${escape(game.appId)}"`}>${game.artwork?.tile?`<img src="${escape(game.artwork.tile)}" alt="" loading="lazy" />`:`<span>${escape(game.title)}</span>`}</span><strong>${escape(game.title)}</strong><small>Stream from ${escape(host.name)}</small></button>`).join(''):`<div class="remote-empty"><h3>${term?'No matching games':host&&!host.paired?'Pair this PC to browse its games':remoteBusy?'Loading games…':'No shared games yet'}</h3><p>${term?'Try a shorter name.':'Games must be published in Sunshine, Apollo or Vibepollo. Refresh after changing the host’s app list.'}</p>${host&&!host.paired?`<button class="g-button focusable" data-action="remote-pair-host" data-host-id="${escape(host.id)}">Pair PC</button>`:''}</div>`;
    document.querySelectorAll('[data-cover-app]').forEach(node=>coverObserver.observe(node));refreshFocusables();
    if(library.open && !oldFocus?.isConnected){const next=focusedApp?library.querySelector(`.remote-game-card[data-app-id="${CSS.escape(focusedApp)}"]`):focusedHost?library.querySelector(`#remote-host-tabs [data-host-id="${CSS.escape(focusedHost)}"]`):null;if(next)setFocusedElement(next,{scroll:false});library.scrollTop=scroll;}
  }
  const waitingCovers=new Set();let fetchingCovers=false;
  const coverObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){waitingCovers.add(entry.target.dataset.coverApp);coverObserver.unobserve(entry.target);}clearTimeout(coverTimer);coverTimer=setTimeout(fetchCovers,80);},{root:library,rootMargin:'150px'});
  async function fetchCovers(){
    if(fetchingCovers||!library.open||!waitingCovers.size)return;
    const host=currentHost();if(!host?.paired)return;
    const ids=[...waitingCovers].slice(0,24);ids.forEach(id=>waitingCovers.delete(id));fetchingCovers=true;
    try{const result=await window.launcher.remotePlayCovers(host.id,ids);if(currentHost()?.id!==host.id)return;
      for(const item of result){const game=host.games.find(game=>game.appId===item.appId);if(game)game.artwork={tile:item.tile};const art=document.querySelector(`[data-cover-app="${CSS.escape(item.appId)}"]`);if(art){art.innerHTML=`<img src="${escape(item.tile)}" alt="" loading="lazy" />`;delete art.dataset.coverApp;}}
    }catch{/* Offline libraries retain their text tiles. */}finally{fetchingCovers=false;if(waitingCovers.size&&library.open)coverTimer=setTimeout(fetchCovers,80);}
  }
  async function refreshGames(id){
    if(!id)return;const request=++libraryRequest;remoteBusy=true;renderLibrary();
    try{const result=await window.launcher.remotePlayRefresh(id);const host=remote.hosts.find(host=>host.id===id);if(host){host.games=result.games;host.error='';host.paired=true;}}
    catch(error){const host=remote.hosts.find(host=>host.id===id);if(host)host.error=error.message;showToast(error.message);}
    finally{if(request===libraryRequest){remoteBusy=false;renderHosts();if(library.open)renderLibrary();}}
  }
  async function openLibrary(id,opener){
    libraryOpener=opener||document.activeElement;await refreshHosts();selectedHost=id||selectedHost;waitingCovers.clear();renderLibrary();
    if(!library.open)library.showModal();refreshFocusables();setFocusedElement(library.querySelector('.remote-game-card')||library.querySelector('.focusable'),{scroll:false});
    const host=currentHost();if(host?.paired)refreshGames(host.id);
  }
  function addForm(opener){
    pairOpener=opener||document.activeElement;pairHostId='';pairingSucceeded=false;
    pairDialog.innerHTML='<h2 id="remote-pair-title">Add a remote PC</h2><p>Enter the address of your Sunshine, Apollo or Vibepollo PC. Both devices must be able to reach each other.</p><label>PC address<input id="remote-host-address" class="focusable" type="text" placeholder="192.168.1.20 or gaming-pc" maxlength="253" autocomplete="off" spellcheck="false" /></label><p id="remote-pair-status" role="status"></p><div class="remote-tools"><button class="g-button primary focusable" data-action="remote-connect">Connect and pair</button><button class="g-button focusable" data-action="remote-pair-close">Cancel</button></div>';
    if(!pairDialog.open)pairDialog.showModal();restoreFocus('#remote-host-address');
  }
  async function beginPair(id){
    pairHostId=id;pairingSucceeded=false;
    if(!pairDialog.open){pairOpener=document.activeElement;pairDialog.innerHTML='<h2 id="remote-pair-title">Pair your PC</h2><p id="remote-pair-status" role="status">Connecting…</p>';pairDialog.showModal();}
    const result=await window.launcher.remotePlayPair(id);
    if(!pairDialog.open){window.launcher.remotePlayCancelPair().catch(()=>{});return;}
    if(result.paired){await paired(id);return;}
    pairDialog.innerHTML=`<h2 id="remote-pair-title">Pair with ${escape(result.name)}</h2><p>Enter this PIN in the host’s Sunshine, Apollo or Vibepollo pairing page.</p><div class="remote-pin" aria-label="Pairing PIN ${escape(result.pin.split('').join(' '))}">${escape(result.pin)}</div><p id="remote-pair-status" role="status">Waiting for approval on your host PC…</p><div class="remote-tools"><button class="g-button focusable" data-action="remote-pair-close">Cancel pairing</button></div>`;restoreFocus('#remote-pair-dialog .focusable');
  }
  async function paired(id){pairingSucceeded=true;pairDialog.close();await refreshHosts();showToast('PC paired. Your remote games are ready to browse.');await openLibrary(id);}
  async function play(game,host){
    if(launchPending)return;launchPending=true;
    library.close();settingsDialog.close();state.remotePlaySession={phase:'connecting',hostId:host.id,title:game.title};
    const art=game.artwork?.hero||game.artwork?.tile;
    launchArt.style.backgroundImage=art?`url("${art.replaceAll('"','%22')}")`:'linear-gradient(145deg,#26364c,#080b12)';
    launchGameLogo.src=fallbackWordmark(game.title);launchGameLogo.hidden=false;launchingGame.hidden=true;
    launchOverlay.dataset.remote='1';launchOverlay.dataset.gameId=game.id;delete launchOverlay.dataset.cancelled;
    document.querySelector('#launch-status').textContent='Connecting';document.querySelector('#launch-via').textContent=`Streaming from ${host.name}`;
    launchOverlay.hidden=false;requestAnimationFrame(()=>launchOverlay.classList.add('active'));playUiSound('launch');
    const [width,height]=(document.querySelector('#remote-resolution').value||'1920x1080').split('x').map(Number);
    try{await window.launcher.remotePlayStart(host.id,game.appId,{width,height,fps:Number(document.querySelector('#remote-fps').value),bitrate:Number(document.querySelector('#remote-bitrate').value)});}
    catch(error){finishRemoteLaunch();state.remotePlaySession=null;showToast(error.message);}
  }
  function finishRemoteLaunch(){launchPending=false;delete launchOverlay.dataset.remote;delete launchOverlay.dataset.gameId;launchOverlay.classList.remove('active');launchOverlay.hidden=true;}
  window.remotePlayUI={get playing(){return state.remotePlaySession?.phase==='playing';},get active(){return Boolean(state.remotePlaySession);},suppressHeldButtons(gamepads){if(!waitForControllerRelease)return false;if(gamepads.some(pad=>pad.buttons.some(button=>button.pressed||button.value>.55)))return true;waitForControllerRelease=false;state.previousButtons=[];return false;}};
  const cancel=cancelLaunchWait;
  cancelLaunchWait=function(){if(launchOverlay.dataset.remote){window.launcher.remotePlayStop().catch(error=>showToast(error.message));finishRemoteLaunch();state.remotePlaySession=null;return;}return cancel();};
  window.launcher.onRemotePlayStatus(async event=>{
    if(event.phase==='paired'){await paired(event.hostId);return;}
    if(event.phase==='pair-error'){const target=document.querySelector('#remote-pair-status');if(target)target.textContent=event.error;showToast(event.error);return;}
    if(event.phase==='connecting'){state.remotePlaySession=event.session;document.querySelector('#launch-status').textContent='Starting your game';}
    if(event.phase==='playing'){state.remotePlaySession=event.session;finishRemoteLaunch();document.body.classList.add('remote-streaming');refreshActiveGameSession().catch(()=>{});}
    if(event.phase==='error')showToast(event.error);
    if(event.phase==='connection-warning')showToast(event.error);
    if(event.phase==='ended'){state.remotePlaySession=null;waitForControllerRelease=true;document.body.classList.remove('remote-streaming');finishRemoteLaunch();refreshActiveGameSession().catch(()=>{});if(event.reason==='game-closed')showToast(`${event.title} closed. Stream ended.`);else if(event.reason==='connection-lost')showToast('Connection lost. The game may still be running on your host.');refreshHosts().catch(()=>{});openLibrary(event.hostId).catch(()=>{});}
  });
  function renderStorage(){
    const target=document.querySelector('#storage-overview');
    if(!storage){target.innerHTML='<p>Reading drive space…</p>';return;}
    const drives=storage.drives;if(!drives.length){target.innerHTML='<p>No available drives were found. Connect a drive and refresh.</p>';return;}
    const drive=drives.find(item=>item.root===selectedDrive)||drives.find(item=>item.games.length)||drives[0];selectedDrive=drive.root;
    target.innerHTML=`<div class="storage-drive-tabs" role="tablist" aria-label="Drives">${drives.map(item=>`<button class="storage-drive-tab focusable${item.root===drive.root?' active':''}" role="tab" aria-selected="${item.root===drive.root}" data-action="storage-drive" data-root="${escape(item.root)}">${gIcon('drive')}<span><strong>${escape(item.label||item.root)} (${escape(item.root.replace(/\\$/,''))})</strong><small>${fmt(item.free)} free of ${fmt(item.total)}</small></span></button>`).join('')}</div><section class="storage-drive-detail"><div class="storage-totals"><div><small>Drive capacity</small><strong>${fmt(drive.total)}</strong></div><div><small>Known game files</small><strong>${fmt(drive.knownGameBytes)}</strong></div><div><small>Free space</small><strong>${fmt(drive.free)}</strong></div></div>${drive.total?`<div class="storage-space-bar" role="img" aria-label="${escape(fmt(drive.used))} used, ${escape(fmt(drive.free))} free"><span class="storage-games-used" style="width:${Math.min(100,Math.max(0,Math.min(drive.knownGameBytes,drive.used)/drive.total*100))}%"></span><span class="storage-other-used" style="width:${Math.min(100,Math.max(0,(drive.used-Math.min(drive.knownGameBytes,drive.used))/drive.total*100))}%"></span></div><p class="storage-legend"><span>● Known game files</span><span>● Windows, apps and other files</span><span>○ Free space</span></p>`:''}<p>${drive.games.length} installed game${drive.games.length===1?'':'s'}${drive.unknownGames?` · ${drive.unknownGames} game size${drive.unknownGames===1?' is':'s are'} still being measured`:''}</p>${drive.libraries.length?`<p class="storage-library-paths">Steam libraries: ${drive.libraries.map(escape).join(' · ')}</p>`:''}<div class="storage-game-list">${drive.games.length?drive.games.map(game=>`<button class="storage-game-row focusable" data-action="storage-game" data-game-id="${escape(game.id)}"><span><strong>${escape(game.title)}</strong><small>${escape(game.provider)} · ${escape(game.folder)}</small></span><b>${game.bytes?fmt(game.bytes):'Size pending'}</b></button>`).join(''):'<div class="remote-empty"><h3>No library games on this drive</h3><p>Installed games appear here after a library scan.</p></div>'}</div></section>`;refreshFocusables();
  }
  async function refreshStorage(){const request=++storageRequest;if(!storage)renderStorage();try{const result=await window.launcher.getStorageOverview();if(request!==storageRequest)return;storage=result;renderStorage();}catch(error){document.querySelector('#storage-overview').innerHTML=`<p>${escape(error.message)}</p><button class="g-button focusable" data-action="storage-refresh">Try again</button>`;refreshFocusables();}}
  const show=showSettingsPage;
  showSettingsPage=function(page){const result=show(page);if(page==='g-streaming')refreshHosts().catch(error=>showToast(error.message));if(page==='g-storage')refreshStorage();return result;};
  document.querySelector('#remote-game-search').addEventListener('input',()=>{renderLibrary();});
  const search=openConsoleSearch;
  openConsoleSearch=function(...args){if(library.open){const input=document.querySelector('#remote-game-search');setFocusedElement(input);if(state.controllerClick||document.body.classList.contains('controller-input'))openNativeKeyboard(input);return;}return search(...args);};
  const perform=performAction;
  performAction=async function(action,source){
    try{
      if(action==='remote-add'){addForm(source);return;}
      if(action==='remote-pair-close'){pairDialog.close();return;}
      if(action==='remote-connect'){
        source.disabled=true;document.querySelector('#remote-pair-status').textContent='Looking for your PC…';
        try{const value=document.querySelector('#remote-host-address').value,result=await window.launcher.remotePlayAdd(value);if(pairDialog.open)await beginPair(result.hostId);}finally{source.disabled=false;}return;
      }
      if(action==='remote-pair-host'){await beginPair(source.dataset.hostId);return;}
      if(action==='remote-settings-refresh'){await refreshHosts();return;}
      if(action==='remote-open-library'||action==='remote-browse-host'){await openLibrary(source.dataset.hostId,source);return;}
      if(action==='remote-library-close'){library.close();return;}
      if(action==='remote-host-tab'){selectedHost=source.dataset.hostId;waitingCovers.clear();document.querySelector('#remote-game-search').value='';renderLibrary();restoreFocus(`#remote-host-tabs [data-host-id="${CSS.escape(selectedHost)}"]`);const host=currentHost();if(host?.paired)refreshGames(host.id);return;}
      if(action==='remote-library-refresh'){await refreshGames(currentHost()?.id);return;}
      if(action==='remote-remove'){await window.launcher.remotePlayRemove(source.dataset.hostId);await refreshHosts();restoreFocus('[data-action="remote-add"]');return;}
      if(action==='remote-play-game'){const host=remote.hosts.find(host=>host.id===source.dataset.hostId),game=host?.games.find(game=>game.appId===source.dataset.appId);if(game)await play(game,host);return;}
      if(action==='storage-refresh'){await refreshStorage();restoreFocus('[data-action="storage-refresh"]');return;}
      if(action==='storage-drive'){selectedDrive=source.dataset.root;renderStorage();restoreFocus(`.storage-drive-tab[data-root="${CSS.escape(selectedDrive)}"]`);return;}
      if(action==='storage-game'){const game=state.games.find(game=>game.id===source.dataset.gameId);if(game)openManageGame(game);return;}
    }catch(error){showToast(error.message);const target=document.querySelector('#remote-pair-status');if(pairDialog.open&&target)target.textContent=error.message;return;}
    return perform(action,source);
  };
})();
