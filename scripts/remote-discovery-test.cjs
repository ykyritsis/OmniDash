const assert=require('node:assert/strict');
const {dnsName,dnsRecords,query,lanCandidates,discoverHosts}=require('../src/remote-discovery.cjs');
const {parseApps,normalizePreferences,setIniValues,parseIni,engineMessage}=require('../src/remote-play.cjs');
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
  const game=parseApps('<App><ID>100</ID><AppTitle> Hades </AppTitle><UUID>53544541-4d00-5000-8000-000000117fca</UUID><ArtVersion>updated</ArtVersion><IsInstalled>false</IsInstalled></App>')[0];
  assert.equal(game.title,'Hades');assert.equal(game.launchTitle,' Hades ');assert.equal(game.installed,false);assert.equal(game.steamAppId,'1146826');assert.equal(game.artVersion,'updated');
  assert.equal(parseApps('<App><ID>10</ID><AppTitle>Shared shortcut</AppTitle></App>')[0].installed,null,'A shared shortcut is not evidence of installation');
  const preferences=normalizePreferences({width:Infinity,height:99999,fps:999,bitrate:-200,codec:'bad',decoder:'bad'});assert.deepEqual(preferences,{...normalizePreferences(),width:1920,height:2160,fps:60,bitrate:3000,codec:'auto',decoder:'auto'});
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
