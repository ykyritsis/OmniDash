// Remote games use the Library and normal game page. Only pairing, quality and
// actionable errors are dialogs; the bundled decoder owns the native video.
(() => {
  const escape=escapeHtml;
  let remote={available:true,hosts:[]},selectedHost=localStorage.getItem('remote-selected-host')||'';
  let libraryRequest=0,busy=false,launchPending=false,waitForControllerRelease=false,coverTimer=0,fetchingCovers=false;
  let pairOpener=null,scanGeneration=0,discoveries=[],scanning=false,qualityHost='',qualityGame=null,failedGame=null;
  const waitingCovers=new Map();
  const restore=selector=>{refreshFocusables();const target=document.querySelector(selector);if(target)setFocusedElement(target,{scroll:false});};
  const button=(action,label,extra='',primary=false)=>`<button class="g-button g-control-button ${primary?'primary ':''}focusable" type="button" data-action="${action}" ${extra}>${label}</button>`;
  const hostById=id=>remote.hosts.find(host=>host.id===id);
  const currentHost=()=>hostById(selectedHost)||remote.hosts.find(host=>host.paired)||remote.hosts[0];
  const hostLabel=host=>({ready:'Ready to play',busy:'Game running',offline:'Offline','pair-required':'Pairing required',unknown:'Checking connection…'}[host?.status]||'Checking connection…');
  const status=host=>`<span class="remote-status" data-status="${escape(host?.status||'unknown')}"><i aria-hidden="true"></i>${escape(hostLabel(host))}</span>`;
  const streamBar=document.createElement('aside');streamBar.id='remote-stream-bar';streamBar.hidden=true;streamBar.setAttribute('aria-label','Remote play controls');
  streamBar.innerHTML=`<div><strong id="remote-stream-title"></strong><span id="remote-stream-shortcut"></span><small id="remote-stream-page-shortcut"></small><small id="remote-stream-live"></small><small>Release mouse: Ctrl + Alt + Shift + Z</small></div><nav aria-label="Stream actions">${button('remote-stream-disconnect','Disconnect','title="End this stream and return to the app. The game stays open on your PC."')}${button('remote-stream-page','Game page')}${button('remote-stream-hide','Hide','title="Hide these controls and use the full screen for your game."')}</nav>`;
  document.body.append(streamBar);
  let streamBarTimer=0,homeSignature='',shortcutDraft=StreamSettings.defaultShortcuts(),shortcutCapture=null;
  const homeCoverRequests=new Set();
  const cancelAutoHide=()=>{clearTimeout(streamBarTimer);streamBarTimer=0;};
  // The welcome hint disappears once. Reopened controls stay until dismissed.
  streamBar.addEventListener('pointerdown',cancelAutoHide);streamBar.addEventListener('focusin',cancelAutoHide);
  function updateViewport(){if(window.remotePlayUI?.playing)window.launcher.remotePlayViewport({top:streamBar.hidden?0:Math.ceil(streamBar.getBoundingClientRect().bottom),height:innerHeight}).catch(()=>{});}
  function hideStreamBar(focusVideo=true){cancelAutoHide();if(streamBar.contains(document.activeElement))document.activeElement.blur();streamBar.hidden=true;updateViewport();if(focusVideo)window.launcher.remotePlayFocus().catch(()=>{});}
  function toggleStreamPage(){if(!window.remotePlayUI?.playing)return;return state.remotePlaySession.view==='page'?window.launcher.remotePlayFocus():window.launcher.remotePlayPage();}
  new ResizeObserver(updateViewport).observe(streamBar);window.addEventListener('resize',updateViewport);
  const padFamily=()=>getConnectedControllers().some(pad=>/dualsense|dualshock|playstation|sony|054c/i.test(pad.id))?'ps':'xbox';
  function padGlyphs(mask){
    const ps=padFamily()==='ps',names=StreamSettings.padButtons.filter(b=>mask&b.mask);
    return '<span class="remote-chord" role="img" aria-label="'+escape(names.map(b=>ps?b.ps:b.name).join(' + '))+'">'+names.map(b=>{
      const label=ps?b.ps:b.name,face=['A','B','X','Y'].includes(b.name),shape=ps?{A:'×',B:'○',X:'□',Y:'△'}[b.name]:b.name;
      const svg=b.name==='View'?'<svg viewBox="0 0 24 24"><path d="M8 8h12v12H8zM4 16V4h12"/></svg>':b.name==='Menu'?'<svg viewBox="0 0 24 24"><path d="M5 6h14M5 12h14M5 18h14"/></svg>':null;
      return '<kbd aria-hidden="true" title="'+label+'" class="remote-pad-key '+(face?'remote-pad-face remote-pad-'+b.name.toLowerCase():'remote-pad-system')+'">'+(face?shape:svg||label)+'</kbd>';
    }).join('<span aria-hidden="true" class="remote-chord-plus">+</span>')+'</span>';
  }
  function keyboardGlyphs(binding){const keys=[...(binding.modifiers&1?['Ctrl']:[]),...(binding.modifiers&2?['Alt']:[]),...(binding.modifiers&4?['Shift']:[]),StreamSettings.keyInfo(binding.code)?.label||'?'];return '<span class="remote-chord" role="img" aria-label="'+keys.join(' + ')+'">'+keys.map(key=>'<kbd aria-hidden="true" class="remote-key">'+escape(key)+'</kbd>').join('<span aria-hidden="true" class="remote-chord-plus">+</span>')+'</span>';}
  function showStreamBar(session,autoHide=false){
    cancelAutoHide();const host=hostById(session.hostId),p=session.preferences||host?.preferences||{},bindings=StreamSettings.normalizeShortcuts(p.shortcuts,p.quitCombo);
    document.querySelector('#remote-stream-title').textContent=session.title||'Remote play';
    document.querySelector('#remote-stream-shortcut').innerHTML='Disconnect: '+padGlyphs(bindings.disconnect.gamepad)+' · '+keyboardGlyphs(bindings.disconnect.keyboard);
    document.querySelector('#remote-stream-page-shortcut').innerHTML='Game page / return: '+padGlyphs(bindings.page.gamepad)+' · '+keyboardGlyphs(bindings.page.keyboard);
    document.querySelector('#remote-stream-live').innerHTML='Live settings: '+padGlyphs(0x2300)+' · Ctrl + Alt + Shift + O';
    streamBar.hidden=false;updateViewport();if(autoHide)streamBarTimer=setTimeout(()=>{if(window.remotePlayUI?.playing)hideStreamBar(false);},5000);
  }
  window.addEventListener('keydown',event=>{
    if(shortcutCapture&&!shortcutCapture.ready){captureShortcutKey(event);return;}
    if(!window.remotePlayUI?.active)return;
    const bindings=StreamSettings.normalizeShortcuts(state.remotePlaySession.preferences?.shortcuts),pressed=StreamSettings.keyboardEvent(event);
    if(StreamSettings.sameKey(pressed,bindings.disconnect.keyboard)){if(!event.repeat)window.launcher.remotePlayStop().catch(error=>showToast(error.message));}
    else if(StreamSettings.sameKey(pressed,bindings.page.keyboard)){if(!event.repeat)toggleStreamPage()?.catch(error=>showToast(error.message));}
    else if(!window.remotePlayUI.capturesInput)return;
    else if(['Enter',' '].includes(event.key)&&streamBar.contains(document.activeElement)){document.activeElement.click();}
    else if(event.key==='Tab'&&!streamBar.hidden){const items=[...streamBar.querySelectorAll('button')],index=items.indexOf(document.activeElement);items[index<0?(event.shiftKey?items.length-1:0):(index+(event.shiftKey?-1:1)+items.length)%items.length].focus();}
    else if(event.key==='Escape'){window.launcher.remotePlayPage().catch(error=>showToast(error.message));}
    event.preventDefault();event.stopImmediatePropagation();
  },true);
  const disconnectButton=document.createElement('button');disconnectButton.id='detail-disconnect';disconnectButton.className='detail-secondary focusable';disconnectButton.dataset.action='remote-stream-disconnect';disconnectButton.type='button';disconnectButton.hidden=true;disconnectButton.textContent='Disconnect';document.querySelector('#detail-play').after(disconnectButton);
  const endButton=document.createElement('button');endButton.id='detail-end-session';endButton.className='detail-secondary focusable';endButton.dataset.action='remote-end-session';endButton.type='button';endButton.hidden=true;endButton.textContent='End session';endButton.title='End the session on this PC. The host may close the game.';disconnectButton.after(endButton);
  let endingSession=false;
  async function showSessionPage(session){
    cancelAutoHide();streamBar.hidden=true;state.remotePlaySession=session;document.body.classList.remove('remote-streaming');finishRemoteLaunch();
    waitForControllerRelease=true;scheduleGamepadPoll();
    if(state.detailGameId!==session.gameId||state.view!=='detail')await openGameDetails(session.gameId);
    paintDetail();restore('#detail-disconnect');
  }
  function syncGames(){state.remoteGames=remote.hosts.flatMap(host=>(host.games||[]).map(game=>({...game,hostName:host.name,hostStatus:host.status})));}
  function refreshHome(){
    if(state.view!=='home')return;
    const recent=homeRecentGames().slice(0,6),signature=JSON.stringify(recent.map(game=>[game.id,game.title,game.hostName,lastPlayedAt(game)]));
    // Artwork arrives separately. Rebuilding Home for every cover used to lose
    // focus and re-create every collection, including their image elements.
    if(signature!==homeSignature){homeSignature=signature;const active=document.activeElement,id=active?.dataset.gameId,libraryTile=active?.matches('.g-library-tile'),scroll=document.querySelector('main').scrollTop,left=recentRow.scrollLeft;window.renderLibrary();if(!active.isConnected){const next=id?recentRow.querySelector(`[data-game-id="${CSS.escape(id)}"]`):libraryTile?recentRow.querySelector('.g-library-tile'):null;if(next)setFocusedElement(next,{scroll:false});}recentRow.scrollLeft=left;document.querySelector('main').scrollTop=scroll;}
    if(state.remotePlaySession)return;
    const batches=new Map();
    for(const game of recent.filter(game=>game.remoteHostId&&!homeCoverRequests.has(game.id))){homeCoverRequests.add(game.id);if(!batches.has(game.remoteHostId))batches.set(game.remoteHostId,[]);batches.get(game.remoteHostId).push(game);}
    for(const [hostId,games] of batches)window.launcher.remotePlayCovers(hostId,games.map(game=>game.appId)).then(items=>items.forEach(item=>applyArtwork(hostId,item))).catch(()=>{for(const game of games)homeCoverRequests.delete(game.id);});
  }
  function acceptSnapshot(value){remote=value;syncGames();renderHosts();if(state.libraryRemote)renderLibrary();if(value.session&&!state.remotePlaySession){state.remotePlaySession=value.session;if(value.session.view==='page')showSessionPage(value.session).catch(()=>{});else if(value.session.phase==='playing'){document.body.classList.add('remote-streaming');showStreamBar(value.session,true);}}paintDetail();refreshHome();}
  const streaming=document.querySelector('[data-settings-page="g-streaming"]');
  streaming.innerHTML=`<div class="remote-intro settings-section-heading"><h3>Gaming PCs</h3><p>Find a Sunshine, Apollo or Vibepollo PC on your network, pair once, then play from Library → Remote PCs.</p></div><div class="remote-tools">${button('remote-add','Find a PC','',true)}${button('remote-quality','Stream settings')}${button('remote-open-library','Open remote library')}${button('remote-settings-refresh','Refresh status')}</div><div id="remote-hosts" aria-live="polite"></div><p class="remote-help">Streaming is built into this app. Approve the pairing PIN on the host PC to connect.</p>`;
  document.querySelector('.console-library-nav').insertAdjacentHTML('beforeend','<button class="focusable" type="button" data-action="console-library-section" data-section="remote">Remote PCs</button>');
  const library=document.createElement('section');library.id='remote-library';library.hidden=true;library.setAttribute('aria-labelledby','remote-library-title');
  library.innerHTML=`<div id="remote-host-tabs" role="tablist" aria-label="Remote PCs"></div><header><div><h2 id="remote-library-title">Remote PCs</h2><p id="remote-library-status" role="status"></p></div><div class="remote-library-actions">${button('remote-add','Find a PC')}${button('remote-quality','Stream settings')}${button('remote-library-refresh','Refresh games')}</div></header><label class="remote-search-label">Search this PC<input id="remote-game-search" class="focusable" type="search" placeholder="Search games" autocomplete="off" /></label><div id="remote-game-grid" class="remote-game-grid"></div><p class="remote-library-help">Games are supplied by your host’s shared library. <button class="remote-inline-button focusable" data-action="remote-library-help">Missing or uninstalled games?</button></p>`;
  document.querySelector('.console-library-content').append(library);
  function dialog(id,cls){const node=document.createElement('dialog');node.id=id;node.className=`${cls} g-managed-dialog`;document.body.append(node);return node;}
  const pairDialog=dialog('remote-pair-dialog','remote-pair-dialog');pairDialog.setAttribute('aria-labelledby','remote-pair-title');
  const qualityDialog=dialog('remote-quality-dialog','remote-quality-dialog');qualityDialog.setAttribute('aria-labelledby','remote-quality-title');
  const shortcutsDialog=dialog('remote-shortcuts-dialog','remote-quality-dialog');shortcutsDialog.setAttribute('aria-labelledby','remote-shortcuts-title');
  const recordDialog=dialog('remote-shortcut-record-dialog','remote-pair-dialog');recordDialog.setAttribute('aria-labelledby','remote-shortcut-record-title');
  recordDialog.addEventListener('close',()=>{shortcutCapture=null;waitForControllerRelease=true;scheduleGamepadPoll();});
  const customDialog=dialog('remote-custom-dialog','remote-pair-dialog');customDialog.setAttribute('aria-labelledby','remote-custom-title');
  const errorDialog=dialog('remote-error-dialog','remote-pair-dialog');errorDialog.setAttribute('aria-labelledby','remote-error-title');
  const helpDialog=dialog('remote-help-dialog','remote-pair-dialog');helpDialog.setAttribute('aria-labelledby','remote-help-title');
  const endDialog=dialog('remote-end-dialog','remote-pair-dialog');endDialog.setAttribute('aria-labelledby','remote-end-title');
  pairDialog.addEventListener('close',()=>{scanGeneration++;window.launcher.remotePlayCancelPair().catch(()=>{});if(pairOpener?.isConnected)setFocusedElement(pairOpener,{scroll:false});});
  for(const node of [qualityDialog,customDialog,errorDialog,helpDialog,shortcutsDialog,recordDialog,endDialog])node.addEventListener('close',()=>{refreshFocusables();if(node.opener?.isConnected&&node.opener.offsetParent!==null)setFocusedElement(node.opener,{scroll:false});});
  function showDialog(node,first){node.opener=document.activeElement;if(!node.open)node.showModal();refreshFocusables();setFocusedElement(node.querySelector(first||'.focusable'),{scroll:false});}
  function renderHosts(){
    document.querySelector('#remote-hosts').innerHTML=!remote.available?'<div class="remote-empty"><h3>Streaming component unavailable</h3><p>Install the full app build to restore the bundled streaming component.</p></div>':!remote.hosts.length?'<div class="remote-empty"><h3>Your gaming PCs, in one place</h3><p>Find a PC on this network to get started. You can also enter an address manually.</p></div>':remote.hosts.map(host=>`<article class="remote-host-card"><div class="remote-host-info"><span class="remote-host-icon">${gIcon('stream')}</span><span class="remote-host-copy"><strong>${escape(host.name)}</strong>${status(host)}<small>${escape(host.address)}${host.paired?` · ${host.games.length} shared games`:''}</small></span></div><div class="remote-host-actions">${button(host.paired?'remote-browse-host':'remote-pair-host',host.paired?'Browse games':'Pair PC',`data-host-id="${escape(host.id)}"`)}${button('remote-remove','Remove',`data-host-id="${escape(host.id)}"`)}</div></article>`).join('');refreshFocusables();
  }
  async function refreshHosts(check=false){acceptSnapshot(await (check?window.launcher.remotePlayCheckHosts():window.launcher.remotePlaySnapshot()));return remote;}
  function renderLibrary(){
    const oldFocus=document.activeElement,key=oldFocus?.dataset?.gameId,hostFocus=oldFocus?.closest('#remote-host-tabs [data-host-id]')?.dataset.hostId;
    const main=document.querySelector('main'),scroll=main.scrollTop,host=currentHost();if(host){selectedHost=host.id;localStorage.setItem('remote-selected-host',host.id);}
    libraryView.classList.toggle('remote-active',Boolean(state.libraryRemote));library.hidden=!state.libraryRemote;
    if(!state.libraryRemote)return;
    libraryView.dataset.gTab='remote';state.libraryItems=[];state.libraryRendered=0;
    document.querySelectorAll('.console-library-nav [data-section]').forEach(node=>node.classList.toggle('active',node.dataset.section==='remote'));
    document.querySelector('#remote-host-tabs').innerHTML=remote.hosts.map(item=>`<button class="remote-pc-tab focusable${item.id===host?.id?' active':''}" role="tab" aria-selected="${item.id===host?.id}" data-action="remote-host-tab" data-host-id="${escape(item.id)}">${gIcon('stream')}<span><strong>${escape(item.name)}</strong>${status(item)}</span></button>`).join('');
    document.querySelector('#remote-library-title').textContent=host?`Games on ${host.name}`:'Your remote library';
    document.querySelector('#remote-library-status').textContent=busy?'Refreshing the host’s library…':host?.status==='offline'?'PC offline · Saved games are available to browse.':host?`${host.games?.length||0} shared games · ${host.address}`:'Find a PC on your network to browse and stream its games.';
    library.querySelector('[data-action="remote-quality"]').disabled=!remote.available;
    library.querySelector('[data-action="remote-library-refresh"]').disabled=!host?.paired||busy;
    const term=document.querySelector('#remote-game-search').value.trim().toLocaleLowerCase();
    const games=(host?.games||[]).filter(game=>!term||game.title.toLocaleLowerCase().includes(term)).sort((a,b)=>a.title.localeCompare(b.title));
    coverObserver.disconnect();waitingCovers.clear();
    document.querySelector('#remote-game-grid').innerHTML=games.length?games.map(game=>`<button class="remote-game-card focusable" data-action="remote-game-details" data-game-id="${escape(game.id)}" data-app-id="${escape(game.appId)}" data-host-id="${escape(host.id)}" aria-label="${escape(game.title)} — view game"><span class="remote-game-art" data-cover-app="${escape(game.appId)}" data-cover-host="${escape(host.id)}">${gameArt(game)}</span><strong>${escape(game.title)}</strong><small>${host.status==='offline'?'PC offline':host.currentGame===game.appId?'Resume game':host.status==='busy'?'PC busy':'Remote play'}</small></button>`).join(''):`<div class="remote-empty"><h3>${term?'No matching games':host&&!host.paired?'Pair this PC to see its games':busy?'Loading games…':host?'No shared games':'Connect your gaming PC'}</h3><p>${term?'Try a shorter name.':host?'Refresh after installing games or changing the host’s shared library.':'Your PCs and their game libraries stay here after pairing.'}</p>${host&&!host.paired?button('remote-pair-host','Pair PC',`data-host-id="${escape(host.id)}"`,true):!host?button('remote-add','Find a PC','',true):''}</div>`;
    document.querySelectorAll('[data-cover-app]').forEach(node=>coverObserver.observe(node));refreshFocusables();
    if(!oldFocus?.isConnected&&state.view==='library'){
      const next=key?library.querySelector(`[data-game-id="${CSS.escape(key)}"]`):hostFocus?library.querySelector(`[data-host-id="${CSS.escape(hostFocus)}"]`):null;
      setFocusedElement(next||library.querySelector('.remote-game-card')||library.querySelector('.focusable'),{scroll:false});main.scrollTop=scroll;
    }
  }
  const coverObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){waitingCovers.set(entry.target.dataset.coverHost+':'+entry.target.dataset.coverApp,{host:entry.target.dataset.coverHost,app:entry.target.dataset.coverApp});coverObserver.unobserve(entry.target);}clearTimeout(coverTimer);coverTimer=setTimeout(fetchCovers,80);},{root:document.querySelector('main'),rootMargin:'150px'});
  function applyArtwork(hostId,item){
    const game=hostById(hostId)?.games.find(game=>game.appId===item.appId);if(!game)return;
    const artwork=item.artwork||{...game.artwork,tile:item.tile};
    if(JSON.stringify(game.artwork)===JSON.stringify(artwork))return;
    game.artwork=artwork;const saved=state.remoteGames?.find(value=>value.id===game.id);if(saved)saved.artwork=artwork;
    document.querySelectorAll(`.game-card[data-game-id="${CSS.escape(game.id)}"]`).forEach(card=>{const art=card.querySelector(':scope > img, :scope > .art-fallback');if(art)art.outerHTML=gameArt(game);});
    const art=library.querySelector(`[data-game-id="${CSS.escape(game.id)}"] .remote-game-art`);if(art)art.innerHTML=gameArt(game);
    if(state.view==='home'&&state.selectedGameId===game.id)updateAmbient(game,true);
    if(state.view==='detail'&&state.detailGameId===game.id){const hero=game.artwork.hero||game.artwork.wide||game.artwork.tile;if(hero)document.querySelector('#detail-global-art').style.backgroundImage=`url("${hero.replaceAll('"','%22')}")`;}
  }
  async function fetchCovers(){
    if(fetchingCovers||!state.libraryRemote||state.view!=='library'||!waitingCovers.size)return;
    const host=currentHost();if(!host?.paired)return;
    const ids=[...waitingCovers.values()].filter(item=>item.host===host.id).slice(0,24).map(item=>item.app);ids.forEach(id=>waitingCovers.delete(host.id+':'+id));fetchingCovers=true;
    try{for(const item of await window.launcher.remotePlayCovers(host.id,ids))applyArtwork(host.id,item);}catch{/* Cached libraries still have readable title tiles. */}finally{fetchingCovers=false;if(waitingCovers.size)coverTimer=setTimeout(fetchCovers,80);}
  }
  async function refreshGames(id){
    if(!id)return;const token=++libraryRequest;busy=true;renderLibrary();
    try{const result=await window.launcher.remotePlayRefresh(id),host=hostById(id);if(host)Object.assign(host,result);syncGames();}
    catch(error){const host=hostById(id);if(host)Object.assign(host,{error:error.message,status:'offline'});showToast(error.message);}
    finally{if(token===libraryRequest){busy=false;renderHosts();renderLibrary();paintDetail();}}
  }
  async function openLibrary(id){
    settingsDialog.close();state.libraryRemote=true;state.libraryQueue=false;gSyncQueuePage();if(id)selectedHost=id;
    renderLibrary();showView('library');await refreshHosts();
    restore('#remote-game-grid .remote-game-card, #remote-library [data-action="remote-add"]');
    const host=currentHost();if(host?.paired)await refreshGames(host.id);else await refreshHosts(true);
  }
  function renderDiscoveries(){
    const list=pairDialog.querySelector('#remote-discovered');if(!list)return;
    const oldFocus=document.activeElement,address=oldFocus?.dataset.address;
    list.innerHTML=discoveries.length?discoveries.map(host=>`<button class="remote-discovered-pc g-setting-row focusable" data-action="remote-discovered-connect" data-address="${escape(host.address)}"><span>${gIcon('stream')}<strong>${escape(host.name)}</strong><small>${escape(host.address)}${host.hostId?' · Saved PC':''}</small></span><span>${host.hostId?'Open':'Pair'} ${gIcon('chevronRight')}</span></button>`).join(''):`<div class="remote-empty"><h3>${scanning?'Looking for gaming PCs…':'No PCs found yet'}</h3><p>${scanning?'Checking this network for Sunshine, Apollo and Vibepollo.':'Check that your host is on and both devices are on the same network. You can also enter its address.'}</p></div>`;
    const message=pairDialog.querySelector('#remote-pair-status');if(message)message.textContent=scanning?'Scanning your network…':`${discoveries.length} PC${discoveries.length===1?'':'s'} found.`;
    const scan=pairDialog.querySelector('[data-action="remote-scan"]');if(scan)scan.disabled=scanning;refreshFocusables();
    if(!oldFocus?.isConnected&&address){const next=list.querySelector(`[data-address="${CSS.escape(address)}"]`);if(next)setFocusedElement(next,{scroll:false});}
  }
  async function scanNetwork(){
    const token=++scanGeneration;scanning=true;discoveries=[];renderDiscoveries();
    try{const result=await window.launcher.remotePlayScan();if(token!==scanGeneration)return;discoveries=result;}
    catch(error){if(token===scanGeneration)showToast(error.message);}
    finally{if(token===scanGeneration){scanning=false;renderDiscoveries();if(pairDialog.open&&!pairDialog.contains(document.activeElement))restore('#remote-discovered .focusable, #remote-pair-dialog [data-action="remote-manual"]');}}
  }
  function addForm(opener){
    pairOpener=opener||document.activeElement;
    pairDialog.innerHTML=`<h2 id="remote-pair-title">Find a gaming PC</h2><p>Connect to a Sunshine, Apollo or Vibepollo host on your network.</p><div id="remote-discovered" class="g-setting-list"></div><p id="remote-pair-status" role="status"></p><div class="remote-tools">${button('remote-scan','Scan again')}${button('remote-manual','Enter an address')}${button('remote-pair-close','Cancel')}</div>`;
    if(!pairDialog.open)pairDialog.showModal();scanNetwork();restore('#remote-pair-dialog [data-action="remote-manual"]');
  }
  function manualForm(){scanGeneration++;pairDialog.innerHTML=`<h2 id="remote-pair-title">Enter a PC address</h2><p>Use an IP address or hostname. For a custom streaming port, add it after a colon.</p><label>PC address<input id="remote-host-address" class="focusable" type="text" placeholder="192.168.1.20 or gaming-pc" maxlength="253" autocomplete="off" spellcheck="false" /></label><p id="remote-pair-status" role="status"></p><div class="remote-tools">${button('remote-connect','Connect and pair','',true)}${button('remote-add','Find on network')}${button('remote-pair-close','Cancel')}</div>`;restore('#remote-host-address');}
  async function beginPair(id){
    scanGeneration++;if(!pairDialog.open){pairOpener=document.activeElement;pairDialog.showModal();}
    pairDialog.innerHTML=`<h2 id="remote-pair-title">Pair your PC</h2><p id="remote-pair-status" role="status">Connecting…</p><div class="remote-tools">${button('remote-pair-close','Cancel')}</div>`;restore('#remote-pair-dialog .focusable');
    const result=await window.launcher.remotePlayPair(id);if(!pairDialog.open){window.launcher.remotePlayCancelPair().catch(()=>{});return;}
    if(result.paired){await paired(id);return;}
    pairDialog.innerHTML=`<h2 id="remote-pair-title">Pair with ${escape(result.name)}</h2><p>Enter this PIN on the host’s pairing page.</p><div class="remote-pin" aria-label="Pairing PIN ${escape(result.pin.split('').join(' '))}">${escape(result.pin)}</div><p id="remote-pair-status" role="status">Waiting for approval on your host PC…</p><div class="remote-tools">${button('remote-pair-close','Cancel pairing')}</div>`;restore('#remote-pair-dialog .focusable');
  }
  async function paired(id){pairDialog.close();await refreshHosts();showToast('PC paired. Its games are saved in Library → Remote PCs.');await openLibrary(id);}
  const resolutions=[['1280x720','720p'],['1280x800','1280 × 800'],['1600x900','1600 × 900'],['1920x1080','1080p'],['1920x1200','1920 × 1200'],['2560x1440','1440p'],['2560x1600','2560 × 1600'],['3840x2160','4K']];
  const qualityFields=[['resolution','Resolution','Video size for this device.',resolutions],['fps','Frame rate','Match the handheld or display refresh rate.',[30,60,90,120].map(n=>[String(n),`${n} fps`])],['bitrate','Bitrate','Lower values help on a busy Wi-Fi network.',[3,5,10,15,20,30,40,60,80,100,150].map(n=>[String(n*1000),`${n} Mbps`])],['codec','Video codec','Automatic chooses a codec supported by both PCs.',[['auto','Automatic'],['H.264','H.264 · Compatibility'],['HEVC','HEVC'],['AV1','AV1']]],['decoder','Video decoding','Automatic uses hardware when available.',[['auto','Automatic'],['hardware','Hardware'],['software','Software']]]];
  const onOff=[['true','On'],['false','Off']];
  qualityFields.push(['audioConfig','Audio','Speaker layout on this device.',[['stereo','Stereo'],['5.1','5.1 surround'],['7.1','7.1 surround']]],['vsync','V-Sync','Reduce screen tearing.',onOff],['framePacing','Frame pacing','Smooth frame delivery when V-Sync is on.',onOff],['performanceOverlay','Performance statistics','Show the streaming engine’s performance overlay.',onOff],['multiController','Multiple controllers','Send each connected controller as a separate player.',onOff],['swapFaceButtons','Swap A/B and X/Y','Use Nintendo-style face-button positions.',onOff],['gamepadMouse','Controller mouse mode','Hold Menu / Start to toggle mouse control, as in Moonlight.',onOff],['touchscreenTrackpad','Touchscreen mode','Choose direct touch or trackpad-style movement.',[['false','Direct touch'],['true','Trackpad']]],['absoluteMouse','Mouse mode','Use game capture or an absolute desktop pointer.',[['false','Game capture'],['true','Desktop pointer']]]);
  qualityFields.find(field=>field[0]==='fps')[3]=[30,40,60,90,120,144,165,240,360,480].map(n=>[String(n),`${n} fps`]);
  qualityFields.find(field=>field[0]==='bitrate')[3]=[.5,1,3,5,10,15,20,30,40,60,80,100,150,200,300,500].map(n=>[String(n*1000),`${n} Mbps`]);
  qualityFields.push(['hdr','HDR','Requires HDR on both the host and this display, with a supported codec.',onOff],['yuv444','4:4:4 colour','Sharper text when the host and decoder support it. Uses more bandwidth.',onOff],['fractionalVsync','Fractional V-Sync','Pace evenly when display refresh is an exact multiple of stream FPS. Requires V-Sync and frame pacing.',onOff],['audioOnHost','Play audio on host','Also keep the host PC’s speakers playing.',onOff],['captureSystemKeys','Windows shortcuts','Choose where shortcuts such as Alt + Tab are sent.',[['never','This device'],['always','Remote PC']]],['swapMouseButtons','Swap mouse buttons','Swap the left and right mouse buttons.',onOff],['reverseScroll','Reverse scrolling','Invert the mouse wheel direction.',onOff],['overlayDetail','Statistics detail','Full includes frame rates, network drops, latency, decoding and presentation timing.',[['standard','Standard'],['full','Full']]],['overlayPosition','Statistics position','Keep statistics in your preferred corner.',[['left','Top left'],['right','Top right']]],['overlaySize','Statistics text size','Adjust readability on smaller screens.',[['small','Small'],['medium','Medium'],['large','Large']]]);
  const qualityGroups=[['Video',['resolution','fps','bitrate','codec','decoder','hdr','yuv444']],['Frame delivery',['vsync','framePacing','fractionalVsync']],['Audio',['audioConfig','audioOnHost']],['Input',['multiController','swapFaceButtons','gamepadMouse','touchscreenTrackpad','absoluteMouse','captureSystemKeys','swapMouseButtons','reverseScroll']],['Performance statistics',['performanceOverlay','overlayDetail','overlayPosition','overlaySize']]];
  function qualityRow(id,values){
    const [,label,help,choices]=qualityFields.find(field=>field[0]===id),options=[...choices],value=String(values[id]??choices[0][0]);
    if(!options.some(option=>option[0]===value))options.push([value,id==='bitrate'?`${Number(value)/1000} Mbps`:id==='fps'?`${value} fps`:value.replace('x',' × ')]);
    if(['resolution','fps','bitrate'].includes(id))options.push(['custom','Custom…']);
    return `<label class="g-setting-row"><span><strong>${label}</strong><small>${help}</small></span><select id="remote-${id}" class="focusable" aria-label="${label}" data-saved-value="${escape(value)}">${options.map(([key,text])=>`<option value="${escape(key)}"${value===key?' selected':''}>${escape(text)}</option>`).join('')}</select></label>`;
  }
  function customQuality(select){
    const id=select.id.replace('remote-',''),value=select.dataset.savedValue;select.value=value;customDialog.dataset.field=id;
    const fields=id==='resolution'?[['Width',value.split('x')[0],256,7680],['Height',value.split('x')[1],256,7680]]:id==='fps'?[['Frames per second',value,10,480]]:[['Bitrate in Mbps',Number(value)/1000,.5,500]];
    customDialog.innerHTML=`<h2 id="remote-custom-title">Custom ${id==='fps'?'frame rate':id}</h2><p>Choose a value supported by your gaming PC and this device.</p>${fields.map(([label,current,min,max])=>`<label>${label}<input class="focusable" type="number" inputmode="decimal" value="${current}" min="${min}" max="${max}" step="${id==='bitrate'?'.001':'1'}" aria-label="${label}" required /></label>`).join('')}<p id="remote-custom-status" role="status"></p><div class="remote-tools">${button('remote-custom-save','Use value','',true)}${button('remote-custom-close','Cancel')}</div>`;showDialog(customDialog,'input');customDialog.opener=select;
  }
  function applyQualityPreset(){
    const name=document.querySelector('#remote-preset').value,preset=StreamSettings.presets[name],bitrate=document.querySelector('#remote-bitrate');
    // Remove old automatic labels when switching to a manual value.
    for(const option of bitrate.options)if(option.value!=='custom')option.textContent=`${Number(option.value)/1000} Mbps`;
    if(preset){
      const [width,height]=document.querySelector('#remote-resolution').value.split('x').map(Number),fps=Number(document.querySelector('#remote-fps').value),hdr=document.querySelector('#remote-hdr').value;
      for(const [key,value] of Object.entries(StreamSettings.presetValues(name,{width,height,fps,hdr}))){
        const field=document.querySelector('#remote-'+key),text=String(value);
        if(![...field.options].some(option=>option.value===text))field.add(new Option(`${Number(value)/1000} Mbps`,text),field.options.length-1);
        field.value=text;field.dataset.savedValue=text;
      }
      bitrate.selectedOptions[0].textContent+= ' · Auto';
    }
    document.querySelector('#remote-preset-help').textContent=preset?.description||'Your manual bitrate and video settings. Choose a preset to restore automatic tuning.';
    bitrate.closest('label').querySelector('small').textContent=preset?'Chosen for your resolution and frame rate. Change it to customise.':'Manual limit. Lower it if Wi-Fi struggles.';
  }
  function renderShortcuts(){
    shortcutsDialog.innerHTML=`<h2 id="remote-shortcuts-title">Stream shortcuts</h2><p>Hold a controller combination for half a second. These use the physical buttons, even when face buttons are swapped in games.</p>${[['disconnect','Disconnect','End the stream. The game stays open on your PC.'],['page','Game page / return','Leave the video to use the app, then return to your stream.']].map(([action,title,help])=>`<section class="remote-shortcut-section"><h3>${title}</h3><p>${help}</p><div class="remote-shortcut-bindings">${['gamepad','keyboard'].map(type=>button('remote-shortcut-record',`<span>${type==='gamepad'?'Controller':'Keyboard'}</span>${type==='gamepad'?padGlyphs(shortcutDraft[action][type]):keyboardGlyphs(shortcutDraft[action][type])}<small>Change</small>`,`data-shortcut="${action}" data-kind="${type}" aria-label="Change ${title} ${type==='gamepad'?'controller':'keyboard'} shortcut"`)).join('')}</div></section>`).join('')}<p class="remote-help">Save stream settings to apply your shortcuts to the next stream.</p><div class="remote-tools remote-quality-footer">${button('remote-shortcuts-close','Done','',true)}${button('remote-shortcuts-reset','Restore defaults')}</div>`;
    refreshFocusables();
  }
  function beginShortcut(action,type){
    shortcutCapture={action,type,armed:false,pad:null,mask:0,since:0,ready:false};
    recordDialog.innerHTML=`<h2 id="remote-shortcut-record-title">${action==='disconnect'?'Disconnect':'Game page'} shortcut</h2><p>${type==='gamepad'?'Release all buttons, then hold at least three together. Include a shoulder, View or Menu button.':'Hold at least two of Ctrl, Alt and Shift, then press a letter, number or F key.'}</p><div id="remote-shortcut-preview" aria-live="polite">Waiting for ${type==='gamepad'?'controller buttons':'keys'}…</div><p id="remote-shortcut-message" role="status">${type==='gamepad'?'Hold the combination for half a second. Press B alone to cancel.':'Press Escape to cancel.'}</p><div class="remote-tools">${button('remote-shortcut-use','Use shortcut','disabled',true)}${button('remote-shortcut-cancel','Cancel')}</div>`;
    showDialog(recordDialog,'[data-action="remote-shortcut-cancel"]');scheduleGamepadPoll();
  }
  function acceptShortcutCandidate(value){
    if(!shortcutCapture)return;const {action,type}=shortcutCapture,error=StreamSettings.shortcutError(shortcutDraft,action,type,value);
    document.querySelector('#remote-shortcut-preview').innerHTML=type==='gamepad'?padGlyphs(value):keyboardGlyphs(value);
    document.querySelector('#remote-shortcut-message').textContent=error||'Ready. Use this shortcut or cancel to keep your current one.';
    if(error)return;
    shortcutCapture.ready=true;shortcutCapture.value=value;waitForControllerRelease=true;
    recordDialog.querySelector('[data-action="remote-shortcut-use"]').disabled=false;restore('#remote-shortcut-record-dialog [data-action="remote-shortcut-use"]');
  }
  function captureShortcutKey(event){
    if(event.key==='Tab')return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.key==='Escape'){recordDialog.close();return;}
    if(shortcutCapture.type==='keyboard'&&!event.repeat&&!['Control','Alt','Shift','Meta'].includes(event.key))acceptShortcutCandidate(StreamSettings.keyboardEvent(event));
    if(event.key==='Enter'&&document.activeElement?.dataset.action==='remote-shortcut-cancel')recordDialog.close();
  }
  function captureControllerShortcut(pads){
    const capture=shortcutCapture;if(!capture||capture.ready)return false;
    const down=pad=>pad.buttons.some(b=>b.pressed||b.value>.55);
    if(!capture.armed){if(!pads.some(down)){capture.armed=true;state.previousButtons=[];}return true;}
    if(capture.type!=='gamepad')return false;
    const pad=capture.pad===null?pads.find(down):pads.find(pad=>pad.index===capture.pad);
    if(!pad){capture.pad=null;capture.mask=0;capture.since=0;return true;}
    capture.pad=pad.index;
    const mask=StreamSettings.padButtons.reduce((mask,b)=>mask|((pad.buttons[b.index]?.pressed||pad.buttons[b.index]?.value>.55)?b.mask:0),0);
    if(!mask){if(capture.mask===0x2000){recordDialog.close();return true;}capture.pad=null;capture.mask=0;capture.since=0;return true;}
    if(mask!==capture.mask){capture.mask=mask;capture.since=performance.now();document.querySelector('#remote-shortcut-preview').innerHTML=padGlyphs(mask);}
    if(performance.now()-capture.since>=500)acceptShortcutCandidate(mask);
    return true;
  }
  function openQuality(id,game){
    const host=hostById(id)||currentHost();qualityHost=host?.id||'';qualityGame=game||null;
    const p={width:1920,height:1080,fps:60,bitrate:20000,preset:'balanced',...host?.preferences,...remote.preferences},values={...p,resolution:`${p.width}x${p.height}`};
    const presets={...StreamSettings.presets,custom:{name:'Custom',description:'Your manual bitrate and video settings.'}},chosen=presets[p.preset]?p.preset:'balanced';
    shortcutDraft=StreamSettings.normalizeShortcuts(p.shortcuts,p.quitCombo);
    qualityDialog.innerHTML=`<h2 id="remote-quality-title">Stream settings</h2><p>Used for every game and every remote PC on this device. Changes apply to the next stream.</p><div class="remote-quality-options g-setting-list"><label class="g-setting-row"><span><strong>Streaming quality</strong><small id="remote-preset-help">${presets[chosen].description}</small></span><select id="remote-preset" class="focusable" aria-label="Streaming quality">${Object.entries(presets).map(([key,preset])=>`<option value="${key}"${chosen===key?' selected':''}>${preset.name}</option>`).join('')}</select></label>${['resolution','fps','hdr','bitrate'].map(id=>qualityRow(id,values)).join('')}</div><div class="remote-tools">${button('remote-quality-display','Use this display')}${button('remote-shortcuts','Shortcuts')}${button('remote-quality-advanced','Advanced settings','aria-expanded="false" aria-controls="remote-advanced"')}</div><section id="remote-advanced" hidden>${qualityGroups.map(([label,fields])=>[label,fields.filter(id=>!['resolution','fps','hdr','bitrate'].includes(id))]).filter(([,fields])=>fields.length).map(([label,fields])=>`<h3>${label}</h3><div class="remote-quality-options g-setting-list">${fields.map(id=>qualityRow(id,values)).join('')}</div>`).join('')}<p class="remote-help">Live video settings: ${padGlyphs(0x2300)} or Ctrl + Alt + Shift + O. Changes made there last for that stream; your saved settings here apply to every new stream.</p></section><div class="remote-tools remote-quality-footer">${button('remote-quality-save','Save settings','',true)}${button('remote-quality-close','Cancel')}${game?button('remote-hide-game','Hide this game'):''}${host?.hiddenCount?button('remote-restore-games',`Restore ${host.hiddenCount} hidden game${host.hiddenCount===1?'':'s'}`):''}</div><p id="remote-quality-status" role="status"></p>`;
    const fractional=()=>{document.querySelector('#remote-fractionalVsync').disabled=document.querySelector('#remote-vsync').value!=='true'||document.querySelector('#remote-framePacing').value!=='true';};
    for(const select of qualityDialog.querySelectorAll('select')){
      select.addEventListener('pointerdown',event=>{event.preventDefault();openConsoleChoice(select);});
      select.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();openConsoleChoice(select);}});
      select.addEventListener('change',()=>{
        if(select.value==='custom'&&select.id!=='remote-preset'){customQuality(select);return;}
        select.dataset.savedValue=select.value;
        if(select.id==='remote-preset'||['remote-resolution','remote-fps','remote-hdr'].includes(select.id))applyQualityPreset();
        else if(StreamSettings.tuningKeys.includes(select.id.replace('remote-',''))){document.querySelector('#remote-preset').value='custom';applyQualityPreset();}
        fractional();
      });
    }
    applyQualityPreset();fractional();showDialog(qualityDialog);
  }
  function paintDetail(){
    endButton.hidden=true;
    if(state.view!=='detail'){disconnectButton.hidden=true;return;}const game=state.remoteGames?.find(game=>game.id===state.detailGameId);if(!game){disconnectButton.hidden=true;const play=document.querySelector('#detail-play');if(play.dataset.remoteAction){play.disabled=false;delete play.dataset.remoteAction;document.querySelector('#detail-options-button').setAttribute('aria-label','Manage game');}return;}
    const host=hostById(game.remoteHostId);if(!host)return;
    const play=document.querySelector('#detail-play'),offline=host.status==='offline',other=host.status==='busy'&&host.currentGame!==game.appId,session=state.remotePlaySession,active=session?.gameId===game.id;
    disconnectButton.hidden=!active;disconnectButton.disabled=session?.phase==='stopping';disconnectButton.textContent=session?.phase==='stopping'?'Disconnecting…':'Disconnect';
    endButton.hidden=!(active || host.currentGame===game.appId);endButton.disabled=endingSession||offline||session?.phase==='stopping';endButton.textContent=endingSession?'Ending session…':'End session';
    play.disabled=endingSession||(active?session.phase!=='playing':Boolean(session)||offline||other||!host.paired);play.dataset.remoteAction='1';delete play.dataset.returnGame;
    play.innerHTML=`<span class="detail-action-icon" aria-hidden="true">${active?'↩':'▶'}</span><strong>${active?'Return to stream':offline?'PC offline':other?'PC busy':!host.paired?'Pair PC first':host.currentGame===game.appId?'Resume game':'Play remotely'}</strong>`;
    const options=document.querySelector('#detail-options-button');options.hidden=false;options.setAttribute('aria-label','Stream settings and game options');
    document.querySelector('#detail-session-info').innerHTML=`${active?'<span class="remote-status" data-status="ready"><i aria-hidden="true"></i>Stream connected</span>':status(host)}<span class="g-via">${gIcon('stream')}${escape(host.name)}</span>${active?'<small>Disconnect to leave the game running, or end the session on your PC.</small>':host.currentGame===game.appId?'<small>Stream disconnected. The host session is still open.</small>':''}`;
  }
  function finishRemoteLaunch(){launchPending=false;delete launchOverlay.dataset.remote;delete launchOverlay.dataset.gameId;launchOverlay.classList.remove('active');launchOverlay.hidden=true;}
  function launchError(message){finishRemoteLaunch();failedGame=state.remoteGames?.find(game=>game.id===state.detailGameId)||failedGame;errorDialog.innerHTML=`<h2 id="remote-error-title">Couldn’t start remote play</h2><p>${escape(message)}</p><div class="remote-tools">${failedGame?button('remote-retry','Try again','',true)+button('remote-error-quality','Stream settings'):''}${button('remote-error-close','Close')}</div>`;showDialog(errorDialog);}
  async function play(game,host){
    if(launchPending)return;launchPending=true;failedGame=game;qualityDialog.close();errorDialog.close();settingsDialog.close();state.remotePlaySession={phase:'connecting',hostId:host.id,title:game.title};
    const art=game.artwork?.hero||game.artwork?.tile;launchArt.style.backgroundImage=art?`url("${art.replaceAll('"','%22')}")`:'linear-gradient(145deg,#252926,#101211)';
    launchGameLogo.src=game.artwork?.logo||fallbackWordmark(game.title);launchGameLogo.hidden=false;launchingGame.hidden=true;launchOverlay.dataset.remote='1';launchOverlay.dataset.gameId=game.id;delete launchOverlay.dataset.cancelled;
    document.querySelector('#launch-status').textContent='Connecting to your PC';document.querySelector('#launch-via').textContent=`Streaming from ${host.name}`;launchOverlay.hidden=false;requestAnimationFrame(()=>launchOverlay.classList.add('active'));playUiSound('launch');
    try{await window.launcher.remotePlayStart(host.id,game.appId);}catch(error){state.remotePlaySession=null;launchError(error.message);}
  }
  window.remotePlayUI={get playing(){return state.remotePlaySession?.phase==='playing';},get capturesInput(){return state.remotePlaySession?.phase==='playing'&&state.remotePlaySession.view!=='page';},get active(){return Boolean(state.remotePlaySession);},captureControllerShortcut,suppressHeldButtons(gamepads){if(!waitForControllerRelease)return false;if(gamepads.some(pad=>pad.buttons.some(button=>button.pressed||button.value>.55)))return true;waitForControllerRelease=false;state.previousButtons=[];return false;}};
  const cancel=cancelLaunchWait;cancelLaunchWait=function(){if(launchOverlay.dataset.remote){window.launcher.remotePlayStop().catch(error=>showToast(error.message));finishRemoteLaunch();return;}return cancel();};
  window.launcher.onRemotePlayStatus(async event=>{
    if(event.host){const host=hostById(event.host.id);if(host)Object.assign(host,event.host);syncGames();}
    if(event.phase==='host-updated'){paintDetail();if(state.libraryRemote)renderLibrary();return;}
    if(event.phase==='page'){await showSessionPage(event.session);return;}
    if(event.phase==='stream'){state.remotePlaySession=event.session;document.body.classList.add('remote-streaming');hideStreamBar(false);paintDetail();return;}
    if(event.phase==='stopping'){state.remotePlaySession=event.session;paintDetail();streamBar.querySelectorAll('button').forEach(button=>button.disabled=true);return;}
    if(event.phase==='artwork'){applyArtwork(event.hostId,event);return;}
    if(event.phase==='discovered'){if(pairDialog.querySelector('#remote-discovered')&&!discoveries.some(host=>host.uuid===event.host.uuid)){discoveries.push(event.host);renderDiscoveries();}return;}
    if(event.phase==='paired'){await paired(event.hostId);return;}
    if(event.phase==='pair-error'){const target=pairDialog.querySelector('#remote-pair-status');if(target)target.textContent=event.error;return;}
    if(event.phase==='connecting'){state.remotePlaySession=event.session;document.querySelector('#launch-status').textContent='Starting your game';}
    if(event.phase==='reconnecting'){cancelAutoHide();streamBar.hidden=true;state.remotePlaySession=event.session;launchPending=true;launchOverlay.dataset.remote='1';launchOverlay.hidden=false;launchOverlay.classList.add('active');document.querySelector('#launch-status').textContent='Reconnecting to your game';scheduleGamepadPoll();}
    if(event.phase==='playing'){state.remotePlaySession=event.session;const game=hostById(event.session.hostId)?.games.find(game=>game.appId===event.session.appId);if(game){game.lastPlayed=event.session.lastPlayed||Date.now();rememberLaunch(game.id);syncGames();}finishRemoteLaunch();document.body.classList.add('remote-streaming');showStreamBar(event.session,true);refreshActiveGameSession().catch(()=>{});}
    if(event.phase==='error')launchError(event.error);
    if(event.phase==='connection-warning')showToast(event.error);
    if(event.phase==='ended'){
      const gameId=event.gameId||state.remotePlaySession?.gameId;
      cancelAutoHide();state.remotePlaySession=null;waitForControllerRelease=true;scheduleGamepadPoll();streamBar.hidden=true;streamBar.querySelectorAll('button').forEach(button=>button.disabled=false);document.body.classList.remove('remote-streaming');finishRemoteLaunch();
      if(['game-closed','session-ended'].includes(event.reason))for(const node of [...document.querySelectorAll('dialog[open]')].reverse())node.close();
      if(gameId && (state.view!=='detail'||state.detailGameId!==gameId))await openGameDetails(gameId);
      paintDetail();restore('#detail-play');refreshActiveGameSession().catch(()=>{});
      if(event.reason==='game-closed')showToast(`${event.title} closed. Stream ended.`);else if(event.reason==='connection-lost')launchError('Connection lost. The game may still be running on your host.');
      refreshHosts(true).catch(()=>{});
    }
  });
  const render=renderLibraryView;renderLibraryView=function(...args){if(state.libraryRemote){renderLibrary();return;}libraryView.classList.remove('remote-active');library.hidden=true;return render(...args);};
  const show=showSettingsPage;showSettingsPage=function(page){const result=show(page);if(page==='g-streaming')refreshHosts(true).catch(error=>showToast(error.message));return result;};
  const view=showView;showView=function(page,options={}){if(page==='library'&&state.libraryRemote){renderLibrary();if(options.restore)options={...options,restore:{...options.restore,element:library.querySelector(`[data-game-id="${CSS.escape(state.selectedGameId||'')}"]`)||options.restore.element}};}const result=view(page,options);paintDetail();if(page==='home')refreshHome();return result;};
  const prepare=prepareConsoleGamePage;prepareConsoleGamePage=function(game,...args){const result=prepare(game,...args);paintDetail();return result;};
  const inputs=renderDetailInputMethods;renderDetailInputMethods=function(...args){const result=inputs(...args);paintDetail();return result;};
  const sessions=renderGameSessionAction;renderGameSessionAction=function(...args){const result=sessions(...args);paintDetail();return result;};
  const gameOptions=openGameOptions;openGameOptions=function(id){const game=state.remoteGames?.find(game=>game.id===(id||document.activeElement?.dataset.gameId||state.detailGameId));if(game){openQuality(game.remoteHostId,game);return;}return gameOptions(id);};
  library.addEventListener('contextmenu',event=>{const card=event.target.closest('.remote-game-card');if(card){event.preventDefault();openGameOptions(card.dataset.gameId);}});
  const focus=setFocusedElement;setFocusedElement=function(element,...args){if(element?.id==='detail-play'&&element.disabled&&element.dataset.remoteAction)element=document.querySelector('#detail-options-button');const result=focus(element,...args);if(element?.classList.contains('remote-game-card')){state.selectedGameId=element.dataset.gameId;updateControllerPrompts();}return result;};
  const prompts=updateControllerPrompts;updateControllerPrompts=function(...args){const result=prompts(...args);if(state.view==='library'&&state.libraryRemote||state.view==='detail'&&state.detailGameId?.startsWith('remote:')||state.view==='home'&&document.activeElement?.dataset.gameId?.startsWith('remote:')){controllerPrompts.hidden=false;promptB.hidden=state.view==='home';promptA.hidden=false;promptA.querySelector('span').textContent=state.view==='detail'?'Play':'View game';promptMenu.hidden=false;promptMenu.querySelector('span').textContent='Stream settings';}return result;};
  const navigate=navigateConsoleLibrary;navigateConsoleLibrary=function(direction,current){
    if(state.view!=='library'||!state.libraryRemote||topmostOpenDialog())return navigate(direction,current);
    const visible=selector=>[...document.querySelectorAll(selector)].filter(node=>node.offsetParent!==null&&!node.disabled);
    const rows=[...gLibraryRows(),visible('#remote-host-tabs .focusable'),visible('#remote-library header .focusable'),visible('#remote-game-search')].filter(row=>row.length);
    const grid=document.querySelector('#remote-game-grid'),cards=[...grid.querySelectorAll('.remote-game-card')],columns=Math.max(1,getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    const rowIndex=rows.findIndex(row=>row.includes(current)),origin=current.getBoundingClientRect();
    if(rowIndex>=0){const row=rows[rowIndex];let next;
      if(direction==='left'||direction==='right')next=row[row.indexOf(current)+(direction==='left'?-1:1)];
      else{const target=rows[rowIndex+(direction==='up'?-1:1)];if(target)next=gNearest(target,origin);else if(direction==='down')next=gNearest(cards.slice(0,columns),origin)||grid.querySelector('.focusable');}
      if(next)setFocusedElement(next);return true;
    }
    const index=cards.indexOf(current);if(index<0)return false;let next;
    if(direction==='left'&&index%columns>0)next=cards[index-1];
    if(direction==='right'&&index%columns<columns-1)next=cards[index+1];
    if(direction==='up')next=index>=columns?cards[index-columns]:gNearest(rows.at(-1)||[],origin);
    if(direction==='down')next=index+columns<cards.length?cards[index+columns]:library.querySelector('.remote-library-help .focusable');
    if(next)setFocusedElement(next);return true;
  };
  document.querySelector('#remote-game-search').addEventListener('input',renderLibrary);
  const search=openConsoleSearch;openConsoleSearch=function(...args){if(state.view==='library'&&state.libraryRemote&&!document.querySelector('dialog[open]')){const input=document.querySelector('#remote-game-search');setFocusedElement(input);if(state.controllerClick||document.body.classList.contains('controller-input'))openNativeKeyboard(input);return;}return search(...args);};
  function checkVisibleHosts(){if(!document.hidden&&document.hasFocus()&&!state.activeGameSession&&!state.remotePlaySession&&(state.view==='home'&&state.remoteGames?.some(game=>lastPlayedAt(game)>0)||state.view==='library'&&state.libraryRemote||state.view==='detail'&&state.detailGameId?.startsWith('remote:')||settingsDialog.open&&document.querySelector('[data-settings-page="g-streaming"]')?.hidden===false))refreshHosts(true).catch(()=>{});}
  setInterval(checkVisibleHosts,20000);window.addEventListener('focus',checkVisibleHosts);document.addEventListener('visibilitychange',checkVisibleHosts);
  const perform=performAction;performAction=async function(action,source){
    try{
      if(action==='remote-stream-hide'){hideStreamBar();return;}
      if(action==='remote-stream-page'){await window.launcher.remotePlayPage();return;}
      if(action==='remote-stream-disconnect'){source.disabled=true;try{await window.launcher.remotePlayStop();}finally{source.disabled=false;}return;}
      if(action==='remote-end-session'){
        const game=state.remoteGames?.find(game=>game.id===state.detailGameId);if(!game)return;
        endDialog.dataset.hostId=game.remoteHostId;endDialog.dataset.appId=game.appId;
        endDialog.innerHTML=`<h2 id="remote-end-title">End this session?</h2><p>End ${escape(game.title)} on ${escape(hostById(game.remoteHostId)?.name||'your PC')}. The host may close the game, so save your progress first.</p><div class="remote-tools">${button('remote-end-confirm','End session','',true)}${button('remote-end-cancel','Keep session')}</div><p id="remote-end-status" role="status"></p>`;
        showDialog(endDialog,'[data-action="remote-end-cancel"]');return;
      }
      if(action==='remote-end-cancel'){endDialog.close();return;}
      if(action==='remote-end-confirm'){
        endingSession=true;source.disabled=true;source.textContent='Ending session…';paintDetail();
        try{const host=await window.launcher.remotePlayEndSession(endDialog.dataset.hostId,endDialog.dataset.appId);Object.assign(hostById(host.id)||{},host);syncGames();endDialog.close();showToast('Remote session ended.');}
        catch(error){endDialog.querySelector('#remote-end-status').textContent=error.message;}
        finally{endingSession=false;source.disabled=false;source.textContent='End session';paintDetail();if(!endDialog.open)restore('#detail-play');}return;
      }
      if(action==='console-library-section'){if(source.dataset.section==='remote'){await openLibrary();return;}state.libraryRemote=false;library.hidden=true;libraryView.classList.remove('remote-active');}
      if(action==='remote-open-library'||action==='remote-browse-host'){await openLibrary(source.dataset.hostId);return;}
      if(action==='remote-host-tab'){selectedHost=source.dataset.hostId;document.querySelector('#remote-game-search').value='';renderLibrary();restore(`#remote-host-tabs [data-host-id="${CSS.escape(selectedHost)}"]`);if(currentHost()?.paired)await refreshGames(selectedHost);return;}
      if(action==='remote-add'){addForm(source);return;}
      if(action==='remote-manual'){manualForm();return;}
      if(action==='remote-scan'){await scanNetwork();return;}
      if(action==='remote-pair-close'){pairDialog.close();return;}
      if(action==='remote-connect'||action==='remote-discovered-connect'){source.disabled=true;try{const result=await window.launcher.remotePlayAdd(source.dataset.address||document.querySelector('#remote-host-address').value);if(pairDialog.open)await beginPair(result.hostId);}finally{source.disabled=false;}return;}
      if(action==='remote-pair-host'){await beginPair(source.dataset.hostId);return;}
      if(action==='remote-settings-refresh'){await refreshHosts(true);return;}
      if(action==='remote-library-refresh'){await refreshGames(currentHost()?.id);return;}
      if(action==='remote-remove'){await window.launcher.remotePlayRemove(source.dataset.hostId);await refreshHosts();restore('[data-action="remote-add"]');return;}
      if(action==='remote-game-details'){await openGameDetails(source.dataset.gameId);return;}
      const detail=state.remoteGames?.find(game=>game.id===state.detailGameId);
      if(action==='detail-play'&&detail){if(state.remotePlaySession?.gameId===detail.id)await window.launcher.remotePlayFocus();else await play(detail,hostById(detail.remoteHostId));return;}
      if(action==='detail-options'&&detail){openQuality(detail.remoteHostId,detail);return;}
      if(action==='remote-quality'){openQuality(source.dataset.hostId);return;}
      if(action==='remote-shortcuts'){renderShortcuts();showDialog(shortcutsDialog);return;}
      if(action==='remote-shortcuts-close'){shortcutsDialog.close();return;}
      if(action==='remote-shortcuts-reset'){shortcutDraft=StreamSettings.defaultShortcuts();renderShortcuts();restore('#remote-shortcuts-dialog [data-action="remote-shortcuts-reset"]');return;}
      if(action==='remote-shortcut-record'){beginShortcut(source.dataset.shortcut,source.dataset.kind);return;}
      if(action==='remote-shortcut-cancel'){recordDialog.close();return;}
      if(action==='remote-shortcut-use'){if(shortcutCapture?.ready){const {action:target,type,value}=shortcutCapture;shortcutDraft[target][type]=value;recordDialog.close();renderShortcuts();restore('#remote-shortcuts-dialog [data-shortcut="'+target+'"][data-kind="'+type+'"]');}return;}
      if(action==='remote-quality-close'){qualityDialog.close();return;}
      if(action==='remote-quality-display'){
        const display=await window.launcher.remotePlayDisplay();for(const [id,value,label] of [['resolution',`${display.width}x${display.height}`,`${display.width} × ${display.height}`],['fps',String(display.fps),`${display.fps} fps`]]){const select=document.querySelector('#remote-'+id);if(![...select.options].some(option=>option.value===value))select.add(new Option(label,value),select.options.length-1);select.value=value;select.dataset.savedValue=value;}applyQualityPreset();showToast('Resolution and frame rate matched to this display.');return;
      }
      if(action==='remote-quality-advanced'){const section=document.querySelector('#remote-advanced');section.hidden=!section.hidden;source.setAttribute('aria-expanded',String(!section.hidden));source.textContent=section.hidden?'Advanced settings':'Hide advanced settings';refreshFocusables();return;}
      if(action==='remote-custom-close'){customDialog.close();return;}
      if(action==='remote-custom-save'){
        const inputs=[...customDialog.querySelectorAll('input')];if(inputs.some(input=>!input.checkValidity())){document.querySelector('#remote-custom-status').textContent='Enter a value within the displayed limits.';inputs.find(input=>!input.checkValidity()).focus();return;}
        const id=customDialog.dataset.field,select=document.querySelector('#remote-'+id),value=id==='resolution'?inputs.map(input=>input.value).join('x'):String(Number(inputs[0].value)*(id==='bitrate'?1000:1)),label=id==='resolution'?value.replace('x',' × '):id==='fps'?`${value} fps`:`${Number(value)/1000} Mbps`;
        if(![...select.options].some(option=>option.value===value))select.add(new Option(label,value),select.options.length-1);select.value=value;select.dataset.savedValue=value;select.dispatchEvent(new Event('change'));customDialog.close();return;
      }
      if(action==='remote-quality-save'){
        const [width,height]=document.querySelector('#remote-resolution').value.split('x').map(Number),preferences={width,height};for(const [id] of qualityFields)if(id!=='resolution')preferences[id]=document.querySelector('#remote-'+id).value;
        preferences.preset=document.querySelector('#remote-preset').value;preferences.shortcuts=shortcutDraft;
        source.disabled=true;try{await window.launcher.remotePlaySettings(qualityHost,preferences);await refreshHosts();qualityDialog.close();showToast('Stream settings saved for all games.');}finally{source.disabled=false;}return;
      }
      if(action==='remote-hide-game'||action==='remote-restore-games'){
        const host=hostById(qualityHost),result=await window.launcher.remotePlayHideGame(qualityHost,action==='remote-restore-games'?null:qualityGame.appId,true);if(host)Object.assign(host,result);syncGames();qualityDialog.close();await openLibrary(qualityHost);return;
      }
      if(action==='remote-error-close'){errorDialog.close();return;}
      if(action==='remote-retry'){if(failedGame)await play(failedGame,hostById(failedGame.remoteHostId));return;}
      if(action==='remote-error-quality'){errorDialog.close();if(failedGame)openQuality(failedGame.remoteHostId,failedGame);return;}
      if(action==='remote-library-help'){helpDialog.innerHTML=`<h2 id="remote-help-title">Keep your remote library current</h2><p>Refresh games here after changing your host’s library. Apollo and Sunshine share configured shortcuts; they may keep a shortcut after a game is uninstalled.</p><p>On Vibepollo, enable Steam auto-sync and “Remove uninstalled games” in the host’s Steam settings. Playnite has its own removal setting. On Sunshine or Apollo, remove stale shortcuts from Applications.</p><p>You can also hide a shortcut from its game page → Stream settings. Hidden games can be restored in this PC’s stream settings.</p><div class="remote-tools">${button('remote-help-close','Done','',true)}</div>`;showDialog(helpDialog);return;}
      if(action==='remote-help-close'){helpDialog.close();return;}
    }catch(error){showToast(error.message);const target=pairDialog.open?pairDialog.querySelector('#remote-pair-status'):qualityDialog.open?qualityDialog.querySelector('#remote-quality-status'):null;if(target)target.textContent=error.message;return;}
    return perform(action,source);
  };
  refreshHosts().catch(()=>{});
})();
