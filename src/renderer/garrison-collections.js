// Home collections by publisher and by series, like the Xbox app's "Browse by publisher" row.
// Publishers come from Steam's store data (captured during scans) or, for other launchers, from the
// series a title belongs to. Each opens the library filtered to it.
const gSeries = [
  ['Call of Duty', /^call of duty/i, 'Activision'], ['Halo', /^halo\b/i, 'Xbox Game Studios'], ['Forza', /^forza\b/i, 'Xbox Game Studios'],
  ['Gears of War', /^gears( of war| 5| tactics)/i, 'Xbox Game Studios'], ['Age of Empires', /^age of (empires|mythology)/i, 'Xbox Game Studios'],
  ['Microsoft Flight Simulator', /^microsoft flight simulator/i, 'Xbox Game Studios'], ['Fable', /^fable\b/i, 'Xbox Game Studios'], ['Ori', /^ori and the/i, 'Xbox Game Studios'],
  ['Assassin’s Creed', /^assassin.?s creed/i, 'Ubisoft'], ['Far Cry', /^far cry/i, 'Ubisoft'], ['Tom Clancy’s', /^tom clancy/i, 'Ubisoft'], ['Watch Dogs', /^watch_?\s?dogs/i, 'Ubisoft'], ['Prince of Persia', /^prince of persia/i, 'Ubisoft'],
  ['Battlefield', /^battlefield/i, 'EA'], ['EA SPORTS FC', /^(ea sports fc|fifa)\b/i, 'EA'], ['Need for Speed', /^need for speed/i, 'EA'], ['Mass Effect', /^mass effect/i, 'EA'], ['Dead Space', /^dead space/i, 'EA'], ['The Sims', /^the sims/i, 'EA'], ['Star Wars', /^star wars/i, ''], ['Apex Legends', /^apex legends/i, 'EA'],
  ['Grand Theft Auto', /^grand theft auto/i, 'Rockstar Games'], ['Red Dead', /^red dead/i, 'Rockstar Games'],
  ['Resident Evil', /^resident evil/i, 'Capcom'], ['Monster Hunter', /^monster hunter/i, 'Capcom'], ['Street Fighter', /^street fighter/i, 'Capcom'], ['Devil May Cry', /^devil may cry/i, 'Capcom'], ['Mega Man', /^mega ?man/i, 'Capcom'],
  ['Final Fantasy', /^final fantasy/i, 'Square Enix'], ['Kingdom Hearts', /^kingdom hearts/i, 'Square Enix'], ['Dragon Quest', /^dragon quest/i, 'Square Enix'], ['Tomb Raider', /tomb raider/i, ''],
  ['The Elder Scrolls', /^the elder scrolls/i, 'Bethesda'], ['Fallout', /^fallout/i, 'Bethesda'], ['DOOM', /^doom\b/i, 'Bethesda'], ['Wolfenstein', /wolfenstein/i, 'Bethesda'], ['Indiana Jones', /^indiana jones/i, 'Bethesda'],
  ['Diablo', /^diablo/i, 'Blizzard'], ['Overwatch', /^overwatch/i, 'Blizzard'], ['StarCraft', /^starcraft/i, 'Blizzard'], ['World of Warcraft', /^world of warcraft/i, 'Blizzard'],
  ['Counter-Strike', /^counter-strike/i, 'Valve'], ['Half-Life', /^half-life/i, 'Valve'], ['Portal', /^portal\b/i, 'Valve'], ['Left 4 Dead', /^left 4 dead/i, 'Valve'],
  ['The Witcher', /^the witcher/i, 'CD PROJEKT RED'], ['Cyberpunk', /^cyberpunk/i, 'CD PROJEKT RED'],
  ['Borderlands', /^(tiny tina|borderlands)/i, '2K'], ['BioShock', /^bioshock/i, '2K'], ['NBA 2K', /^nba 2k/i, '2K'], ['XCOM', /^xcom/i, '2K'], ['Civilization', /civilization/i, '2K'], ['Mafia', /^mafia\b/i, '2K'],
  ['Batman: Arkham', /^batman/i, 'Warner Bros. Games'], ['Mortal Kombat', /^mortal kombat/i, 'Warner Bros. Games'], ['Hogwarts Legacy', /^hogwarts legacy/i, 'Warner Bros. Games'], ['LEGO', /^lego\b/i, ''],
  ['Like a Dragon', /^(yakuza|like a dragon)/i, 'SEGA'], ['Sonic', /^sonic\b/i, 'SEGA'], ['Total War', /^total war/i, 'SEGA'], ['Persona', /^persona\b/i, 'SEGA'], ['Football Manager', /^football manager/i, 'SEGA'],
  ['Dark Souls', /^dark souls/i, 'Bandai Namco'], ['Tekken', /^tekken/i, 'Bandai Namco'], ['Dragon Ball', /^dragon ball/i, 'Bandai Namco'], ['Elden Ring', /^elden ring/i, 'Bandai Namco'], ['Ace Combat', /^ace combat/i, 'Bandai Namco'],
  ['Metal Gear', /^metal gear/i, 'Konami'], ['Silent Hill', /^silent hill/i, 'Konami'],
  ['God of War', /^god of war/i, 'PlayStation Studios'], ['Marvel’s Spider-Man', /spider-man/i, 'PlayStation Studios'], ['Horizon', /^horizon (zero|forbidden)/i, 'PlayStation Studios'], ['The Last of Us', /^the last of us/i, 'PlayStation Studios'], ['Uncharted', /^uncharted/i, 'PlayStation Studios'],
  ['Hitman', /^hitman/i, 'IO Interactive'], ['Sniper Elite', /^sniper elite/i, 'Rebellion'], ['Metro', /^metro (2033|last light|exodus|awakening)/i, 'Deep Silver'], ['Saints Row', /^saints row/i, 'Deep Silver'], ['Dying Light', /^dying light/i, 'Techland'],
  ['Warhammer', /warhammer/i, ''], ['Crash Bandicoot', /^crash bandicoot/i, 'Activision'], ['Tony Hawk’s', /^tony hawk/i, 'Activision'], ['Spyro', /^spyro/i, 'Activision'],
  ['Cities: Skylines', /^cities: skylines/i, 'Paradox Interactive'], ['Crusader Kings', /^crusader kings/i, 'Paradox Interactive'], ['Stellaris', /^stellaris/i, 'Paradox Interactive'],
  ['Euro & American Truck', /truck simulator/i, 'SCS Software'], ['Minecraft', /^minecraft/i, 'Xbox Game Studios']
];
const gPublisherAliases = [
  [/^(xbox game studios|microsoft( studios| game studios)?|xbox)$/i, 'Xbox Game Studios'], [/^bethesda/i, 'Bethesda'], [/^ubisoft/i, 'Ubisoft'], [/^electronic arts|^ea\b/i, 'EA'],
  [/^activision/i, 'Activision'], [/^blizzard/i, 'Blizzard'], [/^capcom/i, 'Capcom'], [/^bandai namco/i, 'Bandai Namco'], [/^square enix/i, 'Square Enix'], [/^2k\b/i, '2K'],
  [/^rockstar/i, 'Rockstar Games'], [/^(warner bros|wb games)/i, 'Warner Bros. Games'], [/^(sony interactive|playstation)/i, 'PlayStation Studios'], [/^sega\b/i, 'SEGA'],
  [/^cd projekt/i, 'CD PROJEKT RED'], [/^konami/i, 'Konami'], [/^valve/i, 'Valve'], [/^devolver/i, 'Devolver Digital'], [/^paradox/i, 'Paradox Interactive'],
  [/^focus (home|entertainment)/i, 'Focus Entertainment'], [/^thq nordic/i, 'THQ Nordic'], [/^deep silver/i, 'Deep Silver'], [/^annapurna/i, 'Annapurna Interactive'], [/^team17/i, 'Team17'],
  [/^krafton/i, 'KRAFTON'], [/^epic games/i, 'Epic Games'], [/^riot games/i, 'Riot Games'], [/^io interactive/i, 'IO Interactive'], [/^rebellion/i, 'Rebellion'], [/^techland/i, 'Techland']
];
function gSeriesOf(game) {
  const title = String(game?.title || '');
  return gSeries.find(([, pattern]) => pattern.test(title)) || null;
}
function gPublisherOf(game) {
  const raw = String(game?.publisher || '').trim() || gSeriesOf(game)?.[2] || '';
  if (!raw) return '';
  return gPublisherAliases.find(([pattern]) => pattern.test(raw))?.[1] || raw.replace(/,? (inc|llc|ltd|co|corp)\.?$/i, '').trim();
}

