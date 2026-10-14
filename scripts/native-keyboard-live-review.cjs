const { app, BrowserWindow } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createNativeKeyboard } = require('../src/native-keyboard.cjs');
const output = path.resolve(__dirname, '../.visual-review/native-keyboard-live.json');
app.whenReady().then(async () => {
  const report = {};
  const win = new BrowserWindow({ width: 700, height: 300, title: 'Native keyboard check', webPreferences: { sandbox: true } });
  try {
    await win.loadURL('data:text/html,<title>Native keyboard check</title><input autofocus placeholder="Windows keyboard test" style="font:24px Segoe UI;margin:70px;width:500px">');
    win.focus();
    await new Promise(resolve => setTimeout(resolve, 500));
    const show = createNativeKeyboard({ run: (file, args, options, callback) => execFile(file, args, options, (error, stdout, stderr) => { report.stderr = stderr; callback(error, stdout, stderr); }) });
    const handle = win.getNativeWindowHandle();
    report.result = await show(handle.readBigUInt64LE());
    await new Promise(resolve => setTimeout(resolve, 1000));
    report.ok = true;
  } catch (error) { report.error = error.message; }
  finally { fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2)); win.close(); app.exit(report.ok ? 0 : 1); }
});
