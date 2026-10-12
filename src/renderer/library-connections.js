const connectionPageRoot=document.querySelector('[data-settings-page="services"]');
const connectionPages=new Map();
const connectionDefinitions=[['steam','Steam','Your installed games, account library and achievements.','assets/steam.svg'],['epic','Epic Games','Installed games are ready. Link your account for more.','assets/epic.svg'],['ea','EA app','Connect once to include your account games.','assets/ea.svg'],['battlenet','Battle.net','Connect once to include your account games.','assets/battlenet.svg'],['ubisoft','Ubisoft Connect','Uses your library from the desktop app.','assets/ubisoft.svg'],['local','This PC','Installed games and other launchers.','assets/xbox.svg']];
function createConnectionPage(id,title,node) {
  const page=document.createElement('div');page.className='settings-page connection-page';page.dataset.settingsPage=`connection-${id}`;page.hidden=true;
  page.innerHTML=`<button class="secondary focusable connection-back" type="button" data-connections-back>‹ All libraries</button><div class="connection-page-heading"><span class="eyebrow">GAME LIBRARY</span><h3>${title}</h3><p>Connection changes apply immediately.</p></div>`;
  page.append(node);document.querySelector('.settings-scroll').append(page);connectionPages.set(id,page);return page;
}
const steamConnection=document.querySelector('#settings-steam-status').closest('.library-connection-card');
const epicConnection=document.querySelector('#settings-epic-status').closest('.library-connection-card');
createConnectionPage('steam','Steam',steamConnection);createConnectionPage('epic','Epic Games',epicConnection);
for(const provider of ['ea','battlenet','ubisoft'])createConnectionPage(provider,publisherLabels[provider],accountRoot.querySelector(`[data-account-provider="${provider}"]`));
const localConnection=[...connectionPageRoot.querySelectorAll('.library-connection-card')].find(card=>card.querySelector('h3')?.textContent==='Other launchers');
createConnectionPage('local','This PC',localConnection);
const tools=document.createElement('div');tools.className='connection-tools';
const automatic=connectionPageRoot.querySelector('.settings-section');tools.append(automatic);
for(const section of [...connectionPageRoot.children]) if(section.querySelector('[data-page="duplicates"]')||section.classList.contains('settings-quick-links'))tools.append(section);
createConnectionPage('tools','Library tools',tools);
for(const node of [...connectionPageRoot.children]) {
  if(node.classList.contains('settings-advanced'))tools.append(node);
  else if(node.querySelector('#steam-family-toggle'))connectionPages.get('steam').append(node);
}
connectionPageRoot.replaceChildren();
connectionPageRoot.innerHTML=`<div class="connections-intro"><h3>All your games. One library.</h3><p>Installed games appear automatically. Choose a service to connect your account or manage its games.</p></div><div class="connections-grid">${connectionDefinitions.map(([id,title,description,icon])=>`<button class="connection-tile focusable" type="button" data-connection-page="${id}">${icon?`<img src="${icon}" alt="" />`:'<span class="connection-drive-mark" aria-hidden="true">△</span>'}<span class="connection-tile-copy"><strong>${title}</strong><small>${description}</small><span data-connection-label="${id}">Checking…</span></span><b aria-hidden="true">›</b></button>`).join('')}</div><div class="connections-footer"><button class="secondary focusable" type="button" data-action="rescan">Refresh library</button><button class="secondary focusable" type="button" data-connection-page="tools">Library tools</button></div>`;
// Keep the existing settings inputs for compatibility, while removing redundant switches from the connection flow.
for(const id of ['uninstalled-ea','uninstalled-battlenet','uninstalled-ubisoft','show-uninstalled-toggle','steam-family-toggle','show-uninstalled-epic-toggle'])document.querySelector('#'+id).closest('label').hidden=true;
const epicRefresh=document.createElement('button');epicRefresh.type='button';epicRefresh.className='primary focusable';epicRefresh.dataset.epicLink='true';epicRefresh.textContent='Refresh Epic account';epicConnection.append(epicRefresh);
steamConnection.querySelector('.connection-setup summary').textContent='Account setup';
steamConnection.querySelector('.connection-setup').open=true;
steamConnection.querySelector('#steam-id64').closest('label').hidden=true;
steamConnection.querySelector('.connection-setup-body').insertAdjacentHTML('afterbegin','<p>Link your Steam account once to include owned games and sync PC Gamerscore. Installed games work automatically.</p>');
const steamActions=document.createElement('div');steamActions.className='settings-data-buttons';steamActions.innerHTML='<button class="primary focusable" type="button" data-steam-link>Link Steam account</button><button class="secondary focusable" type="button" data-steam-unlink hidden>Unlink account</button>';
steamConnection.querySelector('.connection-setup-body').append(steamActions);
const steamAdvanced=document.createElement('details');steamAdvanced.innerHTML='<summary class="focusable">Advanced · Steam account ID</summary>';const idLabel=steamConnection.querySelector('#steam-id64').closest('label');idLabel.hidden=false;steamAdvanced.append(idLabel);steamConnection.querySelector('.connection-setup-body').append(steamAdvanced);
for(const provider of ['ea','battlenet']) {const button=connectionPages.get(provider).querySelector('[data-action="account-connect"]');button.textContent=`Connect ${publisherLabels[provider]}`;connectionPages.get(provider).querySelector('.account-privacy').textContent='Sign in on the official website. Your sign-in window closes when the library is ready.';}
connectionPages.get('ubisoft').querySelector('[data-account-status]').textContent='Open Ubisoft Connect, load your games, then Refresh library.';
const ubiRefresh=document.createElement('button');ubiRefresh.type='button';ubiRefresh.className='primary focusable';ubiRefresh.dataset.localRefresh='ubisoft';ubiRefresh.textContent='Refresh library';connectionPages.get('ubisoft').querySelector('.settings-data-buttons').prepend(ubiRefresh);
async function refreshConnectionHub() {
  try {
    const [accounts,settings,steam]=await Promise.all([window.launcher.getAccountLibraries(),window.launcher.getSettings(),window.launcher.getSteamLocalStatus()]);
    const label=(id,text)=>{const node=document.querySelector(`[data-connection-label="${id}"]`);if(node)node.textContent=text;};
    label('steam',settings.steamApiKey?'Account linked':steam.installed?'Installed games ready':'Open Steam to get started');
    label('epic',settings.showUninstalledEpic?'Account library enabled':'Installed games ready');label('local','Automatic');
    for(const id of ['ea','battlenet','ubisoft']) {const value=accounts[id];label(id,['ready','cached'].includes(value.status)?`${value.count} games · Connected`:id==='ubisoft'?'Automatic':/cached/.test(value.status)?'Reconnect to refresh':'Connect account');}
    const linked=!!settings.steamApiKey;steamConnection.querySelector('[data-steam-unlink]').hidden=!linked;steamConnection.querySelector('[data-steam-link]').textContent=linked?'Refresh Steam account':'Link Steam account';
    if(!document.activeElement?.closest('.connection-setup')) {document.querySelector('#steam-api-key').value=settings.steamApiKey||'';document.querySelector('#steam-id64').value=settings.steamId64||steam.steamId64||'';}
    refreshFocusables();
  } catch { /* Saved connection panels remain available offline. */ }
}
function updateConnectionPage(page) {
  const connectedPage=page==='services'||page.startsWith('connection-');
  const submit=settingsDialog.querySelector('button[value="save"]');if(submit)submit.hidden=connectedPage&&page!=='connection-tools';
  const cancel=settingsDialog.querySelector('button[value="cancel"]:not(.close-button)');if(cancel)cancel.textContent=connectedPage?'Done':'Cancel';
  if(page.startsWith('connection-')) {const id=page.slice(11),definition=connectionDefinitions.find(item=>item[0]===id);document.querySelector('.settings-title h2').textContent=definition?.[1]||'Library tools';document.querySelector('.settings-title p').textContent='';state.consoleSettingsParent='services';}
  if(connectedPage)refreshConnectionHub();
}
async function openLibraryConnection(id,opener) {if(!settingsDialog.open)await openSettings();openConsoleSettingsPage(`connection-${id}`,opener);}
document.addEventListener('click',async event=>{
  const tile=event.target.closest('[data-connection-page]');if(tile){await openLibraryConnection(tile.dataset.connectionPage,tile);return;}
  if(event.target.closest('[data-connections-back]')){showSettingsPage('services');setFocusedElement(connectionPageRoot.querySelector('.focusable'));return;}
  const link=event.target.closest('[data-steam-link]'),unlink=event.target.closest('[data-steam-unlink]');
  if(link||unlink){const button=link||unlink;button.disabled=true;try{
    if(link&&!document.querySelector('#steam-api-key').value.trim()){const linked=await window.launcher.steamAutoLink();if(linked.status!=='linked')return;document.querySelector('#show-uninstalled-toggle').checked=true;document.querySelector('#settings-steam-status').textContent=`Steam linked. ${linked.count} games found. PC Gamerscore is ready.`;}
    else if(link){document.querySelector('#settings-steam-status').textContent='Checking your Steam account…';const result=await window.launcher.connectSteamAccount({apiKey:document.querySelector('#steam-api-key').value,steamId:document.querySelector('#steam-id64').value});document.querySelector('#show-uninstalled-toggle').checked=true;document.querySelector('#settings-steam-status').textContent=`Steam linked. ${result.count} games found. PC Gamerscore is ready.`;}
    else{await window.launcher.disconnectSteamAccount();document.querySelector('#steam-api-key').value='';document.querySelector('#show-uninstalled-toggle').checked=false;document.querySelector('#settings-steam-status').textContent='Account unlinked. Installed games and your saved PC Gamerscore remain available.';}
    await scanLibrary(false,false,true);await refreshConnectionHub();scheduleScoreRefresh();
  }catch(error){document.querySelector('#settings-steam-status').textContent=error.message;showToast(error.message);}finally{button.disabled=false;refreshFocusables();}return;}
  if(event.target.closest('[data-local-refresh]')){await window.launcher.saveSettings({showUninstalledUbisoft:true});document.querySelector('#uninstalled-ubisoft').checked=true;await scanLibrary(false,false,true);await refreshAccountLibraries();await refreshConnectionHub();}
  if(event.target.closest('[data-epic-link]')){try{await window.launcher.saveSettings({showUninstalledEpic:true,legendaryPath:document.querySelector('#legendary-path').value.trim()});document.querySelector('#show-uninstalled-epic-toggle').checked=true;await scanLibrary(false,false,true);await refreshConnectionHub();}catch(error){showToast(error.message);}}
});
window.launcher.onConnectionProgress(data=>{const label=document.querySelector(`[data-connection-label="${data.provider}"]`);if(label)label.textContent=data.message;if(data.provider==='steam')document.querySelector('#settings-steam-status').textContent=data.message;});
refreshConnectionHub();
