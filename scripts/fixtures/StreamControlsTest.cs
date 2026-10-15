using System;
using System.Runtime.InteropServices;
class StreamControlsTest {
    [DllImport("user32.dll")] static extern bool PostThreadMessage(uint thread,uint message,UIntPtr wParam,IntPtr lParam);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd;public uint message;public UIntPtr wParam;public IntPtr lParam;public uint time;public int x,y; }
    [DllImport("user32.dll")] static extern bool PeekMessage(out MSG message,IntPtr window,uint min,uint max,uint remove);
    static void Check(bool condition,string reason){if(!condition)throw new Exception(reason);}
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_JoystickAttachVirtual(int type,int axes,int buttons,int hats);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern IntPtr SDL_JoystickOpen(int index);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_JoystickSetVirtualButton(IntPtr joystick,int button,byte value);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_JoystickDetachVirtual(int index);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern void SDL_JoystickClose(IntPtr joystick);
    public static void Main(string[] args){
        // Exercise real Win32 registration and our dispatcher without taking
        // foreground focus from the user or injecting desktop keyboard input.
        var hotkey=new StreamHotkey();var controlsKey=new StreamHotkey(2,0x48);
        try{
            hotkey.Update(true);Check(hotkey.Registered,"Register emergency keyboard shortcut: "+hotkey.Error);
            Check(PostThreadMessage(GetCurrentThreadId(),0x0312,new UIntPtr(1),IntPtr.Zero),"Deliver fixture hotkey message");
            MSG message;Check(PeekMessage(out message,IntPtr.Zero,0x0312,0x0312,1),"Read hotkey message");
            Check(hotkey.Matches(message.message,message.wParam.ToUInt64(),true),"Route keyboard disconnect");
            Check(!hotkey.Matches(message.message,message.wParam.ToUInt64(),false),"Ignore shortcut after focus loss");
            controlsKey.Update(true);Check(controlsKey.Registered,"Register show/hide controls shortcut");
            Check(PostThreadMessage(GetCurrentThreadId(),0x0312,new UIntPtr(2),IntPtr.Zero),"Deliver controls hotkey message");
            Check(PeekMessage(out message,IntPtr.Zero,0x0312,0x0312,1),"Read controls hotkey message");
            Check(controlsKey.Matches(message.message,message.wParam.ToUInt64(),true)&&!hotkey.Matches(message.message,message.wParam.ToUInt64(),true),"Show controls must not disconnect");
            Check(!controlsKey.Matches(0x0312,2,false),"Controls shortcut must ignore another foreground app");
            hotkey.Update(false);Check(!hotkey.Registered&&!hotkey.Matches(0x0312,1,true),"Release shortcut on stream end");
        }finally{hotkey.Update(false);controlsKey.Update(false);}
        var customKey=new StreamHotkey(3,0x4b,6);
        try{customKey.Update(true);Check(customKey.Registered,"Register custom Ctrl + Shift + K");Check(PostThreadMessage(GetCurrentThreadId(),0x0312,new UIntPtr(3),IntPtr.Zero),"Deliver custom shortcut");MSG message;Check(PeekMessage(out message,IntPtr.Zero,0x0312,0x0312,1)&&customKey.Matches(message.message,message.wParam.ToUInt64(),true),"Dispatch custom shortcut");}finally{customKey.Update(false);}
        var chord=new ControllerChord(0x1300);
        Check(!chord.Update(0,0x1300,true,0),"First press must not immediately trigger the fallback");
        Check(!chord.Update(0,0x1300,true,499),"A half-second hold is required");
        Check(chord.Update(0,0x1300,true,500),"The StreamLight combo must disconnect");
        Check(!chord.Update(0,0x1300,false,600),"An unrelated foreground app must not trigger it");
        Check(!chord.Update(0,0x1300,true,700),"Focus loss must reset the hold");
        Check(!chord.Update(0,0,true,800),"Disconnecting the controller must reset the hold");
        Check(!chord.Update(0,0x1300,true,900),"Reconnecting must start a new hold");
        Check(!chord.Update(1,0x1300,true,1400),"One pad must not inherit another pad's hold");
        var moonlight=new ControllerChord(0x330);
        Check(!moonlight.Update(0,0x1300,true,0),"An alternative binding must not use the old combo");
        Check(!moonlight.Update(0,0x330,true,10),"Start four-button hold");
        Check(moonlight.Update(0,0x330,true,510),"Moonlight's four-button combo must work");
        var controls=new ControllerChord(0x320,true);
        Check(!controls.Update(0,0x320,true,0),"Controls require a deliberate hold");
        Check(controls.Update(0,0x320,true,500),"Show/hide controls after half a second");
        Check(!controls.Update(0,0x320,true,1500),"Holding the combo must not flicker controls");
        Check(!controls.Update(0,0x330,true,1600),"The Moonlight quit combo must not toggle controls");
        Check(!controls.Update(0,0x320,true,1700),"A changed combo must reset its hold");
        Check(controls.Update(0,0x320,true,2200),"Controls can toggle again after release");
        Console.WriteLine("Native hotkey and controller hold checks passed. Opening SDL shortcut observer...");
        using(var pads=new ShortcutControllers()){
            pads.Open(args[0]);Check(pads.Available,"Bundled SDL shortcut observer must initialize");Console.WriteLine("SDL shortcut observer initialized.");
            int first=SDL_JoystickAttachVirtual(1,6,15,0),second=SDL_JoystickAttachVirtual(1,6,15,0);Check(first>=0&&second>=0,"Attach shortcut fixture pads");
            var one=SDL_JoystickOpen(first);var two=SDL_JoystickOpen(second);
            try{
                Console.WriteLine("Virtual controllers attached.");pads.Read(0);Console.WriteLine("Virtual controllers opened.");SDL_JoystickSetVirtualButton(one,9,1);SDL_JoystickSetVirtualButton(two,10,1);
                var masks=pads.Read(20);Check(Array.IndexOf(masks,0x100)>=0&&Array.IndexOf(masks,0x200)>=0&&Array.IndexOf(masks,0x300)<0,"SDL shortcut buttons stay isolated per controller");
                SDL_JoystickSetVirtualButton(one,10,1);SDL_JoystickSetVirtualButton(one,3,1);masks=pads.Read(40);Check(Array.IndexOf(masks,0x8300)>=0,"Physical LB + RB + Y maps to the saved mask");
                SDL_JoystickSetVirtualButton(two,10,0);SDL_JoystickDetachVirtual(first);masks=pads.Read(60);Check(Array.IndexOf(masks,0x8300)<0,"Removed controller cannot keep a shortcut held");
                int third=SDL_JoystickAttachVirtual(1,6,15,0);var three=SDL_JoystickOpen(third);pads.Read(1100);SDL_JoystickSetVirtualButton(three,4,1);SDL_JoystickSetVirtualButton(three,9,1);SDL_JoystickSetVirtualButton(three,10,1);masks=pads.Read(1120);Check(Array.IndexOf(masks,0x320)>=0,"Hotplugged controller can open the game page");SDL_JoystickDetachVirtual(third);SDL_JoystickClose(three);
            }finally{SDL_JoystickDetachVirtual(second);SDL_JoystickClose(one);SDL_JoystickClose(two);}
        }
        Console.WriteLine("PASS native default/custom hotkeys; controller hold timing and device isolation; bundled SDL physical shortcuts and hotplug without decoder focus.");
    }
}
