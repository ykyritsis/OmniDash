// Review helper (theme-review.cjs): paints stand-in cover and hero art for the demo games, so screens can be
// judged with artwork in place. Never loaded by the app itself.
(() => {
  const paint = (title, hue, w, h, hero) => {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const c = canvas.getContext('2d');
    const g = c.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue}, 70%, ${hero ? 32 : 42}%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360}, 65%, ${hero ? 10 : 16}%)`);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      c.fillStyle = `hsla(${(hue + i * 25) % 360}, 80%, 60%, .18)`;
      c.beginPath(); c.arc(w * ((i * 37) % 100) / 100, h * ((i * 53) % 100) / 100, Math.max(w, h) * (.12 + i * .03), 0, Math.PI * 2); c.fill();
    }
    if (!hero) {
      c.fillStyle = '#fff'; c.font = `800 ${Math.round(w / 9)}px Segoe UI`; c.textAlign = 'center';
      title.toUpperCase().split(' ').slice(0, 3).forEach((word, i) => c.fillText(word, w / 2, h * .72 + i * w / 8.5));
    }
    return canvas.toDataURL('image/jpeg', .82);
  };
  state.games.forEach((game, index) => {
    const hue = (index * 67 + 20) % 360;
    const square = paint(game.title, hue, 400, 400), wide = paint(game.title, hue, 1600, 900, true);
    // Like a real library: some games' hero is a square cover, with the wallpaper only among the screenshots.
    game.artwork = index % 2 ? { ...(game.artwork || {}), tile: square, grid: square, hero: square, wide: square, screenshots: [wide] } : { ...(game.artwork || {}), tile: square, grid: paint(game.title, hue, 400, 600), hero: wide, wide: paint(game.title, hue, 920, 430, true) };
  });
  renderLibrary();
  if (state.selectedGameId) selectGame(state.selectedGameId, false);
})();
