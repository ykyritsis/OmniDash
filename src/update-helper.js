// Windows Script Host JScript (ES3), prepended with a config object by updater.cjs.
// No cmd/tasklist/find/timeout processes: this helper never creates a console.
var files = new ActiveXObject('Scripting.FileSystemObject');
var system = GetObject('winmgmts:{impersonationLevel=impersonate}!\\\\.\\root\\cimv2');
var shell = new ActiveXObject('Shell.Application');
var staged = '', backup = '', replaced = false, oldMoved = false;
function writeText(file, message) {
  var stream = files.CreateTextFile(file, true, true);
  stream.Write(message);
  stream.Close();
}
function remove(file) {
  try { if (file && files.FileExists(file)) files.DeleteFile(file, true); } catch (ignored) {}
}
function processIdentity() {
  var processes = new Enumerator(system.ExecQuery('SELECT CreationDate FROM Win32_Process WHERE ProcessId = ' + config.pid));
  return processes.atEnd() ? '' : String(processes.item().CreationDate);
}
function retry(action, message) {
  var deadline = new Date().getTime() + config.timeoutMs;
  while (true) {
    try { action(); return; } catch (error) {
      if (new Date().getTime() >= deadline) throw new Error(message + ': ' + error.message);
      WScript.Sleep(config.pollMs);
    }
  }
}
try {
  if (!files.FileExists(config.from || config.setup)) throw new Error('The downloaded update is missing.');
  var identity = processIdentity();
  if (config.readyFile) writeText(config.readyFile, 'ready');
  var deadline = new Date().getTime() + config.timeoutMs;
  while (identity && processIdentity() === identity) {
    if (new Date().getTime() >= deadline) throw new Error('The launcher did not close in time. No files were changed.');
    WScript.Sleep(config.pollMs);
  }
  if (config.mode === 'portable') {
    // Stage on the destination drive before touching the working copy. Retain a rollback copy
    // until the complete new executable is in place (also supports updates across drives).
    staged = config.to + '.update-' + config.pid + '.tmp';
    backup = config.to + '.update-' + config.pid + '.bak';
    if (files.FileExists(backup)) throw new Error('A previous backup needs recovery: ' + backup);
    retry(function () { files.CopyFile(config.from, staged, true); }, 'Could not stage the portable update');
    retry(function () { if (files.FileExists(config.to)) { files.MoveFile(config.to, backup); oldMoved = true; } }, 'The portable launcher is still locked');
    try {
      files.MoveFile(staged, config.to);
      replaced = true;
    } catch (error) {
      if (oldMoved) files.MoveFile(backup, config.to);
      oldMoved = false;
      throw error;
    }
    shell.ShellExecute(config.to, '', files.GetParentFolderName(config.to), 'open', 1);
    remove(backup);
    remove(config.from);
  } else {
    // ShellExecute passes a file path directly; no cmd quoting or environment expansion.
    shell.ShellExecute(config.setup, '/S --force-run', files.GetParentFolderName(config.setup), 'open', 0);
  }
  remove(config.errorFile);
} catch (error) {
  if (oldMoved && !replaced && !files.FileExists(config.to)) {
    try { files.MoveFile(backup, config.to); } catch (ignored) {}
  }
  try { writeText(config.errorFile, error.message || String(error)); } catch (ignored) {}
  remove(staged);
  remove(config.readyFile);
  remove(WScript.ScriptFullName);
  WScript.Quit(1);
}
remove(config.readyFile);
remove(WScript.ScriptFullName);
