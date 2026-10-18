// Theme sounds and the launch splash details for Series and One (looks are in garrison-themes.css).
//
// Sounds: each console had its own character, so each theme has its own synthesised set: the Series' short,
// airy ticks and soft swells, and the One's woody Metro "tocks" and swooshes. They're made here with Web Audio,
// not copies of Microsoft's recordings. A custom sound pack from Settings always wins, and Helix keeps the
// launcher's own sounds.
//
// Launch: both consoles open a game on a splash with its cover in the middle. The splash needs the cover's URL
// and, for the One, the game's colour, so they're handed to the launch screen as CSS variables.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';

  // ---------- Sounds ----------
  let context;
  const ctx = () => (context ||= new AudioContext());
  const voices = new Set();
  function tone(c, { type = 'sine', freq, to = freq, at = 0, dur, gain, attack = .004, filter = 0, q = .7 }) {
    const start = c.currentTime + at;
    const osc = c.createOscillator(), amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, start + dur);
    amp.gain.setValueAtTime(.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + attack);
    amp.gain.exponentialRampToValueAtTime(.0001, start + dur);
    let node = osc.connect(amp);
    if (filter) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = filter; lp.Q.value = q; node = node.connect(lp); }
    node.connect(c.destination);
    voices.add(osc);
    osc.onended = () => { voices.delete(osc); osc.disconnect(); amp.disconnect(); };
    osc.start(start); osc.stop(start + dur + .02);
  }
  function noise(c, { at = 0, dur, gain, from, to, kind = 'bandpass', q = 1.2 }) {
    const start = c.currentTime + at;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(), band = c.createBiquadFilter(), amp = c.createGain();
    src.buffer = buffer; band.type = kind; band.Q.value = q;
    band.frequency.setValueAtTime(from, start); band.frequency.exponentialRampToValueAtTime(to, start + dur);
    amp.gain.setValueAtTime(.0001, start); amp.gain.exponentialRampToValueAtTime(gain, start + dur * .35); amp.gain.exponentialRampToValueAtTime(.0001, start + dur);
    src.connect(band).connect(amp).connect(c.destination);
    voices.add(src);
    src.onended = () => { voices.delete(src); src.disconnect(); band.disconnect(); amp.disconnect(); };
    src.start(start); src.stop(start + dur + .02);
  }
  const SOUNDS = {
    series: {
      // A notification: a bright rising pair with a soft shimmer, as the toast's circle opens into its pill.
      notify: c => { [987.77, 1318.51, 1975.53].forEach((f, i) => tone(c, { freq: f, at: i * .07, dur: .55 - i * .1, gain: .03 - i * .006, attack: .01 })); noise(c, { at: .05, dur: .45, gain: .012, from: 6000, to: 12000, kind: 'highpass' }); },
      navigate: c => { tone(c, { freq: 1760, to: 1500, dur: .05, gain: .03 }); tone(c, { type: 'triangle', freq: 880, dur: .04, gain: .012 }); },
      confirm: c => { tone(c, { freq: 988, dur: .12, gain: .04 }); tone(c, { freq: 1480, at: .05, dur: .16, gain: .032 }); },
      back: c => { tone(c, { freq: 1175, to: 740, dur: .11, gain: .034 }); },
      launch: c => { noise(c, { dur: .7, gain: .05, from: 400, to: 5200 }); [523.25, 783.99, 1046.5].forEach((f, i) => tone(c, { freq: f, at: .12 + i * .06, dur: .9, gain: .02, attack: .08 })); },
      startup: c => { tone(c, { freq: 55, to: 82, dur: 1.6, gain: .06, attack: .25, filter: 400 }); [220, 329.63, 440, 659.25].forEach((f, i) => tone(c, { freq: f, at: .3 + i * .09, dur: 1.5, gain: .016, attack: .2 })); noise(c, { at: .25, dur: 1.2, gain: .02, from: 2000, to: 9000, kind: 'highpass' }); }
    },
    one: {
      // A notification: the Metro "bloop", a quick upward sweep that lands on a soft bell.
      notify: c => { tone(c, { type: 'triangle', freq: 392, to: 1046.5, dur: .16, gain: .045, filter: 3000 }); tone(c, { freq: 1567.98, at: .15, dur: .6, gain: .025, attack: .01 }); },
      navigate: c => { tone(c, { type: 'triangle', freq: 660, to: 600, dur: .07, gain: .05, filter: 2200 }); },
      confirm: c => { tone(c, { type: 'triangle', freq: 784, dur: .1, gain: .05, filter: 2600 }); tone(c, { type: 'triangle', freq: 1046.5, at: .07, dur: .14, gain: .045, filter: 3000 }); },
      back: c => { tone(c, { type: 'triangle', freq: 523.25, to: 392, dur: .12, gain: .05, filter: 1800 }); },
      launch: c => { noise(c, { dur: .55, gain: .07, from: 300, to: 3200, q: .8 }); tone(c, { type: 'triangle', freq: 392, to: 784, dur: .4, gain: .03, filter: 2400 }); },
      startup: c => { [196, 293.66, 392, 587.33].forEach((f, i) => tone(c, { type: 'sawtooth', freq: f, at: i * .05, dur: 2.2, gain: .012, attack: .45, filter: 1400 })); tone(c, { freq: 98, dur: 2, gain: .05, attack: .3 }); }
    }
  };
  if (typeof interfaceAudio === 'object' && interfaceAudio) {
    const basePlay = interfaceAudio.play.bind(interfaceAudio);
    let lastAt = -Infinity, lastKind = '';
    interfaceAudio.play = function (kind = 'navigate') {
      // The shared menu-audio engine (garrison-theme-retro.js) owns every console theme's sounds and music, and
      // routes them through the one master gain. These cues are the fallback for a page where it isn't loaded.
      if (window.gAudio?.play?.(kind)) return;
      const set = SOUNDS[theme()];
      if (!set || interfaceAudio.customCount?.() > 0 || !set[kind]) return basePlay(kind);
      if (document.hidden || !document.hasFocus()) return;
      const now = performance.now();
      if (kind === 'navigate' && now - lastAt < (lastKind === 'navigate' ? 55 : 180)) return;
      lastAt = now; lastKind = kind;
      try {
        const c = ctx();
        if (c.state === 'suspended') c.resume().catch(() => {});
        if (kind !== 'startup') for (const voice of voices) { try { voice.stop(); } catch { /* Already stopped. */ } }
        set[kind](c);
      } catch { /* Audio is optional. */ }
    };
    window.addEventListener('blur', () => context?.suspend().catch(() => {}));
  }

  // ---------- Launch splash ----------
  const overlay = document.querySelector('#launch-overlay');
  if (overlay && typeof launchSelectedGame === 'function') {
    overlay.insertAdjacentHTML('beforeend', '<div class="g-theme-splash" aria-hidden="true"><span class="g-theme-cover"></span><img class="g-theme-logo" alt="" hidden /><span class="g-one-dots"><i></i><i></i><i></i><i></i><i></i></span></div>');
    const splashLogo = overlay.querySelector('.g-theme-logo');
    // Consoles open a game on its own splash: its key art and logo. When the logo loads, it replaces the cover.
    splashLogo.addEventListener('load', () => { splashLogo.hidden = false; overlay.classList.add('g-has-logo'); });
    splashLogo.addEventListener('error', () => { splashLogo.hidden = true; overlay.classList.remove('g-has-logo'); });
    const base = launchSelectedGame;
    launchSelectedGame = function (...args) {
      const game = state.games.find(item => item.id === state.selectedGameId);
      if (game && overlay.hidden) {
        const cover = game.artwork?.tile || game.artwork?.grid || game.artwork?.hero || '';
        overlay.style.setProperty('--g-theme-cover', cover ? `url("${cover.replaceAll('"', '%22')}")` : 'none');
        overlay.style.setProperty('--g-one-solid', `hsl(${typeof hashHue === 'function' ? hashHue(game.title) : 120}, 52%, 27%)`);
        overlay.classList.toggle('g-no-cover', !cover);
        overlay.classList.remove('g-has-logo');
        splashLogo.hidden = true;
        const steamLogo = game.provider === 'Steam' && /^\d+$/.test(String(game.appId || '')) ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.appId}/logo.png` : '';
        const logo = game.artwork?.logo || steamLogo;
        if (logo) splashLogo.src = logo; else splashLogo.removeAttribute('src');
      }
      return base.apply(this, args);
    };
  }

})();
