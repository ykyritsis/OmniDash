// Small, windowless bridge for the Windows-owned Game Bar shortcut.
// https://learn.microsoft.com/windows/win32/api/shobjidl_core/nf-shobjidl_core-iapplicationactivationmanager-activateapplication
// https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-sendinput
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

static class WindowsShell {
    [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface ApplicationActivationManager {
        [PreserveSig] int ActivateApplication([MarshalAs(UnmanagedType.LPWStr)] string appId, [MarshalAs(UnmanagedType.LPWStr)] string arguments, uint options, out uint processId);
    }
    [DllImport("ole32.dll")] static extern int CoCreateInstance(ref Guid classId, IntPtr outer, uint context, ref Guid interfaceId, [MarshalAs(UnmanagedType.Interface)] out ApplicationActivationManager manager);
    static void ActivateGameBar() {
        var classId=new Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C");
        var interfaceId=typeof(ApplicationActivationManager).GUID;
        ApplicationActivationManager manager;
        Marshal.ThrowExceptionForHR(CoCreateInstance(ref classId,IntPtr.Zero,4,ref interfaceId,out manager));
        try { uint pid;Marshal.ThrowExceptionForHR(manager.ActivateApplication("Microsoft.XboxGamingOverlay_8wekyb3d8bbwe!App",null,2,out pid)); }
        finally { Marshal.ReleaseComObject(manager); }
    }
    [StructLayout(LayoutKind.Sequential)] struct Keyboard { public ushort key, scan; public uint flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Sequential)] struct Mouse { public int x, y; public uint data, flags, time; public UIntPtr extra; }
    [StructLayout(LayoutKind.Explicit)] struct InputData { [FieldOffset(0)] public Keyboard keyboard; [FieldOffset(0)] public Mouse mouse; }
    [StructLayout(LayoutKind.Sequential)] struct Input { public uint type; public InputData data; }
    [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, Input[] inputs, int size);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    delegate bool WindowCallback(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);
    static Input Key(ushort key, bool up) { return new Input { type=1, data=new InputData { keyboard=new Keyboard { key=key, flags=(up?2u:0u)|(key==0x5B?1u:0u) } } }; }
    static bool GameBarVisible() {
        uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid);
        try { using(var process=Process.GetProcessById((int)pid)) if(process.ProcessName.Equals("GameBar",StringComparison.OrdinalIgnoreCase))return true; } catch { }
        bool visible=false;
        EnumWindows((window,parameter)=>{
            if(!IsWindowVisible(window))return true;
            int cloaked;if(DwmGetWindowAttribute(window,14,out cloaked,4)!=0||cloaked!=0)return true;
            uint owner;GetWindowThreadProcessId(window,out owner);
            try { using(var process=Process.GetProcessById((int)owner))visible=process.ProcessName.Equals("GameBar",StringComparison.OrdinalIgnoreCase); } catch { }
            return !visible;
        },IntPtr.Zero);
        return visible;
    }
    static bool KeysHeld() {
        foreach(int key in new[]{0x10,0x11,0x12,0x5B,0x5C,0x47}) if((GetAsyncKeyState(key)&0x8000)!=0)return true;
        return false;
    }
    [STAThread] static int Main(string[] args) {
        try {
            if(args.Length==1&&args[0]=="--probe") { Console.WriteLine(Marshal.SizeOf(typeof(Input))); return 0; }
            if(args.Length!=2||args[0]!="--game-bar") throw new Exception("Unknown shell action.");
            if(GameBarVisible()) return 0;
            var window=new IntPtr(long.Parse(args[1]));
            if(window==IntPtr.Zero||!IsWindow(window))throw new Exception("The launcher window is unavailable.");
            try { ActivateGameBar(); } catch { }
            Thread.Sleep(250);
            if(GameBarVisible())return 0;
            // Wait for a keyboard activation key to be released. Never disturb
            // physically held modifiers or send the shortcut to another app.
            var clock=Stopwatch.StartNew();
            while(KeysHeld()&&clock.ElapsedMilliseconds<1200)Thread.Sleep(15);
            if(KeysHeld())throw new Exception("Release the keyboard modifiers and try Game Bar again.");
            if(GetAncestor(GetForegroundWindow(),2)!=GetAncestor(window,2))throw new Exception("Return to the launcher and try Game Bar again.");
            var inputs=new[]{Key(0x5B,false),Key(0x47,false)};
            uint sent;
            try { sent=SendInput((uint)inputs.Length,inputs,Marshal.SizeOf(typeof(Input))); Thread.Sleep(80); }
            finally {
                SendInput(2,new[]{Key(0x47,true),Key(0x5B,true)},Marshal.SizeOf(typeof(Input)));
            }
            if(sent!=inputs.Length) {
                throw new Exception("Windows blocked the Game Bar shortcut. Run the launcher without administrator privileges.");
            }
            clock.Restart();
            while(clock.ElapsedMilliseconds<5000){if(GameBarVisible())return 0;Thread.Sleep(50);}
            throw new Exception("Game Bar did not appear. Check Windows Settings > Gaming > Game Bar, or repair Game Bar in Windows Installed apps.");
        } catch(Exception error) { Console.Error.WriteLine(error.Message); return 1; }
    }
}
