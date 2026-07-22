const $ = id => document.getElementById(id);
let config;

function toast(message, title = 'TOMIZECORP') {
  const element = $('toast');
  element.innerHTML = `<img src="assets/tomizecorp-logo.png" alt=""><div><b>${title}</b><span></span></div>`;
  element.querySelector('span').textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 3800);
}
function showUser(name) {
  $('accountName').textContent = name || 'Se connecter';
  document.querySelector('.avatar').textContent = (name || '?')[0].toUpperCase();
  $('logoutButton').hidden = !name;
}
const remember = () => $('rememberSession').checked;
const loginCredentials = () => ({ username: $('loginName').value.trim(), password: $('loginPassword').value, rememberSession: remember() });
const registerCredentials = () => ({ username: $('registerName').value.trim(), password: $('registerPassword').value, rememberSession: remember() });

async function openServer() {
  config = await window.launcher.settings();
  if (!config.authMode) {
    if (!$('loginDialog').open) $('loginDialog').showModal();
    return;
  }
  await window.launcher.openEpsilon();
}

function applyUpdateState(update) {
  const dialog = $('updateDialog');
  const blocking = ['checking','available','downloading','ready','failed','installing'].includes(update?.state);
  if (!blocking) {
    if (dialog.open) dialog.close();
    if (config && !config.authMode && !$('loginDialog').open) $('loginDialog').showModal();
    if (update?.state === 'error') toast(update.message || 'La vérification des mises à jour est indisponible.');
    return;
  }
  if ($('loginDialog').open) $('loginDialog').close();
  if (!dialog.open) dialog.showModal();
  const percent = update.state === 'checking' ? 8 : Math.max(0, Math.min(100, Number(update.percent || 0)));
  $('updateProgressBar').style.width = `${percent}%`;
  $('updatePercent').textContent = update.state === 'checking' ? '…' : `${percent}%`;
  $('updateMessage').textContent = update.message || 'Préparation de la mise à jour…';
  $('updateStatus').textContent = ({checking:'VÉRIFICATION',available:'NOUVELLE VERSION',downloading:'TÉLÉCHARGEMENT',ready:'INSTALLATION',installing:'REDÉMARRAGE AUTOMATIQUE',failed:'NOUVELLE TENTATIVE REQUISE'})[update.state];
  $('updateTitle').textContent = update.state === 'installing' ? 'Installation de la mise à jour' : update.state === 'failed' ? 'Mise à jour obligatoire' : update.state === 'downloading' ? `Téléchargement ${update.version || ''}` : update.state === 'available' ? `TomizeCorpLauncher ${update.version}` : 'Recherche d’une mise à jour';
  $('installUpdate').hidden = !['available','failed'].includes(update.state);
  $('installUpdate').innerHTML = update.state === 'failed' ? 'RÉESSAYER <b>↻</b>' : 'METTRE À JOUR <b>↓</b>';
  $('installUpdate').dataset.action = update.state;
}

window.launcher.onUpdateState(applyUpdateState);
$('installUpdate').onclick = async () => {
  $('installUpdate').disabled = true;
  if ($('installUpdate').dataset.action === 'failed') {
    await window.launcher.retryUpdate();
    $('installUpdate').disabled = false;
  } else {
    $('installUpdate').textContent = 'DÉMARRAGE…';
    await window.launcher.startUpdate();
  }
};

let skinImage = null;
let skinRotation = 0;
let skinPitch = 0;
let skinDrag = null;

