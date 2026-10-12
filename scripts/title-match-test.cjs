const assert = require('node:assert/strict');
const { titleMatchScore, titleConflict, titleNeedsRecheck } = require('../src/title-match.cjs');
const accept = (query, candidate, minimum = 82) => assert.ok(titleMatchScore(query, candidate) >= minimum, `${query} ~ ${candidate}: ${titleMatchScore(query, candidate)}`);
const reject = (query, candidate) => assert.ok(titleMatchScore(query, candidate) < 72, `${query} !~ ${candidate}: ${titleMatchScore(query, candidate)}`);

// The reported case: MW3 (2011) must not take Modern Warfare (2019) or Modern Warfare III (2023) art.
reject('Call of Duty®: Modern Warfare® 3 (2011)', 'Call of Duty: Modern Warfare');
reject('Call of Duty®: Modern Warfare® 3 (2011)', 'Call of Duty®: Modern Warfare® III');
accept('Call of Duty®: Modern Warfare® 3 (2011)', 'Call of Duty: Modern Warfare 3');
reject('Call of Duty: Modern Warfare 2 Campaign Remastered', 'Call of Duty: Modern Warfare 2');
reject('Call of Duty: Modern Warfare', 'Call of Duty: Modern Warfare 3');
reject('Halo: The Master Chief Collection', 'Halo Infinite');
reject('Forza Horizon 4', 'Forza Horizon 5');
reject('Resident Evil 4', 'Resident Evil 4 Remake');
reject('DOOM (1993)', 'DOOM (2016)');
reject('Final Fantasy VII', 'Final Fantasy VII Remake');
reject('Grand Theft Auto IV', 'Grand Theft Auto V');
// Same game, different store naming.
accept('Forza Horizon 5', 'Forza Horizon 5 Standard Edition');
accept('Forza Horizon 5', 'Forza Horizon 5 - Xbox Series X|S');
accept('Sea of Thieves', 'Sea of Thieves: 2025 Edition');
accept('Grand Theft Auto V', 'Grand Theft Auto V', 100);
accept('Hi-Fi RUSH', 'Hi-Fi Rush', 100);
accept('Senua’s Saga: Hellblade II', "Senua's Saga: Hellblade II");
accept('Baldur\'s Gate 3', 'Baldur’s Gate 3');
assert.equal(titleConflict('Lies of P', 'Lies of P'), false);
assert.equal(titleNeedsRecheck('Call of Duty: Modern Warfare 3 (2011)'), true);
assert.equal(titleNeedsRecheck('Sea of Thieves'), false);
console.log('title matching ok');
