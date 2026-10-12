// Keep all source entries for launch, artwork and history. Preferences affect
// the combined library; explicitly browsing a source shows that source's copy.
function displayedLibraryGames(provider = 'all') {
  if(state.duplicateMode!=='preferred')return state.games;
  const groups=libraryDuplicates.duplicateGroups(state.games);
  state.duplicateCopyIds=new Map(groups.flatMap(group=>group.copies.map(game=>[game.id,group.copies.map(copy=>copy.id)])));
  return provider !== 'all' ? state.games : libraryDuplicates.visibleCopies(state.games,state,groups);
}
function libraryCopyIds(game) { return state.duplicateMode==='preferred' ? state.duplicateCopyIds?.get(game.id) || [game.id] : [game.id]; }
function duplicateSettingsPayload() {
  const preferences={};
  for(const choice of document.querySelectorAll('[data-duplicate-choice]'))if(choice.value)preferences[choice.dataset.duplicateChoice]=choice.value;
  return { duplicateMode:document.querySelector('#duplicate-mode').value,
    duplicatePreferredProvider:document.querySelector('#duplicate-provider').value,duplicatePreferences:preferences };
}
function bindLibraryChoice(select) {
  select.addEventListener('pointerdown',event=>{event.preventDefault();openConsoleChoice(select);});
  select.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();openConsoleChoice(select);}});
}
function renderDuplicateSettings(settings) {
  document.querySelector('#duplicate-mode').value=settings.duplicateMode || 'all';
  document.querySelector('#duplicate-provider').value=settings.duplicatePreferredProvider || 'Steam';
  const groups=libraryDuplicates.duplicateGroups(state.games).sort((a,b)=>a.title.localeCompare(b.title));
  document.querySelector('#duplicate-count').textContent=`${groups.length} game${groups.length===1?'':'s'} found in multiple libraries`;
  document.querySelector('#duplicate-games-list').innerHTML=groups.length?groups.map(group=>`<label class="duplicate-game-row"><span><strong>${escapeHtml(group.title)}</strong><small>${group.copies.length} copies · ${group.copies.map(game=>escapeHtml(game.provider)).join(' / ')}</small></span><select class="focusable" aria-label="Preferred copy of ${escapeHtml(group.title)}" data-duplicate-choice="${escapeHtml(group.key)}"><option value="">Automatic · installed copy first</option>${group.copies.map(game=>`<option value="${escapeHtml(game.id)}">${escapeHtml(game.provider)} · ${game.installed===false?'Not installed':'Installed'}</option>`).join('')}</select></label>`).join('')
    : `<div class="duplicate-empty">${consoleIcon('library')}<h3>One copy of everything</h3><p>When the same game appears in different libraries, you can choose which copy to show here.</p></div>`;
  for(const select of document.querySelectorAll('[data-duplicate-choice]')) {
    select.value=settings.duplicatePreferences?.[select.dataset.duplicateChoice] || '';
    bindLibraryChoice(select);
  }
}
const duplicatePage=document.createElement('div');
duplicatePage.className='settings-page console-settings-subpage';duplicatePage.dataset.settingsPage='duplicates';duplicatePage.hidden=true;
duplicatePage.innerHTML=`<section class="settings-section"><div class="settings-section-heading"><h3>Duplicate games</h3><p>Choose how games from multiple launchers appear together. Every copy keeps its artwork, settings and play history.</p></div><label class="duplicate-game-row"><span><strong>Combined library</strong><small>Source filters always show the games from that launcher.</small></span><select id="duplicate-mode" class="focusable"><option value="all">Show every copy</option><option value="preferred">Show one preferred copy</option></select></label><label class="duplicate-game-row"><span><strong>Preferred launcher</strong><small>Automatic choice prefers an installed copy, then this launcher.</small></span><select id="duplicate-provider" class="focusable">${libraryDuplicates.providers.map(provider=>`<option>${provider}</option>`).join('')}</select></label><div class="settings-section-heading"><h3>Choose per game</h3><p id="duplicate-count"></p></div><div id="duplicate-games-list"></div></section>`;
document.querySelector('.settings-scroll').append(duplicatePage);
for(const select of duplicatePage.querySelectorAll('select'))bindLibraryChoice(select);
document.querySelector('[data-settings-page="services"]').insertAdjacentHTML('beforeend',`<section class="settings-section"><button class="settings-link focusable" type="button" data-action="console-settings-open" data-page="duplicates"><span>Duplicate games<small>Choose a preferred copy when a game is in more than one library</small></span><b>›</b></button></section>`);