const skinFaces = {
  front: { head:[8,8,8,8],hat:[40,8,8,8],body:[20,20,8,12],jacket:[20,36,8,12],rightArm:[44,20,4,12],rightSleeve:[44,36,4,12],leftArm:[36,52,4,12],leftSleeve:[52,52,4,12],rightLeg:[4,20,4,12],rightPants:[4,36,4,12],leftLeg:[20,52,4,12],leftPants:[4,52,4,12] },
  right: { head:[0,8,8,8],hat:[32,8,8,8],body:[16,20,4,12],jacket:[16,36,4,12],rightArm:[40,20,4,12],rightSleeve:[40,36,4,12],leftArm:[32,52,4,12],leftSleeve:[48,52,4,12],rightLeg:[0,20,4,12],rightPants:[0,36,4,12],leftLeg:[16,52,4,12],leftPants:[0,52,4,12] },
  back: { head:[24,8,8,8],hat:[56,8,8,8],body:[32,20,8,12],jacket:[32,36,8,12],rightArm:[52,20,4,12],rightSleeve:[52,36,4,12],leftArm:[44,52,4,12],leftSleeve:[60,52,4,12],rightLeg:[12,20,4,12],rightPants:[12,36,4,12],leftLeg:[28,52,4,12],leftPants:[12,52,4,12] },
  left: { head:[16,8,8,8],hat:[48,8,8,8],body:[28,20,4,12],jacket:[28,36,4,12],rightArm:[48,20,4,12],rightSleeve:[48,36,4,12],leftArm:[40,52,4,12],leftSleeve:[56,52,4,12],rightLeg:[8,20,4,12],rightPants:[8,36,4,12],leftLeg:[24,52,4,12],leftPants:[8,52,4,12] }
};

function drawSkinRegion(context, region, x, y, width, height) {
  if (!region || region[1] + region[3] > skinImage.height) return;
  context.drawImage(skinImage, ...region, x, y, width, height);
}

function drawSkin() {
  if (!skinImage) return;
  const canvas = $('skinPreview');
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (Math.abs(skinPitch) >= 42) {
    drawSkinVertical(context, skinPitch > 0);
    return;
  }
  const views = ['front','right','back','left'];
  const view = views[Math.round(((skinRotation % 360) + 360) % 360 / 90) % 4];
  const face = skinFaces[view];
  const side = view === 'left' || view === 'right';
  const headX = 78, bodyX = side ? 94 : 78, bodyWidth = side ? 32 : 64;
  const armWidth = 32, leftArmX = side ? 62 : 46, rightArmX = side ? 126 : 142;
  const leftArm = skinImage.height < 64 ? face.rightArm : face.leftArm;
  const leftLeg = skinImage.height < 64 ? face.rightLeg : face.leftLeg;
  drawSkinRegion(context, face.head, headX, 12, 64, 64);
  drawSkinRegion(context, face.hat, headX, 12, 64, 64);
  drawSkinRegion(context, face.body, bodyX, 76, bodyWidth, 96);
  drawSkinRegion(context, face.jacket, bodyX, 76, bodyWidth, 96);
  drawSkinRegion(context, leftArm, leftArmX, 76, armWidth, 96);
  drawSkinRegion(context, face.leftSleeve, leftArmX, 76, armWidth, 96);
  drawSkinRegion(context, face.rightArm, rightArmX, 76, armWidth, 96);
  drawSkinRegion(context, face.rightSleeve, rightArmX, 76, armWidth, 96);
  drawSkinRegion(context, leftLeg, 78, 172, 32, 96);
  drawSkinRegion(context, face.leftPants, 78, 172, 32, 96);
  drawSkinRegion(context, face.rightLeg, 110, 172, 32, 96);
  drawSkinRegion(context, face.rightPants, 110, 172, 32, 96);
  context.fillStyle = '#aaa';
  context.font = '11px sans-serif';
  context.textAlign = 'center';
  context.fillText({front:'AVANT',right:'CÔTÉ DROIT',back:'DOS',left:'CÔTÉ GAUCHE'}[view], 110, 302);
}

