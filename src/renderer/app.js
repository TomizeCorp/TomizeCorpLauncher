const $ = id => document.getElementById(id);
let config;

function toast(message) {
  const element = $('toast');
  element.textContent = message;
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

let skinImage = null;
let skinRotation = 0;
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

function renderSkinPreview(source) {
  const canvas = $('skinPreview');
  if (!source) { skinImage = null; canvas.hidden = true; return; }
  const image = new Image();
  image.onload = () => { skinImage = image; skinRotation = 0; drawSkin(); canvas.hidden = false; };
  image.onerror = () => { skinImage = null; canvas.hidden = true; };
  image.src = source;
}

$('skinPreview').addEventListener('pointerdown', event => {
  skinDrag = { x:event.clientX, rotation:skinRotation };
  event.currentTarget.setPointerCapture(event.pointerId);
});
$('skinPreview').addEventListener('pointermove', event => {
  if (!skinDrag) return;
  skinRotation = skinDrag.rotation + (event.clientX - skinDrag.x) * 1.4;
  drawSkin();
});
$('skinPreview').addEventListener('pointerup', event => {
  skinDrag = null;
  event.currentTarget.releasePointerCapture(event.pointerId);
});
$('skinPreview').addEventListener('pointercancel', () => { skinDrag = null; });

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
  config = await window.launcher.settings();
  showUser(config.authMode ? (config.displayName || config.username) : '');
  if (!config.authMode && !dialog.open) dialog.showModal();
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
    const matches = !query || game.dataset.search.toLocaleLowerCase('fr').includes(query);
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
    $('accountMode').textContent = official ? 'COMPTE MICROSOFT' : 'COMPTE EPSILON';
    $('accountUsername').value = account.username || '';
    $('accountUsername').disabled = official;
    $('passwordFields').hidden = official;
    $('saveAccount').hidden = official;
    $('chooseSkin').hidden = official;
    $('officialSkin').hidden = !official;
    $('skinFields').hidden = false;
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
$('chooseSkin').onclick = async () => { try { const skin = await window.launcher.chooseSkin(); if (skin) { renderSkinPreview(skin.preview); toast('Skin enregistré pour EpsilonLauncher'); } } catch (error) { toast(error.message); } };
$('saveAccount').onclick = async () => { try { if ($('newPassword').value !== $('newPasswordConfirm').value) throw new Error('Les nouveaux mots de passe sont différents.'); const result = await window.launcher.updateAccount({ username: $('accountUsername').value.trim(), oldPassword: $('oldPassword').value, newPassword: $('newPassword').value, newPasswordConfirm: $('newPasswordConfirm').value }); showUser(result.username); $('oldPassword').value = ''; $('newPassword').value = ''; $('newPasswordConfirm').value = ''; $('accountDialog').close(); toast('Compte mis à jour'); } catch (error) { toast(error.message); } };
$('playButton').onclick = openServer;
init().catch(error => toast(error.message));
