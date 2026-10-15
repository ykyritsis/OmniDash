// Steam launch modes and requests share the launch screen and controller focus scope.
(() => {
  const dialog = document.createElement('dialog');
  dialog.id = 'steam-game-launch-dialog';
  dialog.setAttribute('aria-labelledby', 'steam-game-launch-title');
  dialog.innerHTML = '<header><small>STEAM</small><h2 id="steam-game-launch-title"></h2></header><div class="steam-launch-body"></div><div class="steam-license-scroll" hidden><button class="secondary focusable" data-action="steam-launch-read-up">Read previous</button><button class="secondary focusable" data-action="steam-launch-read-down">Read more</button></div><div class="steam-launch-choices"></div>';
  document.body.append(dialog);
  const title = dialog.querySelector('h2'), body = dialog.querySelector('.steam-launch-body');
  const choices = dialog.querySelector('.steam-launch-choices');
  const detail = document.createElement('p'); detail.id = 'steam-launch-detail'; detail.hidden = true;
  const progress = document.createElement('progress'); progress.id = 'steam-launch-progress'; progress.max = 100; progress.hidden = true;
  document.querySelector('#launch-status').after(detail, progress);
  // Keep Cancel with the status, so it cannot overlap the logo or setup message.
  const cancelButton = document.querySelector('.g-launch-cancel');
  if (cancelButton) document.querySelector('.g-launch-status').append(cancelButton);
  document.querySelector('.g-launch-cancel')?.addEventListener('click', event => { event.stopPropagation(); cancelLaunchWait(); });
  let resolveChoice = null, options = [], currentPrompt = '', responding = '';
  function finish(value) {
    const resolve = resolveChoice; resolveChoice = null;
    if (dialog.open) dialog.close();
    resolve?.(value);
  }
  function choose(prompt) {
    finish(null);
    title.textContent = prompt.title;
    body.textContent = prompt.body || '';
    body.classList.toggle('license', Boolean(prompt.license));
    dialog.querySelector('.steam-license-scroll').hidden = !prompt.license;
    options = prompt.options;
    choices.replaceChildren(...options.map((option, index) => {
      const button = document.createElement('button');
      button.className = 'secondary focusable'; button.type = 'button';
      button.dataset.action = 'steam-launch-choice'; button.dataset.choice = index;
      const label = document.createElement('span'); label.textContent = option.label;
      const arrow = document.createElement('span'); arrow.className = 'steam-launch-choice-arrow'; arrow.textContent = '›'; arrow.setAttribute('aria-hidden', 'true');
      button.append(label, arrow);
      return button;
    }));
    dialog.showModal(); body.scrollTop = 0;
    setFocusedElement(choices.firstElementChild, { scroll: false });
    return new Promise(resolve => { resolveChoice = resolve; });
  }
  function action(name, source) {
    if (name === 'steam-launch-choice') { finish(options[Number(source.dataset.choice)]?.value ?? null); return true; }
    if (name === 'steam-launch-read-up' || name === 'steam-launch-read-down') { body.scrollBy({ top: body.clientHeight * .85 * (name.endsWith('up') ? -1 : 1), behavior: 'smooth' }); return true; }
    return false;
  }
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (button) { event.stopPropagation(); action(button.dataset.action, button); }
  });
  const baseAction = performAction;
  performAction = async function (name, source) { if (action(name, source)) return; return baseAction(name, source); };
  dialog.addEventListener('cancel', event => { event.preventDefault(); cancelLaunchWait(); });
  // Handle programmatic Back from shared navigation as well as the native dialog close.
  dialog.addEventListener('close', () => { if (resolveChoice && !dialog.open) finish(null); });
  window.steamLaunchUI = {
    choose, isOpen: () => dialog.open,
    reset() { currentPrompt = ''; responding = ''; finish(null); detail.hidden = true; progress.hidden = true; }
  };
  window.launcher.onLaunchStatus(async event => {
    if (launchOverlay.hidden || launchOverlay.dataset.gameId !== event.gameId || launchOverlay.dataset.cancelled) return;
    detail.textContent = event.detail || ''; detail.hidden = !event.detail;
    progress.hidden = !Number.isFinite(event.progress);
    if (!progress.hidden) progress.value = event.progress;
    const prompt = event.prompt;
    if (!prompt) { if (currentPrompt) { currentPrompt = ''; finish(null); } return; }
    if (prompt.id === responding) return;
    if (prompt.id === currentPrompt) { body.textContent = prompt.body; return; }
    currentPrompt = prompt.id;
    const value = await choose(prompt);
    if (currentPrompt !== prompt.id || launchOverlay.dataset.cancelled || launchOverlay.dataset.gameId !== event.gameId) return;
    responding = prompt.id; currentPrompt = '';
    try { await window.launcher.respondGameLaunch(event.gameId, prompt.id, value ?? 'cancel'); }
    catch (error) { responding = ''; showToast(error.message || 'Could not answer Steam'); }
  });
})();
