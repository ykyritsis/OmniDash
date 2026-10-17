// Uses the exact SDL DLL shipped with StreamLight. Virtual devices exist only
// inside this fixture; nothing is installed or injected into the gaming host.
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
class StreamGamepad {
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern bool SetDllDirectory(string directory);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern IntPtr FindWindow(string cls,string title);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_Init(uint flags);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern IntPtr SDL_CreateWindow(string title,int x,int y,int width,int height,uint flags);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern uint SDL_GetWindowFlags(IntPtr window);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_SetHintWithPriority(string name,string value,int priority);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_JoystickAttachVirtual(int type,int axes,int buttons,int hats);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern IntPtr SDL_GameControllerOpen(int index);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern IntPtr SDL_GameControllerGetJoystick(IntPtr controller);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_JoystickInstanceID(IntPtr joystick);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_JoystickSetVirtualButton(IntPtr joystick,int button,byte value);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_JoystickSetVirtualAxis(IntPtr joystick,int axis,short value);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_JoystickDetachVirtual(int index);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern void SDL_GameControllerClose(IntPtr controller);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern int SDL_PollEvent(out EVENT value);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern void SDL_DestroyWindow(IntPtr window);
    [DllImport("SDL2.dll",CallingConvention=CallingConvention.Cdecl)] static extern void SDL_Quit();
    [StructLayout(LayoutKind.Explicit,Size=56)] struct EVENT {
        [FieldOffset(0)] public uint type;
        [FieldOffset(8)] public int which;
        [FieldOffset(12)] public byte control;
        [FieldOffset(16)] public short axisValue;
    }
    static int phase,buttons,axes,added,removed,baseline,focused;
    static void Check(bool value,string reason){if(!value)throw new Exception(reason);}
    static void Pump(int id){EVENT e;while(SDL_PollEvent(out e)!=0){
        if(e.type==0x653&&phase>=2)added++;
        if(e.type==0x654&&phase>=2)removed++;
        if(e.which!=id)continue;
        if(e.type==0x651){if(phase==0)focused++;else if(phase==1)baseline++;else if(phase>=2)buttons++;}
        if(e.type==0x650&&phase>=2)axes++;
    }}
    static int Main(string[] args){
        IntPtr window=IntPtr.Zero,controller=IntPtr.Zero;
        try{
            SetDllDirectory(args[0]);Check(SDL_Init(0x20|0x2000)==0,"SDL init");
            SDL_SetHintWithPriority("SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS","0",2);
            window=SDL_CreateWindow("Input fixture - StreamLight",0,0,640,480,4);
            int index=SDL_JoystickAttachVirtual(1,6,15,0);Check(index>=0,"Virtual gamepad attach");
            controller=SDL_GameControllerOpen(index);Check(controller!=IntPtr.Zero,"Virtual gamepad mapping");
            var joystick=SDL_GameControllerGetJoystick(controller);int id=SDL_JoystickInstanceID(joystick);
            var clock=Stopwatch.StartNew();bool sent=false,enabled=false,hotplug=false,focusSent=false,focusChecked=false;bool focusAvailable=false;
            Console.WriteLine("INPUT_READY");Console.Out.Flush();
            while(clock.ElapsedMilliseconds<5000){
                Pump(id);
                if(clock.ElapsedMilliseconds>800&&!focusSent){
                    // The focus assertions below only make sense when this fixture actually owns the
                    // keyboard focus. Checking merely that some foreground window exists is not enough:
                    // with another application in the foreground (a game, or a full screen app on the
                    // same desktop) GetForegroundWindow() is non-zero but our SDL window has no
                    // keyboard focus, so the check failed for an environmental reason instead of a
                    // real one. Require the foreground window to be ours as well.
                    var foreground=GetForegroundWindow();
                    // SDL's own handle is an SDL_Window*, so compare against the Win32 handle found by
                    // title instead of the pointer.
                    var ours=FindWindow(null,"Input fixture - StreamLight");
                    focusAvailable=ours!=IntPtr.Zero&&foreground==ours&&(SDL_GetWindowFlags(window)&0x200)!=0;
                    if(focusAvailable){Check((SDL_GetWindowFlags(window)&0x200)!=0,"Owned SDL must hold keyboard focus while playing");SDL_JoystickSetVirtualButton(joystick,0,1);}
                    else {Console.WriteLine("INPUT_FOCUS_UNAVAILABLE the test desktop is in use by another foreground window, so the keyboard focus checks are skipped");Console.Out.Flush();}
                    focusSent=true;
                }
                if(clock.ElapsedMilliseconds>1200&&!focusChecked){
                    if(focusAvailable)Check(focused>0,"Focused owned controller input must arrive with background input off");
                    SDL_JoystickSetVirtualButton(joystick,0,0);Pump(id);
                    Console.WriteLine(focusAvailable?"INPUT_FOCUSED_PASS":"INPUT_BACKGROUND_START");Console.Out.Flush();focusChecked=true;
                }
                if(clock.ElapsedMilliseconds>1800&&!sent){
                    Check((SDL_GetWindowFlags(window)&0x200)==0,"Test must move keyboard focus away from SDL");
                    phase=1;SDL_JoystickSetVirtualButton(joystick,0,1);sent=true;
                }
                if(clock.ElapsedMilliseconds>2400&&!enabled){
                    Check(baseline==0,"Background input off must reproduce the dropped button");
                    SDL_SetHintWithPriority("SDL_JOYSTICK_ALLOW_BACKGROUND_EVENTS","1",2);phase=2;
                    SDL_JoystickSetVirtualButton(joystick,0,0);SDL_JoystickSetVirtualButton(joystick,1,1);
                    SDL_JoystickSetVirtualButton(joystick,9,1);SDL_JoystickSetVirtualButton(joystick,10,1);
                    SDL_JoystickSetVirtualAxis(joystick,0,20000);SDL_JoystickSetVirtualAxis(joystick,5,28000);enabled=true;
                }
                if(clock.ElapsedMilliseconds>3200&&!hotplug){
                    int next=SDL_JoystickAttachVirtual(1,6,15,0);var pad=SDL_GameControllerOpen(next);Check(pad!=IntPtr.Zero,"Second controller hotplug");
                    Pump(id);SDL_JoystickDetachVirtual(next);Pump(id);SDL_GameControllerClose(pad);hotplug=true;
                }
                Thread.Sleep(10);
            }
            Check(buttons>=3&&axes>=2,"Embedded background gamepad buttons/sticks/triggers must arrive");
            Check(added>=1&&removed>=1,"Controller hotplug/removal events must arrive");
            Console.WriteLine("INPUT_PASS buttons="+buttons+" axes="+axes+" added="+added+" removed="+removed+" baseline="+baseline);Console.Out.Flush();
            SDL_JoystickDetachVirtual(index);return 0;
        }catch(Exception error){Console.WriteLine("INPUT_FAIL "+error.Message);Console.Out.Flush();return 1;}
        finally{if(controller!=IntPtr.Zero)SDL_GameControllerClose(controller);if(window!=IntPtr.Zero)SDL_DestroyWindow(window);SDL_Quit();}
    }
}
