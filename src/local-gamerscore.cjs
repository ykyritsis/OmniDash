// Keyless PC Gamerscore from the achievements Steam caches on this PC (steam-local-achievements.cjs).
//
// The equation, per game: the game is worth 1,000 G, shared out across its achievements by rarity
// (pc-gamerscore.cjs: weight = 10 + 90 x (1 - sqrt(global unlock % / 100)), so a 1% achievement is worth about
// eight times an achievement nearly everyone has). Each achievement is then rounded to a multiple of 5, the way
// console achievements read, keeping the game's total at exactly 1,000. Your Gamerscore is the sum of the
// points of every achievement you have unlocked. Until a game's global unlock rates are known, its achievements
// share the 1,000 equally; the rates are fetched once per game from Steam's public endpoint and kept on disk.
const fs = require('node:fs/promises');
const pcGamerscore = require('./pc-gamerscore.cjs');
const local = require('./steam-local-achievements.cjs');

const RATES_TTL = 14 * 24 * 60 * 60 * 1000;

// Round a 1,000-point table to multiples of 5 without changing the total (largest remainders win the spare 5s).
function roundToFives(table) {
  const ids = Object.keys(table);
  if (!ids.length) return {};
  const fives = ids.map(id => ({ id, exact: table[id].points / 5 }));
  for (const item of fives) { item.base = Math.max(1, Math.floor(item.exact)); item.rest = item.exact - Math.floor(item.exact); }
  let spare = 200 - fives.reduce((sum, item) => sum + item.base, 0);
  const order = [...fives].sort((a, b) => b.rest - a.rest || (a.id < b.id ? -1 : 1));
  for (let index = 0; spare > 0 && order.length; index = (index + 1) % order.length, spare--) order[index].base++;
  // A game with more than 200 achievements cannot give every one 5 G; take the excess from the commonest ones.
  for (let index = order.length - 1; spare < 0 && index >= 0; index--) if (order[index].base > 1) { order[index].base--; spare++; }
  return Object.fromEntries(fives.map(item => [item.id, item.base * 5]));
}

function createLocalGamerscore({ steamRoots, cacheFile, fetchJson }) {
  let rates = null; // appId -> { at, percent: { apiName: percent } }
  let saving = null;
  const loadRates = async () => {
    if (rates) return rates;
    try { rates = JSON.parse(await fs.readFile(cacheFile, 'utf8')) || {}; } catch { rates = {}; }
    return rates;
  };
  const saveRates = () => {
    clearTimeout(saving);
    saving = setTimeout(() => fs.writeFile(cacheFile, JSON.stringify(rates)).catch(() => {}), 1500);
  };
  async function fetchRates(appId) {
    const data = await fetchJson(`https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${encodeURIComponent(appId)}`);
    const list = data?.achievementpercentages?.achievements || [];
    rates[appId] = { at: Date.now(), percent: Object.fromEntries(list.map(item => [String(item.name), Number(item.percent)])) };
    saveRates();
  }
  let refreshing = null;
  // Fetch missing or stale unlock rates a few at a time; resolves when done (or when `limit` games are fetched).
  function refreshRates(appIds, limit = 60) {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      await loadRates();
      const due = appIds.filter(id => !rates[id] || Date.now() - rates[id].at > RATES_TTL).slice(0, limit);
      for (let index = 0; index < due.length; index += 4) {
        await Promise.all(due.slice(index, index + 4).map(id => fetchRates(id).catch(() => { rates[id] = { at: Date.now(), percent: {} }; })));
      }
      return due.length;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  // Parsed games are kept until Steam rewrites their files, so a refresh only reads what changed (a full parse of
  // a few hundred files would otherwise block the main process for most of a second every few minutes).
  const parsed = new Map();
  async function readCached(steamPath, appId, accountId) {
    const folder = require('node:path').join(steamPath, 'appcache', 'stats');
    const stamp = async name => (await fs.stat(require('node:path').join(folder, name)).catch(() => null))?.mtimeMs || 0;
    const key = `${await stamp(`UserGameStatsSchema_${appId}.bin`)}:${await stamp(`UserGameStats_${accountId}_${appId}.bin`)}`;
    const hit = parsed.get(appId);
    if (hit && hit.key === key) return hit.game;
    const game = await local.readGame(steamPath, appId, accountId);
    parsed.set(appId, { key, game });
    return game;
  }

  // Everything Steam has cached for the signed-in account on this PC, scored.
  async function compute({ titles = new Map() } = {}) {
    await loadRates();
    const roots = await steamRoots();
    let steamPath = '', accountId = '';
    for (const root of roots) {
      const accounts = await local.localAccounts(root);
      if (accounts.length) { steamPath = root; accountId = accounts[0]; break; }
    }
    if (!steamPath) return { available: false, points: 0, unlocked: 0, total: 0, games: [], missingRates: [] };
    const names = await fs.readdir(require('node:path').join(steamPath, 'appcache', 'stats')).catch(() => []);
    const appIds = names.map(name => new RegExp(`^UserGameStats_${accountId}_(\\d+)\\.bin$`).exec(name)?.[1]).filter(Boolean);
    const games = [];
    const missingRates = [];
    for (const appId of appIds) {
      const game = await readCached(steamPath, appId, accountId);
      if (!game || !game.total) continue;
      const known = rates[appId]?.percent || null;
      if (!rates[appId]) missingRates.push(appId);
      const percentages = new Map(Object.entries(known || {}));
      const table = roundToFives(pcGamerscore.pointTable(game.achievements.map(item => ({ apiname: item.id })), percentages));
      const earned = game.achievements.filter(item => item.unlocked);
      const points = earned.reduce((sum, item) => sum + (table[item.id] || 0), 0);
      const last = earned.reduce((max, item) => Math.max(max, item.unlockedAt || 0), 0);
      games.push({
        appId, title: titles.get(appId) || '', points, possible: 1000, unlocked: earned.length, total: game.total,
        completed: earned.length === game.total, lastUnlock: last, ratesKnown: Boolean(known && Object.keys(known).length),
        recent: earned.sort((a, b) => (b.unlockedAt || 0) - (a.unlockedAt || 0)).slice(0, 3).map(item => ({ name: item.name, points: table[item.id] || 0, at: item.unlockedAt || 0 }))
      });
    }
    games.sort((a, b) => b.lastUnlock - a.lastUnlock || b.points - a.points);
    // Every game Steam has cached, unlocked or not, so the dashboard can show the game you last played.
    const byApp = Object.fromEntries(games.map(game => [game.appId, { points: game.points, unlocked: game.unlocked, total: game.total, recent: game.recent }]));
    const points = games.reduce((sum, game) => sum + game.points, 0);
    const unlocked = games.reduce((sum, game) => sum + game.unlocked, 0);
    return {
      available: true, points, unlocked, total: games.reduce((sum, game) => sum + game.total, 0),
      completed: games.filter(game => game.completed).length, level: pcGamerscore.level(points),
      games: games.filter(game => game.unlocked > 0), byApp, missingRates
    };
  }
  return { compute, refreshRates };
}

module.exports = { createLocalGamerscore, roundToFives };
