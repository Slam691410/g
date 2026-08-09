/* ============================================================================
 * GHub One — Backend v2 (Node.js murni + SQLite, tanpa dependensi eksternal)
 *
 * ARSITEKTUR
 *  - Database  : node:sqlite → data/ghub.sqlite (WAL)
 *      users, sessions, kv_user (data per akun), kv_shared (settings),
 *      posts, groups, ledger, clicks  ← tabel SQL sungguhan
 *  - Auth      : scrypt+salt, sesi Bearer token, role user/admin
 *  - Logika bisnis DI SERVER (klien tidak bisa memanipulasi):
 *      · posting, like, komentar, keranjang afiliasi (kepemilikan diverifikasi)
 *      · buat grup & langganan grup → komisi kreator + fee sistem dihitung server
 *      · beli/perpanjang membership → pembayaran + komisi referral dihitung server
 *      · konversi afiliasi → komisi user + porsi sistem dihitung server
 *      · buku besar (ledger) read-only bagi klien; user hanya melihat miliknya
 *  - Keamanan  : rate-limit auth & klik, validasi input, path traversal guard,
 *                server.js & data/ tidak disajikan statis
 *  - Relay     : /api/relay?url= → proxy data pasar server-side (allowlist host);
 *                di lingkungan tanpa egress, klien otomatis fallback ke jalur browser
 *  - Migrasi   : data kv_shared lama (posts/groups/ledger v1) diimpor ke tabel
 *
 * Jalankan: node server.js   (env PORT opsional, default 8000)
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

/* ---------------- Konstanta bisnis (default; bisa dioverride settings admin) ----------------
 * MODEL KOMISI (fair, tidak merugikan sistem):
 *  - Klik link afiliasi  = statistik saja, TIDAK bernilai uang.
 *  - Komisi produk       = hanya saat jaringan afiliasi eksternal mengonfirmasi pembelian
 *                          via POSTBACK; payout dari jaringan dibagi: pengguna 70%, sistem 30%.
 *  - Langganan grup      = 100% pendapatan kreator grup (sistem tidak memotong).
 *  - Referral membership = 30% dibayar sistem dari pembayaran membership yang NYATA terjadi.
 */
const DEFAULT_KOMISI = { produkUser: 0.70, membershipRef: 0.30 };
const DEFAULT_PLANS = { free: 0, pro: 49000, elite: 129000 };