function drawSkinVertical(context, fromTop) {
  const surfaces = fromTop ? {head:[8,0,8,8],hat:[40,0,8,8],body:[20,16,8,4],jacket:[20,32,8,4],rightArm:[44,16,4,4],rightSleeve:[44,32,4,4],leftArm:[36,48,4,4],leftSleeve:[52,48,4,4],rightLeg:[4,16,4,4],rightPants:[4,32,4,4],leftLeg:[20,48,4,4],leftPants:[4,48,4,4]} : {head:[16,0,8,8],hat:[48,0,8,8],body:[28,16,8,4],jacket:[28,32,8,4],rightArm:[48,16,4,4],rightSleeve:[48,32,4,4],leftArm:[40,48,4,4],leftSleeve:[56,48,4,4],rightLeg:[8,16,4,4],rightPants:[8,32,4,4],leftLeg:[24,48,4,4],leftPants:[8,48,4,4]};
  const views = ['front','right','back','left'];
  const face = skinFaces[views[Math.round(((skinRotation % 360) + 360) % 360 / 90) % 4]];
  const legacy = skinImage.height < 64;
  if (fromTop) {
    drawSkinRegion(context, surfaces.head, 78, 8, 64, 36); drawSkinRegion(context, surfaces.hat, 78, 8, 64, 36);
    drawSkinRegion(context, face.head, 78, 44, 64, 48); drawSkinRegion(context, face.hat, 78, 44, 64, 48);
    drawSkinRegion(context, surfaces.body, 82, 96, 56, 18); drawSkinRegion(context, surfaces.jacket, 82, 96, 56, 18);
    drawSkinRegion(context, face.body, 82, 114, 56, 62); drawSkinRegion(context, face.jacket, 82, 114, 56, 62);
    drawSkinRegion(context, surfaces.rightArm, 50, 96, 24, 18); drawSkinRegion(context, face.rightArm, 50, 114, 24, 62);
    drawSkinRegion(context, legacy ? surfaces.rightArm : surfaces.leftArm, 146, 96, 24, 18); drawSkinRegion(context, legacy ? face.rightArm : face.leftArm, 146, 114, 24, 62);
    drawSkinRegion(context, surfaces.rightLeg, 82, 180, 26, 16); drawSkinRegion(context, face.rightLeg, 82, 196, 26, 62);
    drawSkinRegion(context, legacy ? surfaces.rightLeg : surfaces.leftLeg, 112, 180, 26, 16); drawSkinRegion(context, legacy ? face.rightLeg : face.leftLeg, 112, 196, 26, 62);
  } else {
    drawSkinRegion(context, face.head, 90, 18, 40, 40); drawSkinRegion(context, face.hat, 90, 18, 40, 40);
    drawSkinRegion(context, face.body, 84, 58, 52, 58); drawSkinRegion(context, face.jacket, 84, 58, 52, 58);
    drawSkinRegion(context, face.rightArm, 56, 58, 24, 58); drawSkinRegion(context, legacy ? face.rightArm : face.leftArm, 140, 58, 24, 58);
    drawSkinRegion(context, face.rightLeg, 78, 116, 30, 70); drawSkinRegion(context, legacy ? face.rightLeg : face.leftLeg, 112, 116, 30, 70);
    drawSkinRegion(context, surfaces.rightLeg, 68, 186, 42, 42); drawSkinRegion(context, surfaces.rightPants, 68, 186, 42, 42);
    drawSkinRegion(context, legacy ? surfaces.rightLeg : surfaces.leftLeg, 110, 186, 42, 42); drawSkinRegion(context, surfaces.leftPants, 110, 186, 42, 42);
  }
  context.fillStyle = '#aaa'; context.font = '11px sans-serif'; context.textAlign = 'center';
  context.fillText(fromTop ? 'VUE DU DESSUS' : 'VUE DU DESSOUS', 110, 302);
}

function renderSkinPreview(source) {
  const canvas = $('skinPreview');
  if (!source) { skinImage = null; canvas.hidden = true; return; }
  const image = new Image();
  image.onload = () => { skinImage = image; skinRotation = 0; skinPitch = 0; drawSkin(); canvas.hidden = false; };
  image.onerror = () => { skinImage = null; canvas.hidden = true; };
  image.src = source;
}

