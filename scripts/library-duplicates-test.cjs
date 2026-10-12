const assert=require('node:assert/strict');
const {duplicateGroups,visibleCopies,chooseCopy}=require('../src/library-duplicates.cjs');
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
