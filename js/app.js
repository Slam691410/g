/* ========== GHub One — Core App: router, store, utils ========== */
const DB = {
  k(key){ return 'ghub_' + key; },
  get(key, def){ try{ const v = localStorage.getItem(this.k(key)); return v===null ? def : JSON.parse(v); }catch(e){ return def; } },
  set(key, val){ localStorage.setItem(this.k(key), JSON.stringify(val)); },
  del(key){ localStorage.removeItem(this.k(key)); }
};

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
  led.unshift(Object.assign({ id:U.uid(), at:new Date().toISOString() }, entry));
  DB.set('ledger', led);
}

/* Router */
const App = {
  routes: {},
  register(name, title, renderFn){ this.routes[name] = { title, render: renderFn }; },
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
    window.scrollTo(0,0);
  },
  refreshChrome(){
    const p = getProfile(), m = getMembership();
    document.getElementById('avatarChip').textContent = U.initials(p.nama || 'U');
    const active = m.expiry && new Date(m.expiry) > new Date();
    document.getElementById('memberChip').textContent = active ? (m.plan==='elite'?'Elite ⭐':'Pro ✦') : 'Free';
  },
  init(){
    window.addEventListener('hashchange', ()=>this.navigate());
    document.getElementById('burger').onclick = ()=>document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('modalWrap').onclick = (e)=>{ if(e.target.id==='modalWrap') Modal.close(); };
    document.getElementById('avatarChip').onclick = ()=>location.hash='#/profil';
    setInterval(()=>{ const c=document.getElementById('clock'); if(c) c.textContent = new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }, 1000);
    this.refreshChrome();
    this.navigate();
  }
};
