// Captures: Game Bar files match only their own game, Steam screenshots are found per game across accounts,
// non-media files are ignored, results are newest first, and missing folders are not an error.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listCaptures, matchesGameTitle } = require('../src/captures.cjs');

// Title matching: the date must follow the title immediately.
assert.equal(matchesGameTitle('Forza Horizon 5 2026-10-17 12-34-56.png', 'Forza Horizon 5'), true);
assert.equal(matchesGameTitle('Forza Horizon 5 10_17_2026 12_34_56.mp4', 'Forza Horizon 5'), true, 'month first, underscores');
assert.equal(matchesGameTitle('forza horizon 5 2026-10-17 12-34-56.png', 'Forza Horizon 5'), true, 'case does not matter');
assert.equal(matchesGameTitle('Forza Horizon 5 2026-10-17 12-34-56.png', 'Forza Horizon'), false, 'a shorter title does not claim a sequel');
assert.equal(matchesGameTitle('Sea of Thieves 2026-10-17.png', 'Forza Horizon 5'), false);
assert.equal(matchesGameTitle('Hades II™ 2026-10-17 01-02-03.png', 'Hades II™'), true, 'trademark signs are ignored');
assert.equal(matchesGameTitle('notes.txt', 'Forza Horizon 5'), false);
assert.equal(matchesGameTitle('ab 2026-10-17.png', 'ab'), false, 'very short titles are never matched');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xpui-captures-test-'));
const touch = (file, secondsAgo, content = 'x') => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); const when = new Date(Date.now() - secondsAgo * 1000); fs.utimesSync(file, when, when); };
(async () => {
  try {
    const steam = path.join(root, 'Steam'), bar = path.join(root, 'Captures');
    touch(path.join(steam, 'userdata', '1001', '760', 'remote', '1551360', 'screenshots', 'a.jpg'), 300);
    touch(path.join(steam, 'userdata', '1002', '760', 'remote', '1551360', 'screenshots', 'b.png'), 100);
    touch(path.join(steam, 'userdata', '1001', '760', 'remote', '1551360', 'screenshots', 'readme.txt'), 50);
    touch(path.join(steam, 'userdata', '1001', '760', 'remote', '999', 'screenshots', 'other.jpg'), 10);
    touch(path.join(bar, 'Forza Horizon 5 2026-10-17 12-34-56.mp4'), 200);
    touch(path.join(bar, 'Forza Horizon 5 2026-10-16 09-00-00.png'), 400);
    touch(path.join(bar, 'Forza Horizon 2026-10-16 09-00-00.png'), 20);
    touch(path.join(bar, 'Sea of Thieves 2026-10-16 09-00-00.png'), 20);

    const list = await listCaptures({ title: 'Forza Horizon 5', appId: '1551360', steamRoots: [steam], captureDirs: [bar, path.join(root, 'missing')] });
    assert.deepEqual(list.map(item => item.name), ['b.png', 'Forza Horizon 5 2026-10-17 12-34-56.mp4', 'a.jpg', 'Forza Horizon 5 2026-10-16 09-00-00.png'], 'newest first, own game only');
    assert.equal(list[0].source, 'Steam');
    assert.equal(list[1].kind, 'video');
    assert.equal(list[1].source, 'Game Bar');
    assert.ok(!list.some(item => item.name === 'readme.txt'), 'non-media files are ignored');

    assert.equal((await listCaptures({ title: 'Forza Horizon 5', appId: '1551360', steamRoots: [steam], captureDirs: [bar], limit: 2 })).length, 2, 'the limit is applied');
    const gameBarOnly = await listCaptures({ title: 'Sea of Thieves', appId: 'not-steam', steamRoots: [steam], captureDirs: [bar] });
    assert.deepEqual(gameBarOnly.map(item => item.name), ['Sea of Thieves 2026-10-16 09-00-00.png'], 'a non-Steam game only looks in Game Bar');
    assert.deepEqual(await listCaptures({ title: 'Nothing', appId: '5', steamRoots: [path.join(root, 'none')], captureDirs: [path.join(root, 'none')] }), [], 'missing folders give an empty list');
    console.log('captures tests passed');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
