// One-click console packs. OmniDash never ships console art, fonts or sounds; this downloads them, on the
// player's request, from the original public projects that publish them, straight into the player's own pack
// folder (%APPDATA%\xbox-preview-ui\theme-packs). Only the projects listed here can be fetched: the renderer
// names a pack id, never a URL.
//
// Each source is a GitHub repository downloaded as a branch zip. A source is placed one of two ways:
//   - whole: the zip's top folder (for example "Ps4-UI-master") becomes <pack folder>/<top folder>, which is
//     where the theme engines already look;
//   - pick: only the named subfolder's children are copied into the pack folder (DashX360 keeps its assets in
//     Assets/, and the 360 theme reads Audio/, Boot/ and Custom Files/ from the pack root).
// innerZip unpacks a zip that the project ships inside its repository (the PS3 sounds pack).
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { execFile } = require('node:child_process');

const SOURCES = {
  ps3: [
    { repo: 'CorruptionVR/PS3-Simulator', branch: 'main', licence: 'Unlicense', adds: 'XMB icons and the PS3 system font' },
    { repo: 'JMRDev0/XMB-PS3-Icons-Sounds-Pack-', branch: 'main', licence: 'MIT', adds: 'XMB sounds and menu music',
      innerZip: { file: 'PS3 Icons + Sounds.zip', to: 'pack' } }
  ],
  ps4: [{ repo: 'd4v1-sudo/Ps4-UI', branch: 'master', licence: 'MIT', adds: 'the wave background, icons, SST font and sounds' }],
  wii: [
    { repo: 'andrewplus/Wii.JS', branch: 'gh-pages', licence: 'GPL-3.0', adds: 'channel frames, buttons, cursor and sounds' },
    { repo: 'aica7/Liink', branch: 'main', licence: 'GPL-2.0', adds: 'the Rodin fonts' }
  ],
  x360: [{ repo: 'ZivvoZ/dashx360', branch: 'main', licence: 'none stated', adds: 'boot video, dashboard sounds, tiles and themes',
    pick: { folder: 'Assets', only: ['Audio', 'Boot', 'Custom Files', 'Tiles', 'Misc', 'References', 'Profile'] } }]
};
const FOLDERS = { ps3: 'ps3', ps4: 'ps4', wii: 'wii', x360: 'dashx360' };
const MAX_BYTES = 300 * 1024 * 1024;

function sourcesFor(id) {
  return (SOURCES[id] || []).map(source => ({ repo: source.repo, url: `https://github.com/${source.repo}`, licence: source.licence, adds: source.adds }));
}

// GET with redirects (codeload sometimes answers via a redirect), streamed to a file, size-capped.
function download(url, file, onBytes, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'OmniDash-pack-installer', Accept: 'application/zip' }, timeout: 30000 }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        response.resume();
        if (redirects > 5) { reject(new Error('Too many redirects while downloading the pack.')); return; }
        const next = new URL(response.headers.location, url);
        if (next.protocol !== 'https:' || !/(^|\.)github(usercontent)?\.com$/.test(next.hostname)) { reject(new Error('The pack download was redirected off GitHub.')); return; }
        download(next.href, file, onBytes, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`GitHub answered ${response.statusCode} for this pack.`)); return; }
      const out = fsSync.createWriteStream(file);
      let received = 0;
      response.on('data', chunk => {
        received += chunk.length;
        if (received > MAX_BYTES) { request.destroy(new Error('The pack download is larger than expected.')); return; }
        onBytes?.(received);
      });
      response.pipe(out);
      out.on('finish', () => out.close(() => resolve(received)));
      out.on('error', reject);
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('The pack download timed out.')));
    request.on('error', reject);
  });
}

