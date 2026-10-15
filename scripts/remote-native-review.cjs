const {app,BrowserWindow,screen}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {spawn,execFile}=require('node:child_process');
const {promisify}=require('node:util');
const assert=require('node:assert/strict');
const https=require('node:https');
const crypto=require('node:crypto');
const {parseIni,wireRequest}=require('../src/remote-play.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.visual-review','remote-native');
app.setPath('userData',path.join(output,'profile'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let bridge,win;const events=[];
async function until(test){for(let i=0;i<200;i++){if(test())return;await pause(25);}throw new Error('Native bridge did not reach the expected state.');}
app.whenReady().then(async()=>{
  await fs.mkdir(output,{recursive:true});
  const fixture=path.join(output,'StreamSurface.exe');
  const controls=path.join(output,'StreamControlsTest.exe');
  await promisify(execFile)(path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe','/main:StreamControlsTest','/r:System.Web.Extensions.dll',`/out:${controls}`,path.join(__dirname,'fixtures','StreamControlsTest.cs'),path.join(root,'src','remote-play','WindowBridge.cs')],{windowsHide:true});
  console.log((await promisify(execFile)(controls,[],{windowsHide:true})).stdout.trim());
  await promisify(execFile)(path.join(process.env.WINDIR,'Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe',`/out:${fixture}`,path.join(__dirname,'fixtures','StreamSurface.cs')],{windowsHide:true});
  win=new BrowserWindow({width:1280,height:800,frame:false,show:false,webPreferences:{sandbox:true,contextIsolation:true}});
  await win.loadURL('data:text/html,<body style="background:%23171920;color:white;font:24px sans-serif">Native stream surface review</body>');win.show();await pause(40);win.hide();win.show();win.focus();
  const handle=win.getNativeWindowHandle(),parent=handle.readBigUInt64LE().toString();
  const config=path.join(output,'bridge.json');await fs.writeFile(config,JSON.stringify({executable:fixture,cwd:output,args:['--close-after','3200'],parent,stream:true,viewport:{top:80,height:800}}));
  bridge=spawn(path.join(root,'.packaging-staging','streamlight','WindowBridge.exe'),[config],{stdio:['pipe','pipe','pipe'],windowsHide:true});
  let buffer='';bridge.stdout.on('data',chunk=>{buffer+=chunk;const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)try{events.push(JSON.parse(line));}catch{}});
  let exited=false;bridge.on('exit',()=>{exited=true;});
  await until(()=>events.some(event=>event.type==='surface')||events.some(event=>event.type==='error'));
  assert(!events.some(event=>event.type==='error'),JSON.stringify(events));
  const geometry=async()=>{const count=events.filter(e=>e.type==='geometry').length;bridge.stdin.write('inspect\n');await until(()=>events.filter(e=>e.type==='geometry').length>count);return events.filter(e=>e.type==='geometry').at(-1);};
  let value=await geometry();assert.equal(value.parent,parent);assert.equal(value.child,true);assert.equal(value.visible,false,'Surface must stay hidden behind our launch animation');
  assert(events.some(event=>event.text==='BACKGROUND_GAMEPAD 1'),'The actual engine process must inherit SDL background controller capture');
  bridge.stdin.write('reveal\n');await until(()=>events.some(event=>event.type==='visible'));value=await geometry();assert.equal(value.visible,true);
  await until(()=>events.some(event=>event.text?.includes('SURFACE_FOCUSED')));
  for(const [width,height] of [[1280,800],[960,600]]){
    win.setContentSize(width,height);await pause(120);value=await geometry();const scale=screen.getDisplayMatching(win.getBounds()).scaleFactor;
    assert.equal(value.width,value.parentWidth);assert.equal(value.height+value.top,value.parentHeight);
    assert(Math.abs(value.top-value.parentHeight*.1)<2,'Native video must leave the control bar clickable');
    assert(Math.abs(value.width-width*scale)<3&&Math.abs(value.height-height*scale*.9)<3,JSON.stringify({value,width,height,scale}));
  }
  bridge.stdin.write('viewport '+JSON.stringify({top:120,height:600})+'\n');await pause(60);value=await geometry();assert(Math.abs(value.top-value.parentHeight*.2)<2,'Text scaling must update the native toolbar inset');
  bridge.stdin.write('viewport '+JSON.stringify({top:0,height:600})+'\n');await pause(60);value=await geometry();assert.equal(value.top,0);assert.equal(value.height,value.parentHeight,'Hiding controls must return all space to the video');
  bridge.stdin.write('viewport '+JSON.stringify({top:120,height:600})+'\n');await pause(60);value=await geometry();assert(Math.abs(value.top-value.parentHeight*.2)<2,'Reopening controls must restore their clickable space');
  await until(()=>events.some(event=>event.type==='surface-closed'));await until(()=>exited);assert(events.some(event=>event.type==='exit'));
  // Exercise the actual, unmodified StreamLight executable and read its
  // isolated portable identity. No real host pairing or game is required.
  const profile=path.join(output,'engine-profile');await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'portable.dat'),'');
  const realConfig=path.join(output,'real-engine.json');await fs.writeFile(realConfig,JSON.stringify({executable:path.join(root,'.packaging-staging','streamlight','runtime','StreamLight.exe'),cwd:profile,args:['list','127.0.0.1:65501','--csv'],parent:'0',stream:false}));
  bridge=spawn(path.join(root,'.packaging-staging','streamlight','WindowBridge.exe'),[realConfig],{stdio:['pipe','pipe','pipe'],windowsHide:true});bridge.stdout.resume();bridge.stderr.resume();
  let identity;
  for(let i=0;i<160;i++){try{identity=parseIni(await fs.readFile(path.join(profile,'FoggyBytes','StreamLight.ini'),'utf8')).General;if(identity.certificate&&identity.key)break;}catch{}await pause(25);}
  assert(identity?.certificate&&identity.key,'StreamLight portable identity was not created');
  assert(new crypto.X509Certificate(identity.certificate).checkPrivateKey(crypto.createPrivateKey(identity.key)));
  const engineExit=new Promise(resolve=>bridge.once('exit',resolve));bridge.stdin.write('stop\n');await engineExit;
  let clientCertificate=false;
  const server=https.createServer({cert:identity.certificate,key:identity.key,requestCert:true,rejectUnauthorized:false},(req,res)=>{
    clientCertificate=Boolean(req.socket.getPeerCertificate()?.raw);res.writeHead(200,{'Content-Type':'application/xml'});res.end('<root status_code="200"><currentgame>10</currentgame></root>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const host={hostname:'127.0.0.1',httpsPort:server.address().port};const auth={credentials:{certificate:identity.certificate,key:identity.key,uniqueid:'fixture'},pinnedCert:identity.certificate};
    assert((await wireRequest(host,'serverinfo',auth)).includes('<currentgame>10</currentgame>'));assert(clientCertificate,'The host must receive the paired client certificate');
    await assert.rejects(wireRequest(host,'serverinfo',{...auth,pinnedCert:require('node:tls').rootCertificates[0]}),/identity changed/);
  }finally{await new Promise(resolve=>server.close(resolve));}
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({ok:true,events},null,2));
  console.log('PASS native child parenting, hidden launch surface, reveal, keyboard focus, physical-pixel resizing and decoder shutdown; actual StreamLight portable identity, mutual TLS and host pin validation');win.destroy();app.exit(0);
}).catch(async error=>{console.error(error,JSON.stringify(events));await fs.writeFile(path.join(output,'failure.json'),JSON.stringify(events,null,2));bridge?.kill();win?.destroy();app.exit(1);});
setTimeout(()=>{bridge?.kill();app.exit(1);},25000).unref();
