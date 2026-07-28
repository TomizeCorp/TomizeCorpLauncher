import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import pg from 'pg';
import nodemailer from 'nodemailer';

const { Pool } = pg;
const scrypt = promisify(crypto.scrypt);
const port = Number(process.env.PORT || 3000);
const pepper = process.env.SESSION_PEPPER || '';
const adminDomain = String(process.env.ADMIN_DOMAIN || 'admin-launcher.tomize.fr').toLowerCase();
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '');
const discordClientId = String(process.env.DISCORD_CLIENT_ID || '');
const discordClientSecret = String(process.env.DISCORD_CLIENT_SECRET || '');
const discordRedirectUri = String(process.env.DISCORD_REDIRECT_URI || 'https://api.tomize.fr/v1/reviews/discord/callback');
const reviewsSiteUrl = String(process.env.REVIEWS_SITE_URL || 'https://avis-epsilon.tomize.fr');
const adminDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'admin');
if (!process.env.DATABASE_URL || pepper.length < 32) throw new Error('DATABASE_URL et SESSION_PEPPER (32 caractères minimum) sont requis.');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const attempts = new Map();
const mailer = process.env.SMTP_USER && (process.env.SMTP_PASSWORD || process.env.SMTP_PASSWORD_BASE64) ? nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mail.ovh.net',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD_BASE64 ? Buffer.from(process.env.SMTP_PASSWORD_BASE64, 'base64').toString('utf8') : process.env.SMTP_PASSWORD
  }
}) : null;

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
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email VARCHAR(254);
  ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_key VARCHAR(254);
  CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_key_idx ON accounts(email_key) WHERE email_key IS NOT NULL;
  CREATE TABLE IF NOT EXISTS password_resets (
    account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
    code_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS admin_login_codes (
    request_hash CHAR(64) PRIMARY KEY,
    code_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    action VARCHAR(80) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip VARCHAR(80),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS review_users (
    discord_id VARCHAR(32) PRIMARY KEY,
    username VARCHAR(80) NOT NULL,
    avatar VARCHAR(300),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS review_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    discord_id VARCHAR(32) NOT NULL REFERENCES review_users(discord_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY,
    discord_id VARCHAR(32) UNIQUE NOT NULL REFERENCES review_users(discord_id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content VARCHAR(1200) NOT NULL,
    admin_reply VARCHAR(1200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS service_settings (
    setting_key VARCHAR(80) PRIMARY KEY,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  INSERT INTO service_settings(setting_key,setting_value)
    VALUES('epsilon_server','{"online":true,"message":"EPSILON est disponible."}'::jsonb)
    ON CONFLICT(setting_key) DO NOTHING;
`);

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': data.length, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(data);
}
function securityHeaders(res) {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('content-security-policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}
async function staticAdmin(res, filename, type) {
  securityHeaders(res);
  const data = await fs.readFile(path.join(adminDirectory, filename));
  res.writeHead(200, { 'content-type': type, 'content-length': data.length, 'cache-control': 'no-store, max-age=0' });
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
function emailAddress(value, required = false) {
  const email = String(value || '').trim().toLowerCase();
  if (!email && !required) return '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Adresse e-mail invalide.'), { status: 400 });
  return email;
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
function safeEqualText(left, right) {
  const a = Buffer.from(String(left)), b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
async function verifyAdminPassword(password) {
  const [saltHex, expectedHex] = adminPasswordHash.split(':');
  if (!/^[a-f0-9]{32}$/i.test(saltHex || '') || !/^[a-f0-9]{128}$/i.test(expectedHex || '')) return false;
  const actual = await passwordHash(String(password || ''), saltHex);
  return safeEqualText(actual, expectedHex);
}
async function authenticatedAdmin(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  if (!match) throw Object.assign(new Error('Session administrateur requise.'), { status: 401 });
  const result = await pool.query('SELECT 1 FROM admin_sessions WHERE token_hash=$1 AND expires_at>NOW()', [tokenHash(match[1])]);
  if (!result.rowCount) throw Object.assign(new Error('Session administrateur expirée.'), { status: 401 });
  return match[1];
}
async function adminSession() {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query(`INSERT INTO admin_sessions(token_hash,expires_at) VALUES($1,NOW()+INTERVAL '2 hours')`, [tokenHash(token)]);
  return token;
}
async function reviewSession(discordId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query(`INSERT INTO review_sessions(token_hash,discord_id,expires_at) VALUES($1,$2,NOW()+INTERVAL '30 days')`, [tokenHash(token), discordId]);
  return token;
}
async function authenticatedReviewer(req) {
  const match = String(req.headers.authorization || '').match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  if (!match) throw Object.assign(new Error('Connexion Discord requise.'), { status: 401 });
  const result = await pool.query(`SELECT u.* FROM review_sessions s JOIN review_users u ON u.discord_id=s.discord_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`, [tokenHash(match[1])]);
  if (!result.rowCount) throw Object.assign(new Error('Session Discord expirée.'), { status: 401 });
  return result.rows[0];
}
function publicAccount(account, includeSkin = false) {
  const result = { id: account.id, username: account.username, email: account.email || '', hasSkin: Boolean(account.skin) };
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
    const origin = String(req.headers.origin || '');
    if (origin === reviewsSiteUrl || origin.endsWith('.chatgpt.site')) {
      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('vary', 'Origin');
      res.setHeader('access-control-allow-headers', 'authorization,content-type');
      res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,OPTIONS');
    }
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' && url.pathname === '/v1/reviews/discord/login') {
      if (!discordClientId || !discordClientSecret) throw Object.assign(new Error('Connexion Discord pas encore configurée.'), { status: 503 });
      res.writeHead(302, { location: `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(discordClientId)}&response_type=code&redirect_uri=${encodeURIComponent(discordRedirectUri)}&scope=identify` });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/v1/reviews/discord/callback') {
      const code = String(url.searchParams.get('code') || '');
      if (!code) throw Object.assign(new Error('Code Discord manquant.'), { status: 400 });
      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: discordClientId, client_secret: discordClientSecret, grant_type: 'authorization_code', code, redirect_uri: discordRedirectUri }) });
      if (!tokenResponse.ok) throw Object.assign(new Error('Connexion Discord refusée.'), { status: 401 });
      const discordToken = await tokenResponse.json();
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { authorization: `Bearer ${discordToken.access_token}` } });
      if (!userResponse.ok) throw Object.assign(new Error('Profil Discord inaccessible.'), { status: 401 });
      const user = await userResponse.json(), avatar = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : '';
      await pool.query(`INSERT INTO review_users(discord_id,username,avatar) VALUES($1,$2,$3) ON CONFLICT(discord_id) DO UPDATE SET username=EXCLUDED.username,avatar=EXCLUDED.avatar,updated_at=NOW()`, [user.id, user.global_name || user.username, avatar]);
      res.writeHead(302, { location: `${reviewsSiteUrl}/?token=${encodeURIComponent(await reviewSession(user.id))}` });
      return res.end();
    }
    if (req.method === 'GET' && url.pathname === '/v1/reviews/me') {
      const user = await authenticatedReviewer(req);
      return json(res, 200, { username: user.username, avatar: user.avatar || '' });
    }
    if (req.method === 'GET' && url.pathname === '/v1/reviews') {
      const sort = String(url.searchParams.get('sort') || 'relevant');
      const order = sort === 'best' ? 'r.rating DESC,r.updated_at DESC' : sort === 'worst' ? 'r.rating ASC,r.updated_at DESC' : sort === 'recent' ? 'r.created_at DESC' : '(CASE WHEN r.admin_reply IS NULL THEN 0 ELSE 1 END) DESC,r.rating DESC,r.updated_at DESC';
      const result = await pool.query(`SELECT r.id,r.rating,r.content,r.admin_reply AS reply,r.created_at,u.username,u.avatar FROM reviews r JOIN review_users u USING(discord_id) ORDER BY ${order} LIMIT 200`);
      const stats = await pool.query('SELECT COUNT(*)::int AS count,AVG(rating)::float AS average FROM reviews');
      return json(res, 200, { reviews: result.rows.map(row => ({ ...row, createdAt: row.created_at })), ...stats.rows[0] });
    }
    if (req.method === 'POST' && url.pathname === '/v1/reviews') {
      const user = await authenticatedReviewer(req), value = await body(req, 20_000), rating = Number(value.rating), content = String(value.content || '').trim();
      if (!Number.isInteger(rating) || rating < 1 || rating > 5 || content.length < 10 || content.length > 1200) throw Object.assign(new Error('Avis invalide.'), { status: 400 });
      await pool.query(`INSERT INTO reviews(id,discord_id,rating,content) VALUES($1,$2,$3,$4) ON CONFLICT(discord_id) DO UPDATE SET rating=EXCLUDED.rating,content=EXCLUDED.content,admin_reply=NULL,updated_at=NOW()`, [crypto.randomUUID(), user.discord_id, rating, content]);
      return json(res, 200, { ok: true });
    }
    const replyMatch = url.pathname.match(/^\/admin\/api\/reviews\/([0-9a-f-]{36})\/reply$/i);
    if (req.method === 'GET' && url.pathname === '/admin/api/reviews') {
      await authenticatedAdmin(req);
      const result = await pool.query(`SELECT r.id,r.rating,r.content,r.admin_reply AS reply,r.created_at,u.username,u.avatar FROM reviews r JOIN review_users u USING(discord_id) ORDER BY r.updated_at DESC`);
      return json(res, 200, { reviews: result.rows });
    }
    if (req.method === 'PATCH' && replyMatch) {
      await authenticatedAdmin(req);
      const value = await body(req, 10_000), reply = String(value.reply || '').trim();
      if (!reply || reply.length > 1200) throw Object.assign(new Error('Réponse invalide.'), { status: 400 });
      await pool.query('UPDATE reviews SET admin_reply=$1,updated_at=NOW() WHERE id=$2', [reply, replyMatch[1]]);
      return json(res, 200, { ok: true });
    }
    const hostname = String(req.headers.host || '').split(':')[0].toLowerCase();
    const adminHost = hostname === adminDomain || hostname === 'localhost' || hostname === '127.0.0.1';
    if (adminHost && req.method === 'GET' && (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/admin/')) return staticAdmin(res, 'index.html', 'text/html; charset=utf-8');
    if (adminHost && req.method === 'GET' && url.pathname === '/admin/app.css') return staticAdmin(res, 'app.css', 'text/css; charset=utf-8');
    if (adminHost && req.method === 'GET' && url.pathname === '/admin/logo.css') return staticAdmin(res, 'logo.css', 'text/css; charset=utf-8');
    if (adminHost && req.method === 'GET' && url.pathname === '/admin/tabs.css') return staticAdmin(res, 'tabs.css', 'text/css; charset=utf-8');
    if (adminHost && req.method === 'GET' && url.pathname === '/admin/app.js') return staticAdmin(res, 'app.js', 'text/javascript; charset=utf-8');
    if (adminHost && req.method === 'GET' && url.pathname === '/admin/tomizecorp-logo.png') return staticAdmin(res, 'tomizecorp-logo.png', 'image/png');
    if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { ok: true });
    if (req.method === 'GET' && url.pathname === '/v1/server-status') {
      const result = await pool.query(`SELECT setting_value FROM service_settings WHERE setting_key='epsilon_server'`);
      return json(res, 200, result.rows[0]?.setting_value || { online: true, message: 'EPSILON est disponible.' });
    }
    if (!throttle(req)) return json(res, 429, { error: 'Trop de tentatives. Réessayez dans une minute.' });
    if (url.pathname.startsWith('/admin/api/') && !adminHost) return json(res, 404, { error: 'Route introuvable.' });
    if (req.method === 'POST' && url.pathname === '/admin/api/auth/request') {
      if (!adminEmail || !mailer || !adminPasswordHash) throw Object.assign(new Error('Administration non configurée.'), { status: 503 });
      const value = await body(req, 20_000);
      if (!await verifyAdminPassword(value.password)) throw Object.assign(new Error('Identifiants incorrects.'), { status: 401 });
      const requestToken = crypto.randomBytes(32).toString('base64url');
      const code = String(crypto.randomInt(0, 100_000_000)).padStart(8, '0');
      await pool.query(`INSERT INTO admin_login_codes(request_hash,code_hash,expires_at) VALUES($1,$2,NOW()+INTERVAL '10 minutes')`, [tokenHash(requestToken), tokenHash(code)]);
      await mailer.sendMail({
        from: `TomizeCorp <${process.env.SMTP_USER}>`, to: adminEmail,
        subject: 'Code de connexion administration TomizeCorp',
        text: `Votre code de connexion administrateur est : ${code}\n\nIl expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, changez immédiatement votre mot de passe administrateur.`
      });
      return json(res, 200, { requestToken });
    }
    if (req.method === 'POST' && url.pathname === '/admin/api/auth/verify') {
      const value = await body(req, 20_000), requestToken = String(value.requestToken || ''), code = String(value.code || '').trim();
      const result = await pool.query('SELECT * FROM admin_login_codes WHERE request_hash=$1 AND expires_at>NOW()', [tokenHash(requestToken)]);
      if (!result.rowCount || result.rows[0].attempts >= 5 || !/^\d{8}$/.test(code)) throw Object.assign(new Error('Code invalide ou expiré.'), { status: 401 });
      if (!safeEqualText(tokenHash(code), result.rows[0].code_hash)) {
        await pool.query('UPDATE admin_login_codes SET attempts=attempts+1 WHERE request_hash=$1', [tokenHash(requestToken)]);
        throw Object.assign(new Error('Code invalide ou expiré.'), { status: 401 });
      }
      await pool.query('DELETE FROM admin_login_codes WHERE request_hash=$1', [tokenHash(requestToken)]);
      await pool.query('INSERT INTO admin_audit_log(action,details,ip) VALUES($1,$2,$3)', ['admin.login', '{}', clientIp(req)]);
      return json(res, 200, { token: await adminSession() });
    }
    if (req.method === 'GET' && url.pathname === '/admin/api/me') {
      await authenticatedAdmin(req);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/admin/api/server-status') {
      await authenticatedAdmin(req);
      const result = await pool.query(`SELECT setting_value,updated_at FROM service_settings WHERE setting_key='epsilon_server'`);
      return json(res, 200, { ...(result.rows[0]?.setting_value || { online: true, message: 'EPSILON est disponible.' }), updatedAt: result.rows[0]?.updated_at || null });
    }
    if (req.method === 'PATCH' && url.pathname === '/admin/api/server-status') {
      await authenticatedAdmin(req);
      const value = await body(req, 10_000), online = value.online;
      const message = String(value.message || (online ? 'EPSILON est disponible.' : 'EPSILON est temporairement en maintenance.')).trim();
      if (typeof online !== 'boolean' || !message || message.length > 240) throw Object.assign(new Error('Statut du serveur invalide.'), { status: 400 });
      await pool.query(`INSERT INTO service_settings(setting_key,setting_value,updated_at)
        VALUES('epsilon_server',$1::jsonb,NOW())
        ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value,updated_at=NOW()`,
        [JSON.stringify({ online, message })]);
      await pool.query('INSERT INTO admin_audit_log(action,details,ip) VALUES($1,$2,$3)', ['server.status.updated', JSON.stringify({ online, message }), clientIp(req)]);
      return json(res, 200, { online, message });
    }
    if (req.method === 'GET' && url.pathname === '/admin/api/accounts') {
      await authenticatedAdmin(req);
      const query = String(url.searchParams.get('q') || '').trim().toLowerCase();
      if (query.length < 2) return json(res, 200, { accounts: [] });
      const result = await pool.query(`SELECT id,username,email,created_at,updated_at FROM accounts
        WHERE username_key LIKE $1 OR email_key LIKE $1 ORDER BY username_key LIMIT 30`, [`%${query}%`]);
      return json(res, 200, { accounts: result.rows });
    }
    const adminAccountMatch = url.pathname.match(/^\/admin\/api\/accounts\/([0-9a-f-]{36})$/i);
    if (req.method === 'PATCH' && adminAccountMatch) {
      await authenticatedAdmin(req);
      const value = await body(req, 30_000);
      const { username } = credentials({ username: value.username, password: '12345678' });
      const email = emailAddress(value.email), newPassword = String(value.newPassword || '');
      if (newPassword && (newPassword.length < 8 || newPassword.length > 128)) throw Object.assign(new Error('Le nouveau mot de passe doit contenir 8 à 128 caractères.'), { status: 400 });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const currentResult = await client.query('SELECT id,username,email,password_salt,password_hash FROM accounts WHERE id=$1 FOR UPDATE', [adminAccountMatch[1]]);
        if (!currentResult.rowCount) throw Object.assign(new Error('Compte introuvable.'), { status: 404 });
        const current = currentResult.rows[0];
        let salt = current.password_salt, hash = current.password_hash;
        if (newPassword) { salt = crypto.randomBytes(16).toString('hex'); hash = await passwordHash(newPassword, salt); }
        await client.query(`UPDATE accounts SET username=$1,username_key=$2,email=$3,email_key=$4,password_salt=$5,password_hash=$6,updated_at=NOW() WHERE id=$7`,
          [username, username.toLowerCase(), email || null, email || null, salt, hash, current.id]);
        if (value.invalidateSessions !== false || newPassword) await client.query('DELETE FROM sessions WHERE account_id=$1', [current.id]);
        await client.query('DELETE FROM password_resets WHERE account_id=$1', [current.id]);
        await client.query('INSERT INTO admin_audit_log(account_id,action,details,ip) VALUES($1,$2,$3,$4)', [
          current.id, 'account.updated',
          JSON.stringify({ usernameChanged: current.username !== username, emailChanged: (current.email || '') !== email, passwordReset: Boolean(newPassword), sessionsInvalidated: value.invalidateSessions !== false || Boolean(newPassword) }),
          clientIp(req)
        ]);
        await client.query('COMMIT');
        if (mailer && (email || current.email)) mailer.sendMail({
          from: `TomizeCorp <${process.env.SMTP_USER}>`, to: email || current.email,
          subject: 'Votre compte TomizeCorp a été modifié',
          text: `Bonjour ${username},\n\nUn administrateur a modifié les informations de votre compte TomizeCorp. Si vous n'avez pas demandé cette intervention, contactez immédiatement TomizeCorp.`
        }).catch(console.error);
        return json(res, 200, { account: { id: current.id, username, email } });
      } catch (error) {
        await client.query('ROLLBACK');
        if (error.code === '23505') throw Object.assign(new Error(error.constraint === 'accounts_email_key_idx' ? 'Cette adresse e-mail est déjà utilisée.' : 'Ce pseudo est déjà utilisé.'), { status: 409 });
        throw error;
      } finally { client.release(); }
    }
    if (req.method === 'POST' && url.pathname === '/admin/api/logout') {
      const token = await authenticatedAdmin(req);
      await pool.query('DELETE FROM admin_sessions WHERE token_hash=$1', [tokenHash(token)]);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/v1/register') {
      const value = await body(req), { username, password } = credentials(value), email = emailAddress(value.email);
      const salt = crypto.randomBytes(16).toString('hex'), id = crypto.randomUUID();
      try { await pool.query('INSERT INTO accounts(id,username,username_key,password_salt,password_hash,email,email_key) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, username, username.toLowerCase(), salt, await passwordHash(password, salt), email || null, email || null]); }
      catch (error) { if (error.code === '23505') throw Object.assign(new Error(error.constraint === 'accounts_email_key_idx' ? 'Cette adresse e-mail est déjà utilisée.' : 'Ce pseudo est déjà utilisé.'), { status: 409 }); throw error; }
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
      const { username } = credentials({ username: value.username, password: '12345678' }), email = emailAddress(value.email);
      const newPassword = String(value.newPassword || ''), confirmation = String(value.newPasswordConfirm || '');
      if (newPassword !== confirmation) throw Object.assign(new Error('Les nouveaux mots de passe sont différents.'), { status: 400 });
      if (newPassword && (newPassword.length < 8 || newPassword.length > 128)) throw Object.assign(new Error('Le nouveau mot de passe doit contenir 8 à 128 caractères.'), { status: 400 });
      let salt = account.password_salt, hash = account.password_hash;
      if (newPassword) { salt = crypto.randomBytes(16).toString('hex'); hash = await passwordHash(newPassword, salt); }
      try { await pool.query('UPDATE accounts SET username=$1,username_key=$2,password_salt=$3,password_hash=$4,email=$5,email_key=$6,updated_at=NOW() WHERE id=$7', [username, username.toLowerCase(), salt, hash, email || null, email || null, account.id]); }
      catch (error) { if (error.code === '23505') throw Object.assign(new Error(error.constraint === 'accounts_email_key_idx' ? 'Cette adresse e-mail est déjà utilisée.' : 'Ce pseudo est déjà utilisé.'), { status: 409 }); throw error; }
      return json(res, 200, { account: { id: account.id, username, email, hasSkin: Boolean(account.skin) } });
    }
    if (req.method === 'POST' && url.pathname === '/v1/password/forgot') {
      const value = await body(req), email = emailAddress(value.email, true);
      const result = await pool.query('SELECT id,username,email FROM accounts WHERE email_key=$1', [email]);
      if (result.rowCount && mailer) {
        const account = result.rows[0], code = String(crypto.randomInt(0, 100_000_000)).padStart(8, '0');
        await pool.query(`INSERT INTO password_resets(account_id,code_hash,expires_at,attempts) VALUES($1,$2,NOW()+INTERVAL '15 minutes',0)
          ON CONFLICT(account_id) DO UPDATE SET code_hash=EXCLUDED.code_hash,expires_at=EXCLUDED.expires_at,attempts=0,created_at=NOW()`,
          [account.id, tokenHash(code)]);
        await mailer.sendMail({
          from: `TomizeCorp <${process.env.SMTP_USER}>`,
          to: account.email,
          subject: 'Code de réinitialisation TomizeCorp',
          text: `Bonjour ${account.username},\n\nVotre code de réinitialisation est : ${code}\n\nIl expire dans 15 minutes. Si vous n'avez rien demandé, ignorez cet e-mail.\n\nTomizeCorp`
        });
      }
      return json(res, 200, { ok: true, message: 'Si cette adresse existe, un code a été envoyé.' });
    }
    if (req.method === 'POST' && url.pathname === '/v1/password/reset') {
      const value = await body(req), email = emailAddress(value.email, true), code = String(value.code || '').trim();
      const password = String(value.newPassword || ''), confirmation = String(value.newPasswordConfirm || '');
      if (!/^\d{8}$/.test(code)) throw Object.assign(new Error('Code invalide.'), { status: 400 });
      if (password !== confirmation) throw Object.assign(new Error('Les mots de passe sont différents.'), { status: 400 });
      if (password.length < 8 || password.length > 128) throw Object.assign(new Error('Le mot de passe doit contenir 8 à 128 caractères.'), { status: 400 });
      const result = await pool.query(`SELECT a.id,r.code_hash,r.attempts FROM accounts a JOIN password_resets r ON r.account_id=a.id
        WHERE a.email_key=$1 AND r.expires_at>NOW()`, [email]);
      if (!result.rowCount || result.rows[0].attempts >= 5) throw Object.assign(new Error('Code invalide ou expiré.'), { status: 400 });
      const reset = result.rows[0], actual = Buffer.from(tokenHash(code)), expected = Buffer.from(reset.code_hash);
      if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
        await pool.query('UPDATE password_resets SET attempts=attempts+1 WHERE account_id=$1', [reset.id]);
        throw Object.assign(new Error('Code invalide ou expiré.'), { status: 400 });
      }
      const salt = crypto.randomBytes(16).toString('hex'), client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('UPDATE accounts SET password_salt=$1,password_hash=$2,updated_at=NOW() WHERE id=$3', [salt, await passwordHash(password, salt), reset.id]);
        await client.query('DELETE FROM sessions WHERE account_id=$1', [reset.id]);
        await client.query('DELETE FROM password_resets WHERE account_id=$1', [reset.id]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw error; }
      finally { client.release(); }
      return json(res, 200, { ok: true });
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

setInterval(() => Promise.all([
  pool.query('DELETE FROM sessions WHERE expires_at<=NOW()'),
  pool.query('DELETE FROM password_resets WHERE expires_at<=NOW()'),
  pool.query('DELETE FROM admin_login_codes WHERE expires_at<=NOW()'),
  pool.query('DELETE FROM admin_sessions WHERE expires_at<=NOW()')
]).catch(console.error), 3600_000).unref();
server.listen(port, '0.0.0.0', () => console.log(`TomizeCorp Account API écoute sur ${port}`));
