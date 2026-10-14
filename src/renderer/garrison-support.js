// Support: copy diagnostics, export and restore settings, a safe-mode notice, and a Cancel while launching.
(function buildSupport() {
  const experience = document.querySelector('[data-settings-page="g-account"]') || document.querySelector('[data-settings-page="experience"]');
  if (experience) {
    experience.insertAdjacentHTML('beforeend', `<section class="g-setting-group" id="g-support"><h3>Support &amp; backup</h3><div class="g-setting-list">
      <button class="g-setting-row focusable" type="button" data-action="g-support-copy"><span><strong>Copy diagnostics</strong><small>Version, start-up state, the last launch and recent activity. Keys and your user folder are removed.</small></span>${gIcon('open', 'g-trailing')}</button>
      <button class="g-setting-row focusable" type="button" data-action="g-support-export"><span><strong>Export settings</strong><small>Hidden games, Favorites, collections, artwork choices and preferences, in one file. API keys are left out unless you include them.</small></span>${gIcon('download', 'g-trailing')}</button>
      <button class="g-setting-row focusable" type="button" data-action="g-support-import"><span><strong>Restore settings</strong><small>Load a backup file. Restart the launcher afterwards to apply every setting.</small></span>${gIcon('download', 'g-trailing')}</button>
    </div></section>`);
  }
  const overlayCopy = document.querySelector('#launch-overlay .launch-copy');
  if (overlayCopy) overlayCopy.insertAdjacentHTML('beforeend', '<button class="g-launch-cancel focusable" type="button" data-action="g-launch-cancel">Cancel</button>');

  // Safe mode: the launcher says so once, and background work waits for a normal start.
  window.gSafeMode = false;
  window.launcher.getSafeMode().then(safe => {
    if (!safe) return;
    window.gSafeMode = true;
    document.body.classList.add('g-safe-mode');
    showToast('Started in safe mode after repeated start-up problems. Background refresh is paused until a normal start.');
  }).catch(() => {});

  const scanBase = scanLibrary;
  scanLibrary = function (refreshArt = false, fullScreenImport = false, backgroundRefresh = false) {
    if (window.gSafeMode && backgroundRefresh && state.games.length) return Promise.resolve();
    return scanBase(refreshArt, fullScreenImport, backgroundRefresh);
  };
  const refreshFriendsBase = refreshGarrisonFriends;
  refreshGarrisonFriends = function (force = false) {
    if (window.gSafeMode && !force) return Promise.resolve();
    return refreshFriendsBase(force);
  };

  const perform = performAction;
  performAction = async function (action, source) {
    if (action === 'g-launch-cancel') { cancelLaunchWait(); return; }
    if (action === 'g-support-copy') {
      try { await window.launcher.copyDiagnostics(); showToast('Diagnostics copied. Paste them into your bug report.'); }
      catch (error) { showToast(error.message || 'Could not copy diagnostics'); }
      return;
    }
    if (action === 'g-support-export') {
      try {
        const result = await window.launcher.exportSettings();
        if (result.status === 'saved') showToast(`Saved ${result.file}${result.includesKeys ? ' · includes your API keys' : ''}`);
      } catch (error) { showToast(error.message || 'Could not export settings'); }
      return;
    }
    if (action === 'g-support-import') {
      try {
        const result = await window.launcher.importSettings();
        if (result.status === 'restored') { showToast(`Settings restored from ${result.file}. Restart to apply everything.`); scanLibrary(false); }
      } catch (error) { showToast(error.message || 'That backup could not be restored'); }
      return;
    }
    return perform(action, source);
  };
})();
