const path = require('node:path');
const { execFile } = require('node:child_process');

// Windows' desktop InputPane API: show is idempotent, unlike toggling TabTip.
// https://learn.microsoft.com/windows/win32/api/inputpaneinterop/nf-inputpaneinterop-iinputpaneinterop-getforwindow
const INPUT_PANE_SOURCE = `
using System;
using System.Runtime.InteropServices;
public static class LauncherInputPane {
  [ComImport, Guid("75CF2C57-9195-4931-8332-F0B409E916AF"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IInputPaneInterop {
    void GetIids(out uint count, out IntPtr ids);
    void GetRuntimeClassName(out IntPtr name);
    void GetTrustLevel(out int level);
    [return: MarshalAs(UnmanagedType.Interface)] IInputPane2 GetForWindow(IntPtr window, ref Guid iid);
  }
  [ComImport, Guid("8A6B3F26-7090-4793-944C-C3F2CDE26276"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IInputPane2 {
    void GetIids(out uint count, out IntPtr ids);
    void GetRuntimeClassName(out IntPtr name);
    void GetTrustLevel(out int level);
    [return: MarshalAs(UnmanagedType.U1)] bool TryShow();
    [return: MarshalAs(UnmanagedType.U1)] bool TryHide();
  }
  [DllImport("combase.dll")] static extern int RoInitialize(uint mode);
  [DllImport("combase.dll")] static extern void RoUninitialize();
  [DllImport("combase.dll", CharSet=CharSet.Unicode)] static extern int WindowsCreateString(string text, int length, out IntPtr value);
  [DllImport("combase.dll")] static extern int WindowsDeleteString(IntPtr value);
  [DllImport("combase.dll")] static extern int RoGetActivationFactory(IntPtr name, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IInputPaneInterop factory);
  public static bool Show(long window) {
    int initialized = RoInitialize(0);
    IntPtr name = IntPtr.Zero;
    IInputPaneInterop factory = null;
    IInputPane2 pane = null;
    try {
      string type = "Windows.UI.ViewManagement.InputPane";
      Marshal.ThrowExceptionForHR(WindowsCreateString(type, type.Length, out name));
      Guid factoryId = typeof(IInputPaneInterop).GUID;
      Marshal.ThrowExceptionForHR(RoGetActivationFactory(name, ref factoryId, out factory));
      Guid paneId = typeof(IInputPane2).GUID;
      pane = factory.GetForWindow(new IntPtr(window), ref paneId);
      return pane.TryShow();
    } finally {
      if (pane != null) Marshal.ReleaseComObject(pane);
      if (factory != null) Marshal.ReleaseComObject(factory);
      if (name != IntPtr.Zero) WindowsDeleteString(name);
      if (initialized >= 0) RoUninitialize();
    }
  }
}`;

function createNativeKeyboard({ run = execFile, platform = process.platform, demo = false } = {}) {
  let pending = null;
  return function show(windowHandle) {
    if (platform !== 'win32') return Promise.reject(new Error('The native keyboard requires Windows.'));
    if (pending) return pending;
    const handle = BigInt(windowHandle);
    if (handle <= 0n) return Promise.reject(new Error('The text-entry window is unavailable.'));
    if (demo) return Promise.resolve({ shown: true, simulated: true });
    const command = `$ErrorActionPreference = 'Stop'\nAdd-Type -TypeDefinition @'\n${INPUT_PANE_SOURCE}\n'@\nif ([LauncherInputPane]::Show(${handle})) { 'shown' } else { throw 'Windows could not show its touch keyboard.' }`;
    const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    pending = new Promise((resolve, reject) => {
      run(executable, ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64')], { windowsHide: true, timeout: 10000 }, (error, stdout) => {
        if (error || !stdout.includes('shown')) reject(new Error('Windows could not open its touch keyboard. Check that the Windows text input service is available.'));
        else resolve({ shown: true });
      });
    }).finally(() => { pending = null; });
    return pending;
  };
}
module.exports = { createNativeKeyboard };
