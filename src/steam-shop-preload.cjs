// This remote renderer receives no launcher, filesystem, or account-token API.
const { ipcRenderer } = require('electron');
let held = false, nextMove = 0, armed = false;
function move(direction) {
  const candidates = [...document.querySelectorAll('a[href],button,input,select,[role="button"],[tabindex="0"]')]
    .filter(node => !node.disabled && node.getBoundingClientRect().width && node.getBoundingClientRect().height && getComputedStyle(node).visibility !== 'hidden');
  if (!candidates.length) return;
  const current = document.activeElement;
  if (!candidates.includes(current)) { candidates[0].focus(); return; }
  const rect = current.getBoundingClientRect(), x = rect.x + rect.width/2, y = rect.y + rect.height/2;
  const ranked = candidates.filter(node => node!==current).map(node => {
    const r = node.getBoundingClientRect(), dx = r.x+r.width/2-x, dy = r.y+r.height/2-y;
    const primary = direction==='left' ? -dx : direction==='right' ? dx : direction==='up' ? -dy : dy;
    return {node,score:primary>4 ? primary+Math.abs(direction==='left'||direction==='right'?dy:dx)*3 : Infinity};
  }).filter(item=>Number.isFinite(item.score)).sort((a,b)=>a.score-b.score);
  if(ranked[0]) { ranked[0].node.focus(); ranked[0].node.scrollIntoView({block:'nearest',behavior:'smooth'}); }
}
setInterval(() => {
  if(document.hidden || !document.hasFocus()) { held=false; armed=false; return; }
  const pad = [...navigator.getGamepads()].find(pad=>pad?.connected && pad.mapping==='standard' && pad.buttons.length>=12);
  if(!pad) { armed=false; return; }
  const a=pad.buttons[0]?.pressed, b=pad.buttons[1]?.pressed;
  // Release the dashboard's opening press before enabling remote-page actions.
  if(!armed) { if(!a&&!b)armed=true; return; }
  if(b&&!held) ipcRenderer.send('shop:remote-command','close');
  else if(a&&!held && document.activeElement!==document.body) document.activeElement?.click();
  held=a||b;
  const direction=pad.buttons[12]?.pressed||pad.axes[1]<-.6?'up':pad.buttons[13]?.pressed||pad.axes[1]>.6?'down':pad.buttons[14]?.pressed||pad.axes[0]<-.6?'left':pad.buttons[15]?.pressed||pad.axes[0]>.6?'right':null;
  if(!direction) nextMove=0;
  else if(performance.now()>nextMove) { move(direction); nextMove=performance.now()+180; }
},80);
