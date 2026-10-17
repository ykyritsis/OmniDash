// Power options in the console's style: Fluent icons in coloured circles, one aligned list, a proper close
// button and a coloured confirm button. The markup and actions stay the ones app.js already handles.
(() => {
  const dialog = document.querySelector('#power-dialog');
  if (!dialog || typeof gIcon !== 'function') return;
  const extra = {
    weather_moon: '<path d="M20.03 17a10 10 0 0 1-16.9.68.75.75 0 0 1 .36-1.13c3.77-1.35 5.79-2.91 6.96-5.15 1.23-2.35 1.55-4.93.69-8.46A.75.75 0 0 1 11.9 2 10 10 0 0 1 20.03 17Zm-8.25-4.9c-1.25 2.39-3.31 4.1-6.82 5.5a8.49 8.49 0 0 0 13.77-1.35 8.5 8.5 0 0 0-5.9-12.63c.64 3.39.22 6.05-1.05 8.48Z"/>',
    save: '<path d="M3 5.75A2.75 2.75 0 0 1 5.75 3h9.96c.87 0 1.7.34 2.3.95L20.05 6c.6.6.95 1.43.95 2.3v9.96A2.75 2.75 0 0 1 18.25 21H5.75A2.75 2.75 0 0 1 3 18.25V5.75ZM5.75 4.5c-.69 0-1.25.56-1.25 1.25v12.5c0 .69.56 1.25 1.25 1.25H6v-5.25C6 13.01 7 12 8.25 12h7.5c1.24 0 2.25 1 2.25 2.25v5.25h.25c.69 0 1.25-.56 1.25-1.25V8.29c0-.47-.18-.91-.51-1.24L16.95 5c-.26-.26-.6-.43-.95-.49v2.73c0 1.24-1 2.25-2.25 2.25h-4.5C8.01 9.5 7 8.5 7 7.25V4.5H5.75Zm10.75 15v-5.25a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0-.75.75v5.25h9Zm-8-15v2.75c0 .41.34.75.75.75h4.5c.41 0 .75-.34.75-.75V4.5h-6Z"/>',
    sign_out: '<path d="M8.5 11.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM12 4.35V11h7.44l-1.72-1.72a.75.75 0 0 1-.07-.98l.07-.08a.75.75 0 0 1 .98-.07l.08.07 3 3c.26.26.29.68.07.97l-.07.09-3 3a.75.75 0 0 1-1.13-.97l.07-.09 1.71-1.72H12v6.75c0 .47-.42.82-.88.74l-8.5-1.5a.75.75 0 0 1-.62-.74v-12c0-.37.27-.68.63-.74l8.5-1.4c.46-.07.87.28.87.74Zm-1.5.89-7 1.15v10.73l7 1.24V5.24ZM13 18.5h.87a.75.75 0 0 0 .65-.75l-.01-4.25H13v5Zm0-8.5V5h.75c.37 0 .69.28.74.65v.1L14.5 10H13Z"/>'
  };
  const svg = name => extra[name]
    ? `<svg class="g-glyph" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${extra[name]}</svg>`
    : gIcon(name);
  const icons = { sleep: 'weather_moon', hibernate: 'save', restart: 'refresh', shutdown: 'power', exit: 'sign_out' };
  dialog.classList.add('g-power');
  for (const choice of dialog.querySelectorAll('.power-choice')) {
    const icon = choice.querySelector('.power-choice-icon');
    if (icon) icon.innerHTML = svg(icons[choice.dataset.power] || 'power');
    const chevron = choice.querySelector('b');
    if (chevron) chevron.innerHTML = gIcon('chevronRight');
  }
  const close = dialog.querySelector('.power-close');
  if (close) close.innerHTML = gIcon('close');
  const mark = dialog.querySelector('.power-confirm-mark');
  if (mark) mark.innerHTML = gIcon('power');
  for (const button of dialog.querySelectorAll('.power-confirm-actions button')) button.classList.add('g-control-button');
  // The confirm screen's mark follows the action being confirmed.
  const title = dialog.querySelector('#power-confirm-title');
  if (title && mark) new MutationObserver(() => {
    const action = (typeof selectedPowerAction === 'string' && selectedPowerAction) || 'shutdown';
    mark.innerHTML = svg(icons[action] || 'power');
  }).observe(title, { childList: true, characterData: true, subtree: true });
})();