$('skinPreview').addEventListener('pointerdown', event => {
  skinDrag = { x:event.clientX, y:event.clientY, rotation:skinRotation, pitch:skinPitch };
  event.currentTarget.setPointerCapture(event.pointerId);
});
$('skinPreview').addEventListener('pointermove', event => {
  if (!skinDrag) return;
  skinRotation = skinDrag.rotation + (event.clientX - skinDrag.x) * 1.4;
  skinPitch = Math.max(-90, Math.min(90, skinDrag.pitch + (event.clientY - skinDrag.y) * 1.2));
  drawSkin();
});
$('skinPreview').addEventListener('pointerup', event => {
  skinDrag = null;
  event.currentTarget.releasePointerCapture(event.pointerId);
});
$('skinPreview').addEventListener('pointercancel', () => { skinDrag = null; });

// Véritable modèle 3D : les vues du dessus et du dessous viennent de la caméra,
// sans redimensionner ni déformer les différentes parties du skin.
const skin3dUvs = {
  head:{front:[8,8,8,8],back:[24,8,8,8],left:[16,8,8,8],right:[0,8,8,8],top:[8,0,8,8],bottom:[16,0,8,8]},
  body:{front:[20,20,8,12],back:[32,20,8,12],left:[28,20,4,12],right:[16,20,4,12],top:[20,16,8,4],bottom:[28,16,8,4]},
  rightArm:{front:[44,20,4,12],back:[52,20,4,12],left:[48,20,4,12],right:[40,20,4,12],top:[44,16,4,4],bottom:[48,16,4,4]},
  leftArm:{front:[36,52,4,12],back:[44,52,4,12],left:[40,52,4,12],right:[32,52,4,12],top:[36,48,4,4],bottom:[40,48,4,4]},
  rightLeg:{front:[4,20,4,12],back:[12,20,4,12],left:[8,20,4,12],right:[0,20,4,12],top:[4,16,4,4],bottom:[8,16,4,4]},
  leftLeg:{front:[20,52,4,12],back:[28,52,4,12],left:[24,52,4,12],right:[16,52,4,12],top:[20,48,4,4],bottom:[24,48,4,4]}
};
function skin3dFace(region,width,height,transform){
  const face=document.createElement('canvas'),scale=5;face.width=width*scale;face.height=height*scale;face.className='skin-face';
  face.style.cssText=`width:${face.width}px;height:${face.height}px;margin-left:${-face.width/2}px;margin-top:${-face.height/2}px;transform:${transform}`;
  const context=face.getContext('2d');context.imageSmoothingEnabled=false;context.drawImage(skinImage,...region,0,0,face.width,face.height);return face;
}
function skin3dPart(name,width,height,depth,x,y){
  const scale=5,uv=skin3dUvs[name],part=document.createElement('div');part.className='skin-part';part.style.transform=`translate3d(${x*scale}px,${y*scale}px,0)`;
  part.append(skin3dFace(uv.front,width,height,`translateZ(${depth*scale/2}px)`),skin3dFace(uv.back,width,height,`rotateY(180deg) translateZ(${depth*scale/2}px)`),skin3dFace(uv.left,depth,height,`rotateY(-90deg) translateZ(${width*scale/2}px)`),skin3dFace(uv.right,depth,height,`rotateY(90deg) translateZ(${width*scale/2}px)`),skin3dFace(uv.top,width,depth,`rotateX(90deg) translateZ(${height*scale/2}px)`),skin3dFace(uv.bottom,width,depth,`rotateX(-90deg) translateZ(${height*scale/2}px)`));return part;
}
function drawSkin(){const world=$('skinPreview').querySelector('.skin-world');if(world)world.style.transform=`rotateX(${skinPitch}deg) rotateY(${skinRotation}deg)`;}
function bindSkin3d(){const preview=$('skinPreview');if(preview.dataset.controlsBound)return;preview.dataset.controlsBound='1';
  preview.addEventListener('pointerdown',event=>{skinDrag={x:event.clientX,y:event.clientY,rotation:skinRotation,pitch:skinPitch};preview.setPointerCapture(event.pointerId);});
  preview.addEventListener('pointermove',event=>{if(!skinDrag)return;skinRotation=skinDrag.rotation+(event.clientX-skinDrag.x)*.8;skinPitch=Math.max(-90,Math.min(90,skinDrag.pitch-(event.clientY-skinDrag.y)*.6));drawSkin();});
  preview.addEventListener('pointerup',event=>{skinDrag=null;preview.releasePointerCapture(event.pointerId);});preview.addEventListener('pointercancel',()=>{skinDrag=null;});
}
function renderSkinPreview(source){
  let preview=$('skinPreview');if(!source){skinImage=null;preview.hidden=true;return;}const image=new Image();
  image.onload=()=>{skinImage=image;if(preview.tagName==='CANVAS'){const replacement=document.createElement('div');replacement.id='skinPreview';replacement.hidden=true;replacement.setAttribute('aria-label',preview.getAttribute('aria-label'));replacement.innerHTML='<div class="skin-world"></div>';preview.replaceWith(replacement);preview=replacement;}
    const world=preview.querySelector('.skin-world'),legacy=image.height<64;world.replaceChildren(skin3dPart('head',8,8,8,0,-8),skin3dPart('body',8,12,4,0,2),skin3dPart('rightArm',4,12,4,-6,2),skin3dPart(legacy?'rightArm':'leftArm',4,12,4,6,2),skin3dPart('rightLeg',4,12,4,-2,14),skin3dPart(legacy?'rightLeg':'leftLeg',4,12,4,2,14));skinRotation=0;skinPitch=-8;drawSkin();bindSkin3d();preview.hidden=false;};
  image.onerror=()=>{skinImage=null;preview.hidden=true;};image.src=source;
}

