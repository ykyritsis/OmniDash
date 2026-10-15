// Game page "Game details", laid out like the Xbox app in full screen (Jez Corden's hands-on, 8:10–8:20):
// a Description card beside Playable on / Capabilities, a System requirements card, then Installation,
// online service and Publisher info in two columns. Steam games get Steam's equivalents (cloud saves,
// achievements), and how the game can be played (controller, mouse and keyboard) is spelled out.
gIconPaths.keyboard_regular = '<path d="M19.7454 5C20.988 5 21.9954 6.00736 21.9954 7.25V16.7546C21.9954 17.9972 20.988 19.0046 19.7454 19.0046H4.25C3.00736 19.0046 2 17.9972 2 16.7546V7.25C2 6.00736 3.00736 5 4.25 5H19.7454ZM19.7454 6.5H4.25C3.83579 6.5 3.5 6.83579 3.5 7.25V16.7546C3.5 17.1688 3.83579 17.5046 4.25 17.5046H19.7454C20.1596 17.5046 20.4954 17.1688 20.4954 16.7546V7.25C20.4954 6.83579 20.1596 6.5 19.7454 6.5ZM6.75 14.5H17.25C17.6642 14.5 18 14.8358 18 15.25C18 15.6297 17.7178 15.9435 17.3518 15.9932L17.25 16H6.75C6.33579 16 6 15.6642 6 15.25C6 14.8703 6.28215 14.5565 6.64823 14.5068L6.75 14.5H17.25H6.75ZM16.5 11C17.0523 11 17.5 11.4477 17.5 12C17.5 12.5523 17.0523 13 16.5 13C15.9477 13 15.5 12.5523 15.5 12C15.5 11.4477 15.9477 11 16.5 11ZM10.5049 11C11.0572 11 11.5049 11.4477 11.5049 12C11.5049 12.5523 11.0572 13 10.5049 13C9.95259 13 9.50488 12.5523 9.50488 12C9.50488 11.4477 9.95259 11 10.5049 11ZM7.50488 11C8.05716 11 8.50488 11.4477 8.50488 12C8.50488 12.5523 8.05716 13 7.50488 13C6.95259 13 6.50488 12.5523 6.50488 12C6.50488 11.4477 6.95259 11 7.50488 11ZM13.5049 11C14.0572 11 14.5049 11.4477 14.5049 12C14.5049 12.5523 14.0572 13 13.5049 13C12.9526 13 12.5049 12.5523 12.5049 12C12.5049 11.4477 12.9526 11 13.5049 11ZM6 8C6.55228 8 7 8.44772 7 9C7 9.55228 6.55228 10 6 10C5.44772 10 5 9.55228 5 9C5 8.44772 5.44772 8 6 8ZM8.99512 8C9.54741 8 9.99512 8.44772 9.99512 9C9.99512 9.55228 9.54741 10 8.99512 10C8.44284 10 7.99512 9.55228 7.99512 9C7.99512 8.44772 8.44284 8 8.99512 8ZM11.9951 8C12.5474 8 12.9951 8.44772 12.9951 9C12.9951 9.55228 12.5474 10 11.9951 10C11.4428 10 10.9951 9.55228 10.9951 9C10.9951 8.44772 11.4428 8 11.9951 8ZM14.9951 8C15.5474 8 15.9951 8.44772 15.9951 9C15.9951 9.55228 15.5474 10 14.9951 10C14.4428 10 13.9951 9.55228 13.9951 9C13.9951 8.44772 14.4428 8 14.9951 8ZM17.9951 8C18.5474 8 18.9951 8.44772 18.9951 9C18.9951 9.55228 18.5474 10 17.9951 10C17.4428 10 16.9951 9.55228 16.9951 9C16.9951 8.44772 17.4428 8 17.9951 8Z"/>';
Object.assign(gIconNames, { console: 'xbox_console', kbm: 'keyboard_regular' });

const gDetailsSection = document.createElement('section');
gDetailsSection.id = 'g-game-details';
gDetailsSection.className = 'detail-section g-details';
gDetailsSection.setAttribute('aria-labelledby', 'g-details-heading');
document.querySelector('#detail-gallery').closest('section').after(gDetailsSection);

