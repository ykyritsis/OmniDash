// Store and Game Pass in the console themes: both consoles open the Store on a large featured banner
// before the rows of games. The banner shows the first game of the current list (its art, name and price)
// and opens it like its card does. Helix keeps Garrison's plain grid.
(() => {
  const view = document.querySelector('#store-view');
  const grid = document.querySelector('#console-store-grid');
  if (!view || !grid) return;
  const theme = () => document.body.dataset.gTheme || 'helix';
  const banner = document.createElement('button');
  banner.id = 'g-store-hero';
  banner.className = 'focusable';
  banner.type = 'button';
  banner.hidden = true;
  banner.innerHTML = '<span class="g-hero-back"></span><span class="g-hero-cover"></span><span class="g-hero-copy"><em>Featured</em><strong></strong><small></small><b>View details</b></span>';
  (view.querySelector('.g-store-toolbar') || grid).before(banner);

  let featured = null;
  function render() {
    const card = grid.querySelector('.g-store-card');
    const image = card?.querySelector('.g-store-art img')?.getAttribute('src') || '';
    featured = card || null;
    banner.hidden = theme() === 'helix' || !card;
    if (banner.hidden) return;
    const safe = image.replaceAll('"', '%22');
    banner.style.setProperty('--g-hero-art', image ? `url("${safe}")` : 'none');
    banner.querySelector('strong').textContent = card.querySelector('.g-card-text strong')?.textContent || '';
    banner.querySelector('small').textContent = card.querySelector('.g-card-text small')?.textContent || '';
    const tab = document.querySelector('.console-store-tabs .active')?.textContent.trim();
    banner.querySelector('em').textContent = tab ? `Featured · ${tab}` : 'Featured';
    banner.setAttribute('aria-label', `Featured: ${banner.querySelector('strong').textContent}`);
  }
  // The banner opens the same game its card would.
  banner.addEventListener('click', () => { featured?.click(); });
  new MutationObserver(render).observe(grid, { childList: true });
  new MutationObserver(render).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  render();
})();