function renderFavorites() {
  const favorites = new Set(config.favorites || []);
  document.querySelectorAll('.game[data-server-id]').forEach(game => {
    const id = game.dataset.serverId;
    const toggle = game.querySelector('.favorite-toggle');
    const selected = favorites.has(id);
    toggle.classList.toggle('active', selected);
    toggle.textContent = selected ? '★' : '☆';
    toggle.title = selected ? 'Retirer des favoris' : 'Ajouter aux favoris';
    toggle.setAttribute('aria-label', `${selected ? 'Retirer' : 'Ajouter'} ${id} ${selected ? 'des' : 'aux'} favoris`);
  });
  $('favoriteServers').replaceChildren(...[...favorites].map(id => {
    const game = document.querySelector(`.game[data-server-id="${CSS.escape(id)}"]`);
    if (!game) return document.createDocumentFragment();
    const button = document.createElement('button');
    button.className = 'side favorite-server';
    button.title = game.querySelector('h3')?.textContent || id;
    button.innerHTML = `<img src="${game.querySelector('.poster img').getAttribute('src')}" alt="">`;
    button.onclick = openServer;
    return button;
  }));
}

async function toggleFavorite(game) {
  const id = game.dataset.serverId;
  const favorites = new Set(config.favorites || []);
  favorites.has(id) ? favorites.delete(id) : favorites.add(id);
  config = await window.launcher.saveSettings({ ...config, favorites: [...favorites] });
  renderFavorites();
}

async function init() {
  const dialog = $('loginDialog');
  dialog.addEventListener('cancel', event => event.preventDefault());
  $('updateDialog').addEventListener('cancel', event => event.preventDefault());
  config = await window.launcher.settings();
  showUser(config.authMode ? (config.displayName || config.username) : '');
  applyUpdateState(await window.launcher.updateState());
  renderFavorites();

  document.querySelectorAll('.game[data-server-id]').forEach(game => {
    game.querySelector('.favorite-toggle').onclick = event => { event.stopPropagation(); toggleFavorite(game).catch(error => toast(error.message)); };
    const poster = game.querySelector('.poster');
    poster.onclick = openServer;
    poster.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openServer(); } };
  });
}

