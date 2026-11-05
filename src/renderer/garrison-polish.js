// Console finish for things a web page does: a line that only says "Loading…" becomes a shimmering placeholder
// bar (the words stay for screen readers), artwork that has to download fades in instead of popping, and every menu
// carries its button hints at the bottom.
(() => {
  'use strict';
  // ---------- Placeholders instead of "Loading…" text ----------
  const WAITING = /^(Loading|Reading|Checking|Finding|Gathering|Getting|Looking|Searching|Scanning|Refreshing)\b[^.!?]{0,60}…$/;
  const SKIP = 'button, #toast, #launch-overlay, .g-run-badge, input, textarea, select, option, [data-no-skeleton]';
  function mark(el) {
    if (!(el instanceof HTMLElement) || el.children.length || el.closest(SKIP)) return;
    const waiting = WAITING.test(el.textContent.trim());
    if (waiting !== el.classList.contains('g-skel')) {
      el.classList.toggle('g-skel', waiting);
      if (waiting) el.setAttribute('aria-busy', 'true'); else el.removeAttribute('aria-busy');
    }
  }
  const pending = new Set();
  let frame = 0;
  const flush = () => {
    frame = 0;
    for (const node of pending) {
      if (node.nodeType === Node.TEXT_NODE) mark(node.parentElement);
      else if (node instanceof HTMLElement) {
        mark(node);
        if (node.childElementCount && node.childElementCount < 400) for (const child of node.querySelectorAll('p, small, span, div, strong, li, h3')) mark(child);
        for (const img of node.tagName === 'IMG' ? [node] : node.querySelectorAll?.('img') || []) fade(img);
      }
    }
    pending.clear();
  };
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') pending.add(record.target);
      else { pending.add(record.target); for (const node of record.addedNodes) pending.add(node); }
    }
    if (!frame) frame = requestAnimationFrame(flush);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  // ---------- Artwork fades in ----------
  // Only images still downloading fade; cached ones are complete at once and show without a flash.
  function fade(img) {
    if (img.complete || img.dataset.gFaded || img.closest('#launch-overlay')) return;
    img.dataset.gFaded = '1';
    img.classList.add('g-fade');
    const done = () => { img.classList.remove('g-fade'); img.removeEventListener('load', done); img.removeEventListener('error', done); };
    img.addEventListener('load', done);
    img.addEventListener('error', done);
  }
  for (const img of document.images) fade(img);

  // ---------- Button hints on every menu ----------
  const hints = () => `<footer class="g-menu-hints g-menu-hints-auto"><span><kbd class="xb-button xb-a" data-g-role="confirm">A</kbd>Select</span><span><kbd class="xb-button xb-b" data-g-role="back">B</kbd>Back</span></footer>`;
  const baseOpen = openGFlyout;
  openGFlyout = function (dialog, opener, html, anchor) {
    const withHints = /class="g-menu-hints/.test(html) || dialog.classList.contains('g-name-flyout') ? html : html + hints();
    return baseOpen.call(this, dialog, opener, withHints, anchor);
  };
})();
