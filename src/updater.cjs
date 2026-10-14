// Built-in updates for both the installer and the portable .exe.
//
// The launcher checks the project's GitHub releases in the background, downloads the matching build,
// and checks it against the release's SHA256SUMS.txt before it will install anything. The update is
// applied when you choose "Restart to update", or quietly when the launcher next closes. It never
// installs while a game you launched from here is still running.
const https = require('node:https');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const REPO = 'ykyritsis/xbox-cloud-preview-on-pc';
const CHECK_EVERY = 6 * 60 * 60 * 1000;
const FIRST_CHECK = 20 * 1000;

// "0.27.0-beta.17" → core numbers and pre-release identifiers. A release without a pre-release tag is newer
// than any pre-release of the same version, and "beta.10" is newer than "beta.9".
function parseVersion(text) {
  const match = String(text || '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ? match[4].split('.') : [] };
}
function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return 0;
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] - y.core[i];
  if (!x.pre.length && !y.pre.length) return 0;
  if (!x.pre.length) return 1;
  if (!y.pre.length) return -1;
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined) return -1;
    if (q === undefined) return 1;
    const pNumber = /^\d+$/.test(p), qNumber = /^\d+$/.test(q);
    if (pNumber && qNumber) { if (Number(p) !== Number(q)) return Number(p) - Number(q); }
    else if (pNumber !== qNumber) return pNumber ? -1 : 1;
    else if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

// The newest published release that has the build this copy needs (installer or portable), with its checksums.
function pickRelease(releases, { portable }) {
  for (const release of releases || []) {
    if (release.draft) continue;
    const version = String(release.tag_name || '').replace(/^v/i, '');
    if (!parseVersion(version)) continue;
    const assets = release.assets || [];
    const build = assets.find(asset => asset.name === (portable ? `Xbox-Preview-UI-Portable-${version}.exe` : `Xbox-Preview-UI-Setup-${version}.exe`));
    const sums = assets.find(asset => asset.name === 'SHA256SUMS.txt');
    if (build && sums) return { version, name: build.name, url: build.browser_download_url, size: build.size, sumsUrl: sums.browser_download_url };
  }
  return null;
}

// "<sha256>  <file>" lines, as sha256sum writes them.
function parseChecksums(text) {
  const sums = new Map();
  for (const line of String(text || '').split(/\r?\n/)) {
    const match = line.match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (match) sums.set(match[2].trim(), match[1].toLowerCase());
  }
  return sums;
}

function getText(url, { redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Xbox-Preview-UI-updater', Accept: 'application/vnd.github+json' } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects > 0) {
        response.resume();
        resolve(getText(new URL(response.headers.location, url).href, { redirects: redirects - 1 }));
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`GitHub returned ${response.statusCode}`)); return; }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve(body));
    });
    request.setTimeout(15000, () => request.destroy(new Error('GitHub did not respond')));
    request.on('error', reject);
  });
}

function downloadTo(url, file, { onProgress, redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Xbox-Preview-UI-updater' } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects > 0) {
        response.resume();
        resolve(downloadTo(new URL(response.headers.location, url).href, file, { onProgress, redirects: redirects - 1 }));
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`Download failed (${response.statusCode})`)); return; }
      const total = Number(response.headers['content-length']) || 0;
      let received = 0, last = 0;
      const out = fs.createWriteStream(file);
      response.on('data', chunk => {
        received += chunk.length;
        if (onProgress && (received - last > 512 * 1024 || received === total)) { last = received; onProgress(total ? received / total : 0); }
      });
      response.pipe(out);
      out.on('finish', () => out.close(() => resolve(file)));
      out.on('error', reject);
      response.on('error', reject);
    });
    request.setTimeout(30000, () => request.destroy(new Error('The download stalled')));
    request.on('error', reject);
  });
}

async function sha256(file) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

// Waits for this app to close, then swaps the file in and starts the new copy. Retries while Windows still
// holds the old file, and deletes itself afterwards.
function portableScript({ pid, from, to }) {
  return [
    '@echo off',
    ':wait',
    `tasklist /FI "PID eq ${pid}" 2>nul | find "${pid}" >nul`,
    'if not errorlevel 1 (timeout /t 1 /nobreak >nul & goto wait)',
    ':copy',
    `move /Y "${from}" "${to}" >nul 2>&1`,
    'if errorlevel 1 (timeout /t 1 /nobreak >nul & goto copy)',
    `start "" "${to}"`,
    '(goto) 2>nul & del "%~f0"',
    ''
  ].join('\r\n');
}
// Waits for this app to close, then runs the installer silently over the current install and starts it again.
function installerScript({ pid, setup }) {
  return [
    '@echo off',
    ':wait',
    `tasklist /FI "PID eq ${pid}" 2>nul | find "${pid}" >nul`,
    'if not errorlevel 1 (timeout /t 1 /nobreak >nul & goto wait)',
    `"${setup}" /S --force-run`,
    '(goto) 2>nul & del "%~f0"',
    ''
  ].join('\r\n');
}

