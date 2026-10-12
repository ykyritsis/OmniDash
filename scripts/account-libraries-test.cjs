const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {EventEmitter}=require('node:events');
const {createAccountLibraries,permittedAccountUrl}=require('../src/account-libraries.cjs');
async function test(){
  assert.ok(permittedAccountUrl('ea','https://signin.ea.com/p/login'));
  assert.ok(permittedAccountUrl('battlenet','https://account.battle.net/overview'));
  for(const url of ['https://ea.com.evil.test','http://ea.com','file:///test','https://user:password@www.ea.com','javascript:alert(1)'])assert.ok(!permittedAccountUrl('ea',url));
  const jars=new Map();let offline=false,requests=0,signedIn=true,failLibrary=false;const windows=[],phases=[];
  function jar(id){
    if(jars.has(id))return jars.get(id);
    const value=new EventEmitter();
    value.setPermissionRequestHandler=fn=>{let granted;fn(null,'camera',result=>granted=result);assert.equal(granted,false);};
    value.setPermissionCheckHandler=fn=>assert.equal(fn(),false);
    value.webRequest={onBeforeSendHeaders:(_filter,fn)=>{value.headerHandler=fn;}};
    value.clearStorageData=async()=>{value.cleared=true;};
    value.fetch=async(url,init)=>{
      requests++;assert.equal(init.redirect,'error');if(offline)throw Error('offline');
      if(id.endsWith('battlenet')) {
        if(url.endsWith('/api/'))return Response.json({authenticated:signedIn});
        if(failLibrary)throw Error('library unavailable');
        if(url.endsWith('classic-games'))return Response.json({classicGames:[]});
        return Response.json({gameAccounts:[{titleId:4613486,localizedGameName:'Diablo IV'}]});
      }
      assert.equal(init.headers.Authorization,'Bearer private-fixture-token');
      if(init.method==='POST')return Response.json({data:{legacyOffers:[{offerId:'offer-1',contentId:'content-1'}]}});
      const next=JSON.parse(new URL(url).searchParams.get('variables')).next;
      return Response.json({data:{me:{ownedGameProducts:{items:next==='0'?[{originOfferId:'offer-1',product:{name:'Example Game'}}]:[],next:next==='0'?'500':null}}}});
    };
    jars.set(id,value);return value;
  }
  class FakeWindow extends EventEmitter {
    constructor(options){super();this.options=options;this.webContents=new EventEmitter();this.webContents.setWindowOpenHandler=fn=>{this.popup=fn;};
      windows.push(this);this.webContents.getURL=()=>this.url;
      assert.equal(options.webPreferences.sandbox,true);assert.equal(options.webPreferences.nodeIntegration,false);assert.equal(options.webPreferences.contextIsolation,true);assert.equal(options.webPreferences.preload,undefined);
    }
    loadURL(url){this.url=url;this.options.webPreferences.session.headerHandler?.({requestHeaders:{Authorization:'Bearer private-fixture-token'}},()=>{});queueMicrotask(()=>this.webContents.emit('did-finish-load'));return Promise.resolve();}
    isDestroyed(){return !!this.destroyed;}
    destroy(){this.destroyed=true;this.emit('closed');}
    close(){this.destroy();}
    hide(){this.hidden=true;}
    show(){this.hidden=false;}
    focus(){}
  }
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'preview-account-test-'));
  const service=createAccountLibraries(directory,()=>null,false,{session:{fromPartition:jar},BrowserWindow:FakeWindow,onProgress:state=>phases.push(state)});
  const bnet=await service.library('battlenet',true);assert.equal(bnet.status,'ready');assert.equal(bnet.games.length,1);
  const calls=requests;await service.library('battlenet');assert.equal(requests,calls,'fresh inventory should not refetch');
  const ea=await service.library('ea',true);assert.equal(ea.games.length,1);assert.equal(ea.games[0].installUri,'origin2://game/launch/?offerIds=content-1');
  assert.equal(jars.size,2,'publishers must use isolated cookie jars');
  for(const provider of ['ea','battlenet']){const saved=await fs.readFile(path.join(directory,provider+'.json'),'utf8');assert.ok(!saved.includes('private-fixture-token'));}
  offline=true;const stale=await service.library('battlenet',true);assert.equal(stale.status,'cached-sign-in-required');assert.equal(stale.games.length,1);
  offline=false;
  const connected=await service.connect('battlenet');assert.equal(connected.status,'ready');assert.equal(windows.at(-1).destroyed,true,'verified sign-in must close the browser even while it is still on a login URL');
  assert.ok(phases.some(p=>p.phase==='waiting')&&phases.some(p=>p.phase==='loading')&&phases.some(p=>p.phase==='connected'));
  await service.connect('ea');assert.ok(windows.every(win=>win.destroyed),'EA visible and hidden auth windows must close');
  signedIn=false;const canceled=service.connect('battlenet');setTimeout(()=>service.cancelConnect(),25);await assert.rejects(canceled,/cancelled/);assert.equal(windows.at(-1).destroyed,true);assert.equal(phases.at(-1).phase,'error');
  assert.equal((await service.status('battlenet')).count,1,'failed reconnect must retain the saved account library');
  signedIn=true;failLibrary=true;await assert.rejects(service.connect('battlenet'),/Signed in.*could not be read/);assert.equal(windows.at(-1).destroyed,true,'signed-in library errors must close the browser and report a failure');failLibrary=false;
  await service.disconnect('ea');assert.equal((await service.status('ea')).count,0);assert.equal(jars.get('persist:library-ea').cleared,true);
  assert.equal((await service.status('battlenet')).count,1,'disconnect must preserve other provider inventory');
  await assert.rejects(service.connect('unknown'));
  await fs.rm(directory,{recursive:true,force:true});
  console.log('PASS publisher sessions, login window cleanup without route assumptions, connection progress, cancellation, preserved reconnect cache, domain guards, EA pagination, offline inventory and disconnect');
}
test().catch(error=>{console.error(error);process.exitCode=1;});
