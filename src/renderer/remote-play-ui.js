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
  streamBar.innerHTML=`<div><strong id="remote-stream-title"></strong><span id="remote-stream-shortcut"></span><small>Release mouse: Ctrl + Alt + Shift + Z</small></div>${button('remote-stream-disconnect','Disconnect','title="End this stream and return to the app. The game stays open on your PC."')}`;
  document.body.append(streamBar);
  function updateViewport(){if(!streamBar.hidden)window.launcher.remotePlayViewport({top:Math.ceil(streamBar.getBoundingClientRect().bottom),height:innerHeight}).catch(()=>{});}
  new ResizeObserver(updateViewport).observe(streamBar);window.addEventListener('resize',updateViewport);
  function showStreamBar(session){const host=hostById(session.hostId),p=host?.preferences||{};document.querySelector('#remote-stream-title').textContent=session.title||'Remote play';document.querySelector('#remote-stream-shortcut').textContent=`Disconnect: ${p.quitCombo==='moonlight'?'View + Menu + LB + RB':`LB + RB + ${p.swapFaceButtons?'B':'A'}`} · Ctrl + Alt + Shift + Q`;streamBar.hidden=false;updateViewport();}
  window.addEventListener('keydown',event=>{if(!window.remotePlayUI?.playing)return;if(event.ctrlKey&&event.altKey&&event.shiftKey&&event.key.toLowerCase()==='q'){window.launcher.remotePlayStop().catch(error=>showToast(error.message));}else if(['Enter',' '].includes(event.key)&&streamBar.contains(document.activeElement)){document.activeElement.click();}else if(event.key==='Tab'){streamBar.querySelector('button').focus();}else if(event.key==='Escape'){window.launcher.remotePlayFocus().catch(()=>{});}event.preventDefault();event.stopImmediatePropagation();},true);
  function syncGames(){state.remoteGames=remote.hosts.flatMap(host=>(host.games||[]).map(game=>({...game,hostName:host.name})));}
  function acceptSnapshot(value){remote=value;syncGames();renderHosts();if(state.libraryRemote)renderLibrary();paintDetail();}
  const streaming=document.querySelector('[data-settings-page="g-streaming"]');
  streaming.innerHTML=`<div class="remote-intro settings-section-heading"><h3>Gaming PCs</h3><p>Find a Sunshine, Apollo or Vibepollo PC on your network, pair once, then play from Library → Remote PCs.</p></div><div class="remote-tools">${button('remote-add','Find a PC','',true)}${button('remote-open-library','Open remote library')}${button('remote-settings-refresh','Refresh status')}</div><div id="remote-hosts" aria-live="polite"></div><p class="remote-help">Streaming is built into this app. Approve the pairing PIN on the host PC to connect.</p>`;
  document.querySelector('.console-library-nav').insertAdjacentHTML('beforeend','<button class="focusable" type="button" data-action="console-library-section" data-section="remote">Remote PCs</button>');
  const library=document.createElement('section');library.id='remote-library';library.hidden=true;library.setAttribute('aria-labelledby','remote-library-title');
  library.innerHTML=`<div id="remote-host-tabs" role="tablist" aria-label="Remote PCs"></div><header><div><h2 id="remote-library-title">Remote PCs</h2><p id="remote-library-status" role="status"></p></div><div class="remote-library-actions">${button('remote-add','Find a PC')}${button('remote-quality','Stream settings')}${button('remote-library-refresh','Refresh games')}</div></header><label class="remote-search-label">Search this PC<input id="remote-game-search" class="focusable" type="search" placeholder="Search games" autocomplete="off" /></label><div id="remote-game-grid" class="remote-game-grid"></div><p class="remote-library-help">Games are supplied by your host’s shared library. <button class="remote-inline-button focusable" data-action="remote-library-help">Missing or uninstalled games?</button></p>`;
  document.querySelector('.console-library-content').append(library);
  function dialog(id,cls){const node=document.createElement('dialog');node.id=id;node.className=`${cls} g-managed-dialog`;document.body.append(node);return node;}
  const pairDialog=dialog('remote-pair-dialog','remote-pair-dialog');pairDialog.setAttribute('aria-labelledby','remote-pair-title');
  const qualityDialog=dialog('remote-quality-dialog','remote-quality-dialog');qualityDialog.setAttribute('aria-labelledby','remote-quality-title');
  const errorDialog=dialog('remote-error-dialog','remote-pair-dialog');errorDialog.setAttribute('aria-labelledby','remote-error-title');
  const helpDialog=dialog('remote-help-dialog','remote-pair-dialog');helpDialog.setAttribute('aria-labelledby','remote-help-title');
  pairDialog.addEventListener('close',()=>{scanGeneration++;window.launcher.remotePlayCancelPair().catch(()=>{});if(pairOpener?.isConnected)setFocusedElement(pairOpener,{scroll:false});});
  for(const node of [qualityDialog,errorDialog,helpDialog])node.addEventListener('close',()=>{refreshFocusables();if(node.opener?.isConnected&&node.opener.offsetParent!==null)setFocusedElement(node.opener,{scroll:false});});
  function showDialog(node,first){node.opener=document.activeElement;if(!node.open)node.showModal();refreshFocusables();setFocusedElement(node.querySelector(first||'.focusable'),{scroll:false});}
  function renderHosts(){
    document.querySelector('#remote-hosts').innerHTML=!remote.available?'<div class="remote-empty"><h3>Streaming component unavailable</h3><p>Install the full app build to restore the bundled streaming component.</p></div>':!remote.hosts.length?'<div class="remote-empty"><h3>Your gaming PCs, in one place</h3><p>Find a PC on this network to get started. You can also enter an address manually.</p></div>':remote.hosts.map(host=>`<article class="remote-host-card"><div class="remote-host-info"><span class="remote-host-icon">${gIcon('stream')}</span><span class="remote-host-copy"><strong>${escape(host.name)}</strong>${status(host)}<small>${escape(host.address)}${host.paired?` · ${host.games.length} shared games`:''}</small></span></div><div class="remote-host-actions">${button(host.paired?'remote-browse-host':'remote-pair-host',host.paired?'Browse games':'Pair PC',`data-host-id="${escape(host.id)}"`)}${host.paired?button('remote-quality','Stream settings',`data-host-id="${escape(host.id)}"`):''}${button('remote-remove','Remove',`data-host-id="${escape(host.id)}"`)}</div></article>`).join('');refreshFocusables();
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
    library.querySelector('[data-action="remote-quality"]').disabled=!host?.paired;
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
    game.artwork=item.artwork||{...game.artwork,tile:item.tile};syncGames();
    const art=library.querySelector(`[data-game-id="${CSS.escape(game.id)}"] .remote-game-art`);if(art)art.innerHTML=gameArt(game);
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
  qualityFields.push(['audioConfig','Audio','Speaker layout on this device.',[['stereo','Stereo'],['5.1','5.1 surround'],['7.1','7.1 surround']]],['vsync','V-Sync','Reduce screen tearing.',onOff],['framePacing','Frame pacing','Smooth frame delivery when V-Sync is on.',onOff],['performanceOverlay','Performance statistics','Show the streaming engine’s performance overlay.',onOff],['multiController','Multiple controllers','Send each connected controller as a separate player.',onOff],['swapFaceButtons','Swap A/B and X/Y','Use Nintendo-style face-button positions.',onOff],['gamepadMouse','Controller mouse mode','Hold Menu / Start to toggle mouse control, as in Moonlight.',onOff],['touchscreenTrackpad','Touchscreen mode','Choose direct touch or trackpad-style movement.',[['false','Direct touch'],['true','Trackpad']]],['absoluteMouse','Mouse mode','Use game capture or an absolute desktop pointer.',[['false','Game capture'],['true','Desktop pointer']]],['quitCombo','Controller disconnect shortcut','Hold for half a second. Swapping face buttons changes A to B.',[['streamlight','LB + RB + A'],['moonlight','View + Menu + LB + RB']]]);
  function openQuality(id,game){
    const host=hostById(id)||currentHost();if(!host)return;qualityHost=host.id;qualityGame=game||null;
    const p={width:1920,height:1080,fps:60,bitrate:20000,codec:'auto',decoder:'auto',audioConfig:'stereo',vsync:true,framePacing:false,performanceOverlay:false,multiController:true,swapFaceButtons:false,gamepadMouse:true,touchscreenTrackpad:false,absoluteMouse:false,quitCombo:'streamlight',...host.preferences},values={...p,resolution:`${p.width}x${p.height}`};
    qualityDialog.innerHTML=`<h2 id="remote-quality-title">Stream settings</h2><p>${escape(host.name)} · Saved for this PC. Changes apply to the next stream.</p><div class="remote-quality-options g-setting-list">${qualityFields.map(([id,label,help,options])=>`<label class="g-setting-row"><span><strong>${label}</strong><small>${help}</small></span><select id="remote-${id}" class="focusable" aria-label="${label}">${options.map(([value,text])=>`<option value="${value}"${String(values[id])===value?' selected':''}>${text}</option>`).join('')}</select></label>`).join('')}</div><p class="remote-help">Disconnect while playing using the button above the video, Ctrl + Alt + Shift + Q, or your selected controller shortcut.</p><div class="remote-tools">${button('remote-quality-save','Save settings','',true)}${button('remote-quality-close','Cancel')}${game?button('remote-hide-game','Hide this game'):''}${host.hiddenCount?button('remote-restore-games',`Restore ${host.hiddenCount} hidden game${host.hiddenCount===1?'':'s'}`):''}</div><p id="remote-quality-status" role="status"></p>`;
    for(const select of qualityDialog.querySelectorAll('select')){select.addEventListener('pointerdown',event=>{event.preventDefault();openConsoleChoice(select);});select.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();openConsoleChoice(select);}});}
    showDialog(qualityDialog);
  }
  function paintDetail(){
    if(state.view!=='detail')return;const game=state.remoteGames?.find(game=>game.id===state.detailGameId);if(!game){const play=document.querySelector('#detail-play');if(play.dataset.remoteAction){play.disabled=false;delete play.dataset.remoteAction;document.querySelector('#detail-options-button').setAttribute('aria-label','Manage game');}return;}
    const host=hostById(game.remoteHostId);if(!host)return;
    const play=document.querySelector('#detail-play'),offline=host.status==='offline',other=host.status==='busy'&&host.currentGame!==game.appId;
    play.disabled=offline||other||!host.paired;play.dataset.remoteAction='1';delete play.dataset.returnGame;
    play.innerHTML=`<span class="detail-action-icon" aria-hidden="true">▶</span><strong>${offline?'PC offline':other?'PC busy':!host.paired?'Pair PC first':host.currentGame===game.appId?'Resume stream':'Play remotely'}</strong>`;
    const options=document.querySelector('#detail-options-button');options.hidden=false;options.setAttribute('aria-label','Stream settings and game options');
    document.querySelector('#detail-session-info').innerHTML=`${status(host)}<span class="g-via">${gIcon('stream')}${escape(host.name)}</span>`;
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
  window.remotePlayUI={get playing(){return state.remotePlaySession?.phase==='playing';},get active(){return Boolean(state.remotePlaySession);},suppressHeldButtons(gamepads){if(!waitForControllerRelease)return false;if(gamepads.some(pad=>pad.buttons.some(button=>button.pressed||button.value>.55)))return true;waitForControllerRelease=false;state.previousButtons=[];return false;}};
  const cancel=cancelLaunchWait;cancelLaunchWait=function(){if(launchOverlay.dataset.remote){window.launcher.remotePlayStop().catch(error=>showToast(error.message));finishRemoteLaunch();state.remotePlaySession=null;return;}return cancel();};
  window.launcher.onRemotePlayStatus(async event=>{
    if(event.phase==='artwork'){applyArtwork(event.hostId,event);return;}
    if(event.phase==='discovered'){if(pairDialog.querySelector('#remote-discovered')&&!discoveries.some(host=>host.uuid===event.host.uuid)){discoveries.push(event.host);renderDiscoveries();}return;}
    if(event.phase==='paired'){await paired(event.hostId);return;}
    if(event.phase==='pair-error'){const target=pairDialog.querySelector('#remote-pair-status');if(target)target.textContent=event.error;return;}
    if(event.phase==='connecting'){state.remotePlaySession=event.session;document.querySelector('#launch-status').textContent='Starting your game';}
    if(event.phase==='playing'){state.remotePlaySession=event.session;finishRemoteLaunch();document.body.classList.add('remote-streaming');showStreamBar(event.session);refreshActiveGameSession().catch(()=>{});}
    if(event.phase==='error')launchError(event.error);
    if(event.phase==='connection-warning')showToast(event.error);
    if(event.phase==='ended'){state.remotePlaySession=null;waitForControllerRelease=true;streamBar.hidden=true;document.body.classList.remove('remote-streaming');finishRemoteLaunch();refreshActiveGameSession().catch(()=>{});if(event.reason==='game-closed')showToast(`${event.title} closed. Stream ended.`);else if(event.reason==='connection-lost')launchError('Connection lost. The game may still be running on your host.');refreshHosts(true).catch(()=>{});}
  });
  const render=renderLibraryView;renderLibraryView=function(...args){if(state.libraryRemote){renderLibrary();return;}libraryView.classList.remove('remote-active');library.hidden=true;return render(...args);};
  const show=showSettingsPage;showSettingsPage=function(page){const result=show(page);if(page==='g-streaming')refreshHosts(true).catch(error=>showToast(error.message));return result;};
  const view=showView;showView=function(page,options={}){if(page==='library'&&state.libraryRemote){renderLibrary();if(options.restore)options={...options,restore:{...options.restore,element:library.querySelector(`[data-game-id="${CSS.escape(state.selectedGameId||'')}"]`)||options.restore.element}};}const result=view(page,options);paintDetail();return result;};
  const prepare=prepareConsoleGamePage;prepareConsoleGamePage=function(game,...args){const result=prepare(game,...args);paintDetail();return result;};
  const inputs=renderDetailInputMethods;renderDetailInputMethods=function(...args){const result=inputs(...args);paintDetail();return result;};
  const sessions=renderGameSessionAction;renderGameSessionAction=function(...args){const result=sessions(...args);paintDetail();return result;};
  const gameOptions=openGameOptions;openGameOptions=function(id){const game=state.remoteGames?.find(game=>game.id===(id||document.activeElement?.dataset.gameId||state.detailGameId));if(game){openQuality(game.remoteHostId,game);return;}return gameOptions(id);};
  library.addEventListener('contextmenu',event=>{const card=event.target.closest('.remote-game-card');if(card){event.preventDefault();openGameOptions(card.dataset.gameId);}});
  const focus=setFocusedElement;setFocusedElement=function(element,...args){if(element?.id==='detail-play'&&element.disabled&&element.dataset.remoteAction)element=document.querySelector('#detail-options-button');const result=focus(element,...args);if(element?.classList.contains('remote-game-card')){state.selectedGameId=element.dataset.gameId;updateControllerPrompts();}return result;};
  const prompts=updateControllerPrompts;updateControllerPrompts=function(...args){const result=prompts(...args);if(state.view==='library'&&state.libraryRemote||state.view==='detail'&&state.detailGameId?.startsWith('remote:')){controllerPrompts.hidden=false;promptB.hidden=false;promptA.hidden=false;promptA.querySelector('span').textContent=state.view==='detail'?'Play':'View game';promptMenu.hidden=false;promptMenu.querySelector('span').textContent='Stream settings';}return result;};
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
  setInterval(()=>{if(!state.remotePlaySession&&(state.view==='library'&&state.libraryRemote||state.view==='detail'&&state.detailGameId?.startsWith('remote:')||settingsDialog.open&&document.querySelector('[data-settings-page="g-streaming"]')?.hidden===false))refreshHosts(true).catch(()=>{});},20000);
  const perform=performAction;performAction=async function(action,source){
    try{
      if(action==='remote-stream-disconnect'){source.disabled=true;try{await window.launcher.remotePlayStop();}finally{source.disabled=false;}return;}
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
      if(action==='detail-play'&&detail){await play(detail,hostById(detail.remoteHostId));return;}
      if(action==='detail-options'&&detail){openQuality(detail.remoteHostId,detail);return;}
      if(action==='remote-quality'){openQuality(source.dataset.hostId);return;}
      if(action==='remote-quality-close'){qualityDialog.close();return;}
      if(action==='remote-quality-save'){
        const [width,height]=document.querySelector('#remote-resolution').value.split('x').map(Number),preferences={width,height};for(const [id] of qualityFields)if(id!=='resolution')preferences[id]=document.querySelector('#remote-'+id).value;
        source.disabled=true;try{const result=await window.launcher.remotePlaySettings(qualityHost,preferences);const host=hostById(qualityHost);if(host)host.preferences=result;qualityDialog.close();showToast('Stream settings saved.');}finally{source.disabled=false;}return;
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
