const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { readGogOwned, readAmazonOwned } = require('../src/local-owned-libraries.cjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'owned-test-'));

const gogFile = path.join(dir, 'galaxy-2.0.db');
const gog = new DatabaseSync(gogFile);
gog.exec(`CREATE TABLE LibraryReleases (id INTEGER PRIMARY KEY, userId INTEGER, releaseKey TEXT);
  CREATE TABLE GamePieceTypes (id INTEGER PRIMARY KEY, type TEXT);
  CREATE TABLE GamePieces (releaseKey TEXT, gamePieceTypeId INTEGER, value TEXT);
  INSERT INTO GamePieceTypes VALUES (1,'title'),(2,'originalTitle'),(3,'originalImages'),(4,'meta');
  INSERT INTO LibraryReleases (userId, releaseKey) VALUES (1,'gog_1207658924'),(1,'steam_570'),(1,'gog_42'),(1,'gogx_9');
  INSERT INTO GamePieces VALUES ('gog_1207658924',2,'{"title":"The Witcher"}'),('gog_1207658924',1,'{"title":"The Witcher: Enhanced Edition"}'),
    ('gog_1207658924',3,'{"squareIcon":"https://images.gog-statics.com/a.png","background":"https://evil.example/b.png"}'),
    ('steam_570',1,'{"title":"Dota 2"}'),('gog_42',2,'{"title":"Cyberpunk 2077"}'),('gog_42',4,'not json');`);
gog.close();
const gogResult = readGogOwned(gogFile);
assert.equal(gogResult.status, 'ready');
assert.deepEqual(gogResult.games.map(game => game.title).sort(), ['Cyberpunk 2077', 'The Witcher: Enhanced Edition']);
const witcher = gogResult.games.find(game => game.providerId === '1207658924');
assert.equal(witcher.installUri, 'goggalaxy://openGameView/1207658924');
assert.equal(witcher.remoteArtwork.tile, 'https://images.gog-statics.com/a.png');
assert.equal(witcher.remoteArtwork.hero, '');
assert.equal(witcher.installed, false);

const amazonFile = path.join(dir, 'GameProductInfo.sqlite');
const amazon = new DatabaseSync(amazonFile);
amazon.exec(`CREATE TABLE DbSet (Id TEXT, ProductIdStr TEXT, ProductTitle TEXT, ProductPublisher TEXT);
  INSERT INTO DbSet VALUES ('1','amzn1.adg.product.abc','Fallout 76','Bethesda'),('2','bad id!','Nope',''),('3','amzn1.adg.product.def','  Quake  ',NULL);`);
amazon.close();
const amazonResult = readAmazonOwned(amazonFile);
assert.deepEqual(amazonResult.games.map(game => [game.title, game.installUri]), [['Fallout 76', 'amazon-games://play/amzn1.adg.product.abc'], ['Quake', 'amazon-games://play/amzn1.adg.product.def']]);

assert.equal(readGogOwned(path.join(dir, 'missing.db')).status, 'not-installed');
fs.writeFileSync(path.join(dir, 'broken.db'), 'not a database');
assert.equal(readAmazonOwned(path.join(dir, 'broken.db')).status, 'unreadable');
fs.rmSync(dir, { recursive: true, force: true });
console.log('local owned libraries ok');
