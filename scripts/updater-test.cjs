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

// The portable swap, run for real: an old exe, a new exe, and a process that has already exited.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xpui-update-test-'));
try {
  const current = path.join(dir, 'Xbox Preview UI Portable.exe');
  const incoming = path.join(dir, 'incoming.exe');
  fs.writeFileSync(current, 'OLD');
  fs.writeFileSync(incoming, 'NEW');
  const sleeper = spawn(process.execPath, ['-e', 'setTimeout(()=>{}, 300)'], { stdio: 'ignore' });
  const pid = sleeper.pid;
  sleeper.on('exit', () => {});
  const script = path.join(dir, 'apply.cmd');
  fs.writeFileSync(script, portableScript({ pid, from: incoming, to: current }), 'utf8');
  // The script starts the new copy; a stand-in "start" makes that observable without launching the app.
  const logged = path.join(dir, 'started.txt');
  fs.writeFileSync(script, portableScript({ pid, from: incoming, to: current }).replace(`start "" "${current}"`, `echo started > "${logged}"`), 'utf8');
  execFileSync('cmd.exe', ['/d', '/c', `"${script}"`], { windowsVerbatimArguments: true, timeout: 60000, stdio: 'ignore' });
  assert.equal(fs.readFileSync(current, 'utf8'), 'NEW', 'the portable exe was replaced');
  assert.equal(fs.existsSync(incoming), false, 'the staged copy was moved, not left behind');
  assert.equal(fs.existsSync(logged), true, 'the new copy was started');
  console.log('portable swap ok');

  // The installer script runs setup silently with --force-run once the app has closed.
  const setup = path.join(dir, 'setup.cmd');
  fs.writeFileSync(setup, '@echo off\r\necho %* > "' + path.join(dir, 'args.txt') + '"\r\n', 'utf8');
  const installScript = path.join(dir, 'install.cmd');
  fs.writeFileSync(installScript, installerScript({ pid: 999999, setup }), 'utf8');
  execFileSync('cmd.exe', ['/d', '/c', `"${installScript}"`], { windowsVerbatimArguments: true, timeout: 60000, stdio: 'ignore' });
  assert.match(fs.readFileSync(path.join(dir, 'args.txt'), 'utf8'), /\/S --force-run/);
  console.log('installer script ok');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log('updater tests passed');
