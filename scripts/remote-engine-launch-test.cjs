// Launch the real bundled StreamLight against a local, TLS-pinned protocol
// fixture. This catches hidden Qt animation deadlocks and early SDL probe
// windows; mocking the decoder process cannot exercise either regression.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http'),https=require('node:https');
const assert=require('node:assert/strict');
const {createRemotePlay,parseIni}=require('../src/remote-play.cjs');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.visual-review','remote-engine-launch');
app.setPath('userData',path.join(output,'electron'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let win,remote,plain,secure;const events=[];let launched=false;
app.whenReady().then(async()=>{
  const identity=parseIni(await fs.readFile(path.join(root,'.visual-review','remote-native','engine-profile','FoggyBytes','StreamLight.ini'),'utf8')).General;
  assert(identity.certificate&&identity.key,'Run remote-native-review.cjs first to create the isolated test identity');
  const binary=await fs.readFile(path.join(root,'.packaging-staging','streamlight','runtime','StreamLight.exe'));
  assert(binary.includes(Buffer.from('Stream window revealed: %dx%d')),'The pinned engine must provide the decoded-frame readiness event');
  const certificate=value=>'@ByteArray('+value.replaceAll('\\','\\\\').replaceAll('\r','\\r').replaceAll('\n','\\n')+')';
  const handle=(req,res)=>{
    const route=new URL(req.url,'http://fixture').pathname;let body='';
    if(route==='/serverinfo')body=`<hostname>Engine fixture</hostname><appversion>7.1.431.-1</appversion><GfeVersion>3.23.0.74</GfeVersion><uniqueid>01234567-89ab-cdef-0123-456789abcdef</uniqueid><HttpsPort>${secure.address().port}</HttpsPort><ExternalPort>${plain.address().port}</ExternalPort><mac>00:00:00:00:00:00</mac><LocalIP>127.0.0.1</LocalIP><MaxLumaPixelsHEVC>0</MaxLumaPixelsHEVC><ServerCodecModeSupport>1</ServerCodecModeSupport><PairStatus>1</PairStatus><currentgame>0</currentgame><state>SUNSHINE_SERVER_FREE</state>`;
    else if(route==='/applist')body='<App><AppTitle>Launch regression</AppTitle><ID>42</ID><IsHdrSupported>0</IsHdrSupported></App>';
    else if(route==='/launch'){launched=true;res.writeHead(200,{'Content-Type':'application/xml'});res.end('<root status_code="503" status_message="Regression fixture reached launch"/>');return;}
    res.writeHead(200,{'Content-Type':'application/xml'});res.end('<?xml version="1.0" encoding="utf-8"?><root status_code="200">'+body+'</root>');
  };
  secure=https.createServer({cert:identity.certificate,key:identity.key,requestCert:true,rejectUnauthorized:false},handle);plain=http.createServer(handle);
  await new Promise(resolve=>secure.listen(0,'127.0.0.1',resolve));await new Promise(resolve=>plain.listen(0,'127.0.0.1',resolve));
  const port=plain.address().port,host={id:'fixture',uuid:'01234567-89ab-cdef-0123-456789abcdef',name:'Engine fixture',address:`127.0.0.1:${port}`,hostname:'127.0.0.1',httpPort:port,httpsPort:secure.address().port,paired:true,games:[{id:'remote:fixture:42',appId:'42',title:'Launch regression',artwork:{}}]};
  const directory=path.join(output,'profile');await fs.mkdir(path.join(directory,'engine','FoggyBytes'),{recursive:true});
  await fs.writeFile(path.join(directory,'hosts.json'),JSON.stringify([host]));
  await fs.writeFile(path.join(directory,'engine','FoggyBytes','StreamLight.ini'),`[General]\ncertificate=${certificate(identity.certificate)}\nkey=${certificate(identity.key)}\nuniqueid=${identity.uniqueid}\n[hosts]\nsize=1\n1\\hostname=Engine fixture\n1\\uuid=${host.uuid}\n1\\localaddress=127.0.0.1\n1\\localport=${port}\n1\\manualaddress=127.0.0.1\n1\\manualport=${port}\n1\\srvcert=${certificate(identity.certificate)}\n1\\nvidiasw=false\n1\\streamtweakenabled=false\n`);
  win=new BrowserWindow({width:960,height:600,show:false,webPreferences:{sandbox:true}});await win.loadURL('data:text/html,<body style="background:%23171920;color:white">Remote launch regression</body>');
  remote=createRemotePlay({directory,runtimeDirectory:path.join(root,'.packaging-staging','streamlight'),getWindow:()=>win,onStatus:event=>events.push(event)});
  await remote.settings(host.id,{width:1280,height:720,fps:60,bitrate:10000,codec:'H.264'}).then(()=>remote.start(host.id,'42'));
  const deadline=Date.now()+25000;while(Date.now()<deadline&&!events.some(event=>event.phase==='ended'))await pause(100);
  assert(launched,'The real hidden StreamLight engine never sent /launch');
  assert(events.some(event=>event.phase==='error'&&/Regression fixture reached launch/i.test(event.error)),'The host launch error must reach the app instead of staying in a hidden Qt dialog');
  assert(events.some(event=>event.phase==='ended'),'Failed launch must return control to the app');
  assert(!events.some(event=>event.phase==='playing'),'A decoder probe must never reveal a stream');
  await fs.writeFile(path.join(output,'result.json'),JSON.stringify({ok:true,launched,events},null,2));
  console.log('PASS actual bundled StreamLight sends /launch with its UI hidden; TLS pinning; host errors surface; probe windows never become streams.');
}).then(()=>cleanup(0),async error=>{console.error(error.message);await fs.writeFile(path.join(output,'failure.json'),JSON.stringify({launched,events},null,2));cleanup(1);});
function cleanup(code){remote?.dispose();win?.destroy();plain?.closeAllConnections();secure?.closeAllConnections();plain?.close();secure?.close();setTimeout(()=>app.exit(code),500);}
setTimeout(()=>cleanup(1),40000).unref();
