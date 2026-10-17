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
})();
