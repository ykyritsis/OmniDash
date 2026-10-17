// Add-ons for the install sheet: which DLC and which language pack to download. The sheet (gInstallTo in
// garrison.js) asks for this, shows markup(), and passes clicks to handle(). Sizes come from Steam's public
// depot data; ownership and the on/off switch come from Steam itself when its local port is on.
async function gLoadInstallAddons(game) {
  const data = await window.launcher.getInstallAddons(game.id);
  if (!data || (!data.dlc?.length && !data.languages?.length && !data.dlcHidden)) return null;
  const selection = { dlc: {}, language: data.language || '' };
  for (const row of data.dlc) selection.dlc[row.appId] = Boolean(row.checked);
  // An add-on you don't own can't be switched on; Steam only downloads what you own.
  const selectable = row => row.owned !== false;
  const checked = row => selectable(row) && selection.dlc[row.appId] === true;

  // A DLC carries one copy of its voice and text per language, so its size follows the language pack chosen.
  const rowBytes = row => {
    if (!row.base) return row.installBytes;
    const part = row.languageSizes?.[selection.language] || row.languageSizes?.english;
    return row.base.installBytes + (part?.installBytes || 0);
  };
  const extraBytes = () => {
    let total = 0;
    for (const row of data.dlc) if (checked(row)) total += rowBytes(row);
    const picked = data.languages.find(item => item.code === selection.language);
    // The base size counts English only, so another language adds the difference.
    if (picked && selection.language !== 'english') total += picked.installBytes - (data.englishInstallBytes || 0);
    return Math.max(0, total);
  };

  return {
    data, selection, extraBytes,
    markup() {
      const rows = data.dlc.map(row => {
        const on = checked(row), locked = !selectable(row);
        const bytes = rowBytes(row);
        const detail = [formatBytes(bytes), locked ? 'Not owned' : '', bytes >= 2e9 ? 'Large' : ''].filter(Boolean).join(' · ');
        return `<button class="g-addon focusable${on ? ' on' : ''}${locked ? ' locked' : ''}${row.big ? ' big' : ''}" type="button" role="checkbox" aria-checked="${on}"${locked ? ' aria-disabled="true"' : ''} data-addon-toggle="${escapeHtml(row.appId)}"><span class="g-addon-box">${on ? gIcon('check') : ''}</span><span class="g-addon-copy"><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(detail)}</small></span></button>`;
      }).join('');
      const languages = data.languages.length ? `<h4>Language pack</h4><div class="g-addon-languages" role="radiogroup" aria-label="Language pack">${data.languages.map(item => {
        const on = item.code === selection.language;
        return `<button class="g-addon-language focusable${on ? ' on' : ''}" type="button" role="radio" aria-checked="${on}" data-addon-language="${escapeHtml(item.code)}">${escapeHtml(item.label)}<small>${escapeHtml(formatBytes(item.installBytes))}</small></button>`;
      }).join('')}</div>` : '';
      const notes = [
        data.dlcHidden ? 'Your add-ons appear here once Steam is open with download controls on (Queue). Steam installs the ones it has switched on.' : '',
        data.noDownloadCount ? `${data.noDownloadCount} more add-on${data.noDownloadCount === 1 ? '' : 's'} add no download.` : ''
      ].filter(Boolean).map(text => `<p class="g-addons-note">${escapeHtml(text)}</p>`).join('');
      const extra = extraBytes();
      return `<section class="g-addons" aria-label="What to install">
        <h3>What to install</h3>
        <p class="g-addons-base"><strong>${escapeHtml(game.title)}</strong><small>Required</small></p>
        ${data.dlc.length ? `<h4>Add-ons</h4><div class="g-addon-list" role="group" aria-label="Add-ons">${rows}</div>
          <div class="g-addon-bulk"><button class="g-addon-link focusable" type="button" data-addon-all="on">Select all</button><button class="g-addon-link focusable" type="button" data-addon-all="off">Select none</button></div>` : ''}
        ${languages}${notes}
        <p class="g-addons-total">${extra ? `Your choices add about ${escapeHtml(formatBytes(extra))}.` : 'No extra space for your choices.'}</p>
      </section>`;
    },
    // Returns a selector for the control to keep focus on after the sheet is drawn again.
    handle(control) {
      if (control.dataset.addonToggle) {
        const id = control.dataset.addonToggle, row = data.dlc.find(item => item.appId === id);
        if (row && selectable(row)) selection.dlc[id] = !selection.dlc[id];
        return `[data-addon-toggle="${CSS.escape(id)}"]`;
      }
      if (control.dataset.addonLanguage) {
        selection.language = control.dataset.addonLanguage;
        return `[data-addon-language="${CSS.escape(selection.language)}"]`;
      }
      if (control.dataset.addonAll) {
        const on = control.dataset.addonAll === 'on';
        for (const row of data.dlc) if (selectable(row)) selection.dlc[row.appId] = on;
        return `[data-addon-all="${control.dataset.addonAll}"]`;
      }
      return '';
    },
    // Remembers the choices for next time; the main process carries them out when the install starts.
    save() {
      const dlc = {};
      for (const row of data.dlc) if (selectable(row)) dlc[row.appId] = Boolean(selection.dlc[row.appId]);
      return window.launcher.setInstallChoices(game.id, { dlc, language: selection.language });
    }
  };
}
