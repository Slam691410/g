/* ============================================================================
 * GHub One — Server & Database (Node.js murni, tanpa dependensi eksternal)
 * - Database : SQLite bawaan Node (node:sqlite) → file data/ghub.sqlite
 * - Auth     : register/login multi-user, password di-hash scrypt+salt,
 *              sesi token acak (header Authorization: Bearer <token>)
 * - Data     : koleksi per-user (tugas, transaksi, aset, KHL, polis, goals, membership)
 *              koleksi bersama (posts, groups, ledger, settings) utk Sosial Hub & komisi
 * - Admin    : role 'admin' → statistik agregat, daftar user, kelola member,
 *              moderasi, pengaturan tarif komisi/harga paket
 * - Static   : menyajikan frontend (index.html, admin.html, go.html, css, js)
 * Jalankan   : node server.js  (PORT env opsional, default 8000)
 * ==========================================================================*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const PORT = Number(process.env.PORT || 8000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
if(!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------------- Database ---------------- */
const db = new DatabaseSync(path.join(DATA_DIR, 'ghub.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    passhash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    nama TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions(
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv_user(
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id, key)
  );
  CREATE TABLE IF NOT EXISTS kv_shared(
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS clicks(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode TEXT, kanal TEXT, url TEXT, at TEXT NOT NULL
  );
`);

const hash = (pass, salt) => crypto.scryptSync(pass, salt, 64).toString('hex');
const now = () => new Date().toISOString();

/* Seed akun admin default (admin / admin123) — ganti password lewat panel admin */
(function seedAdmin(){
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if(!row){
    const salt = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO users(username, passhash, salt, role, nama, created_at) VALUES(?,?,?,?,?,?)')
      .run('admin', hash('admin123', salt), salt, 'admin', 'Administrator', now());
    console.log('Seed: akun admin/admin123 dibuat (role admin)');
  }
})();

/* ---------------- KV helpers ---------------- */
const SHARED_KEYS = new Set(['posts', 'groups', 'ledger', 'settings']);
function kvUserGetAll(uid){
  const rows = db.prepare('SELECT key, value FROM kv_user WHERE user_id = ?').all(uid);
  const out = {};
  for(const r of rows){ try{ out[r.key] = JSON.parse(r.value); }catch(e){} }
  return out;
}
function kvUserSet(uid, key, value){
  db.prepare(`INSERT INTO kv_user(user_id, key, value, updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run(uid, key, JSON.stringify(value), now());
}
function kvSharedGet(key, def){
  const r = db.prepare('SELECT value FROM kv_shared WHERE key = ?').get(key);
  if(!r) return def;
  try{ return JSON.parse(r.value); }catch(e){ return def; }
}
function kvSharedSet(key, value){
  db.prepare(`INSERT INTO kv_shared(key, value, updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run(key, JSON.stringify(value), now());
}
function kvSharedAll(){
  const out = {};
  for(const k of SHARED_KEYS) out[k] = kvSharedGet(k, k === 'settings' ? null : []);
  return out;
}

/* ---------------- HTTP utils ---------------- */
function send(res, code, obj){
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req){
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if(data.length > 5e6) req.destroy(); });
    req.on('end', () => { try{ resolve(data ? JSON.parse(data) : {}); }catch(e){ reject(new Error('JSON tidak valid')); } });
    req.on('error', reject);
  });
}
function authUser(req){
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return null;
  const s = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if(!s) return null;
  return db.prepare('SELECT id, username, role, nama FROM users WHERE id = ?').get(s.user_id) || null;
}
const sanitizeUsername = u => String(u || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 30);

/* ---------------- API router ---------------- */
async function api(req, res, url){
  const p = url.pathname;
  const user = authUser(req);

  /* ---- Auth ---- */
  if(p === '/api/auth/register' && req.method === 'POST'){
    const b = await readBody(req);
    const username = sanitizeUsername(b.username);
    const password = String(b.password || '');
    if(username.length < 3) return send(res, 400, { error: 'Username minimal 3 karakter (huruf/angka/._-)' });
    if(password.length < 6) return send(res, 400, { error: 'Password minimal 6 karakter' });
    if(db.prepare('SELECT id FROM users WHERE username = ?').get(username))
      return send(res, 409, { error: 'Username sudah dipakai' });
    const salt = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO users(username, passhash, salt, role, nama, created_at) VALUES(?,?,?,?,?,?)')
      .run(username, hash(password, salt), salt, 'user', String(b.nama || '').slice(0, 60), now());
    const u = db.prepare('SELECT id, username, role, nama FROM users WHERE username = ?').get(username);
    kvUserSet(u.id, 'membership', { plan: 'free', since: null, expiry: null, affCode: 'GH' + crypto.randomBytes(3).toString('hex').toUpperCase() });
    if(b.nama) kvUserSet(u.id, 'profile', { nama: String(b.nama).slice(0, 60), provinsi: 'DKI Jakarta' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions(token, user_id, created_at) VALUES(?,?,?)').run(token, u.id, now());
    return send(res, 200, { token, user: u });
  }
  if(p === '/api/auth/login' && req.method === 'POST'){
    const b = await readBody(req);
    const username = sanitizeUsername(b.username);
    const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if(!u || hash(String(b.password || ''), u.salt) !== u.passhash)
      return send(res, 401, { error: 'Username / password salah' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions(token, user_id, created_at) VALUES(?,?,?)').run(token, u.id, now());
    return send(res, 200, { token, user: { id: u.id, username: u.username, role: u.role, nama: u.nama } });
  }
  if(p === '/api/auth/logout' && req.method === 'POST'){
    const h = req.headers['authorization'] || '';
    if(h.startsWith('Bearer ')) db.prepare('DELETE FROM sessions WHERE token = ?').run(h.slice(7));
    return send(res, 200, { ok: true });
  }

  /* ---- Klik afiliasi (publik — dipanggil go.html) ---- */
  if(p === '/api/click' && req.method === 'POST'){
    const b = await readBody(req);
    db.prepare('INSERT INTO clicks(kode, kanal, url, at) VALUES(?,?,?,?)')
      .run(String(b.kode || '').slice(0, 20), String(b.kanal || '').slice(0, 40), String(b.url || '').slice(0, 500), now());
    const led = kvSharedGet('ledger', []);
    led.unshift({ id: crypto.randomBytes(5).toString('hex'), at: now(), tipe: 'klik-afiliasi',
      kanal: String(b.kanal || 'produk').slice(0, 40), kode: String(b.kode || '').slice(0, 20),
      url: String(b.url || '').slice(0, 300), status: 'klik tercatat (server)' });
    kvSharedSet('ledger', led.slice(0, 2000));
    return send(res, 200, { ok: true });
  }

  /* ---- Semua endpoint di bawah butuh login ---- */
  if(!user) return send(res, 401, { error: 'Belum login' });

  if(p === '/api/me' && req.method === 'GET') return send(res, 200, { user });

  if(p === '/api/data' && req.method === 'GET')
    return send(res, 200, { user: kvUserGetAll(user.id), shared: kvSharedAll(), me: user });

  let m;
  if((m = p.match(/^\/api\/data\/user\/([a-zA-Z0-9_-]{1,40})$/)) && req.method === 'PUT'){
    const b = await readBody(req);
    kvUserSet(user.id, m[1], b.value);
    return send(res, 200, { ok: true });
  }
  if((m = p.match(/^\/api\/data\/shared\/([a-zA-Z0-9_-]{1,40})$/))){
    const key = m[1];
    if(!SHARED_KEYS.has(key)) return send(res, 400, { error: 'Koleksi bersama tidak dikenal' });
    if(req.method === 'GET') return send(res, 200, { value: kvSharedGet(key, key === 'settings' ? null : []) });
    if(req.method === 'PUT'){
      if(key === 'settings' && user.role !== 'admin') return send(res, 403, { error: 'Hanya admin' });
      const b = await readBody(req);
      kvSharedSet(key, b.value);
      return send(res, 200, { ok: true });
    }
  }

  /* ---- Admin ---- */
  if(p.startsWith('/api/admin/')){
    if(user.role !== 'admin') return send(res, 403, { error: 'Hanya admin' });

    if(p === '/api/admin/stats' && req.method === 'GET'){
      const users = db.prepare("SELECT id FROM users WHERE role = 'user'").all();
      let memberAktif = 0;
      for(const u of users){
        const r = db.prepare('SELECT value FROM kv_user WHERE user_id = ? AND key = ?').get(u.id, 'membership');
        if(r){ try{ const mm = JSON.parse(r.value); if(mm.expiry && new Date(mm.expiry) > new Date()) memberAktif++; }catch(e){} }
      }
      const klik = db.prepare('SELECT COUNT(*) c FROM clicks').get().c;
      return send(res, 200, {
        totalUser: users.length, memberAktif, klik,
        posts: (kvSharedGet('posts', []) || []).length,
        groups: (kvSharedGet('groups', []) || []).length,
        sesiAktif: db.prepare('SELECT COUNT(*) c FROM sessions').get().c
      });
    }
    if(p === '/api/admin/users' && req.method === 'GET'){
      const users = db.prepare('SELECT id, username, role, nama, created_at FROM users').all();
      const out = users.map(u => {
        const kv = kvUserGetAll(u.id);
        return { ...u, membership: kv.membership || { plan: 'free' }, profile: kv.profile || {},
          counts: { tasks: (kv.tasks || []).length, txs: (kv.txs || []).length, goals: (kv.goals || []).length } };
      });
      return send(res, 200, { users: out });
    }
    if((m = p.match(/^\/api\/admin\/user\/(\d+)\/membership$/)) && req.method === 'PUT'){
      const b = await readBody(req);
      const uid = Number(m[1]);
      const kv = kvUserGetAll(uid);
      const mem = kv.membership || { plan: 'free', affCode: 'GH' + crypto.randomBytes(3).toString('hex').toUpperCase() };
      if(b.plan) mem.plan = String(b.plan);
      if(b.bulan != null){
        if(Number(b.bulan) <= 0 || b.plan === 'free'){ mem.expiry = null; if(b.plan === 'free') mem.plan = 'free'; }
        else { const e = new Date(); e.setMonth(e.getMonth() + Number(b.bulan)); mem.expiry = e.toISOString(); mem.since = mem.since || now(); }
      }
      kvUserSet(uid, 'membership', mem);
      return send(res, 200, { ok: true, membership: mem });
    }
    if((m = p.match(/^\/api\/admin\/user\/(\d+)$/)) && req.method === 'DELETE'){
      const uid = Number(m[1]);
      const target = db.prepare('SELECT role FROM users WHERE id = ?').get(uid);
      if(target && target.role === 'admin') return send(res, 400, { error: 'Tidak bisa menghapus admin' });
      db.prepare('DELETE FROM users WHERE id = ?').run(uid);
      db.prepare('DELETE FROM kv_user WHERE user_id = ?').run(uid);
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
      return send(res, 200, { ok: true });
    }
    if(p === '/api/admin/password' && req.method === 'PUT'){
      const b = await readBody(req);
      if(String(b.password || '').length < 6) return send(res, 400, { error: 'Password minimal 6 karakter' });
      const salt = crypto.randomBytes(16).toString('hex');
      db.prepare('UPDATE users SET passhash = ?, salt = ? WHERE id = ?').run(hash(String(b.password), salt), salt, user.id);
      return send(res, 200, { ok: true });
    }
  }

  return send(res, 404, { error: 'Endpoint tidak ditemukan' });
}

/* ---------------- Static files ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(req, res, url){
  let fp = decodeURIComponent(url.pathname);
  if(fp === '/') fp = '/index.html';
  const full = path.normalize(path.join(ROOT, fp));
  if(!full.startsWith(ROOT) || full.includes(path.sep + 'data' + path.sep) || fp.startsWith('/server.js'))
    { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, buf) => {
    if(err){ res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try{
    if(url.pathname.startsWith('/api/')) await api(req, res, url);
    else serveStatic(req, res, url);
  }catch(e){
    console.error(e);
    try{ send(res, 500, { error: e.message }); }catch(_){}
  }
}).listen(PORT, '0.0.0.0', () => console.log(`GHub One server + SQLite siap di http://0.0.0.0:${PORT}`));
