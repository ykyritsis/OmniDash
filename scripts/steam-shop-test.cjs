const assert=require('node:assert/strict');
const { allowedStoreUrl,storeDestination }=require('../src/steam-shop.cjs');
for(const url of ['https://store.steampowered.com/app/1245620/','https://login.steampowered.com/jwt/finalizelogin','https://steamcommunity.com/login/home/']) assert.equal(allowedStoreUrl(url),true,url);
for(const url of ['file:///C:/Windows/win.ini','javascript:alert(1)','http://store.steampowered.com','https://store.steampowered.com.evil.test/','https://store.steampowered.com@evil.test/','https://user:pass@store.steampowered.com/','steam://install/1','not a url']) assert.equal(allowedStoreUrl(url),false,url);
assert.equal(storeDestination('cart'),'https://store.steampowered.com/cart/');
assert.equal(storeDestination(1245620),'https://store.steampowered.com/app/1245620/');
assert.throws(()=>storeDestination('../login'));
console.log('PASS Steam destination validation, protocol and hostname boundaries');
