// Friends' activity: a quiet list of your Steam friends, playing first, then online, busy and away.
// It sits under Play with friends and updates with the friends list.
(function buildFriendsActivity() {
  const band = document.createElement('section');
  band.id = 'g-friends-activity';
  band.className = 'collection-band g-activity-band';
  band.hidden = true;
  band.setAttribute('aria-labelledby', 'g-activity-title');
  document.querySelector('.dashboard-recent')?.after(band);

  const rank = friend => friend.game ? 0 : friend.state === 'online' ? 1 : friend.state === 'busy' ? 2 : friend.state === 'away' || friend.state === 'snooze' ? 3 : 4;
  window.renderFriendsActivity = function () {
    const friends = (state.gFriends?.friends || []).filter(friend => friend && friend.name);
    const list = friends.filter(friend => friend.state !== 'offline' || friend.game).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 12);
    band.hidden = !list.length;
    if (!list.length) { band.innerHTML = ''; return; }
    const active = friends.filter(friend => friend.game || friend.state === 'online' || friend.state === 'busy').length;
    const focused = band.contains(document.activeElement) ? document.activeElement.dataset.friendId : null;
    band.innerHTML = `<div class="collection-intro"><h2 id="g-activity-title"><span class="collection-brand"><span>Friends' activity</span></span></h2><small class="g-activity-count">${active} active now</small></div>
      <div class="g-activity-list" role="list">${list.map(friend => `<button class="g-activity-row focusable" type="button" role="listitem" data-action="g-friend-chat" data-friend-id="${escapeHtml(friend.id)}">${gFriendAvatar(friend)}<span class="g-activity-copy"><strong>${escapeHtml(friend.name)}</strong><small>${escapeHtml(gFriendStatus(friend))}</small></span>${friend.game ? `<em>${escapeHtml(friend.game)}</em>` : ''}</button>`).join('')}</div>`;
    if (focused) setFocusedElement(band.querySelector(`[data-friend-id="${CSS.escape(focused)}"]`), { scroll: false });
    refreshFocusables();
  };
  const renderPlayBase = renderPlayWithFriends;
  renderPlayWithFriends = function () { renderPlayBase(); window.renderFriendsActivity(); };
  window.renderFriendsActivity();
})();
