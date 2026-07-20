const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const crypto = require('crypto');
const https = require('https');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const extractZip = require('extract-zip');
const DiscordRPC = require('discord-rpc');

const configPath = path.join(__dirname, '..', 'config', 'launcher.json');
const defaultInstance = path.join(app.getPath('appData'), '.epsilon');
let activeSession = null;
let hubWindow = null;
let discordClient = null;
app.setAppUserModelId('fr.tomizecorp.launcher');

async function readJson(file) { return JSON.parse(await fs.readFile(file, 'utf8')); }
async function validJsonFile(file) { try { const content=await fs.readFile(file,'utf8');if(!content.trim())return false;JSON.parse(content);return true;} catch (_) { return false; } }
async function repairMinecraftFiles(version,win) {
  const { diagnose }=await import('@xmcl/core');
  let report=await diagnose(version.id,version.minecraftDirectory);
  const repairable=report.issues.map(issue=>{
    if(issue.role==='asset'){const hash=issue.expectedChecksum||issue.asset?.hash;return hash?{file:issue.file,hash,url:`https://resources.download.minecraft.net/${hash.slice(0,2)}/${hash}`}:null;}
    if(issue.role==='library'){const item=issue.library?.download;return item?.url&&item?.sha1?{file:issue.file,hash:item.sha1,url:item.url}:null;}
    return null;
  }).filter(Boolean);
  let cursor=0,completed=0;
  async function worker(){
    while(cursor<repairable.length){
      const item=repairable[cursor++],temporary=`${item.file}.epsilon-repair`;
      for(let attempt=1;attempt<=4;attempt++){
        try{
          const response=await fetch(item.url,{signal:AbortSignal.timeout(60000)});
          if(!response.ok)throw new Error(`HTTP ${response.status}`);
          const data=Buffer.from(await response.arrayBuffer()),actual=crypto.createHash('sha1').update(data).digest('hex');
          if(actual!==item.hash)throw new Error('Empreinte SHA-1 incorrecte');
          await fs.mkdir(path.dirname(item.file),{recursive:true});await fs.writeFile(temporary,data);await fs.rename(temporary,item.file);break;
        }catch(error){await fs.unlink(temporary).catch(()=>{});if(attempt===4)throw error;await new Promise(resolve=>setTimeout(resolve,attempt*500));}
      }
      completed++;if(completed%25===0||completed===repairable.length)win.webContents.send('sync-progress',{percent:Math.min(94,72+Math.round(completed/Math.max(1,repairable.length)*22)),message:`Réparation Minecraft ${completed}/${repairable.length}`});
    }
  }
  if(repairable.length)await Promise.all(Array.from({length:10},worker));
  report=await diagnose(version.id,version.minecraftDirectory);
  if(report.issues.length)throw new Error(`${report.issues.length} fichier(s) Minecraft restent incomplets. Relancez la réparation.`);
}
const scrypt = (password, salt) => new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, key) => error ? reject(error) : resolve(key.toString('hex'))));
async function localAccounts() { try { return await readJson(path.join(app.getPath('userData'),'accounts.json')); } catch (_) { return {}; } }
async function saveLocalAccounts(accounts) { await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(path.join(app.getPath('userData'),'accounts.json'),JSON.stringify(accounts,null,2)); }
function validateCredentials(value) { const username=String(value?.username||'').trim(),password=String(value?.password||'');if(!/^[A-Za-z0-9_]{3,16}$/.test(username))throw new Error('Pseudo invalide (3 à 16 caractères).');if(password.length<8||password.length>128)throw new Error('Le mot de passe doit contenir 8 à 128 caractères.');return{username,password}; }
async function setDiscordMode(mode) {
  const settings=await loadSettings(),discord=settings.discord||{};
  const epsilon=mode==='epsilon',clientId=epsilon?discord.epsilonApplicationId:discord.tomizeCorpApplicationId;
  if(discordClient){try{discordClient.destroy()}catch(_){}discordClient=null;}
  if(!/^\d{17,20}$/.test(clientId||''))return;
  DiscordRPC.register(clientId);const client=new DiscordRPC.Client({transport:'ipc'});discordClient=client;
  client.on('ready',()=>client.setActivity({details:epsilon?'Survie EPSILON':'TomizeCorpLauncher',state:epsilon?'Connecté à EpsilonLauncher':'Dans le launcher',startTimestamp:new Date(),largeImageKey:epsilon?discord.epsilonLargeImageKey:discord.tomizeCorpLargeImageKey,largeImageText:epsilon?'EpsilonLauncher':'TomizeCorpLauncher',instance:false}).catch(()=>{}));
  client.login({clientId}).catch(()=>{if(discordClient===client)discordClient=null;});
}
function configureAutoUpdater() {
  if(!app.isPackaged)return;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;autoUpdater.allowPrerelease=false;
  autoUpdater.on('update-downloaded',async info=>{const result=await dialog.showMessageBox({type:'info',title:'Mise à jour TomizeCorpLauncher',message:`La version ${info.version} est prête.`,detail:'Redémarrer maintenant pour terminer la mise à jour ?',buttons:['Redémarrer maintenant','Plus tard'],defaultId:0,cancelId:1,noLink:true});if(result.response===0)autoUpdater.quitAndInstall(false,true);});
  autoUpdater.on('error',error=>console.warn('Auto-update:',error.message));
  setTimeout(()=>autoUpdater.checkForUpdatesAndNotify().catch(()=>{}),4000);
}
async function loadSettings() {
  const base = await readJson(configPath);
  const userPath = path.join(app.getPath('userData'), 'settings.json');
  let user = {};
  try { user = await readJson(userPath); } catch (_) {}
  return { ...base, instancePath: defaultInstance, javaPath: '', username: '', authMode: '', displayName: '', ...user };
}
async function saveSettings(value) {
  const clean = { instancePath: value.instancePath, javaPath: value.javaPath, username: value.username, authMode: value.authMode, displayName: value.displayName };
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(path.join(app.getPath('userData'), 'settings.json'), JSON.stringify(clean, null, 2));
  return loadSettings();
}
function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fsSync.createReadStream(file);
    input.on('error', reject); input.on('data', d => hash.update(d)); input.on('end', () => resolve(hash.digest('hex')));
  });
}
function safeTarget(root, relative) {
  const normalized = relative.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('../')) throw new Error(`Chemin refusé : ${relative}`);
  const target = path.resolve(root, normalized);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error(`Chemin hors instance : ${relative}`);
  return target;
}
function download(url, destination, onProgress) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if ([301,302,307,308].includes(response.statusCode)) return resolve(download(new URL(response.headers.location, url).href, destination, onProgress));
      if (response.statusCode !== 200) return reject(new Error(`Téléchargement impossible (${response.statusCode})`));
      const total = Number(response.headers['content-length'] || 0); let received = 0;
      response.on('data', chunk => { received += chunk.length; if (onProgress && total) onProgress(received / total); });
      pipeline(response, fsSync.createWriteStream(destination)).then(resolve, reject);
    });
    request.setTimeout(30000, () => request.destroy(new Error('Délai de téléchargement dépassé')));
    request.on('error', reject);
  });
}
async function obtainManifest(settings) {
  if (/^https:\/\//i.test(settings.manifestUrl)) {
    const temp = path.join(app.getPath('temp'), `epsilon-manifest-${Date.now()}.json`);
    await download(settings.manifestUrl, temp);
    const result = await readJson(temp); await fs.unlink(temp).catch(() => {}); return result;
  }
  return readJson(path.resolve(path.dirname(configPath), settings.manifestUrl));
}
async function synchronize(win) {
  const settings = await loadSettings();
  const root = path.resolve(settings.instancePath);
  await fs.mkdir(root, { recursive: true });
  win.webContents.send('sync-progress', { phase: 'scan', percent: 4, message: 'Lecture du manifeste…' });
  const manifest = await obtainManifest(settings);
  if (!Array.isArray(manifest.files)) throw new Error('Le manifeste ne contient pas de liste de fichiers.');
  const previousPath = path.join(root, '.epsilon-managed.json');
  let previous = [];
  try { previous = (await readJson(previousPath)).files || []; } catch (_) {}
  const wanted = new Set(manifest.files.map(f => f.path));
  for (const old of previous) {
    if (!wanted.has(old)) await fs.unlink(safeTarget(root, old)).catch(() => {});
  }
  let changed = 0;
  for (let i = 0; i < manifest.files.length; i++) {
    const entry = manifest.files[i];
    if (!/^[a-f0-9]{64}$/i.test(entry.sha256)) throw new Error(`Empreinte invalide : ${entry.path}`);
    const target = safeTarget(root, entry.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    let current = ''; try { current = await sha256(target); } catch (_) {}
    if (current.toLowerCase() !== entry.sha256.toLowerCase()) {
      const temporary = `${target}.download`;
      const source = /^https:\/\//i.test(entry.url) ? entry.url : path.resolve(path.dirname(configPath), entry.url);
      if (/^https:\/\//i.test(source)) await download(source, temporary); else await fs.copyFile(source, temporary);
      if ((await sha256(temporary)).toLowerCase() !== entry.sha256.toLowerCase()) { await fs.unlink(temporary).catch(() => {}); throw new Error(`Fichier corrompu : ${entry.path}`); }
      await fs.rename(temporary, target); changed++;
    }
    win.webContents.send('sync-progress', { phase: 'files', percent: Math.round(8 + ((i + 1) / Math.max(1, manifest.files.length)) * 88), message: `Vérification ${i + 1}/${manifest.files.length}` });
  }
  await fs.writeFile(previousPath, JSON.stringify({ version: manifest.version, files: [...wanted] }, null, 2));
  win.webContents.send('sync-progress', { phase: 'done', percent: 100, message: changed ? `${changed} fichier(s) mis à jour` : 'Instance déjà à jour' });
  return { changed, total: manifest.files.length };
}
function offlineUuid(name) {
  const bytes = crypto.createHash('md5').update(`OfflinePlayer:${name}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
async function checkJava(javaPath) {
  if (!javaPath || !fsSync.existsSync(javaPath)) throw new Error('Java est absent.');
  return new Promise((resolve, reject) => { const p=spawn(javaPath,['-version']); let out=''; p.stderr.on('data',d=>out+=d); p.on('error',reject); p.on('close',c=>{const m=out.match(/version "(\d+)/);c===0&&m&&Number(m[1])>=21?resolve(out):reject(new Error('Java 21 ou supérieur est nécessaire.'));}); });
}
async function findJava(dir) {
  for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
    const item=path.join(dir,entry.name);
    if(entry.isDirectory()){const found=await findJava(item);if(found)return found;}
    else if(((process.platform==='win32'&&entry.name.toLowerCase()==='javaw.exe')||(process.platform!=='win32'&&entry.name==='java'))&&path.basename(path.dirname(item)).toLowerCase()==='bin')return item;
  }
  return null;
}
async function ensureJava(settings, win) {
  try { await checkJava(settings.javaPath); return settings.javaPath; } catch (_) {}
  const runtimeRoot=path.join(settings.instancePath,'runtime','java-21');
  try { const existing=await findJava(runtimeRoot);if(existing){await checkJava(existing);await saveSettings({...settings,javaPath:existing});return existing;} } catch (_) {}
  await fs.mkdir(runtimeRoot,{recursive:true});
  const isMac=process.platform==='darwin';
  if(process.platform!=='win32'&&!isMac)throw new Error('Ce système n’est pas encore pris en charge.');
  const archive=path.join(app.getPath('temp'),isMac?'epsilon-java21.tar.gz':'epsilon-java21.zip');
  const os=isMac?'mac':'windows',arch=process.arch==='arm64'?'aarch64':'x64';
  win.webContents.send('sync-progress',{percent:5,message:'Installation automatique de Java 21…'});
  await download(`https://api.adoptium.net/v3/binary/latest/21/ga/${os}/${arch}/jre/hotspot/normal/eclipse`,archive,ratio=>win.webContents.send('sync-progress',{percent:Math.round(5+ratio*18),message:`Téléchargement de Java 21 — ${Math.round(ratio*100)}%`}));
  win.webContents.send('sync-progress',{percent:24,message:'Préparation du moteur Java…'});
  if(isMac){const tar=require('tar');await tar.x({file:archive,cwd:runtimeRoot});}else await extractZip(archive,{dir:runtimeRoot});
  await fs.unlink(archive).catch(()=>{});
  const javaPath=await findJava(runtimeRoot);if(!javaPath)throw new Error('Le runtime Java téléchargé est incomplet.');
  await checkJava(javaPath);await saveSettings({...settings,javaPath});return javaPath;
}
async function installAndLaunch(win, profile) {
  const settings = await loadSettings();
  const microsoft = settings.authMode === 'microsoft' && activeSession;
  const username = String(microsoft ? activeSession.name : (profile?.username || settings.username || '')).trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error('Le pseudo doit contenir 3 à 16 lettres, chiffres ou _.');
  const javaPath=await ensureJava(settings,win);
  await saveSettings({ ...settings, username, javaPath });
  win.webContents.send('sync-progress', { percent: 3, message: 'Synchronisation EPSILON…' });
  await synchronize(win);
  const { getVersionList, install, installAssets, installFabric, installDependencies } = await import('@xmcl/installer');
  const { launch, Version } = await import('@xmcl/core');
  const versionJson = path.join(settings.instancePath, 'versions', settings.minecraftVersion, `${settings.minecraftVersion}.json`);
  if (!fsSync.existsSync(versionJson)) {
    win.webContents.send('sync-progress', { percent: 15, message: `Installation de Minecraft ${settings.minecraftVersion}…` });
    const list = await getVersionList(); const meta = list.versions.find(v => v.id === settings.minecraftVersion);
    if (!meta) throw new Error(`Minecraft ${settings.minecraftVersion} est introuvable.`);
    await install(meta, settings.instancePath);
  }
  if(!(await validJsonFile(versionJson))){await fs.unlink(versionJson).catch(()=>{});throw new Error('Installation Minecraft incomplète. Relancez le jeu pour la réparer.');}
  const vanillaVersion=await Version.parse(settings.instancePath,settings.minecraftVersion);
  const assetIndex=path.join(settings.instancePath,'assets','indexes',`${vanillaVersion.assets}.json`);
  if(!(await validJsonFile(assetIndex))){
    win.webContents.send('sync-progress',{percent:72,message:'Réparation de l’index des assets Minecraft…'});
    await fs.unlink(assetIndex).catch(()=>{});
    for(let attempt=1;attempt<=3;attempt++){
      await installAssets(vanillaVersion);
      if(await validJsonFile(assetIndex))break;
      await fs.unlink(assetIndex).catch(()=>{});
      if(attempt===3)throw new Error('Impossible de réparer les assets Minecraft. Vérifiez votre connexion puis réessayez.');
    }
  }
  const fabricLoader='0.19.3',fabricVersion=`${settings.minecraftVersion}-fabric${fabricLoader}`;
  const fabricJson=path.join(settings.instancePath,'versions',fabricVersion,`${fabricVersion}.json`);
  if(!(await validJsonFile(fabricJson))){
    win.webContents.send('sync-progress',{percent:66,message:'Installation du moteur EpsilonLauncher…'});
    await installFabric({minecraftVersion:settings.minecraftVersion,version:fabricLoader,minecraft:settings.instancePath,side:'client'});
  }
  const resolvedVersion=await Version.parse(settings.instancePath,fabricVersion);
  await installDependencies(resolvedVersion);
  win.webContents.send('sync-progress',{percent:70,message:'Vérification complète de Minecraft…'});
  await repairMinecraftFiles(resolvedVersion,win);
  win.webContents.send('sync-progress', { percent: 96, message: 'Connexion directe au serveur…' });
  const child = await launch({ gamePath: settings.instancePath, javaPath, version: fabricVersion, versionName: 'EpsilonLauncher', versionType: 'EpsilonLauncher', gameName: 'EpsilonLauncher', gameProfile: { name: username, id: microsoft ? activeSession.id : offlineUuid(username) }, accessToken: microsoft ? activeSession.accessToken : '0', userType: microsoft ? 'mojang' : 'legacy', launcherName: 'EpsilonLauncher', launcherBrand: 'TomizeCorp', minMemory: 1024, maxMemory: 4096, quickPlayMultiplayer: `${settings.serverAddress}:${settings.serverPort}`, server: { ip: settings.serverAddress, port: settings.serverPort }, extraExecOption: { detached: true } });
  child.unref(); win.webContents.send('sync-progress', { percent: 100, message: 'Minecraft lancé sur EPSILON' });
  setTimeout(() => win.hide(), 1200); return { started: true };
}
function createWindow() {
  const win = new BrowserWindow({ width: 1180, height: 760, minWidth: 900, minHeight: 620, backgroundColor: '#000000', icon: path.join(__dirname, 'renderer', 'assets', 'tomizecorp-logo.png'), titleBarStyle: 'hiddenInset', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  hubWindow = win; win.on('closed',()=>{if(hubWindow===win)hubWindow=null});
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  setDiscordMode('tomize').catch(()=>{});
}
function createEpsilonWindow() {
  const existing = BrowserWindow.getAllWindows().find(w => w.getTitle() === 'EpsilonLauncher');
  if (existing) { existing.show(); existing.focus(); return existing; }
  const win = new BrowserWindow({ width: 1020, height: 680, minWidth: 820, minHeight: 580, backgroundColor: '#000000', icon: path.join(__dirname, 'renderer', 'assets', 'epsilon-logo.png'), title: 'EpsilonLauncher', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true } });
  win.loadFile(path.join(__dirname, 'renderer', 'epsilon.html'));setDiscordMode('epsilon').catch(()=>{});return win;
}
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  ipcMain.handle('settings:get', loadSettings);
  ipcMain.handle('settings:save', (_, value) => saveSettings(value));
  ipcMain.handle('epsilon:open', () => { const epsilon=createEpsilonWindow();epsilon.once('ready-to-show',()=>{if(hubWindow&&!hubWindow.isDestroyed())hubWindow.close()});return true; });
  ipcMain.handle('auth:offline', async (_, username) => { const name=String(username||'').trim(); if(!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Pseudo invalide (3 à 16 caractères).'); activeSession=null; const s=await loadSettings(); await saveSettings({...s,username:name,displayName:name,authMode:'offline'}); return {name,mode:'offline'}; });
  ipcMain.handle('auth:register', async (_, value) => { const {username,password}=validateCredentials(value),accounts=await localAccounts(),key=username.toLowerCase();if(accounts[key])throw new Error('Ce pseudo existe déjà sur ce PC.');const salt=crypto.randomBytes(16).toString('hex');accounts[key]={username,salt,hash:await scrypt(password,salt),createdAt:new Date().toISOString()};await saveLocalAccounts(accounts);activeSession={type:'local',name:username};const s=await loadSettings();await saveSettings({...s,username,displayName:username,authMode:'epsilon'});return{name:username,mode:'epsilon'}; });
  ipcMain.handle('auth:login', async (_, value) => { const {username,password}=validateCredentials(value),accounts=await localAccounts(),account=accounts[username.toLowerCase()];if(!account)throw new Error('Compte introuvable sur cet appareil. Utilisez Créer un compte.');const actual=Buffer.from(await scrypt(password,account.salt),'hex'),expected=Buffer.from(account.hash,'hex');if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected))throw new Error('Pseudo ou mot de passe incorrect.');activeSession={type:'local',name:account.username};const s=await loadSettings();await saveSettings({...s,username:account.username,displayName:account.username,authMode:'epsilon'});return{name:account.username,mode:'epsilon'}; });
  ipcMain.handle('auth:microsoft', async () => {
    const { Authflow,Titles }=require('prismarine-auth');
    const cacheDir=path.join(app.getPath('userData'),'microsoft-auth');
    await fs.mkdir(cacheDir,{recursive:true});
    const flow=new Authflow('epsilon-player',cacheDir,{flow:'sisu',authTitle:Titles.MinecraftJava,deviceType:'Win32'},code=>{
      const verificationUrl=code.verification_uri_complete||code.verificationUriComplete||`https://microsoft.com/link?otc=${encodeURIComponent(code.user_code)}`;
      require('electron').clipboard.writeText(code.user_code||'');
      shell.openExternal(verificationUrl).catch(()=>{});
      dialog.showMessageBox(hubWindow,{type:'info',title:'Connexion Microsoft — EpsilonLauncher',message:'Terminez la connexion dans votre navigateur.',detail:`Code Microsoft : ${code.user_code}\n\nLe code a été copié automatiquement. Revenez ensuite dans le launcher.`,buttons:['J’ai compris'],icon:path.join(__dirname,'renderer','assets','epsilon-logo.png'),noLink:true}).catch(()=>{});
    });
    const mc=await flow.getMinecraftJavaToken({fetchProfile:true,fetchEntitlements:true});
    if(!mc.profile?.name||!mc.profile?.id)throw new Error('Ce compte ne possède pas de profil Minecraft Java.');
    activeSession={name:mc.profile.name,id:mc.profile.id,accessToken:mc.token};
    const s=await loadSettings();await saveSettings({...s,username:activeSession.name,displayName:activeSession.name,authMode:'microsoft'});
    return{name:activeSession.name,mode:'microsoft'};
  });
  ipcMain.handle('game:launch', (event, profile) => installAndLaunch(BrowserWindow.fromWebContents(event.sender), profile));
  ipcMain.handle('folder:pick', async () => (await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })).filePaths[0] || null);
  ipcMain.handle('file:pick', async () => (await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'Exécutable', extensions: ['exe'] }] })).filePaths[0] || null);
  ipcMain.handle('instance:open', async () => shell.openPath((await loadSettings()).instancePath));
  ipcMain.handle('server:copy', async (_, address) => require('electron').clipboard.writeText(address));
  ipcMain.handle('sync:start', async event => synchronize(BrowserWindow.fromWebContents(event.sender)));
  ipcMain.handle('play', () => { createEpsilonWindow(); return true; });
  createWindow();
  configureAutoUpdater();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
