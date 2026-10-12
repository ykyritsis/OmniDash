// Read-only diagnostic. Reports counts, never local account IDs or raw VDF data.
const fs = require('fs/promises');
const path = require('path');
const { parseVdf, readSteamLocalLibrary } = require('../src/steam-local.cjs');
(async () => {
  const roots = [...new Set([process.env['ProgramFiles(x86)'], process.env.ProgramFiles].filter(Boolean).map(root => path.join(root, 'Steam')))];
  for (const root of roots) {
    let users;
    try { users = parseVdf(await fs.readFile(path.join(root, 'config', 'loginusers.vdf'), 'utf8')).users || {}; } catch { continue; }
    const id = Object.keys(users).find(id => users[id].mostrecent === '1');
    if (!id) continue;
    const result = await readSteamLocalLibrary([root], id);
    console.log(JSON.stringify({ localDataReadable: result.available, hiddenGameCount: result.hiddenIds.length, gamesWithPlaytime: Object.values(result.stats).filter(game => game.minutes > 0).length }));
    return;
  }
  console.log('No current local Steam account found; fixture tests remain available.');
})().catch(() => { console.error('Local Steam diagnostic unavailable'); process.exitCode = 1; });