const familySection=document.createElement('div');familySection.className='steam-family-connection';
document.querySelector('#library-collection').insertAdjacentHTML('beforeend','<option value="family-shared">Family shared</option>');
familySection.innerHTML='<div class="settings-section-heading"><h3>Steam Family</h3><p>Include games shared by your Steam Family, even when they are not installed.</p></div><p id="steam-family-status" class="connection-detail" role="status">Connect through Steam to read your shared games.</p><label class="toggle-row"><span><strong>Include Family shared games</strong><small>Uses Steam sign-in. No Web API key needed. Steam still manages sharing availability.</small></span><input id="steam-family-toggle" class="focusable" type="checkbox" /></label><div class="settings-data-buttons"><button class="primary focusable" type="button" data-action="steam-family-connect">Connect Steam Family</button><button class="secondary focusable" type="button" data-action="steam-family-disconnect" hidden>Disconnect Family library</button></div>';
document.querySelector('#settings-steam-status').closest('.library-connection-card').append(familySection);
document.querySelector('#show-uninstalled-toggle').closest('label').querySelector('strong').textContent='Include uninstalled owned games';
async function refreshSteamFamily() {
  try {
    const result=await window.launcher.getSteamFamilyStatus();
    const saved=/^cached|^ready$|^no-family$/.test(result.status);
    const messages={ 'not-connected':'Connect through Steam to include your shared games.', 'no-family':'This Steam account is not in a Steam Family. Join a family in Steam to share games.',
      'account-mismatch':'Connect using the same Steam account as your desktop Steam client.',
      'cached-account-mismatch':'The Steam web account changed. Reconnect using your desktop Steam account.',
      'sign-in-required':'Sign in to Steam to connect your Family library.' };
    document.querySelector('#steam-family-status').textContent=messages[result.status] || (saved?`${result.count} shared game${result.count===1?'':'s'} in your Family library${result.at?` · synced ${new Date(result.at).toLocaleDateString()}`:''}.${/sign-in-required|unavailable/.test(result.status)?' Saved games are available. Reconnect to refresh.':''}`:'Could not refresh Steam Family. Reconnect to try again.');
    document.querySelector('#steam-family-toggle').checked=result.enabled!==false;
    familySection.querySelector('[data-action="steam-family-connect"]').textContent=saved?'Refresh Steam Family':'Connect Steam Family';
    familySection.querySelector('[data-action="steam-family-disconnect"]').hidden=!saved;
    applyLibraryConnectionStatus('steam-family');
    refreshFocusables();
  } catch { document.querySelector('#steam-family-status').textContent='Could not check Steam Family. Try again when online.'; }
}
async function steamFamilyAction(action,button) {
  button.disabled=true;
  try {
    if(action==='steam-family-connect') {
      setLibraryConnectionStatus({provider:'steam-family',phase:'waiting',message:'Opening Steam Family sign-in…'});
      const result=await window.launcher.connectSteamFamily();
      setLibraryConnectionStatus({provider:'steam-family',phase:'connected',message:result.status==='no-family'?'Steam connected. This account is not in a Steam Family.':`Steam Family connected. ${result.count} shared games found.`});
      showToast(result.status==='no-family'?'This account is not in a Steam Family.':`${result.count} Family shared games found`);
    } else {await window.launcher.disconnectSteamFamily();libraryConnectionStates.delete('steam-family');showToast('Steam Family library disconnected');}
    await refreshSteamFamily();
    applyLibraryConnectionStatus('steam-family');
    scanLibrary(false,false,true);
  } catch(error){setLibraryConnectionStatus({provider:'steam-family',phase:'error',message:error.message || 'Could not connect Steam Family'});}
  finally {button.disabled=false;refreshFocusables();}
}
