const assert=require('node:assert/strict');
const {duplicateGroups,visibleCopies,chooseCopy,createViewCache}=require('../src/library-duplicates.cjs');
const games=[
  {id:'steam-1',title:'DOOM®',provider:'Steam',installed:false,playCount:7},
  {id:'xbox-1',title:'Doom',provider:'Xbox PC',installed:true,artwork:{tile:'kept'}},
  {id:'epic-1',title:'Doom',provider:'Epic Games',installed:true},
  {id:'steam-2',title:'Doom Eternal',provider:'Steam',installed:true},
  {id:'pc-1',title:'Doom Remastered',provider:'PC',installed:true},
  {id:'app-1',title:'Doom',provider:'PC',isApp:true},
  {id:'steam-3',title:'Title: Edition',provider:'Steam'},
  {id:'pc-3',title:'Title — Edition',provider:'PC'}
];
const groups=duplicateGroups(games);assert.equal(groups.length,2);
assert.equal(chooseCopy(groups[0].copies,{duplicatePreferredProvider:'Steam'}).id,'xbox-1');
const options={duplicateMode:'preferred',duplicatePreferredProvider:'Epic Games',duplicatePreferences:{'title edition':'pc-3'}};
const visible=visibleCopies(games,options);assert.deepEqual(visible.map(game=>game.id),['epic-1','steam-2','pc-1','app-1','pc-3']);
assert.equal(visibleCopies(games,{duplicateMode:'all'}),games);
assert.equal(chooseCopy(groups[0].copies,{duplicatePreferences:{doom:'steam-1'}}).id,'steam-1');
assert.equal(games[0].playCount,7);assert.equal(games[1].artwork.tile,'kept');
assert.equal(duplicateGroups([{id:'1',title:'Same',provider:'Steam'},{id:'2',title:'Same',provider:'Steam'}]).length,0);
console.log('PASS cross-library matching, edition separation, installed preference, per-game override and preservation of every source entry');
const cache=createViewCache(), settings={duplicateMode:'preferred',duplicatePreferredProvider:'Steam',duplicatePreferences:{}};
const library=games.map(game=>({...game}));
const first=cache(library,settings);
assert.equal(cache(library,settings),first,'Repeated queries reuse the presentation');
assert.deepEqual(first.copyIds.get('steam-1'),['steam-1','xbox-1','epic-1']);
library[0].artwork={tile:'new art'};library[0].playCount++;
assert.equal(cache(library,settings),first,'Art and history do not change duplicate selection');
library[0].installed=true;
assert.equal(cache(library,settings).games[0].id,'steam-1','An install changes the preferred copy immediately');
settings.duplicatePreferences.doom='epic-1';
assert.equal(cache(library,settings).games[0].id,'epic-1','An in-place override must invalidate the cache');
delete settings.duplicatePreferences.doom; settings.duplicatePreferredProvider='Xbox PC';
assert.equal(cache(library,settings).games[0].id,'xbox-1','Changing automatic preference must take effect');
library[1].title='Doom 2';
assert(cache(library,settings).games.some(game=>game.id==='xbox-1'),'Renamed games must leave their old duplicate group');
library[2].isApp=true;
assert(!cache(library,settings).copyIds.has('epic-1'),'Reclassifying an app must remove it from grouping');
library[2].isApp=false;library[2].provider='Steam';
assert(!cache(library,settings).copyIds.has('epic-1'),'Same-provider entries must stay separate');
library[2].provider='Epic Games';library[2].isLauncher=true;
assert(!cache(library,settings).copyIds.has('epic-1'),'Launchers must stay separate');
library[2].isLauncher=false;library[2]={...library[2],id:'replacement'};
assert(cache(library,settings).copyIds.has('replacement'),'Replacement objects/IDs must not retain old references');
library.reverse();
assert.deepEqual(cache(library,settings).games,visibleCopies(library,settings),'Reordering the library must reorder the presentation');
library.pop();
assert.deepEqual(cache(library,settings).games,visibleCopies(library,settings),'Removing games must invalidate the presentation');
console.log('PASS duplicate view cache retains live artwork/history and invalidates on install, preference, title, type, identity, provider and order changes');