const gLaunchers = { Steam: 'Steam', 'Epic Games': 'the Epic Games Launcher', 'EA app': 'the EA app', 'Battle.net': 'Battle.net', 'Ubisoft Connect': 'Ubisoft Connect',
  'GOG Galaxy': 'GOG Galaxy', 'Amazon Games': 'Amazon Games', 'Rockstar Games': 'the Rockstar Games Launcher', 'Riot Games': 'the Riot Client', 'itch.io': 'the itch app' };

function gDetailsDate(value) {
  const time = Date.parse(String(value || '').replace(/(\d+) (\w{3}), (\d{4})/, '$2 $1, $3'));
  return Number.isFinite(time) ? new Date(time).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' }) : String(value || '');
}
function gDetailsSize(game, details) {
  if (game.sizeOnDisk) return formatBytes(game.sizeOnDisk);
  const storage = [...(details.requirements?.recommended || []), ...(details.requirements?.minimum || [])].find(([label]) => /storage|hard (disk|drive)|disk space/i.test(label))?.[1] || '';
  const match = storage.match(/(\d+(?:[.,]\d+)?)\s*(TB|GB|MB)/i);
  return match ? `${match[1].replace(',', '.')} ${match[2].toUpperCase()}` : '';
}
function gDetailsPlatforms(details) {
  const list = [...(details.xboxInfo?.platforms || []), ...(details.playableOn || ['PC'])];
  return [...new Set(list.map(item => item === 'windows' ? 'PC' : item))].filter(Boolean);
}
// Xbox names where Xbox describes the game; Steam's own features for Steam games.
function gDetailsCapabilities(game, details) {
  const caps = [];
  const add = label => { if (label && !caps.includes(label)) caps.push(label); };
  const attrs = details.xboxInfo?.attributes || [];
  const has = name => attrs.some(entry => entry.name === name);
  const cats = details.steamCategories || details.categories || [];
  const cat = pattern => cats.some(entry => pattern.test(entry));
  const steam = game.provider === 'Steam';
  if (has('Capability4k')) add('4K Ultra HD');
  if (has('CapabilityHDR') || cat(/^hdr available$/i)) add('HDR10');
  if (has('RayTracing') || has('CapabilityRayTracing')) add('Ray tracing');
  if (has('120fps') || has('Capability120fps')) add('120 fps'); else if (has('60fps') || has('Capability60fps')) add('60 fps+');
  if (cat(/^single-player$/i) || has('SinglePlayer')) add('Single player');
  if (cat(/online co-op/i) || has('XblOnlineCoop')) add('Online co-op');
  if (cat(/online pvp|^multi-player$/i) || has('XblOnlineMultiPlayer')) add('Online multiplayer');
  if (cat(/shared\/split screen|split screen/i) || has('XblLocalCoop') || has('SharedSplitScreen')) add('Local co-op');
  if (cat(/cross-platform multiplayer/i) || has('XblCrossPlatformMultiPlayer')) add('Cross-platform multiplayer');
  if (cat(/^lan /i)) add('LAN play');
  if (details.xboxInfo?.consoleOptimized && !steam) add('Optimised for Xbox Series X|S');
  if (steam) {
    if (cat(/steam achievements/i)) add('Steam achievements');
    if (cat(/steam cloud/i)) add('Steam cloud saves');
    if (cat(/steam workshop/i)) add('Steam Workshop');
    if (cat(/remote play together/i)) add('Remote Play Together');
    else if (cat(/remote play/i)) add('Steam Remote Play');
    if (cat(/family sharing/i)) add('Steam Family Sharing');
    if (cat(/trading cards/i)) add('Steam trading cards');
    if (cat(/leaderboards/i)) add('Leaderboards');
  } else {
    if (has('XblAchievements')) add('Xbox achievements');
    if (has('XblCloudSaves')) add('Xbox cloud saves');
    if (details.xboxInfo?.playAnywhere) add('Xbox Play Anywhere');
  }
  if (cat(/vr support|vr only|tracked controller/i)) add('VR support');
  if (cat(/in-app purchases/i)) add('In-game purchases');
  return caps;
}
function gDetailsInputs(game, details) {
  const cats = details.steamCategories || details.categories || [];
  const support = details.controllerSupport && details.controllerSupport !== 'unknown' ? details.controllerSupport
    : cats.some(entry => /full controller support/i.test(entry)) ? 'controller' : cats.some(entry => /partial controller support/i.test(entry)) ? 'partial' : game.controls || 'unknown';
  const inputs = [];
  if (support === 'controller') inputs.push(['controller', 'Controller', 'Full support']);
  else if (support === 'partial') inputs.push(['controller', 'Controller', 'Partial support']);
  inputs.push(['kbm', 'Mouse and keyboard', support === 'controller' ? '' : 'Recommended']);
  return inputs;
}
function gDetailsLink(url, label, external = true) {
  return `<button class="g-details-link focusable" type="button" data-action="g-open-link" data-url="${escapeHtml(url)}">${escapeHtml(label)}${external ? gIcon('open') : ''}</button>`;
}

