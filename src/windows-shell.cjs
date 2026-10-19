const path = require('node:path');
const { execFile } = require('node:child_process');
const PROJECT_URL = 'https://github.com/ykyritsis/OmniDash';
const SUPPORT_LINKS = Object.freeze({ feedback: `${PROJECT_URL}/issues`, feature: `${PROJECT_URL}/issues/new`, help: `${PROJECT_URL}#getting-started` });
function createWindowsShell({ runtimeDirectory, getWindow, run = execFile, platform = process.platform }) {
  let opening, openedAt = 0;
  function openGameBar() {
    if (opening) return opening;
    // A held or repeated button press would toggle Game Bar straight back off.
    if (Date.now() - openedAt < 1500) return Promise.resolve(true);
    if (platform !== 'win32') return Promise.reject(new Error('Game Bar requires Windows.'));
    const window = getWindow();
    if (!window || window.isDestroyed()) return Promise.reject(new Error('The launcher window is unavailable.'));
    const handle = window.getNativeWindowHandle();
    const id = handle.length >= 8 ? handle.readBigUInt64LE().toString() : String(handle.readUInt32LE());
    opening = new Promise((resolve, reject) => run(path.join(runtimeDirectory, 'WindowsShell.exe'), ['--game-bar', id],
      { windowsHide: true, timeout: 8000, maxBuffer: 16384 }, (error, _stdout, stderr) => {
        if (!error) { openedAt = Date.now(); resolve(true); return; }
        const reason = String(stderr || '').trim() || 'Could not open Game Bar. Reinstall the latest launcher build to restore its Windows component.';
        // Only a missing helper falls back to Windows' own link: after a helper failure Game Bar may already be
        // on screen, and opening the link again would close it.
        if (error.code !== 'ENOENT') { reject(new Error(reason)); return; }
        run('explorer.exe', ['ms-gamebar:'], { windowsHide: true, timeout: 5000 }, protocolError => {
          if (protocolError && protocolError.code !== 1) reject(new Error(reason)); else { openedAt = Date.now(); resolve(true); }
        });
      })).finally(() => { opening = null; });
    return opening;
  }
  // Brings the game's window (a program inside its folder) in front of the launcher.
  // Resolves 'focused', 'none' (no window yet) or 'blocked' (Windows refused).
  function focusGame(folder) {
    if (platform !== 'win32' || !folder) return Promise.resolve('none');
    return new Promise(resolve => run(path.join(runtimeDirectory, 'WindowsShell.exe'), ['--focus-game', String(folder)],
      { windowsHide: true, timeout: 4000, maxBuffer: 4096 }, error => resolve(!error ? 'focused' : error.code === 4 ? 'blocked' : 'none')));
  }
  return { openGameBar, focusGame };
}
module.exports = { createWindowsShell, SUPPORT_LINKS };
