/* ========== GHub One — Core App: router & utils ==========
 * Penyimpanan data: lihat js/store.js (Store + shim DB → database server SQLite) */

const U = {
  uid(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); },
  esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },
  rp(n, dec){ if(n==null || isNaN(n)) return '—';
    return 'Rp' + Number(n).toLocaleString('id-ID', {maximumFractionDigits: dec===undefined?0:dec}); },
  num(n, dec){ if(n==null || isNaN(n)) return '—'; return Number(n).toLocaleString('id-ID',{maximumFractionDigits:dec===undefined?2:dec}); },
  pct(n, dec){ if(n==null || isNaN(n)) return '—'; return Number(n).toLocaleString('id-ID',{maximumFractionDigits:dec===undefined?2:dec}) + '%'; },
  dt(iso){ if(!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); },
  dtm(iso){ if(!iso) return '—'; const d = new Date(iso); return d.toLocaleDateString('id-ID',{day:'numeric',month:'short'}) + ' ' + d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); },
  time(iso){ const d = iso? new Date(iso): new Date(); return d.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}); },
  ago(iso){ const s = (Date.now()-new Date(iso).getTime())/1000;
    if(s<60) return 'baru saja'; if(s<3600) return Math.floor(s/60)+' mnt lalu';
    if(s<86400) return Math.floor(s/3600)+' jam lalu'; return Math.floor(s/86400)+' hari lalu'; },
  age(birth){ const b=new Date(birth), n=new Date(); let a=n.getFullYear()-b.getFullYear();
    if(n.getMonth()<b.getMonth() || (n.getMonth()==b.getMonth() && n.getDate()<b.getDate())) a--; return a; },
  months:['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'],
  monthsShort:['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'],
  clamp(v,a,b){ return Math.max(a, Math.min(b, v)); },
  initials(name){ return (name||'U').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase(); },
  color(seed){ const cols=['#5b8cff','#a97aff','#39d0d8','#2fd882','#ffc45d','#ff5d73','#ff9d5c']; let h=0; for(const c of String(seed)) h=(h*31+c.charCodeAt(0))>>>0; return cols[h%cols.length]; }
};

/* Sumber data — komponen atribusi wajib untuk semua data eksternal */
function SRC(label, url, fetchedAt){
  const t = fetchedAt ? ' · diambil ' + U.time(fetchedAt) : '';
  const link = url ? `<a href="${U.esc(url)}" target="_blank" rel="noopener">${U.esc(label)}</a>` : U.esc(label);
  return `<div class="hint" style="margin-top:6px">📎 Sumber: ${link}${t}</div>`;
}

const Toast = {
  el: null, timer: null,
  show(msg){ this.el = this.el || document.getElementById('toast');
    this.el.textContent = msg; this.el.classList.add('show');
    clearTimeout(this.timer); this.timer = setTimeout(()=>this.el.classList.remove('show'), 2600); }
};

const Modal = {
  open(html){ document.getElementById('modalBox').innerHTML =
      `<button class="modal-close" onclick="Modal.close()">✕</button>` + html;
    document.getElementById('modalWrap').classList.add('open'); },
  close(){ document.getElementById('modalWrap').classList.remove('open'); }
};

/* Profil & membership helpers */
function getProfile(){ return DB.get('profile', { nama:'', email:'', telp:'', lahir:'', provinsi:'DKI Jakarta', pekerjaan:'', status:'lajang', penghasilan:0, kota:'', bio:'' }); }
function getMembership(){ return DB.get('membership', { plan:'free', since:null, expiry:null, affCode:null }); }
function affCode(){ let m = getMembership();
  if(!m.affCode){ m.affCode = 'GH' + U.uid().toUpperCase().slice(0,6); DB.set('membership', m); }
  return m.affCode; }
function wrapLink(url, channel){
  // Link dibungkus sistem: klik lewat go.html → komisi tercatat utk pengguna + sistem → redirect ke tujuan asli
  return location.origin + location.pathname.replace(/index\.html$/,'') +
    'go.html?u=' + encodeURIComponent(affCode()) + '&c=' + encodeURIComponent(channel||'produk') + '&r=' + encodeURIComponent(url);
}
function logCommission(entry){
  const led = DB.get('ledger', []);
  led.unshift(Object.assign({ id:U.uid(), at:new Date().toISOString(),
    user: (typeof Store !== 'undefined' && Store.me) ? Store.me.username : undefined }, entry));
  DB.set('ledger', led);
}

