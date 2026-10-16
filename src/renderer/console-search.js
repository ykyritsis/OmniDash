// Search is a modal surface, so B returns to the exact library or Home position.
let consoleSearchReturn = null;
function buildConsoleSearch() {
  const dialog = document.createElement('dialog');
  dialog.id = 'console-search-dialog';
  dialog.className = 'console-search-dialog';
  dialog.setAttribute('aria-labelledby', 'console-search-title');
  dialog.innerHTML = '<header><h2 id="console-search-title">Search</h2><button class="focusable" data-action="console-search-close" aria-label="Close search">×</button></header><div class="console-search-field"></div><p id="console-search-count" role="status"></p><div id="console-search-results" class="console-search-results"></div>';
  dialog.querySelector('.console-search-field').append(document.querySelector('#search-popover'));
  document.body.append(dialog);
  dialog.addEventListener('close', () => { searchPopover.hidden = true; });
}

function renderConsoleSearch() {
  const query = librarySearch.value.trim().toLocaleLowerCase();
  const matches = displayedLibraryGames().filter(game => !query || game.title.toLocaleLowerCase().includes(query));
  const games = matches.slice(0, 60);
  document.querySelector('#console-search-count').textContent = query
    ? `${matches.length} result${matches.length === 1 ? '' : 's'}${matches.length > games.length ? ' · first 60 shown' : ''}`
    : 'Games and apps in your library';
  document.querySelector('#console-search-results').innerHTML = games.length
    ? games.map(game => `<button class="console-search-game focusable" data-action="console-search-game" data-game-id="${escapeHtml(game.id)}"><span class="console-search-art">${gameArt(game)}</span><span class="console-search-game-copy"><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.provider)}${game.installed === false ? ' · Not installed' : ''}</small></span></button>`).join('')
    : `<div class="console-search-empty">${consoleIcon('search')}<h3>${query ? 'No matching games or apps' : 'Your library is empty'}</h3><p>${query ? 'Try another name or a shorter search.' : 'Add your games from My games & apps to find them here.'}</p></div>`;
  refreshFocusables();
}

function openConsoleSearch(selectedGameId = '') {
  const dialog = document.querySelector('#console-search-dialog');
  if (dialog.open) { dialog.close(); return; }
  consoleSearchReturn = { element: document.activeElement, scrollTop: document.querySelector('main').scrollTop };
  searchPopover.hidden = false;
  renderConsoleSearch();
  dialog.showModal();
  const selected = [...dialog.querySelectorAll('.console-search-game, .g-store-card')].find(card => card.dataset.gameId === selectedGameId);
  setFocusedElement(selected || librarySearch, { scroll: false });
  if (state.controllerClick && !selected) openNativeKeyboard(librarySearch);
}

function navigateConsoleSearch(direction, current) {
  const dialog = document.querySelector('#console-search-dialog');
  if (topmostOpenDialog() !== dialog) return false;
  const cards = [...dialog.querySelectorAll('.console-search-game, .g-store-card')];
  if (current === librarySearch && direction === 'down') {
    if (cards[0]) setFocusedElement(cards[0]);
    return true;
  }
  if (!cards.includes(current)) return false;
  const origin = current.getBoundingClientRect();
  const row = cards.filter(card => Math.abs(card.getBoundingClientRect().top - origin.top) < 4);
  if (direction === 'left' || direction === 'right') {
    const next = row[row.indexOf(current) + (direction === 'left' ? -1 : 1)];
    if (next) setFocusedElement(next);
    return true;
  }
  const next = cards.filter(card => direction === 'up' ? card.getBoundingClientRect().top < origin.top - 4 : card.getBoundingClientRect().top > origin.top + 4)
    .sort((a, b) => Math.abs(a.getBoundingClientRect().top - origin.top) - Math.abs(b.getBoundingClientRect().top - origin.top) || Math.abs(a.getBoundingClientRect().left - origin.left) - Math.abs(b.getBoundingClientRect().left - origin.left))[0];
  if (next) setFocusedElement(next);
  else if (direction === 'up') setFocusedElement(librarySearch);
  return true;
}
buildConsoleSearch();