$('serverSearch').addEventListener('input', event => {
  const query = event.target.value.trim().toLocaleLowerCase('fr');
  let visible = 0;
  $('featuredServer').hidden = Boolean(query);
  $('availableTitle').textContent = query ? `Résultats pour « ${event.target.value.trim()} »` : 'Serveur disponible';
  document.querySelectorAll('.game[data-server-id]').forEach(game => {
    const serverName = (game.querySelector('h3')?.textContent || '').trim().toLocaleLowerCase('fr');
    const matches = !query || serverName.includes(query);
    game.hidden = !matches;
    if (matches) visible++;
  });
  $('serverCount').textContent = String(visible);
});
$('homeButton').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

$('account').onclick = async () => {
  try {
    config = await window.launcher.settings();
    if (!config.authMode) { $('loginDialog').showModal(); return; }
    const account = await window.launcher.account();
    const official = account.mode === 'microsoft';
    $('accountMode').textContent = official ? 'COMPTE MICROSOFT' : 'COMPTE TOMIZECORP';
    $('accountLogo').src = official ? 'assets/microsoft-logo.svg' : 'assets/tomizecorp-logo.png';
    $('accountLogo').alt = official ? 'Microsoft' : 'TomizeCorp';
    $('accountUsername').value = account.username || '';
    $('accountUsername').disabled = official;
    $('passwordFields').hidden = official;
    $('saveAccount').hidden = official;
    $('chooseSkin').hidden = official;
    $('accountSkinNote').hidden = official;
    $('officialSkin').hidden = !official;
    $('skinFields').hidden = false;
    $('skinRotateHint').textContent = 'Glissez horizontalement pour tourner, verticalement pour voir le dessus et le dessous.';
    renderSkinPreview(account.preview || '');
    $('accountDialog').showModal();
  } catch (error) { toast(error.message); }
};
$('microsoftLogin').onclick = async () => { try { toast('Ouverture de la connexion Microsoft…'); const result = await window.launcher.loginMicrosoft(remember()); showUser(result.name); $('loginDialog').close(); toast('Connexion Microsoft réussie'); } catch (error) { toast(`Connexion Microsoft : ${error.message}`); } };
$('epsilonLogin').onclick = async () => { try { const result = await window.launcher.loginEpsilon(loginCredentials()); showUser(result.name); $('loginPassword').value = ''; $('loginDialog').close(); toast('Connexion EPSILON réussie'); } catch (error) { toast(error.message); } };
$('epsilonRegister').onclick = async () => { try { if ($('registerPassword').value !== $('registerConfirm').value) throw new Error('Les mots de passe sont différents.'); const result = await window.launcher.registerEpsilon(registerCredentials()); showUser(result.name); $('registerPassword').value = ''; $('registerConfirm').value = ''; $('loginDialog').close(); toast('Compte EPSILON créé'); } catch (error) { toast(error.message); } };
$('logoutButton').onclick = async () => { try { await window.launcher.logout(); config = await window.launcher.settings(); showUser(''); toast('Vous êtes déconnecté'); } catch (error) { toast(error.message); } };
$('closeAccount').onclick = () => $('accountDialog').close();
$('accountLogout').onclick = async () => { await window.launcher.logout(); config = await window.launcher.settings(); showUser(''); $('accountDialog').close(); $('loginDialog').showModal(); toast('Vous êtes déconnecté'); };
$('chooseSkin').onclick = async () => { try { const skin = await window.launcher.chooseSkin(); if (skin) { renderSkinPreview(skin.preview); toast('Skin enregistré pour TomizeCorp'); } } catch (error) { toast(error.message); } };
$('saveAccount').onclick = async () => { try { if ($('newPassword').value !== $('newPasswordConfirm').value) throw new Error('Les nouveaux mots de passe sont différents.'); const result = await window.launcher.updateAccount({ username: $('accountUsername').value.trim(), oldPassword: $('oldPassword').value, newPassword: $('newPassword').value, newPasswordConfirm: $('newPasswordConfirm').value }); showUser(result.username); $('oldPassword').value = ''; $('newPassword').value = ''; $('newPasswordConfirm').value = ''; $('accountDialog').close(); toast('Compte mis à jour'); } catch (error) { toast(error.message); } };
$('playButton').onclick = openServer;
init().catch(error => toast(error.message));
