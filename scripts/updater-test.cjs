// Updater checks: version ordering, release and checksum parsing, and the swap scripts run against
// throwaway files (the real install is never touched).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { compareVersions, pickRelease, parseChecksums, portableScript, installerScript } = require('../src/updater.cjs');

// Ordering, including beta numbers and a final release beating its betas.
assert.equal(compareVersions('0.27.0-beta.17', '0.27.0-beta.16') > 0, true);
assert.equal(compareVersions('0.27.0-beta.10', '0.27.0-beta.9') > 0, true);
assert.equal(compareVersions('0.27.0', '0.27.0-beta.99') > 0, true);
assert.equal(compareVersions('0.27.0-beta.17', '0.27.0-beta.17'), 0);
assert.equal(compareVersions('0.26.0', '0.27.0-beta.1') < 0, true);
assert.equal(compareVersions('v0.28.0-beta.1', '0.27.0') > 0, true);

// The newest release that has the right build for this copy; drafts and builds without checksums are skipped.
const releases = [
  { tag_name: 'v0.27.0-beta.18', draft: true, assets: [{ name: 'Xbox-Preview-UI-Setup-0.27.0-beta.18.exe', browser_download_url: 'x' }, { name: 'SHA256SUMS.txt', browser_download_url: 'y' }] },
  { tag_name: 'v0.27.0-beta.17', assets: [
    { name: 'Xbox-Preview-UI-Setup-0.27.0-beta.17.exe', browser_download_url: 'https://h/setup', size: 10 },
    { name: 'Xbox-Preview-UI-Portable-0.27.0-beta.17.exe', browser_download_url: 'https://h/portable', size: 11 },
    { name: 'SHA256SUMS.txt', browser_download_url: 'https://h/sums' }] },
  { tag_name: 'v0.27.0-beta.16', assets: [] }
];
assert.equal(pickRelease(releases, { portable: true }).url, 'https://h/portable');
assert.equal(pickRelease(releases, { portable: false }).url, 'https://h/setup');
assert.equal(pickRelease([{ tag_name: 'v1.0.0', assets: [{ name: 'Xbox-Preview-UI-Setup-1.0.0.exe', browser_download_url: 'a' }] }], { portable: false }), null, 'no checksums means no update');

