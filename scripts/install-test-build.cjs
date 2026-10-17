// Installs the current working tree into the owner's installed copy of the launcher.
//
//   ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/electron.exe scripts/install-test-build.cjs
//
// What it does (the procedure from docs/HANDOVER-themes.md, made repeatable):
//   1. Refuses to run while "Xbox Preview UI" is running, so a half-written app.asar is never loaded.
//   2. Copies resources\app.asar and app.asar.unpacked to resources\backup-<version>-test<N>.
//   3. Extracts the installed asar to a temp folder (keeps node_modules and the stripped package.json).
//   4. Overlays this repo's src\ (and build icons), keeps the packaged package.json.
//   5. Packs with src/xbox-mode-bridge unpacked, as electron-builder does, and copies it back.
//
// The version is not changed: test builds all report the release version, as before.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

// Electron-as-node patches fs so anything ending in ".asar" is read as an archive: stat() on app.asar then
// reports a 0-byte virtual root and access() says ENOENT. This script copies archive *files*, so turn that off.
process.noAsar = true;

const repo = path.resolve(__dirname, '..');
const resources = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Xbox Preview UI', 'resources');
const UNPACK_DIR = 'src/xbox-mode-bridge';

function asarModule() {
  const store = path.join(repo, 'node_modules', '.pnpm');
  return fs.readdir(path.join(store))
    .then(entries => entries.filter(name => name.startsWith('@electron+asar@')).sort().pop())
    .then(name => (name ? path.join(store, name, 'node_modules', '@electron', 'asar') : ''));
}

async function findAsar() {
  const candidate = await asarModule();
  if (candidate) return candidate;
  // A normal install would resolve it directly; this covers a hoisted layout.
  return path.dirname(require.resolve('@electron/asar/package.json', { paths: [repo] }));
}

function running() {
  try {
    const out = execFileSync('tasklist', ['/FI', 'IMAGENAME eq Xbox Preview UI.exe', '/NH'], { encoding: 'utf8' });
    return /Xbox Preview UI\.exe/i.test(out);
  } catch {
    return false;
  }
}

async function exists(file) { return fs.access(file).then(() => true, () => false); }

async function backup(resources, version) {
  let highest = 0;
  for (const name of await fs.readdir(resources)) {
    const match = /^backup-\d+\.\d+\.\d+-test(\d+)$/.exec(name);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  const target = path.join(resources, `backup-${version}-test${highest + 1}`);
  await fs.mkdir(target, { recursive: true });
  await fs.copyFile(path.join(resources, 'app.asar'), path.join(target, 'app.asar'));
  await fs.cp(path.join(resources, 'app.asar.unpacked'), path.join(target, 'app.asar.unpacked'), { recursive: true });
  return target;
}

(async () => {
  if (!(await exists(resources))) throw new Error(`Not installed here: ${resources}`);
  if (running()) throw new Error('Xbox Preview UI is running. Close it first, then install.');
  const asar = require(await findAsar());
  const installedAsar = path.join(resources, 'app.asar');
  if (!(await exists(installedAsar))) throw new Error(`No app.asar in ${resources}`);
  // The packaged package.json is the stripped one electron-builder ships; keep it exactly as it is.
  const packedPackage = asar.extractFile(installedAsar, 'package.json').toString();
  const version = JSON.parse(packedPackage).version || '0.0.0';
  const target = await backup(resources, version);
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'xpu-install-'));
  const stage = path.join(work, 'stage');
  await asar.extractAll(installedAsar, stage);
  await fs.rm(path.join(stage, 'src'), { recursive: true, force: true });
  await fs.cp(path.join(repo, 'src'), path.join(stage, 'src'), { recursive: true });
  for (const icon of ['icon.svg', 'icon.png']) {
    await fs.copyFile(path.join(repo, 'build', icon), path.join(stage, 'build', icon));
  }
  await fs.writeFile(path.join(stage, 'package.json'), packedPackage);
  const output = path.join(work, 'app.asar');
  await asar.createPackageWithOptions(stage, output, { unpackDir: UNPACK_DIR });
  await fs.copyFile(output, installedAsar);
  await fs.rm(path.join(resources, 'app.asar.unpacked'), { recursive: true, force: true });
  await fs.cp(path.join(work, 'app.asar.unpacked'), path.join(resources, 'app.asar.unpacked'), { recursive: true });
  await fs.rm(work, { recursive: true, force: true });
  const size = (await fs.stat(installedAsar)).size;
  console.log(`Backed up the previous build to ${path.basename(target)}.`);
  console.log(`Installed ${(size / 1048576).toFixed(1)} MB app.asar (version ${version}) into ${resources}.`);
})().catch(error => {
  console.error('Install failed:', error.message);
  process.exitCode = 1;
});
