/* ========== GHub One — Store: auth & sinkronisasi database server ==========
 * Menggantikan penyimpanan lokal: semua koleksi kini tersimpan di database
 * SQLite di server (server.js) per akun pengguna. Koleksi bersama (posts,
 * groups, ledger, settings) dipakai lintas pengguna utk Sosial Hub & komisi.
 * DB.get/DB.set tetap sinkron (cache di memori) — perubahan disinkronkan ke
 * server secara otomatis (debounce 350 ms).
 */
const Store = {
  token: localStorage.getItem('ghub_token') || null,
  me: null,
  cache: { user: {}, shared: { posts: [], groups: [], ledger: [], settings: null } },
  _timers: {}, _initError: null,
  SHARED: new Set(['posts', 'groups', 'ledger', 'settings']),

  async api(pathname, opts = {}){
    const r = await fetch(pathname, {
      method: opts.method || 'GET',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        this.token ? { 'Authorization': 'Bearer ' + this.token } : {}),
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if(!r.ok){ const e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; }
    return j;
  },

  applySettings(){
    const s = this.cache.shared.settings;
    if(s){
      if(s.komisi) Object.assign(KOMISI, s.komisi);
      if(s.plans) PLANS.forEach(p => { if(s.plans[p.id] != null) p.harga = s.plans[p.id]; });
    }
  },
  _normalize(){
    ['posts', 'groups', 'ledger'].forEach(k => {
      if(!Array.isArray(this.cache.shared[k])) this.cache.shared[k] = [];
    });
  },

  async init(){
    if(!this.token) return false;
    try{
      const d = await this.api('/api/data');
      this.me = d.me;
      this.cache.user = d.user || {};
      this.cache.shared = Object.assign({ posts: [], groups: [], ledger: [], settings: null }, d.shared || {});
      this._normalize(); this.applySettings();
      return true;
    }catch(e){
      if(e.status === 401){ this.token = null; localStorage.removeItem('ghub_token'); }
      else this._initError = e.message;
      return false;
    }
  },

  async login(u, p){
    const d = await this.api('/api/auth/login', { method: 'POST', body: { username: u, password: p } });
    this.token = d.token; localStorage.setItem('ghub_token', d.token); this.me = d.user;
    return d.user;
  },
  async register(u, p, nama){
    const d = await this.api('/api/auth/register', { method: 'POST', body: { username: u, password: p, nama } });
    this.token = d.token; localStorage.setItem('ghub_token', d.token); this.me = d.user;
    return d.user;
  },
  async logout(){
    try{ await this.api('/api/auth/logout', { method: 'POST' }); }catch(e){}
    this.token = null; this.me = null; localStorage.removeItem('ghub_token');
    location.reload();
  },

  get(key, def){
    const src = this.SHARED.has(key) ? this.cache.shared : this.cache.user;
    return (src[key] !== undefined && src[key] !== null) ? src[key] : def;
  },
  set(key, val){
    const shared = this.SHARED.has(key);
    (shared ? this.cache.shared : this.cache.user)[key] = val;
    clearTimeout(this._timers[key]);
    this._timers[key] = setTimeout(() => {
      this.api(`/api/data/${shared ? 'shared' : 'user'}/${key}`, { method: 'PUT', body: { value: val } })
        .catch(e => { if(typeof Toast !== 'undefined') Toast.show('⚠ Sinkron server gagal: ' + e.message); });
    }, 350);
  },

  async refreshShared(){
    try{
      const before = JSON.stringify([this.cache.shared.posts, this.cache.shared.groups, this.cache.shared.ledger]);
      const d = await this.api('/api/data');
      this.cache.user = d.user || this.cache.user;
      Object.assign(this.cache.shared, d.shared || {});
      this._normalize(); this.applySettings();
      return JSON.stringify([this.cache.shared.posts, this.cache.shared.groups, this.cache.shared.ledger]) !== before;
    }catch(e){ return false; }
  }
};

/* Shim kompatibilitas — seluruh views tetap memakai DB.get/DB.set */
const DB = {
  get: (k, d) => Store.get(k, d),
  set: (k, v) => Store.set(k, v),
  del: (k) => Store.set(k, null)
};

/* ---- UI gerbang login/daftar (index.html) ---- */
const Auth = {
  tab: 'login',
  switchTab(t){
    this.tab = t;
    const L = document.getElementById('authLoginForm'), R = document.getElementById('authRegForm');
    if(L) L.style.display = t === 'login' ? 'block' : 'none';
    if(R) R.style.display = t === 'reg' ? 'block' : 'none';
    document.querySelectorAll('#authGate .tab').forEach(b => b.classList.toggle('active', b.dataset.t === t));
  },
  async doLogin(){
    const u = document.getElementById('authUser').value, p = document.getElementById('authPass').value;
    try{
      await Store.login(u, p);
      await Store.init();
      document.getElementById('authGate').style.display = 'none';
      App.refreshChrome(); App.navigate();
      Toast.show('Selamat datang kembali, ' + (Store.me.nama || Store.me.username) + ' 👋');
    }catch(e){ Toast.show(e.message); }
  },
  async doRegister(){
    const nama = document.getElementById('regNama').value.trim();
    const u = document.getElementById('regUser').value, p = document.getElementById('regPass').value;
    try{
      await Store.register(u, p, nama);
      await Store.init();
      document.getElementById('authGate').style.display = 'none';
      App.refreshChrome(); App.navigate();
      Toast.show('Akun dibuat — selamat datang di GHub One 🎉');
    }catch(e){ Toast.show(e.message); }
  }
};
