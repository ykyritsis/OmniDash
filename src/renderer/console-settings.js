function buildConsoleSettings() {
  const original=document.querySelector('[data-settings-page="experience"]');
  original.dataset.settingsPage='startup';original.hidden=true;
  const scroll=document.querySelector('.settings-scroll');
  const create=(id,heading)=>{
    const section=document.createElement('div');section.className='settings-page console-settings-subpage';section.dataset.settingsPage=id;section.hidden=true;
    section.innerHTML=`<section class="settings-section"><div class="settings-section-heading"><h3>${heading}</h3></div></section>`;
    scroll.append(section);return section.firstElementChild;
  };
  const display=create('display','Display options');
  ['fullscreen-toggle','ui-scale'].forEach(id=>display.append(document.querySelector('#'+id).closest('label')));
  display.insertAdjacentHTML('beforeend', `<label class="duplicate-game-row"><span><strong>Player region</strong><small>Use local age ratings and Store prices. Other rating boards fill gaps.</small></span><select id="player-region" class="focusable" aria-label="Player region"><option value="auto">Automatic</option>${[['AU','Australia'],['NZ','New Zealand'],['US','United States'],['CA','Canada'],['GB','United Kingdom'],['DE','Germany'],['FR','France'],['ES','Spain'],['IT','Italy'],['NL','Netherlands'],['SE','Sweden'],['JP','Japan'],['KR','South Korea'],['BR','Brazil'],['ZA','South Africa'],['TW','Taiwan'],['ID','Indonesia']].map(([code,name])=>`<option value="${code}">${name}</option>`).join('')}</select></label>`);
  const regionChoice = display.querySelector('#player-region');
  regionChoice.addEventListener('pointerdown', event => { event.preventDefault(); openConsoleChoice(regionChoice); });
  regionChoice.addEventListener('keydown', event => { if (['Enter',' '].includes(event.key)) { event.preventDefault(); event.stopPropagation(); openConsoleChoice(regionChoice); } });
  const audio=create('audio','Interface audio');
  audio.append(document.querySelector('#sound-toggle').closest('label'),document.querySelector('#startup-toggle').closest('label'),document.querySelector('.console-sound-pack'));
  const accessibility=create('accessibility','Make play comfortable');
  ['text-size','high-contrast-focus-toggle','reduced-motion-toggle'].forEach(id=>accessibility.append(document.querySelector('#'+id).closest('label')));
  const general=document.createElement('div');general.className='settings-page';general.dataset.settingsPage='experience';general.id='console-settings-general';
  const tiles=[['display','TV & display options','\uE7F4'],['audio','Volume & audio','\uE767'],['personalization','Personalization','\uE771'],['services','Game libraries','\uE8F1'],['accessibility','Accessibility','\uE776'],['power','Power options','\uE7E8']];
  general.innerHTML=`<div class="console-settings-tiles">${tiles.map(([page,title,glyph])=>`<button class="console-settings-tile focusable" type="button" data-action="console-settings-open" data-page="${page}"><span class="console-glyph" aria-hidden="true">${glyph}</span><strong>${title}</strong></button>`).join('')}</div><div class="console-settings-notes"><span>Xbox button opens Game Bar</span></div>`;
  original.before(general);
  document.querySelector('[data-settings-page="services"]').append(original.querySelector('.settings-quick-links'));
  original.remove();
  document.querySelector('[data-settings-tab="personalization"]').lastChild.textContent='Personalization';
  document.querySelector('[data-settings-tab="data"]').lastChild.textContent='System';
  const steamIcon=document.querySelector('.library-connection-card .connection-icon');
  steamIcon.innerHTML='<img src="assets/steam.svg" alt="" />';
}
function openConsoleSettingsPage(page,opener) {
  if(page==='power') { performAction('power-menu',opener);return; }
  showSettingsPage(page);
  state.consoleSettingsParent=page==='duplicates'||page.startsWith('connection-')?'services':'experience';
  state.consoleSettingsOpener=opener;
  const section=document.querySelector(`[data-settings-page="${page}"]`);
  setFocusedElement(section?.querySelector('.focusable'),{scroll:false});
}
buildConsoleSettings();
