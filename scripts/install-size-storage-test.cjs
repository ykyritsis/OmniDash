// Install sizes (Steam depots and store requirements) and the storage overview.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {PassThrough,Writable}=require('node:stream');
const {depotSizes,requirementBytes,createInstallSizeLookup}=require('../src/steam-install-size.cjs');
const {storageOverview}=require('../src/storage-overview.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(test,ms=5000){const end=Date.now()+ms;while(!test()){if(Date.now()>end)throw new Error('Timed out waiting for lifecycle state');await pause(25);}}
async function main(){
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
}
main().catch(error=>{console.error(error);process.exitCode=1;});
