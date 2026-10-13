// Focus scrolling, done the way a console does it. Rows (sideways) and the page (up and down) follow
// the focused item smoothly: each frame closes a fixed share of the remaining distance, so a moving
// target is followed without restarts, and a held stick glides at the stick's own pace. The focused
// item is never left off screen while the scroll catches up.
// All writes are instant: the stylesheet's smooth scrolling is off here, because a browser smooth
// scroll started on every frame crawls (that was the slow, stuck page). The browser's scrollIntoView
// also tried to scroll the page sideways, so it isn't used either.
document.head.insertAdjacentHTML('beforeend', '<style id="g-motion-style">body.garrison main, body.garrison .game-row, body.garrison .detail-gallery, body.garrison .collection-covers, body.garrison .library-grid { scroll-behavior: auto !important; }</style>');
const gMotion = new Map();
// A critically damped spring (no overshoot): it starts at once but builds speed, then glides in, and a
// new press keeps the current speed instead of restarting. Stiffness in rad/s: about 95% of the way
// in 4.7 ÷ this, so 17 ≈ 280 ms for a press. Held repeats follow tighter so the page keeps up.
const gFollow = { press: 17, repeat: 24, page: 13 };
function gSetScroll(element, axis, value) {
  element.scrollTo(axis === 'x' ? { left: value, behavior: 'instant' } : { top: value, behavior: 'instant' });
}
function gStopScroll(element, axis) {
  const entry = gMotion.get(element);
  if (!entry) return;
  for (const name of axis ? [axis] : ['x', 'y']) { if (entry[name]) cancelAnimationFrame(entry[name].frame); delete entry[name]; }
}
function gStopAllScrolls() { for (const element of gMotion.keys()) gStopScroll(element); gMotion.clear(); }
function gAnimateScroll(element, axis, target, duration) {
  const key = axis === 'x' ? 'scrollLeft' : 'scrollTop';
  const max = axis === 'x' ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight;
  const goal = Math.max(0, Math.min(max, Math.round(target)));
  const reduce = document.documentElement.classList.contains('reduce-motion');
  let entry = gMotion.get(element);
  if (!entry) { entry = {}; gMotion.set(element, entry); }
  const running = entry[axis];
  if (reduce || !duration) { gStopScroll(element, axis); gSetScroll(element, axis, goal); return; }
  const omega = duration <= 120 ? gFollow.repeat : duration >= 220 ? gFollow.page : gFollow.press;
  if (running) { running.goal = goal; running.omega = omega; return; }
  if (Math.abs(goal - element[key]) < 1) return;
  const motion = { goal, omega, pos: element[key], vel: 0, set: element[key], last: performance.now(), frame: 0 };
  entry[axis] = motion;
  const step = now => {
    if (entry[axis] !== motion) return;
    // Something else moved it (a wheel, a re-render, a new page): stop, rather than fight it.
    if (Math.abs(element[key] - motion.set) > 3 || !element.isConnected) { delete entry[axis]; return; }
    let dt = Math.min(48, Math.max(1, now - motion.last)) / 1000;
    motion.last = now;
    // Small fixed steps keep the spring stable on slow frames.
    while (dt > 0) {
      const h = Math.min(dt, .008);
      const accel = motion.omega * motion.omega * (motion.goal - motion.pos) - 2 * motion.omega * motion.vel;
      motion.vel += accel * h;
      motion.pos += motion.vel * h;
      dt -= h;
    }
    const done = Math.abs(motion.goal - motion.pos) < .5 && Math.abs(motion.vel) < 20;
    gSetScroll(element, axis, done ? motion.goal : motion.pos);
    motion.set = element[key];
    if (done) { delete entry[axis]; return; }
    motion.frame = requestAnimationFrame(step);
  };
  motion.frame = requestAnimationFrame(step);
}
// While a held direction races ahead of the spring, keep the focused item at least fully on screen.
// Single presses never jump: the spring carries the whole distance.
function gKeepVisible(scroller, axis, start, end) {
  if (!state.navRepeat) return;
  const key = axis === 'x' ? 'scrollLeft' : 'scrollTop';
  const size = axis === 'x' ? scroller.clientWidth : scroller.clientHeight;
  const now = scroller[key];
  let fixed = now;
  if (start < now) fixed = start;
  else if (end > now + size) fixed = Math.min(start, end - size);
  if (Math.abs(fixed - now) < 1) return;
  gSetScroll(scroller, axis, fixed);
  const motion = gMotion.get(scroller)?.[axis];
  if (motion) { motion.pos = scroller[key]; motion.set = scroller[key]; }
}
function gScrollParent(element, axis) {
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const scrollable = axis === 'x' ? node.scrollWidth > node.clientWidth + 1 : node.scrollHeight > node.clientHeight + 1;
    if (!scrollable) continue;
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(axis === 'x' ? style.overflowX : style.overflowY)) return node;
  }
  return null;
}
// Where the scroller is headed, so quick presses aim from the right place.
function gScrollGoal(element, axis) {
  const motion = gMotion.get(element)?.[axis];
  return motion ? motion.goal : axis === 'x' ? element.scrollLeft : element.scrollTop;
}
function gRevealFocused(element) {
  const duration = state.navRepeat ? 120 : 180;
  // Sideways: the row the item is in. The page itself never scrolls sideways.
  const main = document.querySelector('main');
  const row = gScrollParent(element, 'x');
  if (row && row !== main) {
    const box = row.getBoundingClientRect(), item = element.getBoundingClientRect();
    const current = row.scrollLeft, goal = gScrollGoal(row, 'x');
    const left = item.left - box.left + current, right = left + item.width;
    const pad = Math.min(box.width * .08, 96);
    let target = goal;
    if (left - pad < goal) target = left - pad;
    else if (right + pad > goal + box.width) target = right + pad - box.width;
    gKeepVisible(row, 'x', left, right);
    gAnimateScroll(row, 'x', target, duration);
  }
  // Up and down: the nearest vertical scroller (the page, or a dialog's list).
  const page = gScrollParent(element, 'y');
  if (page) {
    const box = page.getBoundingClientRect(), item = element.getBoundingClientRect();
    const current = page.scrollTop, goal = gScrollGoal(page, 'y');
    const top = item.top - box.top + current, bottom = top + item.height;
    const isMain = page === main;
    const topPad = isMain ? Math.max(110, innerHeight * .14) : 24, bottomPad = isMain ? 90 : 24;
    let target = goal;
    // The first row under the header (or the header area, or a game page's top) shows the very top of the page.
    if (isMain && (element.closest('#recent-row') || element.closest('.g-library-tabs-row') || element.closest('.console-library-nav') || element.closest('.g-library-toolbar') || element.closest('#g-source-chips') || element.closest('.detail-actions') || element.id === 'detail-play')) target = 0;
    else if (top - topPad < goal) target = top - topPad;
    else if (bottom + bottomPad > goal + box.height) target = bottom + bottomPad - box.height;
    if (target !== 0) gKeepVisible(page, 'y', top, bottom);
    gAnimateScroll(page, 'y', target, duration);
  }
}
const gMotionFocus = setFocusedElement;
setFocusedElement = function (element, options = {}) {
  if (!element || options.scroll === false) return gMotionFocus(element, options);
  const result = gMotionFocus(element, { ...options, scroll: false });
  if (document.activeElement === element || element.classList.contains('focused')) {
    if (element.closest('.topbar')) { const main = document.querySelector('main'); if (main.scrollTop > 0 && !topmostOpenDialog()) gAnimateScroll(main, 'y', 0, 180); }
    else gRevealFocused(element);
  }
  return result;
};
// A new page starts still and at its own top; nothing carries over from the last one.
const gMotionShowView = showView;
showView = function (...args) { gStopAllScrolls(); return gMotionShowView.apply(this, args); };
const gMotionOpenDetails = openGameDetails;
openGameDetails = function (...args) {
  gStopAllScrolls();
  const result = gMotionOpenDetails.apply(this, args);
  const main = document.querySelector('main');
  if (state.view === 'detail' && main) gSetScroll(main, 'y', 0);
  return result;
};
// The wheel, touch or a drag takes over at once.
for (const type of ['wheel', 'touchstart', 'pointerdown']) addEventListener(type, () => gStopAllScrolls(), { passive: true, capture: true });
// Shoulder buttons page up and down with the same easing.
window.gPageScroll = direction => {
  const main = document.querySelector('main');
  gAnimateScroll(main, 'y', gScrollGoal(main, 'y') + direction * innerHeight * .75, 220);
};
