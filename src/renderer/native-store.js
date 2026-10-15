const storeOfferCache=new Map(), storeOfferTimes=new Map(), storeOfferRequests=new Set(), storeOfferFailures=new Map();
let storeOfferEpoch = 0;
const storeTileAnimations=new Map();
const storeLabels={mostPlayed:'Most played',topSellers:'Top paid games',upcoming:'Games coming soon'};
function nativeStoreGame(id) {
  return Object.values(state.steamDiscovery).filter(Array.isArray).flat().find(game=>game.id===id);
}
function nativeStoreArt(game) {
  const wide=game.artwork?.hero||game.artwork?.wide;
  return gameArt(game)+(wide?'<img class="store-wide-art" src="'+escapeHtml(wide)+'" alt="" loading="lazy" />':'');
}
function updateNativeStoreArtwork(appId) {
  const game=Object.values(state.steamDiscovery).filter(Array.isArray).flat().find(game=>String(game.appId)===String(appId));
  if(!game)return;
  document.querySelectorAll('.store-product').forEach(card=>{
    if(card.dataset.appId===String(appId))card.querySelector('.store-product-art').innerHTML=nativeStoreArt(game);
  });
}
function storePrice(offer) {
  if(!offer)return 'View on Steam';
  return offer.price || (offer.comingSoon ? offer.releaseDate||'Coming soon' : 'View on Steam');
}
function nativeStoreCard(game,selected=false,feature=false) {
  const offer=storeOfferCache.get(String(game.appId));
  const owned=state.games.some(item=>item.provider==='Steam'&&String(item.appId)===String(game.appId));
  return '<button class="store-product focusable'+(selected?' store-product-selected':'')+'" data-action="discovery-game" data-app-id="'+escapeHtml(game.appId)+'" data-game-id="'+escapeHtml(game.id)+'" aria-label="'+escapeHtml(game.title)+(owned?', in your library':'')+'"><span class="store-product-art">'+nativeStoreArt(game)+(owned?'<span class="store-owned">In your library</span>':'')+'</span><span class="store-product-copy">'+(!feature?'<strong>'+escapeHtml(game.title)+'</strong>':'')+'<span class="store-product-price" data-price-app="'+escapeHtml(game.appId)+'">'+escapeHtml(storePrice(offer))+'</span></span></button>';
}
function renderNativeStore(grid) {
  const focused=document.activeElement?.closest('.store-product');
  const restore=focused?{id:focused.dataset.gameId,shelf:focused.closest('[data-store-shelf]')?.dataset.storeShelf}:null;
  for(const animation of storeTileAnimations.values())animation.cancel();storeTileAnimations.clear();
  const view=document.querySelector('#store-view');view.classList.add('native-store');
  const games=state.steamDiscovery[consoleStoreTab]||[];
  const selected=games.find(game=>game.id===state.storeSelectedId)||games[0];
  document.querySelector('#store-heading').textContent=storeLabels[consoleStoreTab];
  document.querySelectorAll('.console-store-tabs button').forEach(tab=>{
    const active=tab.dataset.tab===consoleStoreTab;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));
  });
  grid.className='native-store-content';
  const secondary=Object.keys(storeLabels).filter(key=>key!==consoleStoreTab);
  grid.innerHTML='<section data-store-shelf="'+consoleStoreTab+'" class="store-featured-shelf"><div class="native-store-products">'+games.map(game=>nativeStoreCard(game,game===selected,true)).join('')+'</div><div id="store-selection-details" class="store-selection-details" aria-live="polite" aria-atomic="true"></div></section>'+secondary.map(key=>{
    const items=state.steamDiscovery[key]||[];if(!items.length)return '';
    return '<section class="store-shelf" data-store-shelf="'+key+'"><h2>'+storeLabels[key]+'</h2><div class="native-store-secondary">'+items.map(game=>nativeStoreCard(game)).join('')+'</div></section>';
  }).join('');
  if(!games.length) {
    const loading=state.steamDiscovery.status==='loading';
    grid.querySelector('.store-featured-shelf').innerHTML=loading
      ? '<div class="store-skeleton" aria-label="Loading games" role="status"><span></span><span></span><span></span><span></span><span></span></div><p class="store-loading-label">Getting the Store ready…</p>'
      : '<div class="store-empty">'+consoleIcon('store')+'<h2>The Store is taking a break</h2><p>Your installed games are still ready to play. Check your connection and try again.</p><div><button class="primary focusable" data-action="console-store-retry">Try again</button><button class="secondary focusable" data-action="library">My games & apps</button></div></div>';
  }
  let rail=document.querySelector('#store-rail');
  if(!rail) {
    rail=document.createElement('nav');rail.id='store-rail';rail.setAttribute('aria-label','Store navigation');
    const links=[['home','Home','home'],['console-store-tab','Store','store'],['library','My games & apps','controller'],['console-shop-login','Steam account','person'],['console-shop-cart','Steam cart','cart'],['settings','Settings','settings']];
    rail.innerHTML=links.map(([action,label,icon])=>'<button class="focusable'+(icon==='store'?' active':'')+'" data-action="'+action+'" data-tab="topSellers" aria-label="'+label+'">'+(icon==='cart'?'<span class="console-glyph" aria-hidden="true">&#xE7BF;</span>':consoleIcon(icon))+'</button>').join('');
    view.prepend(rail);
  }
  const browse=document.querySelector('#browse-steam-shop');if(browse)browse.hidden=true;
  if(selected)selectNativeStoreGame(selected);
  games.forEach(requestStoreOffer);
  refreshFocusables();
  if(restore) {
    const replacement=[...grid.querySelectorAll('.store-product')].find(card=>card.dataset.gameId===restore.id&&card.closest('[data-store-shelf]')?.dataset.storeShelf===restore.shelf);
    if(replacement)setFocusedElement(replacement,{scroll:false});
  }
}
function selectNativeStoreGame(game) {
  state.storeSelectedId=game.id;
  const target=document.querySelector('#store-selection-details');if(!target)return;
  const offer=storeOfferCache.get(String(game.appId));
  const players=consoleStoreTab==='mostPlayed'&&Number.isFinite(game.currentPlayers)?Intl.NumberFormat('en').format(game.currentPlayers)+' playing now':'';
  target.innerHTML='<h2>'+escapeHtml(game.title)+'</h2><p>'+escapeHtml([offer?.genres?.join(' · ')||'PC game · Steam',players].filter(Boolean).join(' · '))+'</p><div class="store-feature-price">'+(offer?.discount?'<span class="store-discount">−'+offer.discount+'%</span>':'')+'<strong>'+escapeHtml(storePrice(offer))+'</strong>'+(offer?.discount&&offer.originalPrice?'<s>'+escapeHtml(offer.originalPrice)+'</s>':'')+(offer?.currency&&offer.price&&offer.price!=='Free'?'<span class="store-price-region">'+escapeHtml(offer.currency)+'</span>':'')+'</div>';
  requestStoreOffer(game);
}
function requestStoreOffer(game) {
  const id=String(game.appId);
  if(Date.now()-(storeOfferTimes.get(id)||0)>900000)storeOfferCache.delete(id);
  if(!storeOfferCache.has(id)&&!storeOfferRequests.has(id)&&Date.now()-(storeOfferFailures.get(id)||0)>30000) {
    storeOfferRequests.add(id);
    const epoch = storeOfferEpoch;
    window.launcher.getStoreOffers(game.appId).then(offer=>{
      if (epoch !== storeOfferEpoch) return;
      storeOfferCache.set(id,offer);
      storeOfferTimes.set(id,Date.now());
      storeOfferFailures.delete(id);
      if(storeOfferCache.size>128) {const oldest=storeOfferCache.keys().next().value;storeOfferCache.delete(oldest);storeOfferTimes.delete(oldest);}
      document.querySelectorAll('[data-price-app]').forEach(node=>{if(node.dataset.priceApp===id)node.textContent=storePrice(offer);});
      if(state.view==='store'&&state.storeSelectedId===game.id)selectNativeStoreGame(game);
    }).catch(()=>{if(epoch!==storeOfferEpoch)return;storeOfferFailures.set(id,Date.now());if(storeOfferFailures.size>128)storeOfferFailures.delete(storeOfferFailures.keys().next().value);}).finally(()=>{if(epoch===storeOfferEpoch)storeOfferRequests.delete(id);});
  }
}
function navigateNativeStore(direction,current) {
  if(state.view!=='store'||state.consoleStoreMode==='gamepass'||topmostOpenDialog())return false;
  const rail=document.querySelector('#store-rail'), row=current.closest('.native-store-products,.native-store-secondary');
  if(rail?.contains(current)) {
    const buttons=[...rail.querySelectorAll('.focusable')],index=buttons.indexOf(current);
    if(direction==='right') {setFocusedElement(document.querySelector('.store-product-selected')||document.querySelector('.console-store-tabs .active'));return true;}
    if(direction==='left')return true;
    const next=buttons[index+(direction==='up'?-1:1)];if(next)setFocusedElement(next,{scroll:false});return true;
  }
  if(!row)return false;
  const cards=[...row.children],index=cards.indexOf(current);
  if(direction==='left'||direction==='right') {
    const next=cards[index+(direction==='left'?-1:1)];
    if(next)setFocusedElement(next);else if(direction==='left')setFocusedElement(rail.querySelector('.active'),{scroll:false});return true;
  }
  const rows=[...document.querySelectorAll('.native-store-products,.native-store-secondary')],rowIndex=rows.indexOf(row);
  const next=rows[rowIndex+(direction==='up'?-1:1)];
  if(next)setFocusedElement(next.children[Math.min(index,next.children.length-1)]);
  else if(direction==='up')setFocusedElement(document.querySelector('.console-store-tabs .active'));
  return true;
}
document.addEventListener('focusin',event=>{
  const card=event.target.closest('.store-product');if(!card)return;
  const game=nativeStoreGame(card.dataset.gameId);if(!game)return;
  requestStoreOffer(game);
  // Preload only the focused shelf, not the whole catalog.
  [...card.parentElement.children].forEach(node=>{const item=nativeStoreGame(node.dataset.gameId);if(item)requestStoreOffer(item);});
  if(!card.closest('.native-store-products'))return;
  const cards=[...card.parentElement.children],before=cards.map(node=>node.getBoundingClientRect());
  for(const animation of storeTileAnimations.values())animation.cancel();storeTileAnimations.clear();
  cards.forEach(node=>node.classList.toggle('store-product-selected',node===card));
  if(!document.documentElement.classList.contains('reduce-motion')) {
    const after=cards.map(node=>node.getBoundingClientRect());
    cards.forEach((node,index)=>{
      const a=before[index],b=after[index];if(!a.width||!b.width||(Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5&&Math.abs(a.width-b.width)<.5&&Math.abs(a.height-b.height)<.5))return;
      const transform='translate('+(a.x-b.x)+'px,'+(a.y-b.y)+'px) scale('+(a.width/b.width)+','+(a.height/b.height)+')';
      const animation=node.animate([{transform},{transform:'none'}],{duration:180,easing:'cubic-bezier(.16,1,.3,1)'});
      storeTileAnimations.set(node,animation);animation.onfinish=()=>{if(storeTileAnimations.get(node)===animation)storeTileAnimations.delete(node);};
      animation.oncancel=animation.onfinish;
    });
  }
  selectNativeStoreGame(game);
});
