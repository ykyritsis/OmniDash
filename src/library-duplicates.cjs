// Deliberately match the complete title: remasters, sequels and editions stay
// distinct. This changes presentation only; every copy keeps its own identity.
(function(root) {
  const providers = ['Steam','Xbox PC','Epic Games','GOG Galaxy','Ubisoft Connect','EA app','Battle.net','Rockstar Games','PC','Google Drive'];
  function titleKey(title) {
    return String(title || '').normalize('NFKC').replace(/[™®©]/g,'').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
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
  const api={titleKey,duplicateGroups,chooseCopy,visibleCopies,providers};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.libraryDuplicates=api;
})(typeof globalThis==='object'?globalThis:this);
