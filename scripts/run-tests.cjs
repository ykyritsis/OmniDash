// Test runner for the scripts/*-test.cjs suites. Each file is a standalone script that throws or
// exits non-zero on failure. Scripts that need the Electron runtime (they require('electron') and
// use app/BrowserWindow) are run with the bundled Electron binary; the rest run under plain Node.
//
// Usage (from package.json):
//   npm test                 run every suite
//   npm test -- title-match  run suites whose file name contains "title-match"
//   npm test -- --unit       run only suites that work under plain Node
//   npm test -- --electron   run only suites that need Electron
//   npm test -- --list       list what would run, without running it
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const scriptsDir = path.join(root, 'scripts');

const args = process.argv.slice(2);
const onlyUnit = args.includes('--unit');
const onlyElectron = args.includes('--electron');
const listOnly = args.includes('--list');
const filters = args.filter(a => !a.startsWith('--'));

// A suite needs Electron when it imports the module and touches runtime APIs. Requiring
// 'electron' under plain Node returns the path string, so check for the API shape instead.
function needsElectron(file) {
  const text = fs.readFileSync(file, 'utf8');
  return /require\(['"]electron['"]\)/.test(text) && /\b(app|BrowserWindow|ipcMain|session|webContents)\b/.test(text);
}

function resolveElectronBinary() {
  const candidates = [
    path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'),
    path.join(root, 'node_modules', 'electron', 'dist', 'electron')
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function resolveNodeBinary() {
  return process.env.DSH_NODE_BINARY || process.execPath;
}

const electronBinary = resolveElectronBinary();
const nodeBinary = resolveNodeBinary();

const suites = fs.readdirSync(scriptsDir)
  .filter(name => name.endsWith('-test.cjs'))
  .filter(name => !filters.length || filters.some(f => name.includes(f)))
  .map(name => {
    const file = path.join(scriptsDir, name);
    return { name, file, electron: needsElectron(file) };
  })
  .filter(s => (onlyUnit ? !s.electron : true))
  .filter(s => (onlyElectron ? s.electron : true))
  .sort((a, b) => a.name.localeCompare(b.name));

if (listOnly) {
  for (const s of suites) console.log(`${s.electron ? 'electron' : 'node    '}  ${s.name}`);
  console.log(`\n${suites.length} suite(s)`);
  process.exit(0);
}

if (onlyElectron && !electronBinary) {
  console.error('Electron suites requested but node_modules/electron/dist was not found.');
  process.exit(1);
}

function run(suite) {
  const binary = suite.electron ? electronBinary : nodeBinary;
  return new Promise(resolve => {
    const started = Date.now();
    // Never inherit an Electron-as-Node flag: it would turn the Electron binary into plain Node.
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = spawn(binary, [suite.file], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    const timer = setTimeout(() => { child.kill(); }, 180000);
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ ...suite, code, ms: Date.now() - started, out });
    });
  });
}

(async () => {
  const results = [];
  for (const suite of suites) {
    const result = await run(suite);
    results.push(result);
    const label = result.code === 0 ? 'PASS' : 'FAIL';
    const runtime = result.electron ? 'electron' : 'node';
    console.log(`${label}  ${suite.name.padEnd(38)} ${runtime.padEnd(9)} ${result.ms} ms`);
    if (result.code !== 0) {
      const tail = result.out.trim().split('\n').slice(-25).join('\n');
      console.log(tail.replace(/^/gm, '      '));
    }
  }
  const passed = results.filter(r => r.code === 0).length;
  const failed = results.length - passed;
  console.log(`\n${passed} passed, ${failed} failed, ${results.length} total`);
  if (failed) {
    console.log('Failed: ' + results.filter(r => r.code !== 0).map(r => r.name).join(', '));
  }
  process.exit(failed ? 1 : 0);
})();
