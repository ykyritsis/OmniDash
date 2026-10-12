// Library controls share one toolbar. The filter sheet keeps the game grid quiet.
function buildConsoleLibrary() {
  const content=document.querySelector('.console-library-content');
  const heading=document.querySelector('.library-heading-row');
  const title=document.createElement('div');title.className='console-library-title';
  title.append(document.querySelector('#library-heading'),document.querySelector('#library-count'));
  const controls=document.createElement('div');controls.className='console-library-controls';
  controls.innerHTML=`<button id="library-filter-button" class="focusable" data-action="console-library-filters" aria-label="Filter library">${consoleIcon('filter')}<span>Filter</span><i id="library-filter-count" hidden></i></button>`;
  controls.prepend(document.querySelector('#library-sort'));
  const add=document.querySelector('.library-toolbar > [data-action="add-game"]');
  add.innerHTML=`${consoleIcon('add')}<span>Add</span>`;add.setAttribute('aria-label','Add a game or app');controls.append(add);
  heading.prepend(title);heading.append(controls);
  const summary=document.createElement('div');summary.id='library-filter-summary';summary.hidden=true;
  heading.after(summary);
  const modal=document.createElement('dialog');modal.id='library-filters-dialog';modal.className='console-filter-dialog';modal.setAttribute('aria-labelledby','library-filters-title');
  modal.innerHTML='<header><h2 id="library-filters-title">Filter your library</h2><button class="focusable" data-action="console-library-filters-close" aria-label="Close filters">×</button></header><section class="console-filter-fields"></section><footer><button class="secondary focusable" data-action="console-library-clear">Reset filters</button><button class="primary focusable" data-action="console-library-filters-close">Done</button></footer>';
  const fields=modal.querySelector('section'), extras=document.querySelector('.library-extra-filters');
  fields.append(extras);
  extras.querySelector('.filter-chips').insertAdjacentHTML('beforebegin','<h3>Installation</h3>');
  for(const [id,label] of [['library-source-filter','Source'],['library-collection','Collection']]) {
    const control=fields.querySelector('#'+id)||document.querySelector('#'+id);
    const field=document.createElement('label');field.className='console-filter-field';field.textContent=label;field.append(control);fields.append(field);
  }
  document.body.append(modal);
  content.prepend(heading);
}

function renderConsoleLibraryStatus() {
  const values=[];
  if(state.installFilter!=='all')values.push(state.installFilter==='installed'?'Installed':'Not installed');
  if(state.sourceFilter!=='all')values.push(state.sourceFilter);
  if(state.collectionFilter && state.collectionFilter!=='all')values.push(document.querySelector('#library-collection').selectedOptions[0]?.textContent || 'Collection');
  if(state.searchQuery)values.push(`“${librarySearch.value}”`);
  const summary=document.querySelector('#library-filter-summary');
  summary.hidden=!values.length||state.consoleLibraryGroups;
  summary.innerHTML=`<span>${values.map(escapeHtml).join(' · ')}</span><button class="focusable" data-action="console-library-clear">Clear</button>`;
  const count=document.querySelector('#library-filter-count');count.hidden=!values.length;count.textContent=String(values.length);
  document.querySelector('#library-filter-button').hidden=Boolean(state.consoleLibraryGroups);
  document.querySelector('#library-sort').hidden=Boolean(state.consoleLibraryGroups);
}

function libraryEmptyState() {
  const filtered=state.installFilter!=='all'||state.sourceFilter!=='all'||(state.collectionFilter && state.collectionFilter!=='all')||state.searchQuery;
  return `<div class="console-library-empty"><span class="console-empty-mark">${consoleIcon(filtered?'search':'library')}</span><h2>${filtered?'No matches this time':state.libraryCategory==='apps'?'Your apps belong here':'Your next game starts here'}</h2><p>${filtered?'Try another filter or show your whole library.':'Scan your installed launchers, or add a game or app from this PC.'}</p><button class="primary focusable" data-action="${filtered?'console-library-clear':'add-game'}">${filtered?'Show all':'Add a game or app'}</button></div>`;
}

function consoleLibraryAction(action) {
  const modal=document.querySelector('#library-filters-dialog');
  if(action==='console-library-filters') {modal.showModal();setFocusedElement(modal.querySelector('.filter-chip.active')||modal.querySelector('.focusable'),{scroll:false});return true;}
  if(action==='console-library-filters-close') {modal.close();return true;}
  if(action==='console-library-clear') {
    state.installFilter='all';state.sourceFilter='all';state.collectionFilter='all';state.searchQuery='';librarySearch.value='';
    document.querySelector('#library-source-filter').value='all';document.querySelector('#library-collection').value='all';
    renderLibraryView();refreshFocusables();
    setFocusedElement(modal.open?modal.querySelector('.filter-chip.active'):document.querySelector('#library-filter-button'),{scroll:false});
    return true;
  }
  return false;
}

function navigateConsoleLibrary(direction,current) {
  if(state.view!=='library'||topmostOpenDialog())return false;
  const sidebar=document.querySelector('.console-library-nav');
  if(sidebar.contains(current)) {
    if(direction==='right') {setFocusedElement(libraryGrid.querySelector('.focusable')||document.querySelector('#library-sort'));return true;}
    if(direction==='left')return true;
    const buttons=[...sidebar.querySelectorAll('.focusable')],index=buttons.indexOf(current);
    const next=buttons[index+(direction==='up'?-1:1)];if(next)setFocusedElement(next,{scroll:false});return true;
  }
  if(current.parentElement!==libraryGrid)return false;
  const cards=[...libraryGrid.querySelectorAll(':scope > .focusable')];
  const origin=current.getBoundingClientRect();
  const sameRow=cards.filter(card=>Math.abs(card.getBoundingClientRect().top-origin.top)<4);
  const column=sameRow.indexOf(current);
  if(direction==='left'&&column===0) {setFocusedElement(sidebar.querySelector('.active'),{scroll:false});return true;}
  if(direction==='left'||direction==='right') {
    const next=sameRow[column+(direction==='left'?-1:1)];if(next)setFocusedElement(next);return true;
  }
  const adjacent=cards.filter(card=>direction==='up'?card.getBoundingClientRect().top<origin.top-4:card.getBoundingClientRect().top>origin.top+4);
  adjacent.sort((a,b)=>Math.abs(a.getBoundingClientRect().top-origin.top)-Math.abs(b.getBoundingClientRect().top-origin.top)||Math.abs(a.getBoundingClientRect().left-origin.left)-Math.abs(b.getBoundingClientRect().left-origin.left));
  if(adjacent[0])setFocusedElement(adjacent[0]);
  else if(direction==='up')setFocusedElement(document.querySelector('#library-sort').hidden?document.querySelector('.console-library-controls .focusable:not([hidden])'):document.querySelector('#library-sort'));
  return true;
}
buildConsoleLibrary();
