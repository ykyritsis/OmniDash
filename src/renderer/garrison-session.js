// The running game, the way a console shows it: its tile on Home and in the Library says "Playing" with a live
// timer, selecting it resumes the game rather than starting a second copy, its menu has Close game, and when the
// game ends (closed here or on its own) the dashboard comes back on Home with that game focused.
(() => {
  'use strict';
  const minutes = ms => Math.max(0, Math.floor(ms / 60000));
  const played = since => { const m = minutes(Date.now() - since); return m < 1 ? 'Just started' : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; };
  // Game tiles across the themes' Home rows and the Library: big enough to carry a badge, never menu rows.
  const tiles = id => [...document.querySelectorAll(`.focusable[data-game-id="${CSS.escape(id)}"]`)]
    .filter(el => !el.closest('dialog, .g-flyout, #launch-overlay') && el.offsetWidth >= 80 && el.offsetHeight >= 80);

  function paint() {
    const session = state.activeGameSession;
    for (const old of document.querySelectorAll('.g-running')) {
      if (!session || old.dataset.gameId !== session.gameId) { old.classList.remove('g-running'); old.querySelector(':scope > .g-run-badge')?.remove(); }
    }
    if (!session?.gameId) return;
    const text = session.launchedAt ? `Playing · ${played(session.launchedAt)}` : 'Playing';
    for (const tile of tiles(session.gameId)) {
      tile.classList.add('g-running');
      let badge = tile.querySelector(':scope > .g-run-badge');
      if (!badge) { badge = document.createElement('span'); badge.className = 'g-run-badge'; badge.setAttribute('aria-hidden', 'true'); badge.innerHTML = '<i></i><b></b>'; tile.append(badge); }
      if (badge.lastChild.textContent !== text) badge.lastChild.textContent = text;
    }
  }
  // Rows re-render often (art arriving, a theme switch); repaint after them without watching every attribute.
  let queued = 0;
  const schedule = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; paint(); }); };
  new MutationObserver(records => { if (state.activeGameSession && records.some(record => record.addedNodes.length)) schedule(); })
    .observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
  setInterval(() => { if (state.activeGameSession) paint(); }, 20000);

  const baseRender = renderGameSessionAction;
  renderGameSessionAction = function (...args) { const result = baseRender.apply(this, args); schedule(); return result; };

  // The game ended: back to Home, on that game, with nothing left open over it.
  window.launcher.onGameEnded?.(async ({ gameId }) => {
    state.activeGameSession = null;
    for (const dialog of document.querySelectorAll('dialog[open]')) { if (dialog !== onboardingDialog) dialog.close(); }
    await refreshActiveGameSession().catch(() => {});
    if (state.games.some(game => game.id === gameId)) state.selectedGameId = gameId;
    if (typeof renderRecentGames === 'function') renderRecentGames();
    showView('home');
    const card = recentRow.querySelector(`.game-card[data-game-id="${CSS.escape(gameId)}"]`);
    if (card) setFocusedElement(card, { scroll: true });
    paint();
  });

  // Close game, from the game's menu.
  const gameMenu = gGameMenuMarkup;
  gGameMenuMarkup = function (game) {
    const html = gameMenu(game);
    if (state.activeGameSession?.gameId !== game.id) return html;
    return html.replace(/(data-action="g-game-resume"[^>]*>[\s\S]*?<\/button>)/, `$1${gRow('g-game-close', 'close', 'Close game')}`);
  };
  const perform = performAction;
  performAction = async function (action, source) {
    if (action === 'g-game-close') {
      const id = state.optionsGameId || state.activeGameSession?.gameId;
      const game = state.games.find(item => item.id === id);
      if (gGameMenu.open) gGameMenu.close();
      try {
        const result = await window.launcher.closeGame(id);
        if (!result.stopped) showToast(`${game?.title || 'The game'} didn't close. Close it from the game.`);
      } catch (error) { showToast(String(error.message || 'Could not close the game').replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); await refreshActiveGameSession(); }
      return;
    }
    return perform.call(this, action, source);
  };
})();
