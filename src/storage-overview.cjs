const path = require('node:path').win32;
const rootKey = folder => path.parse(path.resolve(folder)).root.toLowerCase();
function storageOverview(games, volumes, libraries = []) {
  const drives = new Map(volumes.map(volume => [rootKey(volume.root), { ...volume, games: [], knownGameBytes: 0, unknownGames: 0, libraries: [] }]));
  for (const library of libraries) {
    const drive = drives.get(rootKey(library));
    if (drive && !drive.libraries.some(item => item.toLowerCase() === library.toLowerCase())) drive.libraries.push(library);
  }
  const seen = new Set();
  for (const game of games) {
    if (game.installed === false || game.remoteHostId || game.isApp || game.isLauncher) continue;
    const rawFolder = game.installPath || (game.executable ? path.dirname(game.executable) : '');
    const folder = rawFolder ? path.normalize(rawFolder) : '';
    if (!folder || !path.isAbsolute(folder)) continue;
    const drive = drives.get(rootKey(folder));
    if (!drive) continue;
    const key = path.normalize(folder).replace(/\\+$/, '').toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const bytes = Number(game.sizeOnDisk) > 0 ? Number(game.sizeOnDisk) : null;
    drive.games.push({ id: game.id, title: game.title, provider: game.provider, folder, bytes });
    if (!bytes) drive.unknownGames++;
  }
  for (const drive of drives.values()) {
    const known = drive.games.filter(game => game.bytes);
    // A manually added executable can be inside another game's install folder.
    drive.knownGameBytes = known.filter(game => !known.some(parent => parent !== game && game.folder.toLowerCase().startsWith(parent.folder.toLowerCase().replace(/\\+$/, '') + '\\'))).reduce((sum, game) => sum + game.bytes, 0);
    drive.used = drive.total === null || drive.free === null ? null : Math.max(0, drive.total - drive.free);
    drive.games.sort((a, b) => (b.bytes || 0) - (a.bytes || 0) || a.title.localeCompare(b.title));
  }
  return { drives: [...drives.values()].sort((a, b) => a.root.localeCompare(b.root)), at: Date.now() };
}
module.exports = { storageOverview, rootKey };
