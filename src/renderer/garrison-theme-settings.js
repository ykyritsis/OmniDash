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
    paintConsole();
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
  // ---------- Console options: the rows each console's own settings screen had ----------
  // Every settings page gets one decorative block above the launcher's own controls: the console's wording,
  // glyph, value and selection colour. It is aria-hidden and pointer-events:none (see garrison-theme-screens.css),
  // so it never takes focus, never scrolls into the tab order and never hides the real controls from a screen reader.
  const conEscape = value => String(value).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  // Line glyphs in the shape each console's own settings screen used (gIcon covers the Xbox eras).
  const conSvg = paths => `<svg class="g-con-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
  const CON_GLYPHS = {
    'con-disc': conSvg('<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="2.3"/>'),
    'con-pad': conSvg('<path d="M7.4 8.4h9.2a4.6 4.6 0 0 1 4.5 5.5l-.5 2.2a1.9 1.9 0 0 1-3.2.9l-2-2H8.6l-2 2a1.9 1.9 0 0 1-3.2-.9l-.5-2.2a4.6 4.6 0 0 1 4.5-5.5Z"/><path d="M8.2 11.3v3M6.7 12.8h3"/><path d="M15.8 12.2h.01M17.6 13.8h.01"/>'),
    'con-display': conSvg('<rect x="3.2" y="4.7" width="17.6" height="11.8" rx="1.6"/><path d="M9.2 20h5.6M12 16.5V20"/>'),
    'con-speaker': conSvg('<path d="M4.2 9.6h3l3.9-3.3v11.4l-3.9-3.3h-3z"/><path d="M14.8 9.2a4 4 0 0 1 0 5.6M17.4 6.8a7.3 7.3 0 0 1 0 10.4"/>'),
    'con-theme': conSvg('<path d="M12 3.3c4.8 0 8.7 3.6 8.7 8 0 2.5-1.9 4.2-4.2 4.2h-1.9c-1 0-1.8.8-1.8 1.8 0 .4.1.7.3 1 .2.4.3.8.3 1.2 0 1-.8 1.8-1.9 1.8-4.6 0-8.2-3.9-8.2-8.5S7.2 3.3 12 3.3Z"/><circle cx="8.5" cy="10.1" r="1"/><circle cx="12.1" cy="7.5" r="1"/><circle cx="15.6" cy="9.4" r="1"/>'),
    'con-clock': conSvg('<circle cx="12" cy="12" r="8.4"/><path d="M12 7.5V12l3 1.8"/>'),
    'con-gear': conSvg('<circle cx="12" cy="12" r="3.1"/><path d="M12 3.6v2.1M12 18.3v2.1M3.6 12h2.1M18.3 12h2.1M6.6 6.6l1.5 1.5M15.9 15.9l1.5 1.5M17.4 6.6l-1.5 1.5M8.1 15.9l-1.5 1.5"/>'),
    'con-usb': conSvg('<rect x="7.4" y="3.4" width="9.2" height="5.8" rx="1.3"/><path d="M9.6 9.2v3.4a2.4 2.4 0 0 0 4.8 0V9.2M12 15v5.2M10.2 18.2h3.6"/>'),
    'con-globe': conSvg('<circle cx="12" cy="12" r="8.4"/><path d="M3.8 12h16.4"/><path d="M12 3.6c2.5 2.4 3.8 5.3 3.8 8.4s-1.3 6-3.8 8.4c-2.5-2.4-3.8-5.3-3.8-8.4S9.5 6 12 3.6Z"/>'),
    'con-shield': conSvg('<path d="M12 3.3 18.8 6v5.5c0 4.2-2.7 7.3-6.8 9.1-4.1-1.8-6.8-4.9-6.8-9.1V6z"/><path d="m9.1 12 2.2 2.2 3.9-3.9"/>'),
    'con-bell': conSvg('<path d="M17.8 15.2V10a5.8 5.8 0 1 0-11.6 0v5.2l-1.4 2.2h14.4z"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>'),
    'con-user': conSvg('<circle cx="12" cy="8.3" r="3.6"/><path d="M4.9 20c.7-3.5 3.5-5.5 7.1-5.5s6.4 2 7.1 5.5"/>'),
    'con-save': conSvg('<path d="M5.4 4.3h9.4l4.8 4.8v10.6H5.4z"/><path d="M8.5 4.3v4.9h5.8V4.3M8.5 19.7v-5.4h7v5.4"/>'),
    'con-wifi': conSvg('<path d="M3.3 9.3a12.9 12.9 0 0 1 17.4 0M6.3 12.7a8.5 8.5 0 0 1 11.4 0M9.3 16.1a4.2 4.2 0 0 1 5.4 0"/><circle cx="12" cy="19.3" r="1" fill="currentColor" stroke="none"/>'),
    'con-calendar': conSvg('<rect x="3.6" y="5.3" width="16.8" height="15.1" rx="1.8"/><path d="M3.6 10h16.8M8.4 3.4v3.8M15.6 3.4v3.8M7.6 13.4h2.4M7.6 16.6h2.4M13.8 13.4h2.4M13.8 16.6h2.4"/>'),
    'con-sensor': conSvg('<rect x="2.6" y="9" width="18.8" height="6" rx="1.5"/><path d="M6.4 12h.01M9.6 12h.01M12.8 12h.01M16 12h.01"/>'),
    'con-remote': conSvg('<rect x="8.5" y="2.8" width="7" height="18.4" rx="3.4"/><path d="M12 6.4v3.4"/><circle cx="12" cy="14.6" r="1.6"/>'),
    'con-lock': conSvg('<rect x="5" y="10.3" width="14" height="9.7" rx="2"/><path d="M8.4 10.3V7.7a3.6 3.6 0 0 1 7.2 0v2.6M12 14.4v2.4"/>'),
    'con-amiibo': conSvg('<circle cx="12" cy="7.4" r="3"/><path d="M7 20.4c.4-4.3 2.3-6.9 5-6.9s4.6 2.6 5 6.9z"/><path d="M4.8 20.4h14.4"/>'),
    'con-region': conSvg('<path d="M12 20.8s5.6-5.6 5.6-9.6a5.6 5.6 0 0 0-11.2 0c0 4 5.6 9.6 5.6 9.6Z"/><circle cx="12" cy="11" r="2"/>'),
    'con-power': conSvg('<path d="M12 3.6v7.2"/><path d="M7.3 6.3a7 7 0 1 0 9.4 0"/>'),
    'con-download': conSvg('<path d="M12 3.9v9.6M8.2 10 12 13.8 15.8 10"/><path d="M4.5 17.2v1.6a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-1.6"/>'),
    'con-folder': conSvg('<path d="M3.4 7.1A1.8 1.8 0 0 1 5.2 5.3h4.1l2 2.4h7.5a1.8 1.8 0 0 1 1.8 1.8v8.6a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8z"/>'),
    'con-trophy': conSvg('<path d="M8 3.9h8v3.5a4 4 0 0 1-8 0z"/><path d="M8 5.2H5.6v1.4A3 3 0 0 0 8.4 9.5M16 5.2h2.4v1.4a3 3 0 0 1-2.8 2.9"/><path d="M12 11.4V15M8.6 20h6.8M10 15h4l.8 5H9.2z"/>'),
    'con-shop': conSvg('<path d="M6.1 8.3h11.8l1 11.2H5.1z"/><path d="M9 8.3V6.6a3 3 0 0 1 6 0v1.7"/>'),
    'con-tag': conSvg('<path d="M12.7 3.6H19a1.4 1.4 0 0 1 1.4 1.4v6.3L11.6 20.1a1.8 1.8 0 0 1-2.5 0L4.3 15.2a1.8 1.8 0 0 1 0-2.5z"/><circle cx="16.2" cy="7.8" r="1.3"/>'),
    'con-trash': conSvg('<path d="M4.6 6.9h14.8M9.4 6.9V4.7h5.2V6.9M6.8 6.9l.9 12.2a1.6 1.6 0 0 0 1.6 1.5h5.4a1.6 1.6 0 0 0 1.6-1.5l.9-12.2"/><path d="M10.4 10.5v6.2M13.6 10.5v6.2"/>'),
    'con-cloud': conSvg('<path d="M7.7 18.3a3.8 3.8 0 0 1-.7-7.5 5.2 5.2 0 0 1 10.1-1.2 3.6 3.6 0 0 1 .6 8.7z"/>'),
    'con-eye': conSvg('<path d="M2.9 12S6.6 6.5 12 6.5 21.1 12 21.1 12 17.4 17.5 12 17.5 2.9 12 2.9 12Z"/><circle cx="12" cy="12" r="2.8"/>'),
    'con-keyboard': conSvg('<rect x="2.8" y="6.8" width="18.4" height="10.4" rx="1.6"/><path d="M6.4 10.1h.01M9.4 10.1h.01M12.4 10.1h.01M15.4 10.1h.01M18 10.1h.01M7.4 13.5h9.2"/>'),
    'con-headset': conSvg('<path d="M4.6 13.6v-1.8a7.4 7.4 0 0 1 14.8 0v1.8"/><rect x="2.8" y="13.3" width="3.6" height="6.1" rx="1.4"/><rect x="17.6" y="13.3" width="3.6" height="6.1" rx="1.4"/>'),
    'con-photo': conSvg('<rect x="3.2" y="4.9" width="17.6" height="14.2" rx="1.8"/><circle cx="8.6" cy="9.9" r="1.6"/><path d="m4.4 17.4 4.8-4.4 3.4 3 2.6-2.2 3.4 3"/>'),
    'con-color': conSvg('<circle cx="8" cy="9" r="2.6"/><circle cx="16" cy="9" r="2.6"/><circle cx="12" cy="16" r="2.6"/>'),
    'con-font': conSvg('<path d="M5.2 19.7 10.9 4.3h2.2l5.7 15.4M8.2 13.6h7.6"/>'),
    'con-info': conSvg('<circle cx="12" cy="12" r="8.4"/><path d="M12 10.8v5.3"/><circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none"/>'),
    'con-msg': conSvg('<path d="M4.3 6.1h15.4v9.5H9.7L6.2 18.9v-3.3H4.3z"/><path d="M8 9.3h8M8 11.9h5"/>'),
    'con-star': conSvg('<path d="m12 3.6 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 10l6-.9z"/>'),
    'con-ease': conSvg('<circle cx="12" cy="4.7" r="1.7"/><path d="M4.9 8.4 12 10.6l7.1-2.2M12 10.6v4.1M12 14.7l-2.7 5.8M12 14.7l2.7 5.8"/>'),
    'con-update': conSvg('<path d="M19 12a7 7 0 1 1-2.1-5M19.4 4.3v4.2h-4.2"/>'),
    'con-cart': conSvg('<path d="M7.2 3.6h9.6v16.8H7.2z"/><path d="M7.2 7.4h9.6M10.2 12.2h3.6"/>')
  };
  const CON_CHEVRON = '<svg class="g-con-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9 5 7 7-7 7"/></svg>';
  const conGlyph = name => CON_GLYPHS[name] || (typeof gIcon === 'function' ? gIcon(name) : '');
  // The console's own settings screen, page by page. Rows: [glyph, label, value]; '›' draws a chevron.
  const CONSOLES = {
    ps3: {
      mark: 'PLAYSTATION®3', meta: 'SYSTEM SOFTWARE 4.90',
      root: ['Settings', [
        ['con-disc', 'System Update', '4.90'], ['con-pad', 'Game Settings', '›'], ['con-display', 'Display Settings', 'HDMI'],
        ['con-speaker', 'Sound Settings', 'Dolby Digital'], ['con-theme', 'Theme Settings', 'Original'], ['con-clock', 'Date and Time Settings', 'Automatic'],
        ['con-gear', 'System Settings', '4.90'], ['con-usb', 'Accessory Settings', 'Controller 1'], ['con-globe', 'Network Settings', 'Connected'],
        ['con-shield', 'Security Settings', 'On'], ['con-bell', 'Notification Settings', 'On']
      ]],
      pages: {
        services: ['Game Settings', [
          ['con-pad', 'Game Data Utility', '›'], ['con-save', 'Saved Data Utility (PS3™)', '›'], ['con-disc', 'Blu-ray Disc Utility', '›'], ['con-pad', 'PS Button Assignments', 'Game']
        ]],
        accessibility: ['Display Settings', [
          ['con-display', 'Video Output Settings', 'HDMI'], ['con-display', 'Cross Colour Reduction Filter', 'Off'],
          ['con-display', 'RGB Full Range (HDMI)', 'Limited'], ['con-display', 'Deep Colour Output (HDMI)', 'Automatic']
        ]],
        audio: ['Sound Settings', [
          ['con-speaker', 'Audio Output Settings', 'HDMI'], ['con-speaker', 'BD Audio Output Format', 'Bitstream (Direct)'], ['con-disc', 'Audio CD Output Frequency', '44.1/88.2 kHz']
        ]],
        personalization: ['Theme Settings', [
          ['con-theme', 'Theme', 'Original'], ['con-photo', 'Background', 'Original'], ['con-font', 'Font', 'Rounded'], ['con-color', 'Colour', 'Blue']
        ]],
        'g-language': ['Date and Time Settings', [
          ['con-clock', 'Set via Internet', 'On'], ['con-clock', 'Date and Time', '17/10/2026 22:41'], ['con-globe', 'Time Zone', '(GMT+11:00) Sydney']
        ]],
        'g-storage': ['System Settings', [
          ['con-gear', 'System Information', 'Version 4.90'], ['con-update', 'System Update', 'Latest'],
          ['con-globe', 'System Language', 'English (United Kingdom)'], ['con-save', 'Backup Utility', '›']
        ]],
        'g-input': ['Accessory Settings', [
          ['con-pad', 'Wireless Controller', 'Controller 1'], ['con-headset', 'Audio Device Settings', 'HDMI'], ['con-keyboard', 'Keyboard Layout', 'United Kingdom']
        ]],
        'g-streaming': ['Network Settings', [
          ['con-globe', 'Internet Connection', 'Enabled'], ['con-wifi', 'Wireless LAN', 'Connected'],
          ['con-info', 'Network Connection Status', 'Connected'], ['con-globe', 'UPnP', 'On']
        ]],
        'g-privacy': ['Security Settings', [
          ['con-shield', 'Change Password', '›'], ['con-lock', 'Parental Control', 'Off'], ['con-globe', 'Media Server Connection', 'Enabled']
        ]],
        'g-notifications': ['Notification Settings', [
          ['con-bell', 'Notification Messages', 'On'], ['con-trophy', 'Trophy Notifications', 'On'], ['con-msg', 'Message Notifications', 'On']
        ]],
        'g-account': ['Account Management', [
          ['con-user', 'Account Information', 'Signed In'], ['con-shop', 'Transaction Management', '›'], ['con-tag', 'Redeem Codes', '›']
        ]]
      }
    },
    ps4: {
      mark: 'PlayStation®4', meta: 'SYSTEM SOFTWARE 11.00',
      root: ['Settings', [
        ['con-user', 'Account Management', '›'], ['con-shield', 'Privacy & Security', '›'], ['con-bell', 'Notifications', 'On'],
        ['con-pad', 'Devices', '›'], ['con-display', 'Sound and Screen', 'HDMI'], ['con-globe', 'Network', 'Connected'],
        ['con-gear', 'System', '11.00'], ['con-power', 'Power Saving Settings', 'Automatic'], ['con-save', 'Application Saved Data Management', '›']
      ]],
      pages: {
        'g-account': ['Account Management', [
          ['con-user', 'Account Information', 'Signed In'], ['con-shield', 'Security', '2-Step Verification'], ['con-tag', 'Wallet', 'AU$0.00']
        ]],
        'g-privacy': ['Privacy & Security', [
          ['con-shield', 'Privacy Settings', 'Friends'], ['con-eye', 'Online Status', 'Visible'], ['con-lock', 'Parental Controls', 'Off']
        ]],
        'g-notifications': ['Notifications', [
          ['con-bell', 'Notifications', 'On'], ['con-download', 'Download Notifications', 'On'], ['con-msg', 'Message Notifications', 'On']
        ]],
        'g-input': ['Devices', [
          ['con-pad', 'Controllers', '1 Connected'], ['con-headset', 'Audio Devices', 'Headset'], ['con-keyboard', 'Keyboard', 'Default']
        ]],
        audio: ['Sound and Screen', [
          ['con-display', 'Video Output', '1080p'], ['con-speaker', 'Audio Output', 'HDMI'], ['con-display', 'HDR', 'Automatic']
        ]],
        'g-streaming': ['Network', [
          ['con-globe', 'Internet Connection', 'Connected'], ['con-wifi', 'Wi-Fi', '5 GHz'], ['con-globe', 'Test Internet Connection', '›']
        ]],
        personalization: ['Themes', [
          ['con-theme', 'Theme', 'Dynamic'], ['con-photo', 'Background', 'Default'], ['con-color', 'Accent Colour', 'Blue']
        ]],
        'g-storage': ['System', [
          ['con-gear', 'System Information', '11.00'], ['con-update', 'System Software Update', 'Latest'],
          ['con-download', 'Power Saving Settings', 'Automatic'], ['con-save', 'Application Saved Data Management', '›']
        ]],
        'g-language': ['Language', [
          ['con-globe', 'System Language', 'English (United Kingdom)'], ['con-region', 'Region', 'Australia'], ['con-clock', 'Date and Time', 'Automatic']
        ]],
        accessibility: ['Accessibility', [
          ['con-ease', 'Accessibility', 'On'], ['con-font', 'Larger Text', 'Off'], ['con-eye', 'High Contrast', 'Off']
        ]],
        services: ['Application Data', [
          ['con-save', 'Application Saved Data', '›'], ['con-folder', 'Saved Data in System Storage', '1.2 GB'], ['con-cloud', 'Saved Data in Online Storage', '›']
        ]]
      }
    },
    wii: {
      mark: 'Wii', meta: 'Wii SYSTEM 4.3',
      root: ['Wii Settings', [
        ['con-gear', 'Console Settings', 'Wii'], ['con-calendar', 'Calendar', '17 Oct'], ['con-globe', 'Internet', 'Connected'],
        ['con-speaker', 'Sound', 'Stereo'], ['con-display', 'Screen', '16:9'], ['con-sensor', 'Sensor Bar', 'Top'],
        ['con-lock', 'Parental Controls', 'Off'], ['con-remote', 'Wii Remote Settings', '2'], ['con-save', 'Data Management', '›']
      ], 'PAGE 1 OF 3'],
      pages: {
        audio: ['Wii Settings · Page 1', [
          ['con-gear', 'Console Nickname', 'Wii'], ['con-display', 'TV Resolution', 'EDTV (480p)'], ['con-speaker', 'Sound', 'Stereo']
        ]],
        'g-language': ['Calendar', [
          ['con-calendar', 'Calendar', '17 October 2026'], ['con-clock', 'Time', '10:44 PM'], ['con-clock', 'Date', '17/10/2026']
        ]],
        'g-streaming': ['Internet', [
          ['con-globe', 'Internet Connection', 'Connected'], ['con-wifi', 'Connection 1', 'WPA2-PSK'], ['con-wifi', 'Test Connection', '›']
        ]],
        personalization: ['Screen', [
          ['con-display', 'Screen Position', 'Centred'], ['con-display', 'Screen Size', 'Normal'],
          ['con-display', 'TV Resolution', 'EDTV (480p)'], ['con-eye', 'Burn-in Reduction', 'On']
        ]],
        'g-input': ['Sensor Bar', [
          ['con-sensor', 'Sensor Bar Position', 'Top'], ['con-sensor', 'Sensitivity', '3'], ['con-remote', 'Wii Remote Settings', '›']
        ]],
        'g-privacy': ['Parental Controls', [
          ['con-lock', 'Parental Controls', 'Off'], ['con-lock', 'PIN', 'Not Set'], ['con-globe', 'Country', 'Australia']
        ]],
        accessibility: ['Wii Remote Settings', [
          ['con-remote', 'Wii Remote 1', 'Connected'], ['con-speaker', 'Speaker', 'On'], ['con-sensor', 'Sensor Bar Sensitivity', '3']
        ]],
        'g-notifications': ['WiiConnect24', [
          ['con-globe', 'WiiConnect24', 'On'], ['con-msg', 'Message Board', 'On'], ['con-bell', 'Notifications', 'On']
        ]],
        'g-storage': ['Data Management', [
          ['con-save', 'Save Data', '1.4 GB'], ['con-folder', 'Channels', '12 Installed'], ['con-trash', 'Delete Data', '›']
        ]],
        services: ['Wii Channels', [
          ['con-disc', 'Disc Channel', '›'], ['con-shop', 'Wii Shop Channel', '›'], ['con-folder', 'SD Card Menu', '2.4 GB Free']
        ]],
        'g-account': ['Wii Shop Account', [
          ['con-shop', 'Wii Shop Channel', 'Signed In'], ['con-tag', 'Wii Points', '1,500'], ['con-tag', 'Redeem Wii Points Card', '›']
        ]]
      }
    },
    '3ds': {
      mark: 'Nintendo 3DS', meta: 'SYSTEM VERSION 11.17',
      root: ['System Settings', [
        ['con-globe', 'Internet Settings', 'Connected'], ['con-lock', 'Parental Controls', 'Off'], ['con-save', 'Data Management', '2.4 GB'],
        ['con-user', 'Profile', 'Player'], ['con-clock', 'Date & Time', 'Automatic'], ['con-region', 'Region Settings', 'Australia'],
        ['con-theme', 'Theme', 'Mint'], ['con-amiibo', 'amiibo Settings', '0']
      ]],
      pages: {
        'g-streaming': ['Internet Settings', [
          ['con-globe', 'Connection Settings', 'Connection 1'], ['con-wifi', 'Internet Connection', 'Connected'], ['con-wifi', 'Test Connection', '›']
        ]],
        'g-privacy': ['Parental Controls', [
          ['con-lock', 'Parental Controls', 'Off'], ['con-lock', 'Change PIN', '›'], ['con-region', 'Region', 'Australia']
        ]],
        'g-storage': ['Data Management', [
          ['con-save', 'Nintendo 3DS Data', '1.8 GB'], ['con-folder', 'SD Card', '8 GB (4.2 GB Free)'], ['con-trash', 'Delete Data', '›']
        ]],
        'g-account': ['Profile', [
          ['con-user', 'User Name', 'Player'], ['con-photo', 'Profile', 'Mii'], ['con-star', 'Favourite Title', 'Mario Kart 7']
        ]],
        'g-language': ['Date & Time', [
          ['con-clock', 'Date', '17/10/2026'], ['con-clock', 'Time', '22:45'], ['con-clock', 'Clock Type', '24-Hour']
        ]],
        audio: ['Sound', [
          ['con-speaker', 'Speaker Volume', '4'], ['con-speaker', 'System Sounds', 'On'], ['con-download', 'Download Notifications', 'On']
        ]],
        accessibility: ['Region Settings', [
          ['con-region', 'Country', 'Australia'], ['con-globe', 'Language', 'English'], ['con-clock', 'Time Zone', 'GMT+11:00']
        ]],
        personalization: ['Theme', [
          ['con-theme', 'Theme', 'Mint'], ['con-color', 'Colour', 'Mint'], ['con-photo', 'Background', 'Default']
        ]],
        'g-input': ['amiibo Settings', [
          ['con-amiibo', 'amiibo', 'Scan'], ['con-user', 'Owner', 'Player'], ['con-save', 'Registered amiibo', '0']
        ]],
        'g-notifications': ['Notifications', [
          ['con-bell', 'SpotPass', 'On'], ['con-msg', 'Notifications', 'On'], ['con-eye', 'Friend Presence', 'On']
        ]],
        services: ['Software', [
          ['con-cart', 'Software', '32 Titles'], ['con-download', 'Download Software', '›'], ['con-update', 'Update', 'Latest']
        ]]
      }
    },
    x360: {
      mark: 'XBOX 360', meta: 'DASHBOARD 2.0.17559',
      root: ['System Settings', [
        ['settings', 'Console Settings', 'Xbox 360'], ['globe', 'Network Settings', 'Connected'], ['drive', 'Storage', '12.4 GB Free'],
        ['controller', 'Controllers', '1'], ['volume', 'Audio', 'Dolby Digital'], ['language', 'Language and Locale', 'English'], ['tv', 'Display', '1080p']
      ]],
      pages: {
        personalization: ['Console Settings', [
          ['tv', 'Display', '1080p'], ['volume', 'Audio', 'Dolby Digital'], ['language', 'Language and Locale', 'English'], ['info', 'System Info', '2.0.17559']
        ]],
        'g-streaming': ['Network Settings', [
          ['globe', 'Network', 'Connected'], ['download', 'Test Xbox LIVE Connection', '›'], ['info', 'Network Status', 'Wired']
        ]],
        'g-storage': ['Storage', [
          ['drive', 'Hard Drive', '12.4 GB Free'], ['folder', 'Memory Unit', '›'], ['download', 'Transfer Content', '›']
        ]],
        'g-input': ['Controllers', [
          ['controller', 'Controller 1', 'Connected'], ['headset', 'Headset', 'Wireless'], ['settings', 'Vibration', 'On']
        ]],
        audio: ['Audio', [
          ['volume', 'Dolby Digital', 'On'], ['volume', 'Digital Output', 'Optical'], ['pause', 'Mute', 'Off']
        ]],
        'g-language': ['Language and Locale', [
          ['language', 'Language', 'English'], ['globe', 'Locale', 'Australia'], ['settings', 'Clock', '24-Hour']
        ]],
        'g-account': ['Profile', [
          ['contact', 'Gamertag', 'Player'], ['star', 'Gamerscore', '12,450'], ['people', 'Avatar', '›']
        ]],
        'g-privacy': ['Privacy', [
          ['shield', 'Online Safety', 'Friends Only'], ['eye', 'Visible', 'Everyone'], ['help', 'Family Settings', '›']
        ]],
        'g-notifications': ['Notifications', [
          ['bell', 'Notifications', 'On'], ['friends', 'Friend Requests', 'On'], ['download', 'Download Alerts', 'On']
        ]],
        accessibility: ['Ease of Access', [
          ['ease', 'Closed Captioning', 'Off'], ['settings', 'Screen Magnifier', 'Off'], ['volume', 'Mono Audio', 'Off']
        ]],
        services: ['Game Libraries', [
          ['library', 'Games', '214'], ['folder', 'Memory', '›'], ['download', 'Downloads', '2 Queued']
        ]]
      }
    },
    series: {
      mark: 'XBOX SERIES X|S', meta: 'OS 10.0.26100',
      root: ['Settings', [
        ['home', 'General', '›'], ['contact', 'Account', '›'], ['controller', 'Devices & connections', '2'],
        ['settings', 'Preferences', '›'], ['ease', 'Accessibility', 'Off'], ['info', 'System', '›']
      ]],
      pages: {
        personalization: ['Personalization', [
          ['color', 'Theme', 'Dark'], ['photo', 'Background', 'Green Swirl'], ['settings', 'Motion', 'Full']
        ]],
        audio: ['Volume & audio output', [
          ['volume', 'Volume', '70'], ['headset', 'Headset Format', 'Stereo Uncompressed'], ['tv', 'Audio Output', 'HDMI']
        ]],
        'g-account': ['Profile & system', [
          ['contact', 'Gamertag', 'Player'], ['star', 'Gamerscore', '12,450'], ['settings', 'Console Info', 'Xbox Series X']
        ]],
        'g-privacy': ['Privacy & online safety', [
          ['shield', 'Privacy', 'Friends'], ['eye', 'Online Status', 'Everyone'], ['help', 'App Permissions', '›']
        ]],
        'g-input': ['Controllers & headsets', [
          ['controller', 'Controller', '1 Connected'], ['headset', 'Headset', 'Wireless'], ['settings', 'Accessory Power', 'After 15 Min']
        ]],
        'g-streaming': ['Remote features', [
          ['stream', 'Remote Play', 'On'], ['download', 'Remote Install', 'On'], ['globe', 'Network', 'Connected']
        ]],
        'g-notifications': ['Notifications', [
          ['bell', 'Notifications', 'On'], ['friends', 'Friend Requests', 'On'], ['download', 'Download Alerts', 'On']
        ]],
        services: ['Manage games & add-ons', [
          ['library', 'Games', '214'], ['download', 'Queue', '2'], ['folder', 'Storage', '12.4 GB Free']
        ]],
        accessibility: ['Accessibility', [
          ['ease', 'Accessibility', 'On'], ['settings', 'Colour Filters', 'Off'], ['volume', 'Mono Audio', 'Off']
        ]],
        'g-language': ['Language & location', [
          ['language', 'Language', 'English (UK)'], ['globe', 'Location', 'Australia'], ['settings', 'Time Format', '24-Hour']
        ]],
        'g-storage': ['Storage devices', [
          ['drive', 'Internal Storage', '12.4 GB Free'], ['folder', 'External Storage', 'Not Connected'], ['delete', 'Clear Local Data', '›']
        ]]
      }
    },
    one: {
      mark: 'XBOX ONE', meta: 'OS 6.2.9781',
      root: ['Settings', [
        ['globe', 'Network', 'Connected'], ['tv', 'Display & sound', '1080p'], ['settings', 'Preferences', '›'],
        ['ease', 'Ease of Access', 'Off'], ['controller', 'Devices', '2'], ['info', 'System', '›'],
        ['shield', 'Privacy & online safety', '›'], ['contact', 'Account', 'Player']
      ]],
      pages: {
        'g-streaming': ['Network', [
          ['globe', 'Network', 'Connected'], ['settings', 'Network Settings', 'Custom'], ['info', 'Test Connection', '›']
        ]],
        audio: ['Display & sound', [
          ['tv', 'Display', '1080p'], ['volume', 'Volume', '70'], ['settings', 'Audio Output', 'HDMI']
        ]],
        personalization: ['Preferences', [
          ['color', 'Theme', 'Dark'], ['settings', 'Motion', 'Full'], ['photo', 'Background', '›']
        ]],
        accessibility: ['Ease of Access', [
          ['ease', 'Ease of Access', 'On'], ['settings', 'Magnifier', 'Off'], ['volume', 'Mono Audio', 'Off']
        ]],
        'g-input': ['Devices', [
          ['controller', 'Controller', '1 Connected'], ['headset', 'Headset', 'Wireless'], ['settings', 'Accessories', '›']
        ]],
        'g-storage': ['System', [
          ['info', 'Console Info', 'Xbox One'], ['download', 'Updates', 'Automatic'], ['drive', 'Storage', '12.4 GB Free']
        ]],
        'g-language': ['Language & location', [
          ['language', 'Language', 'English (UK)'], ['globe', 'Location', 'Australia'], ['settings', 'Time Format', '24-Hour']
        ]],
        'g-notifications': ['Notifications', [
          ['bell', 'Notifications', 'On'], ['friends', 'Friend Requests', 'On'], ['download', 'Download Alerts', 'On']
        ]],
        'g-privacy': ['Privacy & online safety', [
          ['shield', 'Privacy', 'Friends'], ['eye', 'Online Status', 'Everyone'], ['help', 'App Permissions', '›']
        ]],
        'g-account': ['Account', [
          ['contact', 'Gamertag', 'Player'], ['star', 'Gamerscore', '12,450'], ['shield', 'Sign-in & Security', '›']
        ]],
        services: ['Games & apps', [
          ['library', 'Games', '214'], ['download', 'Queue', '2'], ['folder', 'Storage', '12.4 GB Free']
        ]]
      }
    }
  };
  const conValue = value => value === '›'
    ? `<span class="g-con-option-value is-chevron">${CON_CHEVRON}</span>`
    : `<span class="g-con-option-value">${conEscape(value)}</span>`;
  const conRow = ([glyph, label, value]) => `<div class="g-con-option"><span class="g-con-option-icon">${conGlyph(glyph)}</span><span class="g-con-option-label">${conEscape(label)}</span>${conValue(value)}</div>`;
  function conBlock(key, pageId, spec) {
    const con = CONSOLES[key];
    const [title, rows, meta] = spec;
    const block = document.createElement('div');
    block.className = 'g-con-options g-con-options--' + key + (pageId === 'experience' ? ' g-con-options--index' : '');
    block.dataset.gCon = key;
    block.dataset.gConPage = pageId;
    block.setAttribute('aria-hidden', 'true');
    block.innerHTML = `<div class="g-con-options-head"><span class="g-con-options-mark">${conEscape(con.mark)}</span>`
      + `<strong class="g-con-options-title">${conEscape(title)}</strong><span class="g-con-options-meta">${conEscape(meta || con.meta)}</span></div>`
      + `<div class="g-con-options-list">${rows.map(conRow).join('')}</div>`;
    return block;
  }
  // The landing page (the launcher's General hub) lists the console's whole settings column; every other page
  // shows the options that console kept under that heading.
  function paintConsole() {
    const key = theme();
    const con = CONSOLES[key];
    document.querySelectorAll('#settings-dialog .settings-page[data-settings-page]').forEach(page => {
      const id = page.dataset.settingsPage;
      const spec = con && (id === 'experience' ? con.root : con.pages[id]);
      const current = page.querySelector(':scope > .g-con-options');
      if (!spec) { current?.remove(); return; }
      if (current && current.dataset.gCon === key && current.dataset.gConPage === id) return;
      current?.remove();
      page.prepend(conBlock(key, id, spec));
    });
  }
  // A page can be shown, hidden or (for late pages such as connections) added later; painting again is cheap and
  // idempotent, and the observer lets that happen without polling.
  const conScroll = document.querySelector('#settings-dialog .settings-scroll');
  let conQueued = false;
  const queueConsole = () => {
    if (conQueued) return;
    conQueued = true;
    queueMicrotask(() => { conQueued = false; paintConsole(); });
  };
  if (conScroll) new MutationObserver(queueConsole).observe(conScroll, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

  new MutationObserver(apply).observe(document.body, { attributes: true, attributeFilter: ['data-g-theme'] });
  document.querySelector('#settings-dialog')?.addEventListener('toggle', apply);
  setTimeout(apply, 0);
})();
