const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('../node_modules/.pnpm/@electron+asar@3.4.1/node_modules/@electron/asar');
const root = path.resolve(__dirname, '..');
const archive = path.resolve(root, process.argv[2] || 'dist/dashboard-027b4/win-unpacked/resources/app.asar');
function walk(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes:true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
// electron-builder intentionally strips development/build fields from package.json.
const expected = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const packaged = JSON.parse(asar.extractFile(archive, 'package.json').toString('utf8'));
for (const key of ['name', 'version', 'main']) assert.equal(packaged[key], expected[key], `Packaged ${key} is stale`);
const sources = walk('src');
for (const file of sources) assert.ok(asar.extractFile(archive, file).equals(fs.readFileSync(path.join(root, file))), `Packaged source is stale: ${file}`);
const entries = asar.listPackage(archive);
for (const [name, version] of Object.entries(expected.dependencies || {})) {
  const dependency = JSON.parse(asar.extractFile(archive, path.join('node_modules', name, 'package.json')).toString('utf8'));
  assert.equal(dependency.version, version, `Missing or stale production dependency: ${name}`);
  assert.ok(asar.extractFile(archive, path.join('node_modules', name, dependency.main)).length, `Dependency entry point missing: ${name}`);
}
assert.ok(!entries.some(file => /interface-sounds\.json|local-settings\.json|\.visual-review|DashX|\.(wav|mp3)$/i.test(file)), 'A private settings/reference/sound file was packaged');
console.log(`PASS: ${sources.length} packaged source files exactly match the workspace; no private settings or sound recordings bundled.`);
