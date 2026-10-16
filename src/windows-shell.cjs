const path = require('node:path');
const { execFile } = require('node:child_process');
const PROJECT_URL = 'https://github.com/ykyritsis/xbox-cloud-preview-on-pc';
const SUPPORT_LINKS = Object.freeze({ feedback: `${PROJECT_URL}/issues`, feature: `${PROJECT_URL}/issues/new`, help: `${PROJECT_URL}#getting-started` });
function createWindowsShell({ runtimeDirectory, getWindow, run = execFile, platform = process.platform }) {
  let opening;
  function openGameBar() {
    if (opening) return opening;
    if (platform !== 'win32') return Promise.reject(new Error('Game Bar requires Windows.'));
    const window = getWindow();
    if (!window || window.isDestroyed()) return Promise.reject(new Error('The launcher window is unavailable.'));
    const handle = window.getNativeWindowHandle();
    const id = handle.length >= 8 ? handle.readBigUInt64LE().toString() : String(handle.readUInt32LE());
    opening = new Promise((resolve, reject) => run(path.join(runtimeDirectory, 'WindowsShell.exe'), ['--game-bar', id],
      { windowsHide: true, timeout: 8000, maxBuffer: 16384 }, (error, _stdout, stderr) => {
        if (error) reject(new Error(String(stderr || '').trim() || 'Could not open Game Bar. Reinstall the latest launcher build to restore its Windows component.'));
        else resolve(true);
      })).finally(() => { opening = null; });
    return opening;
  }
  return { openGameBar };
}
module.exports = { createWindowsShell, SUPPORT_LINKS };
