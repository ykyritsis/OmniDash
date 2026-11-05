// Live events as console pop-ups: an achievement unlocked while you play (main.cjs reads Steam's stats cache), a
// friend coming online, a download finishing. In the dashboard each is a themed toast (kept in Notifications);
// while a game is in front, the main process shows the same pop-up over the game.
(() => {
  'use strict';
  const themeId = () => document.body.dataset.gSkin === 'aero' ? 'aero' : (document.body.dataset.gTheme || 'series');
  function announce(item) {
    if (!item?.title) return;
    showToast(item.detail ? `${item.title} · ${item.detail}` : item.title);
    if (item.kind === 'achievement') playUiSound('achievement');
    if (!document.hasFocus()) window.launcher.livePopup?.({ ...item, theme: themeId() }).catch(() => {});
  }
  window.gLive = announce;
  // Achievements per game for the session recap (garrison-session.js reads and clears it).
  window.gSessionAchievements = new Map();
  window.launcher.onLiveEvent?.(item => {
    if (item.kind === 'achievement' && item.gameId) window.gSessionAchievements.set(item.gameId, (window.gSessionAchievements.get(item.gameId) || 0) + 1);
    // The main process shows its own pop-up over a game; here it only needs the toast and the sound.
    showToast(item.detail ? `${item.title} · ${item.detail}` : item.title);
    if (item.kind === 'achievement') { playUiSound('achievement'); window.dispatchEvent(new Event('player-score-updated')); }
  });
  // The main process needs the theme to style pop-ups over a game.
  let sent = '';
  const sendTheme = () => { const id = themeId(); if (id !== sent) { sent = id; window.launcher.setLiveTheme?.(id).catch(() => {}); } };
  new MutationObserver(sendTheme).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme', 'data-g-skin'] });
  sendTheme();

  // A friend coming online, or starting a game: compared with the last refresh, never on the first one.
  let known = null;
  const baseFriends = refreshGarrisonFriends;
  refreshGarrisonFriends = async function (...args) {
    const result = await baseFriends.apply(this, args);
    const list = ['ready', 'partial'].includes(state.gFriends?.status) ? state.gFriends.friends || [] : null;
    if (!list) return result;
    const now = new Map(list.map(friend => [friend.id, { on: !['offline', 'unknown'].includes(friend.state), game: friend.game || '' }]));
    if (known) {
      let shown = 0;
      for (const friend of list) {
        const before = known.get(friend.id), after = now.get(friend.id);
        if (!before || shown >= 2) continue;
        if (!before.on && after.on) { announce({ kind: 'friend', title: friend.name, detail: friend.game ? `Online · playing ${friend.game}` : 'Is now online' }); shown++; }
        else if (after.game && after.game !== before.game) { announce({ kind: 'friend', title: friend.name, detail: `Started playing ${friend.game}` }); shown++; }
      }
    }
    known = now;
    return result;
  };
  // While a game is in front the dashboard's own refresh pauses; check once a minute so pop-ups still arrive.
  setInterval(() => { if (state.activeGameSession && !document.hasFocus()) refreshGarrisonFriends().catch(() => {}); }, 60000);
})();
