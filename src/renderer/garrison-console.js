// Small things that make a window behave like a console screen rather than a web page: nothing selects or drags,
// the pointer hides after a moment of stillness, and browser zoom and the page context menu stay out of the way.
(() => {
  const typing = target => Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"]'));
  document.addEventListener('dragstart', event => { if (!typing(event.target)) event.preventDefault(); });
  document.addEventListener('selectstart', event => { if (!typing(event.target)) event.preventDefault(); });
  document.addEventListener('wheel', event => { if (event.ctrlKey) event.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && ['+', '=', '-', '_', '0'].includes(event.key)) event.preventDefault();
  });
  document.addEventListener('contextmenu', event => { if (!typing(event.target)) event.preventDefault(); });
  let timer = 0;
  const wake = () => { document.body.classList.remove('g-pointer-idle'); clearTimeout(timer); timer = setTimeout(() => document.body.classList.add('g-pointer-idle'), 3000); };
  document.addEventListener('mousemove', wake, { passive: true });
  document.addEventListener('mousedown', wake, { passive: true });
  wake();
})();

// The controller loop stops whenever the window loses focus and restarts on the focus event. If that event is
// missed (a game or Steam briefly took focus during a launch), navigation would stay dead, so check once a second.
setInterval(() => { try { if (typeof scheduleGamepadPoll === 'function') scheduleGamepadPoll(); } catch { /* Not ready yet. */ } }, 1000);
