// Focus scrolling, done the way a console does it. Rows (sideways) and the page (up and down) follow
// the focused item smoothly: each frame closes a fixed share of the remaining distance, so a moving
// target is followed without restarts, and a held stick glides at the stick's own pace. The focused
// item is never left off screen while the scroll catches up (the cause of getting "lost" before).
// This replaces the browser's scrollIntoView, which also tried to scroll the page sideways.
const gMotion = new Map();
// Time constant of the follow: about 95% of the way in 3× this. Repeats follow tighter.
const gFollow = { press: 55, repeat: 32 };
function gAnimateScroll(element, axis, target, duration) {
  const key = axis === 'x' ? 'scrollLeft' : 'scrollTop';
  const max = axis === 'x' ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight;
  const goal = Math.max(0, Math.min(max, Math.round(target)));
  const reduce = document.documentElement.classList.contains('reduce-motion');
  let entry = gMotion.get(element);
  if (!entry) { entry = {}; gMotion.set(element, entry); }
  const running = entry[axis];
  if (reduce || !duration) { if (running) cancelAnimationFrame(running.frame); delete entry[axis]; element[key] = goal; return; }
  const tau = duration <= 120 ? gFollow.repeat : duration >= 220 ? 70 : gFollow.press;
  if (running) { running.goal = goal; running.tau = tau; return; }
  if (Math.abs(goal - element[key]) < 1) return;
  const motion = { goal, tau, pos: element[key], last: performance.now(), frame: 0 };
  entry[axis] = motion;
  const step = now => {
    if (entry[axis] !== motion) return;
    const dt = Math.min(48, Math.max(1, now - motion.last));
    motion.last = now;
    // Someone else scrolled it (wheel, touch, a re-render): follow from there.
    if (Math.abs(element[key] - motion.pos) > 2) motion.pos = element[key];
    motion.pos += (motion.goal - motion.pos) * (1 - Math.exp(-dt / motion.tau));
    if (Math.abs(motion.goal - motion.pos) < .5) { element[key] = motion.goal; delete entry[axis]; return; }
    element[key] = motion.pos;
    motion.frame = requestAnimationFrame(step);
  };
  motion.frame = requestAnimationFrame(step);
}
// While the follow catches up, keep the focused item at least fully on screen right now.
function gKeepVisible(scroller, axis, start, end) {
  const key = axis === 'x' ? 'scrollLeft' : 'scrollTop';
  const size = axis === 'x' ? scroller.clientWidth : scroller.clientHeight;
  const now = scroller[key];
  let fixed = now;
  if (start < now) fixed = start;
  else if (end > now + size) fixed = Math.min(start, end - size);
  if (fixed === now) return;
  scroller[key] = fixed;
  const motion = gMotion.get(scroller)?.[axis];
  if (motion) motion.pos = scroller[key];
}
function gScrollParent(element, axis) {
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    const overflow = axis === 'x' ? style.overflowX : style.overflowY;
    const scrollable = axis === 'x' ? node.scrollWidth > node.clientWidth + 1 : node.scrollHeight > node.clientHeight + 1;
    if (scrollable && /(auto|scroll)/.test(overflow)) return node;
  }
  return null;
}
// Where the scroller would be once its current animation lands, so quick presses aim from the right place.
function gScrollGoal(element, axis) {
  const state = gMotion.get(element)?.[axis];
  return state ? state.goal : axis === 'x' ? element.scrollLeft : element.scrollTop;
}
function gRevealFocused(element) {
  const duration = state.navRepeat ? 120 : 180;
  // Sideways: the row the item is in. The page itself never scrolls sideways.
  const row = gScrollParent(element, 'x');
  if (row && row !== document.querySelector('main')) {
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
    const isMain = page === document.querySelector('main');
    const topPad = isMain ? Math.max(110, innerHeight * .14) : 24, bottomPad = isMain ? 90 : 24;
    let target = goal;
    // Reaching the first row under the header (or the header area) shows the very top of the page.
    if (isMain && (element.closest('#recent-row') || element.closest('.g-library-tabs-row') || element.closest('.console-library-nav'))) target = 0;
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
// Shoulder buttons page up and down with the same easing.
window.gPageScroll = direction => {
  const main = document.querySelector('main');
  gAnimateScroll(main, 'y', gScrollGoal(main, 'y') + direction * innerHeight * .75, 220);
};
