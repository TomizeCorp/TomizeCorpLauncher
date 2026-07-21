import assert from 'node:assert/strict';

const base = process.env.TEST_API_URL || 'http://127.0.0.1:3000';
async function request(route, options = {}) {
  const response = await fetch(`${base}${route}`, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const result = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${result.error}`);
  return result;
}

const username = `Test_${Date.now().toString().slice(-8)}`.slice(0, 16);
const registered = await request('/v1/register', { method: 'POST', body: JSON.stringify({ username, password: 'A-secure-test-password-42' }) });
assert.equal(registered.account.username, username);
assert.ok(registered.token);
const loggedIn = await request('/v1/login', { method: 'POST', body: JSON.stringify({ username, password: 'A-secure-test-password-42' }) });
const authorization = `Bearer ${loggedIn.token}`;
const me = await request('/v1/me', { headers: { authorization } });
assert.equal(me.account.username, username);
const renamed = `${username.slice(0, 14)}x`;
const updated = await request('/v1/account', { method: 'PATCH', headers: { authorization }, body: JSON.stringify({ username: renamed, oldPassword: 'A-secure-test-password-42', newPassword: 'A-new-secure-password-43', newPasswordConfirm: 'A-new-secure-password-43' }) });
assert.equal(updated.account.username, renamed);
await request('/v1/logout', { method: 'POST', headers: { authorization } });
await assert.rejects(() => request('/v1/me', { headers: { authorization } }));
console.log('Account API integration test passed.');