const gMatchesCollection = matchesCollection;
matchesCollection = function (game, collection) {
  if (String(collection).startsWith('series:')) return gSeriesOf(game)?.[0] === collection.slice(7);
  if (String(collection).startsWith('publisher:')) return gPublisherOf(game) === collection.slice(10);
  return gMatchesCollection(game, collection);
};
// The library's collection menu needs an entry for these, or it falls back to "all".
const gOpenCollection = openCollection;
openCollection = function (source) {
  const collection = source.dataset.collection || '';
  const select = document.querySelector('#library-collection');
  if (/^(series|publisher):/.test(collection) && select && ![...select.options].some(option => option.value === collection)) {
    select.add(new Option(collection.replace(/^\w+:/, ''), collection));
  }
  return gOpenCollection(source);
};
// A filtered library shows which collection it is, as the first chip; choosing All clears it.
const gCollectionChips = renderGarrisonSourceChips;
renderGarrisonSourceChips = function () {
  gCollectionChips();
  const target = document.querySelector('#g-source-chips');
  const collection = String(state.collectionFilter || '');
  if (target.hidden || !/^(series|publisher):/.test(collection)) return;
  target.querySelectorAll('.g-chip.active').forEach(chip => { chip.classList.remove('active'); chip.setAttribute('aria-selected', 'false'); });
  target.insertAdjacentHTML('afterbegin', `<button class="g-chip focusable active" type="button" role="tab" aria-selected="true" data-action="g-source" data-source="all">${escapeHtml(collection.replace(/^\w+:/, ''))}</button>`);
};

