// Builds the one native helper OmniDash ships: WindowsShell.exe (opens Game Bar and brings a launched game's
// window to the front). It is compiled from src/WindowsShell.cs with the C# compiler that comes with Windows'
// .NET Framework, so the build needs no SDK and nothing is downloaded. Output: .packaging-staging/native.
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.packaging-staging', 'native');

async function prepareNative() {
  if (process.platform !== 'win32') throw new Error('Build the Windows helper on Windows.');
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  const csc = path.join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
  await exec(csc, ['/nologo', '/optimize+', '/target:exe', '/platform:x64', `/out:${path.join(output, 'WindowsShell.exe')}`, path.join(root, 'src', 'WindowsShell.cs')], { windowsHide: true });
  console.log('Prepared the Windows helper (WindowsShell.exe).');
  return output;
}
module.exports = { prepareNative };
if (require.main === module) prepareNative().catch(error => { console.error(error.message); process.exitCode = 1; });
