// The console on-screen keyboard for the Series, One and 360 themes. Pressing A on a text field opens it in
// place of the Windows keyboard: a QWERTY board you move around with the controller, with numbers, symbols,
// shift, space, backspace and Done, and what you've typed shown above it. Typing goes straight into the field,
// so searches and forms update as you type. Helix keeps the Windows keyboard.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  if (typeof openNativeKeyboard !== 'function') return;
  const dialog = document.createElement('dialog');
  dialog.id = 'g-osk';
  dialog.setAttribute('aria-label', 'Keyboard');
  dialog.innerHTML = '<div class="g-osk-field"><span class="g-osk-text"></span><i class="g-osk-caret"></i></div><div class="g-osk-keys"></div><div class="g-osk-hints"><span><kbd>B</kbd>Done</span></div>';
  document.body.append(dialog);
  const LETTERS = ['1234567890', 'qwertyuiop', 'asdfghjkl\'', 'zxcvbnm,.?'];
  const SYMBOLS = ['!@#$%^&*()', '-_=+[]{};:', '/\\|<>~`"\'', '€£¥©®™°…·¿'];
  let target = null, shift = false, symbols = false;
  const textBox = dialog.querySelector('.g-osk-text');
  function render(focusKey) {
    const rows = symbols ? SYMBOLS : LETTERS;
    const key = (value, label = value, extra = '') => `<button class="g-osk-key focusable${extra}" type="button" data-key="${value.replaceAll('"', '&quot;')}">${label}</button>`;
    dialog.querySelector('.g-osk-keys').innerHTML = rows.map(row => `<div class="g-osk-row">${[...row].map(char => {
      const shown = shift && !symbols ? char.toUpperCase() : char;
      return key(shown, shown.replace('&', '&amp;').replace('<', '&lt;'));
    }).join('')}</div>`).join('')
      + `<div class="g-osk-row g-osk-actions">${key('shift', shift ? 'Shift ●' : 'Shift', ' wide')}${key('symbols', symbols ? 'abc' : '&amp;123', ' wide')}${key(' ', 'Space', ' space')}${key('back', 'Backspace', ' wide')}${key('done', 'Done', ' wide done')}</div>`;
    try { refreshFocusables(); } catch { /* Not ready. */ }
    const next = focusKey && dialog.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
    setFocusedElement?.(next || dialog.querySelector('.g-osk-key'), { scroll: false });
  }
  const show = () => { textBox.textContent = target?.type === 'password' ? '•'.repeat(target.value.length) : target?.value || ''; };
  function type(value) {
    if (!target) return;
    const max = target.maxLength > 0 ? target.maxLength : Infinity;
    if (value === 'back') target.value = target.value.slice(0, -1);
    else if (target.value.length < max) target.value += value;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    show();
  }
  function close() {
    if (!dialog.open) return;
    dialog.close();
    if (target) { target.dispatchEvent(new Event('change', { bubbles: true })); target.focus({ preventScroll: true }); try { setFocusedElement(target, { scroll: false }); } catch { /* Gone. */ } }
    target = null;
  }
  dialog.addEventListener('click', event => {
    const key = event.target.closest('[data-key]')?.dataset.key;
    if (key == null) return;
    event.stopPropagation();
    if (key === 'done') { close(); return; }
    if (key === 'shift') { shift = !shift; render('shift'); return; }
    if (key === 'symbols') { symbols = !symbols; shift = false; render('symbols'); return; }
    type(key);
    if (shift && key.length === 1 && !symbols) { shift = false; render(event.target.closest('[data-key]').dataset.key.toLowerCase()); }
  });
  dialog.addEventListener('close', () => { target = null; });
  // Typing on a real keyboard still works while it's open.
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' || event.key === 'Enter' && !event.target.closest?.('[data-key]')) { event.preventDefault(); close(); return; }
    if (event.key === 'Backspace') { event.preventDefault(); type('back'); return; }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) { event.preventDefault(); type(event.key); }
  });
  const base = openNativeKeyboard;
  openNativeKeyboard = function (field, ...rest) {
    if (theme() === 'helix' || !isTextEntry(field) || field.isContentEditable || field instanceof HTMLTextAreaElement) return base.call(this, field, ...rest);
    target = field; shift = false; symbols = field.type === 'number' || field.type === 'tel';
    show();
    dialog.showModal();
    render();
  };
})();