// Tall publisher cards: a game's key art with the publisher's name set like a wordmark.
// Key art for a group: the hero image of its most-played game that has one.
function gGroupArtList(games) {
  const ranked = [...games].sort((x, y) => (Number(y.steamPlaytimeMinutes) || 0) - (Number(x.steamPlaytimeMinutes) || 0) || (Number(y.installed !== false) - Number(x.installed !== false)));
  return [...new Set([...ranked.flatMap(game => [game.artwork?.hero, game.artwork?.wide]), ...ranked.map(game => game.artwork?.tile)].filter(Boolean))].slice(0, 8);
}
function gGroupArt(games) { return gGroupArtList(games)[0] || ''; }
// Art that fails to load moves on to the next game's image; a logo that fails shows the name instead.
document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  if (image.matches('.g-publisher-art, .g-series-art')) {
    const rest = (image.dataset.next || '').split(' ').filter(Boolean);
    if (rest.length) { image.dataset.next = rest.slice(1).join(' '); image.src = rest[0]; }
    else image.replaceWith(Object.assign(document.createElement('span'), { className: 'g-publisher-fallback' }));
  } else if (image.matches('.g-publisher-logo, .g-series-logo')) {
    const card = image.closest('.g-publisher-card, .g-series-card');
    image.remove();
    card?.classList.remove('has-logo');
    if (card?.matches('.g-series-card') && !card.querySelector('.g-series-name')) card.insertAdjacentHTML('beforeend', `<span class="g-series-name">${escapeHtml(card.dataset.collection.replace(/^series:/, ''))}</span>`);
  }
}, true);
// Publisher logos are looked up once each (main caches them), then cards are filled in.
const gPublisherLogos = new Map();
function gPublisherLogo(name) {
  if (gPublisherLogos.has(name)) return gPublisherLogos.get(name);
  gPublisherLogos.set(name, '');
  window.launcher.getPublisherLogo(name).then(url => {
    if (!url) return;
    gPublisherLogos.set(name, url);
    const card = document.querySelector(`.g-publisher-card[data-collection="publisher:${CSS.escape(name)}"]`);
    if (card && !card.querySelector('.g-publisher-logo')) {
      card.querySelector('.g-publisher-name')?.insertAdjacentHTML('beforebegin', `<img class="g-publisher-logo" src="${escapeHtml(url)}" alt="" decoding="async" />`);
      card.classList.add('has-logo');
    }
  }).catch(() => {});
  return '';
}
function gPublisherCard(name, games) {
  const arts = gGroupArtList(games), art = arts[0] || '';
  const logo = gPublisherLogo(name);
  return `<button class="g-publisher-card focusable${logo ? ' has-logo' : ''}" type="button" data-action="collection-open" data-collection="publisher:${escapeHtml(name)}" aria-label="${escapeHtml(name)}, ${games.length} games">
    ${art ? `<img class="g-publisher-art" src="${escapeHtml(art)}" data-next="${escapeHtml(arts.slice(1).join(' '))}" alt="" loading="lazy" decoding="async" />` : `<span class="g-publisher-fallback" style="--hue:${hashHue(name)}"></span>`}
    ${logo ? `<img class="g-publisher-logo" src="${escapeHtml(logo)}" alt="" decoding="async" />` : ''}<span class="g-publisher-name">${escapeHtml(name)}</span><small>${games.length} games</small></button>`;
}
// Series cards: wide key art with the series' own logo where one of its games has it.
function gSeriesCard(name, games) {
  const arts = gGroupArtList(games), art = arts[0] || '';
  const logo = games.map(game => game.artwork?.logo).find(Boolean) || '';
  return `<button class="g-series-card focusable${logo ? ' has-logo' : ''}" type="button" data-action="collection-open" data-collection="series:${escapeHtml(name)}" aria-label="${escapeHtml(name)}, ${games.length} games">
    ${art ? `<img class="g-series-art" src="${escapeHtml(art)}" data-next="${escapeHtml(arts.slice(1).join(' '))}" alt="" loading="lazy" decoding="async" />` : `<span class="g-publisher-fallback" style="--hue:${hashHue(name)}"></span>`}
    ${logo ? `<img class="g-series-logo" src="${escapeHtml(logo)}" alt="" decoding="async" />` : `<span class="g-series-name">${escapeHtml(name)}</span>`}<small>${games.length} games</small></button>`;
}
const gCollectionsHome = renderHomeCollections;
renderHomeCollections = function () {
  // Rows are rebuilt as artwork arrives; keep where each strip was scrolled and which card had focus.
  const strips = new Map([...gHomeRows.querySelectorAll(".g-collections-generated")].map(node => [node.id, node.querySelector(".g-publisher-cards")?.scrollLeft || 0]));
  const focusedCollection = document.activeElement?.closest?.(".g-collections-generated") ? document.activeElement.dataset.collection : "";
  gCollectionsHome();
  const games = displayedLibraryGames().filter(game => !game.isApp);
  const byPublisher = new Map(), bySeries = new Map();
  for (const game of games) {
    const publisher = gPublisherOf(game);
    if (publisher) byPublisher.set(publisher, [...(byPublisher.get(publisher) || []), game]);
    const series = gSeriesOf(game)?.[0];
    if (series) bySeries.set(series, [...(bySeries.get(series) || []), game]);
  }
  const publishers = [...byPublisher].filter(([, list]) => list.length >= 2).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 14);
  const series = [...bySeries].filter(([, list]) => list.length >= 2).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 12);
  const saved = captureCollectionPosition();
  gHomeRows.querySelectorAll(".g-collections-generated").forEach(node => node.remove());
  const seriesRows = series.length ? `<section class="g-publisher-row g-series-row collection-band" id="home-series" aria-labelledby="home-series-title"><div class="section-heading"><h2 id="home-series-title">Your series</h2></div><div class="g-publisher-cards">${series.map(([name, list]) => gSeriesCard(name, list)).join('')}</div></section>` : '';
  const publisherRow = publishers.length ? `<section class="g-publisher-row collection-band" id="home-publishers" aria-labelledby="home-publishers-title"><div class="section-heading"><h2 id="home-publishers-title">Browse by publisher</h2></div><div class="g-publisher-cards">${publishers.map(([name, list]) => gPublisherCard(name, list)).join('')}</div></section>` : '';
  const holder = document.createElement('div');
  holder.innerHTML = publisherRow + seriesRows;
  const nodes = [...holder.children];
  nodes.forEach(node => node.classList.add('g-collections-generated'));
  // Publishers sit after the player's own collections, before the Xbox Store rows.
  const store = gHomeRows.querySelector('#home-store-popular-title')?.closest('section') || null;
  for (const node of nodes) gHomeRows.insertBefore(node, store);
  gHomeRows.querySelectorAll('.g-collections-generated .collection-open').forEach(button => { if (button.dataset.action === 'collection-open') button.innerHTML = 'See all <span aria-hidden="true">›</span>'; });
  restoreCollectionPosition(saved);
  for (const [id, left] of strips) { const strip = document.getElementById(id)?.querySelector(".g-publisher-cards"); if (strip) strip.scrollLeft = left; }
  if (focusedCollection) { const card = gHomeRows.querySelector(`[data-collection="${CSS.escape(focusedCollection)}"]`); if (card) setFocusedElement(card, { scroll: false }); }
  refreshFocusables();
};
