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

function renderSkinPreview(source) {
  const canvas = $('skinPreview');
  if (!source) { canvas.hidden = true; return; }
  const image = new Image();
  image.onload = () => {
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, 96, 96);
    context.drawImage(image, 8, 8, 8, 8, 0, 0, 96, 96);
    if (image.width >= 64) context.drawImage(image, 40, 8, 8, 8, 0, 0, 96, 96);
    canvas.hidden = false;
  };
  image.onerror = () => { canvas.hidden = true; };
  image.src = source;
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
  document.querySelectorAll('.game[data-server-id]').forEach(game => {
    const matches = !query || game.dataset.search.toLocaleLowerCase('fr').includes(query);
    game.hidden = !matches;
    if (matches) visible++;
  });
  $('serverCount').textContent = String(visible);
  $('emptySearch').hidden = visible !== 0;
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
