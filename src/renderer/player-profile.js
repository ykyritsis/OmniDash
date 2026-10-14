let steamPlayerIdentity = null;
let scoreSyncing = false;
let scoreRefreshTimer;
let identityRequest = 0;
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
  const value = result.checked ? result.points.toLocaleString() : 'Not yet';
  const header = document.querySelector('#dashboard-player-status');
  header.innerHTML = `<span class="preview-score-mark" aria-hidden="true">G</span> ${value}<span class="preview-score-caption">PC Gamerscore</span>`;
  header.title = `PC Gamerscore · ${result.checked} tracked Steam games verified`;
  document.querySelector('#profile-score-value').textContent = value;
  document.querySelector('#profile-score-coverage').textContent = `${result.unlocked || 0} verified unlocks · ${result.completed || 0} completed games · Level ${result.level || 1}${result.legacyGames ? ` · Update to convert ${result.legacyGames} previous score records` : ''}`;
  const button = document.querySelector('#profile-score-sync');
  button.disabled = scoreSyncing;
  button.textContent = scoreSyncing ? 'Updating…' : result.canSync ? 'Update Gamerscore' : 'Link Steam';
  button.dataset.canSync=String(!!result.canSync);
  if(typeof renderPcScoreDetail==='function')renderPcScoreDetail(result);
  if (result.status === 'unavailable') document.querySelector('#profile-score-coverage').textContent += ' · Some stats are private or unavailable. Try again later.';
  if (result.status === 'paused') document.querySelector('#profile-score-coverage').textContent += ' · Sync paused while the launcher is inactive.';
}
function scheduleScoreRefresh() {
  clearTimeout(scoreRefreshTimer);
  scoreRefreshTimer = setTimeout(() => window.launcher.getPlayerScore().then(renderPlayerScore).catch(() => {}), 350);
}
async function syncPlayerScore() {
  if (scoreSyncing) return;
  if(document.querySelector('#profile-score-sync').dataset.canSync==='false'){avatarDialog.close();await openLibraryConnection('steam');return;}
  scoreSyncing = true;
  let result;
  try {
    renderPlayerScore(await window.launcher.getPlayerScore());
    do {
      result = await window.launcher.getPlayerScore(true);
      renderPlayerScore(result);
      if (!result.remaining || result.status !== 'ready') break;
    } while (!document.hidden && avatarDialog.open && !state.activeGameSession);
  } catch { showToast('Steam progress is unavailable. Your saved score is unchanged.'); }
  finally {
    scoreSyncing = false;
    if (result) renderPlayerScore(result); else scheduleScoreRefresh();
    refreshFocusables();
  }
}
