// Reproducible, installer-free preparation of the native streaming component.
// The original StreamLight binary and its runtime are extracted unchanged.
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const root=path.resolve(__dirname,'..');
const runtime=path.join(root,'.packaging-staging','streamlight');
const work=path.join(root,'.packaging-staging','streamlight-build');
const installerHash='0a5df7a3780fffd2820c25722ae6123b9a30ceb4ea8ec7ac63f1039fce8a1c5c';
const unpackerHash='f2f037fdbc63de31248efae9ccb294398d160dc0cbad5f36d14c2f159e17bbf5';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function download(url,file,expected){
  let bytes=await fs.readFile(file).catch(()=>null);
  if(bytes&&hash(bytes)===expected)return;
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`Download failed: HTTP ${response.status}`);
  bytes=Buffer.from(await response.arrayBuffer());
  if(hash(bytes)!==expected)throw new Error('Streaming download checksum mismatch.');
  await fs.writeFile(file,bytes);
}
async function manifest(folder,prefix=''){
  const files={};for(const entry of await fs.readdir(path.join(folder,prefix),{withFileTypes:true})){
    const name=path.join(prefix,entry.name);
    if(entry.isDirectory())Object.assign(files,await manifest(folder,name));
    else if(name!=='runtime-manifest.json')files[name.replaceAll('\\','/')]=hash(await fs.readFile(path.join(folder,name)));
  }return files;
}
async function prepareStreaming(){
  if(process.platform!=='win32')throw new Error('Prepare the Windows streaming runtime on Windows.');
  await fs.mkdir(work,{recursive:true});await fs.mkdir(runtime,{recursive:true});
  if(!await fs.access(path.join(runtime,'runtime','StreamLight.exe')).then(()=>true,()=>false)){
    const installer=path.join(work,'StreamLight-7.0.0.exe'),unpacker=path.join(work,'innounp.zip');
    await Promise.all([
      download('https://github.com/FoggyBytes/StreamLight/releases/download/v7.0.0/StreamLight_7.0.0_Installer.exe',installer,installerHash),
      download('https://raw.githubusercontent.com/jrathlev/InnoUnpacker-Windows-GUI/6fb49264aacf512a093e7b4fc6fb3dd266dad31a/innounp-2/bin/innounp-2.zip',unpacker,unpackerHash)
    ]);
    const quote=value=>"'"+value.replaceAll("'","''")+"'";
    await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath ${quote(unpacker)} -DestinationPath ${quote(path.join(work,'innounp'))} -Force`],{windowsHide:true});
    await exec(path.join(work,'innounp','innounp.exe'),['-x','-b','-q','-y',`-d${path.join(work,'extracted')}`,installer],{windowsHide:true,maxBuffer:2*1024*1024});
    await fs.cp(path.join(work,'extracted','{app}'),path.join(runtime,'runtime'),{recursive:true});
  }
  await exec(path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/nowarn:0649','/target:exe','/platform:x64','/reference:System.Web.Extensions.dll',`/out:${path.join(runtime,'WindowBridge.exe')}`,path.join(root,'src','remote-play','WindowBridge.cs')],{windowsHide:true});
  await fs.copyFile(path.join(root,'src','remote-play','LICENSE.StreamLight'),path.join(runtime,'LICENSE.StreamLight'));
  await exec(path.join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe','/platform:x64',`/out:${path.join(runtime,'WindowsShell.exe')}`,path.join(root,'src','WindowsShell.cs')],{windowsHide:true});
  const data={engine:'StreamLight',version:'7.0.0',source:'https://github.com/FoggyBytes/StreamLight/tree/v7.0.0',installerSha256:installerHash,files:await manifest(runtime)};
  await fs.writeFile(path.join(runtime,'runtime-manifest.json'),JSON.stringify(data,null,2));
  console.log(`Prepared StreamLight ${data.version} and native window bridge (${Object.keys(data.files).length} files).`);
  return runtime;
}
module.exports={prepareStreaming};
if(require.main===module)prepareStreaming().catch(error=>{console.error(error.message);process.exitCode=1;});