function createUpdater({ app, getWindow, isGameRunning, log = () => {}, currentVersion = app.getVersion() }) {
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
  const workDir = path.join(os.tmpdir(), 'xbox-preview-ui-update');
  let status = { state: 'idle', version: '', progress: 0, error: '', checkedAt: 0 };
  let ready = null;      // { version, file, sumsVerified } once a verified build is waiting to be applied
  let busy = false;
  let timer = null;

  function publish(next) {
    status = { ...status, ...next };
    const window = getWindow?.();
    if (window && !window.isDestroyed()) window.webContents.send('updater:status', snapshot());
  }
  function snapshot() {
    return { ...status, currentVersion, portable, ready: Boolean(ready), readyVersion: ready?.version || '' };
  }

  async function check({ force = false } = {}) {
    if (!app.isPackaged) return snapshot();
    if (busy) return snapshot();
    if (ready && !force) return snapshot();
    busy = true;
    publish({ state: 'checking', error: '' });
    try {
      const releases = JSON.parse(await getText(`https://api.github.com/repos/${REPO}/releases?per_page=6`));
      const found = pickRelease(releases, { portable });
      const newer = found && compareVersions(found.version, currentVersion) > 0;
      if (!newer) { publish({ state: 'current', version: currentVersion, checkedAt: Date.now() }); return snapshot(); }
      await fsp.mkdir(workDir, { recursive: true });
      const target = path.join(workDir, found.name);
      publish({ state: 'downloading', version: found.version, progress: 0 });
      const sums = parseChecksums(await getText(found.sumsUrl));
      await downloadTo(found.url, `${target}.partial`, { onProgress: fraction => publish({ progress: fraction }) });
      const expected = sums.get(found.name);
      const actual = await sha256(`${target}.partial`);
      if (!expected || actual !== expected) {
        await fsp.rm(`${target}.partial`, { force: true });
        throw new Error('The download did not match its checksum, so it was discarded.');
      }
      await fsp.rename(`${target}.partial`, target);
      ready = { version: found.version, file: target };
      publish({ state: 'ready', version: found.version, progress: 1, error: '', checkedAt: Date.now() });
      log(`Update ${found.version} is ready`);
      return snapshot();
    } catch (error) {
      publish({ state: 'error', error: error.message || 'The update could not be downloaded.', checkedAt: Date.now() });
      log(`Update check failed: ${error.message}`);
      return snapshot();
    } finally {
      busy = false;
    }
  }

  // Starts the swap script. The script waits for this process to exit, so it's safe to call while the window is open.
  function startSwap() {
    if (!ready) return false;
    const scriptPath = path.join(workDir, `apply-${Date.now()}.cmd`);
    const script = portable
      ? portableScript({ pid: process.pid, from: ready.file, to: process.env.PORTABLE_EXECUTABLE_FILE })
      : installerScript({ pid: process.pid, setup: ready.file });
    fs.mkdirSync(workDir, { recursive: true });
    fs.writeFileSync(scriptPath, script, 'utf8');
    spawn('cmd.exe', ['/d', '/c', `"${scriptPath}"`], { detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: true }).unref();
    return true;
  }

  // "Restart to update": refuses while a game is running, since the restart would close it.
  function installNow() {
    if (!ready) throw new Error('No update is ready yet.');
    if (isGameRunning?.()) throw new Error('Close your game first. The update installs when the launcher closes.');
    publish({ state: 'installing' });
    startSwap();
    app.quit();
    return true;
  }

  // Quietly applies a ready update when the launcher closes. It never waits for a game to finish.
  function applyOnQuit() {
    if (ready && !isGameRunning?.()) startSwap();
  }

  function start() {
    if (!app.isPackaged) return;
    setTimeout(() => check().catch(() => {}), FIRST_CHECK);
    timer = setInterval(() => check().catch(() => {}), CHECK_EVERY);
    timer.unref?.();
  }

  return { start, check, installNow, applyOnQuit, status: () => snapshot(), compareVersions, parseVersion };
}

module.exports = { createUpdater, compareVersions, parseVersion, pickRelease, parseChecksums, portableScript, installerScript };
