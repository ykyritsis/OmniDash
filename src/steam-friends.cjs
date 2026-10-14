// localconfig.vdf caches people encountered on Steam, not just current friends.
// Membership must come from GetFriendList; summaries only supply their live presence.
const TTL = 20000;
const validId = id => /^7656119\d{10}$/.test(String(id));
function safeAvatar(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /(^|\.)(steamstatic\.com|akamaihd\.net)$/.test(url.hostname) ? url.href : null;
  } catch { return null; }
}
function createSteamFriends({ request = fetch, now = Date.now } = {}) {
  let cache = null;
  const pending = new Map();
  async function list({ steamId, apiKey, force = false }) {
    steamId = String(steamId || '').trim();
    apiKey = String(apiKey || '').trim();
    const empty = status => ({ status, steamId, friends: [], online: 0, checkedAt: now() });
    if (!validId(steamId)) { cache = null; return empty('no-account'); }
    if (!apiKey) { cache = null; return empty('needs-api-key'); }
    const key = `${steamId}:${apiKey}`;
    if (!force && cache?.key === key && now() - cache.at < TTL) return cache.data;
    if (pending.has(key)) return pending.get(key);
    const get = async (method, params) => {
      const url = new URL(`https://api.steampowered.com/ISteamUser/${method}/`);
      url.search = new URLSearchParams({ key: apiKey, ...params }).toString();
      const response = await request(url, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error(`Steam returned ${response.status}`);
      return response.json();
    };
    const task = (async () => {
      let data;
      try {
        const result = await get('GetFriendList/v1', { steamid: steamId, relationship: 'friend' });
        if (!Array.isArray(result.friendslist?.friends)) throw new Error('Friends list unavailable');
        const ids = [...new Set(result.friendslist.friends
          .filter(friend => friend.relationship === 'friend' && validId(friend.steamid) && String(friend.steamid) !== steamId)
          .map(friend => String(friend.steamid)))];
        const players = new Map();
        let partial = false;
        // Steam accepts at most 100 summaries per call. Do not truncate large friends lists.
        for (let index = 0; index < ids.length; index += 100) {
          const batchIds = ids.slice(index, index + 100);
          try {
            const batch = await get('GetPlayerSummaries/v2', { steamids: batchIds.join(',') });
            if (!Array.isArray(batch.response?.players)) throw new Error('Presence unavailable');
            for (const player of batch.response.players) {
              if (batchIds.includes(String(player.steamid))) players.set(String(player.steamid), player);
            }
          } catch { partial = true; }
        }
        const friends = ids.map(id => {
          const player = players.get(id);
          if (!player) partial = true;
          const state = player ? ['offline', 'online', 'busy', 'away', 'snooze', 'online', 'online'][Number(player.personastate)] || 'unknown' : 'unknown';
          const gameId = state !== 'offline' && state !== 'unknown' && /^[1-9]\d*$/.test(String(player?.gameid || '')) ? String(player.gameid) : '';
          return {
            id, name: String(player?.personaname || 'Steam friend').slice(0, 64),
            avatar: safeAvatar(player?.avatarmedium || player?.avatar), state,
            game: gameId ? String(player.gameextrainfo || 'In game').slice(0, 120) : '', gameId,
            lobby: gameId && /^[1-9]\d*$/.test(String(player.lobbysteamid || '')) ? String(player.lobbysteamid) : '',
            lastOnline: Number(player?.lastlogoff) * 1000 || 0
          };
        });
        const order = { online: 0, busy: 1, away: 2, snooze: 3, unknown: 4, offline: 5 };
        friends.sort((a, b) => Number(Boolean(b.gameId)) - Number(Boolean(a.gameId)) || order[a.state] - order[b.state] || a.name.localeCompare(b.name));
        data = { ...empty(partial ? 'partial' : 'ready'), friends, online: friends.filter(friend => !['offline', 'unknown'].includes(friend.state)).length };
      } catch { data = empty('unavailable'); }
      cache = { key, at: now(), data };
      return data;
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }
  return { list };
}
module.exports = { createSteamFriends };
