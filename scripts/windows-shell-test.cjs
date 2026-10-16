const assert=require('node:assert/strict');
const {createWindowsShell,SUPPORT_LINKS}=require('../src/windows-shell.cjs');
(async()=>{
 let calls=0,finish;
 const handle=Buffer.alloc(8);handle.writeBigUInt64LE(0x12345678n);
 const options={runtimeDirectory:'C:/test/runtime',platform:'win32',getWindow:()=>({isDestroyed:()=>false,getNativeWindowHandle:()=>handle}),run:(file,args,config,callback)=>{
  calls++;assert(file.endsWith('WindowsShell.exe'));assert.deepEqual(args,['--game-bar','305419896']);assert(config.windowsHide);assert.equal(config.timeout,8000);finish=callback;
 }};
 const bridge=createWindowsShell(options),first=bridge.openGameBar(),second=bridge.openGameBar();
 assert.equal(first,second);assert.equal(calls,1);finish(null,'','');assert.equal(await first,true);
 const retry=bridge.openGameBar();finish(new Error('failure'),'','Game Bar did not appear.');await assert.rejects(retry,/did not appear/);
 const recovered=bridge.openGameBar();finish(null,'','');assert.equal(await recovered,true);
 await assert.rejects(createWindowsShell({...options,platform:'linux'}).openGameBar(),/requires Windows/);
 await assert.rejects(createWindowsShell({...options,getWindow:()=>null}).openGameBar(),/unavailable/);
 for(const url of Object.values(SUPPORT_LINKS))assert(url.startsWith('https://github.com/ykyritsis/xbox-cloud-preview-on-pc'));
 console.log('PASS native shell arguments, duplicate-click coalescing, error recovery, unavailable windows and GitHub support links');
})().catch(error=>{console.error(error);process.exitCode=1;});
