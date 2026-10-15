const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {PassThrough,Writable}=require('node:stream');
const {parseAddress,parseApps,parseIni,createRemotePlay}=require('../src/remote-play.cjs');
const {depotSizes,requirementBytes,createInstallSizeLookup}=require('../src/steam-install-size.cjs');
const {storageOverview}=require('../src/storage-overview.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test,ms=5000){const end=Date.now()+ms;while(!test()){if(Date.now()>end)throw new Error('Timed out waiting for lifecycle state');await pause(25);}}
async function main(){
  assert.deepEqual(parseAddress('gaming-pc'),{hostname:'gaming-pc',httpPort:47989,address:'gaming-pc'});
  assert.equal(parseAddress('192.168.1.5:48000').httpPort,48000);
  assert.equal(parseAddress('[::1]:48000').hostname,'::1');
  for(const bad of ['','https://host','http://user:pass@host','host/path','host?x=y','host\\x','-bad host'])assert.throws(()=>parseAddress(bad));
  assert.deepEqual(parseApps('<root><App><ID>1</ID><AppTitle>Game &amp; More</AppTitle><IsHdrSupported>1</IsHdrSupported></App><App><ID>1</ID><AppTitle>Duplicate</AppTitle></App><App><ID>../2</ID><AppTitle>Invalid</AppTitle></App></root>'),[{appId:'1',title:'Game & More',launchTitle:'Game & More',hdr:true,uuid:'',artVersion:'',installed:null}]);
  assert.equal(parseApps('<App><ID>2</ID><AppTitle>\u200bPadded title</AppTitle></App>')[0].launchTitle,'\u200bPadded title','Keep the host’s exact launch title while displaying a clean label');
  const ini=parseIni('[General]\ncertificate=@ByteArray(PEM\\nCERT)\nkey="@ByteArray(SECRET\\nKEY)"\n[hosts]\n1\\uuid=host-uuid\n1\\srvcert=@ByteArray(PINNED)\n');
  assert.equal(ini.General.certificate,'PEM\nCERT');assert.equal(ini.General.key,'SECRET\nKEY');assert.equal(ini.hosts['1\\uuid'],'host-uuid');
  const info={depots:{10:{manifests:{public:{gid:'a',size:'100',download:'60'}}},11:{config:{oslist:'linux'},manifests:{public:{size:'999',download:'999'}}},12:{config:{language:'german'},manifests:{public:{size:'999',download:'999'}}},13:{dlcappid:'99',manifests:{public:{size:'999',download:'999'}}},14:{depotfromapp:'20'}}};
  assert.equal(depotSizes(info).downloadBytes,null,'Never present a partial depot sum as the whole download');
  const shared={20:{depots:{14:{manifests:{public:{gid:'b',size:'50',download:'30'}}}}}};
  assert.deepEqual(depotSizes(info,'english',shared),{installBytes:150,downloadBytes:90,depotCount:2,missingDepots:0});
  assert.equal(requirementBytes({minimum:'<b>Storage:</b> 90 GB available space'}),90e9);
  assert.equal(requirementBytes({minimum:'16 GB RAM and 25 GB available space'}),25e9);
  let calls=0;
  const lookup=createInstallSizeLookup({fetch:async url=>{calls++;return {ok:true,json:async()=>url.includes('steampowered')?{1:{data:{pc_requirements:{minimum:'Storage: 1 GB available space'}}}}:{data:url.endsWith('/20')?shared:{1:info}}};}});
  const [sizeA,sizeB]=await Promise.all([lookup(1),lookup(1)]);assert.deepEqual(sizeA,sizeB);assert.equal(sizeA.downloadBytes,90);assert.equal(sizeA.requiredBytes,1e9);assert.equal(calls,3);await lookup(1);assert.equal(calls,3);
  const offline=createInstallSizeLookup({fetch:async()=>{throw new Error('offline');}});assert.equal((await offline(1)).requiredBytes,null);
  const storage=storageOverview([
    {id:'a',title:'A',provider:'Steam',installPath:'C:/Games/A',sizeOnDisk:100},
    {id:'alias',title:'Alias',provider:'PC',installPath:'c:\\games\\a',sizeOnDisk:100},
    {id:'child',title:'Child',provider:'PC',installPath:'C:/Games/A/bin',sizeOnDisk:50},
    {id:'unknown',title:'Unknown',provider:'Epic',installPath:'C:/Games/B'},
    {id:'uninstalled',title:'Not installed',installed:false,installPath:'C:/Games/C',sizeOnDisk:500},
    {id:'remote',title:'Remote',remoteHostId:'host',installPath:'C:/Games/D',sizeOnDisk:500}
  ],[{root:'C:\\',total:1000,free:500}],['C:\\Steam']);
  assert.equal(storage.drives[0].knownGameBytes,100);assert.equal(storage.drives[0].games.length,3);assert.equal(storage.drives[0].unknownGames,1);
  const directory=path.resolve(__dirname,'../.visual-review/remote-unit/profile'),runtime=path.resolve(__dirname,'../.visual-review/remote-unit/runtime');
  await fs.mkdir(path.join(directory,'engine','FoggyBytes'),{recursive:true});await fs.mkdir(path.join(runtime,'runtime'),{recursive:true});
  await fs.writeFile(path.join(runtime,'runtime','StreamLight.exe'),'fixture');await fs.writeFile(path.join(runtime,'WindowBridge.exe'),'fixture');
  await fs.writeFile(path.join(directory,'engine','FoggyBytes','StreamLight.ini'),'[General]\ncertificate=TEST-CERT\nkey=TEST-KEY\nuniqueid=client-id\n[hosts]\n1\\uuid=host-uuid\n1\\srvcert=PINNED\n');
  const host={id:'test-host',name:'Test PC',address:'test-pc',hostname:'test-pc',httpPort:47989,httpsPort:47984,uuid:'host-uuid',paired:true,games:[{id:'remote:test-host:10',appId:'10',title:'Test game',artwork:{}}]};
  await fs.writeFile(path.join(directory,'hosts.json'),JSON.stringify([host]));
  let current='0',fail=false,workerCount=0,reveals=0,emitFrame,emitNative;
  const events=[];let apps='<root><App><ID>10</ID><AppTitle>Test game</AppTitle></App></root>';
  const spawnProcess=(_executable,args)=>{
    const config=JSON.parse(require('node:fs').readFileSync(args[0],'utf8'));
    assert.equal(config.args[config.args.indexOf('--video-codec')+1],'HEVC');assert.equal(config.args[config.args.indexOf('--resolution')+1],'1280x800');
    assert(config.args.includes('--no-quit-after'),'Disconnect must not terminate the host’s game');
    assert(config.args.includes('--background-gamepad'),'An embedded player must receive background SDL gamepad events');
    assert(config.args.includes('--no-multi-controller'));assert(config.args.includes('--swap-gamepad-buttons'));assert(config.args.includes('--touchscreen-trackpad'));
    assert.equal(config.args[config.args.indexOf('--audio-config')+1],'5.1-surround');assert.equal(config.quitMask,0x330);
    const profile=parseIni(require('node:fs').readFileSync(path.join(directory,'engine','FoggyBytes','StreamLight.ini'),'utf8'));
    assert.equal(profile.General.gamepadmouse,'false');assert.equal(profile.General.key,'TEST-KEY');assert.equal(profile.shortcuts.pad0_mask,'816');
    workerCount++;const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
    const emit=value=>child.stdout.write(JSON.stringify(value)+'\n');
    emitNative=emit;
    child.stdin=new Writable({write(chunk,enc,done){if(String(chunk).includes('reveal')){reveals++;setImmediate(()=>emit({type:'visible'}));}if(String(chunk).includes('stop'))setImmediate(()=>{emit({type:'exit',code:0});child.emit('exit',0);});done();}});
    emitFrame=()=>emit({type:'stderr',text:'00:00:03 - SDL Info (0): Stream window revealed: 1280x800, fullscreen=0'});
    setTimeout(()=>{emit({type:'surface'});emit({type:'stderr',text:'Video stream is 1280x800x90 (format 0x1)'});},10);return child;
  };
  const remote=createRemotePlay({directory,runtimeDirectory:runtime,getWindow:()=>null,onStatus:event=>events.push(event),spawnProcess,request:async(host,route,options)=>{
    if(fail)throw new Error('Network interrupted');
    if(route==='serverinfo')return `<root status_code="200"><uniqueid>host-uuid</uniqueid><hostname>Test PC</hostname><HttpsPort>47984</HttpsPort><PairStatus>1</PairStatus><currentgame>${current}</currentgame></root>`;
    if(route==='applist')return apps;
    throw new Error('Unexpected route '+route);
  }});
  try{
    assert.equal(JSON.stringify(await remote.snapshot()).includes('TEST-KEY'),false,'Private identity must never reach the renderer');
    assert.deepEqual(await remote.pair(host.id),{hostId:host.id,paired:true});
    assert.equal((await remote.refresh(host.id)).games.length,1);
    assert.equal((await remote.checkHosts()).hosts[0].status,'ready');
    const preferences=await remote.settings(host.id,{width:1280,height:800,fps:90,bitrate:15000,codec:'HEVC',decoder:'hardware',multiController:false,swapFaceButtons:true,gamepadMouse:false,touchscreenTrackpad:true,audioConfig:'5.1',quitCombo:'moonlight'});
    assert.equal(preferences.height,800);assert.equal(preferences.codec,'HEVC');
    assert.equal((await remote.snapshot()).hosts[0].preferences.bitrate,15000);
    await remote.hideGame(host.id,'10');assert.equal((await remote.snapshot()).hosts[0].games.length,0);
    await remote.hideGame(host.id,null);assert.equal((await remote.snapshot()).hosts[0].games.length,1);
    const keep=apps;apps='<root><App><ID>11</ID><AppTitle>Removed</AppTitle><IsInstalled>0</IsInstalled></App><App><ID>12</ID><AppTitle>Fresh game</AppTitle><IsInstalled>1</IsInstalled></App></root>';
    assert.deepEqual((await remote.refresh(host.id)).games.map(game=>game.appId),['12'],'Removed and unpublished games must disappear on refresh');
    apps=keep;await remote.refresh(host.id);
    fail=true;assert.equal((await remote.checkHosts()).hosts[0].status,'offline');assert.equal((await remote.snapshot()).hosts[0].games.length,1,'Offline libraries must keep saved games');fail=false;await remote.checkHosts();
    assert.equal((await remote.add('new-host-address')).hostId,host.id,'A DHCP change must reuse the paired host by UUID');
    assert.equal((await remote.snapshot()).hosts.length,1);
    assert.deepEqual(await remote.covers(host.id,['../2','999']),[],'Unpublished asset requests are rejected');
    const starting=remote.start(host.id,'10');await assert.rejects(remote.start(host.id,'10'),/already starting/);await starting;
    await pause(40);assert.equal(reveals,0,'The surface must stay hidden before the host reports the app running');
    current='10';await pause(1700);assert.equal(reveals,0,'Negotiated video format is not evidence of a decoded frame');emitFrame();await until(()=>events.some(event=>event.phase==='playing'));assert.equal(reveals,1);assert.equal(remote.active().phase,'playing');
    fail=true;await pause(1700);assert(remote.active(),'A failed poll must not be mistaken for a game exit');fail=false;
    current='0';await until(()=>!remote.active(),6500);assert(events.some(event=>event.phase==='ended'&&event.reason==='game-closed'));
    assert.equal(workerCount,1,'Concurrent launch attempts must not spawn two decoders');
    await pause(40);current='10';const cancelled=remote.start(host.id,'10');await remote.stop();await cancelled;assert.equal(remote.active(),null,'Cancelling during connection must prevent a late stream');
    await remote.start(host.id,'10');await pause(40);emitFrame();await until(()=>remote.active()?.phase==='playing');
    remote.viewport({top:0,height:800});emitNative({type:'toggle-controls',source:'controller'});await until(()=>events.some(event=>event.phase==='toggle-controls'));assert.equal(remote.active()?.phase,'playing','Toggling controls must not end the stream');
    emitNative({type:'disconnect-requested',source:'controller'});await until(()=>!remote.active());
    assert(events.some(event=>event.phase==='ended'&&event.reason==='disconnected'),'Native escape must return control to the launcher');
  }finally{remote.dispose();}
  const cachedDirectory=await fs.mkdtemp(path.resolve(__dirname,'../.visual-review/remote-cover-'));
  await fs.writeFile(path.join(cachedDirectory,'hosts.json'),JSON.stringify([{...host,online:false}]));
  const cachedArt={tile:'file:///cached-square.jpg',hero:'file:///cached-hero.jpg',logo:'file:///cached-logo.png',overlayLogo:true,remoteArtworkVersion:1};
  let resolved=0;const artworkEvents=[];
  const cachedRemote=createRemotePlay({directory:cachedDirectory,runtimeDirectory:runtime,getWindow:()=>null,onStatus:event=>artworkEvents.push(event),resolveArtwork:async(game,options)=>{resolved++;assert.equal(game.title,'Test game');assert.equal(options.network,false);return cachedArt;},request:async()=>{throw Error('Cached art must not request host assets');}});
  try{
    assert.deepEqual((await cachedRemote.covers(host.id,['10']))[0].artwork,cachedArt,'Full shared artwork must reach the UI without host identity or connectivity');
    assert.equal(resolved,1);assert(artworkEvents.some(event=>event.phase==='artwork'&&event.artwork.logo===cachedArt.logo));
  }finally{cachedRemote.dispose();}
  console.log('PASS address and XML/Qt parsing; shared depot download sizes, offline fallback and coalescing; storage deduplication; private identity isolation; stream readiness, launch races, connection loss and game-exit lifecycle');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
