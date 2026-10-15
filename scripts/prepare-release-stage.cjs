// Keep packaging independent of unrelated files and local data in the workspace.
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const runtime = await require('./prepare-streaming.cjs').prepareStreaming();
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  const stage = path.join(root, '.beta-build-stage', `release-${pkg.version}`);
  await fs.mkdir(stage, { recursive: true });
  for (const folder of ['src', 'build']) await fs.cp(path.join(root, folder), path.join(stage, folder), { recursive: true });
  await fs.cp(runtime, path.join(stage, '.packaging-staging', 'streamlight'), { recursive: true });
  for (const name of Object.keys(pkg.dependencies || {})) {
    const source = await fs.realpath(path.join(root, 'node_modules', name));
    const destination = path.join(stage, 'node_modules', name);
    const existing = await fs.lstat(destination).catch(error => { if(error.code==='ENOENT')return null;throw error; });
    // pnpm may turn the staging dependency into a junction during rebuild.
    if(existing?.isSymbolicLink()) await fs.unlink(destination);
    await fs.cp(source, destination, { recursive: true });
  }
  delete pkg.devDependencies;
  for (const filename of ['pnpm-lock.yaml', 'pnpm-workspace.yaml']) await fs.copyFile(path.join(root, filename), path.join(stage, filename));
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify(pkg, null, 2));
  console.log(stage);
})().catch(error => { console.error(error); process.exitCode = 1; });
