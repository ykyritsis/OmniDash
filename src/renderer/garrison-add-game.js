// "Add a game or app", as in the Xbox app: search, a checklist of Start menu apps with their icons,
// and Add files / Browse more files on the right.
const gAdd = document.createElement('dialog');
gAdd.id = 'g-add-dialog';
gAdd.className = 'g-add';
gAdd.setAttribute('aria-labelledby', 'g-add-title');
document.body.append(gAdd);
const gAddState = { apps: [], selected: new Set(), query: '', loading: false };

function gAddRows() {
  const query = gAddState.query.trim().toLowerCase();
  const apps = gAddState.apps.filter(item => !item.added && (!query || item.name.toLowerCase().includes(query)));
  if (gAddState.loading) return '<p class="g-add-empty">Finding apps on this PC…</p>';
  if (!apps.length) return `<p class="g-add-empty">${query ? 'No apps match your search.' : 'Every app from your Start menu is already in your library.'}</p>`;
  return apps.map(item => {
    const checked = gAddState.selected.has(item.target);
    return `<button class="g-add-row focusable${checked ? ' checked' : ''}" type="button" role="checkbox" aria-checked="${checked}" data-action="g-add-toggle" data-target="${escapeHtml(item.target)}">
      <span class="g-add-icon">${item.icon ? `<img src="${escapeHtml(item.icon)}" alt="" />` : ''}</span><span class="g-add-name">${escapeHtml(item.name)}</span><span class="g-add-check">${checked ? gIcon('check') : ''}</span></button>`;
  }).join('');
}
function gAddRender(focus = '') {
  const visible = gAddState.apps.filter(item => !item.added);
  const all = visible.length > 0 && visible.every(item => gAddState.selected.has(item.target));
  gAdd.querySelector('.g-add-list').innerHTML = gAddRows();
  const selectAll = gAdd.querySelector('[data-action="g-add-all"]');
  selectAll.setAttribute('aria-checked', String(all));
  selectAll.querySelector('.g-add-check').innerHTML = all ? gIcon('check') : '';
  const add = gAdd.querySelector('[data-action="g-add-confirm"]');
  add.setAttribute('aria-disabled', String(!gAddState.selected.size));
  add.textContent = gAddState.selected.size > 1 ? `Add ${gAddState.selected.size} files` : 'Add files';
  refreshFocusables();
  if (focus) setFocusedElement(gAdd.querySelector(focus) || gAdd.querySelector('.g-add-row') || gAdd.querySelector('.g-add-search input'), { scroll: true });
}
async function openGarrisonAddGame(opener) {
  gAdd.gOpener = opener || document.activeElement;
  gAddState.selected.clear();
  gAddState.query = '';
  gAdd.innerHTML = `<h2 id="g-add-title">Add a game or app</h2>
    <div class="g-add-body">
      <div class="g-add-left">
        <label class="g-add-search">${gIcon('search')}<input class="focusable" type="search" placeholder="Search" aria-label="Search apps" autocomplete="off" spellcheck="false" /></label>
        <div class="g-add-listhead"><span>Select files</span><button class="g-add-all focusable" type="button" role="checkbox" aria-checked="false" data-action="g-add-all"><span>Select all</span><span class="g-add-check"></span></button></div>
        <div class="g-add-list" role="group" aria-label="Apps on this PC"></div>
      </div>
      <div class="g-add-right">
        <span class="g-add-label">Add to</span>
        <span class="g-add-destination">My games</span>
        <button class="g-add-primary focusable" type="button" data-action="g-add-confirm" aria-disabled="true">Add files</button>
        <button class="g-add-secondary focusable" type="button" data-action="g-add-browse">Browse more files</button>
      </div>
    </div>
    <span class="g-add-hint"><kbd class="xb-button xb-b">B</kbd>Close</span>`;
  gAdd.querySelector('input').addEventListener('input', event => { gAddState.query = event.target.value; gAddRender(); });
  gAdd.showModal();
  if (!gAddState.apps.length) {
    gAddState.loading = true;
    gAddRender('.g-add-search input');
    try { gAddState.apps = await window.launcher.getStartMenuApps(); } catch { gAddState.apps = []; }
    gAddState.loading = false;
    const owned = new Set(state.games.map(game => String(game.executable || '').toLowerCase()));
    gAddState.apps.forEach(item => { item.added = item.added || owned.has(item.target.toLowerCase()); });
  }
  gAddRender('.g-add-search input');
}
gAdd.addEventListener('close', () => {
  const opener = gAdd.gOpener;
  gAdd.gOpener = null;
  if (opener?.isConnected) setTimeout(() => setFocusedElement(opener, { scroll: false }), 0);
});
gAdd.addEventListener('click', event => { if (event.target === gAdd) gAdd.close(); });

const gAddPerform = performAction;
performAction = async function (action, source) {
  if (action === 'add-game' && !source?.dataset?.gBrowse) { await openGarrisonAddGame(source); return; }
  if (action === 'g-add-toggle') {
    const target = source.dataset.target;
    if (gAddState.selected.has(target)) gAddState.selected.delete(target); else gAddState.selected.add(target);
    gAddRender(`.g-add-row[data-target="${CSS.escape(target)}"]`);
    return;
  }
  if (action === 'g-add-all') {
    const visible = gAddState.apps.filter(item => !item.added);
    const all = visible.every(item => gAddState.selected.has(item.target));
    gAddState.selected = new Set(all ? [] : visible.map(item => item.target));
    gAddRender('[data-action="g-add-all"]');
    return;
  }
  if (action === 'g-add-browse') {
    gAdd.close();
    const button = document.createElement('button');
    button.dataset.gBrowse = 'true';
    return gAddPerform('add-game', button);
  }
  if (action === 'g-add-confirm') {
    if (!gAddState.selected.size) return;
    const chosen = gAddState.apps.filter(item => gAddState.selected.has(item.target));
    let added = 0;
    for (const item of chosen) {
      try { await window.launcher.saveCustomGame({ title: item.name, executable: item.target, isApp: false }); item.added = true; added++; } catch { /* Skipped. */ }
    }
    gAdd.close();
    showToast(added ? `${added} ${added === 1 ? 'game' : 'games'} added to My games` : 'Those apps couldn’t be added');
    if (added) scanLibrary(false, false, true);
    return;
  }
  return gAddPerform(action, source);
};
