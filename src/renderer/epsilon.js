const $ = id => document.getElementById(id);
let config;
let serverOnline = false;
let launching = false;

function toast(message) {
  const element = $('toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 3500);
}

function updateLaunchButton() {
  const button = $('launchButton');
  button.disabled = launching || !serverOnline;
  if (!launching) {
    button.querySelector('small').textContent = serverOnline
      ? 'Connexion directe à EPSILON'
      : 'Serveur actuellement hors ligne';
  }
}

function busy(value) {
  launching = value;
  updateLaunchButton();
  if (value) $('progressWrap').style.display = 'block';
}

function showServerStatus(status) {
  const online = status?.online === true;
  serverOnline = online;
  const element = $('epsilonServerStatus');
  element.classList.toggle('online', online);
  element.classList.toggle('offline', !online);
  element.classList.remove('checking');
  element.querySelector('b').textContent = online
    ? 'EPSILON est en ligne'
    : (status?.message || 'EPSILON est hors ligne');
  updateLaunchButton();
}

async function refreshServerStatus() {
  try {
    showServerStatus(await window.launcher.serverStatus());
  } catch (_) {
    showServerStatus({ online: false, message: 'Statut du serveur indisponible' });
  }
}

window.launcher.onProgress(progress => {
  $('progressBar').style.width = `${progress.percent}%`;
  $('progressPercent').textContent = `${progress.percent}%`;
  $('progressText').textContent = progress.message;
});

async function init() {
  config = await window.launcher.settings();
  $('username').value = config.authMode === 'microsoft'
    ? (config.displayName || 'Compte Microsoft')
    : (config.username || '');
  $('username').readOnly = config.authMode === 'microsoft';
  await refreshServerStatus();
  setInterval(refreshServerStatus, 15000);
}

$('launchButton').onclick = async () => {
  await refreshServerStatus();
  if (!serverOnline) {
    toast('EPSILON est actuellement hors ligne.');
    return;
  }
  busy(true);
  try {
    await window.launcher.saveSettings({ ...config, username: $('username').value });
    await window.launcher.launchGame({ username: $('username').value });
    toast('Minecraft démarre…');
  } catch (error) {
    toast(`Erreur : ${error.message}`);
  } finally {
    busy(false);
  }
};

init().catch(error => toast(error.message));
