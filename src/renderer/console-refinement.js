// Console page composition. Existing import, launch and metadata services remain
// authoritative; this layer never manufactures account progress or install state.
let profileLoadId = 0;
let selectedDetailTab = 'overview';
const installTracking = new Map();
let installTimer;
let installPollRunning = false;
let installDialogGameId = '';
const achievementProfileCache = new Map();
// Keep hero art in the page's scroll context so it fades away with the hero,
// rather than shining through every metadata panel further down the page.
document.querySelector('#game-detail-view').prepend(document.querySelector('.detail-global-art-stack'));
const detailWordmarkFrame = document.createElement('div');
detailWordmarkFrame.id = 'detail-logo-frame';
detailWordmarkFrame.hidden = true;
const detailWordmarkImage = document.querySelector('#detail-logo');
detailWordmarkImage.before(detailWordmarkFrame);
detailWordmarkFrame.append(detailWordmarkImage);
document.querySelector('.detail-actions').before(document.querySelector('#detail-rating'));

function fitDetailWordmark() {
  const box = detailWordmarkFrame.getBoundingClientRect();
  if (!box.width || !box.height) return;
  const bounds = logoBounds.get(detailWordmarkImage.getAttribute('src'));
  if (!bounds) { detailWordmarkImage.style.cssText = ''; return; }
  const width = bounds.right - bounds.left, height = bounds.bottom - bounds.top;
  const visibleRatio = bounds.ratio * width / height;
  const visibleWidth = Math.min(box.width, box.height * visibleRatio);
  const visibleHeight = visibleWidth / visibleRatio;
  // CSS framing only. The original source artwork is left untouched.
  detailWordmarkImage.style.cssText = `width:${visibleWidth / width}px;height:${visibleHeight / height}px;left:${-bounds.left * visibleWidth / width}px;top:${(box.height - visibleHeight) / 2 - bounds.top * visibleHeight / height}px;`;
}
new ResizeObserver(fitDetailWordmark).observe(detailWordmarkFrame);

function hoursLabel(minutes) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(Math.max(0, minutes || 0) / 60);
}

