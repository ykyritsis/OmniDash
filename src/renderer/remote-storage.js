// Local storage overview, using the dashboard's shared settings controls.
(() => {
  let storage=null,selectedDrive='',storageRequest=0;
  const escape=escapeHtml,fmt=value=>Number(value)>0?formatBytes(value):value===0?'0 B':'Unavailable';
  const restoreFocus=selector=>{refreshFocusables();const target=document.querySelector(selector);if(target)setFocusedElement(target,{scroll:false});};
  const storagePage=document.createElement('div');storagePage.className='settings-page g-settings-page';storagePage.dataset.settingsPage='g-storage';storagePage.hidden=true;
  storagePage.innerHTML='<div class="storage-heading"><p>Drive space and installed games on this PC.</p><button class="g-button g-control-button focusable" data-action="storage-refresh">Refresh</button></div><div id="storage-overview" aria-live="polite"><p>Opening storage…</p></div>';
  document.querySelector('.settings-scroll').append(storagePage);

  function renderStorage(){
    const target=document.querySelector('#storage-overview');
    if(!storage){target.innerHTML='<p>Reading drive space…</p>';return;}
    const drives=storage.drives;if(!drives.length){target.innerHTML='<p>No available drives were found. Connect a drive and refresh.</p>';return;}
    const drive=drives.find(item=>item.root===selectedDrive)||drives.find(item=>item.games.length)||drives[0];selectedDrive=drive.root;
    target.innerHTML=`<div class="storage-drive-tabs" role="tablist" aria-label="Drives">${drives.map(item=>`
      <button class="storage-drive-tab focusable${item.root===drive.root?' active':''}" role="tab" aria-selected="${item.root===drive.root}" data-action="storage-drive" data-root="${escape(item.root)}">
        ${gIcon('drive')}<span class="storage-drive-copy"><strong>${escape(item.label||item.root)} (${escape(item.root.replace(/\\$/,''))})</strong><small>${fmt(item.free)} free of ${fmt(item.total)}</small></span>
      </button>`).join('')}</div>
      <section class="storage-drive-detail"><div class="storage-summary">
        <div class="storage-totals"><div><small>Drive capacity</small><strong>${fmt(drive.total)}</strong></div><div><small>Known game files</small><strong>${fmt(drive.knownGameBytes)}</strong></div><div><small>Free space</small><strong>${fmt(drive.free)}</strong></div></div>
        ${drive.total?`<div class="storage-space-bar" role="img" aria-label="${escape(fmt(drive.used))} used, ${escape(fmt(drive.free))} free">
          <span class="storage-games-used" style="width:${Math.min(100,Math.max(0,Math.min(drive.knownGameBytes,drive.used)/drive.total*100))}%"></span>
          <span class="storage-other-used" style="width:${Math.min(100,Math.max(0,(drive.used-Math.min(drive.knownGameBytes,drive.used))/drive.total*100))}%"></span>
        </div><p class="storage-legend"><span><i class="storage-games-used" aria-hidden="true"></i>Known game files</span><span><i class="storage-other-used" aria-hidden="true"></i>Windows, apps and other files</span><span><i aria-hidden="true"></i>Free space</span></p>`:''}
      </div><div class="storage-library-heading settings-section-heading"><h3>Installed games</h3><p>${drive.games.length} installed game${drive.games.length===1?'':'s'}${drive.unknownGames?` · ${drive.unknownGames} game size${drive.unknownGames===1?' is':'s are'} still being measured`:''}</p></div>
      ${drive.libraries.length?`<p class="storage-library-paths">Steam libraries: ${drive.libraries.map(escape).join(' · ')}</p>`:''}
      <div class="storage-game-list g-setting-list">${drive.games.length?drive.games.map(game=>`
        <button class="storage-game-row g-setting-row focusable" data-action="storage-game" data-game-id="${escape(game.id)}"><span><strong>${escape(game.title)}</strong><small>${escape(game.provider)} · ${escape(game.folder)}</small></span><b>${game.bytes?fmt(game.bytes):'Size pending'}</b>${gIcon('chevronRight','g-trailing')}</button>`).join(''):'<div class="remote-empty"><h3>No library games on this drive</h3><p>Installed games appear here after a library scan.</p></div>'}</div>
      </section>`;refreshFocusables();
  }
  async function refreshStorage(){const request=++storageRequest;if(!storage)renderStorage();try{const result=await window.launcher.getStorageOverview();if(request!==storageRequest)return;storage=result;renderStorage();}catch(error){document.querySelector('#storage-overview').innerHTML=`<p>${escape(error.message)}</p><button class="g-button g-control-button focusable" data-action="storage-refresh">Try again</button>`;refreshFocusables();}}
  const show=showSettingsPage;
  showSettingsPage=function(page){const result=show(page);if(page==='g-storage')refreshStorage();return result;};
  const perform=performAction;
  performAction=async function(action,source){
    if(action==='storage-refresh'){await refreshStorage();restoreFocus('[data-action="storage-refresh"]');return;}
    if(action==='storage-drive'){selectedDrive=source.dataset.root;renderStorage();restoreFocus(`.storage-drive-tab[data-root="${CSS.escape(selectedDrive)}"]`);return;}
    if(action==='storage-game'){const game=state.games.find(game=>game.id===source.dataset.gameId);if(game)openManageGame(game);return;}
    return perform(action,source);
  };
})();
