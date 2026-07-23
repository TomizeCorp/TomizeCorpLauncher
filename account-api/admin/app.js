const $ = id => document.getElementById(id);
let token = sessionStorage.getItem('tomizeAdminToken') || '';
let requestToken = '';
let timer;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({ error: 'Réponse invalide du serveur.' }));
  if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.');
  return data;
}
function message(id, text, ok = false) {
  $(id).textContent = text;
  $(id).classList.toggle('ok', ok);
}
function showDashboard() {
  $('login').classList.add('hidden');
  $('dashboard').classList.remove('hidden');
  $('logout').classList.remove('hidden');
}
function showLogin() {
  token = ''; sessionStorage.removeItem('tomizeAdminToken');
  $('login').classList.remove('hidden');
  $('dashboard').classList.add('hidden');
  $('logout').classList.add('hidden');
}

$('password-form').addEventListener('submit', async event => {
  event.preventDefault(); message('auth-message', 'Envoi du code…');
  try {
    const result = await api('/admin/api/auth/request', { method: 'POST', body: JSON.stringify({ password: $('admin-password').value }) });
    requestToken = result.requestToken;
    $('password-form').classList.add('hidden'); $('code-form').classList.remove('hidden'); $('admin-code').focus();
    message('auth-message', 'Code envoyé à l’adresse administrateur.', true);
  } catch (error) { message('auth-message', error.message); }
});
$('code-form').addEventListener('submit', async event => {
  event.preventDefault(); message('auth-message', 'Vérification…');
  try {
    const result = await api('/admin/api/auth/verify', { method: 'POST', body: JSON.stringify({ requestToken, code: $('admin-code').value }) });
    token = result.token; sessionStorage.setItem('tomizeAdminToken', token); showDashboard(); $('search').focus();
  } catch (error) { message('auth-message', error.message); }
});
$('logout').addEventListener('click', async () => {
  try { await api('/admin/api/logout', { method: 'POST', body: '{}' }); } catch {}
  showLogin();
});
$('search').addEventListener('input', () => {
  clearTimeout(timer);
  const query = $('search').value.trim();
  if (query.length < 2) { $('results').replaceChildren(); $('empty').textContent = 'Saisissez au moins 2 caractères.'; $('empty').classList.remove('hidden'); return; }
  timer = setTimeout(() => search(query), 180);
});
async function search(query) {
  try {
    const { accounts } = await api(`/admin/api/accounts?q=${encodeURIComponent(query)}`);
    $('results').replaceChildren(...accounts.map(account => {
      const row = document.createElement('article'); row.className = 'account';
      const name = document.createElement('strong'); name.textContent = account.username;
      const email = document.createElement('span'); email.textContent = account.email || 'Aucune adresse e-mail';
      const edit = document.createElement('button'); edit.textContent = 'Modifier'; edit.addEventListener('click', () => openEditor(account));
      row.append(name, email, edit); return row;
    }));
    $('empty').textContent = accounts.length ? '' : 'Aucun joueur trouvé.';
    $('empty').classList.toggle('hidden', accounts.length > 0);
  } catch (error) {
    if (/Session/.test(error.message)) showLogin();
    else { $('empty').textContent = error.message; $('empty').classList.remove('hidden'); }
  }
}
function openEditor(account) {
  $('account-id').value = account.id; $('username').value = account.username; $('email').value = account.email || '';
  $('new-password').value = ''; $('confirm-password').value = ''; $('invalidate').checked = true;
  $('editor-title').textContent = account.username; message('edit-message', ''); $('editor').showModal();
}
$('close').addEventListener('click', () => $('editor').close());
$('account-form').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('new-password').value !== $('confirm-password').value) return message('edit-message', 'Les mots de passe sont différents.');
  $('save').disabled = true; message('edit-message', 'Enregistrement…');
  try {
    const result = await api(`/admin/api/accounts/${encodeURIComponent($('account-id').value)}`, {
      method: 'PATCH',
      body: JSON.stringify({ username: $('username').value, email: $('email').value, newPassword: $('new-password').value, invalidateSessions: $('invalidate').checked })
    });
    message('edit-message', 'Compte mis à jour et action enregistrée.', true);
    setTimeout(() => { $('editor').close(); search($('search').value.trim()); }, 700);
  } catch (error) { message('edit-message', error.message); }
  finally { $('save').disabled = false; }
});

if (token) api('/admin/api/me').then(showDashboard).catch(showLogin); else showLogin();
