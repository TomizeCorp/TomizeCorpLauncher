import http from 'node:http';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

const { Pool } = pg;
const scrypt = promisify(crypto.scrypt);
const port = Number(process.env.PORT || 3000);
const pepper = process.env.SESSION_PEPPER || '';
if (!process.env.DATABASE_URL || pepper.length < 32) throw new Error('DATABASE_URL et SESSION_PEPPER (32 caractères minimum) sont requis.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const attempts = new Map();

await pool.query(`
  CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY,
    username VARCHAR(16) NOT NULL,
    username_key VARCHAR(16) UNIQUE NOT NULL,
    password_salt CHAR(32) NOT NULL,
    password_hash CHAR(128) NOT NULL,
    skin BYTEA,
    skin_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS sessions_account_id_idx ON sessions(account_id);
  CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
`);

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': data.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(data);
}
function clientIp(req) { return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim(); }
function throttle(req) {
  const key = clientIp(req), now = Date.now(), recent = (attempts.get(key) || []).filter(time => now - time < 60_000);
  if (recent.length >= 20) return false;
  recent.push(now); attempts.set(key, recent); return true;
}
async function body(req, max = 2_800_000) {
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > max) throw Object.assign(new Error('Requête trop volumineuse.'), { status: 413 }); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('JSON invalide.'), { status: 400 }); }
}
function credentials(value, allowEmptyPassword = false) {
  const username = String(value?.username || '').trim(), password = String(value?.password || '');
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw Object.assign(new Error('Pseudo invalide (3 à 16 caractères).'), { status: 400 });
  if ((!allowEmptyPassword || password) && (password.length < 8 || password.length > 128)) throw Object.assign(new Error('Le mot de passe doit contenir 8 à 128 caractères.'), { status: 400 });
  return { username, password };
}
async function passwordHash(password, salt) { return (await scrypt(password, Buffer.from(salt, 'hex'), 64)).toString('hex'); }
function tokenHash(token) { return crypto.createHash('sha256').update(token).update(pepper).digest('hex'); }
async function session(accountId) {
  const token = crypto.randomBytes(32).toString('base64url'), expires = new Date(Date.now() + 30 * 86400_000);
  await pool.query('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES($1,$2,$3)', [tokenHash(token), accountId, expires]);
  return token;
}
async function authenticated(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  if (!match) throw Object.assign(new Error('Session requise.'), { status: 401 });
  const result = await pool.query(`SELECT a.* FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`, [tokenHash(match[1])]);
  if (!result.rowCount) throw Object.assign(new Error('Session expirée.'), { status: 401 });
  return { account: result.rows[0], token: match[1] };
}
function publicAccount(account, includeSkin = false) {
  const result = { id: account.id, username: account.username, hasSkin: Boolean(account.skin) };
  if (includeSkin && account.skin) result.skin = account.skin.toString('base64');
  return result;
}
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1)); }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function validPng(data) {
  if (data.length < 45 || data.length > 2 * 1024 * 1024 || data.toString('hex', 0, 8) !== '89504e470d0a1a0a') return false;
  let offset = 8, hasIdat = false, hasIend = false, width = 0, height = 0;
  while (offset + 12 <= data.length) {
    const length = data.readUInt32BE(offset), end = offset + 12 + length;
    if (length > 2 * 1024 * 1024 || end > data.length) return false;
    const type = data.toString('ascii', offset + 4, offset + 8), chunk = data.subarray(offset + 4, offset + 8 + length);
    if (crc32(chunk) !== data.readUInt32BE(offset + 8 + length)) return false;
    if (offset === 8) { if (type !== 'IHDR' || length !== 13) return false; width = data.readUInt32BE(offset + 8); height = data.readUInt32BE(offset + 12); }
    if (type === 'IDAT') hasIdat = true;
    if (type === 'IEND') { hasIend = length === 0 && end === data.length; break; }
    offset = end;
  }
  return width === 64 && (height === 32 || height === 64) && hasIdat && hasIend;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
    if (!throttle(req)) return json(res, 429, { error: 'Trop de tentatives. Réessayez dans une minute.' });
    if (req.method === 'POST' && url.pathname === '/v1/register') {
      const { username, password } = credentials(await body(req));
      const salt = crypto.randomBytes(16).toString('hex'), id = crypto.randomUUID();
      try { await pool.query('INSERT INTO accounts(id,username,username_key,password_salt,password_hash) VALUES($1,$2,$3,$4,$5)', [id, username, username.toLowerCase(), salt, await passwordHash(password, salt)]); }
      catch (error) { if (error.code === '23505') throw Object.assign(new Error('Ce pseudo est déjà utilisé.'), { status: 409 }); throw error; }
      return json(res, 201, { token: await session(id), account: { id, username, hasSkin: false } });
    }
    if (req.method === 'POST' && url.pathname === '/v1/login') {
      const { username, password } = credentials(await body(req));
      const result = await pool.query('SELECT * FROM accounts WHERE username_key=$1', [username.toLowerCase()]);
      if (!result.rowCount) throw Object.assign(new Error('Pseudo ou mot de passe incorrect.'), { status: 401 });
      const account = result.rows[0], actual = Buffer.from(await passwordHash(password, account.password_salt), 'hex'), expected = Buffer.from(account.password_hash, 'hex');
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw Object.assign(new Error('Pseudo ou mot de passe incorrect.'), { status: 401 });
      return json(res, 200, { token: await session(account.id), account: publicAccount(account) });
    }
    if (req.method === 'GET' && url.pathname === '/v1/me') {
      const { account } = await authenticated(req); return json(res, 200, { account: publicAccount(account, true) });
    }
    if (req.method === 'PATCH' && url.pathname === '/v1/account') {
      const { account } = await authenticated(req), value = await body(req), oldPassword = String(value.oldPassword || '');
      const actual = Buffer.from(await passwordHash(oldPassword, account.password_salt), 'hex'), expected = Buffer.from(account.password_hash, 'hex');
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw Object.assign(new Error('Ancien mot de passe incorrect.'), { status: 401 });
      const { username } = credentials({ username: value.username, password: '12345678' });
      const newPassword = String(value.newPassword || ''), confirmation = String(value.newPasswordConfirm || '');
      if (newPassword !== confirmation) throw Object.assign(new Error('Les nouveaux mots de passe sont différents.'), { status: 400 });
      if (newPassword && (newPassword.length < 8 || newPassword.length > 128)) throw Object.assign(new Error('Le nouveau mot de passe doit contenir 8 à 128 caractères.'), { status: 400 });
      let salt = account.password_salt, hash = account.password_hash;
      if (newPassword) { salt = crypto.randomBytes(16).toString('hex'); hash = await passwordHash(newPassword, salt); }
      try { await pool.query('UPDATE accounts SET username=$1,username_key=$2,password_salt=$3,password_hash=$4,updated_at=NOW() WHERE id=$5', [username, username.toLowerCase(), salt, hash, account.id]); }
      catch (error) { if (error.code === '23505') throw Object.assign(new Error('Ce pseudo est déjà utilisé.'), { status: 409 }); throw error; }
      return json(res, 200, { account: { id: account.id, username, hasSkin: Boolean(account.skin) } });
    }
    if (req.method === 'PUT' && url.pathname === '/v1/skin') {
      const { account } = await authenticated(req), value = await body(req), skin = Buffer.from(String(value.skin || ''), 'base64');
      if (!validPng(skin)) throw Object.assign(new Error('Le skin doit être un PNG de 64×64 ou 64×32 pixels.'), { status: 400 });
      await pool.query('UPDATE accounts SET skin=$1,skin_updated_at=NOW(),updated_at=NOW() WHERE id=$2', [skin, account.id]);
      return json(res, 200, { account: { id: account.id, username: account.username, hasSkin: true } });
    }
    if (req.method === 'POST' && url.pathname === '/v1/logout') {
      const auth = await authenticated(req); await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(auth.token)]); return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Route introuvable.' });
  } catch (error) {
    console.error(error.status ? error.message : error);
    return json(res, error.status || 500, { error: error.status ? error.message : 'Erreur interne.' });
  }
});

setInterval(() => pool.query('DELETE FROM sessions WHERE expires_at<=NOW()').catch(console.error), 3600_000).unref();
server.listen(port, '0.0.0.0', () => console.log(`TomizeCorp Account API écoute sur ${port}`));
