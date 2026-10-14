const fs = require('fs/promises');
const path = require('path');
const PRODUCT_ID = /^[A-Z0-9]{12}$/i;
const imageUrl = (image, width) => {
  if (!image?.Uri) return null;
  const url = new URL(image.Uri.startsWith('//') ? `https:${image.Uri}` : image.Uri);
  if (url.protocol !== 'https:' || url.hostname !== 'store-images.s-microsoft.com') return null;
  url.searchParams.set('w', String(width));
  return url.href;
};
function mapProduct(product) {
  const localized = product.LocalizedProperties?.[0] || {};
  const images = localized.Images || [];
  const find = (purpose) => images.find(image => image.ImagePurpose === purpose);
  const square = find('FeaturePromotionalSquareArt') || images.find(image => image.Width === image.Height && image.ImagePurpose === 'BoxArt');
  const hero = find('SuperHeroArt') || find('TitledHeroArt');
  const artwork = {tile:imageUrl(square,600),grid:imageUrl(square,600),hero:imageUrl(hero,1920),wide:imageUrl(hero,1200),tileIsSquare:Boolean(square),imageSource:'xbox-catalog'};
  const attributes = product.Properties?.Attributes || [];
  const capabilities = {SinglePlayer:'Single player',XblOnlineCoop:'Online co-op',XblLocalCoop:'Local co-op',XblOnlineMultiPlayer:'Online multiplayer',XblLocalMultiPlayer:'Local multiplayer',XblCrossPlatformMultiPlayer:'Cross-platform multiplayer',XblAchievements:'Xbox achievements',XblCloudSaves:'Cloud saves',XPA:'Xbox Play Anywhere'};
  const categories = attributes.filter(item=>capabilities[item.Name]).map(item=>capabilities[item.Name] + (item.Minimum && item.Maximum ? ` (${item.Minimum}–${item.Maximum})` : ''));
  const market = product.MarketProperties?.[0] || {};
  const clean = value => String(value || '').replace(/<[^>]*>/g,'').trim();
  const details = {
    title:localized.ProductTitle,description:clean(localized.ShortDescription || localized.ProductDescription),fullDescription:clean(localized.ProductDescription || localized.ShortDescription),
    developer:localized.DeveloperName || '',publisher:localized.PublisherName || '',genres:product.Properties?.Categories || [],categories,
    releaseDate:market.OriginalReleaseDate ? new Date(market.OriginalReleaseDate).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}) : '',
    screenshots:images.filter(image=>image.ImagePurpose === 'Screenshot').map(image=>imageUrl(image,1920)).filter(Boolean).slice(0,12),metadataSource:'Xbox Store',dlcStatus:'unavailable'
  };
  // Input, as the Xbox app shows it: games that also run on Xbox consoles play with a controller; every PC
  // game here plays with mouse and keyboard.
  const onConsole = attributes.some(item => (item.ApplicablePlatforms || []).includes('Xbox') || ['ConsoleGen9Optimized','ConsoleKeyboardMouse','XPA','ConsoleCrossGen'].includes(item.Name));
  return {id:`gamepass-${product.ProductId}`,xboxProductId:product.ProductId,title:localized.ProductTitle,provider:'Xbox',installed:false,discoveryOnly:true,controls:onConsole ? 'partial' : 'kbm',artwork,details};
}
function createConsoleServices(directory, request = fetch) {
  let catalogPromise;
  let catalog = [];
  async function readCatalog() {
    try { const saved = JSON.parse(await fs.readFile(path.join(directory,'gamepass-catalog.json'),'utf8')); if(saved.version===2 && Array.isArray(saved.games)) return saved; } catch {}
    return null;
  }
  async function fetchCatalog() {
    const response = await request('https://catalog.gamepass.com/sigls/v2?id=fdd9e2a7-0fee-49f6-ad69-4354098401ff&language=en-us&market=US',{signal:AbortSignal.timeout(10000)});
    if(!response.ok) throw Error('Game Pass catalog is unavailable');
    const feed = await response.json();
    const ids = [...new Set(feed.map(item=>item.id).filter(id=>PRODUCT_ID.test(id)))].slice(0,1000);
    if(!ids.length) throw Error('Game Pass catalog is empty');
    const games = [];
    // Two small batches at a time, rather than hundreds of per-title requests.
    for(let offset=0;offset<ids.length;offset+=100) {
      const batches=[ids.slice(offset,offset+50),ids.slice(offset+50,offset+100)].filter(batch=>batch.length);
      await Promise.all(batches.map(async batch=>{
        const result=await request(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${batch.join(',')}&market=US&languages=en-US`,{signal:AbortSignal.timeout(15000)});
        if(!result.ok) throw Error('Game Pass metadata is unavailable');
        const body=await result.json();
        games.push(...(body.Products || []).filter(product=>PRODUCT_ID.test(product.ProductId) && product.ProductKind==='Game').map(mapProduct).filter(game=>game.title));
      }));
    }
    if(!games.length) throw Error('Game Pass metadata is empty');
    const ranks = new Map(ids.map((id,index)=>[id,index]));
    games.sort((a,b)=>ranks.get(a.xboxProductId)-ranks.get(b.xboxProductId));
    await fs.mkdir(directory,{recursive:true});
    const target=path.join(directory,'gamepass-catalog.json');
    await fs.writeFile(target+'.tmp',JSON.stringify({version:2,savedAt:Date.now(),games}));
    await fs.rename(target+'.tmp',target);
    catalog=games;
    return games;
  }
  async function getGamePassCatalog() {
    if(catalog.length) return catalog;
    const cached=await readCatalog();
    if(cached?.games.length) {
      catalog=cached.games;
      if(Date.now()-cached.savedAt>86400000 && !catalogPromise) catalogPromise=fetchCatalog().catch(()=>catalog).finally(()=>catalogPromise=null);
      return catalog;
    }
    if(!catalogPromise) catalogPromise=fetchCatalog().finally(()=>catalogPromise=null);
    return catalogPromise;
  }
  async function browseFiles(directoryPath, kind='game') {
    if(!['game','image','folder'].includes(kind)) throw Error('Unsupported file type');
    if(!directoryPath) {
      const roots = process.platform==='win32' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter=>`${letter}:\\`) : ['/'];
      const entries=[];
      for(const root of roots) { try {if((await fs.stat(root)).isDirectory())entries.push({path:root,name:root,directory:true});}catch{} }
      return {path:'',parent:'',entries};
    }
    if(!path.isAbsolute(directoryPath) || String(directoryPath).includes('\0')) throw Error('Choose an absolute location');
    const root=path.resolve(directoryPath);
    if(!(await fs.stat(root)).isDirectory()) throw Error('Choose a folder');
    const items=await fs.readdir(root,{withFileTypes:true});
    const match=kind==='image' ? /\.(png|jpe?g|webp)$/i : /\.(exe|bat|cmd)$/i;
    const entries=items.filter(item=>!item.name.startsWith('.') && !item.isSymbolicLink() && (item.isDirectory() || (kind!=='folder' && item.isFile() && match.test(item.name))))
      .sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory()) || a.name.localeCompare(b.name,undefined,{numeric:true})).slice(0,1000)
      .map(item=>({path:path.join(root,item.name),name:item.name,directory:item.isDirectory()}));
    return {path:root,parent:path.dirname(root)===root ? '' : path.dirname(root),entries};
  }
  async function readGamerpic(filename) {
    if(!path.isAbsolute(filename) || !/\.(png|jpe?g|webp)$/i.test(filename)) throw Error('Choose an image');
    const stat=await fs.stat(filename);
    if(!stat.isFile() || stat.size>20*1024*1024) throw Error('Choose an image under 20 MB');
    const extension=path.extname(filename).toLowerCase();
    return `data:image/${extension==='.png'?'png':extension==='.webp'?'webp':'jpeg'};base64,${(await fs.readFile(filename)).toString('base64')}`;
  }
  // Xbox.com's own browse and search service: lists, prices, ratings and trailers.
  const storeCache = new Map();
  const xboxLocale = () => { const locale = Intl.DateTimeFormat().resolvedOptions().locale; return /^[a-z]{2}-[A-Z]{2}$/.test(locale) ? locale : 'en-US'; };
  async function emerald(pathName, body) {
    const response = await request(`https://emerald.xboxservices.com/xboxcomfd/${pathName}?locale=${xboxLocale()}`, {
      method: 'POST', signal: AbortSignal.timeout(12000),
      headers: { 'Content-Type': 'application/json', 'x-ms-api-version': '1.1', 'MS-CV': `${Math.random().toString(36).slice(2, 12)}.1` },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw Error(`Xbox Store returned ${response.status}`);
    return response.json();
  }
  const storeImage = (image, width) => {
    if (!image?.url) return null;
    try { const url = new URL(image.url.replace(/^\/\//, 'https://')); if (url.protocol !== 'https:' || !/^store-images\.s?-?microsoft\.com$/.test(url.hostname)) return null; url.searchParams.set('w', String(width)); return url.href; } catch { return null; }
  };
  function mapSummary(summary) {
    if (!PRODUCT_ID.test(summary?.productId || '') || !summary.title) return null;
    const images = summary.images || {};
    const price = summary.specificPrices?.purchaseable?.[0] || null;
    const rating = summary.contentRating || null;
    const badge = rating?.imageUri && /^https:\/\/store-images\.(s-)?microsoft\.com\//.test(rating.imageUri) ? rating.imageUri : null;
    const box = storeImage(images.boxArt, 600) || storeImage(images.poster, 600);
    return {
      id: `xbox-${summary.productId}`, xboxProductId: summary.productId, title: summary.title, provider: 'Xbox', installed: false, discoveryOnly: true, controls: 'unknown',
      artwork: { tile: box, grid: box, tileIsSquare: Boolean(images.boxArt), hero: storeImage(images.superHeroArt, 1920), wide: storeImage(images.superHeroArt, 1200), imageSource: 'xbox-catalog' },
      price: price ? { list: Number(price.listPrice) || 0, msrp: Number(price.msrp) || 0, discount: Number(price.discountPercentage) || 0, currency: price.currency || 'USD' } : null,
      rating: rating ? { system: String(rating.boardName || ''), label: String(rating.rating || ''), value: String(rating.ratingAge || ''), description: String(rating.ratingDescription || rating.description || ''), descriptors: (rating.descriptors || []).join(', '), interactive: (rating.interactiveDescriptions || []).join(', '), image: badge } : null,
      videos: [...(summary.cmsVideos || []), ...(summary.videos || [])].filter(video => video.purpose === 'trailer' || video.previewImage).slice(0, 8).map(video => ({ title: String(video.title || video.previewImage?.caption || 'Trailer'), preview: storeImage(video.previewImage, 960), stream: /^https:\/\/cdn\.trailers\.xboxservices\.com\/[^\s"]+\.m3u8(\?|$)/.test(String(video.url || '')) ? video.url : null })).filter(video => video.preview),
      publisher: summary.publisherName || '', categories: summary.categories || [], releaseDate: summary.releaseDate || '', description: summary.description || '', averageRating: Number(summary.averageRating) || null
    };
  }
  const browseFilters = {
    popular: { orderby: { id: 'orderby', choices: [{ id: 'Popularity' }] }, PlayWith: { id: 'PlayWith', choices: [{ id: 'PC' }] } },
    newReleases: { orderby: { id: 'orderby', choices: [{ id: 'ReleaseDate' }] }, PlayWith: { id: 'PlayWith', choices: [{ id: 'PC' }] } },
    free: { orderby: { id: 'orderby', choices: [{ id: 'Popularity' }] }, PlayWith: { id: 'PlayWith', choices: [{ id: 'PC' }] }, Price: { id: 'Price', choices: [{ id: '0' }] } }
  };
  async function getXboxStore() {
    const cached = storeCache.get('lists');
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.data;
    const entries = await Promise.all(Object.entries(browseFilters).map(async ([key, filter]) => {
      const encoded = Buffer.from(JSON.stringify(filter)).toString('base64');
      const body = await emerald('browse', { Filters: encoded, EncodedFilters: encoded, ReturnFilters: false, ChannelKeyToBeUsedInResponse: key, ChannelId: '' }).catch(() => null);
      return [key, (body?.productSummaries || []).map(mapSummary).filter(Boolean).slice(0, 36)];
    }));
    const data = { status: entries.some(([, items]) => items.length) ? 'ready' : 'unavailable', ...Object.fromEntries(entries) };
    if (data.status === 'ready') storeCache.set('lists', { at: Date.now(), data });
    return data;
  }
  const normal = value => String(value || '').toLowerCase().replace(/\b(standard|edition|pc|windows|game of the year|goty|definitive)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  async function findXboxProduct(title) {
    const key = `search:${normal(title)}`;
    const cached = storeCache.get(key);
    if (cached && Date.now() - cached.at < 6 * 60 * 60 * 1000) return cached.data;
    const body = await emerald('search/games', { Query: String(title).slice(0, 120), Filters: 'e30=', ReturnFilters: false, ChannelKeyToBeUsedInResponse: 'S', ChannelId: '' }).catch(() => null);
    const wanted = normal(title);
    const match = (body?.productSummaries || []).map(mapSummary).filter(Boolean).find(item => normal(item.title) === wanted) || null;
    storeCache.set(key, { at: Date.now(), data: match });
    return match;
  }
  // Store search, as in the Xbox app: every PC game matching the words, with prices.
  async function searchXboxStore(query) {
    const text = String(query || '').trim().slice(0, 120);
    if (!text) return [];
    const key = `find:${text.toLowerCase()}`;
    const cached = storeCache.get(key);
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) return cached.data;
    // Games you can play on PC only, as the PC app's Store does.
    const filters = Buffer.from(JSON.stringify({ PlayWith: { id: 'PlayWith', choices: [{ id: 'PC' }] } })).toString('base64');
    const body = await emerald('search/games', { Query: text, Filters: filters, ReturnFilters: false, ChannelKeyToBeUsedInResponse: 'S', ChannelId: '' });
    const data = (body?.productSummaries || []).map(mapSummary).filter(Boolean).slice(0, 30);
    storeCache.set(key, { at: Date.now(), data });
    return data;
  }
  return {getGamePassCatalog,getXboxStore,findXboxProduct,searchXboxStore,browseFiles,readGamerpic,getCatalogDetails:async id=>{if(!PRODUCT_ID.test(id))throw Error('Invalid game');const game=(await getGamePassCatalog().catch(()=>[])).find(item=>item.xboxProductId===id);if(game)return game.details;const result=await request(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${id}&market=US&languages=en-US`,{signal:AbortSignal.timeout(12000)});if(!result.ok)throw Error('Xbox Store details are unavailable');const product=(await result.json()).Products?.[0];if(!product)throw Error('Game is not in the Xbox Store');return mapProduct(product).details;}};
}
module.exports = {createConsoleServices,mapProduct};
