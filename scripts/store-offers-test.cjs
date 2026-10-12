const assert=require('node:assert/strict');
const {createStoreOffers}=require('../src/store-offers.cjs');
(async()=>{
  let calls=0,active=0,max=0;const regions=[];
  const service=createStoreOffers(async url=>{
    calls++;active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,10));active--;
    const params=new URL(url).searchParams;const id=params.get('appids');regions.push(params.get('cc'));
    return {ok:true,json:async()=>({[id]:{success:true,data:{name:'Fixture',price_overview:{final_formatted:'A$ 20.00',currency:'AUD',initial_formatted:'A$ 40.00',discount_percent:50},genres:[{description:'Racing'}],package_groups:[{subs:[{packageid:42,option_text:'Standard edition'}]}]}}})};
  });
  const [a,b]=await Promise.all([service.get('1'),service.get('1'),...Array.from({length:8},(_,i)=>service.get(i+2))]);
  assert.deepEqual(a,b);assert.equal(calls,9);assert.equal(max,2);assert.equal(a.editions[0].packageId,42);assert.equal(a.currency,'AUD');
  await service.get('1');assert.equal(calls,9);await assert.rejects(service.get('../123'));
  const au=await service.get('1','AU');assert.equal(calls,10);assert.equal(au.country,'AU');assert.equal(regions.at(-1),'AU');
  await service.get('1','AU');assert.equal(calls,10);assert.equal(a.country,'US');await assert.rejects(service.get('1','US&cc=AU'));
  console.log('PASS Store offer formatting, request deduplication, concurrency limit, cache, ID validation');
})().catch(error=>{console.error(error);process.exitCode=1});