function selectDetailTab(tab = 'overview', scroll = false) {
  if (!['overview', 'media', 'achievements', 'dlc', 'updates'].includes(tab)) return;
  selectedDetailTab = tab;
  const sections = { overview: ['.detail-overview', '.detail-info', '.detail-capabilities'], media: ['[aria-labelledby="gallery-heading"]'], achievements: ['.detail-achievements'], dlc: ['.detail-dlc'], updates: ['#news-shelf'] };
  document.querySelectorAll('.detail-content > section').forEach(section => {
    section.dataset.detailVisible = String(sections[tab].some(selector => section.matches(selector)));
  });
  document.querySelectorAll('#detail-tabs button').forEach(button => {
    const active = button.dataset.tab === tab;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  if (scroll) {
    const scroller = document.querySelector('main');
    const tabs = document.querySelector('#detail-tabs');
    scroller.scrollTo({ top: scroller.scrollTop + tabs.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24,
      behavior: document.documentElement.classList.contains('reduce-motion') ? 'instant' : 'smooth' });
  }
  refreshFocusables();
}

function prepareConsoleGamePage(game) {
  selectDetailTab('overview');
  document.querySelector('#detail-updates-tab').hidden = game.provider !== 'Steam' || game.discoveryOnly;
  renderDetailInputMethods(game);
  hydrateConsoleIcons(document.querySelector('#game-detail-view'));
}

async function loadSteamProfile() {
  const request = ++profileLoadId;
  const games = state.games.filter(game => game.provider === 'Steam' && game.appId && !game.isApp);
  const render = entries => {
    document.querySelector('#profile-library-count').textContent = String(entries.length);
    document.querySelector('#profile-installed-count').textContent = hoursLabel(entries.reduce((total, game) => total + (game.steamPlaytimeMinutes || 0), 0));
    document.querySelector('#profile-launch-count').textContent = String(entries.filter(game => game.steamPlaytimeMinutes > 0).length);
    const top = [...entries].filter(game => game.steamPlaytimeMinutes > 0).sort((a, b) => b.steamPlaytimeMinutes - a.steamPlaytimeMinutes).slice(0, 4);
    const target = document.querySelector('#profile-recent-games');
    target.innerHTML = top.length ? top.map(game => `<button class="profile-recent-game focusable" data-action="profile-game" data-game-id="${escapeHtml(game.id)}"><span class="profile-recent-art">${gameArt(game)}</span><span class="profile-recent-copy"><strong>${escapeHtml(game.title)}</strong><small>${hoursLabel(game.steamPlaytimeMinutes)} hours played</small></span></button>`).join('')
      : `<div class="profile-empty"><div class="profile-empty-art" aria-hidden="true">${games.slice(0, 3).map(game => `<span>${gameArt(game)}</span>`).join('') || consoleIcon('controller')}</div><div class="profile-empty-copy"><strong>Your next favourite is waiting</strong><p>Steam playtime will appear here once it is available on this PC.</p><button class="focusable" data-action="profile-library">Browse your games</button></div></div>`;
    refreshFocusables();
    return top;
  };
  let top = render(games);
  const achievementRoot = document.querySelector('#profile-achievement-games');
  achievementRoot.innerHTML = '<p class="profile-empty-note">Checking Steam progress…</p>';
  document.querySelector('#profile-achievement-total').textContent = '';
  try {
    const result = await window.launcher.getSteamProfile();
    if (request !== profileLoadId || !avatarDialog.open) return;
    const ids = new Map(result.games.map(game => [game.id, game]));
    const visible = games.filter(game => ids.has(game.id)).map(game => ({ ...game, steamPlaytimeMinutes: ids.get(game.id).minutes }));
    top = render(visible);
    document.querySelector('#profile-stat-scope').textContent = result.scope;
    document.querySelector('#profile-data-note').textContent = result.localAvailable ? 'Playtime from Steam on this PC, supplemented by your linked account when available.' : 'Totals cover imported Steam games with available playtime. They are not launcher session counts.';
    if (!result.personalAchievements) {
      achievementRoot.innerHTML = `<div class="profile-achievement-empty">${consoleIcon('trophy')}<div><strong>Explore your achievements</strong><p>Open a game to browse its achievement art and goals. Personal unlock progress needs an optional Steam Web API key in Settings.</p></div><button class="secondary focusable" data-action="profile-settings">Steam settings</button></div>`;
      refreshFocusables();
      return;
    }
    if (!top.length) { achievementRoot.innerHTML = '<p class="profile-empty-note">Play a Steam game to start your activity overview.</p>'; return; }
    achievementRoot.innerHTML = top.map(game => `<button class="profile-achievement-row focusable" data-action="profile-game" data-game-id="${escapeHtml(game.id)}"><span class="profile-achievement-cover">${gameArt(game)}</span><span class="profile-achievement-copy"><strong>${escapeHtml(game.title)}</strong><small>Checking achievements…</small><span class="profile-achievement-track"><i></i></span></span><span class="profile-achievement-score">—</span></button>`).join('');
    let unlocked = 0, verifiedGames = 0;
    // Two requests at a time, only while the profile is open. Never scan the
    // whole account just to display its overview, nor poll achievements.
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(2, top.length) }, async () => {
      while (next < top.length && request === profileLoadId && avatarDialog.open) {
        const game = top[next++];
        let data = achievementProfileCache.get(game.id);
        if (!data || Date.now() - data.at > 5 * 60 * 1000) {
          data = { ...await window.launcher.getGameAchievements(game.id).catch(() => ({ items: [] })), at: Date.now() };
          if (data.progressAvailable) {
            achievementProfileCache.set(game.id, data);
            // Entries hold a full achievement list per game, so keep the same bound the other
            // caches in this app use instead of growing for the life of the process.
            while (achievementProfileCache.size > 64) achievementProfileCache.delete(achievementProfileCache.keys().next().value);
          }
        }
        if (request !== profileLoadId || !avatarDialog.open) return;
        const row = [...achievementRoot.querySelectorAll('[data-game-id]')].find(node => node.dataset.gameId === game.id);
        if (!row) continue;
        const earned = data.unlockedCount ?? (data.items || []).filter(item => item.unlocked === true).length;
        const total = data.totalAvailable ?? data.items?.length ?? 0;
        row.querySelector('small').textContent = data.progressAvailable ? `${earned} of ${total} unlocked` : total ? 'Catalog available · progress private or unavailable' : 'No progress available';
        if (data.progressAvailable && total) {
          unlocked += earned; verifiedGames++;
          const percent = Math.round(earned / total * 100);
          row.querySelector('.profile-achievement-score').textContent = `${percent}%`;
          row.querySelector('i').style.width = `${percent}%`;
        }
        document.querySelector('#profile-achievement-total').textContent = verifiedGames ? `${unlocked} unlocked · ${verifiedGames} top games verified` : 'Personal progress unavailable';
      }
    }));
    refreshFocusables();
  } catch {
    achievementRoot.innerHTML = '<p class="profile-empty-note">Steam is unavailable. Your cached playtime is shown above.</p>';
  }
}

