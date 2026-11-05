// A file browser you can drive with a controller, in place of Windows' Open dialog (which needs a mouse and drops
// you out of the dashboard). Places down the left (the usual folders and every drive), the folder's contents on
// the right: pictures as thumbnails, other files as a list. A opens, B goes back up a folder or closes.
// window.gPickFile({ title, extensions, start }) resolves to { path, name } or null. Hidden <input type="file">
// elements open it too, so every picture picker in the app uses it without changes.
(() => {
  'use strict';
  const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i;
  const dialog = document.createElement('dialog');
  dialog.className = 'g-flyout g-files';
  dialog.setAttribute('aria-label', 'Choose a file');
  document.body.append(dialog);
  let resolver = null, current = null, options = {}, request = 0, history = [];
  const finish = value => { const done = resolver; resolver = null; if (dialog.open) dialog.close(); done?.(value); };
  dialog.addEventListener('close', () => { if (resolver) finish(null); });

  const thumbs = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const tile = entry.target;
      thumbs.unobserve(tile);
      window.launcher.fileThumb(tile.dataset.path).then(url => { if (url) tile.querySelector('.g-files-pic').style.backgroundImage = `url("${url}")`; }).catch(() => {});
    }
  }, { root: dialog });

  async function open(dir, focusPath = '') {
    const mine = ++request;
    let listing;
    try { listing = await window.launcher.listFiles(dir, options.extensions || []); }
    catch (error) { showToast(String(error.message || 'That folder could not be opened').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); return; }
    if (mine !== request || !dialog.open) return;
    current = listing;
    const pictures = listing.items.some(item => !item.folder && IMAGE.test(item.name));
    const place = item => `<button class="g-files-place focusable${listing.dir.toLowerCase().startsWith(item.path.toLowerCase()) && (item.drive ? !listing.places.some(other => !other.drive && listing.dir.toLowerCase().startsWith(other.path.toLowerCase())) : true) ? ' on' : ''}" type="button" data-files-open="${escapeHtml(item.path)}">${gIcon(item.drive ? 'drive' : 'folder')}<span>${escapeHtml(item.label)}</span></button>`;
    const entry = item => item.folder
      ? `<button class="g-files-item folder focusable" type="button" data-files-open="${escapeHtml(item.path)}">${pictures ? `<span class="g-files-pic folder">${gIcon('folder')}</span>` : gIcon('folder')}<span>${escapeHtml(item.name)}</span></button>`
      : `<button class="g-files-item file focusable" type="button" data-files-pick="${escapeHtml(item.path)}" data-path="${escapeHtml(item.path)}">${pictures ? '<span class="g-files-pic"></span>' : gIcon('open')}<span>${escapeHtml(item.name)}</span></button>`;
    dialog.innerHTML = `<header class="g-files-head"><h2>${escapeHtml(options.title || 'Choose a file')}</h2><small>${escapeHtml(listing.dir)}</small></header>
      <div class="g-files-body"><nav class="g-files-places" aria-label="Places">${listing.places.map(place).join('')}</nav>
      <div class="g-files-list${pictures ? ' pictures' : ''}" role="list">${listing.parent ? `<button class="g-files-item up focusable" type="button" data-files-open="${escapeHtml(listing.parent)}" data-files-up>${pictures ? `<span class="g-files-pic folder">${gIcon('chevronDown')}</span>` : gIcon('chevronDown')}<span>Up a folder</span></button>` : ''}${listing.items.map(entry).join('') || '<p class="g-files-empty">Nothing here to choose.</p>'}</div></div>
      <footer class="g-menu-hints g-menu-hints-auto"><span><kbd class="xb-button xb-a" data-g-role="confirm">A</kbd>Open</span><span><kbd class="xb-button xb-b" data-g-role="back">B</kbd>${listing.parent ? 'Up a folder' : 'Close'}</span></footer>`;
    for (const tile of dialog.querySelectorAll('.g-files-item.file')) if (pictures) thumbs.observe(tile);
    refreshFocusables();
    const target = (focusPath && [...dialog.querySelectorAll('[data-files-open]')].find(el => el.dataset.filesOpen === focusPath)) || dialog.querySelector('.g-files-list .focusable:not([data-files-up])') || dialog.querySelector('.g-files-list .focusable') || dialog.querySelector('.g-files-place');
    setFocusedElement(target, { scroll: true });
  }
  dialog.addEventListener('click', event => {
    const go = event.target.closest('[data-files-open]');
    if (go) { history.push(current?.dir); open(go.dataset.filesOpen, go.hasAttribute('data-files-up') ? current?.dir : ''); playUiSound('confirm'); return; }
    const pick = event.target.closest('[data-files-pick]');
    if (pick) { playUiSound('confirm'); finish({ path: pick.dataset.filesPick, name: pick.textContent.trim() }); }
  });
  // B goes up a folder before it closes the browser.
  const back = navigateBack;
  navigateBack = function (...args) {
    if (dialog.open && topmostOpenDialog() === dialog && current?.parent) { playUiSound('back'); open(current.parent, current.dir); return; }
    return back.apply(this, args);
  };

  window.gPickFile = function (opts = {}) {
    if (resolver) finish(null);
    options = opts;
    return new Promise(resolve => {
      resolver = resolve;
      dialog.innerHTML = '<p class="g-files-empty">Opening…</p>';
      dialog.showModal();
      open(opts.start || '');
    });
  };

  // Hidden file inputs (gamerpic, background picture) open the browser and receive the chosen picture as a File.
  const nativeClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type !== 'file') return nativeClick.call(this);
    const accept = String(this.accept || '');
    const extensions = /image/.test(accept) ? ['png', 'jpg', 'jpeg', 'webp'] : accept.split(',').map(item => item.trim().replace(/^\./, '')).filter(item => /^[a-z0-9]+$/i.test(item));
    window.gPickFile({ title: /image/.test(accept) ? 'Choose a picture' : 'Choose a file', extensions }).then(async picked => {
      if (!picked) return;
      try {
        const file = await window.launcher.readImageFile(picked.path);
        const bytes = Uint8Array.from(atob(file.base64), char => char.charCodeAt(0));
        const transfer = new DataTransfer();
        transfer.items.add(new File([bytes], file.name, { type: file.type }));
        this.files = transfer.files;
        this.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (error) { showToast(String(error.message || 'That picture could not be opened').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); }
    });
  };
})();