// Extract with .NET, refusing any entry that would land outside the destination (zip-slip).
const EXTRACT_PS = [
  'Add-Type -AssemblyName System.IO.Compression.FileSystem',
  '$dest = [IO.Path]::GetFullPath($env:OD_DEST).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar',
  '$zip = [IO.Compression.ZipFile]::OpenRead($env:OD_ZIP)',
  'try {',
  '  foreach ($e in $zip.Entries) {',
  '    $target = [IO.Path]::GetFullPath([IO.Path]::Combine($dest, $e.FullName))',
  '    if (-not $target.StartsWith($dest, [StringComparison]::OrdinalIgnoreCase)) { throw "Unsafe path in pack: $($e.FullName)" }',
  '    if ($e.FullName.EndsWith("/")) { [IO.Directory]::CreateDirectory($target) | Out-Null; continue }',
  '    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null',
  '    [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $target, $true)',
  '  }',
  '} finally { $zip.Dispose() }'
].join('\n');
function extract(zip, dest) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', EXTRACT_PS],
      { env: { ...process.env, OD_ZIP: zip, OD_DEST: dest }, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 1024 * 1024 },
      (error, _stdout, stderr) => (error ? reject(new Error(String(stderr || error.message).trim().split('\n')[0] || 'Could not unpack the pack.')) : resolve()));
  });
}

async function replaceDir(from, to) {
  await fs.rm(to, { recursive: true, force: true });
  await fs.mkdir(path.dirname(to), { recursive: true });
  try { await fs.rename(from, to); } catch { await fs.cp(from, to, { recursive: true }); }
}

let busy = '';
async function install(root, id, onProgress = () => {}) {
  const sources = SOURCES[id];
  if (!sources) throw new Error('This console has no pack to install.');
  if (busy) throw new Error(`Already installing the ${busy} pack.`);
  busy = id;
  const work = path.join(root, '.install', `${id}-${Date.now()}`);
  const packDir = path.join(root, FOLDERS[id]);
  try {
    await fs.mkdir(work, { recursive: true });
    for (const [index, source] of sources.entries()) {
      const step = { id, repo: source.repo, part: index + 1, parts: sources.length };
      const zip = path.join(work, `${index}.zip`);
      onProgress({ ...step, phase: 'download', received: 0 });
      await download(`https://codeload.github.com/${source.repo}/zip/refs/heads/${source.branch}`, zip, received => onProgress({ ...step, phase: 'download', received }));
      onProgress({ ...step, phase: 'unpack' });
      const out = path.join(work, String(index));
      await extract(zip, out);
      const [top] = (await fs.readdir(out, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
      if (!top) throw new Error(`${source.repo} downloaded empty.`);
      onProgress({ ...step, phase: 'place' });
      if (source.pick) {
        const base = path.join(out, top, source.pick.folder);
        await fs.mkdir(packDir, { recursive: true });
        for (const name of source.pick.only) {
          const from = path.join(base, name);
          if (fsSync.existsSync(from)) await replaceDir(from, path.join(packDir, name));
        }
      } else {
        const target = path.join(packDir, top);
        await replaceDir(path.join(out, top), target);
        if (source.innerZip) {
          const inner = path.join(target, source.innerZip.file);
          if (fsSync.existsSync(inner)) await extract(inner, path.join(target, source.innerZip.to));
        }
      }
    }
    const credit = sources.map(source => `${source.repo} (${source.licence}) - ${source.adds}`).join('\n');
    await fs.writeFile(path.join(packDir, 'INSTALLED-BY-OMNIDASH.txt'),
      `Installed by OmniDash on ${new Date().toISOString()} from:\n${credit}\n\nThese files belong to their authors and the companies whose consoles they depict. They are for your own use;\nOmniDash does not host or redistribute them.\n`);
    onProgress({ id, phase: 'done' });
    return { ok: true, folder: FOLDERS[id] };
  } finally {
    busy = '';
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
    await fs.rmdir(path.join(root, '.install')).catch(() => {}); // only when no other install left files there
  }
}

module.exports = { SOURCES, FOLDERS, sourcesFor, install };
