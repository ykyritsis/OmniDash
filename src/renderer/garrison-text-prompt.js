// One small text prompt for settings that need typing (the Steam Web API key, the SteamGridDB key), so they can
// be changed from every theme's Settings without a trip into a separate launcher dialog. A controller press on
// the field opens the on-screen keyboard; Enter saves, Escape or B cancels.
//
//   const value = await gPromptText({ title, body, value, placeholder, secret, help })   // null when cancelled
(() => {
  'use strict';
  const dialog = document.createElement('dialog');
  dialog.id = 'g-text-prompt';
  dialog.className = 'g-text-prompt';
  dialog.innerHTML = `<form method="dialog">
    <h2></h2><p class="g-tp-body"></p>
    <input class="focusable" type="text" autocomplete="off" spellcheck="false" />
    <p class="g-tp-help"></p>
    <div class="g-tp-actions"><button class="secondary focusable" type="button" value="clear">Remove</button><span></span><button class="secondary focusable" type="button" value="cancel">Cancel</button><button class="primary focusable" type="submit" value="save">Save</button></div>
  </form>`;
  document.body.append(dialog);
  const input = dialog.querySelector('input');
  let resolve = null;
  const finish = value => { const done = resolve; resolve = null; if (dialog.open) dialog.close(); done?.(value); };
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    event.preventDefault();
    if (button.value === 'save') finish(input.value.trim());
    else if (button.value === 'clear') finish('');
    else finish(null);
  });
  dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); finish(input.value.trim()); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
  dialog.addEventListener('close', () => { if (resolve) finish(null); try { refreshFocusables(); } catch { /* Not ready. */ } });
  input.addEventListener('click', () => { if (typeof openNativeKeyboard === 'function' && state?.controllerClick) openNativeKeyboard(input); });

  window.gPromptText = ({ title = '', body = '', value = '', placeholder = '', secret = false, help = '' } = {}) => {
    finish(null);
    dialog.querySelector('h2').textContent = title;
    dialog.querySelector('.g-tp-body').textContent = body;
    dialog.querySelector('.g-tp-help').textContent = help;
    dialog.querySelector('[value="clear"]').hidden = !value;
    input.type = secret ? 'password' : 'text';
    input.value = value;
    input.placeholder = placeholder;
    dialog.showModal();
    try { refreshFocusables(); setFocusedElement(input); } catch { input.focus(); }
    return new Promise(done => { resolve = done; });
  };
})();
