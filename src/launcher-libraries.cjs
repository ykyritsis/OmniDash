// Read-only local inventory adapters. Protocol field layouts were checked against
// the Playnite Ubisoft/Battle.net implementations (see docs/library-integrations.md).
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const YAML = require('yaml');

function protobuf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 64 * 1024 * 1024) throw Error('Unsupported library cache');
  let offset = 0;
  const fields = [];
  function number() {
    let value = 0, shift = 0;
    while (offset < buffer.length && shift < 49) {
      const byte = buffer[offset++]; value += (byte & 127) * 2 ** shift;
      if (!(byte & 128)) return value;
      shift += 7;
    }
    throw Error('Invalid library cache');
  }
  while (offset < buffer.length) {
    if (fields.length > 100000) throw Error('Library cache is too large');
    const tag = number(), type = tag % 8, field = Math.floor(tag / 8);
    if (!field) throw Error('Invalid library cache');
    let value;
    if (type === 0) value = number();
    else if ([1, 2, 5].includes(type)) {
      const length = type === 1 ? 8 : type === 5 ? 4 : number();
      if (offset + length > buffer.length) throw Error('Incomplete library cache');
      value = buffer.subarray(offset, offset + length); offset += length;
    } else throw Error('Unsupported library cache');
    fields.push({ field, type, value });
  }
  return fields;
}
const first = (fields, field) => fields.find(item => item.field === field)?.value;
const titleText = value => typeof value === 'string' ? value.replace(/[™®]/g, '').replace(/[\x00-\x1f]/g, '').trim().slice(0, 240) : '';
function parseUbisoftConfigurations(buffer) {
  const products = [];
  for (const entry of protobuf(buffer).filter(item => item.field === 1 && item.type === 2).slice(0, 20000)) {
    const fields = protobuf(entry.value), id = first(fields, 1), installId = first(fields, 2), info = first(fields, 3);
    if (!Number.isInteger(id) || !Buffer.isBuffer(info) || info.length > 2 * 1024 * 1024) continue;
    try {
      const data = YAML.parse(info.toString('utf8'), { maxAliasCount: 20, prettyErrors: false, logLevel: 'silent' });
      if (data?.root && typeof data.root === 'object') products.push({ id: String(id), installId: String(installId || id), root: data.root, loc: data.localizations?.default || {} });
    } catch { /* Partial/stale records don't prevent the rest of the library importing. */ }
  }
  const dlc = new Set(products.flatMap(item => Array.isArray(item.root.addons) ? item.root.addons.map(addon => String(addon.id)) : []));
  return products.filter(item => !item.root.is_ulc && !item.root.third_party_platform && item.root.start_game && !dlc.has(item.id)).flatMap(item => {
    const title = titleText(Object.hasOwn(item.loc, item.root.name) ? item.loc[item.root.name] : item.root.name);
    return title ? [{ id: `ubisoft-${item.id}`, provider: 'Ubisoft Connect', providerId: item.id, installId: item.installId,
      title, installed: false, accountLibrary: 'ubisoft', launchUri: `uplay://launch/${item.id}`, installUri: `uplay://install/${item.id}` }] : [];
  });
}
// Stable client IDs, not a catalogue of games claimed to be owned. Ownership
// comes exclusively from the user's account response or a local installation.
const BNET_PRODUCTS = [
  [5730135,'WoW','wow','World of Warcraft'], [17459,'D3','diablo3','Diablo III'], [21298,'S2','s2','StarCraft II'],
  [21297,'S1','s1','StarCraft'], [1465140039,'WTCG','hs_beta','Hearthstone'], [1214607983,'Hero','heroes','Heroes of the Storm'],
  [5272175,'Pro','prometheus','Overwatch 2'], [1447645266,'VIPR','viper','Call of Duty: Black Ops 4'],
  [1329875278,'ODIN','odin','Call of Duty: Modern Warfare'], [22323,'W3','w3','Warcraft III: Reforged'],
  [1279351378,'LAZR','lazarus','Call of Duty: Modern Warfare 2 Campaign Remastered'], [1514493267,'ZEUS','zeus','Call of Duty: Black Ops Cold War'],
  [1464615513,'WLBY','wlby','Crash Bandicoot 4'], [5198665,'OSI','osi','Diablo II: Resurrected'],
  [1381257807,'RTRO','rtro','Blizzard Arcade Collection'], [1179603525,'FORE','fore','Call of Duty: Vanguard'],
  [1095647827,'ANBS','anbs','Diablo Immortal'], [1096108883,'AUKS','auks','Call of Duty'], [4613486,'Fen','fen','Diablo IV'],
  [1146246220,'D1','d1','Diablo'], [5714258,'W1R','w1r','Warcraft: Remastered'], [5714514,'W2R','w2r','Warcraft II: Remastered'],
  [1463898673,'W1','w1','Warcraft: Orcs & Humans'], [1462911566,'W2','w2','Warcraft II: Battle.net Edition'],
  [4674137,'GRY','gryphon','Warcraft Rumble'], [1095911763,'ARIS','aris','Doom: The Dark Ages'],
  [1396920146,'SCOR','scorpio','Sea of Thieves'], [4280907,'ARK','arkansas','The Outer Worlds 2'],
  [1279414849,'LBRA','libra',"Tony Hawk's Pro Skater 3 + 4"], [1095849281,'AQUA','aqua','Avowed']
];
function bnetGame(definition, title = '') {
  const [apiId, product, internal, name] = definition;
  return { id: `battlenet-${product.toLowerCase()}`, provider: 'Battle.net', providerId: product, internalId: internal,
    title: titleText(title) || name, installed: false, accountLibrary: 'battlenet', apiId };
}
function parseBattleNetOwned(body, classics = {}) {
  if (!Array.isArray(body?.gameAccounts)) throw Error('Battle.net library unavailable. Please sign in again.');
  const games = new Map();
  for (const entry of body.gameAccounts.slice(0,20000)) {
    if (!Number.isSafeInteger(Number(entry.titleId)) || !titleText(entry.localizedGameName)) continue;
    const definition = BNET_PRODUCTS.find(item => item[0] === Number(entry.titleId));
    const game = definition ? bnetGame(definition, entry.localizedGameName)
      : { id: `battlenet-title-${entry.titleId}`, provider: 'Battle.net', providerId: String(entry.titleId), title: titleText(entry.localizedGameName), installed: false, accountLibrary: 'battlenet', clientOnly: true };
    // Trial/inactive licences may still be returned by Blizzard. Don't claim paid ownership.
    game.ownershipLabel = 'In Battle.net account';
    games.set(game.id, game);
  }
  for (const family of [['diablo-ii','Diablo II','d2-classic'], ['warcraft-iii','Warcraft III','w3-classic']]) {
    if ((classics.classicGames || []).some(item => String(item.regionalGameFranchiseIconFilename).includes(family[0])))
      games.set(family[2], { id: `battlenet-${family[2]}`, provider: 'Battle.net', providerId: family[2], title: family[1], installed: false, accountLibrary: 'battlenet', clientOnly: true, classic: true });
  }
  return [...games.values()];
}
function parseBattleNetInstalled(buffer) {
  const games = [];
  for (const entry of protobuf(buffer).filter(item => item.field === 1 && item.type === 2)) {
    const fields = protobuf(entry.value), internal = first(fields, 1)?.toString('utf8');
    const definition = BNET_PRODUCTS.find(item => item[2].toLowerCase() === internal?.toLowerCase());
    const raw = first(fields, 3);
    if (!definition || !Buffer.isBuffer(raw)) continue;
    const installPath = first(protobuf(raw), 1)?.toString('utf8');
    if (installPath && !/[\x00-\x1f]/.test(installPath)) games.push({ ...bnetGame(definition), installed: true, installPath });
  }
  return games;
}
function registry(key, args = []) {
  if (process.platform !== 'win32') return Promise.resolve('');
  return new Promise(resolve => execFile('reg.exe', ['query', key, ...args], { windowsHide: true, timeout: 3500, maxBuffer: 8 * 1024 * 1024 }, (error, text) => resolve(error ? '' : text)));
}
function parseRegistry(text) {
  return text.split(/\r?\n(?=HKEY_)/).map(block => {
    const lines = block.trim().split(/\r?\n/), key = lines.shift();
    const values = Object.create(null);
    for (const line of lines) { const match = line.trim().match(/^(.+?)\s+REG_(?:SZ|EXPAND_SZ|DWORD)\s+(.*)$/); if (match) values[match[1].toLowerCase()] = match[2]; }
    return { key, values };
  }).filter(item => item.key?.startsWith('HKEY_'));
}
async function directoryExists(target) {
  if (!target || !path.isAbsolute(target) || /[\x00-\x1f]/.test(target)) return false;
  try { return (await fs.stat(target)).isDirectory(); } catch { return false; }
}
async function readBounded(file, limit = 64 * 1024 * 1024) {
  if ((await fs.stat(file)).size > limit) throw Error('Library cache is too large');
  return fs.readFile(file);
}
async function scanLocalPublishers(includeUbisoft = false) {
  const fallback = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Ubisoft', 'Ubisoft Game Launcher');
  const locationText = await registry('HKLM\\SOFTWARE\\Ubisoft\\Launcher', ['/v','InstallDir','/reg:32']);
  const location = parseRegistry(locationText)[0]?.values.installdir || fallback;
  let owned = [], ubisoftStatus = 'needs-client-library';
  if (includeUbisoft) for (const file of [path.join(process.env.LOCALAPPDATA || '', 'Ubisoft Game Launcher/cache/configuration/configurations'), path.join(location, 'cache/configuration/configurations')]) {
    try { owned = parseUbisoftConfigurations(await readBounded(file)); ubisoftStatus = owned.length ? 'ready' : 'empty'; if (owned.length) break; }
    catch { /* A signed-in Ubisoft client may not have written the cache yet. */ }
  }
  const games = [], installTexts = await Promise.all([32,64].map(view => registry('HKLM\\SOFTWARE\\Ubisoft\\Launcher\\Installs', ['/s',`/reg:${view}`])));
  for (const entry of parseRegistry(installTexts.join('\n'))) {
    const id = entry.key.split('\\').at(-1), installPath = entry.values.installdir;
    if (!/^\d+$/.test(id) || !await directoryExists(installPath)) continue;
    const found = owned.find(game => game.providerId === id || game.installId === id);
    games.push({ ...(found || { id:`ubisoft-${id}`, provider:'Ubisoft Connect', providerId:id, title:path.basename(installPath.replace(/[\\/]+$/, '')), launchUri:`uplay://launch/${id}`, installUri:`uplay://install/${id}`, accountLibrary:'ubisoft' }), installed:true, installPath });
  }
  const installed = new Set(games.map(game => game.id));
  games.push(...owned.filter(game => !installed.has(game.id)));
  try {
    const bnet = parseBattleNetInstalled(await readBounded(path.join(process.env.ProgramData || 'C:\\ProgramData', 'Battle.net/Agent/product.db')));
    for (const game of bnet) if (await directoryExists(game.installPath)) games.push(game);
  } catch { /* Shortcuts/registry provide additional installed-game detection. */ }
  const uninstall = (await Promise.all([32,64].map(view => registry('HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall', ['/s',`/reg:${view}`])))).flatMap(parseRegistry);
  for (const entry of uninstall) {
    const values = entry.values, title = titleText(values.displayname), installPath = values.installlocation;
    if (!title || /\b(beta|test|launcher|redistributable|anti.cheat)\b/i.test(title) || !await directoryExists(installPath)) continue;
    const internal = values.uninstallstring?.match(/Battle\.net.*--uid=([^\s"]+)/i)?.[1];
    const bnet = internal && BNET_PRODUCTS.find(item => internal.toLowerCase().startsWith(item[2].toLowerCase()));
    if (bnet && !games.some(game => game.id === bnetGame(bnet).id)) games.push({ ...bnetGame(bnet), installed:true, installPath });
  }
  return { games, ubisoftStatus, ubisoftCount:owned.length };
}
function parseEaOwned(body) {
  const page = body?.data?.me?.ownedGameProducts;
  if (!Array.isArray(page?.items)) throw Error('EA library unavailable. Please sign in again.');
  const games = page.items.flatMap(item => {
    const id = String(item.originOfferId || ''), title = titleText(item.product?.name);
    if (!/^[a-zA-Z0-9:.\-_]{1,200}$/.test(id) || !title) return [];
    const platforms = item.product?.gamePlatformDetails?.gamePlatform;
    if (platforms && !/PC|WIN/i.test(platforms)) return [];
    return [{ id:`ea-${id}`, provider:'EA app', providerId:id, title, installed:false, accountLibrary:'ea', clientOnly:true }];
  });
  return { games, next: page.next == null ? null : String(page.next).slice(0,200) };
}
function eaLibraryUrl(next = '0') {
  const url = new URL('https://service-aggregation-layer.juno.ea.com/graphql');
  url.search = new URLSearchParams({ operationName:'getPreloadedOwnedGames',
    variables:JSON.stringify({ isMac:false, addFieldsToPreloadGames:true, locale:'en', limit:500, next,
      type:['DIGITAL_FULL_GAME','PACKAGED_FULL_GAME'], entitlementEnabled:true, storefronts:['EA','STEAM','EPIC'],
      ownershipMethods:['UNKNOWN','ASSOCIATION','PURCHASE','REDEMPTION','GIFT_RECEIPT','ENTITLEMENT_GRANT','DIRECT_ENTITLEMENT','PRE_ORDER_PURCHASE','VAULT','XGP_VAULT','STEAM','STEAM_VAULT','STEAM_SUBSCRIPTION','EPIC','EPIC_VAULT','EPIC_SUBSCRIPTION'], platforms:['PC'] }),
    extensions:JSON.stringify({persistedQuery:{version:1,sha256Hash:'779f1cd1355699752e20c0b3877847f4e3010ef5de131c248e98f8eff84f0718'}}) }).toString();
  return url.href;
}
async function resolveEaInstall(raw) {
  // Only a registry value lookup and a file-existence check. Never execute the
  // catalog's install/uninstall commands or arbitrary returned executable args.
  const match = String(raw || '').match(/^\[(HKEY_LOCAL_MACHINE|HKEY_CURRENT_USER)\\(SOFTWARE\\[^\]\x00-\x1f]+)\\([^\\\]\x00-\x1f]+)\]([^\x00-\x1f]*)$/i);
  if (!match) return null;
  const relative = match[4].replace(/^[\\/]+/, '');
  if (!relative || relative.split(/[\\/]/).includes('..')) return null;
  for (const view of [32,64]) {
    const values = parseRegistry(await registry(`${match[1]}\\${match[2]}`, ['/v', match[3], `/reg:${view}`]))[0]?.values;
    const installPath = values?.[match[3].toLowerCase()];
    if (!await directoryExists(installPath)) continue;
    const target = path.resolve(installPath, relative);
    if (!target.startsWith(path.resolve(installPath) + path.sep)) continue;
    try { if ((await fs.stat(target)).isFile()) return { installed:true, installPath }; } catch { /* Not installed. */ }
  }
  return null;
}
function mergePublisherGames(local, owned) {
  const output = [...local];
  for (const game of owned) {
    const index = output.findIndex(item => item.provider === game.provider && (item.id === game.id || titleText(item.title).toLowerCase() === titleText(game.title).toLowerCase()) && !item.isApp);
    if (index < 0) output.push(game);
    else {
      const installed = output[index];
      // Keep existing shortcut identity/artwork/history while adding owned metadata.
      output[index] = { ...game, ...installed, accountLibrary:game.accountLibrary, providerId:game.providerId,
        launchUri:installed.launchUri || game.launchUri, installUri:game.installUri || installed.installUri, internalId:game.internalId || installed.internalId,
        clientOnly:installed.installed === false && game.clientOnly };
    }
  }
  return output;
}
module.exports = { protobuf, parseUbisoftConfigurations, parseBattleNetInstalled, parseBattleNetOwned, parseEaOwned, eaLibraryUrl, resolveEaInstall, scanLocalPublishers, parseRegistry, mergePublisherGames, BNET_PRODUCTS };
