// Create a fresh, credential-free packaged-app fixture. Artwork is referenced,
// never included in the shipping archive. Existing profiles are not overwritten.
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../.visual-review');
async function prepare() {
  const name = process.argv[2];
  if (!/^[a-z0-9-]+$/.test(name || '')) throw Error('Supply a new review profile name.');
  const directory = path.join(root, name);
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'catalog-live/gamepass-catalog.json'), 'utf8')).games;
  const entries = [
    ['demo-1', /^Forza Horizon 5/i, '1551360'],
    ['demo-2', /^Halo Infinite$/i, '1240440'],
    ['demo-3', /^Lies of P$/i, '1627720'],
    ['demo-4', /^Hi-Fi RUSH$/i, '1817230'],
    ['demo-5', /^Sea of Thieves/i, '1172620'],
    ['demo-6', /^Hellblade II:/i, '2461850']
  ];
  const artwork = {};
  for (const [id, match, appId] of entries) {
    const found = catalog.find(game => match.test(game.title));
    const steam = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/`;
    artwork[id] = {
      ...(found?.artwork || {tile:steam+'library_600x900.jpg',hero:steam+'library_hero.jpg',wide:steam+'header.jpg',tileIsSquare:false}),
      logo:steam+'logo.png', manual:true, artworkVersion:6, overlayLogo:false
    };
  }
  await fs.mkdir(directory); // Deliberately fails if the fixture already exists.
  await fs.writeFile(path.join(directory, 'settings.json'), JSON.stringify({
    onboardingComplete:true,fullscreen:false,soundEffects:false,steamBannerDismissed:true,
    displayName:'Player',avatarId:'one-orbit',steamGridDbKey:'',steamApiKey:'',xboxApiKey:'',
    artwork,shuffleHomeScreenshots:false
  },null,2), {flag:'wx'});
  console.log('Prepared key-free packaged review:', directory);
}
prepare().catch(error=>{console.error(error.message);process.exitCode=1;});
