// PC Gamerscore without a Steam Web API key: main's gamerscore:local reads Steam's own achievement cache on this
// PC (src/local-gamerscore.cjs gives every game 1,000 G, shared by rarity in multiples of 5). The result fills the
// Gamerscore everywhere the launcher shows it whenever the key-based sync has not produced a score, and a new
// unlock since the last look pops the console's "Achievement unlocked" toast with its points.
(() => {
  'use strict';
  if (typeof window.launcher?.getLocalGamerscore !== 'function') return;
  const SEEN_KEY = 'g-local-score-seen';
  let result = null;
  let timer = 0;
  const officialScore = () => { try { return typeof playerScore !== 'undefined' && playerScore?.checked ? playerScore : null; } catch { return null; } };

  function paint() {
    if (!result?.available || officialScore()) return;
    const value = document.querySelector('#profile-score-value');
    const text = result.points.toLocaleString();
    if (value && value.textContent !== text) value.textContent = text;
    const header = document.querySelector('#dashboard-player-status');
    if (header && !header.textContent.includes(text)) header.innerHTML = `<span class="preview-score-mark" aria-hidden="true">G</span> ${text}<span class="preview-score-caption">PC Gamerscore</span>`;
  }
  function announce(previousAt) {
    if (!previousAt || typeof showToast !== 'function') return;
    const fresh = result.games.flatMap(game => game.recent.filter(item => item.at > previousAt).map(item => ({ ...item, game: game.title })))
      .sort((a, b) => a.at - b.at).slice(-3);
    fresh.forEach((item, index) => setTimeout(() => showToast(`Achievement unlocked · ${item.points}G · ${item.name}`), index * 3200));
  }
  async function load() {
    clearTimeout(timer);
    if (document.hidden) { timer = setTimeout(load, 60000); return; }
    try {
      result = await window.launcher.getLocalGamerscore();
      window.gLocalScore = result;
      const latest = result.games.reduce((max, game) => Math.max(max, game.lastUnlock || 0), 0);
      let seen = 0;
      try { seen = Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { /* Storage unavailable. */ }
      if (latest > seen) { announce(seen); try { localStorage.setItem(SEEN_KEY, String(latest)); } catch { /* Fine. */ } }
      paint();
      document.dispatchEvent(new CustomEvent('g-local-score', { detail: result }));
    } catch { /* Steam is not installed or its cache is unreadable: the key-based score still works. */ }
    // While unlock rates are still arriving the score settles over a minute or so; after that a light refresh.
    timer = setTimeout(load, result?.pending ? 20000 : 5 * 60 * 1000);
  }
  // The key-based profile repaints the same fields; put the local score back when it has none of its own.
  window.addEventListener('player-score-updated', () => setTimeout(paint, 0));
  window.addEventListener('focus', () => { if (!result || Date.now() - (load.at || 0) > 60000) { load.at = Date.now(); load(); } });
  setTimeout(load, 1500);
  window.gRefreshLocalScore = load;
})();
