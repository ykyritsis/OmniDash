// Deliberately match the complete title: remasters, sequels and editions stay
// distinct. This changes presentation only; every copy keeps its own identity.
(function(root) {
  const providers = ['Steam','Xbox PC','Epic Games','GOG Galaxy','Ubisoft Connect','EA app','Battle.net','Rockstar Games','PC','Google Drive'];
  function titleKey(title) {
    return String(title || '').replace(/[™®©]/g,'').normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  }
  function duplicateGroups(games) {
    const grouped = new Map();
    for (const game of games) {
      if (game.isApp || game.isLauncher) continue;
      const key = titleKey(game.title);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key,[]);
      grouped.get(key).push(game);
    }
    return [...grouped].filter(([,copies])=>new Set(copies.map(game=>game.provider)).size>1)
      .map(([key,copies])=>({key,title:copies[0].title,copies}));
  }
  function chooseCopy(copies, settings = {}) {
    const key=titleKey(copies[0]?.title);
    const explicit=copies.find(game=>game.id===settings.duplicatePreferences?.[key]);
    if(explicit)return explicit;
    const priority=provider=>provider===settings.duplicatePreferredProvider?-1:providers.indexOf(provider)<0?99:providers.indexOf(provider);
    return [...copies].sort((a,b)=>Number(b.installed!==false)-Number(a.installed!==false)||priority(a.provider)-priority(b.provider)||a.id.localeCompare(b.id))[0];
  }
  function visibleCopies(games, settings = {}, groups = duplicateGroups(games)) {
    if(settings.duplicateMode!=='preferred')return games;
    const choices=new Map();
    for(const group of groups) {
      const primary=chooseCopy(group.copies,settings);
      for(const copy of group.copies)choices.set(copy.id,primary);
    }
    const shown=new Set(),visible=[];
    for(const game of games) {
      const primary=choices.get(game.id)||game;
      if(!shown.has(primary.id)){shown.add(primary.id);visible.push(primary);}
    }
    return visible;
  }
  function createViewCache() {
    let snapshot = [], preferences = [], mode, preferredProvider, result;
    return function view(games, settings = {}) {
      const choices = settings.duplicatePreferences || {};
      // Games can be updated in place after an install or a metadata edit.
      // Check the fields that affect grouping/selection, without normalizing
      // every title and allocating every group again on each Home row.
      const unchanged = result && mode === settings.duplicateMode && preferredProvider === settings.duplicatePreferredProvider
        && preferences.length === Object.keys(choices).length && preferences.every(([key,value]) => choices[key] === value)
        && snapshot.length === games.length && snapshot.every((old,i) => {
          const game = games[i];
          return old.game === game && old.id === game.id && old.title === game.title && old.provider === game.provider
            && old.installed === game.installed && old.isApp === game.isApp && old.isLauncher === game.isLauncher;
        });
      if (unchanged) return result;
      snapshot = games.map(game => ({game,id:game.id,title:game.title,provider:game.provider,installed:game.installed,isApp:game.isApp,isLauncher:game.isLauncher}));
      preferences = Object.entries(choices); mode = settings.duplicateMode; preferredProvider = settings.duplicatePreferredProvider;
      const groups = duplicateGroups(games), copyIds = new Map();
      for (const group of groups) {
        const ids = group.copies.map(game => game.id);
        for (const id of ids) copyIds.set(id,ids);
      }
      result = {groups,copyIds,games:visibleCopies(games,settings,groups)};
      return result;
    };
  }
  // Build once for a shelf/search render. Empty IDs and non-Latin titles must
  // never collapse into a match; explicit editions keep their own identities.
  function createOwnershipIndex(games, settings = {}) {
    const steam = new Map(), xbox = new Map(), titles = new Map();
    const add = (map, key, game) => { if (key) { if (!map.has(key)) map.set(key, []); map.get(key).push(game); } };
    for (const game of games) {
      if (game.isApp || game.isLauncher) continue;
      if (game.provider === 'Steam') add(steam, String(game.appId || ''), game);
      add(xbox, String(game.xboxProductId || '').toUpperCase(), game);
      add(titles, titleKey(game.title), game);
    }
    return { find(game) {
      const appId = game.provider === 'Steam' ? String(game.appId || '') : '';
      const productId = String(game.xboxProductId || '').toUpperCase();
      const exact = (appId && steam.get(appId)) || (productId && xbox.get(productId));
      const copies = exact || (titles.get(titleKey(game.title)) || []).filter(item =>
        !(appId && item.provider === 'Steam' && item.appId && String(item.appId) !== appId)
        && !(productId && item.xboxProductId && String(item.xboxProductId).toUpperCase() !== productId));
      return copies.length === 1 ? copies[0] : copies.length ? chooseCopy(copies, settings) : undefined;
    } };
  }
  const api={titleKey,duplicateGroups,chooseCopy,visibleCopies,createViewCache,createOwnershipIndex,providers};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.libraryDuplicates=api;
})(typeof globalThis==='object'?globalThis:this);
