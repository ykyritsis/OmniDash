const path = require('node:path').win32;

const libraryKey = root => path.normalize(root).replace(/[\\/]+$/, '').toLowerCase();

// Show one destination per volume. Keep the user's chosen Steam library when
// several real library folders live on the same drive; scanning still sees all.
function installLibrariesByDrive(libraries, preferred = '') {
  const drives = new Map();
  for (const library of libraries) {
    const key = path.parse(path.resolve(library.root)).root.toLowerCase();
    if (!drives.has(key) || libraryKey(library.root) === libraryKey(preferred)) {
      drives.set(key, { ...library, drive: path.parse(library.root).root.replace(/\\$/, '') });
    }
  }
  return [...drives.values()];
}

module.exports = { libraryKey, installLibrariesByDrive };
