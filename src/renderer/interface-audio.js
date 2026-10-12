// Decode each sound once. Playback never waits for disk or network access.
const interfaceAudio = (() => {
  let context;
  let buffers = {};
  let revision = 0;
  let lastAt = -Infinity;
  let lastKind = '';
  const voices = new Set();
  const getContext = () => context ||= new AudioContext();
  async function load(pack = {}) {
    const current = ++revision;
    const decoded = {};
    for (const [kind, uri] of Object.entries(pack)) {
      if (!['navigate', 'confirm', 'back', 'launch', 'startup'].includes(kind) || !uri.startsWith('data:audio/wav;base64,')) continue;
      try {
        const bytes = Uint8Array.from(atob(uri.split(',')[1]), character => character.charCodeAt(0));
        const buffer = await getContext().decodeAudioData(bytes.buffer);
        if (buffer.duration <= 5) decoded[kind] = buffer;
      } catch { /* A damaged optional sound must not block navigation. */ }
    }
    if (revision === current) buffers = decoded;
    return Object.keys(decoded).length;
  }
  function play(kind = 'navigate') {
    if (document.hidden || !document.hasFocus()) return;
    const now = performance.now();
    // Opening a surface focuses its first control: that is one action, not two sounds.
    if (kind === 'navigate' && now - lastAt < (lastKind === 'navigate' ? 55 : 180)) return;
    lastAt = now;
    lastKind = kind;
    try {
      const ctx = getContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      for (const voice of voices) { try { voice.stop(); } catch {} }
      voices.clear();
      const sample = buffers[kind] || (kind === 'launch' ? buffers.confirm : null);
      if (sample) {
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = sample;
        gain.gain.value = .45;
        source.connect(gain).connect(ctx.destination);
        source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
        voices.add(source);
        source.start();
        return;
      }
      // Original fallback cues; deliberately not labelled as Microsoft's recordings.
      if (kind === 'startup') {
        const start = ctx.currentTime;
        [130.81, 196, 261.63, 392].forEach((pitch, index) => {
          const source = ctx.createOscillator(), gain = ctx.createGain();
          const at = start + index * .065;
          source.type = 'sine';
          source.frequency.setValueAtTime(pitch * .985, at);
          source.frequency.exponentialRampToValueAtTime(pitch, at + .4);
          gain.gain.setValueAtTime(.0001, at);
          gain.gain.exponentialRampToValueAtTime(.022 / (1 + index * .25), at + .12);
          gain.gain.exponentialRampToValueAtTime(.0001, at + 1.55);
          source.connect(gain).connect(ctx.destination);
          voices.add(source);
          source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
          source.start(at); source.stop(at + 1.6);
        });
        return;
      }
      const duration = kind === 'launch' ? .24 : kind === 'confirm' ? .14 : .065;
      const source = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime;
      const pitch = kind === 'back' ? 340 : kind === 'navigate' ? 420 : 520;
      source.type = 'sine';
      source.frequency.setValueAtTime(pitch, start);
      source.frequency.exponentialRampToValueAtTime(pitch * (kind === 'back' ? .62 : 1.16), start + duration);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.045, start + .006);
      gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
      source.connect(gain).connect(ctx.destination);
      source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
      voices.add(source);
      source.start(start);
      source.stop(start + duration);
    } catch { /* Audio is optional, including in remote desktop sessions. */ }
  }
  window.addEventListener('blur', () => context?.suspend().catch(() => {}));
  return { load, play };
})();
window.launcher.getSoundPack().then(pack => interfaceAudio.load(pack)).then(count => {
  if (count) document.querySelector('#sound-pack-status').textContent = `${count} custom sounds ready. Stored on this PC only.`;
}).catch(() => {});
