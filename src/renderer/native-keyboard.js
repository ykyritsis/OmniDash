function isTextEntry(target) {
  return Boolean(target && !target.disabled && !target.readOnly && (
    target instanceof HTMLTextAreaElement || target.isContentEditable ||
    (target instanceof HTMLInputElement && ['text', 'search', 'password', 'number', 'email', 'url', 'tel'].includes(target.type))
  ));
}

let nativeKeyboardPending = null;
async function openNativeKeyboard(target) {
  if (!isTextEntry(target) || !target.isConnected) return;
  target.focus({ preventScroll: true });
  if (nativeKeyboardPending) return nativeKeyboardPending;
  nativeKeyboardPending = window.launcher.showNativeKeyboard()
    .catch(error => showToast(error.message || 'Windows could not open the keyboard'))
    .finally(() => { nativeKeyboardPending = null; });
  return nativeKeyboardPending;
}

// Delegation covers dynamically created settings, search and account text fields.
// Desktop mouse/keyboard users retain normal typing; touch and pen always use Windows.
document.addEventListener('pointerup', event => {
  if (!['touch', 'pen'].includes(event.pointerType)) return;
  const target = event.target.closest('input, textarea, [contenteditable="true"]');
  if (isTextEntry(target)) openNativeKeyboard(target);
});
