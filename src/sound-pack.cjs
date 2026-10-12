const fs = require('node:fs/promises');
const path = require('node:path');

// Sound packs are private user data, never part of a packaged release.
const names = { navigate: ['navigation.wav', 'navigate.wav'], confirm: ['activation.wav', 'confirm.wav'], back: ['back.wav'], launch: ['launch.wav'], startup: ['startup.wav'] };
function validateWave(buffer) {
  if (buffer.length < 44 || buffer.length > 2 * 1024 * 1024 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw Error('Use WAV sounds smaller than 2 MB.');
  let rate = 0, dataSize = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const size = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + size;
    if (end > buffer.length) throw Error('This WAV file is incomplete.');
    const chunk = buffer.toString('ascii', offset, offset + 4);
    if (chunk === 'fmt ' && size >= 16) {
      if (![1, 3].includes(buffer.readUInt16LE(offset + 8))) throw Error('Use an uncompressed PCM or float WAV file.');
      rate = buffer.readUInt32LE(offset + 16);
    }
    if (chunk === 'data') dataSize = size;
    offset = end + (size % 2);
  }
  if (!rate || !dataSize || dataSize / rate > 5) throw Error('Use a valid WAV sound up to 5 seconds long.');
  return buffer;
}
function createSoundPack(directory) {
  const target = path.join(directory, 'interface-sounds.json');
  async function get() {
    try {
      const stat = await fs.stat(target);
      if (stat.size > 12 * 1024 * 1024) return {};
      const saved = JSON.parse(await fs.readFile(target, 'utf8'));
      const result = {};
      for (const key of Object.keys(names)) if (typeof saved[key] === 'string') result[key] = `data:audio/wav;base64,${validateWave(Buffer.from(saved[key], 'base64')).toString('base64')}`;
      return result;
    } catch { return {}; }
  }
  async function install(folder) {
    if (!path.isAbsolute(folder) || !(await fs.stat(folder)).isDirectory()) throw Error('Choose the folder containing your sounds.');
    const sounds = {};
    for (const [key, files] of Object.entries(names)) {
      for (const file of files) {
        const source = path.join(folder, file);
        let stat;
        try { stat = await fs.lstat(source); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw Error(`${file}: use a WAV file smaller than 2 MB.`);
        sounds[key] = validateWave(await fs.readFile(source)).toString('base64');
        break;
      }
    }
    if (!sounds.navigate || !sounds.confirm) throw Error('This folder needs navigation.wav and activation.wav (or navigate.wav and confirm.wav).');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(target + '.tmp', JSON.stringify(sounds));
    await fs.rename(target + '.tmp', target);
    return get();
  }
  async function reset() { await fs.rm(target, { force: true }); return {}; }
  return { get, install, reset };
}
module.exports = { createSoundPack, validateWave };
