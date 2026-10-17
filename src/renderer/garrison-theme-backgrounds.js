// Backgrounds for the console themes, the way the consoles let you dress the dashboard.
//
//  - Default: the theme's own (the Series' game art and swirl, the One's planet, the 360's grey studio).
//  - Game art: your last game's key art fills the dashboard, like the One's "use game art" option.
//  - Dashboard themes from the DashX360 pack (Halo 4, Batman, and the rest), when installed. On the 360 a theme
//    has a picture per pivot (home, games, apps, settings), as the console's theme packs did.
//  - Your own picture, kept on this PC (resized to 1920 x 1080 and stored with the launcher's local data).
// Choices are per theme and stored locally.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const wall = document.querySelector('#g-theme-wall');
  if (!wall) return;
  const layer = document.createElement('div');
  layer.className = 'g-wall-image';
  wall.append(layer);
  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const write = (key, value) => { try { value ? localStorage.setItem(key, value) : localStorage.removeItem(key); return true; } catch { return false; } };
  const choice = () => read(`g-bg:${theme()}`) || 'default';
  let pack = window.gThemePack || null;

  async function lastGameArt() {
    const game = typeof homeRecentGames === 'function' ? homeRecentGames()[0] : null;
    if (!game) return '';
    return typeof window.gThemeBackdrop === 'function' ? await window.gThemeBackdrop(game) : (game.artwork?.hero || game.artwork?.wide || '');
  }
  // Which picture a pack theme shows for the page you're on.
  function packImage(id) {
    const item = pack?.themes?.find(entry => entry.id === id);
    if (!item) return '';
    if (document.querySelector('#settings-dialog[open]')) return item.settings || item.home;
    if (document.body.classList.contains('library-active')) return item.games || item.home;
    if (document.body.classList.contains('store-active')) return item.apps || item.home;
    return item.home;
  }
  let token = 0;
  async function apply() {
    const mine = ++token;
    const pick = theme() === 'helix' ? 'default' : choice();
    let url = '';
    if (pick === 'game') url = await lastGameArt();
    else if (pick === 'custom') url = read(`g-bg-custom:${theme()}`);
    else if (pick.startsWith('pack:')) url = packImage(pick.slice(5));
    if (mine !== token) return;
    if (url) {
      layer.style.backgroundImage = `url("${url.replaceAll('"', '%22')}")`;
      document.body.dataset.gBg = pick.startsWith('pack:') ? 'pack' : pick;
    } else {
      layer.style.backgroundImage = '';
      delete document.body.dataset.gBg;
    }
  }

  // ---------- Appearance: the Background picker ----------
  const section = document.createElement('section');
  section.className = 'g-setting-group g-bg-section';
  section.innerHTML = '<h3>Background</h3><p class="g-setting-note"></p><div class="g-bg-options" role="radiogroup" aria-label="Background"></div><input type="file" accept="image/png,image/jpeg,image/webp" hidden />';
  document.querySelector('.g-theme-section')?.after(section);
  const options = section.querySelector('.g-bg-options'), file = section.querySelector('input');
  function renderPicker() {
    section.hidden = theme() === 'helix';
    if (section.hidden) return;
    const names = { series: 'Game art and the green swirl', one: 'The planet horizon', x360: 'The grey studio' };
    const items = [['default', names[theme()] || 'Default', ''], ...(theme() === 'series' ? [] : [['game', 'Your last game', '']]),
      ...(pack?.themes || []).map(item => [`pack:${item.id}`, item.name, item.home]), ['custom', read(`g-bg-custom:${theme()}`) ? 'Your picture' : 'Choose a picture…', read(`g-bg-custom:${theme()}`)]];
    section.querySelector('.g-setting-note').textContent = pack?.available
      ? `Dress the dashboard. Dashboard themes from ${pack.credit}.`
      : 'Dress the dashboard with game art or your own picture.';
    const current = choice();
    options.innerHTML = items.map(([id, label, image]) => `<button class="g-bg-option focusable${id === current ? ' on' : ''}" type="button" role="radio" aria-checked="${id === current}" data-g-bg="${id}">
      <span class="g-bg-thumb"${image ? ` style="background-image:url(&quot;${image.replaceAll('"', '%22')}&quot;)"` : ''} data-kind="${id.split(':')[0]}"></span><span>${label}</span></button>`).join('');
  }
  options.addEventListener('click', event => {
    const option = event.target.closest('[data-g-bg]');
    if (!option) return;
    const id = option.dataset.gBg;
    if (id === 'custom' && !read(`g-bg-custom:${theme()}`)) { file.click(); return; }
    write(`g-bg:${theme()}`, id === 'default' ? '' : id);
    renderPicker(); apply();
    setFocusedElement?.(options.querySelector(`[data-g-bg="${CSS.escape(id)}"]`), { scroll: false });
  });
  // A long press of A or a second press on "Your picture" swaps it; the menu key also lets you pick again.
  options.addEventListener('contextmenu', event => { if (event.target.closest('[data-g-bg="custom"]')) { event.preventDefault(); file.click(); } });
  file.addEventListener('change', () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (!chosen) return;
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, 1920 / image.naturalWidth, 1080 / image.naturalHeight) || 1;
        canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', .86);
        if (!write(`g-bg-custom:${theme()}`, data)) { if (typeof showToast === 'function') showToast('That picture is too large to keep. Try a smaller one.'); return; }
        write(`g-bg:${theme()}`, 'custom');
        renderPicker(); apply();
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(chosen);
  });

  document.addEventListener('g-theme-pack', ({ detail }) => { pack = detail; renderPicker(); apply(); });
  new MutationObserver(() => { renderPicker(); apply(); }).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  // Pack themes follow the page; game art follows your last game.
  new MutationObserver(() => { if (choice().startsWith('pack:')) apply(); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.querySelector('#settings-dialog')?.addEventListener('toggle', () => { if (choice().startsWith('pack:')) apply(); });
  if (typeof renderRecentGames === 'function') {
    const base = renderRecentGames;
    renderRecentGames = function (...args) { const result = base.apply(this, args); if (choice() === 'game') apply(); return result; };
  }
  renderPicker(); apply();
})();
