const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createSoundPack } = require('../src/sound-pack.cjs');
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'launcher-sound-test-'));
  try {
    const source = path.join(root, 'source');
    await fs.mkdir(source);
    const pack = createSoundPack(path.join(root, 'profile'));
    assert.deepEqual(await pack.get(), {});
    await assert.rejects(pack.install(source), /navigation.wav/);
    const wave = Buffer.alloc(100);
    wave.write('RIFF'); wave.writeUInt32LE(92, 4); wave.write('WAVE', 8);
    wave.write('fmt ',12); wave.writeUInt32LE(16,16); wave.writeUInt16LE(1,20); wave.writeUInt16LE(1,22);
    wave.writeUInt32LE(22050,24); wave.writeUInt32LE(44100,28); wave.writeUInt16LE(2,32); wave.writeUInt16LE(16,34);
    wave.write('data',36); wave.writeUInt32LE(56,40);
    for (const name of ['navigation.wav', 'activation.wav']) await fs.writeFile(path.join(source, name), wave);
    const saved = await pack.install(source);
    assert.equal(Object.keys(saved).length, 2);
    assert.match(saved.navigate, /^data:audio\/wav;base64,/);
    assert.deepEqual(await createSoundPack(path.join(root, 'profile')).get(), saved);
    await fs.writeFile(path.join(source, 'back.wav'), 'invalid');
    await assert.rejects(pack.install(source), /WAV/);
    assert.deepEqual(await pack.get(), saved, 'Failed imports must preserve existing sounds');
    assert.deepEqual(await pack.reset(), {});
    assert.deepEqual(await pack.get(), {});
    console.log('PASS sound pack validation, persistence, failed import rollback, reset');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
