// Under a game's gallery: which of your friends are playing it right now, and your own screenshots and clips
// of it (Steam screenshots and Xbox Game Bar captures). Each row appears only when it has something to show.
(function buildGameExtras() {
  const gallery = document.querySelector('#detail-gallery')?.closest('section');
  if (!gallery) return;
  const section = document.createElement('section');
  section.id = 'g-game-extras';
  section.className = 'g-game-extras';
  section.hidden = true;
  gallery.after(section);
  let token = 0;

  function friendsPlaying(game) {
    if (!game?.appId || !/^\d+$/.test(String(game.appId))) return [];
    return (state.gFriends?.friends || []).filter(friend => friend?.game && String(friend.gameId) === String(game.appId) && !['offline', 'unknown'].includes(friend.state));
  }
  function friendsMarkup(friends) {
    if (!friends.length) return '';
    return `<div class="g-extras-block"><h3>Friends playing now</h3><div class="g-extras-friends">${friends.map(friend =>
      `<button class="g-extras-friend focusable" type="button" data-action="${friend.lobby ? 'g-friend-join' : 'g-friend-chat'}" data-friend-id="${escapeHtml(friend.id)}" aria-label="${escapeHtml(friend.lobby ? `Join ${friend.name}` : `Message ${friend.name}`)}">${gFriendAvatar(friend)}<span><strong>${escapeHtml(friend.name)}</strong><small>${friend.lobby ? 'Join game' : 'Playing now'}</small></span></button>`).join('')}</div></div>`;
  }
  function capturesMarkup(gameId, captures) {
    if (!captures.length) return '';
    return `<div class="g-extras-block"><h3>Your captures</h3><div class="g-captures" role="list">${captures.map(item =>
      `<button class="g-capture focusable" type="button" role="listitem" data-action="g-capture-open" data-game-id="${escapeHtml(gameId)}" data-index="${item.index}" aria-label="${escapeHtml(`Open ${item.kind === 'video' ? 'clip' : 'screenshot'} ${item.name}`)}">${item.thumb ? `<img src="${escapeHtml(item.thumb)}" alt="" decoding="async" />` : `<span class="g-capture-blank">${gIcon(item.kind === 'video' ? 'play' : 'photo')}</span>`}<span class="g-capture-badge">${item.kind === 'video' ? `${gIcon('play')}Clip` : escapeHtml(item.source)}</span></button>`).join('')}</div></div>`;
  }
  function paint(html) {
    section.innerHTML = html;
    section.hidden = !html;
    if (html) refreshFocusables();
  }

  async function show(game) {
    const mine = ++token;
    if (!game || game.isApp) { paint(''); return; }
    const friends = friendsMarkup(friendsPlaying(game));
    paint(friends);
    const owned = state.games.some(item => item.id === game.id);
    if (!owned) return;
    let captures = [];
    try { captures = await window.launcher.listCaptures(game.id); } catch { /* No captures to show. */ }
    // The player may already have moved to another game while this was loading.
    if (mine !== token || state.detailGameId !== game.id) return;
    paint(friends + capturesMarkup(game.id, captures));
  }

  const openBase = openGameDetails;
  openGameDetails = function (...args) {
    const result = openBase.apply(this, args);
    const game = typeof findGameForDetails === 'function' ? findGameForDetails(state.detailGameId) : state.games.find(item => item.id === state.detailGameId);
    show(game).catch(() => {});
    return result;
  };
  // A friend starting or leaving a game updates the row while the page is open.
  const friendsBase = renderPlayWithFriends;
  renderPlayWithFriends = function () {
    friendsBase();
    if (state.view === 'detail') {
      const game = typeof findGameForDetails === 'function' ? findGameForDetails(state.detailGameId) : null;
      if (game && !section.querySelector('.g-captures')) paint(friendsMarkup(friendsPlaying(game)));
    }
  };

  const perform = performAction;
  performAction = async function (action, source) {
    if (action === 'g-capture-open') {
      try { await window.launcher.openCapture(source.dataset.gameId, Number(source.dataset.index)); }
      catch (error) { showToast(error.message || 'Could not open this capture'); }
      return;
    }
    return perform(action, source);
  };
})();
