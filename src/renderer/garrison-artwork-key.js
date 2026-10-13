// SteamGridDB key: shown plainly in Settings › Manage games › Artwork and offered (optional) during setup.
// It fills in artwork for games the Xbox, IGN and PlayStation stores don't have.
(function buildArtworkSettings() {
  const page = document.querySelector('[data-settings-page="services"]');
  const field = document.querySelector('#sgdb-key');
  if (!page || !field) return;
  page.insertAdjacentHTML('beforeend', `<section class="g-setting-group" id="g-artwork-key"><h3>Artwork</h3>
    <p class="g-setting-note">Artwork comes from the Xbox Store first, then IGN and PlayStation. A free SteamGridDB key fills in the games they don't have.</p>
    <div class="g-setting-list"><div class="g-setting-row g-key-row"><span><strong>SteamGridDB API key</strong><small id="g-sgdb-status"></small></span><span class="g-key-field"></span></div>
    <button class="g-setting-row focusable" type="button" data-action="g-sgdb-save"><span><strong>Save key and refresh artwork</strong><small>Missing artwork is looked up again in the background.</small></span></button>
    <button class="g-setting-row focusable" type="button" data-action="g-sgdb-get"><span><strong>Get a free key</strong><small>Sign in at steamgriddb.com › Preferences › API, then paste the key here.</small></span>${gIcon('open', 'g-trailing')}</button></div></section>`);
  const label = field.closest('label');
  field.classList.add('g-input');
  field.placeholder = 'Paste your key';
  page.querySelector('.g-key-field').append(field);
  if (label && !label.contains(field)) label.hidden = true;
  const status = () => { document.querySelector('#g-sgdb-status').textContent = field.value.trim() ? 'Key added' : 'Not added'; };
  field.addEventListener('input', status);
  window.launcher.getSettings().then(settings => { if (!field.value) field.value = settings.steamGridDbKey || ''; status(); }).catch(status);
})();
// A small key prompt for setup, using the launcher's own dialog style.
function gAskKey(initial = '') {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'g-flyout g-choice';
    dialog.innerHTML = `<header><h2>SteamGridDB key</h2></header><p>Optional. Fills in artwork for games other stores don't have. Get a free key at steamgriddb.com › Preferences › API.</p>
      <input class="g-input focusable" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your key" value="${escapeHtml(initial)}" aria-label="SteamGridDB API key" />
      <div class="g-choice-actions"><button class="g-onboard-primary focusable" type="button" data-choice="save">Save</button><button class="g-onboard-secondary focusable" type="button" data-choice="get">Get a key</button><button class="g-onboard-secondary focusable" type="button" data-choice="">Skip</button></div>`;
    document.body.append(dialog);
    const input = dialog.querySelector('input');
    const done = value => { dialog.close(); dialog.remove(); refreshFocusables(); resolve(value); };
    dialog.addEventListener('click', event => {
      const choice = event.target.closest('[data-choice]')?.dataset.choice;
      if (choice === 'get') { window.launcher.openSteamHelp('sgdbApiKey').catch(() => {}); return; }
      if (choice === 'save') done(input.value.trim());
      else if (choice === '') done(null);
    });
    input.addEventListener('keydown', event => { if (event.key === 'Enter') done(input.value.trim()); });
    dialog.addEventListener('cancel', () => done(null));
    dialog.showModal();
    refreshFocusables();
    setFocusedElement(input, { scroll: false });
  });
}
async function gSaveSgdbKey(key) {
  const clean = String(key || '').trim();
  if (clean && !/^[A-Za-z0-9_-]{16,80}$/.test(clean)) { showToast('That doesn’t look like a SteamGridDB key'); return false; }
  await window.launcher.saveSettings({ steamGridDbKey: clean });
  const field = document.querySelector('#sgdb-key');
  if (field) { field.value = clean; field.dispatchEvent(new Event('input')); }
  state.settingsOriginal.steamGridDbKey = clean;
  showToast(clean ? 'SteamGridDB key saved · finding missing artwork' : 'SteamGridDB key removed');
  if (clean) scanLibrary(false, false, true);
  return true;
}
// Setup: an optional tile under the launchers.
const gArtworkServices = gOnboardServicesMarkup;
gOnboardServicesMarkup = function () {
  const base = gArtworkServices();
  if (!gOnboard.sources) return base;
  const has = Boolean(document.querySelector('#sgdb-key')?.value.trim());
  return base + `<button class="g-onboard-service focusable${has ? ' linked' : ''}" type="button" data-action="g-onboard-sgdb"><span class="g-onboard-mark" aria-hidden="true">${gIcon('photo')}</span><span><strong>SteamGridDB</strong><small>${has ? 'Key added · extra artwork on' : 'Optional · artwork for games other stores miss'}</small></span>${has ? `<i class="g-onboard-check">${gIcon('check')}</i>` : '<b class="g-onboard-link">Add key</b>'}</button>`;
};
const gArtworkPerform = performAction;
performAction = async function (action, source) {
  if (action === 'g-sgdb-get') { window.launcher.openSteamHelp('sgdbApiKey').catch(() => {}); return; }
  if (action === 'g-sgdb-save') { await gSaveSgdbKey(document.querySelector('#sgdb-key')?.value); return; }
  if (action === 'g-onboard-sgdb') {
    const key = await gAskKey(document.querySelector('#sgdb-key')?.value || '');
    if (key !== null && await gSaveSgdbKey(key)) gRenderOnboardServices();
    setFocusedElement(onboardingDialog.querySelector('[data-action="g-onboard-sgdb"]'), { scroll: false });
    return;
  }
  return gArtworkPerform(action, source);
};