/* Router */
const App = {
  routes: {},
  register(name, title, renderFn){ this.routes[name] = { title, render: renderFn }; },
  _refreshing: false,
  navigate(){ 
    const hash = location.hash.replace(/^#\//,'') || 'dashboard';
    const name = hash.split('?')[0].split('/')[0];
    const route = this.routes[name] || this.routes['dashboard'];
    document.getElementById('topbarTitle').textContent = route.title;
    document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('active', a.dataset.route===name));
    document.getElementById('sidebar').classList.remove('open');
    const el = document.getElementById('app');
    el.innerHTML = '';
    try{ route.render(el); }catch(e){ el.innerHTML = `<div class="alert bad">Terjadi kesalahan: ${U.esc(e.message)}</div>`; console.error(e); }
    // Strip integrasi otomatis di atas setiap menu
    try{ const bar = IntegrasiUI.render(name); if(bar) el.insertAdjacentHTML('afterbegin', bar); }catch(e){}
    window.scrollTo(0,0);
    // Data bersama (feed, grup, komisi) diambil ulang dari server saat masuk halaman terkait
    if(['social','membership','dashboard'].includes(name) && !this._refreshing){
      this._refreshing = true;
      Store.refreshShared().then(changed=>{
        const cur = (location.hash.replace(/^#\//,'') || 'dashboard').split('?')[0].split('/')[0];
        if(changed && cur === name) this.navigate();
      }).finally(()=>{ this._refreshing = false; });
    }
  },
  refreshChrome(){
    const p = getProfile(), m = getMembership();
    const uname = (typeof Store !== 'undefined' && Store.me) ? Store.me.username : '';
    const av = document.getElementById('avatarChip');
    av.textContent = U.initials(p.nama || uname || 'U');
    av.title = uname ? '@' + uname + ' — buka profil' : 'Profil';
    const active = m.expiry && new Date(m.expiry) > new Date();
    document.getElementById('memberChip').textContent = active ? (m.plan==='elite'?'Elite ⭐':'Pro ✦') : 'Free';
  },
  async init(){
    window.addEventListener('hashchange', ()=>this.navigate());
    document.getElementById('burger').onclick = ()=>document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('modalWrap').onclick = (e)=>{ if(e.target.id==='modalWrap') Modal.close(); };
    document.getElementById('avatarChip').onclick = ()=>location.hash='#/profil';
    setInterval(()=>{ const c=document.getElementById('clock'); if(c) c.textContent = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }, 1000);
    const ok = await Store.init();
    const gate = document.getElementById('authGate');
    if(!ok){
      if(gate) gate.style.display = 'flex';
      if(Store._initError) Toast.show('Server: ' + Store._initError);
      return;
    }
    if(gate) gate.style.display = 'none';
    this.refreshChrome();
    this.navigate();
  }
};

/* ========== IntegrasiUI — strip status integrasi di SETIAP menu ==========
 * Menampilkan provider yang menyuplai modul aktif: status live (jam ambil
 * dari cache), mode autopilot (TTL), tombol uji koneksi, sumber resmi.
 */
const IntegrasiUI = {
  cacheTime(prefix){
    let latest = 0;
    for(const k of Object.keys(localStorage)){
      if(k.startsWith('ghubc_' + prefix)){
        try{ const t = JSON.parse(localStorage.getItem(k)).t; if(t > latest) latest = t; }catch(e){}
      }
    }
    return latest || null;
  },
  PROV: {
    yahoo:    { nama:'Yahoo Finance', ket:'±900 emiten IDX · harga/riwayat/dividen', pre:'y_',  ttl:'autopilot: harga 3 mnt · riwayat 6 jam', test:()=>API.quote('^JKSE') },
    coingecko:{ nama:'CoinGecko', ket:'17rb+ kripto + emas PAXG', pre:'cg', ttl:'autopilot: 3 mnt', test:()=>API.cryptoGold() },
    fx:       { nama:'ExchangeRate-API', ket:'160+ mata uang', pre:'fx', ttl:'autopilot: 30 mnt', test:()=>API.fx() },
    worldbank:{ nama:'World Bank', ket:'1.400+ indikator makro RI', pre:'wb_', ttl:'autopilot: 24 jam', test:()=>API.worldBank('FP.CPI.TOTL.ZG','Inflasi') },
    rss:      { nama:'RSS CNBC/ANTARA', ket:'berita asli tertaut', pre:'rss_', ttl:'autopilot: 15 mnt', test:()=>API.news() },
    ump:      { statis:true, nama:'UMP 2026 — Kemnaker', ket:'PP 49/2025 · berlaku ' + UMP2026.meta.berlaku, url: UMP2026.meta.url },
    bi:       { statis:true, nama:'BI-Rate ' + BI_RATE.rate + '%', ket: BI_RATE.rdg, url: BI_RATE.url },
    bpjs:     { statis:true, nama:'Iuran BPJS Kesehatan', ket:'Perpres 64/2020 (resmi)', url: BPJS.url },
    bps:      { statis:true, nama:'Biaya pendidikan — BPS', ket: 'Statistik Pendidikan + Permendikbud 1/2021', url: JENJANG_SRC.url },
    sbn:      { statis:true, nama:'Kupon SBN Ritel — Kemenkeu', ket:'acuan imbal hasil rendah-risiko', url:'https://www.kemenkeu.go.id/sbnritel' },
    ojkmarket:{ statis:true, nama:'Marketplace asuransi berizin OJK', ket:'cek premi realtime (Lifepal/Qoala/PasarPolis)', url:'https://ojk.go.id/id/kanal/iknb/data-dan-statistik/direktori/asuransi/default.aspx' },
    marketplaces:{ statis:true, nama: MARKETPLACES.length + ' marketplace global', ket:'Shopee·Tokopedia·Lazada·Blibli·Amazon·AliExpress·eBay (jutaan produk)', url:'#' },
    khl:      { statis:true, nama:'KHL — Permenaker 18/2020', ket:'7 kelompok · 64 komponen (terpisah dari UMP)', url: (typeof KHL_PERMENAKER!=='undefined') ? KHL_PERMENAKER.url : '#' },
    slik:     { statis:true, nama:'SLIK OJK (iDebku)', ket:'simulasi Kol 1–5 otomatis + cek iDeb resmi gratis', url:'https://idebku.ojk.go.id' },
    gnews:    { nama:'Google News (agregat)', ket:'himpun berita ribuan media per emiten + pindai risiko', pre:'rss_https://news.google', ttl:'autopilot: 15 mnt per kueri', test:()=>API.gnews('IHSG saham') },
    blacklist:{ statis:true, nama:'Registri Entitas Bermasalah', ket:(typeof ENTITAS_BERMASALAH!=='undefined'?ENTITAS_BERMASALAH.length:0) + ' entitas lintas-emiten → auto-EXCLUDE', url:'https://news.google.com/search?q=jiwasraya%20asabri%20terpidana&hl=id' },
    blockchain:{ nama:'Blockchain publik', ket:'saldo on-chain: BTC (Blockstream) · ETH (Cloudflare RPC)', pre:'bc_', ttl:'autopilot: 5 mnt', test:()=>API.btcBalance('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa') },
    ai:{ custom:true }
  },
  chip(id){
    const P = this.PROV[id];
    if(id === 'db'){
      const on = typeof Store !== 'undefined' && Store.me;
      return `<span class="int-chip ${on?'on':''}" title="Semua data modul ini tersimpan di database SQLite server per akun">
        ${on?'🟢':'⚪'} <b>Database server</b> · ${on ? 'tersinkron @' + U.esc(Store.me.username) : 'belum login'} · autopilot sync 350ms</span>`;
    }
    if(id === 'affiliate'){
      const st = (typeof Store !== 'undefined' && Store.get('settings', {})) || {};
      const nNet = ((st.affiliate||{}).networks || []).length;
      return `<span class="int-chip on" title="Klik=statistik Rp0. Komisi hanya dari pembelian terverifikasi via postback S2S jaringan afiliasi.">
        🟢 <b>Mesin afiliasi eksternal</b> · bagi hasil ${Math.round(KOMISI.produkUser*100)}/${100-Math.round(KOMISI.produkUser*100)} · postback S2S aktif${nNet?` · ${nNet} template deeplink`:''}</span>`;
    }
    if(id === 'ai'){
      const hasKey = !!(JSON.parse(localStorage.getItem('ghub_ai_cfg')||'{}').key);
      return `<span class="int-chip on" onclick="AI.open()" title="Analisis heuristik lokal (privasi penuh) + LLM generatif opsional (BYO key)">
        🤖 <b>AI Asisten</b> · heuristik lokal aktif${hasKey?' · LLM tersambung':' · LLM opsional (BYO key)'}</span>`;
    }
    if(id === 'payment'){
      return `<span class="int-chip on" title="Invoice dibuat server → bayar → webhook bertanda tangan → layanan aktif otomatis. Midtrans/Xendit = 25+ metode (QRIS, GoPay, OVO, VA, kartu).">
        💳 <b>Payment gateway</b> · invoice+webhook otomatis · Midtrans/Xendit siap (konfig admin)</span>`;
    }
    if(!P) return '';
    if(P.statis){
      return `<a class="int-chip on" href="${P.url}" target="_blank" rel="noopener" title="Ketetapan/publikasi resmi — tertaut sumbernya">
        📎 <b>${P.nama}</b> · ${P.ket}</a>`;
    }
    const t = this.cacheTime(P.pre);
    return `<span class="int-chip ${t?'on':''}" onclick="IntegrasiUI.test('${id}')" title="${P.ttl}. Klik untuk uji koneksi sekarang.">
      ${t?'🟢':'⚪'} <b>${P.nama}</b> · ${P.ket} · ${t ? 'data ' + U.time(new Date(t).toISOString()) : 'siap — klik utk uji'}</span>`;
  },
  render(route){
    const ids = (typeof MODUL_INTEGRASI !== 'undefined') && MODUL_INTEGRASI[route];
    if(!ids || !ids.length) return '';
    return `<div class="int-bar" id="intBar" data-route="${route}">
      <span class="int-title">🔌 Integrasi modul ini</span>
      ${ids.map(id=>this.chip(id)).join('')}
    </div>`;
  },
  refreshBar(){
    const bar = document.getElementById('intBar');
    if(!bar) return;
    const route = bar.dataset.route;
    bar.outerHTML = this.render(route);
  },
  async test(id){
    const P = this.PROV[id];
    if(!P || !P.test) return;
    Toast.show('Menguji ' + P.nama + '…');
    try{
      await P.test();
      Toast.show('✔ ' + P.nama + ' terhubung — data asli diterima');
    }catch(e){
      Toast.show('✕ ' + P.nama + ' gagal: ' + e.message);
    }
    this.refreshBar();
  }
};
