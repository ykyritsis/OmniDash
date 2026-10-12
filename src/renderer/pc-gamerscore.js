function renderPcScoreDetail(result) {
  document.querySelector('#pc-score-source').textContent=`Verified Steam achievements · ${result.checked||0} tracked games${result.lastSync?` · Updated ${new Date(result.lastSync).toLocaleDateString()}`:''}`;
  document.querySelector('#pc-score-games').innerHTML=(result.games||[]).length?result.games.map(game=>`<div class="pc-score-game"><span><strong>${escapeHtml(state.games.find(g=>g.appId===game.appId)?.title||game.title)}</strong><small>${game.unlocked} / ${game.total} achievements${game.completed?' · Completed':''}</small></span><progress max="${game.possible||1000}" value="${game.points}" aria-label="Game score progress"></progress><b>${game.points.toLocaleString()} / ${game.possible.toLocaleString()}</b></div>`).join(''):'<p>Link Steam and update your Gamerscore to see your games here.</p>';
}
const pcScoreCalculator=document.createElement('dialog');pcScoreCalculator.id='pc-score-calculator';pcScoreCalculator.className='pc-score-calculator';pcScoreCalculator.setAttribute('aria-labelledby','pc-score-calculator-title');
pcScoreCalculator.innerHTML=`<header><div><span class="eyebrow">PC GAMERSCORE</span><h2 id="pc-score-calculator-title">Every achievement counts.</h2><p>A game shares 1,000 points across its achievements. Try different unlocks and rarities to see how the score adds up.</p></div><button class="secondary focusable" type="button" data-score-close aria-label="Close calculator">Close</button></header><div class="score-calculator-summary"><strong id="score-calculator-earned">0</strong><span>earned / 1,000 possible</span><small id="score-calculator-completion"></small></div><div class="score-calculator-scroll"><table><thead><tr><th>Achievement</th><th>Players unlocked</th><th>You unlocked</th><th>Points</th><th></th></tr></thead><tbody id="score-calculator-rows"></tbody></table></div><footer><button class="secondary focusable" type="button" data-score-add>Add achievement</button><span>Calculator examples don’t change your earned Gamerscore.</span></footer>`;
document.body.append(pcScoreCalculator);
pcScoreCalculator.addEventListener('close',()=>{refreshFocusables();if(avatarDialog.open)setFocusedElement(document.querySelector('#pc-score-calculator-open'));});
let scoreCalculatorNext=5;
let scoreCalculatorRows=[{id:1,name:'First steps',percent:80,unlocked:true},{id:2,name:'Finish the story',percent:35,unlocked:true},{id:3,name:'Find every secret',percent:10,unlocked:false},{id:4,name:'Master the challenge',percent:1,unlocked:false}];
function updateScoreCalculator() {
  for(const row of pcScoreCalculator.querySelectorAll('[data-score-row]')) {const item=scoreCalculatorRows.find(item=>item.id===Number(row.dataset.scoreRow));item.name=row.querySelector('[data-score-name]').value;item.percent=row.querySelector('[data-score-rarity]').value;item.unlocked=row.querySelector('[data-score-earned]').checked;}
  const achievements=scoreCalculatorRows.map(row=>({apiname:`calc-${row.id}`,achieved:row.unlocked?1:0})),percentages=new Map(scoreCalculatorRows.map(row=>[`calc-${row.id}`,row.percent]));
  const result=pcGamerscore.calculate(achievements,percentages);
  document.querySelector('#score-calculator-earned').textContent=result.points.toLocaleString();document.querySelector('#score-calculator-completion').textContent=`${result.unlocked} / ${result.total} unlocked${result.completed?' · Game complete':''}`;
  for(const row of pcScoreCalculator.querySelectorAll('[data-score-row]'))row.querySelector('[data-score-points]').textContent=result.pointTable[`calc-${row.dataset.scoreRow}`].points;
  return result;
}
function renderScoreCalculator() {
  document.querySelector('#score-calculator-rows').innerHTML=scoreCalculatorRows.map(row=>`<tr data-score-row="${row.id}"><td><input class="focusable" data-score-name type="text" maxlength="100" value="${escapeHtml(row.name)}" aria-label="Achievement name" /></td><td><input class="focusable" data-score-rarity type="number" min="0" max="100" step=".1" value="${row.percent}" aria-label="Percentage of players who unlocked ${escapeHtml(row.name)}" /><span>%</span></td><td><input class="focusable" data-score-earned type="checkbox" ${row.unlocked?'checked':''} aria-label="You unlocked ${escapeHtml(row.name)}" /></td><td><strong data-score-points></strong></td><td><button class="secondary focusable" type="button" data-score-remove="${row.id}" aria-label="Remove ${escapeHtml(row.name)}" ${scoreCalculatorRows.length===1?'disabled':''}>×</button></td></tr>`).join('');
  updateScoreCalculator();refreshFocusables();
}
document.querySelector('#pc-score-calculator-open').onclick=()=>{renderScoreCalculator();pcScoreCalculator.showModal();setFocusedElement(pcScoreCalculator.querySelector('.focusable'));};
pcScoreCalculator.addEventListener('input',updateScoreCalculator);
pcScoreCalculator.addEventListener('click',event=>{
  if(event.target.closest('[data-score-close]')){pcScoreCalculator.close();return;}
  if(event.target.closest('[data-score-add]')){if(scoreCalculatorRows.length>=200){showToast('The calculator supports up to 200 achievements');return;}const id=scoreCalculatorNext++;scoreCalculatorRows.push({id,name:`Achievement ${id}`,percent:50,unlocked:false});renderScoreCalculator();return;}
  const remove=event.target.closest('[data-score-remove]');if(remove&&scoreCalculatorRows.length>1){scoreCalculatorRows=scoreCalculatorRows.filter(row=>row.id!==Number(remove.dataset.scoreRemove));renderScoreCalculator();}
});
