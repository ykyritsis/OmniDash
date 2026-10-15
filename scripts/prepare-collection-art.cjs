// Encode generated art for bundled cards; never overwrites the source PNGs.
// Run with Electron: electron scripts/prepare-collection-art.cjs <source-manifest.json>
const { app, nativeImage } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  try {
    const root = path.resolve(__dirname, '..'), destination = path.join(root, 'src/renderer/assets/collections');
    const manifest = JSON.parse(await fs.readFile(process.argv[2], 'utf8'));
    const entries = Array.isArray(manifest) ? manifest : manifest.assets;
    const prompts = [];
    for (const entry of entries) {
      const target = path.resolve(root, entry.file);
      if (!target.startsWith(destination + path.sep) || !/^[a-z0-9-]+$/.test(entry.slug) || !entry.source?.endsWith('.png')) throw Error('Invalid artwork destination');
      const source = nativeImage.createFromPath(entry.source);
      if (source.isEmpty()) throw Error(`Cannot decode ${entry.name}`);
      const { width, height } = source.getSize();
      const maxWidth = entry.kind === 'publisher' ? 640 : 960;
      const image = width > maxWidth ? source.resize({ width:maxWidth, quality:'best' }) : source;
      await fs.mkdir(path.dirname(target), { recursive:true });
      const bytes = image.toJPEG(90);
      await fs.writeFile(target, bytes);
      prompts.push({kind:entry.kind,name:entry.name,file:entry.file,method:entry.method||'Built-in image_gen',references:entry.sourceReferences||[],sourceDimensions:{width,height},bundledDimensions:image.getSize(),bytes:bytes.length,prompt:entry.prompt});
    }
    await fs.writeFile(path.join(root,'docs/collection-artwork-prompts.json'),JSON.stringify({tools:[...new Set(prompts.map(p=>p.method))],date:'2026-10-15',artDirection:'Approved EA card: authentic promotional source imagery, restrained campaign layout and faithful flat logos.',assets:prompts,textFallbacks:manifest.textFallbacks||[]},null,2));
    console.log(`Saved ${prompts.length} collection artworks (${(prompts.reduce((n,a)=>n+a.bytes,0)/1048576).toFixed(2)} MB)`);
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
