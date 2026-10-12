(function(root) {
  const BUDGET = 1000, ALGORITHM = 2;
  function weight(percent) {
    const number = percent === null || percent === undefined || percent === '' ? NaN : Number(percent);
    return Number.isFinite(number) ? 10 + 90 * (1 - Math.sqrt(Math.max(0, Math.min(100, number)) / 100)) : 10;
  }
  function pointTable(achievements, percentages = new Map(), previous = {}) {
    const ids = [...new Set((Array.isArray(achievements) ? achievements : []).filter(a => typeof a.apiname === 'string' && a.apiname.length > 0 && a.apiname.length <= 200).map(a=>a.apiname))].sort().slice(0,20000);
    const entries = ids.map(id => {
      const old = Object.hasOwn(previous, id) ? previous[id] : null;
      const raw = percentages.get(id), known = raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw));
      const percent = old?.rarityKnown ? old.percent : known ? Math.max(0, Math.min(100, Number(raw))) : null;
      return {id,percent,rarityKnown:old?.rarityKnown || known,weight:weight(percent)};
    });
    const sameCatalog = ids.length && ids.length === Object.keys(previous).length && ids.every(id => Object.hasOwn(previous,id)) && Object.values(previous).reduce((sum,p)=>sum+p.points,0) === BUDGET;
    if (sameCatalog) return Object.fromEntries(ids.map(id => [id, { ...previous[id] }]));
    const totalWeight = entries.reduce((sum,e)=>sum+e.weight,0);
    for (const e of entries) { const exact = BUDGET * e.weight / totalWeight;e.points = Math.floor(exact);e.remainder=exact-e.points; }
    const remaining = BUDGET - entries.reduce((sum,e)=>sum+e.points,0);
    const ranked = [...entries].sort((a,b)=>b.remainder-a.remainder || (a.id<b.id?-1:a.id>b.id?1:0));
    for (let i=0;i<remaining && i<ranked.length;i++) ranked[i].points++;
    return Object.fromEntries(entries.map(e=>[e.id,{points:e.points,percent:e.percent,rarityKnown:!!e.rarityKnown}]));
  }
  function calculate(achievements, percentages = new Map(), previous = {}) {
    const table = pointTable(achievements, percentages, previous), entries = Object.create(null);
    for (const a of Array.isArray(achievements) ? achievements : []) if (Number(a.achieved)===1 && Object.hasOwn(table,a.apiname)) entries[a.apiname]={...table[a.apiname],name:typeof a.name==='string'?a.name.slice(0,240):a.apiname,unlockedAt:Number(a.unlocktime)||0};
    const possible = Object.keys(table).length ? BUDGET : 0;
    const points = Object.values(entries).reduce((sum,e)=>sum+e.points,0), unlocked=Object.keys(entries).length, total=Object.keys(table).length;
    return {algorithm:ALGORITHM,points,possible,unlocked,total,completed:total>0&&unlocked===total,pointTable:table,entries};
  }
  function level(points) { return Math.floor(Math.sqrt(Math.max(0,Number(points)||0)/1000))+1; }
  const api={BUDGET,ALGORITHM,weight,pointTable,calculate,level};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.pcGamerscore=api;
})(typeof globalThis==='object'?globalThis:this);
