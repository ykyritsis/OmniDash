const assert=require('node:assert/strict');
const {createWindowsShell,SUPPORT_LINKS}=require('../src/windows-shell.cjs');
(async()=>{
 let calls=0,finish,fallback,now=1e6;
 const realNow=Date.now;Date.now=()=>now;
 const handle=Buffer.alloc(8);handle.writeBigUInt64LE(0x12345678n);
 const options={runtimeDirectory:'C:/test/runtime',platform:'win32',getWindow:()=>({isDestroyed:()=>false,getNativeWindowHandle:()=>handle}),run:(file,args,config,callback)=>{
  if(file==='explorer.exe'){assert.deepEqual(args,['ms-gamebar:']);fallback=callback;return;}
  calls++;assert(file.endsWith('WindowsShell.exe'));assert.deepEqual(args,['--game-bar','305419896']);assert(config.windowsHide);assert.equal(config.timeout,8000);finish=callback;
 }};
 const bridge=createWindowsShell(options),first=bridge.openGameBar(),second=bridge.openGameBar();
 assert.equal(first,second);assert.equal(calls,1);finish(null,'','');assert.equal(await first,true);
 // A repeat press right after opening must not reach Windows (it would toggle Game Bar off).
 assert.equal(await bridge.openGameBar(),true);assert.equal(calls,1);
 now+=2000;
 const retry=bridge.openGameBar();finish(new Error('failure'),'','Game Bar did not appear.');await assert.rejects(retry,/did not appear/);
 assert.equal(fallback,undefined,'a helper failure must not open the protocol link');
 const viaProtocol=bridge.openGameBar();finish(Object.assign(new Error('missing'),{code:'ENOENT'}),'','');fallback(null);assert.equal(await viaProtocol,true);
 now+=2000;
 const recovered=bridge.openGameBar();finish(null,'','');assert.equal(await recovered,true);
 Date.now=realNow;
 await assert.rejects(createWindowsShell({...options,platform:'linux'}).openGameBar(),/requires Windows/);
 await assert.rejects(createWindowsShell({...options,getWindow:()=>null}).openGameBar(),/unavailable/);
 for(const url of Object.values(SUPPORT_LINKS))assert(url.startsWith('https://github.com/ykyritsis/OmniDash'));
 console.log('PASS native shell arguments, duplicate-press cooldown, no protocol toggle after helper failure, missing-helper fallback, unavailable windows and support links');
})().catch(error=>{console.error(error);process.exitCode=1;});