function renderInstallStatus(game, result) {
  if (installDialogGameId !== game.id) return;
  const progress = document.querySelector('#install-progress');
  if (result.percent === null || result.percent === undefined) progress.removeAttribute('value');
  else progress.value = result.percent;
  const labels = { waiting: 'Waiting for Steam confirmation', downloading: 'Downloading', installing: 'Installing game files', paused: 'Download paused in Steam', ready: 'Ready to play' };
  document.querySelector('#install-status').textContent = `${labels[result.state] || 'Checking installation'}${result.percent !== null && result.percent !== undefined && !result.installed ? ` · ${result.percent}%` : ''}`;
  document.querySelector('#install-help').textContent = result.installed ? 'Your game is installed. You can play now.' : result.state === 'waiting'
    ? 'Steam may need you to choose a drive, sign in, or accept this game’s agreement. Return here once you’ve confirmed.'
    : 'Steam is handling the download. You can keep browsing; progress is checked while this app is visible.';
  const button = document.querySelector('[data-action="install-steam"], [data-action="install-play"]');
  button.dataset.action = result.installed ? 'install-play' : 'install-steam';
  button.textContent = result.installed ? 'Play' : 'Open Steam installation';
}

async function pollSteamInstalls() {
  clearTimeout(installTimer);
  if (installPollRunning || document.hidden || !installTracking.size) return;
  installPollRunning = true;
  try {
    for (const [id, tracked] of installTracking) {
      if (Date.now() - tracked.at > 12 * 60 * 60 * 1000) { installTracking.delete(id); continue; }
      const result = await window.launcher.getSteamInstallStatus(id).catch(() => null);
      if (!result) continue;
      tracked.result = result;
      renderInstallStatus(tracked.game, result);
      if (result.installed) {
        tracked.game.installed = true;
        installTracking.delete(id);
        renderLibrary();
        if (state.detailGameId === id) document.querySelector('#detail-play').innerHTML = '<span class="detail-action-icon" aria-hidden="true">▶</span><strong>Play</strong>';
        showToast(`${tracked.game.title} is ready to play`);
      }
    }
  } finally {
    installPollRunning = false;
    // In the background (a game in front) progress is checked far less often; focus brings it back at once.
    if (installTracking.size && !document.hidden) installTimer = setTimeout(pollSteamInstalls, document.hasFocus() ? 2500 : 15000);
  }
}

function showSteamInstallation(game) {
  if (!game || game.provider !== 'Steam') return;
  if (gameOptionsDialog.open) gameOptionsDialog.close();
  installDialogGameId = game.id;
  installTracking.set(game.id, { game, at: Date.now() });
  document.querySelector('#install-title').textContent = game.title;
  document.querySelector('#install-cover').innerHTML = gameArt(game);
  renderInstallStatus(game, { state: 'waiting', percent: null });
  const dialog = document.querySelector('#install-dialog');
  if (!dialog.open) dialog.showModal();
  setFocusedElement(dialog.querySelector('.primary'), { scroll: false });
  pollSteamInstalls();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(installTimer);
  else pollSteamInstalls();
});
window.addEventListener('focus', () => { if (!installPollRunning) pollSteamInstalls(); });

function runStartupSequence(settings) {
  if (settings.startupAnimation === false) return;
  const screen = document.querySelector('#startup-screen');
  const reduced = settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
  screen.hidden = false;
  screen.classList.toggle('still', Boolean(reduced));
  const playStartup = () => { if (!screen.hidden && settings.soundEffects !== false) interfaceAudio.play('startup'); };
  if (document.hasFocus()) playStartup();
  else window.addEventListener('focus', playStartup, { once: true });
  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    screen.classList.add('leaving');
    setTimeout(() => { screen.hidden = true; }, reduced ? 0 : 300);
    window.removeEventListener('keydown', dismiss);
    window.removeEventListener('focus', playStartup);
    screen.removeEventListener('pointerdown', dismiss);
  };
  window.addEventListener('keydown', dismiss, { once: true });
  screen.addEventListener('pointerdown', dismiss, { once: true });
  setTimeout(dismiss, reduced ? 200 : 1900);
}

async function refinementAction(action, source) {
  if (action === 'detail-tab') { selectDetailTab(source.dataset.tab, true); return true; }
  if (action === 'install-close') { document.querySelector('#install-dialog').close(); return true; }
  if (action === 'install-steam') {
    try { await window.launcher.gameAction(installDialogGameId, 'view-steam-library'); }
    catch (error) { showToast(error.message); }
    return true;
  }
  if (action === 'install-play') {
    document.querySelector('#install-dialog').close();
    state.selectedGameId = installDialogGameId;
    await launchSelectedGame();
    return true;
  }
  return false;
}
