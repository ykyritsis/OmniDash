// Theme sounds, one shared motion system, and the launch, boot and return sequences for Series, One and the
// retro consoles (looks are in the theme stylesheets).
//
// Sounds: each console had its own character, so each theme has its own synthesised set: the Series' short,
// airy ticks and soft swells, and the One's woody Metro "tocks" and swooshes. They're made here with Web Audio,
// not copies of Microsoft's recordings. A custom sound pack from Settings always wins, and Helix keeps the
// launcher's own sounds.
//
// Motion (task M1): one timing table per console. window.gMotion exposes enter/exit/table/ms, writes the
// --m-dur / --m-ease family of CSS variables that the seven theme stylesheets use, and owns page transitions.
// Every animation is skipped under html.reduce-motion and while the window is hidden; the CSS fallbacks live in
// garrison-theme-retro.css.
//
// Boot, launch and return (task M2): #startup-screen, #launch-overlay and gAudio are all the app already had.
// Nothing here is a console asset: every mark is drawn with type, CSS and a small canvas wave.
//
// Launch: the consoles open a game on a splash with its cover in the middle. The splash needs the cover's URL
// and, for the One, the game's colour, so they're handed to the launch screen as CSS variables.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const CONSOLES = ['series', 'one', 'x360', 'ps3', 'ps4', 'ps5', 'wii', '3ds'];
  const isConsole = () => CONSOLES.includes(theme());
  const prefersReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reduced = () => document.documentElement.classList.contains('reduce-motion') || prefersReduced();
  const hidden = () => document.hidden;
  const allowed = () => !reduced() && !hidden();

  // ---------- One motion system ----------
  // Every duration the themes use comes from this table: the console, its pace, its easing, its page grammar.
  // Base durations are the M1 spec: XMB 180 ms, PS4 250 ms, Wii 300 ms springy, 3DS 120 ms, Series/One 200 ms,
  // 360 160 ms. fast/slow/fade are derived so no stylesheet needs a hand-typed millisecond value.
  const TABLES = {
    ps3: {
      ms: 180, ease: 'cubic-bezier(.22, 1, .36, 1)', spring: 'cubic-bezier(.34, 1.45, .64, 1)',
      enter: 'column', boot: { kind: 'coldboot', ms: 2700 },
      launch: { hold: 620, grow: 480, fade: 380 },
      return: { kind: 'wave', ms: 1000 }
    },
    ps4: {
      ms: 250, ease: 'cubic-bezier(.22, 1, .36, 1)', spring: 'cubic-bezier(.34, 1.4, .64, 1)',
      enter: 'depth', boot: { kind: 'ps', ms: 2500 },
      launch: { hold: 0, grow: 520, fade: 420 },
      return: { kind: 'depth', ms: 900 }
    },
    // PS5 (2020): the quickest, calmest PlayStation. 200 ms and one flat ease, no overshoot; pages dissolve with
    // a slight scale, the tile grows and falls to black on launch, and the ambient layer fades back on return.
    ps5: {
      ms: 200, ease: 'cubic-bezier(.2, .9, .2, 1)', spring: 'cubic-bezier(.2, .9, .2, 1)',
      enter: 'fade', boot: { kind: 'ps5', ms: 2500 },
      launch: { hold: 0, grow: 520, fade: 420 },
      return: { kind: 'ambient', ms: 900 }
    },
    wii: {
      ms: 300, ease: 'cubic-bezier(.2, .9, .3, 1.15)', spring: 'cubic-bezier(.2, .9, .3, 1.3)',
      enter: 'zoom', boot: { kind: 'health', ms: 2750 },
      launch: { hold: 0, grow: 540, fade: 480 },
      return: { kind: 'flash', ms: 850 }
    },
    '3ds': {
      ms: 120, ease: 'cubic-bezier(.2, .9, .3, 1)', spring: 'cubic-bezier(.2, 1.2, .3, 1)',
      enter: 'wipe', boot: { kind: 'home', ms: 2200 },
      launch: { hold: 0, grow: 460, fade: 320 },
      return: { kind: 'wipe', ms: 700 }
    },
    series: {
      ms: 200, ease: 'cubic-bezier(.2, .8, .2, 1)', spring: 'cubic-bezier(.34, 1.56, .64, 1)',
      enter: 'fade', boot: { kind: 'brand', ms: 2300 },
      launch: { hold: 0, grow: 420, fade: 360 },
      return: { kind: 'fade', ms: 800 }
    },
    one: {
      ms: 200, ease: 'cubic-bezier(.1, .9, .2, 1)', spring: 'cubic-bezier(.1, 1.2, .2, 1)',
      enter: 'fade', boot: { kind: 'brand', ms: 2300 },
      launch: { hold: 0, grow: 440, fade: 340 },
      return: { kind: 'fade', ms: 800 }
    },
    x360: {
      ms: 160, ease: 'cubic-bezier(.2, .8, .2, 1)', spring: 'cubic-bezier(.2, .9, .3, 1.2)',
      enter: 'metro', boot: { kind: 'brand', ms: 2200 },
      launch: { hold: 0, grow: 380, fade: 320 },
      return: { kind: 'metro', ms: 750 }
    }
  };
  const WORDS = { series: 'Series X|S', one: 'One', x360: '360', ps3: 'PlayStation 3', ps4: 'PlayStation 4', ps5: 'PlayStation 5', wii: 'Wii', '3ds': 'Nintendo 3DS' };
  const table = (id = theme()) => {
    const source = TABLES[id];
    if (!source) return null;
    return {
      console: id, duration: source.ms, easing: source.ease, springEase: source.spring,
      page: source.ms, enter: source.enter, exit: source.enter,
      fast: Math.round(source.ms * .65), slow: Math.round(source.ms * 1.8), fade: Math.round(source.ms * 3.6),
      boot: { ...source.boot }, launch: { ...source.launch }, return: { ...source.return }
    };
  };
  const ms = (which = 'page', id = theme()) => {
    const value = table(id);
    if (!value) return 0;
    return value[which] ?? value.duration;
  };

  // The stylesheets read these; setting them here keeps CSS and JS on one clock. A fallback copy lives at the
  // top of garrison-theme-retro.css so a page that never runs this file still animates.
  (() => {
    const style = document.createElement('style');
    style.id = 'g-motion-vars';
    const vars = value => `--m-dur:${value.duration}ms;--m-dur-fast:${value.fast}ms;--m-dur-slow:${value.slow}ms;--m-dur-page:${value.page}ms;--m-fade:${value.fade}ms;--m-ease:${value.easing};--m-ease-page:${value.easing};--m-spring:${value.springEase}`;
    style.textContent = `:root{${vars({ duration: 200, fast: 130, slow: 360, page: 200, fade: 700, easing: 'cubic-bezier(.2, .8, .2, 1)', springEase: 'cubic-bezier(.34, 1.56, .64, 1)' })}}`
      + Object.entries(TABLES).map(([id, source]) => `body[data-g-theme="${id}"]{${vars(table(id))}}`).join('');
    document.head.append(style);
  })();

  // Every animation this file starts is tracked so a hidden window pauses it (rule §0.6) and a reduce-motion
  // change drops everything in flight.
  const running = new Set();
  function track(animation) {
    if (!animation) return null;
    running.add(animation);
    animation.finished.catch(() => {}).then(() => running.delete(animation));
    return animation;
  }
  function pauseAll(pause) {
    for (const animation of running) {
      try { pause ? animation.pause() : animation.play(); } catch { /* Already finished. */ }
    }
  }
  function stopAll() {
    for (const animation of running) { try { animation.cancel(); } catch { /* Already finished. */ } }
    running.clear();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseAll(true); else if (!reduced()) pauseAll(false); });

  // Page grammar: the same four words the plan uses, expressed as keyframes. `enter` runs on the incoming
  // view, `exit` on the console's own curtain (see pageTransition).
  const GRAMMAR = {
    column: { enter: [{ opacity: 0, transform: 'translate3d(64px, 0, 0)' }, { opacity: 1, transform: 'none' }], exit: [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-100%, 0, 0)' }] },
    depth: { enter: [{ opacity: 0, transform: 'scale(1.06)', filter: 'blur(6px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }], exit: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.05)' }] },
    zoom: { enter: [{ opacity: 0, transform: 'scale(.82)' }, { opacity: 1, transform: 'scale(1)' }], exit: [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.18)' }] },
    wipe: { enter: [{ opacity: 1, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], exit: [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 100%)' }] },
    fade: { enter: [{ opacity: 0, transform: 'scale(1.004)' }, { opacity: 1, transform: 'none' }], exit: [{ opacity: 1 }, { opacity: 0 }] },
    metro: { enter: [{ opacity: 0, transform: 'translate3d(86px, 0, 0)' }, { opacity: 1, transform: 'none' }], exit: [{ transform: 'translate3d(0, 0, 0)' }, { transform: 'translate3d(-100%, 0, 0)' }] }
  };
  const EXTRA = {
    fade: [{ opacity: 0 }, { opacity: 1 }],
    slide: [{ opacity: 0, transform: 'translate3d(40px, 0, 0)' }, { opacity: 1, transform: 'none' }],
    zoom: GRAMMAR.zoom.enter,
    wipe: GRAMMAR.wipe.enter,
    depth: GRAMMAR.depth.enter,
    pop: [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1)' }]
  };
  const framesFor = (kind, value, direction = 'enter') => {
    if (kind === 'page') return GRAMMAR[value.enter]?.[direction] || GRAMMAR.fade[direction];
    if (kind === 'exit') return GRAMMAR[value.exit]?.exit || GRAMMAR.fade.exit;
    const frames = EXTRA[kind];
    if (!frames) return null;
    return direction === 'exit' ? [...frames].reverse() : frames;
  };
  function enter(element, kind = 'page', options = {}) {
    if (!element || !allowed()) return null;
    const value = table(options.console || theme());
    if (!value) return null;
    const frames = framesFor(kind, value, 'enter');
    if (!frames) return null;
    const duration = options.duration ?? (kind === 'fast' ? value.fast : kind === 'slow' ? value.slow : kind === 'fade' ? value.fade : value.duration);
    try {
      const animation = element.animate(frames, { duration, easing: value.easing, delay: options.delay || 0, fill: options.fill || 'backwards' });
      return track(animation);
    } catch { return null; }
  }
  function exit(element, kind = 'page', options = {}) {
    if (!element || !allowed()) return null;
    const value = table(options.console || theme());
    if (!value) return null;
    const frames = framesFor(kind, value, 'exit');
    if (!frames) return null;
    const duration = options.duration ?? (kind === 'fast' ? value.fast : kind === 'slow' ? value.slow : kind === 'fade' ? value.fade : value.duration);
    try {
      const animation = element.animate(frames, { duration, easing: value.easing, delay: options.delay || 0, fill: options.fill || 'forwards' });
      return track(animation);
    } catch { return null; }
  }

  // Page transitions. showView() swaps the views in one tick, so the exit is a console-coloured curtain that
  // wipes away over the new page while it enters with the console's grammar. Nothing about the outgoing page is
  // cloned or laid out twice, and focus is untouched.
  const VIEWS = { home: '#home-view', library: '#library-view', detail: '#game-detail-view', store: '#store-view' };
  const CURTAINS = {
    ps3: 'linear-gradient(100deg, #0a0a12 0 55%, #1a1830 78%, #0a0a12 100%)',
    ps4: 'linear-gradient(135deg, #0b1c38, #030a18 70%)',
    ps5: 'linear-gradient(160deg, #0b1424, #02040a 72%)',
    wii: '#f4f8fb', '3ds': '#f6fbfe',
    series: '#070b07', one: '#0a0a0a', x360: '#121212'
  };
  let curtain = null, lastFocusBox = null;
  function focusBox() {
    const element = document.querySelector('#g-retro .focused, #g-retro-chrome .focused, .focused') || document.activeElement;
    const box = element?.getBoundingClientRect?.();
    if (!box || box.width < 2 || box.height < 2) return null;
    return { x: box.left + box.width / 2, y: box.top + box.height / 2, width: box.width, height: box.height };
  }
  function curtainFor(value) {
    if (curtain) {
      try { curtain.getAnimations().forEach(animation => animation.cancel()); } catch { /* Fine. */ }
      curtain.remove();
      curtain = null;
    }
    if (!curtain) {
      curtain = document.createElement('div');
      curtain.id = 'g-m-curtain';
      curtain.setAttribute('aria-hidden', 'true');
      curtain.style.cssText = 'position:fixed;inset:0;z-index:8500;pointer-events:none;will-change:transform,opacity,clip-path';
      document.body.append(curtain);
    }
    curtain.style.background = CURTAINS[theme()] || '#0b0b0b';
    return curtain;
  }
  function pageTransition(next) {
    if (!isConsole() || !allowed()) return;
    const value = table();
    if (!value) return;
    const goal = document.querySelector(VIEWS[next]);
    if (!goal) return;
    const targets = [goal];
    // The retro clocks and hint chrome are siblings of #home-view, so Home moves them with the XMB.
    if (next === 'home' && document.body.classList.contains('g-retro')) {
      const chrome = document.querySelector('#g-retro-chrome');
      if (chrome) targets.push(chrome);
    }
    // Wii pages zoom from the channel you pressed; 3DS wipes from the screen edge.
    for (const element of targets) {
      element.style.transformOrigin = '';
      if (value.enter === 'zoom' && lastFocusBox) {
        const box = element.getBoundingClientRect();
        if (box.width && box.height) element.style.transformOrigin = `${((lastFocusBox.x - box.left) / box.width) * 100}% ${((lastFocusBox.y - box.top) / box.height) * 100}%`;
      }
      const animation = enter(element, 'page');
      if (animation) animation.finished.catch(() => {}).then(() => { element.style.transformOrigin = ''; });
    }
    const layer = curtainFor(value);
    const frames = GRAMMAR[value.exit]?.exit || GRAMMAR.fade.exit;
    try {
      const animation = layer.animate(frames, { duration: value.duration, easing: value.easing, fill: 'both' });
      track(animation);
      animation.finished.catch(() => {}).then(() => { layer.remove(); if (curtain === layer) curtain = null; });
    } catch { /* A browser without WAAPI keeps the instant swap. */ }
  }
  if (typeof showView === 'function') {
    const viewBase = showView;
    showView = function (next, options) {
      const previous = state.view;
      if (next !== previous) lastFocusBox = focusBox();
      const result = viewBase.call(this, next, options);
      if (next !== previous) pageTransition(next);
      return result;
    };
  }
  // The theme picker and the library's re-renders must not leave a curtain over the screen.
  new MutationObserver(() => { if (curtain) { try { curtain.getAnimations().forEach(animation => animation.cancel()); } catch { /* Fine. */ } curtain.remove(); curtain = null; } })
    .observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });

  // ---------- Stats and the public API ----------
  const stats = { boot: 0, launch: 0, return: 0 };
  const fire = (name, detail) => { try { document.dispatchEvent(new CustomEvent(name, { detail })); } catch { /* Optional. */ } };

  // ---------- Boot sequences ----------
  // PS3 coldboot, PS4 "PS" splash, Wii Health and Safety then the Wii Menu, 3DS HOME Menu slide-in, and a short
  // branded splash on Series, One and 360. Each is under four seconds and any key skips it.
  const bootScreen = () => document.querySelector('#startup-screen');
  let bootActive = false, bootStage = 'start', bootTimer = 0, bootHideTimer = 0, bootCue = null, bootWaveFrame = 0, bootPadTimer = 0, bootTheme = '';
  const savedBoot = bootScreen()?.innerHTML || '';
  function cue(kind) {
    if (!document.hasFocus() || document.hidden) return;
    try { if (window.gAudio?.play?.(kind)) return; } catch { /* Audio is optional. */ }
    try { if (typeof interfaceAudio?.play === 'function') interfaceAudio.play(kind === 'boot' ? 'startup' : kind); } catch { /* Optional. */ }
  }
  // A small drawn wave for the PS3 coldboot: translucent sine sheets with a bright crest, no shader, no asset.
  function paintWave(canvas, time, still) {
    const ratio = Math.min(2, devicePixelRatio || 1);
    const width = canvas.clientWidth || innerWidth, height = canvas.clientHeight || innerHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    const c = canvas.getContext('2d');
    if (!c) return;
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.clearRect(0, 0, width, height);
    const sheets = [
      { y: .52, amp: .075, speed: .00016, phase: 0, alpha: .20, colour: '120,160,255' },
      { y: .58, amp: .055, speed: .00021, phase: 1.8, alpha: .34, colour: '170,205,255' },
      { y: .63, amp: .040, speed: .00026, phase: 3.4, alpha: .55, colour: '235,245,255' }
    ];
    for (const sheet of sheets) {
      c.beginPath();
      c.moveTo(0, height);
      for (let x = 0; x <= width; x += 8) {
        const wave = Math.sin(x * .006 + time * sheet.speed + sheet.phase) * height * sheet.amp
          + Math.sin(x * .013 - time * sheet.speed * 1.7 + sheet.phase * 2) * height * sheet.amp * .35;
        c.lineTo(x, height * sheet.y + wave);
      }
      c.lineTo(width, height);
      c.closePath();
      const fill = c.createLinearGradient(0, height * .2, 0, height);
      fill.addColorStop(0, `rgba(${sheet.colour}, ${sheet.alpha * .25})`);
      fill.addColorStop(.55, `rgba(${sheet.colour}, ${sheet.alpha})`);
      fill.addColorStop(1, `rgba(${sheet.colour}, 0)`);
      c.fillStyle = fill;
      c.fill();
      c.beginPath();
      for (let x = 0; x <= width; x += 8) {
        const wave = Math.sin(x * .006 + time * sheet.speed + sheet.phase) * height * sheet.amp
          + Math.sin(x * .013 - time * sheet.speed * 1.7 + sheet.phase * 2) * height * sheet.amp * .35;
        if (x === 0) c.moveTo(x, height * sheet.y + wave); else c.lineTo(x, height * sheet.y + wave);
      }
      c.strokeStyle = `rgba(255, 255, 255, ${sheet.alpha * .75})`;
      c.lineWidth = 1.4;
      c.stroke();
    }
    if (still) return;
  }
  function runWave(canvas) {
    if (!canvas) return;
    if (reduced()) { paintWave(canvas, 1800, true); return; }
    const loop = now => {
      if (!bootActive || document.hidden) { bootWaveFrame = 0; return; }
      paintWave(canvas, now, false);
      bootWaveFrame = requestAnimationFrame(loop);
    };
    bootWaveFrame = requestAnimationFrame(loop);
  }
  // PS5 coldboot: a wave of fine white particles drifts across the screen, then settles into a drawn "5" mark.
  // Everything is computed here; no font, texture or vector asset from the console is involved. The particle
  // layout is generated once per canvas size from a fixed seed, so the mark is identical on every start.
  let ps5Particles = null, ps5ParticlesKey = '';
  function buildPs5Particles(width, height) {
    const key = `${Math.round(width)}x${Math.round(height)}`;
    if (ps5Particles && ps5ParticlesKey === key) return ps5Particles;
    const size = Math.min(height * .5, width * .17);
    const cx = width / 2, cy = height * .43;
    // The mark: a five, drawn as a polyline in mark-local units (-.5 … .5). It is our own geometry.
    const path = [
      [-.4, -.5], [.34, -.5], [-.4, -.5], [-.4, -.08], [-.4, -.08], [.3, -.08],
      [.3, -.08], [.3, .34], [.3, .34], [.16, .5], [-.2, .5], [-.38, .38]
    ].map(([x, y]) => [cx + x * size, cy + y * size]);
    let total = 0;
    const lengths = [];
    for (let i = 1; i < path.length; i++) {
      const length = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
      lengths.push(length);
      total += length;
    }
    let seed = 0x5eed1234;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const count = Math.round(Math.min(430, (width * height) / 5200));
    const points = [];
    for (let i = 0; i < count; i++) {
      // Spread particles evenly along the polyline, with a little scatter that closes as they settle.
      let distance = ((i + .5) / count) * total;
      let segment = 0;
      while (segment < lengths.length - 1 && distance > lengths[segment]) { distance -= lengths[segment]; segment++; }
      const from = path[segment], to = path[segment + 1] || path[segment];
      const t = lengths[segment] ? Math.min(1, distance / lengths[segment]) : 0;
      points.push({
        x: from[0] + (to[0] - from[0]) * t,
        y: from[1] + (to[1] - from[1]) * t,
        phase: random() * Math.PI * 2,
        drift: .55 + random() * 1.5,
        speed: .25 + random() * .9,
        radius: .55 + random() * 1.35,
        alpha: .32 + random() * .68,
        jitter: random() * 2 - 1
      });
    }
    ps5Particles = { points, size, cx, cy };
    ps5ParticlesKey = key;
    return ps5Particles;
  }
  function paintParticles(canvas, time, still) {
    const ratio = Math.min(2, devicePixelRatio || 1);
    const width = canvas.clientWidth || innerWidth, height = canvas.clientHeight || innerHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    const c = canvas.getContext('2d');
    if (!c) return;
    const data = buildPs5Particles(width, height);
    c.setTransform(ratio, 0, 0, ratio, 0, 0);
    c.clearRect(0, 0, width, height);
    const t = still ? 2100 : time;
    // 0.35 s of drift, 1.1 s of gathering, then the mark holds with a slow shimmer.
    const progress = Math.max(0, Math.min(1, (t - 350) / 1100));
    const ease = 1 - Math.pow(1 - progress, 3);
    const shimmer = still ? 0 : Math.sin(t * .0015) * .08;
    // A few soft filaments behind the particles keep the wave readable before the mark exists.
    c.save();
    for (let band = 0; band < 3; band++) {
      c.beginPath();
      for (let x = 0; x <= width; x += 10) {
        const y = height * (.42 + band * .055)
          + Math.sin(x * .0045 + t * (.00018 + band * .00005) + band * 1.7) * height * (.05 - band * .011)
          + Math.cos(x * .011 - t * .00012) * height * .014;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.strokeStyle = `rgba(190, 214, 255, ${(.08 + band * .035) * (1 - ease * .55)})`;
      c.lineWidth = 1;
      c.stroke();
    }
    c.restore();
    for (const point of data.points) {
      const driftX = ((point.phase * 180 + t * .035 * point.speed) % (width + 240)) - 120;
      const driftY = height * (.42 + Math.sin(driftX * .006 + point.phase + t * .0004 * point.speed) * .09)
        + Math.cos(driftX * .013 - point.phase * 2) * height * .022;
      const settle = ease * ease;
      const x = driftX * (1 - ease) + point.x * ease + point.jitter * (1 - settle) * 26;
      const y = driftY * (1 - ease) + point.y * ease + point.jitter * (1 - settle) * 18;
      const alpha = point.alpha * (1 - ease * .18) * (1 + shimmer * point.speed);
      c.beginPath();
      c.arc(x, y, point.radius * (1 + ease * .25), 0, Math.PI * 2);
      c.fillStyle = `rgba(240, 247, 255, ${Math.max(0, Math.min(1, alpha))})`;
      c.fill();
      if (ease > .35 && point.radius > 1.55) {
        c.beginPath();
        c.arc(x, y, point.radius * 3.4, 0, Math.PI * 2);
        c.fillStyle = `rgba(120, 172, 255, ${.10 * ease})`;
        c.fill();
      }
    }
    if (!still && ease > .72) {
      // A soft bloom around the centre once the mark has formed, like the console's boot glint.
      const glow = c.createRadialGradient(data.cx, data.cy, 0, data.cx, data.cy, data.size * .85);
      glow.addColorStop(0, `rgba(150, 194, 255, ${.10 * (ease - .72)})`);
      glow.addColorStop(1, 'rgba(150, 194, 255, 0)');
      c.fillStyle = glow;
      c.fillRect(0, 0, width, height);
    }
  }
  function runPs5Particles(canvas) {
    if (!canvas) return;
    if (reduced()) { paintParticles(canvas, 2100, true); return; }
    const loop = now => {
      if (!bootActive || document.hidden) { bootWaveFrame = 0; return; }
      paintParticles(canvas, now, false);
      bootWaveFrame = requestAnimationFrame(loop);
    };
    bootWaveFrame = requestAnimationFrame(loop);
  }
  const BOOT_MARKUP = {
    ps3: `<div class="g-m-boot g-m-boot-ps3"><canvas class="g-m-wave" aria-hidden="true"></canvas><div class="g-m-ps3-mark" aria-hidden="true"><span>PlayStation</span><em>3</em></div><div class="g-m-hint" aria-hidden="true">Press any key</div></div>`,
    ps4: `<div class="g-m-boot g-m-boot-ps4"><div class="g-m-ps4-glow" aria-hidden="true"></div><div class="g-m-ps4-mark" aria-hidden="true">PS</div><div class="g-m-ps4-sub" aria-hidden="true">Press the PS button to use the controller</div></div>`,
    ps5: `<div class="g-m-boot g-m-boot-ps5"><canvas class="g-m-p5-wave" aria-hidden="true"></canvas><div class="g-m-p5-mark" aria-hidden="true"><span>PlayStation</span><em>5</em></div><div class="g-m-hint" aria-hidden="true">Press any key</div></div>`,
    wii: `<div class="g-m-boot g-m-boot-wii"><div class="g-m-hs"><span class="g-m-hs-word" aria-hidden="true">Wii</span><h2>Health and Safety Information</h2><p>Take a 15-minute break every hour, even if you don't think you need it. Stop playing if you feel tired or uncomfortable.</p><div class="g-m-hs-a" aria-hidden="true"><kbd>A</kbd> Press A to continue</div></div></div>`,
    '3ds': `<div class="g-m-boot g-m-boot-3ds"><span class="g-m-3ds-word" aria-hidden="true">Nintendo 3DS</span><div class="g-m-3ds-menu" aria-hidden="true"><div class="g-m-3ds-bar"><i></i><i></i><i></i><i></i></div><div class="g-m-3ds-grid">${'<i></i>'.repeat(12)}</div></div></div>`,
    brand: `<div class="g-m-boot g-m-boot-xbox"><img class="g-m-xbox-mark" src="assets/xbox.svg" alt="" /><span class="g-m-xbox-word" aria-hidden="true">Xbox</span><span class="g-m-xbox-sub" aria-hidden="true"></span></div>`
  };
  function bootMarkup(id, value) {
    if (value.boot.kind !== 'brand') return BOOT_MARKUP[id] || BOOT_MARKUP.ps3;
    return BOOT_MARKUP.brand.replace('Xbox</span>', `Xbox</span>`).replace('<span class="g-m-xbox-sub" aria-hidden="true"></span>', `<span class="g-m-xbox-sub" aria-hidden="true">${WORDS[id] || ''}</span>`);
  }
  // A theme switch while a boot is in flight (the review harness does this, and a player can too) tears the
  // old splash down at once rather than letting its hide timer fight the new one.
  function stopBoot() {
    bootActive = false; bootStage = 'start';
    clearTimeout(bootTimer); clearTimeout(bootHideTimer); clearInterval(bootPadTimer);
    if (bootWaveFrame) { cancelAnimationFrame(bootWaveFrame); bootWaveFrame = 0; }
    window.removeEventListener('keydown', bootPress, true);
    window.removeEventListener('pointerdown', bootPress, true);
    const screen = bootScreen();
    if (screen) {
      screen.hidden = true;
      screen.classList.remove('g-m-booting', 'leaving', 'still');
      screen.dataset.gBoot = '';
      screen.innerHTML = savedBoot;
    }
  }
  function bootExit() {
    const screen = bootScreen();
    if (!screen || !bootActive) return;
    bootActive = false;
    clearTimeout(bootTimer); clearInterval(bootPadTimer);
    if (bootWaveFrame) { cancelAnimationFrame(bootWaveFrame); bootWaveFrame = 0; }
    window.removeEventListener('keydown', bootPress, true);
    window.removeEventListener('pointerdown', bootPress, true);
    screen.classList.remove('g-m-booting');
    screen.classList.add('leaving');
    bootHideTimer = setTimeout(() => {
      screen.hidden = true;
      screen.classList.remove('leaving');
      screen.dataset.gBoot = '';
      screen.innerHTML = savedBoot;
    }, reduced() ? 0 : 520);
    fire('g-motion-boot', { theme: theme(), phase: 'end' });
  }
  function bootPress(event) {
    if (!bootActive) return;
    // Press A on the Wii advances the Health and Safety screen to the Wii Menu; everywhere else any key skips.
    if (theme() === 'wii' && bootStage === 'health') {
      event?.preventDefault?.();
      wiiMenuStage();
      return;
    }
    bootExit();
  }
  function wiiMenuStage() {
    if (!bootActive) return;
    bootStage = 'menu';
    const screen = bootScreen();
    if (!screen) return;
    const stage = screen.querySelector('.g-m-boot-wii');
    if (!stage) return;
    stage.classList.add('g-m-wii-menu');
    stage.innerHTML = `<span class="g-m-wii-word" aria-hidden="true">Wii</span><span class="g-m-wii-menu-word" aria-hidden="true">Wii Menu</span><div class="g-m-wii-grid" aria-hidden="true">${'<i></i>'.repeat(12)}</div>`;
    if (allowed()) {
      enter(stage.querySelector('.g-m-wii-word'), 'fade', { duration: table().fast });
      const grid = stage.querySelector('.g-m-wii-grid');
      if (grid) enter(grid, 'pop', { duration: table().duration });
    }
    cue('confirm');
    clearTimeout(bootTimer);
    bootTimer = setTimeout(bootExit, reduced() ? 250 : 900);
  }
  function consoleBoot(settings) {
    if (bootActive) {
      if (bootTheme === theme()) return null;
      stopBoot();
    }
    const screen = bootScreen();
    const value = table();
    if (!screen || !value) return null;
    bootActive = true; bootTheme = theme(); bootStage = value.boot.kind === 'health' ? 'health' : 'start'; stats.boot++;
    screen.hidden = false;
    screen.classList.remove('leaving', 'still');
    screen.classList.add('g-m-booting');
    screen.dataset.gBoot = theme();
    screen.innerHTML = bootMarkup(theme(), value);
    fire('g-motion-boot', { theme: theme(), phase: 'start' });
    if (settings.soundEffects !== false) cue('boot');
    const stage = screen.querySelector('.g-m-boot');
    const left = value.boot.ms - (reduced() ? 250 : 520);
    if (theme() === 'ps3') {
      runWave(screen.querySelector('.g-m-wave'));
      if (allowed()) {
        enter(screen.querySelector('.g-m-ps3-mark'), 'fade', { delay: Math.round(left * .28), duration: Math.round(left * .5) });
        enter(screen.querySelector('.g-m-hint'), 'fade', { delay: Math.round(left * .55), duration: Math.round(left * .3) });
      }
    } else if (theme() === 'ps4') {
      if (allowed()) {
        enter(screen.querySelector('.g-m-ps4-glow'), 'fade', { duration: Math.round(left * .55) });
        enter(screen.querySelector('.g-m-ps4-mark'), 'pop', { duration: Math.round(left * .4) });
        enter(screen.querySelector('.g-m-ps4-sub'), 'fade', { delay: Math.round(left * .38), duration: Math.round(left * .4) });
      }
    } else if (theme() === 'ps5') {
      runPs5Particles(screen.querySelector('.g-m-p5-wave'));
      if (allowed()) {
        enter(screen.querySelector('.g-m-p5-mark'), 'fade', { delay: Math.round(left * .52), duration: Math.round(left * .34) });
        enter(screen.querySelector('.g-m-hint'), 'fade', { delay: Math.round(left * .72), duration: Math.round(left * .24) });
      }
    } else if (theme() === 'wii') {
      if (allowed()) {
        enter(stage?.querySelector('.g-m-hs'), 'fade', { duration: Math.round(left * .2) });
        enter(stage?.querySelector('.g-m-hs-a'), 'fade', { delay: Math.round(left * .18), duration: Math.round(left * .25) });
      }
      bootTimer = setTimeout(wiiMenuStage, reduced() ? 350 : Math.max(600, Math.round(left * .62)));
    } else if (theme() === '3ds') {
      if (allowed()) {
        enter(stage?.querySelector('.g-m-3ds-word'), 'fade', { duration: Math.round(left * .2) });
        enter(stage?.querySelector('.g-m-3ds-menu'), 'slide', { delay: Math.round(left * .15), duration: Math.round(left * .5) });
      }
    } else if (allowed()) {
      enter(stage?.querySelector('.g-m-xbox-mark'), 'pop', { duration: Math.round(left * .35) });
      enter(stage?.querySelector('.g-m-xbox-word'), 'fade', { delay: Math.round(left * .22), duration: Math.round(left * .3) });
      enter(stage?.querySelector('.g-m-xbox-sub'), 'fade', { delay: Math.round(left * .38), duration: Math.round(left * .3) });
    }
    window.addEventListener('keydown', bootPress, true);
    window.addEventListener('pointerdown', bootPress, true);
    // Waggle a controller or press any button: the same skip.
    bootPadTimer = setInterval(() => {
      if (!bootActive) { clearInterval(bootPadTimer); return; }
      const pressed = [...(navigator.getGamepads?.() || [])].some(pad => pad?.buttons?.some(button => button.pressed));
      if (pressed) { clearInterval(bootPadTimer); bootPress(); }
    }, 120);
    if (theme() !== 'wii') bootTimer = setTimeout(bootExit, reduced() ? 250 : left);
    return true;
  }
  if (typeof runStartupSequence === 'function') {
    const baseSequence = runStartupSequence;
    runStartupSequence = function (settings = {}) {
      if (settings.startupAnimation === false) return;
      if (!isConsole()) {
        const screen = bootScreen();
        if (screen && !screen.querySelector('.g-boot-mark')) screen.innerHTML = savedBoot;
        return baseSequence.call(this, settings);
      }
      return consoleBoot(settings);
    };
  }

  // A PC game can take far longer to appear than a console one. The console's black or white beat plays in full,
  // then lifts after a moment so the launch screen's status line and Cancel button are reachable again, rather
  // than leaving a blank screen that looks frozen.
  const FLASH_HOLD = 2200;
  function liftFlash(flash, after) {
    flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, delay: after + FLASH_HOLD, easing: 'ease-out', fill: 'forwards' });
  }
  // ---------- Launch sequences ----------
  // The launcher's launch screen still owns the wait; this only performs the console's own opening beat on top
  // of it, and leaves the overlay up until the game really starts (app.js's existing flow).
  function launchSequence() {
    const overlay = document.querySelector('#launch-overlay');
    if (!overlay || overlay.hidden || !isConsole() || overlay.dataset.gLaunch) return null;
    const value = table();
    overlay.dataset.gLaunch = theme();
    stats.launch++;
    fire('g-motion-launch', { theme: theme(), phase: 'start' });
    overlay.querySelectorAll('.g-m-flash').forEach(node => node.remove());
    const splash = overlay.querySelector('.g-theme-splash');
    const art = overlay.querySelector('#launch-art');
    const src = { hold: value.launch.hold, grow: value.launch.grow, fade: value.launch.fade };
    const live = allowed();
    if (theme() === 'ps3') {
      // The icon holds, then the screen falls to black. The launch sound is scheduled by the playUiSound
      // wrapper below, timed to the same hold.
      if (live) {
        exit(splash, 'fade', { delay: src.hold, duration: src.fade });
        if (art) exit(art, 'fade', { delay: src.hold + src.fade * .35, duration: src.fade });
      }
    } else if (theme() === 'ps4') {
      // The tile grows out of the row, then fades into the game's art.
      if (live) {
        splash?.animate([{ opacity: 0, transform: 'scale(.58)' }, { opacity: 1, transform: 'scale(1.04)' }], { duration: src.grow, easing: value.springEase, fill: 'forwards' });
        exit(splash, 'fade', { delay: src.grow, duration: src.fade });
        if (art) enter(art, 'fade', { duration: src.grow + src.fade });
      }
    } else if (theme() === 'ps5') {
      // The tile grows out of the row, then the screen falls to black.
      const flash = document.createElement('span');
      flash.className = 'g-m-flash p5-black';
      overlay.append(flash);
      if (live) {
        splash?.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'scale(1.045)' }], { duration: src.grow, easing: value.easing, fill: 'forwards' });
        exit(splash, 'fade', { delay: src.grow, duration: src.fade });
        flash.animate([{ opacity: 0, offset: 0 }, { opacity: 0, offset: .62 }, { opacity: 1, offset: 1 }], { duration: src.grow + src.fade, easing: value.easing, fill: 'forwards' });
        liftFlash(flash, src.grow + src.fade);
        if (art) enter(art, 'fade', { duration: src.grow });
      } else {
        flash.remove(); // Reduced motion: no flash, so the launch screen's status and Cancel stay in view.
      }
    } else if (theme() === 'wii' || theme() === '3ds') {
      // The channel or icon zooms to fill the screen, then the screen goes white.
      const flash = document.createElement('span');
      flash.className = 'g-m-flash';
      overlay.append(flash);
      if (live) {
        splash?.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 1, transform: `scale(${theme() === 'wii' ? 2.2 : 3.1})` }], { duration: src.grow, easing: value.easing, fill: 'forwards' });
        exit(splash, 'fade', { delay: src.grow, duration: src.fade });
        flash.animate([{ opacity: 0 }, { opacity: 1 }], { duration: src.fade, delay: src.grow, easing: value.easing, fill: 'forwards' });
        liftFlash(flash, src.grow + src.fade);
      } else {
        flash.remove(); // Reduced motion: no flash, so the launch screen's status and Cancel stay in view.
      }
    } else if (live) {
      // Xbox: the tiles scale up and fade.
      splash?.animate([{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'scale(1.06)' }], { duration: src.grow, easing: value.easing, fill: 'forwards' });
      exit(splash, 'fade', { delay: src.grow, duration: src.fade });
      if (art) enter(art, 'fade', { duration: src.grow + src.fade });
    }
    return true;
  }
  if (typeof launchSelectedGame === 'function') {
    const launchBase = launchSelectedGame;
    launchSelectedGame = function (...args) {
      const overlay = document.querySelector('#launch-overlay');
      if (overlay && !overlay.hidden) return launchBase.apply(this, args);
      const result = launchBase.apply(this, args);
      // app.js shows the overlay synchronously before its first await, so this is already the real launch.
      if (overlay && !overlay.hidden) launchSequence();
      return result;
    };
  }
  // The next launch starts clean: app.js hides the overlay once the game is up.
  const overlayNode = document.querySelector('#launch-overlay');
  if (overlayNode) new MutationObserver(() => {
    if (overlayNode.hidden) {
      delete overlayNode.dataset.gLaunch;
      overlayNode.querySelectorAll('.g-m-flash').forEach(node => node.remove());
      // The splash animations are left with fill:forwards so the screen stays black/white while the game
      // starts; cancel them once it is hidden or the next launch would open on a faded splash.
      try { overlayNode.getAnimations({ subtree: true }).forEach(animation => animation.cancel()); } catch { /* Fine. */ }
      const splash = overlayNode.querySelector('.g-theme-splash');
      if (splash) { splash.style.opacity = ''; splash.style.transform = ''; }
      const art = overlayNode.querySelector('#launch-art');
      if (art) { art.style.opacity = ''; }
    }
  }).observe(overlayNode, { attributes: true, attributeFilter: ['hidden'] });
  // The PS3's launch sound belongs after the hold, not on the button press; every other console keeps the cue
  // app.js already plays. The wrapper only intercepts when it is going to schedule that sound itself.
  if (typeof playUiSound === 'function') {
    const soundBase = playUiSound;
    playUiSound = function (kind, ...rest) {
      if (kind === 'launch' && theme() === 'ps3' && isConsole() && state.soundEffects) {
        clearTimeout(bootCue);
        bootCue = setTimeout(() => cue('launch'), reduced() ? 0 : table().launch.hold);
        return undefined;
      }
      return soundBase.call(this, kind, ...rest);
    };
  }

  // ---------- Return sequences ----------
  // When a game closes, the console fades back to where you left it: the same selection, the same view, plus
  // the console's own return beat and sound. Nothing is re-rendered and focus is never moved.
  let lastSession = null, returnLayer = null;
  function returnSequence() {
    if (!isConsole() || !allowed()) return null;
    const value = table().return;
    stats.return++;
    fire('g-motion-return', { theme: theme() });
    returnLayer?.remove();
    const layer = document.createElement('div');
    layer.className = 'g-m-return';
    layer.dataset.console = theme();
    layer.setAttribute('aria-hidden', 'true');
    layer.innerHTML = '<span class="g-m-return-crest"></span>';
    document.body.append(layer);
    returnLayer = layer;
    cue('back');
    const frames = {
      wave: [{ opacity: 1, transform: 'translate3d(0,0,0)' }, { opacity: 0, transform: 'translate3d(0,-2%,0)' }],
      depth: [{ opacity: 1, transform: 'scale(1.03)' }, { opacity: 0, transform: 'scale(1)' }],
      flash: [{ opacity: 1 }, { opacity: 0 }],
      wipe: [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }],
      ambient: [{ opacity: 1, transform: 'scale(1.02)' }, { opacity: 0, transform: 'scale(1)' }],
      fade: [{ opacity: 1 }, { opacity: 0 }],
      metro: [{ transform: 'translate3d(0,0,0)', opacity: 1 }, { transform: 'translate3d(-100%,0,0)', opacity: 1 }]
    }[value.kind] || [{ opacity: 1 }, { opacity: 0 }];
    try {
      const animation = layer.animate(frames, { duration: value.ms, easing: table().easing, fill: 'forwards' });
      track(animation);
      animation.finished.catch(() => {}).then(() => { layer.remove(); if (returnLayer === layer) returnLayer = null; });
    } catch { setTimeout(() => layer.remove(), value.ms); }
    return true;
  }
  // app.js already refreshes state.activeGameSession on focus; read that rather than adding another IPC poll.
  setInterval(() => {
    if (!isConsole() || document.hidden) return;
    const id = state.activeGameSession?.gameId || null;
    if (lastSession && !id && document.hasFocus()) returnSequence();
    lastSession = id;
  }, 2000);

  // ---------- Public API ----------
  window.gMotion = {
    table, ms, enter, exit, allowed,
    boot: () => runStartupSequence({}),
    launch: () => launchSequence(),
    return: () => returnSequence(),
    stats,
    pause: pauseAll,
    stop: stopAll
  };

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
