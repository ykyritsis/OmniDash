const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { discoverHosts } = require('./remote-discovery.cjs');

const xmlText = value => String(value || '').replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi, token => ({ '&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'" }[token] || String.fromCodePoint(Math.min(0x10ffff, token[2]?.toLowerCase() === 'x' ? parseInt(token.slice(3),16) : parseInt(token.slice(2),10)))));
function xmlValue(xml, key) { return xmlText(String(xml).match(new RegExp(`<${key}\\b[^>]*>([\\s\\S]*?)</${key}>`, 'i'))?.[1] || ''); }
function parseApps(xml) {
  const seen = new Set();
  return [...String(xml).matchAll(/<App\b[^>]*>([\s\S]*?)<\/App>/gi)].map(match => {
    const appId = xmlValue(match[1], 'ID'), launchTitle = xmlValue(match[1], 'AppTitle'), title = launchTitle.replace(/[\u200b-\u200d\ufeff]/g, '').trim();
    if (!/^\d{1,10}$/.test(appId) || !title || launchTitle.length > 512 || /[\x00-\x1f]/.test(launchTitle) || seen.has(appId)) return null;
    seen.add(appId);
    const uuid = xmlValue(match[1], 'UUID'), artVersion = xmlValue(match[1], 'ArtVersion');
    const install = xmlValue(match[1], 'IsInstalled') || xmlValue(match[1], 'Installed');
    const installed = /^(1|true)$/i.test(install) ? true : /^(0|false)$/i.test(install) ? false : null;
    // Vibepollo uses deterministic Steam UUIDs; other hosts keep opaque IDs.
    const steamId = /^53544541-4d00-5000-8000-[\da-f]{12}$/i.test(uuid) ? String(parseInt(uuid.slice(-12), 16)) : '';
    return { appId, title, launchTitle, hdr: xmlValue(match[1], 'IsHdrSupported') === '1', uuid, artVersion, installed, ...(steamId ? {steamAppId:steamId} : {}) };
  }).filter(Boolean);
}
function parseAddress(value) {
  const text = String(value || '').trim();
  if (!text || text.length > 253 || /[\s\\?#]/.test(text)) throw new Error('Enter the PC’s IP address or hostname, optionally followed by its HTTP port.');
  let url;
  try { url = new URL(text.includes('://') ? text : `http://${text}`); } catch { throw new Error('That PC address is not valid.'); }
  if (url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/') throw new Error('Use an IP address or hostname, such as 192.168.1.20 or gaming-pc.');
  const port = Number(url.port || 47989);
  if (port < 1 || port > 65535) throw new Error('That host port is not valid.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  return { hostname, httpPort: port, address: `${url.hostname}${port === 47989 ? '' : `:${port}`}` };
}
function qtValue(value = '') {
  let text = String(value).trim();
  if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1,-1);
  if (text.startsWith('@ByteArray(') && text.endsWith(')')) text = text.slice(11,-1);
  return text.replace(/\\(x[\da-f]{1,2}|[0-7]{1,3}|.)/gi, (_, token) => token[0] === 'x' ? String.fromCharCode(parseInt(token.slice(1),16)) : /^[0-7]/.test(token) ? String.fromCharCode(parseInt(token,8)) : ({ n:'\n',r:'\r',t:'\t','\\':'\\','"':'"' }[token] ?? token));
}
function parseIni(text) {
  const sections = { General: {} }; let section = sections.General;
  for (const line of String(text).split(/\r?\n/)) {
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) { section = sections[header[1]] ||= {}; continue; }
    const at = line.indexOf('=');
    if (at > 0) section[line.slice(0,at)] = qtValue(line.slice(at+1));
  }
  return sections;
}
function wireRequest(host, route, { credentials, pinnedCert, binary = false, timeout = 5000, params = {} } = {}) {
  const secure = Boolean(credentials);
  const query = new URLSearchParams({ uniqueid: credentials?.uniqueid || '0123456789ABCDEF', uuid: crypto.randomBytes(16).toString('hex'), ...params });
  return new Promise((resolve, reject) => {
    const req = (secure ? https : http).request({ hostname: host.hostname, port: secure ? host.httpsPort || 47984 : host.httpPort, path: `/${route}?${query}`, method:'GET', agent:false,
      ...(secure ? { cert: credentials.certificate, key: credentials.key, rejectUnauthorized:false } : {}) }, res => {
      if (secure) {
        const actual = res.socket.getPeerCertificate()?.raw;
        let expected;
        try { expected = new crypto.X509Certificate(pinnedCert).raw; } catch { req.destroy(new Error('Pair this PC again to restore its identity.')); return; }
        if (!actual || !crypto.timingSafeEqual(crypto.createHash('sha256').update(actual).digest(), crypto.createHash('sha256').update(expected).digest())) { req.destroy(new Error('The host’s identity changed. Remove it and pair again.')); return; }
      }
      const chunks=[]; let size=0;
      res.on('data', data => { size+=data.length; if(size > (binary ? 12 : 4)*1024*1024) req.destroy(new Error('The host returned too much data.')); else chunks.push(data); });
      res.on('end', () => {
        if (res.statusCode !== 200) { reject(new Error(`The host returned HTTP ${res.statusCode}.`)); return; }
        const bytes=Buffer.concat(chunks); if (binary) { resolve(bytes); return; }
        const xml=bytes.toString('utf8'), code=xml.match(/<root\b[^>]*status_code="(\d+)"/i)?.[1];
        if(code && code !== '200') { reject(new Error(xml.match(/status_message="([^"]*)"/)?.[1] || `The host declined the request (${code}).`)); return; }
        resolve(xml);
      });
      res.on('error', reject);
    });
    req.setTimeout(timeout, () => req.destroy(new Error('The PC did not respond. Check its address and make sure the streaming host is running.')));
    req.on('error', reject); req.end();
  });
}

function normalizePreferences(value = {}) {
  const number = (key, fallback, min, max) => Number.isFinite(Number(value[key])) ? Math.max(min, Math.min(max, Math.round(Number(value[key])))) : fallback;
  const bool = (key, fallback) => value[key] === undefined ? fallback : value[key] === true || value[key] === 'true';
  return {width:number('width',1920,256,7680),height:number('height',1080,256,7680),fps:number('fps',60,10,480),
    bitrate:number('bitrate',20000,500,500000),codec:['auto','H.264','HEVC','AV1'].includes(value.codec)?value.codec:'auto',decoder:['auto','hardware','software'].includes(value.decoder)?value.decoder:'auto',
    multiController:bool('multiController',true),swapFaceButtons:bool('swapFaceButtons',false),gamepadMouse:bool('gamepadMouse',true),touchscreenTrackpad:bool('touchscreenTrackpad',false),absoluteMouse:bool('absoluteMouse',false),
    hdr:bool('hdr',false),yuv444:bool('yuv444',false),audioOnHost:bool('audioOnHost',false),swapMouseButtons:bool('swapMouseButtons',false),reverseScroll:bool('reverseScroll',false),captureSystemKeys:value.captureSystemKeys==='always'?'always':'never',
    vsync:bool('vsync',true),framePacing:bool('framePacing',false),fractionalVsync:bool('vsync',true)&&bool('framePacing',false)&&bool('fractionalVsync',false),performanceOverlay:bool('performanceOverlay',false),overlayDetail:value.overlayDetail==='full'?'full':'standard',overlayPosition:value.overlayPosition==='right'?'right':'left',overlaySize:['small','large'].includes(value.overlaySize)?value.overlaySize:'medium',
    audioConfig:['stereo','5.1','7.1'].includes(value.audioConfig)?value.audioConfig:'stereo',quitCombo:value.quitCombo==='moonlight'?'moonlight':'streamlight'};
}
function setIniValues(text, group, values) {
  const lines = String(text || '').split(/\r?\n/), header = `[${group}]`;
  let start = lines.indexOf(header);
  if (start < 0) { lines.push(header); start = lines.length - 1; }
  let end = start + 1; while (end < lines.length && !/^\[.*\]$/.test(lines[end])) end++;
  const keys = new Set(Object.keys(values));
  const kept = lines.slice(start + 1, end).filter(line => !keys.has(line.split('=')[0]));
  lines.splice(start + 1, end - start - 1, ...kept, ...Object.entries(values).map(([key,value]) => `${key}=${value}`));
  return lines.join('\n');
}
function engineMessage(text) {
  const line = String(text || '');
  const error = line.match(/Qt (?:Critical|Fatal):\s*(?:qml:\s*)?(.+)/i)?.[1]
    || line.match(/(?:Host returned error:|Starting (?:RTSP|Control|Video|Audio|Input)[^\n]*failed:)[^\n]*/i)?.[0];
  return error ? error.replace(/Please open StreamLight to pair before streaming\./i,'Pair the PC again in Remote PCs.').slice(0,700) : '';
}
// Host app IDs can change after a shortcut is rebuilt. Keep history with the
// host's app UUID when available, otherwise its exact launch name.
function historyKey(game) { return game.uuid || String(game.launchTitle || game.title).normalize('NFKC').toLocaleLowerCase(); }
function streamProfiles(host) { return ['1','2','3'].map(id=>({id,name:String(host.profiles?.[id]?.name || `Profile ${id}`).slice(0,40),preferences:normalizePreferences(host.profiles?.[id]?.preferences || host.preferences)})); }
function hostPreferences(host) { return streamProfiles(host).find(profile=>profile.id===(host.activeProfile || '1')).preferences; }
function gamePreferences(host,game) { return normalizePreferences({...hostPreferences(host),...host.gameOverrides?.[historyKey(game)]}); }
function createRemotePlay({ directory, runtimeDirectory, getWindow, onStatus = () => {}, request = wireRequest, spawnProcess = spawn, now = Date.now, discover = discoverHosts, resolveArtwork = async () => null }) {
  let hosts=null, saving=Promise.resolve(), pairing=null, session=null, disposed=false, acquiring=false, launchGeneration=0;
  const workers=new Set(), refreshing=new Map(), coverRequests=new Map();
  let scanning=null, checking=null;
  let viewportState={top:72,height:720};
  const profile=path.join(directory,'engine'), iniFile=path.join(profile,'FoggyBytes','StreamLight.ini');
  async function load() { if(!hosts) { try { hosts=JSON.parse(await fs.readFile(path.join(directory,'hosts.json'),'utf8')); if(!Array.isArray(hosts)) hosts=[]; } catch { hosts=[]; } } return hosts; }
  async function save() { const text=JSON.stringify(hosts); saving=saving.catch(()=>{}).then(async()=>{ await fs.mkdir(directory,{recursive:true}); await fs.writeFile(path.join(directory,'hosts.json.tmp'),text); await fs.rename(path.join(directory,'hosts.json.tmp'),path.join(directory,'hosts.json')); }); return saving; }
  function emit(phase, extra={}) { onStatus({ phase, session:publicSession(), ...extra }); }
  function publicSession() { return session ? { hostId:session.host.id, appId:session.game.appId, gameId:session.game.id, title:session.game.title, phase:session.phase, startedAt:session.startedAt, lastPlayed:session.game.lastPlayed || 0, preferences:session.preferences } : null; }
  async function runtime() {
    const executable=path.join(runtimeDirectory,'runtime','StreamLight.exe'), bridge=path.join(runtimeDirectory,'WindowBridge.exe');
    await Promise.all([fs.access(executable),fs.access(bridge)]).catch(()=>{ throw new Error('The streaming component is missing. Install the full app build, or run the streaming preparation script when developing.'); });
    await fs.mkdir(profile,{recursive:true}); await fs.writeFile(path.join(profile,'portable.dat'),'');
    return { executable, bridge };
  }
  async function run(args, {stream=false,onEvent=()=>{},timeout=35000,preferences={}}={}) {
    if(disposed) throw new Error('Remote play is shutting down.');
    const files=await runtime(), config=path.join(directory,`bridge-${crypto.randomUUID()}.json`);
    // StreamLight 7 waits for a Qt entrance animation before calling /launch.
    // Hidden Qt windows do not advance that animation. Our launcher owns the
    // curtain, so disable the engine's UI animations in its isolated profile.
    await fs.mkdir(path.dirname(iniFile),{recursive:true});
    const ini=await fs.readFile(iniFile,'utf8').catch(()=>'');
    let updatedIni=setIniValues(ini,'theme',{reduceanimations:'true',startupanimation:'false'});
    const quitMask=preferences.quitCombo==='moonlight'?0x330:preferences.swapFaceButtons?0x2300:0x1300;
    if(stream){
      updatedIni=setIniValues(updatedIni,'General',{gamepadmouse:String(preferences.gamepadMouse!==false),backgroundgamepad:'true',fractionalvsync:String(Boolean(preferences.fractionalVsync)),enablevrr:'false',overlayposition:preferences.overlayPosition==='right'?'1':'0',overlayfontsize:String({small:0,medium:1,large:2}[preferences.overlaySize]??1),overlayitems:preferences.overlayDetail==='full'?'55295':'483'});
      // The native SDL handler tests logical (post-swap) buttons. The bridge's
      // XInput escape fallback uses the corresponding physical button instead.
      updatedIni=setIniValues(updatedIni,'shortcuts',{pad0_mask:String(preferences.quitCombo==='moonlight'?0x330:0x1300),kb0_enabled:'true',kb0_mods:'7',kb0_key:'113',kb0_scan:'20'});
    }
    await fs.writeFile(iniFile,updatedIni);
    const handle=getWindow()?.getNativeWindowHandle();
    const parent=handle ? (handle.length >= 8 ? handle.readBigUInt64LE().toString() : String(handle.readUInt32LE())) : '0';
    await fs.writeFile(config,JSON.stringify({ executable:files.executable,cwd:profile,args,parent,stream,viewport:stream?viewportState:null,quitMask }));
    const child=spawnProcess(files.bridge,[config],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    let buffer='',out='',err='',settled=false,diagnostic='';
    const log=line=>{ diagnostic=(diagnostic+String(line).replace(/([?&](?:rikey|rikeyid|clientcert|salt|pin|secret|authorization)=)[^&\s]+/gi,'$1[redacted]')+'\n').slice(-256*1024); };
    const worker={ child, stop(){ if(!child.killed && !child.stdin.destroyed) child.stdin.write('stop\n'); }, send(value){ if(!child.stdin.destroyed) child.stdin.write(value+'\n'); } };
    workers.add(worker);
    worker.done=new Promise((resolve,reject)=>{
      const timer=timeout ? setTimeout(()=>{ worker.stop(); reject(new Error('The streaming host took too long to respond.')); },timeout) : null;
      const finish=(error,code)=>{ if(settled)return;settled=true;clearTimeout(timer);workers.delete(worker);fs.unlink(config).catch(()=>{});fs.writeFile(path.join(directory,stream?'last-stream.log':'last-pair.log'),diagnostic).catch(()=>{});error ? reject(error) : resolve({code,out,err}); };
      child.stdout.on('data',chunk=>{ buffer+=chunk; const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines) { let event;try{event=JSON.parse(line);}catch{continue;}
        if(event.type==='stdout')out=(out+event.text+'\n').slice(-2*1024*1024);
        if(event.type==='stderr')err=(err+event.text+'\n').slice(-12000);
        log(event.text || JSON.stringify(event));
        if(event.type==='error') { finish(new Error(event.message));worker.stop(); }
        if(event.type==='exit')finish(null,event.code);
        onEvent(event);
      }});
      child.stderr.on('data',chunk=>{err=(err+String(chunk)).slice(-12000);});
      child.on('error',error=>finish(error));child.on('exit',code=>finish(null,code));
      child.stdin.on('error',()=>{});
    });
    // Callers retain the promise and handle errors without an unhandled rejection
    // during the brief interval between spawning and storing the session.
    worker.done.catch(()=>{});
    return worker;
  }
  async function identity(host) {
    const ini=parseIni(await fs.readFile(iniFile,'utf8').catch(()=>''));
    const entries=ini.hosts || {}, index=Object.keys(entries).find(key=>key.endsWith('\\uuid') && entries[key] === host.uuid)?.split('\\')[0];
    const certificate=ini.General.certificate, key=ini.General.key, pinnedCert=index && entries[`${index}\\srvcert`];
    if(!certificate || !key || !pinnedCert) throw new Error('Pair this PC before browsing its games.');
    return { credentials:{certificate,key,uniqueid:ini.General.uniqueid || '0123456789ABCDEF'}, pinnedCert };
  }
  async function find(id) { const host=(await load()).find(item=>item.id===id); if(!host) throw new Error('This remote PC was not found.'); return host; }
  function publicHost(host) {
    const fresh=host.checkedAt && now()-host.checkedAt < 45000;
    const status=!fresh?'unknown':!host.online?'offline':!host.paired?'pair-required':host.currentGame && host.currentGame!=='0'?'busy':'ready';
    return {id:host.id,name:host.name,address:host.address,paired:Boolean(host.paired),games:(host.games||[]).filter(game=>!(host.hiddenApps||[]).includes(game.appId)).map(game=>({...game,lastPlayed:host.playHistory?.[historyKey(game)] || game.lastPlayed || 0,streamOverrides:host.gameOverrides?.[historyKey(game)] || null})),hiddenCount:(host.hiddenApps||[]).length,lastSeen:host.lastSeen,error:host.error||'',status,currentGame:host.currentGame||'0',preferences:hostPreferences(host),profiles:streamProfiles(host),activeProfile:host.activeProfile || '1'};
  }
  async function snapshot() { await load(); let available=true;try{await runtime();}catch{available=false;} return {available,hosts:hosts.map(publicHost),session:publicSession(),pairing:pairing ? {hostId:pairing.host.id,pin:pairing.pin}:null}; }
  async function probe(host, timeout=3500) {
    const xml=await request(host,'serverinfo',{timeout});
    const uuid=xmlValue(xml,'uniqueid'); if(!uuid) throw new Error('That PC is not running a compatible Sunshine, Apollo or Vibepollo host.');
    if(host.uuid && host.uuid !== uuid) throw new Error('A different PC answered at this address. Remove this entry and pair again.');
    host.uuid=uuid;host.name=xmlValue(xml,'hostname') || host.hostname;host.httpsPort=Number(xmlValue(xml,'HttpsPort')) || host.httpPort-5;
    host.online=true;host.checkedAt=now();host.lastSeen=now();host.currentGame=xmlValue(xml,'currentgame')||'0';
    return xml;
  }
  async function checkHosts() {
    if(checking)return checking;
    checking=(async()=>{await load();await Promise.all(hosts.map(async host=>{try{await probe(host);if(host.paired){const auth=await identity(host),info=await request(host,'serverinfo',{...auth,timeout:3500});host.currentGame=xmlValue(info,'currentgame')||'0';host.paired=xmlValue(info,'PairStatus')==='1';}host.error='';}catch(error){host.online=false;host.checkedAt=now();host.error=error.message;}}));await save();return snapshot();})().finally(()=>{checking=null;});return checking;
  }
  async function scan() {
    if(scanning)return scanning;
    scanning=(async()=>{await load();return discover({probe:async(address,timeout)=>{const host={...address,address:address.hostname+(address.httpPort===47989?'':`:${address.httpPort}`)};await probe(host,timeout);return host;},onFound:host=>emit('discovered',{host:{name:host.name,address:host.address,uuid:host.uuid,hostId:hosts.find(item=>item.uuid?.toLowerCase()===host.uuid.toLowerCase())?.id||null}})});})().then(found=>found.map(host=>({name:host.name,address:host.address,uuid:host.uuid,hostId:hosts.find(item=>item.uuid?.toLowerCase()===host.uuid.toLowerCase())?.id||null}))).finally(()=>{scanning=null;});return scanning;
  }
  async function add(address) {
    const parsed=parseAddress(address); await load();
    const existing=hosts.find(host=>host.address.toLowerCase()===parsed.address.toLowerCase()); if(existing)return {hostId:existing.id};
    const host={id:crypto.randomUUID(),...parsed,paired:false,games:[]};await probe(host);
    const known=hosts.find(item=>item.uuid?.toLowerCase()===host.uuid.toLowerCase());
    if(known){Object.assign(known,parsed,{name:host.name,httpsPort:host.httpsPort,online:true,checkedAt:now()});await save();return {hostId:known.id};}
    hosts.push(host);await save();return {hostId:host.id};
  }
  async function pair(id) {
    if(pairing || session || workers.size) throw new Error('Finish the current remote-play connection first.');
    const host=await find(id);await probe(host);
    try { const auth=await identity(host);if(xmlValue(await request(host,'serverinfo',auth),'PairStatus')==='1'){host.paired=true;await save();return {hostId:id,paired:true};} } catch { /* A new host needs PIN pairing. */ }
    const pin=String(crypto.randomInt(0,10000)).padStart(4,'0');
    const active={host,pin,cancelled:false};pairing=active;
    try {
      // StreamLight owns the PIN protocol and the private identity; its hidden
      // pairing window is never used as our UI. Its saved pinned certificate is
      // the completion signal, not an exit code from its confirmation dialog.
      const worker=await run(['pair',host.address,'--pin',pin],{timeout:0});active.worker=worker;
      emit('pairing',{hostId:id,pin});
      active.done=(async()=>{
        const until=now()+120000;
        while(!active.cancelled && now()<until) {
          await new Promise(resolve=>setTimeout(resolve,600));
          try { const auth=await identity(host);const xml=await request(host,'serverinfo',auth);if(active.cancelled || pairing!==active)return;if(xmlValue(xml,'PairStatus')==='1') {host.paired=true;host.error='';await save();worker.stop();await worker.done;if(pairing===active)pairing=null;emit('paired',{hostId:id});return;} } catch { /* PIN approval is pending. */ }
        }
        if(!active.cancelled)emit('pair-error',{hostId:id,error:'Pairing timed out. Enter the PIN in the host’s pairing page, then try again.'});
      })().catch(error=>emit('pair-error',{hostId:id,error:error.message})).finally(()=>{worker.stop();if(pairing===active)pairing=null;});
      return {pin,hostId:id,name:host.name};
    } catch(error) { if(pairing===active)pairing=null;throw error; }
  }
  async function cancelPair() {if(pairing){pairing.cancelled=true;pairing.worker?.stop();pairing=null;}return true;}
  async function refresh(id) {
    if(refreshing.has(id))return refreshing.get(id);
    const work=(async()=>{
      const host=await find(id);
      if(pairing?.host.id===id)throw new Error('Finish pairing this PC first.');
      try {
        await probe(host);const auth=await identity(host);const xml=await request(host,'applist',auth);const apps=parseApps(xml).filter(game=>game.installed!==false);
        if(apps.length===1 && /^permission denied/i.test(apps[0].title))throw new Error('Allow this client to list games in the host’s paired-device settings.');
        const covers=path.join(directory,'covers',id);await fs.mkdir(covers,{recursive:true});
        const previous=new Map((host.games||[]).map(game=>[game.appId,game]));
        await Promise.all(apps.map(async game=>{const file=coverFile(host,game);
          game.id=`remote:${id}:${game.appId}`;game.remoteHostId=id;game.hostName=host.name;game.provider='Remote PC';
          game.lastPlayed=host.playHistory?.[historyKey(game)] || previous.get(game.appId)?.lastPlayed || 0;
          const art=previous.get(game.appId)?.artwork;
          game.artwork=art?.remoteArtworkVersion===1?art:await fs.access(file).then(()=>({tile:pathToFileURL(file).href,imageSource:'remote-host'}),()=>({}));
        }));
        host.games=apps;host.paired=true;host.online=true;host.checkedAt=now();host.lastSeen=now();host.error='';await save();return {hostId:id,...publicHost(host)};
      }catch(error){host.error=error.message;host.online=false;host.checkedAt=now();await save();throw error;}
    })().finally(()=>refreshing.delete(id));refreshing.set(id,work);return work;
  }
  function coverFile(host,game) {
    const revision=game.artVersion?'-'+crypto.createHash('sha256').update(game.artVersion).digest('hex').slice(0,12):'';
    return path.join(directory,'covers',host.id,`${game.appId}${revision}.png`);
  }
  async function covers(id, appIds) {
    const host=await find(id), allowed=new Set((host.games || []).map(game=>game.appId));
    if(!Array.isArray(appIds))throw new Error('Choose games from this host.');
    const ids=[...new Set(appIds.map(String))].filter(appId=>allowed.has(appId)).slice(0,32), result=[];let next=0;
    await fs.mkdir(path.join(directory,'covers',id),{recursive:true});
    await Promise.all(Array.from({length:Math.min(3,ids.length)},async()=>{while(next<ids.length && !disposed && !session){const appId=ids[next++],key=id+':'+appId;
      if(!coverRequests.has(key))coverRequests.set(key,(async()=>{
        const game=host.games.find(game=>game.appId===appId),file=coverFile(host,game);
        let artwork=await resolveArtwork(game,{network:host.online!==false}).catch(()=>null);
        if(!artwork?.tile&&!artwork?.grid){
          if(!await fs.access(file).then(()=>true,()=>false)){
            if(host.online===false)return null;
            const auth=await identity(host),image=await request(host,'appasset',{...auth,binary:true,params:{appid:appId,AssetType:'2',AssetIdx:'0'}});
            if(!image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && !(image[0]===255&&image[1]===216))return null;
            await fs.writeFile(file,image);
          }
          artwork={...artwork,tile:pathToFileURL(file).href,imageSource:'remote-host',remoteArtworkVersion:1};
        }
        game.artwork=artwork;const item={appId,tile:artwork.tile||artwork.grid,artwork};emit('artwork',{hostId:id,...item});return item;
      })().catch(()=>null).finally(()=>coverRequests.delete(key)));
      const item=await coverRequests.get(key);if(item)result.push(item);
    }}));
    await save();return result;
  }
  async function stop(reason='disconnected') {
    launchGeneration++;
    const active=session;if(!active)return true;session=null;clearTimeout(active.timer);clearTimeout(active.deadline);active.worker?.stop();
    emit('ended',{reason,hostId:active.host.id,appId:active.game.appId,title:active.game.title});
    const restore=()=>{const win=getWindow();if(win&&!win.isDestroyed()){win.show();win.focus();win.webContents?.focus();}};
    restore();active.worker?.done.then(restore,restore);return true;
  }
  async function start(id,appId,preferences) {
    const generation=++launchGeneration;
    if(session || pairing || workers.size)throw new Error('End the current remote-play connection first.');
    const host=await find(id);if(!host.paired)throw new Error('Pair this PC before playing.');
    const game=(host.games || []).find(game=>game.appId===String(appId));if(!game)throw new Error('Refresh this PC’s games before playing.');
    const auth=await identity(host);const info=await request(host,'serverinfo',auth);
    const apps=parseApps(await request(host,'applist',auth)), latest=apps.find(app=>app.appId===game.appId);
    if(!latest || latest.installed===false)throw new Error('This game is no longer available on the host. Refresh its game library.');
    const launchTitle=latest.launchTitle || latest.title;
    if(apps.some(other=>other.appId!==game.appId && (other.launchTitle||other.title).toLowerCase()===launchTitle.toLowerCase()))throw new Error('This host has two apps with the same name. Give each app a unique title in the host’s settings, then refresh.');
    if(generation!==launchGeneration || disposed)return null;
    const running=xmlValue(info,'currentgame');
    if(running && running!=='0' && running!==game.appId)throw new Error('Another app is running on that host. Close it before starting this game.');
    const options=normalizePreferences(preferences || gamePreferences(host,game)),{width,height,fps,bitrate,codec,decoder}=options;
    const active={host,game,preferences:options,phase:'connecting',startedAt:now(),seenRunning:running===game.appId,empty:0,failed:0,video:false,surface:false};session=active;
    emit('connecting');
    function ready() {if(session===active && active.worker && active.surface && active.video && active.seenRunning && !['playing','revealing'].includes(active.phase)){active.phase='revealing';active.worker.send('viewport '+JSON.stringify(viewportState));active.worker.send('reveal');}}
    async function poll() {
      if(session!==active)return;
      try {
        const xml=await request(host,'serverinfo',auth), current=xmlValue(xml,'currentgame');active.failed=0;
        if(current===game.appId){active.seenRunning=true;active.empty=0;ready();}
        else if(active.seenRunning && current && ++active.empty>=2){await stop('game-closed');return;}
      } catch(error) {if(++active.failed===3)emit('connection-warning',{error:'Connection interrupted. Waiting for the host…'});if(active.failed>=10){await stop('connection-lost');return;}}
      if(session===active)active.timer=setTimeout(poll,1500);
    }
    try {
      const toggles=Object.entries({multiController:'multi-controller',swapFaceButtons:'swap-gamepad-buttons',touchscreenTrackpad:'touchscreen-trackpad',absoluteMouse:'absolute-mouse',vsync:'vsync',framePacing:'frame-pacing',performanceOverlay:'performance-overlay',hdr:'hdr',yuv444:'yuv444',audioOnHost:'audio-on-host',swapMouseButtons:'mouse-buttons-swap',reverseScroll:'reverse-scroll-direction'}).map(([key,name])=>'--'+(options[key]?'':'no-')+name);
      active.worker=await run(['stream',host.address,launchTitle,'--display-mode','windowed','--resolution',`${width}x${height}`,'--fps',String(fps),'--bitrate',String(bitrate),'--no-quit-after','--no-vrr','--no-mute-on-focus-loss','--keep-awake','--background-gamepad','--video-decoder',decoder,'--video-codec',codec,'--capture-system-keys',options.captureSystemKeys,'--audio-config',options.audioConfig==='stereo'?'stereo':options.audioConfig+'-surround',...toggles],{stream:true,timeout:0,preferences:options,onEvent:event=>{
        if(session!==active)return;
        if(event.type==='toggle-controls'&&active.phase==='playing'){emit('toggle-controls');return;}
        if(event.type==='disconnect-requested'){stop('disconnected');return;}
        if(event.type==='surface-lost'){
          active.surface=false;active.video=false;active.phase='reconnecting';
          clearTimeout(active.deadline);active.deadline=setTimeout(()=>{if(session===active){emit('error',{error:'The stream did not return after reconnecting. Reopen the game to resume.'});stop('reconnect-timeout');}},60000);
          emit('reconnecting');
        }
        if(event.type==='surface'){active.surface=true;ready();}
        if(event.type==='visible' && active.phase==='revealing'){
          active.phase='playing';clearTimeout(active.deadline);
          if(!active.recorded){active.recorded=true;game.lastPlayed=now();host.playHistory={...host.playHistory,[historyKey(game)]:game.lastPlayed};
          host.playHistory=Object.fromEntries(Object.entries(host.playHistory).sort((a,b)=>b[1]-a[1]).slice(0,200));
          save().catch(error=>console.warn('Remote play history could not be saved:',error.message));}
          emit('playing');
        }
        if(event.type==='surface-closed'){stop('disconnected');}
        // StreamLight 7 emits this only after notifyFirstFrame() opens its
        // reveal gate. "Video stream is ..." is merely format negotiation.
        if((event.type==='stdout'||event.type==='stderr') && /Stream window revealed: \d+x\d+|Received first (?:video )?frame/i.test(event.text)){active.video=true;ready();}
        if(event.type==='stdout'||event.type==='stderr') {
          const message=engineMessage(event.text);
          if(message){active.error=message;emit('error',{error:message});stop('error');return;}
          if(/Connection terminated: -?\d+/i.test(event.text)){
            if(active.phase!=='playing')emit('error',{error:'The host ended the connection before video arrived. Check the game and host display, or try H.264 in Stream settings.'});
            stop(active.phase==='playing'?'stream-ended':'error');
          }
        }
        if(event.type==='error'){emit('error',{error:event.message});stop('error');}
      }});
      if (session !== active) { active.worker.stop(); return null; }
      // Native stdout can arrive before run() resolves; repeat the readiness
      // decision now that the command pipe is owned by the active session.
      ready();
      active.worker.done.then(result=>{if(session!==active)return;const playing=active.phase==='playing';if(!playing)emit('error',{error:engineMessage(result.err+'\n'+result.out)||'The streaming engine stopped before video arrived. Check the host, or try H.264 in Stream settings.'});stop(playing?'stream-ended':'error');},error=>{if(session===active){emit('error',{error:error.message});stop('error');}});
      active.deadline=setTimeout(()=>{if(session===active&&active.phase!=='playing'){emit('error',{error:'The stream did not become ready. Check the host for a setup or permission prompt.'});stop('launch-timeout');}},120000);
      poll();return publicSession();
    } catch(error) {await stop('error');throw error;}
  }
  async function settings(id,preferences,config={}) {
    const host=await find(id);
    if(config.appId){
      const game=host.games?.find(game=>game.appId===String(config.appId));if(!game)throw new Error('Refresh this PC’s game library first.');
      const key=historyKey(game);host.gameOverrides ||= {};
      if(preferences===null)delete host.gameOverrides[key];
      else {const base=hostPreferences(host);host.gameOverrides[key]=Object.fromEntries(Object.entries(normalizePreferences(preferences)).filter(([key,value])=>value!==base[key]));}
      await save();return gamePreferences(host,game);
    }
    const profileId=['1','2','3'].includes(config.profileId)?config.profileId:host.activeProfile || '1';
    host.profiles=Object.fromEntries(streamProfiles(host).map(profile=>[profile.id,{name:profile.name,preferences:profile.preferences}]));
    host.profiles[profileId]={name:String(config.name || host.profiles[profileId].name).trim().slice(0,40) || `Profile ${profileId}`,preferences:normalizePreferences(preferences)};
    host.activeProfile=profileId;host.preferences=host.profiles[profileId].preferences;await save();return host.preferences;
  }
  async function hideGame(id,appId,hidden=true) {const host=await find(id);if(appId!==null&&!host.games?.some(game=>game.appId===String(appId)))throw new Error('This game is no longer in the host library.');host.hiddenApps=appId===null?[]:[...new Set((host.hiddenApps||[]).filter(value=>value!==String(appId)).concat(hidden?[String(appId)]:[]))];await save();return publicHost(host);}
  async function game(id,appId) {const host=await find(id),game=host.games?.find(item=>item.appId===String(appId));if(!game)throw new Error('This game is no longer in the host library.');return {...game,hostName:host.name};}
  async function remove(id) {if(session?.host.id===id)await stop();if(pairing?.host.id===id)await cancelPair();await load();hosts=hosts.filter(host=>host.id!==id);await save();return true;}
  function focus() {session?.worker?.send('focus');return Boolean(session);}
  function viewport(value) {const top=Number(value?.top),height=Number(value?.height);if(!Number.isFinite(top)||!Number.isFinite(height)||height<200||top<0||top>height*.4)throw new Error('Invalid stream viewport.');viewportState={top,height};session?.worker?.send('viewport '+JSON.stringify(viewportState));return true;}
  function active() {return publicSession();}
  function dispose() {disposed=true;if(pairing)pairing.cancelled=true;clearTimeout(session?.timer);clearTimeout(session?.deadline);session=null;for(const worker of workers)worker.stop();}
  const exclusive = operation => async (...args) => { if(acquiring)throw new Error('A remote-play connection is already starting.');acquiring=true;try{return await operation(...args);}finally{acquiring=false;} };
  return {snapshot,checkHosts,scan,add,pair:exclusive(pair),cancelPair,refresh,covers,settings,hideGame,game,start:exclusive(start),stop,remove,focus,viewport,active,dispose};
}
module.exports={createRemotePlay,parseAddress,parseApps,parseIni,qtValue,xmlValue,wireRequest,normalizePreferences,setIniValues,engineMessage};