/* ---------------- Database ---------------- */
const db = new DatabaseSync(path.join(DATA_DIR, 'ghub.sqlite'));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL, passhash TEXT NOT NULL, salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', nama TEXT DEFAULT '', created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions(
    token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS kv_user(
    user_id INTEGER NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY(user_id, key));
  CREATE TABLE IF NOT EXISTS kv_shared(
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS posts(
    id TEXT PRIMARY KEY, at TEXT NOT NULL, author TEXT, author_user TEXT,
    group_id TEXT, body TEXT, img TEXT, cart TEXT NOT NULL DEFAULT '[]',
    likes INTEGER NOT NULL DEFAULT 0, comments TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE IF NOT EXISTS groups(
    id TEXT PRIMARY KEY, at TEXT NOT NULL, nama TEXT NOT NULL, deskripsi TEXT,
    tipe TEXT NOT NULL, harga INTEGER NOT NULL DEFAULT 0,
    owner TEXT, owner_user TEXT, members TEXT NOT NULL DEFAULT '[]', subs TEXT NOT NULL DEFAULT '[]');
  CREATE TABLE IF NOT EXISTS ledger(
    id TEXT PRIMARY KEY, at TEXT NOT NULL, tipe TEXT NOT NULL, kanal TEXT, kanal_tipe TEXT,
    kode TEXT, user TEXT, jumlah INTEGER, status TEXT, detail TEXT, url TEXT, pair_id TEXT);
  CREATE TABLE IF NOT EXISTS clicks(
    id INTEGER PRIMARY KEY AUTOINCREMENT, kode TEXT, kanal TEXT, url TEXT, at TEXT NOT NULL);
`);

const now = () => new Date().toISOString();
const uid = () => crypto.randomBytes(6).toString('hex');
const hash = (pass, salt) => crypto.scryptSync(pass, salt, 64).toString('hex');
const J = (s, d) => { try{ return JSON.parse(s); }catch(e){ return d; } };

/* ---- Seed admin ---- */
(function seedAdmin(){
  if(!db.prepare('SELECT id FROM users WHERE username = ?').get('admin')){
    const salt = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO users(username,passhash,salt,role,nama,created_at) VALUES(?,?,?,?,?,?)')
      .run('admin', hash('admin123', salt), salt, 'admin', 'Administrator', now());
    console.log('Seed: akun admin/admin123 (role admin) dibuat');
  }
})();

/* ---- Migrasi data v1 (kv_shared → tabel) ---- */
(function migrate(){
  const kvGet = k => { const r = db.prepare('SELECT value FROM kv_shared WHERE key=?').get(k); return r ? J(r.value, null) : null; };
  if(db.prepare('SELECT COUNT(*) c FROM posts').get().c === 0){
    (kvGet('posts') || []).forEach(p => db.prepare(
      'INSERT OR IGNORE INTO posts(id,at,author,author_user,group_id,body,img,cart,likes,comments) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(p.id || uid(), p.at || now(), p.author || '', p.authorUser || '', p.group || null,
        p.text || '', p.img || '', JSON.stringify(p.cart || []), p.likes || 0, JSON.stringify(p.comments || [])));
  }
  if(db.prepare('SELECT COUNT(*) c FROM groups').get().c === 0){
    (kvGet('groups') || []).forEach(g => db.prepare(
      'INSERT OR IGNORE INTO groups(id,at,nama,deskripsi,tipe,harga,owner,owner_user,members,subs) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run(g.id || uid(), g.at || now(), g.nama || '', g.desc || '', g.tipe || 'gratis', g.harga || 0,
        g.owner || '', g.ownerUser || '', JSON.stringify(g.members || []), JSON.stringify(g.subs || [])));
  }
  if(db.prepare('SELECT COUNT(*) c FROM ledger').get().c === 0){
    (kvGet('ledger') || []).forEach(l => insertLedger(l));
  }
  db.prepare("DELETE FROM kv_shared WHERE key IN ('posts','groups','ledger')").run();
})();

/* ---------------- Serialisasi baris → bentuk klien ---------------- */
const rowPost = r => ({ id: r.id, at: r.at, author: r.author, authorUser: r.author_user,
  group: r.group_id || null, text: r.body, img: r.img, cart: J(r.cart, []), likes: r.likes, comments: J(r.comments, []) });
const rowGroup = r => ({ id: r.id, at: r.at, nama: r.nama, desc: r.deskripsi, tipe: r.tipe, harga: r.harga,
  owner: r.owner, ownerUser: r.owner_user, members: J(r.members, []), subs: J(r.subs, []) });
const rowLedger = r => ({ id: r.id, at: r.at, tipe: r.tipe, kanal: r.kanal, kanalTipe: r.kanal_tipe,
  kode: r.kode, user: r.user, jumlah: r.jumlah, status: r.status, detail: r.detail, url: r.url, pairId: r.pair_id });
function insertLedger(l){
  db.prepare('INSERT OR REPLACE INTO ledger(id,at,tipe,kanal,kanal_tipe,kode,user,jumlah,status,detail,url,pair_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(l.id || uid(), l.at || now(), l.tipe || '', l.kanal || '', l.kanalTipe || l.kanal_tipe || '',
      l.kode || '', l.user || '', l.jumlah != null ? Math.round(l.jumlah) : null,
      l.status || '', l.detail || '', l.url || '', l.pairId || l.pair_id || '');
}

/* ---------------- KV helpers ---------------- */
function kvUserGetAll(uidNum){
  const out = {};
  for(const r of db.prepare('SELECT key,value FROM kv_user WHERE user_id=?').all(uidNum)) out[r.key] = J(r.value, null);
  return out;
}
function kvUserGet(uidNum, key){ const r = db.prepare('SELECT value FROM kv_user WHERE user_id=? AND key=?').get(uidNum, key); return r ? J(r.value, null) : null; }
function kvUserSet(uidNum, key, value){
  db.prepare(`INSERT INTO kv_user(user_id,key,value,updated_at) VALUES(?,?,?,?)
    ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
    .run(uidNum, key, JSON.stringify(value), now());
}
function settings(){
  const r = db.prepare('SELECT value FROM kv_shared WHERE key=?').get('settings');
  const s = r ? J(r.value, {}) : {};
  // pastikan konfigurasi afiliasi eksternal ada (kunci postback rahasia utk jaringan)
  if(!s.affiliate || !s.affiliate.postbackKey){
    s.affiliate = Object.assign({ networks: [] }, s.affiliate || {}, { postbackKey: (s.affiliate && s.affiliate.postbackKey) || crypto.randomBytes(12).toString('hex') });
    db.prepare(`INSERT INTO kv_shared(key,value,updated_at) VALUES('settings',?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
      .run(JSON.stringify(s), now());
  }
  return { komisi: Object.assign({}, DEFAULT_KOMISI, s.komisi || {}),
           plans: Object.assign({}, DEFAULT_PLANS, s.plans || {}),
           affiliate: s.affiliate, raw: s };
}
function affCodeOf(uidNum){
  const m = kvUserGet(uidNum, 'membership') || {};
  if(!m.affCode){ m.affCode = 'GH' + crypto.randomBytes(3).toString('hex').toUpperCase(); kvUserSet(uidNum, 'membership', m); }
  return m.affCode;
}
function findUserByAffCode(code){
  for(const u of db.prepare('SELECT id, username FROM users').all()){
    const m = kvUserGet(u.id, 'membership');
    if(m && m.affCode === code) return u;
  }
  return null;
}

/* ---------------- Rate limit sederhana (in-memory per IP) ---------------- */
const RL = new Map();
function rateLimit(ip, bucket, max, windowMs){
  const k = bucket + '|' + ip, t = Date.now();
  const e = RL.get(k) || { n: 0, t };
  if(t - e.t > windowMs){ e.n = 0; e.t = t; }
  e.n++; RL.set(k, e);
  return e.n <= max;
}

/* ---------------- HTTP utils ---------------- */
function send(res, code, obj){ res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)); }
function readBody(req){
  return new Promise((resolve, reject) => {
    let d = '';
    req.on('data', c => { d += c; if(d.length > 5e6) req.destroy(); });
    req.on('end', () => { try{ resolve(d ? JSON.parse(d) : {}); }catch(e){ reject(new Error('JSON tidak valid')); } });
    req.on('error', reject);
  });
}
function authUser(req){
  const h = req.headers['authorization'] || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if(!token) return null;
  const s = db.prepare('SELECT user_id FROM sessions WHERE token=?').get(token);
  return s ? (db.prepare('SELECT id,username,role,nama FROM users WHERE id=?').get(s.user_id) || null) : null;
}
const sanitizeUsername = u => String(u || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 30);
const str = (v, max) => String(v == null ? '' : v).slice(0, max);

/* ---------------- Relay data pasar (server-side, allowlist) ---------------- */
const RELAY_HOSTS = new Set(['query1.finance.yahoo.com','query2.finance.yahoo.com','api.coingecko.com',
  'open.er-api.com','api.worldbank.org','www.cnbcindonesia.com','www.antaranews.com']);
async function relay(req, res, url, ip){
  if(!rateLimit(ip, 'relay', 120, 60000)) return send(res, 429, { error: 'Terlalu banyak permintaan' });
  const target = url.searchParams.get('url') || '';
  let tu; try{ tu = new URL(target); }catch(e){ return send(res, 400, { error: 'URL tidak valid' }); }
  if(tu.protocol !== 'https:' || !RELAY_HOSTS.has(tu.hostname)) return send(res, 403, { error: 'Host tidak diizinkan' });
  try{
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 12000);
    const r = await fetch(tu, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0 (GHubOne relay)' } });
    clearTimeout(t);
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') || 'text/plain', 'Cache-Control': 'no-store' });
    res.end(buf);
  }catch(e){ send(res, 502, { error: 'Relay gagal: ' + e.message }); }
}

/* ---------------- Komposisi data utk klien ---------------- */
function sharedFor(user){
  const posts = db.prepare('SELECT * FROM posts ORDER BY at DESC LIMIT 500').all().map(rowPost);
  const groups = db.prepare('SELECT * FROM groups ORDER BY at DESC LIMIT 200').all().map(rowGroup);
  let ledRows;
  if(user.role === 'admin') ledRows = db.prepare('SELECT * FROM ledger ORDER BY at DESC LIMIT 1000').all();
  else {
    const code = affCodeOf(user.id);
    ledRows = db.prepare('SELECT * FROM ledger WHERE user=? OR kode=? ORDER BY at DESC LIMIT 500').all(user.username, code);
  }
  const s = settings();
  const shared = { posts, groups, ledger: ledRows.map(rowLedger),
    settings: { komisi: s.komisi, plans: s.plans } };
  if(user.role === 'admin') shared.settings.affiliate = s.affiliate; // kunci postback hanya utk admin
  return shared;
}

/* ============================ API ROUTER ============================ */
async function api(req, res, url, ip){
  const p = url.pathname;
  const user = authUser(req);
  let m;

  /* ---------- Auth ---------- */
  if(p === '/api/auth/register' && req.method === 'POST'){
    if(!rateLimit(ip, 'auth', 20, 300000)) return send(res, 429, { error: 'Terlalu banyak percobaan, coba lagi nanti' });
    const b = await readBody(req);
    const username = sanitizeUsername(b.username), password = String(b.password || '');
    if(username.length < 3) return send(res, 400, { error: 'Username minimal 3 karakter (huruf/angka/._-)' });
    if(password.length < 6) return send(res, 400, { error: 'Password minimal 6 karakter' });
    if(db.prepare('SELECT id FROM users WHERE username=?').get(username)) return send(res, 409, { error: 'Username sudah dipakai' });
    const salt = crypto.randomBytes(16).toString('hex');
    db.prepare('INSERT INTO users(username,passhash,salt,role,nama,created_at) VALUES(?,?,?,?,?,?)')
      .run(username, hash(password, salt), salt, 'user', str(b.nama, 60), now());
    const u = db.prepare('SELECT id,username,role,nama FROM users WHERE username=?').get(username);
    kvUserSet(u.id, 'membership', { plan: 'free', since: null, expiry: null, affCode: 'GH' + crypto.randomBytes(3).toString('hex').toUpperCase() });
    if(b.nama) kvUserSet(u.id, 'profile', { nama: str(b.nama, 60), provinsi: 'DKI Jakarta' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)').run(token, u.id, now());
    return send(res, 200, { token, user: u });
  }
  if(p === '/api/auth/login' && req.method === 'POST'){
    if(!rateLimit(ip, 'auth', 20, 300000)) return send(res, 429, { error: 'Terlalu banyak percobaan, coba lagi nanti' });
    const b = await readBody(req);
    const u = db.prepare('SELECT * FROM users WHERE username=?').get(sanitizeUsername(b.username));
    if(!u || hash(String(b.password || ''), u.salt) !== u.passhash) return send(res, 401, { error: 'Username / password salah' });
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('INSERT INTO sessions(token,user_id,created_at) VALUES(?,?,?)').run(token, u.id, now());
    return send(res, 200, { token, user: { id: u.id, username: u.username, role: u.role, nama: u.nama } });
  }
  if(p === '/api/auth/logout' && req.method === 'POST'){
    const h = req.headers['authorization'] || '';
    if(h.startsWith('Bearer ')) db.prepare('DELETE FROM sessions WHERE token=?').run(h.slice(7));
    return send(res, 200, { ok: true });
  }

  /* ---------- Klik afiliasi (publik, dari go.html) — STATISTIK SAJA, Rp0 ---------- */
  if(p === '/api/click' && req.method === 'POST'){
    if(!rateLimit(ip, 'click', 60, 60000)) return send(res, 429, { error: 'Terlalu cepat' });
    const b = await readBody(req);
    const kode = str(b.kode, 20), kanal = str(b.kanal, 40), urlP = str(b.url, 500);
    db.prepare('INSERT INTO clicks(kode,kanal,url,at) VALUES(?,?,?,?)').run(kode, kanal, urlP, now());
    const owner = findUserByAffCode(kode);
    insertLedger({ tipe: 'klik-afiliasi', kanal: kanal || 'produk', kode, user: owner ? owner.username : '',
      url: urlP.slice(0, 300), jumlah: null, status: 'statistik klik — tidak bernilai komisi' });
    return send(res, 200, { ok: true });
  }

  /* ---------- Deeplink builder (publik) — bungkus URL produk dgn template jaringan afiliasi ---------- */
  if(p === '/api/deeplink' && req.method === 'GET'){
    const target = url.searchParams.get('url') || '';
    const subid = str(url.searchParams.get('subid'), 20);
    let tu; try{ tu = new URL(target); }catch(e){ return send(res, 400, { error: 'URL tidak valid' }); }
    const S0 = settings();
    const net = (S0.affiliate.networks || []).find(n => n.domain && tu.hostname.endsWith(n.domain));
    if(net && net.template){
      const finalUrl = net.template.replace('{url}', encodeURIComponent(target)).replace('{subid}', encodeURIComponent(subid));
      return send(res, 200, { finalUrl, network: net.domain, wrapped: true });
    }
    return send(res, 200, { finalUrl: target, wrapped: false,
      note: 'Belum ada template jaringan afiliasi utk domain ini (atur di Panel Admin → Afiliasi Eksternal)' });
  }

  /* ---------- POSTBACK jaringan afiliasi eksternal (publik + kunci rahasia) ----------
   * Dipanggil server jaringan (S2S) saat pembelian TERKONFIRMASI:
   *   GET/POST /api/affiliate/postback?key=<postbackKey>&sub_id=<kodeAffUser>
   *        &amount=<payoutRp>&order_id=<idUnik>&network=<nama>&status=approved
   * Payout dibagi: pengguna (produkUser%) + sistem (sisanya). Duplikat order_id ditolak.
   */
  if(p === '/api/affiliate/postback'){
    const S0 = settings();
    const q = url.searchParams;
    const b = req.method === 'POST' ? await readBody(req).catch(() => ({})) : {};
    const g = k => str(q.get(k) != null ? q.get(k) : b[k], 60);
    if(g('key') !== S0.affiliate.postbackKey) return send(res, 403, { error: 'Kunci postback salah' });
    const status = (g('status') || 'approved').toLowerCase();
    if(status !== 'approved' && status !== 'paid') return send(res, 200, { ok: true, ignored: 'status ' + status });
    const subId = g('sub_id'), network = g('network') || 'jaringan', orderId = g('order_id');
    const amount = Math.round(Number(g('amount')) || 0);
    if(!subId || amount <= 0) return send(res, 400, { error: 'sub_id & amount (payout Rp) wajib' });
    const owner = findUserByAffCode(subId);
    if(!owner) return send(res, 404, { error: 'sub_id tidak dikenal' });
    if(orderId && db.prepare("SELECT id FROM ledger WHERE tipe='komisi-produk' AND url=?").get(network + ':' + orderId))
      return send(res, 409, { error: 'order_id sudah pernah dicatat (duplikat)' });
    const userShare = Math.round(amount * S0.komisi.produkUser);
    const sysShare = amount - userShare;
    const pairId = uid();
    insertLedger({ tipe: 'komisi-produk', kanal: network, kode: subId, user: owner.username,
      jumlah: userShare, status: 'pembelian terverifikasi (postback)', pairId, url: orderId ? network + ':' + orderId : '',
      detail: `Payout jaringan Rp${amount.toLocaleString('id-ID')} → porsi pengguna ${Math.round(S0.komisi.produkUser * 100)}%` });
    insertLedger({ tipe: 'fee-sistem', kanalTipe: 'produk', kanal: network, kode: 'SISTEM', user: 'SISTEM',
      jumlah: sysShare, status: 'pendapatan sistem (afiliasi eksternal)', pairId,
      detail: `Porsi sistem ${100 - Math.round(S0.komisi.produkUser * 100)}% dari payout Rp${amount.toLocaleString('id-ID')}` });
    return send(res, 200, { ok: true, userShare, sysShare });
  }

  /* ---------- Butuh login ---------- */
  if(!user) return send(res, 401, { error: 'Belum login' });
  const S = settings();

  if(p === '/api/me' && req.method === 'GET') return send(res, 200, { user });
  if(p === '/api/data' && req.method === 'GET')
    return send(res, 200, { user: kvUserGetAll(user.id), shared: sharedFor(user), me: user });

  if((m = p.match(/^\/api\/data\/user\/([a-zA-Z0-9_-]{1,40})$/)) && req.method === 'PUT'){
    const b = await readBody(req);
    kvUserSet(user.id, m[1], b.value);
    return send(res, 200, { ok: true });
  }

  /* ---------- Sosial Hub: posts ---------- */
  if(p === '/api/posts' && req.method === 'POST'){
    const b = await readBody(req);
    const text = str(b.text, 5000), img = str(b.img, 500);
    if(!text && !img) return send(res, 400, { error: 'Konten kosong' });
    let groupId = b.group ? str(b.group, 20) : null;
    if(groupId){
      const g = db.prepare('SELECT * FROM groups WHERE id=?').get(groupId);
      if(!g) return send(res, 404, { error: 'Grup tidak ditemukan' });
      const gg = rowGroup(g);
      const subscribed = gg.ownerUser === user.username ||
        (gg.tipe !== 'langganan' ? gg.members.includes(user.username)
          : gg.subs.some(x => x.by === user.username && new Date(x.until) > new Date()));
      if(!subscribed) return send(res, 403, { error: 'Anda bukan anggota/pelanggan grup ini' });
    }
    const profile = kvUserGet(user.id, 'profile') || {};
    const cart = Array.isArray(b.cart) ? b.cart.slice(0, 20).map(c => ({
      id: uid(), nama: str(c.nama, 120), url: str(c.url, 500), harga: c.harga ? Math.round(Number(c.harga)) : null
    })).filter(c => c.nama && /^https?:\/\//i.test(c.url)) : [];
    const id = uid();
    db.prepare('INSERT INTO posts(id,at,author,author_user,group_id,body,img,cart,likes,comments) VALUES(?,?,?,?,?,?,?,?,0,\'[]\')')
      .run(id, now(), profile.nama || user.nama || user.username, user.username, groupId, text, img, JSON.stringify(cart));
    return send(res, 200, { ok: true, id });
  }
  if((m = p.match(/^\/api\/posts\/([a-z0-9]+)$/)) && req.method === 'DELETE'){
    const r = db.prepare('SELECT author_user FROM posts WHERE id=?').get(m[1]);
    if(!r) return send(res, 404, { error: 'Konten tidak ditemukan' });
    if(r.author_user !== user.username && user.role !== 'admin') return send(res, 403, { error: 'Hanya pemilik konten / admin' });
    db.prepare('DELETE FROM posts WHERE id=?').run(m[1]);
    return send(res, 200, { ok: true });
  }
  if((m = p.match(/^\/api\/posts\/([a-z0-9]+)\/like$/)) && req.method === 'POST'){
    db.prepare('UPDATE posts SET likes = likes + 1 WHERE id=?').run(m[1]);
    return send(res, 200, { ok: true });
  }
  if((m = p.match(/^\/api\/posts\/([a-z0-9]+)\/comment$/)) && req.method === 'POST'){
    const b = await readBody(req);
    const text = str(b.text, 1000);
    if(!text) return send(res, 400, { error: 'Komentar kosong' });
    const r = db.prepare('SELECT comments FROM posts WHERE id=?').get(m[1]);
    if(!r) return send(res, 404, { error: 'Konten tidak ditemukan' });
    const profile = kvUserGet(user.id, 'profile') || {};
    const cs = J(r.comments, []);
    cs.push({ by: profile.nama || user.nama || user.username, byUser: user.username, at: now(), text });
    db.prepare('UPDATE posts SET comments=? WHERE id=?').run(JSON.stringify(cs), m[1]);
    return send(res, 200, { ok: true });
  }
  if((m = p.match(/^\/api\/posts\/([a-z0-9]+)\/cart$/)) && req.method === 'POST'){
    const b = await readBody(req);
    const r = db.prepare('SELECT author_user, cart FROM posts WHERE id=?').get(m[1]);
    if(!r) return send(res, 404, { error: 'Konten tidak ditemukan' });
    if(r.author_user !== user.username && user.role !== 'admin') return send(res, 403, { error: 'Hanya pemilik konten' });
    const item = { id: uid(), nama: str(b.nama, 120), url: str(b.url, 500), harga: b.harga ? Math.round(Number(b.harga)) : null };
    if(!item.nama || !/^https?:\/\//i.test(item.url)) return send(res, 400, { error: 'Nama & URL produk (https://…) wajib' });
    const cart = J(r.cart, []); cart.push(item);
    db.prepare('UPDATE posts SET cart=? WHERE id=?').run(JSON.stringify(cart), m[1]);
    return send(res, 200, { ok: true });
  }
  if((m = p.match(/^\/api\/posts\/([a-z0-9]+)\/cart\/([a-z0-9]+)$/)) && req.method === 'DELETE'){
    const r = db.prepare('SELECT author_user, cart FROM posts WHERE id=?').get(m[1]);
    if(!r) return send(res, 404, { error: 'Konten tidak ditemukan' });
    if(r.author_user !== user.username && user.role !== 'admin') return send(res, 403, { error: 'Hanya pemilik/admin' });
    db.prepare('UPDATE posts SET cart=? WHERE id=?').run(JSON.stringify(J(r.cart, []).filter(c => c.id !== m[2])), m[1]);
    return send(res, 200, { ok: true });
  }

  /* ---------- Sosial Hub: groups ---------- */
  if(p === '/api/groups' && req.method === 'POST'){
    const b = await readBody(req);
    const nama = str(b.nama, 80);
    if(!nama) return send(res, 400, { error: 'Nama grup wajib' });
    const tipe = b.tipe === 'langganan' ? 'langganan' : 'gratis';
    const harga = tipe === 'langganan' ? Math.max(0, Math.round(Number(b.harga) || 0)) : 0;
    const profile = kvUserGet(user.id, 'profile') || {};
    const id = uid();
    db.prepare('INSERT INTO groups(id,at,nama,deskripsi,tipe,harga,owner,owner_user,members,subs) VALUES(?,?,?,?,?,?,?,?,\'[]\',\'[]\')')
      .run(id, now(), nama, str(b.desc, 300), tipe, harga, profile.nama || user.nama || user.username, user.username);
    return send(res, 200, { ok: true, id });
  }
  if((m = p.match(/^\/api\/groups\/([a-z0-9]+)\/join$/)) && req.method === 'POST'){
    const r = db.prepare('SELECT * FROM groups WHERE id=?').get(m[1]);
    if(!r) return send(res, 404, { error: 'Grup tidak ditemukan' });
    const g = rowGroup(r);
    if(g.tipe === 'langganan' && g.ownerUser !== user.username){
      const exp = new Date(); exp.setMonth(exp.getMonth() + 1);
      g.subs.push({ by: user.username, at: now(), until: exp.toISOString(), harga: g.harga });
      // 100% pendapatan langganan menjadi milik kreator grup — sistem TIDAK memotong
      insertLedger({ tipe: 'langganan-grup', kanal: g.nama, user: g.ownerUser || g.owner, jumlah: g.harga,
        status: 'pendapatan kreator (100%)',
        detail: `Langganan oleh @${user.username}: Rp${g.harga.toLocaleString('id-ID')} — penuh ke pembuat grup, tanpa potongan sistem` });
    }
    if(!g.members.includes(user.username)) g.members.push(user.username);
    db.prepare('UPDATE groups SET members=?, subs=? WHERE id=?').run(JSON.stringify(g.members), JSON.stringify(g.subs), g.id);
    return send(res, 200, { ok: true });
  }
  if((m = p.match(/^\/api\/groups\/([a-z0-9]+)$/)) && req.method === 'DELETE'){
    const r = db.prepare('SELECT owner_user FROM groups WHERE id=?').get(m[1]);
    if(!r) return send(res, 404, { error: 'Grup tidak ditemukan' });
    if(r.owner_user !== user.username && user.role !== 'admin') return send(res, 403, { error: 'Hanya pemilik/admin' });
    db.prepare('DELETE FROM groups WHERE id=?').run(m[1]);
    db.prepare('DELETE FROM posts WHERE group_id=?').run(m[1]);
    return send(res, 200, { ok: true });
  }

  /* ---------- Membership & afiliasi ---------- */
  if(p === '/api/membership/buy' && req.method === 'POST'){
    const b = await readBody(req);
    const plan = ['free', 'pro', 'elite'].includes(b.plan) ? b.plan : null;
    if(!plan) return send(res, 400, { error: 'Plan tidak dikenal' });
    const mem = kvUserGet(user.id, 'membership') || { plan: 'free', affCode: 'GH' + crypto.randomBytes(3).toString('hex').toUpperCase() };
    if(plan === 'free'){ mem.plan = 'free'; mem.expiry = null; kvUserSet(user.id, 'membership', mem); return send(res, 200, { ok: true, membership: mem }); }
    const harga = S.plans[plan] || 0;
    const base = (mem.expiry && new Date(mem.expiry) > new Date() && mem.plan === plan) ? new Date(mem.expiry) : new Date();
    const exp = new Date(base); exp.setMonth(exp.getMonth() + 1);
    const perpanjang = base.getTime() > Date.now();
    mem.plan = plan; mem.since = mem.since || now(); mem.expiry = exp.toISOString();
    kvUserSet(user.id, 'membership', mem);
    insertLedger({ tipe: 'membership', kanal: plan, user: user.username, kode: mem.affCode, jumlah: -harga,
      status: 'pembayaran', detail: `${perpanjang ? 'Perpanjang' : 'Daftar'} ${plan} 1 bulan` });
    const ref = str(b.ref, 12);
    if(ref && ref !== mem.affCode){
      const owner = findUserByAffCode(ref);
      if(owner && owner.username !== user.username){
        insertLedger({ tipe: 'referral-membership', kanal: plan, kode: ref, user: owner.username,
          jumlah: Math.round(harga * S.komisi.membershipRef), status: 'komisi referral',
          detail: `Referral @${user.username} daftar ${plan}: ${S.komisi.membershipRef * 100}% × Rp${harga.toLocaleString('id-ID')}` });
      }
    }
    return send(res, 200, { ok: true, membership: mem });
  }
  /* (Catatan: komisi produk TIDAK bisa dibuat manual oleh pengguna —
     hanya lahir dari /api/affiliate/postback yang dipanggil jaringan afiliasi eksternal.) */

  /* ---------- Koleksi bersama: settings (admin) & moderasi massal (admin) ---------- */
  if((m = p.match(/^\/api\/data\/shared\/(settings|posts|groups|ledger)$/))){
    const key = m[1];
    if(req.method === 'GET'){
      const sh = sharedFor(user);
      return send(res, 200, { value: sh[key] });
    }
    if(req.method === 'PUT'){
      if(user.role !== 'admin') return send(res, 403, { error: 'Hanya admin' });
      const b = await readBody(req);
      if(key === 'settings'){
        db.prepare(`INSERT INTO kv_shared(key,value,updated_at) VALUES('settings',?,?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`)
          .run(JSON.stringify(b.value || {}), now());
        return send(res, 200, { ok: true });
      }
      // moderasi massal admin: ganti isi tabel dengan array kiriman
      const arr = Array.isArray(b.value) ? b.value : [];
      if(key === 'posts'){
        db.prepare('DELETE FROM posts').run();
        arr.forEach(pp => db.prepare('INSERT INTO posts(id,at,author,author_user,group_id,body,img,cart,likes,comments) VALUES(?,?,?,?,?,?,?,?,?,?)')
          .run(pp.id || uid(), pp.at || now(), pp.author || '', pp.authorUser || '', pp.group || null, pp.text || '', pp.img || '',
            JSON.stringify(pp.cart || []), pp.likes || 0, JSON.stringify(pp.comments || [])));
      } else if(key === 'groups'){
        db.prepare('DELETE FROM groups').run();
        arr.forEach(gg => db.prepare('INSERT INTO groups(id,at,nama,deskripsi,tipe,harga,owner,owner_user,members,subs) VALUES(?,?,?,?,?,?,?,?,?,?)')
          .run(gg.id || uid(), gg.at || now(), gg.nama || '', gg.desc || '', gg.tipe || 'gratis', gg.harga || 0,
            gg.owner || '', gg.ownerUser || '', JSON.stringify(gg.members || []), JSON.stringify(gg.subs || [])));
      } else if(key === 'ledger'){
        db.prepare('DELETE FROM ledger').run();
        arr.forEach(insertLedger);
      }
      return send(res, 200, { ok: true });
    }
  }

  /* ---------- Admin ---------- */
  if(p.startsWith('/api/admin/')){
    if(user.role !== 'admin') return send(res, 403, { error: 'Hanya admin' });

    if(p === '/api/admin/stats' && req.method === 'GET'){
      const users = db.prepare("SELECT id FROM users WHERE role='user'").all();
      let memberAktif = 0;
      for(const u of users){
        const mm = kvUserGet(u.id, 'membership');
        if(mm && mm.expiry && new Date(mm.expiry) > new Date()) memberAktif++;
      }
      return send(res, 200, {
        totalUser: users.length, memberAktif,
        klik: db.prepare('SELECT COUNT(*) c FROM clicks').get().c,
        posts: db.prepare('SELECT COUNT(*) c FROM posts').get().c,
        groups: db.prepare('SELECT COUNT(*) c FROM groups').get().c,
        ledger: db.prepare('SELECT COUNT(*) c FROM ledger').get().c,
        sesiAktif: db.prepare('SELECT COUNT(*) c FROM sessions').get().c
      });
    }
    if(p === '/api/admin/users' && req.method === 'GET'){
      const users = db.prepare('SELECT id,username,role,nama,created_at FROM users').all();
      return send(res, 200, { users: users.map(u => {
        const kv = kvUserGetAll(u.id);
        return { ...u, membership: kv.membership || { plan: 'free' }, profile: kv.profile || {},
          counts: { tasks: (kv.tasks || []).length, txs: (kv.txs || []).length, goals: (kv.goals || []).length } };
      }) });
    }
    if((m = p.match(/^\/api\/admin\/user\/(\d+)\/membership$/)) && req.method === 'PUT'){
      const b = await readBody(req);
      const uidNum = Number(m[1]);
      const mem = kvUserGet(uidNum, 'membership') || { plan: 'free', affCode: 'GH' + crypto.randomBytes(3).toString('hex').toUpperCase() };
      if(b.plan) mem.plan = String(b.plan);
      if(b.bulan != null){
        if(Number(b.bulan) <= 0 || b.plan === 'free'){ mem.expiry = null; if(b.plan === 'free') mem.plan = 'free'; }
        else { const e = new Date(); e.setMonth(e.getMonth() + Number(b.bulan)); mem.expiry = e.toISOString(); mem.since = mem.since || now(); }
      }
      kvUserSet(uidNum, 'membership', mem);
      return send(res, 200, { ok: true, membership: mem });
    }
    if((m = p.match(/^\/api\/admin\/user\/(\d+)$/)) && req.method === 'DELETE'){
      const uidNum = Number(m[1]);
      const t = db.prepare('SELECT role FROM users WHERE id=?').get(uidNum);
      if(t && t.role === 'admin') return send(res, 400, { error: 'Tidak bisa menghapus admin' });
      db.prepare('DELETE FROM users WHERE id=?').run(uidNum);
      db.prepare('DELETE FROM kv_user WHERE user_id=?').run(uidNum);
      db.prepare('DELETE FROM sessions WHERE user_id=?').run(uidNum);
      return send(res, 200, { ok: true });
    }
    if(p === '/api/admin/password' && req.method === 'PUT'){
      const b = await readBody(req);
      if(String(b.password || '').length < 6) return send(res, 400, { error: 'Password minimal 6 karakter' });
      const salt = crypto.randomBytes(16).toString('hex');
      db.prepare('UPDATE users SET passhash=?, salt=? WHERE id=?').run(hash(String(b.password), salt), salt, user.id);
      return send(res, 200, { ok: true });
    }
  }

  return send(res, 404, { error: 'Endpoint tidak ditemukan' });
}

/* ---------------- Static ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown; charset=utf-8' };
function serveStatic(req, res, url){
  let fp = decodeURIComponent(url.pathname);
  if(fp === '/') fp = '/index.html';
  const full = path.normalize(path.join(ROOT, fp));
  if(!full.startsWith(ROOT) || full.includes(path.sep + 'data' + path.sep) ||
     full.includes(path.sep + '.git') || fp === '/server.js')
    { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(full, (err, buf) => {
    if(err){ res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  try{
    if(url.pathname === '/api/relay') await relay(req, res, url, ip);
    else if(url.pathname.startsWith('/api/')) await api(req, res, url, ip);
    else serveStatic(req, res, url);
  }catch(e){
    console.error(e);
    try{ send(res, 500, { error: e.message }); }catch(_){}
  }
}).listen(PORT, '0.0.0.0', () => console.log(`GHub One backend v2 + SQLite siap di http://0.0.0.0:${PORT}`));
