// Automatic checks stay quiet until an update is available. The centred native modal
// shares the app's keyboard/controller focus rules and can continue in the background.
(function buildUpdates() {
  const dialog = document.createElement('dialog');
  dialog.id = 'g-update-dialog';
  dialog.className = 'g-update-dialog';
  dialog.setAttribute('aria-labelledby', 'g-update-title');
  dialog.setAttribute('aria-describedby', 'g-update-description');
  dialog.innerHTML = `<div class="g-update-heading"><span class="g-update-icon" aria-hidden="true">${gIcon('refresh')}</span><div><small>APP UPDATE</small><h2 id="g-update-title">Update ready</h2></div></div>
    <p id="g-update-description"></p>
    <div class="g-update-progress" hidden><div><span>Downloading update</span><span class="g-update-percent"></span></div><span class="g-update-bar" role="progressbar" aria-label="Update download" aria-valuemin="0" aria-valuemax="100"><i></i></span></div>
    <p class="g-update-error" role="alert" hidden></p>
    <div class="g-update-actions"><button class="g-update-primary focusable" type="button" data-action="g-update-install">Restart to update</button><button class="g-update-secondary focusable" type="button" data-action="g-update-later">Later</button></div>
    <footer class="g-update-hints" aria-hidden="true"><span>Enter / A · Select</span><span>Esc / B · Later</span></footer>`;
  document.body.append(dialog);
  const title = dialog.querySelector('h2'), description = dialog.querySelector('#g-update-description');
  const primary = dialog.querySelector('.g-update-primary'), secondary = dialog.querySelector('.g-update-secondary');
  const progress = dialog.querySelector('.g-update-progress'), bar = dialog.querySelector('.g-update-bar');
  const errorText = dialog.querySelector('.g-update-error');
  let last = null, opener = null, requested = false, scheduled = false, installing = false;
  const dismissed = new Set();
  const version = () => last?.readyVersion || last?.version || '';
  const available = () => Boolean(last && (last.ready || ['downloading', 'installing'].includes(last.state)));

  function tryOpen() {
    scheduled = false;
    if (dialog.open || !available() || (!requested && dismissed.has(version())) || document.hidden) return;
    const open = [...document.querySelectorAll('dialog[open]')];
    if (open.some(item => !requested || item !== settingsDialog)) return;
    if (!document.querySelector('#startup-screen')?.hidden || !launchOverlay.hidden || !steamShopSurface.hidden || state.activeGameSession) return;
    opener = document.activeElement;
    requested = false;
    dialog.showModal();
    refreshFocusables();
    setFocusedElement(primary.hidden || primary.disabled ? secondary : primary, { scroll: false });
  }
  function queueOpen() {
    if (scheduled || dialog.open || !available() || (!requested && dismissed.has(version()))) return;
    scheduled = true;
    queueMicrotask(tryOpen);
  }
  function renderDialog(status) {
    const downloading = status.state === 'downloading', restarting = status.state === 'installing';
    const ready = status.ready && !downloading && !restarting;
    const retry = status.state === 'error' && !ready;
    title.textContent = restarting ? 'Restarting to update…' : ready ? 'Update ready' : retry ? 'Update interrupted' : 'An update is available';
    description.textContent = ready ? `Xbox Preview UI ${status.readyVersion} is ready. Restart to install it, or choose Later to keep using the app. It also installs when you close the launcher.`
      : restarting ? 'The launcher will reopen after the update is installed.'
      : retry ? 'Try downloading the update again, or continue using the app.'
      : `Xbox Preview UI ${status.version} is downloading. You can keep using the app while it finishes.`;
    progress.hidden = !downloading;
    const percent = Math.round(Math.max(0, Math.min(1, Number(status.progress) || 0)) * 100);
    dialog.querySelector('.g-update-percent').textContent = `${percent}%`;
    bar.setAttribute('aria-valuenow', String(percent));
    bar.firstElementChild.style.width = `${percent}%`;
    primary.hidden = !ready && !retry;
    primary.disabled = restarting || installing;
    primary.textContent = retry ? 'Try again' : 'Restart to update';
    primary.dataset.action = retry ? 'g-update-check' : 'g-update-install';
    secondary.disabled = restarting || installing;
    secondary.textContent = downloading ? 'Continue in background' : 'Later';
    errorText.hidden = !status.error;
    errorText.textContent = status.error || '';
    if (dialog.open) refreshFocusables();
    queueOpen();
  }
  function renderSettings(status) {
    const row = document.querySelector('#g-update-check');
    if (!row) return;
    const text = {
      checking: 'Checking for updates…', downloading: `Downloading ${status.version}…`, ready: `Version ${status.readyVersion} is ready to install`,
      installing: 'Restarting to install…', error: status.error || 'Could not check for updates.', current: 'You have the latest version.'
    }[status.state] || (status.checkedAt ? 'You have the latest version.' : 'Updates are checked automatically on launch.');
    row.querySelector('small').textContent = `${text} · Version ${status.currentVersion}`;
  }
  function render(status) {
    last = status;
    renderDialog(status);
    renderSettings(status);
  }
  // Mark dismissal before the open-attribute observer can queue the same version again.
  dialog.addEventListener('beforetoggle', event => {
    if (event.newState === 'closed') { dismissed.add(version()); requested = false; }
  });
  dialog.addEventListener('close', () => {
    refreshFocusables();
    const modal = topmostOpenDialog();
    const target = opener?.isConnected && opener.offsetParent !== null && (!modal || modal.contains(opener)) ? opener : state.focusables[0];
    if (target) setFocusedElement(target, { scroll: false });
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
  // Retry a deferred prompt when onboarding, another modal or a launch screen closes.
  const observer = new MutationObserver(queueOpen);
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'open'] });
  document.addEventListener('close', queueOpen, true);
  document.addEventListener('visibilitychange', queueOpen);
  window.addEventListener('focus', queueOpen);

  const experience = document.querySelector('[data-settings-page="g-account"]') || document.querySelector('[data-settings-page="experience"]');
  if (experience) experience.insertAdjacentHTML('beforeend', `<section class="g-setting-group" id="g-updates"><h3>Updates</h3><div class="g-setting-list"><button class="g-setting-row focusable" type="button" id="g-update-check" data-action="g-update-check"><span><strong>Check for updates</strong><small>Updates are checked automatically on launch.</small></span>${gIcon('refresh', 'g-trailing')}</button></div></section>`);

  const perform = performAction;
  performAction = async function (action, source) {
    if (action === 'g-update-install') {
      if (installing) return;
      installing = true;
      primary.disabled = true;
      secondary.disabled = true;
      try { await window.launcher.installUpdate(); }
      catch (error) {
        installing = false;
        renderDialog(last);
        errorText.textContent = error.message || 'Could not restart for the update';
        errorText.hidden = false;
        setFocusedElement(primary, { scroll: false });
      }
      return;
    }
    if (action === 'g-update-later') { dialog.close(); return; }
    if (action === 'g-update-check') {
      requested = true;
      dismissed.delete(version());
      try {
        const status = await window.launcher.checkForUpdates();
        render(status);
        if (status.state === 'current' && !status.ready) { requested = false; if (dialog.open) dialog.close(); showToast('You have the latest version'); }
        else if (status.state === 'error' && !dialog.open) { requested = false; showToast(status.error); }
      } catch (error) { requested = false; showToast(error.message || 'Could not check for updates'); }
      return;
    }
    return perform(action, source);
  };
  window.launcher.onUpdateStatus(render);
  window.launcher.getUpdateStatus().then(render).catch(() => {});
})();
