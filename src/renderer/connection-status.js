const libraryConnectionStates = new Map();
function setLibraryConnectionStatus(data) {
  libraryConnectionStates.set(data.provider, data);
  applyLibraryConnectionStatus(data.provider);
  if (['connected', 'error'].includes(data.phase)) showToast(data.message);
}
function applyLibraryConnectionStatus(provider) {
  const data = libraryConnectionStates.get(provider);
  if (!data) return;
  const busy = ['waiting', 'loading', 'authorizing'].includes(data.phase);
  const root = provider === 'steam-family' ? document.querySelector('.steam-family-connection') : document.querySelector(`[data-account-provider="${provider}"]`);
  if (!root) return;
  const detail = root.querySelector(provider === 'steam-family' ? '#steam-family-status' : '[data-account-status]');
  if (detail) { detail.textContent = data.message; detail.setAttribute('role', 'status'); detail.setAttribute('aria-live', 'polite'); }
  const badge = root.querySelector('[data-account-badge]');
  if (badge) { badge.textContent = busy ? data.phase === 'waiting' ? 'Sign in' : 'Reading games…' : data.phase === 'connected' ? 'Connected' : 'Needs attention'; badge.classList.toggle('account-ready', data.phase === 'connected'); }
  for (const button of root.querySelectorAll('button:not([data-connect-cancel])')) button.disabled = busy;
  let cancel = root.querySelector('[data-connect-cancel]');
  if (!cancel) { cancel = document.createElement('button');cancel.type='button';cancel.className='secondary focusable';cancel.dataset.connectCancel=provider;cancel.textContent='Cancel connection';root.querySelector('.settings-data-buttons').append(cancel); }
  cancel.hidden = !busy;
  root.setAttribute('aria-busy', String(busy));
  refreshFocusables();
}
window.launcher.onConnectionProgress(data => {
  setLibraryConnectionStatus(data);
});
document.addEventListener('click', event => {
  const button = event.target.closest('[data-connect-cancel]');
  if (!button) return;
  if (button.dataset.connectCancel === 'steam-family') window.launcher.cancelSteamFamilyConnect();
  else window.launcher.cancelLibraryConnect();
});