// sha256sum output, with and without the binary marker.
const sums = parseChecksums('a'.repeat(64) + '  Xbox-Preview-UI-Setup-0.27.0-beta.17.exe\r\n' + 'B'.repeat(64) + ' *Xbox-Preview-UI-Portable-0.27.0-beta.17.exe\nnot a line\n');
assert.equal(sums.get('Xbox-Preview-UI-Setup-0.27.0-beta.17.exe'), 'a'.repeat(64));
assert.equal(sums.get('Xbox-Preview-UI-Portable-0.27.0-beta.17.exe'), 'b'.repeat(64));
assert.equal(sums.size, 2);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xpui-update-test-'));
const current = path.join(dir, 'Portable & %TEMP% Ω.exe');
const incoming = path.join(dir, 'new & %TEMP% Ω.exe');
const logged = path.join(dir, 'started.txt');
const errorFile = path.join(dir, 'error.txt');
const host = path.join(process.env.SystemRoot, 'System32', 'wscript.exe');
function runScript(source, name = 'apply.js') {
  const script = path.join(dir, name);
  // Stub only launching: real WMI waits, retries and file replacement run under Windows JScript.
  source = source.replace("var shell = new ActiveXObject('Shell.Application');", `var shell = { ShellExecute: function(file, args) { writeText(${JSON.stringify(logged)}, file + '\\n' + args); } };`);
  fs.writeFileSync(script, '\ufeff' + source, 'utf16le');
  try { execFileSync(host, ['//B', '//Nologo', '//E:JScript', '//T:15', script], { timeout: 18000, windowsHide: true }); return 0; }
  catch (error) { if (error.status !== 1) throw error; return error.status; }
}
function read(file) { return fs.readFileSync(file, 'utf16le').replace(/^\ufeff/, ''); }
async function lifecycleTests() {
  const vm = require('node:vm');
  const { EventEmitter } = require('node:events');
  const crypto = require('node:crypto');
  let launches = 0, quits = 0, exits = 0, killCount = 0, fail = false, running = false;
  let forceExit;
  const sandbox = {
    module: { exports: {} }, __dirname: path.resolve(__dirname, '../src'),
    process: { pid: process.pid, env: { SystemRoot: process.env.SystemRoot, PORTABLE_EXECUTABLE_FILE: current } },
    setTimeout: (fn, ms) => ms === 4000 ? (forceExit = fn, { unref() {} }) : setTimeout(fn, ms),
    setInterval, console,
    require: name => name === 'node:os' ? { tmpdir: () => dir } : name === 'node:child_process' ? { spawn: (_host, args, options) => {
      launches++;
      assert.match(_host, /wscript\.exe$/);
      assert.ok(options.windowsHide && options.detached);
      const child = new EventEmitter();
      child.unref = () => {};
      child.kill = () => { killCount++; };
      const script = args.at(-1);
      const config = JSON.parse(fs.readFileSync(script, 'utf16le').match(/var config = (.*);/)[1]);
      if (fail) process.nextTick(() => child.emit('error', new Error('Helper blocked')));
      else fs.writeFileSync(config.readyFile, 'ready');
      return child;
    } } : require(name)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/updater.cjs'), 'utf8'), sandbox);
  let updater;
  const app = { isPackaged: true, getVersion: () => '1.0.0', quit: () => { quits++; updater.applyOnQuit({ preventDefault() { throw Error('Duplicate swap on quit'); } }); }, exit: () => { exits++; } };
  const bytes = Buffer.from('verified test executable');
  const name = 'Xbox-Preview-UI-Portable-1.0.1.exe';
  updater = sandbox.module.exports.createUpdater({ app, isGameRunning: () => running,
    requestText: async url => url.includes('api.github.com') ? JSON.stringify([{ tag_name: 'v1.0.1', assets: [{ name, browser_download_url: 'build' }, { name: 'SHA256SUMS.txt', browser_download_url: 'sums' }] }]) : crypto.createHash('sha256').update(bytes).digest('hex') + '  ' + name,
    download: async (_url, target) => fs.writeFileSync(target, bytes)
  });
  await updater.check();
  running = true;
  await assert.rejects(updater.installNow(), /Close your game/);
  assert.equal(launches, 0, 'running games block installation');
  running = false; fail = true;
  await assert.rejects(updater.installNow(), /Helper blocked/);
  assert.equal(quits, 0, 'helper failure keeps working launcher open');
  assert.equal(killCount, 1);
  assert.equal(updater.status().state, 'error');
  fail = false;
  await Promise.all([updater.installNow(), updater.installNow()]);
  assert.equal(launches, 2, 'one failed attempt plus exactly one successful helper');
  assert.equal(quits, 1, 'concurrent install and quit start only one shutdown');
  forceExit();
  assert.equal(exits, 1, 'a cancelled normal quit has a bounded force-exit fallback');
}
(async () => {
  try {
    fs.writeFileSync(current, 'OLD'); fs.writeFileSync(incoming, 'NEW');
    const sleeper = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 700)'], { stdio: 'ignore', windowsHide: true });
    const options = { pid: sleeper.pid, from: incoming, to: current, errorFile, timeoutMs: 5000, pollMs: 50 };
    assert.equal(runScript(portableScript(options)), 0);
    assert.equal(fs.readFileSync(current, 'utf8'), 'NEW');
    assert.equal(fs.existsSync(incoming), false);
    assert.equal(read(logged), current + '\n');
    assert.equal(fs.existsSync(path.join(dir, 'apply.js')), false, 'helper cleans itself up');

    fs.writeFileSync(current, 'OLD'); fs.writeFileSync(incoming, 'NEW'); fs.rmSync(logged);
    assert.equal(runScript(portableScript({ ...options, pid: process.pid, timeoutMs: 300 })), 1);
    assert.equal(fs.readFileSync(current, 'utf8'), 'OLD', 'timeout preserves the installed copy');
    assert.match(read(errorFile), /did not close in time/);
    assert.equal(fs.existsSync(logged), false);

    const exited = { ...options, pid: 999999 };
    assert.equal(runScript(portableScript(exited).replace('files.MoveFile(staged, config.to);', 'throw new Error("simulated rename failure");')), 1);
    assert.equal(fs.readFileSync(current, 'utf8'), 'OLD', 'failed replacement rolls back old executable');
    assert.equal(fs.readFileSync(incoming, 'utf8'), 'NEW', 'failed replacement retains verified download');

    // A locked/read-only destination fails in bounded time and leaves the original intact.
    const locked = path.join(dir, 'destination-folder'); fs.mkdirSync(locked);
    assert.equal(runScript(portableScript({ ...exited, to: locked, timeoutMs: 200 })), 1);
    assert.equal(fs.existsSync(locked), true);

    assert.equal(runScript(installerScript({ pid: 999999, setup: incoming, errorFile, timeoutMs: 300, pollMs: 50 }), 'install.js'), 0);
    assert.equal(read(logged), incoming + '\n/S --force-run');
    await lifecycleTests();
    console.log('PASS: real windowless helper, process wait/timeout, portable replacement, rollback, installer handoff, helper failure, running-game guard and single shutdown.');
  } finally {
    const tempRoot = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(path.resolve(dir).startsWith(tempRoot) && path.basename(dir).startsWith('xpui-update-test-'));
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

