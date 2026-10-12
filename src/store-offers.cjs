function createStoreOffers(request=fetch) {
  const cache=new Map(), pending=new Map();
  let active=0; const queue=[];
  async function get(appId, country = 'US') {
    const id=String(appId);
    if(!/^\d{1,10}$/.test(id))throw Error('Invalid Steam game');
    const region=String(country).toUpperCase();
    if(!/^[A-Z]{2}$/.test(region))throw Error('Invalid Store region');
    const key=`${region}:${id}`;
    const cached=cache.get(key);
    if(cached && Date.now()-cached.at<900000)return cached.value;
    if(pending.has(key))return pending.get(key);
    const promise=(async()=>{
      if(active>=2)await new Promise(resolve=>queue.push(resolve));
      else active++;
      try {
        const response=await request(`https://store.steampowered.com/api/appdetails?appids=${id}&l=english&cc=${region}`,{signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw Error('Prices are unavailable');
        const body=await response.json(), data=body[id]?.success && body[id].data;
        if(!data)throw Error('This game is not available in this Store region');
        const value={appId:id,title:data.name,price:data.is_free?'Free':data.price_overview?.final_formatted||'',currency:data.price_overview?.currency||'',originalPrice:data.price_overview?.initial_formatted||'',discount:data.price_overview?.discount_percent||0,comingSoon:!!data.release_date?.coming_soon,releaseDate:data.release_date?.date||'',genres:(data.genres||[]).map(item=>item.description).slice(0,3),description:String(data.short_description||'').replace(/<[^>]*>/g,' '),editions:(data.package_groups||[]).flatMap(group=>group.subs||[]).map(item=>({packageId:item.packageid,label:String(item.option_text||'').replace(/<[^>]*>/g,' ')})).slice(0,12)};
        value.country=region;
        cache.set(key,{value,at:Date.now()});
        if(cache.size>128)cache.delete(cache.keys().next().value);
        return value;
      }finally{const next=queue.shift();if(next)next();else active--;}
    })().finally(()=>pending.delete(key));
    pending.set(key,promise);return promise;
  }
  return {get};
}
module.exports={createStoreOffers};
