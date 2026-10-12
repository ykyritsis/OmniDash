const publisherLabels = {ubisoft:'Ubisoft Connect',ea:'EA app',battlenet:'Battle.net'};
let accountRequest = 0;
const accountRoot = document.createElement('div');
accountRoot.id = 'publisher-accounts';
accountRoot.innerHTML = Object.entries(publisherLabels).map(([provider,title])=>`<div class="library-connection-card" data-account-provider="${provider}">
  <div class="library-connection-heading"><span class="connection-icon">${provider==='ubisoft'?'U':provider==='ea'?'EA':'B'}</span><div><h3>${title}</h3><p>${provider==='ubisoft'?'Uses the library cached by Ubisoft Connect on this PC.':'Installed games are detected on this PC. Sign in to include your account library.'}</p></div><span class="connection-state" data-account-badge>Checking</span></div>
  <p class="connection-detail" data-account-status>Checking saved library…</p>
  <label class="toggle-row"><span><strong>Include uninstalled games</strong><small>${provider==='ubisoft'?'Open Ubisoft Connect and load your library first. This is the last library cached on this PC.':'Requires a separate, optional sign-in on the publisher’s official website.'}</small></span><input id="uninstalled-${provider}" class="focusable" type="checkbox" /></label>
  <div class="settings-data-buttons">${provider==='ubisoft'?'':`<button class="primary focusable" type="button" data-action="account-connect" data-provider="${provider}">Sign in to ${title}</button><button class="secondary focusable" type="button" data-action="account-disconnect" data-provider="${provider}" hidden>Disconnect</button>`}<button class="secondary focusable" type="button" data-action="account-client" data-provider="${provider}">Open ${title}</button></div>
  ${provider==='ubisoft'?'':`<small class="account-privacy">Sign-in happens on ${provider==='ea'?'ea.com':'battle.net'}. Passwords are never read by this app. Only this app’s browser session and game list are saved locally. Account buttons take effect immediately.</small>`}
</div>`).join('');
const otherConnection = [...document.querySelectorAll('.library-connection-card')].find(card=>card.querySelector('h3')?.textContent==='Other launchers');
otherConnection.before(accountRoot);
otherConnection.querySelector('p').textContent='Xbox, Rockstar, GOG, Amazon, Riot and itch.io.';
otherConnection.querySelector('.connection-detail').textContent='Installed games are detected on this PC. These account-owned uninstalled libraries are not connected yet.';

async function refreshAccountLibraries(setToggles = true) {
  const request=++accountRequest;
  try {
    const result=await window.launcher.getAccountLibraries();
    if(request!==accountRequest)return;
    for(const [provider,entry] of Object.entries(result)) {
      const card=document.querySelector(`[data-account-provider="${provider}"]`);
      if(!card)continue;
      const hasLibrary=['cached','ready','cached-sign-in-required'].includes(entry.status);
      const needsSignIn=/sign-in-required/.test(entry.status);
      card.querySelector('[data-account-badge]').textContent=needsSignIn?'Sign in again':hasLibrary?'Library saved':provider==='ubisoft'?'Local library':'Not connected';
      card.querySelector('[data-account-badge]').classList.toggle('account-ready',hasLibrary&&!needsSignIn);
      card.querySelector('[data-account-status]').textContent=provider==='ubisoft'
        ? entry.count ? `${entry.count} games in the local Ubisoft library cache.` : 'Open Ubisoft Connect, load your games, then select Refresh library.'
        : hasLibrary ? `${entry.count} account games${entry.at?` · synced ${new Date(entry.at).toLocaleDateString()}`:''}.${needsSignIn?' Sign in again to refresh; the saved list remains available.':''}`
          : 'Connect to read games in your account, including ones not installed. No API key needed.';
      if(setToggles)card.querySelector('input').checked=entry.enabled===true;
      card.querySelector('input').disabled=provider!=='ubisoft'&&!hasLibrary;
      const disconnect=card.querySelector('[data-action="account-disconnect"]');
      if(disconnect)disconnect.hidden=!hasLibrary;
      applyLibraryConnectionStatus(provider);
    }
    refreshFocusables();
  } catch { /* Installed libraries and the settings form stay usable offline. */ }
}
async function accountLibraryAction(action, source) {
  const provider=source.dataset.provider;
  if(!Object.hasOwn(publisherLabels,provider))return;
  source.disabled=true;
  try {
    if(action==='account-connect') {
      setLibraryConnectionStatus({provider,phase:'waiting',message:`Opening ${publisherLabels[provider]} sign-in…`});
      showToast(`Opening ${publisherLabels[provider]} sign-in. Use your publisher account; no API key is needed.`);
      const result=await window.launcher.connectLibraryAccount(provider);
      setLibraryConnectionStatus({provider,phase:'connected',message:`${publisherLabels[provider]} connected. ${result.count} games found.`});
      showToast(`${result.count} ${publisherLabels[provider]} account games found`);
      await refreshAccountLibraries();
      scanLibrary(false,false,true);
    } else if(action==='account-disconnect') {
      await window.launcher.disconnectLibraryAccount(provider);
      libraryConnectionStates.delete(provider);
      showToast(`${publisherLabels[provider]} disconnected. Installed games remain available.`);
      await refreshAccountLibraries();
      scanLibrary(false,false,true);
    } else await window.launcher.openLibraryClient(provider);
  } catch(error) { setLibraryConnectionStatus({provider,phase:'error',message:error.message || 'Could not connect this library'}); }
  finally { source.disabled=false;refreshFocusables(); }
}
