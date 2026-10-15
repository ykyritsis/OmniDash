const assert=require('node:assert/strict');
const {dnsName,dnsRecords,query,lanCandidates,discoverHosts,discoverMdns,usableInterfaces}=require('../src/remote-discovery.cjs');
const {parseApps,normalizePreferences,setIniValues,parseIni,engineMessage,wireRequest,hostGame}=require('../src/remote-play.cjs');
const {EventEmitter}=require('node:events');
function record(name,type,value){const tail=Buffer.alloc(10);tail.writeUInt16BE(type);tail.writeUInt16BE(1,2);tail.writeUInt32BE(120,4);tail.writeUInt16BE(value.length,8);return Buffer.concat([dnsName(name),tail,value]);}
async function main(){
  const service='_nvstream._tcp.local',instance='Gaming PC.'+service,target='gaming-pc.local';
  const header=Buffer.alloc(12);header.writeUInt16BE(0x8400,2);header.writeUInt16BE(3,6);
  const srv=Buffer.alloc(6);srv.writeUInt16BE(48010,4);
  const packet=Buffer.concat([header,record(service,12,dnsName(instance)),record(instance,33,Buffer.concat([srv,dnsName(target)])),record(target,1,Buffer.from([192,168,1,42]))]);
  const records=dnsRecords(packet);assert.equal(records[1].port,48010);assert.equal(records[2].address,'192.168.1.42');assert.equal(records[0].target,instance.toLowerCase());
  for(let size=0;size<packet.length;size++)assert.deepEqual(dnsRecords(packet.subarray(0,size)),[],'Truncated DNS answers must not create hosts');
  const cyclic=Buffer.concat([header,Buffer.from([0xc0,12])]);assert.deepEqual(dnsRecords(cyclic),[]);
  assert.equal(query(service).readUInt16BE(query(service).length-2),0x8001,'Use an ephemeral unicast reply, not an exclusive mDNS port');
  assert.equal(lanCandidates([{address:'10.50.60.20',netmask:'255.0.0.0'}]).length,254,'Large private ranges must be bounded to the attached /24');
  assert.deepEqual(lanCandidates([{address:'192.168.0.1',netmask:'255.255.255.252'}]),['192.168.0.1','192.168.0.2']);
  const visited=[],found=[];
  const hosts=await discoverHosts({addresses:[{address:'192.168.0.1',netmask:'255.255.255.252'}],mdns:async({onAddress})=>{onAddress('192.168.0.2',48010);onAddress('192.168.0.2',48010);},probe:async host=>{visited.push(host);if(host.hostname==='192.168.0.2')return {...host,uuid:'same-pc',name:'Gaming PC'};throw new Error('Offline');},onFound:host=>found.push(host)});
  assert.equal(hosts.length,1);assert.equal(found.length,1);assert(visited.some(host=>host.httpPort===48010));assert.equal(visited.filter(host=>host.httpPort===48010).length,1);
  const adapters=Array.from({length:5},(_,i)=>({name:'vEthernet '+i,address:`10.${i}.0.8`,netmask:'255.255.255.0'})).concat({name:'Wi-Fi',address:'192.168.1.15',netmask:'255.255.255.0'});
  assert.equal(usableInterfaces(adapters)[0].name,'Wi-Fi');
  assert(lanCandidates(adapters).slice(0,24).includes('192.168.1.2'),'A Wi-Fi adapter after several virtual adapters must not be skipped or starved');
  const sockets=[],seen=[];
  await discoverMdns({addresses:[adapters.at(-1)],duration:35,onAddress:(...args)=>seen.push(args),createSocket:()=>{
    const socket=new EventEmitter();sockets.push(socket);socket.setMulticastInterface=()=>{};socket.setMulticastTTL=()=>{};socket.addMembership=(group,iface)=>socket.membership={group,iface};socket.close=()=>socket.closed=true;socket.send=(bytes,port,host,cb)=>{assert.equal(port,5353);cb();};
    socket.bind=(port,address,cb)=>{socket.port=port;setImmediate(()=>{cb();if(port===5353)socket.emit('message',packet);});};return socket;
  }});
  assert.deepEqual(seen,[['192.168.1.42',48010]],'Multicast-only custom-port advertisements must be found');
  assert(sockets.every(socket=>socket.closed));assert.deepEqual(sockets[0].membership,{group:'224.0.0.251',iface:'192.168.1.15'});
  sockets[0].emit('message',packet);assert.equal(seen.length,1,'Closed scans must not emit late hosts');
  assert.equal(query(service,12,false).readUInt16BE(query(service).length-2),1);
  const scheduled=[];
  await discoverHosts({addresses:[adapters.at(-1)],timeout:1000,probeTimeout:10,saved:[{hostname:'saved-pc',httpPort:49000}],mdns:async({onAddress})=>onAddress('192.168.1.250',48000),probe:async host=>{scheduled.push(host);await new Promise(resolve=>setTimeout(resolve,2));return null;}});
  assert.equal(scheduled[0].hostname,'saved-pc');assert(scheduled.findIndex(host=>host.httpPort===48000)<100,'mDNS discoveries must jump ahead of pending subnet probes');
  let cancelled=false,lateFound=0,resolveLate;const started=Date.now();
  await discoverHosts({addresses:[adapters.at(-1)],timeout:70,probeTimeout:500,mdns:()=>new Promise(()=>{}),probe:(_host,_timeout,signal)=>{signal.addEventListener('abort',()=>{cancelled=true;});return new Promise(resolve=>{resolveLate=resolve;});},onFound:()=>lateFound++});
  assert(Date.now()-started<500,'The overall scan must end even if discovery/probes hang');assert(cancelled);
  resolveLate({uuid:'late',name:'Too late'});await new Promise(resolve=>setImmediate(resolve));assert.equal(lateFound,0);
  // Simulate a socket that never connects: socket inactivity timers never run.
  const http=require('node:http'),original=http.request;let destroyed=false;
  try{http.request=()=>{const req=new EventEmitter();req.end=()=>{};req.destroy=error=>{destroyed=true;req.emit('error',error);};return req;};await assert.rejects(wireRequest({hostname:'unreachable-pc',httpPort:47989},'serverinfo',{timeout:25}),/did not respond/);assert(destroyed);}finally{http.request=original;}
  assert.equal(hostGame('<state>SUNSHINE_SERVER_FREE</state><currentgame>10</currentgame>'),'0');
  assert.equal(hostGame('<state>SUNSHINE_SERVER_BUSY</state><currentgame>10</currentgame>'),'10');
  assert.equal(hostGame('<state>unknown</state><currentgame>0</currentgame>'),null);
  assert.equal(hostGame('<currentgame>0</currentgame>'),'0');assert.equal(hostGame(''),null);
  const game=parseApps('<App><ID>100</ID><AppTitle> Hades </AppTitle><UUID>53544541-4d00-5000-8000-000000117fca</UUID><ArtVersion>updated</ArtVersion><IsInstalled>false</IsInstalled></App>')[0];
  assert.equal(game.title,'Hades');assert.equal(game.launchTitle,' Hades ');assert.equal(game.installed,false);assert.equal(game.steamAppId,'1146826');assert.equal(game.artVersion,'updated');
  assert.equal(parseApps('<App><ID>10</ID><AppTitle>Shared shortcut</AppTitle></App>')[0].installed,null,'A shared shortcut is not evidence of installation');
  const preferences=normalizePreferences({width:Infinity,height:99999,fps:999,bitrate:-200,codec:'bad',decoder:'bad'});assert.deepEqual(preferences,{...normalizePreferences(),preset:'custom',width:1920,height:7680,fps:480,bitrate:500,codec:'auto',decoder:'auto'});
  assert.equal(normalizePreferences({fps:165,bitrate:33333}).fps,165);
  assert.equal(normalizePreferences({vsync:false,fractionalVsync:true}).fractionalVsync,false);
  assert.equal(normalizePreferences({hdr:'false',yuv444:'true',captureSystemKeys:'always'}).yuv444,true);
  assert.equal(normalizePreferences({multiController:'false',swapFaceButtons:'true',audioConfig:'5.1',quitCombo:'moonlight'}).multiController,false);
  assert.equal(normalizePreferences({swapFaceButtons:'true'}).swapFaceButtons,true);
  const ini='[General]\ncertificate=@ByteArray(TEST\\nCERT)\nkey=@ByteArray(TEST\\nKEY)\n[theme]\nreduceanimations=false\naccent=green\n[hosts]\n1\\uuid=existing\n';
  const changed=setIniValues(ini,'theme',{reduceanimations:'true',startupanimation:'false'}),parsed=parseIni(changed);
  assert.equal(parsed.General.key,'TEST\nKEY');assert.equal(parsed.hosts['1\\uuid'],'existing');assert.equal(parsed.theme.accent,'green');assert.equal(parsed.theme.reduceanimations,'true');assert.equal((changed.match(/reduceanimations=/g)||[]).length,1);
  assert.equal(engineMessage('00:00:02 - Qt Critical: qml: Host returned error: Game is unavailable'),'Host returned error: Game is unavailable');
  assert.equal(engineMessage('SDL Warn: optional controller mapping unavailable'),'');
  console.log('PASS bounded LAN discovery, mDNS custom ports/deduplication, truncated and cyclic DNS, installed-state parsing, stream preference validation and safe engine profile migration.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
