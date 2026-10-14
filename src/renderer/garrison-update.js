// Updates, shown quietly: a small card appears only when a verified update is downloading or ready, with
// "Restart to update" (or it installs when you close the launcher). Settings › Experience has a manual check.
(function buildUpdates() {
  const card = document.createElement('div');
  card.id = 'g-update-card';
  card.className = 'g-update-card';
  card.hidden = true;
  card.setAttribute('role', 'status');
  document.body.append(card);
  let dismissed = '';
  let last = null;

  const label = status => {
    if (status.state === 'downloading') return `Downloading ${status.version} · ${Math.round((status.progress || 0) * 100)}%`;
    if (status.state === 'installing') return `Restarting to install ${status.readyVersion || status.version}…`;
    return `Xbox Preview UI ${status.readyVersion} is ready`;
  };
  function renderCard(status) {
    const showCard = (status.state === 'downloading' || status.state === 'installing' || (status.ready && status.readyVersion !== dismissed));
    card.hidden = !showCard;
    if (!showCard) { card.innerHTML = ''; return; }
    const ready = status.state === 'ready' || (status.ready && status.state !== 'downloading' && status.state !== 'installing');
    card.innerHTML = `<div class="g-update-copy"><strong>${escapeHtml(label(status))}</strong><small>${status.state === 'downloading' ? 'Keeps downloading while you play.' : 'It installs when you close the launcher, or now.'}</small>${status.state === 'downloading' ? `<span class="g-update-bar"><i style="width:${Math.round((status.progress || 0) * 100)}%"></i></span>` : ''}</div>
      ${ready ? `<div class="g-update-actions"><button class="g-update-primary focusable" type="button" data-action="g-update-install">Restart to update</button><button class="g-update-secondary focusable" type="button" data-action="g-update-later">Later</button></div>` : ''}`;
    refreshFocusables();
    if (ready && !card.contains(document.activeElement) && !topmostOpenDialog()) setFocusedElement(card.querySelector('.g-update-primary'), { scroll: false });
  }
  function renderSettings(status) {
    const row = document.querySelector('#g-update-check');
    if (!row) return;
    const text = {
      checking: 'Checking for updates…', downloading: `Downloading ${status.version}…`, ready: `Version ${status.readyVersion} is ready to install`,
      installing: 'Restarting to install…', error: status.error || 'Could not check for updates.', current: 'You have the latest version.'
    }[status.state] || (status.checkedAt ? 'You have the latest version.' : 'Updates are checked automatically.');
    row.querySelector('small').textContent = `${text} · Version ${status.currentVersion}`;
  }
  function render(status) {
    last = status;
    renderCard(status);
    renderSettings(status);
  }

  // Settings › Experience gets an Updates row with a manual check.
  const experience = document.querySelector('[data-settings-page="g-account"]') || document.querySelector('[data-settings-page="experience"]');
  if (experience) {
    experience.insertAdjacentHTML('beforeend', `<section class="g-setting-group" id="g-updates"><h3>Updates</h3><div class="g-setting-list"><button class="g-setting-row focusable" type="button" id="g-update-check" data-action="g-update-check"><span><strong>Check for updates</strong><small>Checking…</small></span>${gIcon('refresh', 'g-trailing')}</button></div></section>`);
  }

  const perform = performAction;
  performAction = async function (action, source) {
    if (action === 'g-update-install') {
      try { await window.launcher.installUpdate(); } catch (error) { showToast(error.message || 'Could not restart for the update'); }
      return;
    }
    if (action === 'g-update-later') {
      dismissed = last?.readyVersion || '';
      card.hidden = true;
      setFocusedElement(document.querySelector('#g-update-check') || document.querySelector('.focusable'), { scroll: false });
      return;
    }
    if (action === 'g-update-check') {
      const status = await window.launcher.checkForUpdates();
      render(status);
      if (status.state === 'current') showToast('You have the latest version');
      else if (status.state === 'error') showToast(status.error);
      return;
    }
    return perform(action, source);
  };

  window.launcher.onUpdateStatus(render);
  window.launcher.getUpdateStatus().then(render).catch(() => {});
})();
