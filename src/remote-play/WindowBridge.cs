// A native child surface for the unmodified StreamLight decoder. Qt's launcher
// windows stay hidden; only its SDL video window becomes a child of our window.
// The engine is in a kill-on-close job so an app crash cannot orphan it.
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

class WindowBridge {
    delegate bool EnumProc(IntPtr window, IntPtr param);
    delegate void WinEventProc(IntPtr hook, uint ev, IntPtr window, int obj, int child, uint thread, uint time);
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int left, top, right, bottom; }
    [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS { public ulong a,b,c,d,e,f; }
    [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT { public long a,b; public uint flags; public UIntPtr min,max; public uint processes; public UIntPtr affinity; public uint priority,scheduling; }
    [StructLayout(LayoutKind.Sequential)] struct JOB_LIMIT { public BASIC_LIMIT basic; public IO_COUNTERS io; public UIntPtr a,b,c,d; }
    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public int x,y; }
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr param);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder name, int length);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr child, IntPtr parent);
    [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr window);
    [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr window, int index, int value);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr window, out RECT rect);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int w, int h, uint flags);
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern IntPtr SetFocus(IntPtr window);
    [DllImport("kernel32.dll", EntryPoint="GetCurrentThreadId")] static extern uint CurrentThread();
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
    [DllImport("user32.dll")] static extern IntPtr SetWinEventHook(uint min, uint max, IntPtr module, WinEventProc proc, uint pid, uint thread, uint flags);
    [DllImport("user32.dll")] static extern bool UnhookWinEvent(IntPtr hook);
    [DllImport("user32.dll")] static extern bool PeekMessage(out MSG message, IntPtr window, uint min, uint max, uint remove);
    [DllImport("user32.dll")] static extern bool TranslateMessage(ref MSG message);
    [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref MSG message);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attr, string name);
    [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int kind, ref JOB_LIMIT info, uint length);
    [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);

    public class Config { public string executable; public string cwd; public string[] args; public string parent; public bool stream; }
    static readonly JavaScriptSerializer Json = new JavaScriptSerializer();
    static Process engine;
    static IntPtr video = IntPtr.Zero, parent = IntPtr.Zero;
    static volatile bool reveal, stopping, inspect;
    static int lastW, lastH;
    static DateTime missingSurfaceSince = DateTime.MinValue;
    static readonly object OutputLock = new object();
    static void Emit(object value) { lock(OutputLock) { Console.WriteLine(Json.Serialize(value)); Console.Out.Flush(); } }
    // CommandLineToArgvW escaping, including a trailing backslash.
    static string Arg(string value) {
        var result = new StringBuilder("\""); int slashes = 0;
        foreach(char c in value) { if(c == '\\') { slashes++; continue; } if(c == '"') { result.Append('\\', slashes * 2 + 1); result.Append(c); } else { result.Append('\\', slashes); result.Append(c); } slashes = 0; }
        result.Append('\\', slashes * 2); return result.Append('"').ToString();
    }
    static void FocusVideo() {
        if(video == IntPtr.Zero) return;
        uint pid; uint target = GetWindowThreadProcessId(video, out pid), own = CurrentThread();
        AttachThreadInput(own, target, true); SetFocus(video); AttachThreadInput(own, target, false);
    }
    static void Inspect(IntPtr window, bool stream) {
        uint pid; GetWindowThreadProcessId(window, out pid);
        if(engine == null || pid != engine.Id) return;
        if(window == video) return;
        var name = new StringBuilder(256); GetClassName(window, name, name.Capacity);
        ShowWindow(window, 0);
        if(!stream || video != IntPtr.Zero || !name.ToString().StartsWith("SDL", StringComparison.OrdinalIgnoreCase)) return;
        // Keep mixed-DPI parenting explicit. The native renderer is sized in
        // physical client pixels, independently of Electron's UI zoom.
        SetThreadDpiAwarenessContext(new IntPtr(-4));
        int style = GetWindowLong(window, -16);
        SetWindowLong(window, -16, (style & ~unchecked((int)0x80CF0000)) | 0x40000000 | 0x04000000);
        SetWindowLong(window, -20, GetWindowLong(window, -20) & ~0x00040000);
        SetParent(window, parent);
        if(GetParent(window) != parent) { Emit(new { type="error", message="Windows could not embed the streaming surface. Check that both apps use the same permissions." }); stopping=true; return; }
        video = window; missingSurfaceSince=DateTime.MinValue;
        Resize(); Emit(new { type="surface", handle=window.ToInt64().ToString() });
    }
    static void Resize() {
        RECT rect;
        if(video == IntPtr.Zero || !GetClientRect(parent, out rect)) return;
        int w = rect.right - rect.left, h = rect.bottom - rect.top;
        if(w == lastW && h == lastH) return;
        lastW=w; lastH=h;
        SetWindowPos(video, IntPtr.Zero, 0, 0, w, h, 0x0020 | 0x0010);
    }
    static int Main(string[] args) {
        IntPtr job=IntPtr.Zero, hook=IntPtr.Zero;
        try {
            var config = Json.Deserialize<Config>(File.ReadAllText(args[0]));
            File.Delete(args[0]);
            parent = new IntPtr(long.Parse(config.parent));
            if(config.stream && !IsWindow(parent)) throw new Exception("The launcher window is unavailable.");
            job = CreateJobObject(IntPtr.Zero, null);
            var limits = new JOB_LIMIT(); limits.basic.flags=0x2000;
            if(job == IntPtr.Zero || !SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits))) throw new Exception("Could not protect the streaming process.");
            var start = new ProcessStartInfo(config.executable, string.Join(" ", Array.ConvertAll(config.args, Arg)));
            start.WorkingDirectory=config.cwd; start.UseShellExecute=false; start.CreateNoWindow=true;
            start.WindowStyle=ProcessWindowStyle.Hidden; start.RedirectStandardOutput=true; start.RedirectStandardError=true;
            engine = new Process(); engine.StartInfo=start;
            engine.OutputDataReceived += (s,e) => { if(e.Data != null) Emit(new { type="stdout", text=e.Data }); };
            engine.ErrorDataReceived += (s,e) => { if(e.Data != null) Emit(new { type="stderr", text=e.Data }); };
            engine.Start();
            if(!AssignProcessToJobObject(job, engine.Handle)) { engine.Kill(); throw new Exception("Could not attach the streaming process to its lifetime guard."); }
            engine.BeginOutputReadLine(); engine.BeginErrorReadLine();
            WinEventProc callback = (h,ev,window,obj,child,thread,time) => { if(obj == 0 && window != video) Inspect(window, config.stream); };
            hook = SetWinEventHook(0x8002, 0x8002, IntPtr.Zero, callback, (uint)engine.Id, 0, 0);
            Emit(new { type="started", pid=engine.Id });
            var commands = new Thread(() => { string line; while((line=Console.ReadLine()) != null) { if(line == "reveal") reveal=true; else if(line == "focus") FocusVideo(); else if(line == "inspect") inspect=true; else if(line == "stop") { stopping=true; break; } } stopping=true; });
            commands.IsBackground=true; commands.Start();
            bool shown=false;
            while(!engine.HasExited && !stopping && (!config.stream || IsWindow(parent))) {
                if(video != IntPtr.Zero && !IsWindow(video)) { video=IntPtr.Zero;lastW=lastH=0;shown=false;missingSurfaceSince=DateTime.UtcNow; }
                EnumWindows((window,param) => { Inspect(window, config.stream); return true; }, IntPtr.Zero);
                MSG message; while(PeekMessage(out message, IntPtr.Zero, 0, 0, 1)) { TranslateMessage(ref message); DispatchMessage(ref message); }
                if(video != IntPtr.Zero) {
                    Resize();
                    if(reveal && !shown) { ShowWindow(video, 5); SetWindowPos(video,IntPtr.Zero,0,0,0,0,0x0040|0x0001|0x0002|0x0010); FocusVideo(); shown=IsWindowVisible(video); if(shown)Emit(new { type="visible" }); }
                    if(inspect) { inspect=false; RECT rect,owner; GetClientRect(video,out rect); GetClientRect(parent,out owner); Emit(new { type="geometry", parent=GetParent(video).ToInt64().ToString(), width=rect.right-rect.left, height=rect.bottom-rect.top, parentWidth=owner.right-owner.left, parentHeight=owner.bottom-owner.top, visible=IsWindowVisible(video), parentVisible=IsWindowVisible(parent), style=GetWindowLong(video,-16), child=(GetWindowLong(video,-16)&0x40000000)!=0 }); }
                }
                if(missingSurfaceSince != DateTime.MinValue && (DateTime.UtcNow-missingSurfaceSince).TotalMilliseconds>750) { Emit(new { type="surface-closed" }); stopping=true; }
                Thread.Sleep(15);
            }
            if(!engine.HasExited) engine.Kill();
            engine.WaitForExit(); Emit(new { type="exit", code=engine.ExitCode });
            GC.KeepAlive(callback); return 0;
        } catch(Exception error) { Emit(new { type="error", message=error.Message }); return 1; }
        finally { if(hook != IntPtr.Zero) UnhookWinEvent(hook); if(job != IntPtr.Zero) CloseHandle(job); }
    }
}
