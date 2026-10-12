const assert=require('node:assert/strict');
const {parseUbisoftConfigurations,parseBattleNetInstalled,parseBattleNetOwned,parseEaOwned,eaLibraryUrl,parseRegistry,mergePublisherGames,protobuf}=require('../src/launcher-libraries.cjs');
function integer(value) {const out=[];do{let byte=value%128;value=Math.floor(value/128);if(value)byte|=128;out.push(byte);}while(value);return Buffer.from(out);}
function field(number,value) {return typeof value==='number'?Buffer.concat([integer(number*8),integer(value)]):Buffer.concat([integer(number*8+2),integer(Buffer.byteLength(value)),Buffer.from(value)]);}
const product=(id,yaml)=>field(1,Buffer.concat([field(1,id),field(2,id+100),field(3,yaml)]));
const buffer=Buffer.concat([
  product(1,'root:\n  name: title_key\n  start_game: { executable: game.exe }\n  addons: [{ id: 2 }]\nlocalizations:\n  default:\n    title_key: "Real Game"'),
  product(2,'root:\n  name: DLC\n  start_game: {}'),
  product(3,'root:\n  name: Third party\n  third_party_platform: steam\n  start_game: {}'),
  product(4,'root:\n  name: Soundtrack\n  is_ulc: true\n  start_game: {}'),
  product(5,'root:\n  name: Not a game')]);
const ubi=parseUbisoftConfigurations(buffer);assert.equal(ubi.length,1);assert.equal(ubi[0].title,'Real Game');assert.equal(ubi[0].installed,false);assert.equal(ubi[0].installUri,'uplay://install/1');
assert.throws(()=>protobuf(Buffer.from([10,255,255])));
const installed=parseBattleNetInstalled(field(1,Buffer.concat([field(1,'fen'),field(2,'Fen'),field(3,field(1,'C:\\Games\\Diablo IV'))])));
assert.equal(installed[0].title,'Diablo IV');assert.equal(installed[0].installed,true);
const bnet=parseBattleNetOwned({gameAccounts:[{titleId:4613486,localizedGameName:'Diablo IV'},{titleId:4613486,localizedGameName:'Diablo IV'},{titleId:999999,localizedGameName:'Future game'}]});
assert.equal(bnet.length,2);assert.equal(bnet[1].clientOnly,true);assert.equal(bnet[1].launchUri,undefined);
const ea=parseEaOwned({data:{me:{ownedGameProducts:{items:[{originOfferId:'OFB-EAST:1095',product:{name:'Example™',gamePlatformDetails:{gamePlatform:'PC'}}},{originOfferId:'bad<script>',product:{name:'Bad'}}],next:'500'}}}});
assert.equal(ea.games.length,1);assert.equal(ea.games[0].title,'Example');assert.equal(ea.next,'500');
const url=new URL(eaLibraryUrl('500'));assert.equal(url.hostname,'service-aggregation-layer.juno.ea.com');assert.equal(JSON.parse(url.searchParams.get('variables')).next,'500');
const merged=mergePublisherGames([{id:'old-shortcut',provider:'EA app',title:'Example',installed:true,shortcutPath:'C:\\Example.lnk'}],ea.games);
assert.equal(merged.length,1);assert.equal(merged[0].id,'old-shortcut');assert.equal(merged[0].installed,true);assert.equal(merged[0].providerId,'OFB-EAST:1095');
const registry=parseRegistry('HKEY_LOCAL_MACHINE\\SOFTWARE\\Ubisoft\\Launcher\\Installs\\1\r\n    InstallDir    REG_SZ    C:\\Games\\Example\r\n');assert.equal(registry[0].values.installdir,'C:\\Games\\Example');
assert.throws(()=>parseEaOwned({data:{me:null}}));assert.throws(()=>parseBattleNetOwned({error:'unauthorized'}));
console.log('PASS Ubisoft owned cache/DLC filtering, Battle.net installs/account dedupe, unknown-product fallback, EA pagination, installed/owned merge and registry parser');
