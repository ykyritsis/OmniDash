// A local native window fixture; no networking, capture or game launching.
using System;
using System.Runtime.InteropServices;
class StreamSurface {
    static bool keepAlive;static System.Threading.Timer closeTimer;
    delegate IntPtr WndProc(IntPtr h,uint m,IntPtr w,IntPtr l);
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct WNDCLASS { public uint style; public WndProc proc; public int a,b; public IntPtr instance,icon,cursor,background; public string menu,name; }
    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd;public uint message;public UIntPtr wParam;public IntPtr lParam;public uint time;public int x,y; }
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern ushort RegisterClass(ref WNDCLASS c);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowEx(uint ex,string cls,string title,uint style,int x,int y,int w,int h,IntPtr parent,IntPtr menu,IntPtr instance,IntPtr param);
    [DllImport("user32.dll")] static extern IntPtr DefWindowProc(IntPtr h,uint m,IntPtr w,IntPtr l);
    [DllImport("user32.dll")] static extern int GetMessage(out MSG msg,IntPtr h,uint min,uint max);
    [DllImport("user32.dll")] static extern bool TranslateMessage(ref MSG msg);
    [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref MSG msg);
    [DllImport("user32.dll")] static extern void PostQuitMessage(int code);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
    static IntPtr WindowProc(IntPtr h,uint m,IntPtr w,IntPtr l) {
        if(m==5){Console.WriteLine("SIZE "+((long)l&65535)+" "+(((long)l>>16)&65535));Console.Out.Flush();}
        if(m==7){Console.WriteLine("SURFACE_FOCUSED");Console.Out.Flush();}
        if(m==2){if(!keepAlive)PostQuitMessage(0);return IntPtr.Zero;}
        return DefWindowProc(h,m,w,l);
    }
    static void Main(string[] args){
        var proc=new WndProc(WindowProc);var c=new WNDCLASS();c.proc=proc;c.name="SDL_app";c.background=new IntPtr(4);
        RegisterClass(ref c);var window=CreateWindowEx(0,c.name,"Local stream surface fixture",0x10CF0000,0,0,640,480,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero);
        if(args.Length==2&&args[0]=="--close-after"){keepAlive=true;closeTimer=new System.Threading.Timer(s=>PostMessage(window,0x10,IntPtr.Zero,IntPtr.Zero),null,int.Parse(args[1]),System.Threading.Timeout.Infinite);}
        Console.WriteLine("Video stream is 1920x1080x60 (fixture)");Console.Out.Flush();
        MSG msg;while(GetMessage(out msg,IntPtr.Zero,0,0)>0){TranslateMessage(ref msg);DispatchMessage(ref msg);}GC.KeepAlive(proc);GC.KeepAlive(closeTimer);
    }
}