function renderGarrisonGameDetails(game, details = {}) {
  if (!game) return;
  const facts = [['Published by', details.publisher], ['Developed by', details.developer], ['Release date', gDetailsDate(details.releaseDate)]].filter(([, value]) => value);
  const size = gDetailsSize(game, details);
  const description = String(details.fullDescription || details.description || '').trim();
  const platforms = gDetailsPlatforms(details);
  const inputs = gDetailsInputs(game, details);
  const caps = gDetailsCapabilities(game, details);
  const minimum = details.requirements?.minimum || [], recommended = details.requirements?.recommended || [];
  const xbox = details.xboxInfo || {};
  const provider = game.provider || (game.xboxProductId ? 'Xbox PC' : '');
  const steam = provider === 'Steam';
  const storeId = details.steamAppId || (steam ? game.appId : '');
  const installation = game.remoteHostId ? `Streams from ${game.hostName || 'your remote PC'}. Install and update this game on that PC. No local game download is needed.`
    : steam ? 'Installs with Steam on this PC. Sign in to Steam on any PC to install and play it there too.'
    : provider === 'Xbox PC' ? (/Restrictive/i.test(xbox.installTerms) ? 'Install on your home Xbox console and a Windows PC plus have access when you’re connected to your Microsoft account' : 'Install on Windows PCs where you’re signed in to your Microsoft account.')
    : `Installs with ${gLaunchers[provider] || provider || 'its launcher'} on this PC.`;
  const online = steam ? { title: 'Steam', text: 'Your playtime, achievements and friends activity sync with Steam while you play.', url: storeId ? `https://store.steampowered.com/app/${storeId}/` : '' }
    : provider === 'Xbox PC' ? { title: 'XBOX Live', text: 'Publishers of games you launch receive access to your XBOX profile information and associated data while you play.', url: 'https://www.xbox.com/en-US/legal/privacy-and-cookies' } : null;
  const support = details.support || {};
  const publisherLinks = [
    support.email ? gDetailsLink(`mailto:${support.email}`, support.email, false) : '',
    support.url ? gDetailsLink(support.url, 'Support', true) : xbox.supportUri ? gDetailsLink(xbox.supportUri, xbox.supportUri.replace(/^https?:\/\//, ''), true) : '',
    support.website ? gDetailsLink(support.website, 'Website', true) : xbox.websiteUri ? gDetailsLink(xbox.websiteUri, 'Website', true) : ''
  ].filter(Boolean);
  const reqRow = rows => rows.map(([label, value]) => label === 'Notes' ? `<dd class="g-req-note">${escapeHtml(value)}</dd>` : `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`).join('');
  const chip = (icon, label, note = '') => `<span class="g-chip-box">${icon ? gIcon(icon) : ''}<span>${escapeHtml(label)}${note ? `<small>${escapeHtml(note)}</small>` : ''}</span></span>`;
  gDetailsSection.dataset.gameId = game.id;
  gDetailsSection.innerHTML = `<h2 id="g-details-heading">Game details</h2>
    <div class="g-details-cards">
      <article class="g-details-card g-details-about">
        <h3>Description</h3>
        ${facts.length ? `<dl class="g-details-facts">${facts.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>` : ''}
        ${size ? `<dl class="g-details-facts"><div><dt>Approximate size</dt><dd>${escapeHtml(size)}</dd></div></dl>` : ''}
        ${description ? `<p class="g-details-text clamped">${escapeHtml(description)}</p>${description.length > 320 ? '<button class="g-details-more focusable" type="button" data-action="g-details-more" data-target="text">View more</button>' : ''}` : '<p class="g-details-text">Details for this game aren’t available yet.</p>'}
      </article>
      <article class="g-details-card g-details-play">
        <h3>Playable on</h3>
        <div class="g-chip-row">${platforms.map(item => chip(/xbox/i.test(item) ? 'console' : 'tv', item === 'PC' ? 'PC' : item.replace(/^Xbox/i, 'XBOX'))).join('')}</div>
        <h3>Playable with</h3>
        <div class="g-chip-row">${inputs.map(([icon, label, note]) => chip(icon, label, note)).join('')}</div>
        ${caps.length ? `<h3>Capabilities</h3><div class="g-chip-row g-caps">${caps.map(label => chip('', label)).join('')}</div>` : ''}
      </article>
    </div>
    ${minimum.length || recommended.length ? `<article class="g-details-card g-details-reqs clamped">
      <div class="g-reqs-columns">
        ${minimum.length ? `<div><h3>Minimum</h3><dl>${reqRow(minimum)}</dl></div>` : ''}
        ${recommended.length ? `<div><h3>Recommended</h3><dl>${reqRow(recommended)}</dl></div>` : ''}
      </div>
      <button class="g-details-more focusable" type="button" data-action="g-details-more" data-target="reqs">View more</button>
    </article>` : ''}
    <div class="g-details-info">
      <div>
        <section><h3>Installation</h3><p>${escapeHtml(installation)}</p></section>
        ${online ? `<section><h3>${escapeHtml(online.title)}</h3><p>${escapeHtml(online.text)}</p>${online.url ? gDetailsLink(online.url, 'Learn more') : ''}</section>` : ''}
      </div>
      <div>
        <section><h3>Publisher info</h3>${publisherLinks.length ? `<div class="g-details-links">${publisherLinks.join('')}</div>` : `<p>${escapeHtml(details.publisher || game.provider || '')}</p>`}</section>
        ${xbox.address ? `<section><h3>Address</h3><p>${escapeHtml(xbox.address)}</p></section>` : ''}
        ${xbox.phone ? `<section><h3>Phone number</h3><p>${escapeHtml(xbox.phone)}</p></section>` : ''}
        ${details.languages?.length ? `<section><h3>Supported languages</h3><p>${escapeHtml(details.languages.join(', '))}</p></section>` : ''}
      </div>
    </div>`;
  refreshFocusables();
}
function renderGarrisonGameDetailsLoading(game) {
  gDetailsSection.dataset.gameId = game?.id || '';
  gDetailsSection.innerHTML = '<h2 id="g-details-heading">Game details</h2><div class="g-details-cards"><article class="g-details-card g-details-loading"></article><article class="g-details-card g-details-loading"></article></div>';
}

const gDetailsInputMethods = renderDetailInputMethods;
renderDetailInputMethods = function (game, details) {
  gDetailsInputMethods(game, details);
  if (details && game && state.detailGameId === game.id) renderGarrisonGameDetails(game, details);
};
const gDetailsPrepare = prepareConsoleGamePage;
prepareConsoleGamePage = function (game) {
  gDetailsPrepare(game);
  renderGarrisonGameDetailsLoading(game);
};
const gDetailsPerform = performAction;
performAction = async function (action, source) {
  if (action === 'g-details-more') {
    const box = source.dataset.target === 'reqs' ? source.closest('.g-details-reqs') : source.closest('.g-details-card').querySelector('.g-details-text');
    const open = box.classList.toggle('clamped') === false;
    source.textContent = open ? 'View less' : 'View more';
    return;
  }
  if (action === 'g-open-link') {
    try { await window.launcher.openLink(source.dataset.url); } catch (error) { showToast(error.message || 'Could not open this link'); }
    return;
  }
  return gDetailsPerform(action, source);
};
// Xbox calls downloadable content "Add-ons".
document.querySelector('#dlc-heading').textContent = 'Add-ons';
