let steamPlayerIdentity = null;
let scoreSyncing = false;
let scoreRefreshTimer;
let identityRequest = 0;
let scoreBackgroundTimer;
let playerScore = null;
function scoreValue() { return playerScore?.checked ? playerScore.points.toLocaleString() : '—'; }
function scoreStatus() {
  if(!playerScore)return 'Loading saved Gamerscore…';
  if(!playerScore.canSync)return playerScore.checked?'Saved Gamerscore · Link Steam to update':'Link Steam to see your Gamerscore';
  if(scoreSyncing)return playerScore.checked?'Updating achievements…':'Calculating your Gamerscore…';
  if(!playerScore.checked)return playerScore.status==='unavailable'?'Steam achievements unavailable':'Waiting for Steam achievements';
  if(playerScore.status==='unavailable')return 'Saved score · Steam is unavailable';
  return `${playerScore.unlocked||0} achievements · Level ${playerScore.level||1}`;
}
async function refreshPlayerIdentity() {
  const request = ++identityRequest;
  try {
    const result = await window.launcher.getPlayerIdentity();
    if (request !== identityRequest) return;
    steamPlayerIdentity = result;
    state.profileNameMode = result.nameMode;
    if (!avatarDialog.open) {
      selectedAvatarId = result.avatarId || selectedAvatarId;
      if (result.nameMode === 'steam' && result.name) state.displayName = result.name;
      renderAvatarChoices();
      document.querySelector('#profile-button').title = state.displayName;
    }
    const onboardName = document.querySelector('#onboard-name');
    if (onboardingDialog.open && !onboardName.value && result.name) onboardName.value = result.name;
    document.querySelector('#profile-steam-identity-note').textContent = result.available ? `Linked to ${result.name || 'your Steam profile'}. No separate launcher login.` : 'Steam name and photo appear when a local or linked profile is available.';
  } catch { /* Existing presets and custom identity remain usable offline. */ }
}
function prepareProfileIdentity() {
  const toggle = document.querySelector('#profile-steam-name');
  toggle.checked = state.profileNameMode !== 'custom';
  document.querySelector('#profile-name-input').disabled = toggle.checked;
}
document.querySelector('#profile-steam-name').addEventListener('change', event => {
  const input = document.querySelector('#profile-name-input');
  input.disabled = event.target.checked;
  if (event.target.checked && steamPlayerIdentity?.name) input.value = steamPlayerIdentity.name;
  document.querySelector('#profile-name-heading').textContent = input.value || 'Player';
  refreshFocusables();
});
function renderPlayerScore(result) {
  playerScore=result;
  const value = scoreValue();
  const header = document.querySelector('#dashboard-player-status');
  header.innerHTML = `<span class="preview-score-mark" aria-hidden="true">G</span> ${value}<span class="preview-score-caption">PC Gamerscore</span>`;
  header.title = `PC Gamerscore · ${result.checked} tracked Steam games verified`;
  document.querySelector('#profile-score-value').textContent = value;
  document.querySelector('#profile-score-coverage').textContent = `${result.unlocked || 0} verified unlocks · ${result.completed || 0} completed games · Level ${result.level || 1}${result.legacyGames ? ` · Update to convert ${result.legacyGames} previous score records` : ''}`;
  const button = document.querySelector('#profile-score-sync');
  button.disabled = false;
  button.hidden = Boolean(result.canSync);
  button.textContent = 'Link Steam';
  button.dataset.canSync=String(!!result.canSync);
  if(typeof renderPcScoreDetail==='function')renderPcScoreDetail(result);
  if (result.status === 'unavailable') document.querySelector('#profile-score-coverage').textContent += ' · Some stats are private or unavailable. Try again later.';
  if (result.status === 'paused') document.querySelector('#profile-score-coverage').textContent += ' · Sync paused while the launcher is inactive.';
  document.querySelector('#profile-score-status').textContent=!scoreSyncing && result.checked && result.canSync && result.status!=='unavailable'?'Updates automatically while you browse.':scoreStatus();
  window.dispatchEvent(new Event('player-score-updated'));
}
function scheduleScoreRefresh() {
  clearTimeout(scoreRefreshTimer);
  scoreRefreshTimer = setTimeout(() => window.launcher.getPlayerScore().then(result=>{renderPlayerScore(result);scheduleBackgroundScore(2000);}).catch(() => {}), 350);
}
function scheduleBackgroundScore(delay=30000) {
  clearTimeout(scoreBackgroundTimer);
  scoreBackgroundTimer=setTimeout(()=>syncPlayerScore(true),delay);
}
function canRefreshScore() { return !document.hidden && document.hasFocus() && !state.activeGameSession && !window.remotePlayUI?.active && navigator.onLine; }
async function syncPlayerScore(background=false) {
  if (scoreSyncing) return;
  if(background && (!playerScore?.canSync || !canRefreshScore())){if(playerScore?.canSync)scheduleBackgroundScore();return;}
  if(document.querySelector('#profile-score-sync').dataset.canSync==='false'){if(!background){avatarDialog.close();await openLibraryConnection('steam');}return;}
  scoreSyncing = true;
  let result;
  try {
    renderPlayerScore(await window.launcher.getPlayerScore());
    result = await window.launcher.getPlayerScore(true);
    renderPlayerScore(result);
  } catch { if(!background)showToast('Steam progress is unavailable. Your saved score is unchanged.'); }
  finally {
    scoreSyncing = false;
    if (result) renderPlayerScore(result); else scheduleScoreRefresh();
    refreshFocusables();
    // Continue bounded batches without requiring the profile menu to stay open.
    // Pause during play; fresh records are cached and never fetched each time.
    scheduleBackgroundScore(result?.status==='ready' && result.remaining?1500:result?.status==='paused'?30000:300000);
  }
}
window.addEventListener('focus',()=>scheduleBackgroundScore(2000));
window.addEventListener('online',()=>scheduleScoreRefresh());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)scheduleBackgroundScore(2000);});
