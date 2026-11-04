// Steam achievements from this PC's own Steam cache, with no Web API key.
//
// Steam keeps two binary KeyValues files per game in <Steam>/appcache/stats:
//   UserGameStatsSchema_<appid>.bin             the achievement list (stat blocks of type 4, one bit per achievement)
//   UserGameStats_<accountid>_<appid>.bin       the signed-in account's progress: per stat block a "data" bitfield,
//                                               and AchievementTimes (bit -> unlock time)
// Reading them is offline and instant, and works when the Steam profile is private. Global unlock rates (for the
// Gamerscore split) come from Steam's public, keyless GetGlobalAchievementPercentagesForApp.
const fs = require('node:fs/promises');
const path = require('node:path');

// ---------- Binary KeyValues ----------
const TYPE = { MAP: 0, STRING: 1, INT32: 2, FLOAT32: 3, POINTER: 4, WSTRING: 5, COLOR: 6, UINT64: 7, END: 8, INT64: 10, END_ALT: 11 };
function parseBinaryKv(buffer) {
  let at = 0;
  const cstring = () => {
    const end = buffer.indexOf(0, at);
    if (end < 0) throw new Error('Truncated string');
    const text = buffer.toString('utf8', at, end);
    at = end + 1;
    return text;
  };
  const map = depth => {
    if (depth > 32) throw new Error('Nested too deeply');
    const out = {};
    while (at < buffer.length) {
      const type = buffer[at++];
      if (type === TYPE.END || type === TYPE.END_ALT) return out;
      const key = cstring();
      switch (type) {
        case TYPE.MAP: out[key] = map(depth + 1); break;
        case TYPE.STRING: out[key] = cstring(); break;
        case TYPE.INT32: case TYPE.POINTER: case TYPE.COLOR: out[key] = buffer.readInt32LE(at); at += 4; break;
        case TYPE.FLOAT32: out[key] = buffer.readFloatLE(at); at += 4; break;
        case TYPE.UINT64: out[key] = buffer.readBigUInt64LE(at).toString(); at += 8; break;
        case TYPE.INT64: out[key] = buffer.readBigInt64LE(at).toString(); at += 8; break;
        case TYPE.WSTRING: { const end = buffer.indexOf('\0\0', at, 'utf16le'); out[key] = buffer.toString('utf16le', at, end < 0 ? buffer.length : end); at = end < 0 ? buffer.length : end + 2; break; }
        default: throw new Error(`Unknown KeyValues type ${type}`);
      }
    }
    return out;
  };
  return map(0);
}

const lower = object => Object.fromEntries(Object.entries(object || {}).map(([key, value]) => [key.toLowerCase(), value]));
const isAchievementBlock = block => {
  const type = lower(block).type;
  return Number(type) === 4 || String(type).toUpperCase() === 'ACHIEVEMENTS';
};

// Every achievement the schema lists: { id (API name), name, description, hidden, statId, bit }.
function schemaAchievements(schema, appId) {
  const root = schema[String(appId)] || Object.values(schema)[0] || {};
  const stats = lower(root).stats || {};
  const list = [];
  for (const [statId, block] of Object.entries(stats)) {
    if (!block || typeof block !== 'object' || !isAchievementBlock(block)) continue;
    for (const [bitKey, bit] of Object.entries(lower(block).bits || {})) {
      const entry = lower(bit);
      const display = lower(entry.display);
      const text = value => (typeof value === 'string' ? value : value && typeof value === 'object' ? lower(value).english || Object.values(value)[0] || '' : '');
      const id = typeof entry.name === 'string' ? entry.name : '';
      if (!id) continue;
      list.push({
        id, statId: String(statId), bit: Number.isFinite(Number(entry.bit)) ? Number(entry.bit) : Number(bitKey),
        name: text(display.name) || id, description: text(display.desc), hidden: String(display.hidden) === '1'
      });
    }
  }
  return list;
}
// Unlocked API names (with unlock times) from the player's stats file.
function unlockedFrom(stats, achievements) {
  const cache = lower(stats.cache || Object.values(stats)[0] || {});
  const blocks = Object.fromEntries(Object.entries(cache).map(([key, value]) => [String(key), value]));
  const unlocked = new Map();
  for (const item of achievements) {
    const block = lower(blocks[item.statId]);
    const data = Number(block.data) >>> 0;
    const times = lower(block.achievementtimes);
    if (((data >>> item.bit) & 1) === 1) unlocked.set(item.id, Number(times[String(item.bit)]) || 0);
  }
  return unlocked;
}

async function readFileMaybe(file) { try { return await fs.readFile(file); } catch { return null; } }

// The account ids that have stats on this PC, most recently written first.
async function localAccounts(steamPath) {
  const folder = path.join(steamPath, 'appcache', 'stats');
  let names = [];
  try { names = await fs.readdir(folder); } catch { return []; }
  const seen = new Map();
  for (const name of names) {
    const match = /^UserGameStats_(\d+)_\d+\.bin$/.exec(name);
    if (!match) continue;
    const stat = await fs.stat(path.join(folder, name)).catch(() => null);
    if (stat) seen.set(match[1], Math.max(seen.get(match[1]) || 0, stat.mtimeMs));
  }
  return [...seen].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

// One game's achievements and the signed-in player's unlocks, or null when Steam has nothing cached for it.
async function readGame(steamPath, appId, accountId) {
  const folder = path.join(steamPath, 'appcache', 'stats');
  const schemaBuffer = await readFileMaybe(path.join(folder, `UserGameStatsSchema_${appId}.bin`));
  if (!schemaBuffer) return null;
  let achievements;
  try { achievements = schemaAchievements(parseBinaryKv(schemaBuffer), appId); } catch { return null; }
  if (!achievements.length) return null;
  let unlocked = new Map();
  const statsBuffer = accountId ? await readFileMaybe(path.join(folder, `UserGameStats_${accountId}_${appId}.bin`)) : null;
  if (statsBuffer) { try { unlocked = unlockedFrom(parseBinaryKv(statsBuffer), achievements); } catch { unlocked = new Map(); } }
  return {
    appId: String(appId), total: achievements.length, unlockedCount: unlocked.size, hasProgress: Boolean(statsBuffer),
    achievements: achievements.map(item => ({ id: item.id, name: item.name, description: item.hidden ? '' : item.description, unlocked: unlocked.has(item.id), unlockedAt: unlocked.get(item.id) || 0 }))
  };
}

module.exports = { parseBinaryKv, schemaAchievements, unlockedFrom, localAccounts, readGame };
