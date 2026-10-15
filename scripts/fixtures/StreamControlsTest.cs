using System;
using System.Runtime.InteropServices;
class StreamControlsTest {
    [DllImport("user32.dll")] static extern bool PostThreadMessage(uint thread,uint message,UIntPtr wParam,IntPtr lParam);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd;public uint message;public UIntPtr wParam;public IntPtr lParam;public uint time;public int x,y; }
    [DllImport("user32.dll")] static extern bool PeekMessage(out MSG message,IntPtr window,uint min,uint max,uint remove);
    static void Check(bool condition,string reason){if(!condition)throw new Exception(reason);}
    public static void Main(){
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
        Console.WriteLine("PASS native hotkey registration, message dispatch and focus guard; controller escape hold timing, device isolation, disconnect and both presets.");
    }
}
