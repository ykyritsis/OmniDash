// One horizontal shelf: verified Steam friends who are currently in a game.
(function buildFriendsActivity() {
  const band = document.createElement('section');
  band.id = 'g-friends-activity';
  band.className = 'collection-band g-activity-band';
  band.hidden = true;
  band.setAttribute('aria-labelledby', 'g-activity-title');
  document.querySelector('.dashboard-recent')?.after(band);

  window.renderFriendsActivity = function () {
    const live = ['ready', 'partial'].includes(state.gFriends?.status);
    const list = live ? (state.gFriends.friends || []).filter(friend => friend?.game && friend.gameId && !['offline', 'unknown'].includes(friend.state)) : [];
    const focused = band.contains(document.activeElement) ? document.activeElement.dataset.friendId : null;
    const previousIndex = [...band.querySelectorAll('[data-friend-id]')].findIndex(card => card.dataset.friendId === focused);
    const scroll = band.querySelector('.game-row')?.scrollLeft || 0;
    band.hidden = !list.length;
    if (!list.length) {
      band.innerHTML = '';
      refreshFocusables();
      if (focused) setFocusedElement(recentRow.querySelector('.focusable'), { scroll: false });
      return;
    }
    band.innerHTML = `<div class="collection-intro"><h2 id="g-activity-title"><span class="collection-brand"><span>Friends' activity</span></span></h2><small class="g-activity-count">${list.length} playing now</small></div>
      <div class="game-row collection-covers" role="list">${list.map(friend => {
        const owned = state.games.find(game => game.provider === 'Steam' && String(game.appId) === friend.gameId);
        // Large IDs represent non-Steam shortcuts, which have no Steam store artwork/page.
        const storeGame = /^[1-9]\d{0,9}$/.test(friend.gameId);
        const art = owned?.artwork?.tile ? gameArt(owned) : storeGame
          ? `<img src="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${escapeHtml(friend.gameId)}/library_600x900.jpg" alt="" loading="lazy" data-fallback="https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${escapeHtml(friend.gameId)}/header.jpg" />`
          : `<span class="art-fallback"><span class="fallback-title">${escapeHtml(friend.game)}</span></span>`;
        return `<button class="game-card g-friend-card focusable" type="button" role="listitem" data-action="${storeGame ? 'g-friend-join' : 'g-friend-chat'}" data-friend-id="${escapeHtml(friend.id)}" aria-label="${escapeHtml(`${friend.game} — ${friend.name}`)}"><span class="g-friend-art">${art}</span><span class="g-card-text"><strong>${escapeHtml(friend.game)}</strong><span class="g-activity-player">${gFriendAvatar(friend)}<small>${escapeHtml(friend.name)}</small></span></span></button>`;
      }).join('')}</div>`;
    band.querySelector('.game-row').scrollLeft = scroll;
    refreshFocusables();
    if (focused) {
      const cards = [...band.querySelectorAll('[data-friend-id]')];
      setFocusedElement(cards.find(card => card.dataset.friendId === focused) || cards[Math.min(Math.max(0, previousIndex), cards.length - 1)], { scroll: false });
    }
  };
  window.renderFriendsActivity();
})();
