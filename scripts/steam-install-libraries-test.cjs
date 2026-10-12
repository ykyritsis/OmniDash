const assert = require('node:assert/strict');
const { libraryKey, installLibrariesByDrive } = require('../src/steam-install-libraries.cjs');
const libraries = [
  { root: 'c:/program files (x86)/steam', free: 100 },
  { root: 'C:\\Program Files (x86)\\Steam\\', free: 100 },
  { root: 'C:\\Games\\Steam', free: 100 },
  { root: 'D:\\SteamLibrary', free: 200 }
];
assert.equal(libraryKey(libraries[0].root), libraryKey(libraries[1].root));
const result = installLibrariesByDrive(libraries, 'c:/games/steam/');
assert.deepEqual(result.map(item => item.drive), ['C:', 'D:']);
assert.equal(result[0].root, 'C:\\Games\\Steam');
assert.equal(result[1].root, 'D:\\SteamLibrary');
assert.equal(installLibrariesByDrive(libraries)[0].root, libraries[0].root);
assert.deepEqual(installLibrariesByDrive([]), []);
console.log('PASS duplicate drive aliases, multiple libraries per drive, saved preference and separate volumes');
