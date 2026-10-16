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
function pickRelease(releases, { portable, currentVersion }) {
  // The public version was reset from 0.27.0-beta.N to 0.4.0. Keep SemVer
  // comparison standard, but never offer that retired beta line to a new build.
  // Old installed updaters require a one-time manual installation of 0.4.0.
  const legacyBeta = version => /^v?0\.27\.0-beta\.\d+$/.test(String(version));
  for (const release of releases || []) {
    if (release.draft) continue;
    const version = String(release.tag_name || '').replace(/^v/i, '');
    if (!parseVersion(version)) continue;
    if (currentVersion && !legacyBeta(currentVersion) && legacyBeta(version)) continue;
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
      // A mid-download failure used to leave the partial write stream open (and the .partial file
      // behind), because only the response was rejected.
      const fail = error => { out.destroy(); response.destroy(); fs.rm(file, { force: true }, () => {}); reject(error); };
      out.on('error', fail);
      response.on('error', fail);
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

// JScript runs under the GUI Windows Script Host, so Terminal cannot open a console tab.
function swapScript(config) {
  if (!Number.isSafeInteger(config.pid) || config.pid < 1) throw new Error('Invalid launcher PID');
  return 'var config = ' + JSON.stringify({ timeoutMs: 30000, pollMs: 250, ...config }) + ';\r\n'
    + fs.readFileSync(path.join(__dirname, 'update-helper.js'), 'utf8');
}
function portableScript(options) { return swapScript({ ...options, mode: 'portable' }); }
function installerScript(options) { return swapScript({ ...options, mode: 'installer' }); }

function createUpdater({ app, getWindow, isGameRunning, log = () => {}, currentVersion = app.getVersion(), requestText = getText, download = downloadTo }) {
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
  const workDir = path.join(os.tmpdir(), 'xbox-preview-ui-update');
  let status = { state: 'idle', version: '', progress: 0, error: '', checkedAt: 0 };
  let ready = null;      // { version, file, sumsVerified } once a verified build is waiting to be applied
  let busy = false;
  let timer = null;
  let started = false;
  let swapPromise = null;
  let quitting = false;
  let skipOnQuit = false;

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
    if (busy || swapPromise || quitting) return snapshot();
    if (ready && !force) return snapshot();
    busy = true;
    publish({ state: 'checking', error: '' });
    try {
      const releases = JSON.parse(await requestText(`https://api.github.com/repos/${REPO}/releases?per_page=6`));
      const found = pickRelease(releases, { portable, currentVersion });
      const newer = found && compareVersions(found.version, currentVersion) > 0;
      if (!newer) { publish({ state: 'current', version: currentVersion, checkedAt: Date.now() }); return snapshot(); }
      await fsp.mkdir(workDir, { recursive: true });
      const target = path.join(workDir, found.name);
      publish({ state: 'downloading', version: found.version, progress: 0 });
      const sums = parseChecksums(await requestText(found.sumsUrl));
      await download(found.url, `${target}.partial`, { onProgress: fraction => publish({ progress: fraction }) });
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
    if (swapPromise) return swapPromise;
    swapPromise = (async () => {
      const scriptPath = path.join(workDir, `apply-${process.pid}-${Date.now()}.js`);
      const readyFile = `${scriptPath}.ready`, errorFile = `${scriptPath}.error`;
      const options = { pid: process.pid, readyFile, errorFile };
      const script = portable
        ? portableScript({ ...options, from: ready.file, to: process.env.PORTABLE_EXECUTABLE_FILE })
        : installerScript({ ...options, setup: ready.file });
      fs.mkdirSync(workDir, { recursive: true });
      // A BOM lets Windows Script Host read non-ASCII Windows usernames and paths correctly.
      fs.writeFileSync(scriptPath, '\ufeff' + script, 'utf16le');
      const host = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'wscript.exe');
      const child = spawn(host, ['//B', '//Nologo', '//E:JScript', '//T:120', scriptPath], { detached: true, stdio: 'ignore', windowsHide: true });
      let failed = null;
      child.on('error', error => { failed = error; });
      child.on('exit', code => { failed ||= new Error(`Update helper stopped (${code}).`); });
      child.unref();
      try {
        // Do not close a working launcher unless the helper confirms it can run.
        const deadline = Date.now() + 8000;
        while (!fs.existsSync(readyFile)) {
          if (failed) throw failed;
          if (fs.existsSync(errorFile)) throw new Error(fs.readFileSync(errorFile, 'utf16le').replace(/^\ufeff/, ''));
          if (Date.now() >= deadline) throw new Error('The update helper could not start. Run the downloaded installer manually.');
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return true;
      } catch (error) {
        // Stop only the helper we created, never another app or game.
        try { child.kill(); } catch {}
        for (const file of [scriptPath, readyFile]) fs.rmSync(file, { force: true });
        throw error;
      }
    })();
    swapPromise.catch(() => { swapPromise = null; });
    return swapPromise;
  }

  // "Restart to update": refuses while a game is running, since the restart would close it.
  async function installNow() {
    if (quitting) return true;
    if (!ready) throw new Error('No update is ready yet.');
    if (isGameRunning?.()) throw new Error('Close your game first. The update installs when the launcher closes.');
    publish({ state: 'installing' });
    try {
      await startSwap();
      if (quitting) return true;
      quitting = true;
      // beforeunload can cancel app.quit(). Exit this launcher after allowing normal cleanup.
      const exitTimer = setTimeout(() => app.exit(0), 4000);
      exitTimer.unref?.();
      app.quit();
      return true;
    } catch (error) {
      publish({ state: 'error', error: error.message });
      log(`Update could not start: ${error.message}`);
      throw error;
    }
  }

  // Quietly applies a ready update when the launcher closes. It never waits for a game to finish.
  function applyOnQuit(event) {
    if (!ready || quitting || skipOnQuit || isGameRunning?.()) return;
    event.preventDefault();
    installNow().catch(() => {
      // A failed helper must not trap an ordinary attempt to close the app.
      skipOnQuit = true;
      app.quit();
    });
  }

  function start() {
    if (!app.isPackaged || started) return;
    started = true;
    check().catch(() => {});
    timer = setInterval(() => check().catch(() => {}), CHECK_EVERY);
    timer.unref?.();
  }

  return { start, check, installNow, applyOnQuit, status: () => snapshot(), compareVersions, parseVersion };
}

module.exports = { createUpdater, compareVersions, parseVersion, pickRelease, parseChecksums, portableScript, installerScript };
