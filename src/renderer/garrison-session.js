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
  window.launcher.onGameEnded?.(async ({ gameId, launchedAt, endedAt }) => {
    const started = launchedAt || state.activeGameSession?.launchedAt || 0;
    state.activeGameSession = null;
    for (const dialog of document.querySelectorAll('dialog[open]')) { if (dialog !== onboardingDialog) dialog.close(); }
    await refreshActiveGameSession().catch(() => {});
    if (state.games.some(game => game.id === gameId)) state.selectedGameId = gameId;
    if (typeof renderRecentGames === 'function') renderRecentGames();
    showView('home');
    const card = recentRow.querySelector(`.game-card[data-game-id="${CSS.escape(gameId)}"]`);
    if (card) setFocusedElement(card, { scroll: true });
    paint();
    const game = state.games.find(item => item.id === gameId);
    if (game && started && (endedAt || Date.now()) - started >= 2 * 60000) showRecap(game, started, endedAt || Date.now());
  });

  // ---------- The session recap ----------
  // After you've played a while: how long, achievements unlocked, and the captures you took, as a console's
  // "while you were playing" card. A opens a capture, B or Done closes it.
  const recap = gFlyout('g-recap-dialog', 'g-recap-flyout', 'Your session');
  async function showRecap(game, started, ended) {
    const unlocked = window.gSessionAchievements?.get(game.id) || 0;
    window.gSessionAchievements?.delete(game.id);
    const captures = (await window.launcher.listCaptures(game.id).catch(() => [])).filter(item => item.at >= started - 5000);
    const chips = [`<span>${gIcon('play')}${escapeHtml(played(started).replace('Just started', 'Under a minute'))}</span>`];
    if (unlocked) chips.push(`<span>${gIcon('star')}${unlocked} achievement${unlocked === 1 ? '' : 's'}</span>`);
    if (captures.length) chips.push(`<span>${gIcon('photo')}${captures.length} capture${captures.length === 1 ? '' : 's'}</span>`);
    openGFlyout(recap, document.activeElement, `<header class="g-recap-head"><span class="g-menu-art">${gameArt(game)}</span><span><small>Session ended</small><h2>${escapeHtml(game.title)}</h2></span></header>
      <div class="g-recap-chips">${chips.join('')}</div>
      ${captures.length ? `<div class="g-recap-shots">${captures.slice(0, 4).map(item => `<button class="g-recap-shot focusable" type="button" data-action="g-recap-capture" data-game-id="${escapeHtml(game.id)}" data-index="${item.index}" aria-label="Open ${escapeHtml(item.name)}"${item.thumb ? ` style="background-image:url(&quot;${item.thumb}&quot;)"` : ''}>${item.kind === 'video' ? gIcon('play') : ''}</button>`).join('')}</div>` : ''}
      <div class="g-menu-group">${gRow('g-recap-again', 'play', 'Play again')}${gRow('g-close-flyout', 'check', 'Done')}</div>`);
    recap.dataset.gameId = game.id;
    const box = recap.getBoundingClientRect();
    recap.style.cssText = `left:${Math.round((innerWidth - box.width) / 2)}px;top:${Math.round((innerHeight - box.height) / 2)}px;right:auto;bottom:auto`;
    playUiSound('notify');
  }
  // ---------- Captures, from every game ----------
  const capturesDialog = gFlyout('g-captures-dialog', 'g-captures-flyout', 'Captures');
  async function openCapturesPage(opener) {
    openGFlyout(capturesDialog, opener, '<header><h2>Captures</h2></header><p class="g-captures-note">Loading captures…</p>');
    capturesDialog.style.cssText = '';
    const items = await window.launcher.recentCaptures().catch(() => []);
    if (!capturesDialog.open) return;
    const when = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    capturesDialog.innerHTML = `<header><h2>Captures</h2><small>${items.length ? `${items.length} recent` : ''}</small></header>${items.length
      ? `<div class="g-captures-grid">${items.map(item => `<button class="g-captures-item focusable" type="button" data-action="g-captures-open" data-index="${item.index}" aria-label="${escapeHtml(item.name)}"><span class="g-captures-pic"${item.thumb ? ` style="background-image:url(&quot;${item.thumb}&quot;)"` : ''}>${item.kind === 'video' ? gIcon('play') : ''}</span><span>${escapeHtml(item.name)}</span><small>${when.format(item.at)}</small></button>`).join('')}</div>`
      : '<p class="g-captures-note">No captures yet. Take one while you play with Win + Alt + PrtScn or your controller’s Share button.</p>'}
      <footer class="g-menu-hints g-menu-hints-auto"><span><kbd class="xb-button xb-a" data-g-role="confirm">A</kbd>Open</span><span><kbd class="xb-button xb-b" data-g-role="back">B</kbd>Back</span></footer>`;
    refreshFocusables();
    setFocusedElement(capturesDialog.querySelector('.focusable'), { scroll: false });
  }
  window.gOpenCaptures = openCapturesPage;
  window.gShowRecap = (gameId, minutes = 72) => { const game = state.games.find(item => item.id === gameId); if (game) showRecap(game, Date.now() - minutes * 60000, Date.now()); };
  // View + Menu together: close the running game, after asking.
  window.gCloseGamePrompt = async function () {
    const session = state.activeGameSession;
    const game = session && state.games.find(item => item.id === session.gameId);
    if (!game) { showToast('No game is running'); return; }
    playUiSound('confirm');
    const choice = await gChoice('Close game?', `${escapeHtml(game.title)} will close. Anything you haven't saved may be lost.`, [['close', 'Close game', true], ['keep', 'Keep playing']]);
    if (choice !== 'close') return;
    state.optionsGameId = game.id;
    await performAction('g-game-close');
  };
  const accountMarkup = gAccountMarkup;
  gAccountMarkup = function () {
    return accountMarkup().replace(/(data-action="g-account-profile"[^>]*>[\s\S]*?<\/button>)/, `$1${gRow('g-captures', 'photo', 'Captures')}`);
  };
  const ended = performAction;
  performAction = async function (action, source) {
    if (action === 'g-captures') { if (gAccountMenu.open) gAccountMenu.close(); await openCapturesPage(source); return; }
    if (action === 'g-captures-open') { window.launcher.openRecentCapture(Number(source.dataset.index)).catch(error => showToast(error.message || 'Could not open that capture')); return; }
    if (action === 'g-recap-capture') { window.launcher.openCapture(source.dataset.gameId, Number(source.dataset.index)).catch(error => showToast(error.message || 'Could not open that capture')); return; }
    if (action === 'g-recap-again') { const id = recap.dataset.gameId; recap.close(); if (id) { state.selectedGameId = id; await launchSelectedGame(); } return; }
    return ended.call(this, action, source);
  };

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
