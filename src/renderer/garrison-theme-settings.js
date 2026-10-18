// Settings the way each console named and grouped them. The pages are the launcher's own; only the
// sidebar's names, order and group headings change with the theme, and Helix gets its own labels back.
//  - Series: General, Account, Devices & connections, Preferences, Accessibility, System.
//  - One (2013): Network, Display & sound, Preferences, Ease of Access, System, Privacy & online safety, Account.
//  - 360: the System Settings list (Console Settings, Network Settings, Storage...) in lowercase-free 360 wording.
//  - PS3: the XMB's Settings column. PS4: Settings. Wii: the three Wii Settings pages. 3DS: System Settings.
(() => {
  const theme = () => document.body.dataset.gTheme || 'helix';
  const sidebar = document.querySelector('#settings-dialog .settings-sidebar');
  if (!sidebar) return;
  // [page id, label, group]
  const ERAS = {
    series: [['personalization', 'Personalization', 'General'], ['audio', 'Volume & audio output', 'General'], ['g-account', 'Profile & system', 'Account'], ['g-privacy', 'Privacy & online safety', 'Account'],
      ['g-input', 'Controllers & headsets', 'Devices & connections'], ['g-streaming', 'Remote features', 'Devices & connections'], ['g-notifications', 'Notifications', 'Preferences'], ['services', 'Manage games & add-ons', 'Preferences'],
      ['accessibility', 'Accessibility', 'Accessibility'], ['g-language', 'Language & location', 'System'], ['g-storage', 'Storage devices', 'System']],
    one: [['g-streaming', 'Network', ''], ['audio', 'Display & sound', ''], ['personalization', 'Preferences', ''], ['accessibility', 'Ease of Access', ''], ['g-input', 'Devices', ''],
      ['g-storage', 'System', ''], ['g-language', 'Language & location', ''], ['g-notifications', 'Notifications', ''], ['g-privacy', 'Privacy & online safety', ''], ['g-account', 'Account', ''], ['services', 'Games & apps', '']],
    x360: [['personalization', 'Console Settings', 'System'], ['g-streaming', 'Network Settings', 'System'], ['g-storage', 'Storage', 'System'], ['g-input', 'Controllers', 'System'],
      ['audio', 'Audio', 'System'], ['g-language', 'Language and Locale', 'System'], ['g-account', 'Profile', 'Account'], ['g-privacy', 'Privacy', 'Account'], ['g-notifications', 'Notifications', 'Preferences'],
      ['accessibility', 'Ease of Access', 'Preferences'], ['services', 'Game Libraries', 'Preferences']],
    // The XMB's Settings column, top to bottom.
    ps3: [['services', 'Game Settings', ''], ['accessibility', 'Display Settings', ''], ['audio', 'Sound Settings', ''], ['personalization', 'Theme Settings', ''],
      ['g-language', 'Date and Time Settings', ''], ['g-storage', 'System Settings', ''], ['g-input', 'Accessory Settings', ''], ['g-streaming', 'Network Settings', ''],
      ['g-privacy', 'Security Settings', ''], ['g-notifications', 'Notification Settings', ''], ['g-account', 'Account Management', '']],
    // Settings as the PS4 lists them.
    ps4: [['g-account', 'Account Management', 'Account'], ['g-privacy', 'Privacy & Security', 'Account'], ['g-notifications', 'Notifications', 'Account'],
      ['g-input', 'Devices', 'Devices'], ['audio', 'Sound & Screen', 'Devices'], ['g-streaming', 'Network', 'Devices'], ['personalization', 'Themes', 'Devices'],
      ['g-storage', 'System', 'System'], ['g-language', 'Language', 'System'], ['accessibility', 'Accessibility', 'System'], ['services', 'Application Data', 'System']],
    // Wii Options: the three pages of Wii Settings, then data management and the channels.
    wii: [['audio', 'Wii Settings · Page 1', 'Wii Settings'], ['g-language', 'Calendar', 'Wii Settings'], ['g-streaming', 'Internet', 'Wii Settings'],
      ['personalization', 'Screen', 'Wii Settings'], ['g-input', 'Sensor Bar', 'Wii Settings'], ['g-privacy', 'Parental Controls', 'Wii Settings'],
      ['accessibility', 'Wii Remote Settings', 'Wii Settings'], ['g-notifications', 'WiiConnect24', 'Data'], ['g-storage', 'Data Management', 'Data'],
      ['services', 'Wii Channels', 'Data'], ['g-account', 'Wii Shop Account', 'Data']],
    // System Settings as the 3DS lays them out.
    '3ds': [['g-streaming', 'Internet Settings', 'System'], ['g-privacy', 'Parental Controls', 'System'], ['g-storage', 'Data Management', 'System'],
      ['g-account', 'Profile', 'System'], ['g-language', 'Date & Time', 'System'], ['audio', 'Sound', 'System'], ['accessibility', 'Region Settings', 'System'],
      ['personalization', 'Theme', 'System'], ['g-input', 'amiibo Settings', 'System'], ['g-notifications', 'Notifications', 'System'], ['services', 'Software', 'System']]
  };
  const original = new Map();
  function apply() {
    const tabs = [...sidebar.querySelectorAll('.settings-tab[data-settings-tab]')];
    if (!tabs.length) return;
    tabs.forEach((tab, index) => { if (!original.has(tab)) original.set(tab, { label: tab.textContent, index }); });
    sidebar.querySelectorAll('.g-settings-group').forEach(el => el.remove());
    const era = ERAS[theme()];
    const anchor = sidebar.querySelector('.g-settings-player') || sidebar.firstElementChild;
    if (!era) {
      [...original].sort((a, b) => a[1].index - b[1].index).forEach(([tab, info]) => { tab.textContent = info.label; tab.hidden = false; sidebar.append(tab); });
      return;
    }
    let group = null, last = anchor;
    const listed = new Set();
    for (const [id, label, heading] of era) {
      const tab = tabs.find(item => item.dataset.settingsTab === id);
      if (!tab) continue;
      if (heading && heading !== group) {
        const header = document.createElement('span');
        header.className = 'g-settings-group';
        header.textContent = heading;
        last.after(header); last = header; group = heading;
      }
      tab.textContent = label; tab.hidden = false;
      last.after(tab); last = tab; listed.add(tab);
    }
    // Pages a console never had keep their place at the end.
    tabs.filter(tab => !listed.has(tab)).forEach(tab => { tab.textContent = original.get(tab).label; last.after(tab); last = tab; });
  }
  new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  document.querySelector('#settings-dialog')?.addEventListener('toggle', apply);
  setTimeout(apply, 0);

  // The Xbox era settings shells (Series, One and 360) used to live here as a second copy of the whole settings
  // state machine. They are skins in garrison-settings-shell.js now, next to the shared model; this file is only
  // the launcher dialog's era labels (above) and the console pack manager (below).
  // =========================== Console packs (task P1) ===========================
  // Settings → Appearance → Console packs. One row per pack folder the theme engines read: whether it is found,
  // the credit from the pack's own readme (or the credit documented in docs/theme-packs.md), what is inside it
  // (files actually found, per category) and the exact names the app looks for. No row is decorative: Open folder
  // reveals the pack (or its parent when the pack is missing), and Add README writes a short drop-in guide when the
  // pack has no README of its own. The registry and the folder scan live in src/support.cjs and reach the page over
  // theme:packs; the IPC opens Explorer and writes the README, and both are gated in the hidden review harness.
  const GPACK_OPEN = 'g-pack-open', GPACK_README = 'g-pack-readme';
  // Pack text goes into HTML: one escaper for every value, as the shell had before the Xbox block moved out.
  const packEscape = value => String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const GPACK_COUNTS = [
    ['icons', 'icon', 'icons'], ['fonts', 'font', 'fonts'], ['sounds', 'sound', 'sounds'],
    ['music', 'music', 'music'], ['wallpapers', 'wallpaper', 'wallpapers'], ['video', 'video', 'videos']
  ];
  let gPackSection = null, gPackData = null, gPackLoadedAt = 0, gPackLoading = false;
  let gPackError = '', gPackMessage = '', gPackRequest = 0, gPackReadmeBusy = '';
  const gPackName = (key, count) => {
    const [, one, many] = GPACK_COUNTS.find(item => item[0] === key) || [key, key, key];
    return count === 1 ? one : many;
  };
  const gPackPlay = kind => { try { interfaceAudio?.play?.(kind); } catch { /* Sound is optional. */ } };

  function gPackBuild() {
    if (gPackSection?.isConnected) return gPackSection;
    const page = document.querySelector('[data-settings-page="personalization"]');
    if (!page) return null;
    gPackSection = document.createElement('section');
    gPackSection.className = 'settings-section g-pack-section';
    gPackSection.id = 'g-pack-section';
    gPackSection.setAttribute('aria-labelledby', 'g-pack-heading');
    gPackSection.innerHTML = `<div class="settings-section-heading">
        <span class="eyebrow">CONSOLE PACKS</span>
        <h3 id="g-pack-heading">Console packs</h3>
        <p>Optional console art, fonts and sounds. OmniDash never ships them; each row shows what is really in the folder and the names the theme looks for.</p>
      </div>
      <div class="g-pack-list" role="list" aria-live="polite"></div>
      <p class="g-pack-note" role="status"></p>`;
    // Under the Theme picker, so Appearance reads: which dashboard, then the packs that dress it.
    const themeSection = page.querySelector('.g-theme-section');
    if (themeSection) themeSection.insertAdjacentElement('afterend', gPackSection);
    else page.prepend(gPackSection);
    return gPackSection;
  }

  function gPackRowMarkup(pack) {
    const counts = pack.counts || {};
    const chips = GPACK_COUNTS.map(([key]) => {
      const count = Number(counts[key]) || 0;
      return `<span class="g-pack-count${count ? ' on' : ''}"><b>${count}</b>${gPackName(key, count)}</span>`;
    }).join('');
    const wants = (pack.expected || []).map(group => `<span class="g-pack-want"><b>${packEscape(group.label)}</b>${(group.names || []).map(name => `<code>${packEscape(name)}</code>`).join(' ')}</span>`).join('');
    const creditFrom = pack.creditSource === 'pack' && pack.creditFile ? ` <small>from ${packEscape(pack.creditFile)}</small>` : '';
    const readme = pack.readme?.present
      ? `<span class="g-pack-readme-ok">README <code>${packEscape(pack.readme.file || pack.readme.name)}</code></span>`
      : '<span class="g-pack-readme-missing">No README at this folder’s root. Add one so the file names are written down.</span>';
    const readmeButton = pack.readme?.present ? ''
      : `<button class="secondary focusable g-pack-button" type="button" data-action="${GPACK_README}" data-pack="${packEscape(pack.id)}"${gPackReadmeBusy === pack.id ? ' disabled' : ''}>${gPackReadmeBusy === pack.id ? 'Writing README…' : 'Add README'}</button>`;
    const state = pack.found ? 'found' : pack.folderExists ? 'empty' : 'missing';
    const stateLabel = pack.found ? 'Found' : pack.folderExists ? 'No pack files' : 'Not installed';
    const install = pack.found ? ''
      : `<p class="g-pack-install">Install ${packEscape(pack.install)} in <code>${packEscape(pack.folder)}</code>.${pack.folderExists ? ' The folder exists but has no pack files yet.' : ' Open folder opens the folder above it so you can create it there.'}</p>`;
    return `<article class="g-pack-row ${state}" data-pack-id="${packEscape(pack.id)}" data-state="${pack.found ? 'found' : 'missing'}" role="listitem">
      <div class="g-pack-head"><div class="g-pack-name"><strong>${packEscape(pack.name)}</strong><code>${packEscape(pack.folder)}</code></div><span class="g-pack-state">${stateLabel}</span></div>
      <p class="g-pack-credit"><span class="g-pack-label">Credit</span>${packEscape(pack.credit || 'No credit recorded')}${creditFrom}</p>
      <div class="g-pack-counts" aria-label="Files found">${chips}</div>
      ${install}
      <p class="g-pack-wants"><span class="g-pack-label">Looks for</span>${wants}</p>
      <div class="g-pack-foot"><div class="g-pack-readme">${readme}</div><div class="g-pack-actions">${readmeButton}<button class="secondary focusable g-pack-button" type="button" data-action="${GPACK_OPEN}" data-pack="${packEscape(pack.id)}" aria-label="Open folder ${packEscape(pack.folder)}">Open folder</button></div></div>
    </article>`;
  }

  function gPackRender() {
    const section = gPackBuild();
    if (!section) return;
    const list = section.querySelector('.g-pack-list');
    const note = section.querySelector('.g-pack-note');
    const packs = gPackData?.packs || [];
    if (packs.length) list.innerHTML = packs.map(gPackRowMarkup).join('');
    else if (!gPackLoading && !gPackError) list.innerHTML = '<p class="g-pack-empty">No console packs are registered in this build.</p>';
    else list.innerHTML = gPackLoading ? '<p class="g-pack-empty">Reading pack folders…</p>' : '';
    section.classList.toggle('loading', gPackLoading);
    note.textContent = gPackError || (gPackLoading ? 'Reading pack folders…' : gPackMessage);
    if (!gPackLoading) {
      try { refreshFocusables(); } catch { /* The launcher focus model may be mid-paint. */ }
    }
  }

  async function gPackLoad(force = false) {
    const section = gPackBuild();
    if (!section) return;
    if (!window.launcher?.getThemePacks) {
      gPackError = 'The console pack manager needs this OmniDash build’s launcher bridge.';
      gPackRender();
      return;
    }
    if (gPackLoading) return;
    if (!force && gPackData && Date.now() - gPackLoadedAt < 20000) return;
    const request = ++gPackRequest;
    gPackLoading = true;
    gPackError = '';
    gPackRender();
    try {
      const data = await window.launcher.getThemePacks();
      if (request !== gPackRequest) return;
      gPackData = data && Array.isArray(data.packs) ? data : { packs: [] };
      gPackLoadedAt = Date.now();
      if (!gPackData.packs.length) gPackError = 'No console packs are registered in this build.';
    } catch (error) {
      if (request !== gPackRequest) return;
      gPackError = error?.message || 'Could not read the theme pack folders.';
    } finally {
      if (request === gPackRequest) { gPackLoading = false; gPackRender(); }
    }
  }

  function gPackNote(text) {
    gPackMessage = text || '';
    gPackRender();
  }

  async function gPackAction(action, source) {
    const id = source?.dataset?.pack || '';
    const pack = gPackData?.packs?.find(item => item.id === id);
    if (!pack) return false;
    if (action === GPACK_OPEN) {
      if (source.dataset.busy === 'true') return true;
      source.dataset.busy = 'true';
      source.disabled = true;
      try {
        const result = await window.launcher.openThemePack(id);
        gPackSection.dataset.lastOpen = id;
        gPackNote(result?.demo ? `Pack folder: ${result.path || ''}` : `Opened ${pack.folder} in Explorer.`);
        gPackPlay('confirm');
      } catch (error) {
        gPackNote(error?.message || 'Could not open the theme pack folder.');
        gPackPlay('back');
      } finally {
        delete source.dataset.busy;
        if (source.isConnected) source.disabled = false;
      }
      return true;
    }
    if (action === GPACK_README) {
      if (gPackReadmeBusy) return true;
      gPackReadmeBusy = id;
      gPackRender();
      try {
        const result = await window.launcher.writeThemePackReadme(id);
        await gPackLoad(true);
        if (result?.written) gPackNote(`Wrote ${result.file} into ${pack.folder}.`);
        else if (result?.demo) gPackNote(`Review mode: ${result.file || 'the pack README'} was not written.`);
        else gPackNote(`A README already exists in ${pack.folder}; nothing was overwritten.`);
        gPackPlay('confirm');
      } catch (error) {
        gPackNote(error?.message || 'Could not write the pack README.');
        gPackPlay('back');
      } finally {
        gPackReadmeBusy = '';
        gPackRender();
      }
      return true;
    }
    return false;
  }

  // A click on a pack button goes straight to the action; the capture listener stops the global dispatcher from
  // running it twice. The controller's performAction route is wrapped for the same two actions.
  if (typeof performAction === 'function') {
    const packPerformBase = performAction;
    performAction = async function (action, source) {
      if (action === GPACK_OPEN || action === GPACK_README) { await gPackAction(action, source); return true; }
      return packPerformBase.call(this, action, source);
    };
  }
  document.addEventListener('click', event => {
    const button = event.target.closest?.(`[data-action="${GPACK_OPEN}"], [data-action="${GPACK_README}"]`);
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    gPackAction(button.dataset.action, button).catch(error => gPackNote(error?.message || 'That pack action failed.'));
  }, true);
  // Re-read the folders when Appearance opens or its tab is clicked (the 20 s cache stops a scan per keypress).
  const gPackDialog = document.querySelector('#settings-dialog');
  gPackDialog?.addEventListener('toggle', () => {
    if (!gPackDialog.open) return;
    gPackMessage = '';
    gPackLoad();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-settings-tab="personalization"]')) return;
    setTimeout(() => gPackLoad(), 0);
  }, true);
  if (document.querySelector('[data-settings-page="personalization"]')) {
    gPackRender();
    gPackLoad();
  }
})();
