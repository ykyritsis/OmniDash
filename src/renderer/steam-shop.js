const steamShopSurface = document.querySelector('#steam-shop');
let steamShopOpener;
async function openSteamShop(destination = 'home') {
  steamShopOpener ||= document.activeElement;
  steamShopSurface.hidden = false;
  document.querySelector('#steam-shop-status').textContent = 'Connecting to Steam…';
  try { await window.launcher.openShop(destination); }
  catch(error) {
    document.querySelector('#steam-shop-status').textContent = error.message || 'Store unavailable';
    setFocusedElement(steamShopSurface.querySelector('[data-action="console-shop-close"]'),{scroll:false});
  }
}
window.launcher.onShopState(status => {
  steamShopSurface.hidden = !status.open;
  document.querySelector('#steam-shop-status').textContent = status.error || (status.loading ? 'Loading Steam…' : 'Secure Steam session · Steam manages your account and cart');
  steamShopSurface.classList.toggle('loading',status.loading);
  steamShopSurface.querySelector('[data-action="console-shop-back"]').disabled = !status.canGoBack;
  if(!status.open) { const opener=steamShopOpener;steamShopOpener=null;if(opener?.isConnected)setFocusedElement(opener,{scroll:false}); }
});
