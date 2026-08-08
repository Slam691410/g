/* ========== GHub One — Panel Admin Sistem ========== */
const Admin = {
  routes: {},

  /* ---------- Auth ---------- */
  creds(){ return DB.get('admin', { user: 'admin', pass: 'admin123' }); },
  isAuthed(){ return sessionStorage.getItem('ghub_admin_session') === '1'; },
  login(){
    const u = document.getElementById('admUser').value.trim();
    const p = document.getElementById('admPass').value;
    const c = this.creds();
    if(u === c.user && p === c.pass){
      sessionStorage.setItem('ghub_admin_session', '1');
      this.show(); Toast.show('Selamat datang, Admin 🛡');
    } else Toast.show('Username / password salah');
  },
  logout(){ sessionStorage.removeItem('ghub_admin_session'); location.reload(); },

  show(){
    document.getElementById('loginGate').style.display = this.isAuthed() ? 'none' : 'flex';
    document.getElementById('adminLayout').style.display = this.isAuthed() ? 'flex' : 'none';
    if(this.isAuthed()) this.navigate();
  },

  register(name, title, fn){ this.routes[name] = { title, render: fn }; },
  navigate(){
    const name = (location.hash.replace(/^#\//,'') || 'overview').split('?')[0];
    const route = this.routes[name] || this.routes['overview'];
    document.getElementById('topbarTitle').textContent = route.title;
    document.querySelectorAll('#adminLayout .nav a').forEach(a=>a.classList.toggle('active', a.dataset.route===name));
    document.getElementById('sidebar').classList.remove('open');
    const el = document.getElementById('app'); el.innerHTML = '';
    try{ route.render(el); }catch(e){ el.innerHTML = `<div class="alert bad">Error: ${U.esc(e.message)}</div>`; console.error(e); }
    window.scrollTo(0,0);
  },
  init(){
    window.addEventListener('hashchange', ()=>{ if(this.isAuthed()) this.navigate(); });
    document.getElementById('burger').onclick = ()=>document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('modalWrap').onclick = (e)=>{ if(e.target.id==='modalWrap') Modal.close(); };
    setInterval(()=>{ const c=document.getElementById('clock'); if(c) c.textContent = new Date().toLocaleTimeString('id-ID'); }, 1000);
    this.show();
  },

  /* ---------- Helper agregasi ---------- */
  ledger(){ return DB.get('ledger', []); },
  revenue(){
    const led = this.ledger();
    const membership = led.filter(l=>l.tipe==='membership').reduce((s,l)=>s+Math.abs(l.jumlah||0), 0);
    const feeExplicit = k => led.filter(l=>l.tipe==='fee-sistem' && l.kanalTipe===k).reduce((s,l)=>s+(l.jumlah||0), 0);
    // legacy: entri lama tanpa fee-sistem → estimasi dari entri kreator
    const legacyGrup = led.filter(l=>l.tipe==='langganan-grup' && !l.pairId)
      .reduce((s,l)=>s + Math.round((l.jumlah||0) / (1-KOMISI.grupSistem) * KOMISI.grupSistem), 0);
    const legacyProduk = led.filter(l=>l.tipe==='komisi-produk' && !l.pairId)
      .reduce((s,l)=>s + Math.round((l.jumlah||0) / KOMISI.produkUser * KOMISI.produkSistem), 0);
    const grup = feeExplicit('grup') + legacyGrup;
    const produk = feeExplicit('produk') + legacyProduk;
    const referralPaid = led.filter(l=>l.tipe==='referral-membership').reduce((s,l)=>s+(l.jumlah||0), 0);
    return { membership, grup, produk, referralPaid, total: membership + grup + produk - referralPaid };
  }
};

/* ================= RINGKASAN ================= */
Admin.register('overview', 'Ringkasan Sistem', function(el){
  const posts = DB.get('posts', []), groups = DB.get('groups', []), tasks = DB.get('tasks', []);
  const led = Admin.ledger();
  const m = DB.get('membership', { plan:'free' });
  const p = DB.get('profile', {});
  const rev = Admin.revenue();
  const klik = led.filter(l=>l.tipe==='klik-afiliasi').length;
  const subsAktif = groups.reduce((s,g)=>s+(g.subs||[]).filter(x=>new Date(x.until)>new Date()).length, 0);
  const memberAktif = m.expiry && new Date(m.expiry)>new Date() ? 1 : 0;

  el.innerHTML = `
    <div class="alert info mb">Panel ini mengelola data platform yang tersimpan di perangkat ini (mode demo lokal, tanpa server). Saat backend multi-user dipasang, angka di bawah otomatis menjadi agregat seluruh pengguna.</div>
    <div class="grid g4 mb">
      <div class="stat"><div class="lbl">Pengguna terdaftar</div><div class="val">${p.nama?1:0}</div><div class="d sub">${U.esc(p.nama||'belum ada profil')}</div></div>
      <div class="stat"><div class="lbl">Member berbayar aktif</div><div class="val ${memberAktif?'up':''}">${memberAktif}</div><div class="d sub">plan: ${U.esc(m.plan||'free')}${m.expiry?' s.d. '+U.dt(m.expiry):''}</div></div>
      <div class="stat"><div class="lbl">Konten / Grup</div><div class="val">${posts.length} / ${groups.length}</div><div class="d sub">${subsAktif} langganan grup aktif</div></div>
      <div class="stat"><div class="lbl">Klik link afiliasi</div><div class="val">${klik}</div><div class="d sub">via pembungkus go.html</div></div>
    </div>
    <div class="grid g4 mb">
      <div class="stat"><div class="lbl">💰 Pendapatan Membership</div><div class="val up">${U.rp(rev.membership)}</div></div>
      <div class="stat"><div class="lbl">💰 Fee Sistem — Grup (${KOMISI.grupSistem*100}%)</div><div class="val up">${U.rp(rev.grup)}</div></div>
      <div class="stat"><div class="lbl">💰 Fee Sistem — Produk (${KOMISI.produkSistem*100}%)</div><div class="val up">${U.rp(rev.produk)}</div></div>
      <div class="stat"><div class="lbl">Total Pendapatan Sistem</div><div class="val" style="color:var(--yel)">${U.rp(rev.total)}</div><div class="d sub">setelah komisi referral ${U.rp(rev.referralPaid)}</div></div>
    </div>
    <div class="grid g2">
      <div class="card">
        <h3>🕒 Aktivitas terakhir</h3>
        ${led.length ? led.slice(0,8).map(l=>`
          <div class="row between" style="padding:7px 0;border-bottom:1px solid rgba(35,46,78,.6)">
            <span><span class="badge ${l.tipe==='klik-afiliasi'?'b-cyn':l.tipe==='membership'?'b-pur':l.tipe==='fee-sistem'?'b-yel':'b-grn'}">${l.tipe}</span>
            <span class="hint"> ${U.esc((l.detail||l.kanal||l.url||'').slice(0,50))}</span></span>
            <span class="hint">${U.ago(l.at)}</span>
          </div>`).join('') : '<div class="empty">Belum ada aktivitas.</div>'}
      </div>
      <div class="card">
        <h3>⚡ Aksi cepat</h3>
        <div class="grid g2">
          <button class="btn ghost" onclick="location.hash='#/users'">👥 Kelola member</button>
          <button class="btn ghost" onclick="location.hash='#/konten'">🧹 Moderasi konten</button>
          <button class="btn ghost" onclick="location.hash='#/keuangan'">💹 Buku besar</button>
          <button class="btn ghost" onclick="location.hash='#/sumber'">📡 Cek sumber data</button>
        </div>
        <div class="divider"></div>
        <h3>📦 Statistik modul lain</h3>
        <div class="hint" style="line-height:1.9">
          Tugas proyek: <b>${tasks.length}</b> · Transaksi income: <b>${DB.get('txs',[]).length}</b> · Aset: <b>${DB.get('holdings',[]).length}</b><br>
          Hutang-piutang: <b>${DB.get('utang',[]).length}</b> · Polis: <b>${DB.get('polis',[]).length}</b> · Tujuan investasi: <b>${DB.get('goals',[]).length}</b>
        </div>
      </div>
    </div>`;
});

/* ================= PENGGUNA & MEMBER ================= */
Admin.register('users', 'Pengguna & Member', function(el){
  const p = DB.get('profile', {});
  const m = DB.get('membership', { plan:'free' });
  const active = m.expiry && new Date(m.expiry) > new Date();
  const groups = DB.get('groups', []);
  const posts = DB.get('posts', []);
  el.innerHTML = `
    <div class="card mb" style="overflow-x:auto">
      <h3>👥 Daftar Pengguna (perangkat ini)</h3>
      <table>
        <tr><th>Pengguna</th><th>Email / HP</th><th>Provinsi</th><th>Plan</th><th>Masa aktif</th><th>Kode afiliasi</th><th>Konten</th><th>Aksi</th></tr>
        <tr>
          <td><b>${U.esc(p.nama||'(belum isi profil)')}</b><div class="hint">${U.esc(p.pekerjaan||'')}</div></td>
          <td>${U.esc(p.email||'—')}<div class="hint">${U.esc(p.telp||'')}</div></td>
          <td>${U.esc(p.provinsi||'—')}</td>
          <td><span class="badge ${active?(m.plan==='elite'?'b-pur':'b-pri'):'b-mut'}">${active?m.plan:'free'}</span></td>
          <td>${m.expiry?U.dt(m.expiry):'—'} ${active?'<span class="badge b-grn">aktif</span>':''}</td>
          <td class="mono" style="padding:4px 8px">${m.affCode||'—'}</td>
          <td>${posts.length} post · ${groups.length} grup</td>
          <td class="row" style="gap:4px">
            <button class="btn ghost sm" onclick="Admin.editMember()">✏️ Plan</button>
            <button class="btn ghost sm" onclick="Admin.resetAff()">↻ Kode</button>
          </td>
        </tr>
      </table>
    </div>
    <div class="grid g2">
      <div class="card">
        <h3>✏️ Kelola Membership Pengguna</h3>
        <label class="fl">Plan</label>
        <select id="admPlan">${PLANS.map(x=>`<option value="${x.id}" ${m.plan===x.id?'selected':''}>${x.nama} — ${x.harga?U.rp(x.harga)+'/bln':'gratis'}</option>`).join('')}</select>
        <label class="fl">Perpanjang / set masa aktif (bulan dari sekarang)</label>
        <input id="admBulan" type="number" value="1" min="0">
        <div class="row mt">
          <button class="btn sm" onclick="Admin.applyMember()">💾 Terapkan</button>
          <button class="btn red sm" onclick="Admin.revokeMember()">⛔ Cabut membership</button>
        </div>
        <div class="hint mt">Perubahan admin tidak membuat entri pembayaran di buku besar (gratis/komp).</div>
      </div>
      <div class="card">
        <h3>🧾 Ringkasan komisi pengguna ini</h3>
        ${(()=>{ const led = Admin.ledger();
          const s = t => led.filter(l=>l.tipe===t).reduce((a,l)=>a+(l.jumlah||0),0);
          return `<div class="row between mts"><span class="sub">Referral membership</span><b class="up">${U.rp(s('referral-membership'))}</b></div>
          <div class="row between mts"><span class="sub">Komisi produk konten</span><b class="up">${U.rp(s('komisi-produk'))}</b></div>
          <div class="row between mts"><span class="sub">Komisi langganan grup</span><b class="up">${U.rp(s('langganan-grup'))}</b></div>`; })()}
        <div class="divider"></div>
        <button class="btn ghost sm" onclick="if(confirm('Hapus seluruh riwayat komisi pengguna?')){DB.set('ledger',[]);Admin.navigate();}">🗑 Kosongkan riwayat komisi</button>
      </div>
    </div>`;
});
Admin.editMember = ()=>{ location.hash='#/users'; Toast.show('Gunakan panel "Kelola Membership" di bawah'); };
Admin.applyMember = ()=>{
  const m = DB.get('membership', {});
  m.plan = document.getElementById('admPlan').value;
  const bln = Number(document.getElementById('admBulan').value)||0;
  if(m.plan==='free' || bln===0){ if(m.plan!=='free'){ const e=new Date(); e.setMonth(e.getMonth()+bln); m.expiry=e.toISOString(); } else m.expiry=null; }
  else { const e=new Date(); e.setMonth(e.getMonth()+bln); m.expiry=e.toISOString(); m.since=m.since||new Date().toISOString(); }
  DB.set('membership', m); Toast.show('Membership diperbarui ✔'); Admin.navigate();
};
Admin.revokeMember = ()=>{ const m=DB.get('membership',{}); m.plan='free'; m.expiry=null; DB.set('membership',m); Toast.show('Membership dicabut'); Admin.navigate(); };
Admin.resetAff = ()=>{ const m=DB.get('membership',{}); m.affCode='GH'+U.uid().toUpperCase().slice(0,6); DB.set('membership',m); Toast.show('Kode afiliasi di-reset: '+m.affCode); Admin.navigate(); };

/* ================= MODERASI KONTEN ================= */
Admin.register('konten', 'Moderasi Konten', function(el){
  const posts = DB.get('posts', []);
  const groups = DB.get('groups', []);
  el.innerHTML = `
    <div class="card mb" style="overflow-x:auto">
      <h3>📝 Semua Konten (${posts.length})</h3>
      ${posts.length ? `<table>
        <tr><th>Waktu</th><th>Penulis</th><th>Konten</th><th>Grup</th><th>Keranjang</th><th>👍</th><th>Aksi</th></tr>
        ${posts.map(p=>{
          const g = groups.find(x=>x.id===p.group);
          return `<tr>
            <td class="hint">${U.dtm(p.at)}</td>
            <td><b>${U.esc(p.author)}</b></td>
            <td style="max-width:280px">${U.esc((p.text||'').slice(0,90))}${(p.text||'').length>90?'…':''}${p.img?' 🖼':''}</td>
            <td>${g?U.esc(g.nama):'<span class="hint">feed publik</span>'}</td>
            <td>${(p.cart||[]).length?`<span class="badge b-yel">🛒 ${p.cart.length} produk</span>`:'—'}</td>
            <td>${p.likes||0}</td>
            <td class="row" style="gap:4px">
              ${(p.cart||[]).length?`<button class="btn ghost sm" title="Lihat produk" onclick="Admin.viewCart('${p.id}')">🛒</button>`:''}
              <button class="btn red sm" onclick="if(confirm('Hapus konten ini?')){DB.set('posts',DB.get('posts',[]).filter(x=>x.id!=='${p.id}'));Admin.navigate();}">🗑</button>
            </td></tr>`; }).join('')}
      </table>` : '<div class="empty">Belum ada konten.</div>'}
    </div>
    <div class="card" style="overflow-x:auto">
      <h3>👥 Semua Grup (${groups.length})</h3>
      ${groups.length ? `<table>
        <tr><th>Grup</th><th>Pemilik</th><th>Tipe</th><th class="num">Harga/bln</th><th>Anggota</th><th>Langganan aktif</th><th class="num">Omzet grup</th><th>Aksi</th></tr>
        ${groups.map(g=>{
          const subsAktif = (g.subs||[]).filter(s=>new Date(s.until)>new Date()).length;
          const omzet = (g.subs||[]).reduce((s,x)=>s+(x.harga||0),0);
          return `<tr>
            <td><b>${U.esc(g.nama)}</b><div class="hint">${U.esc((g.desc||'').slice(0,50))}</div></td>
            <td>${U.esc(g.owner)}</td>
            <td>${g.tipe==='langganan'?'<span class="badge b-pur">🔒 langganan</span>':'<span class="badge b-grn">gratis</span>'}</td>
            <td class="num">${g.harga?U.rp(g.harga):'—'}</td>
            <td>${(g.members||[]).length}</td><td>${subsAktif}</td>
            <td class="num">${U.rp(omzet)} <span class="hint">(fee sistem ${U.rp(Math.round(omzet*KOMISI.grupSistem))})</span></td>
            <td><button class="btn red sm" onclick="if(confirm('Hapus grup beserta kontennya?')){DB.set('groups',DB.get('groups',[]).filter(x=>x.id!=='${g.id}'));DB.set('posts',DB.get('posts',[]).filter(x=>x.group!=='${g.id}'));Admin.navigate();}">🗑</button></td>
          </tr>`; }).join('')}
      </table>` : '<div class="empty">Belum ada grup.</div>'}
    </div>`;
});
Admin.viewCart = (postId)=>{
  const p = DB.get('posts', []).find(x=>x.id===postId); if(!p) return;
  Modal.open(`<h3>🛒 Keranjang pada konten</h3>
    ${(p.cart||[]).map(c=>`<div class="cart-item"><div><b>${U.esc(c.nama)}</b>${c.harga?` · ${U.rp(c.harga)}`:''}<div class="hint mono" style="padding:4px 6px">${U.esc(c.url)}</div></div>
      <button class="btn red sm" onclick="(function(){const ps=DB.get('posts',[]);const pp=ps.find(x=>x.id==='${postId}');pp.cart=pp.cart.filter(x=>x.id!=='${c.id}');DB.set('posts',ps);Modal.close();Admin.navigate();})()">✕</button></div>`).join('')}
    <div class="hint mt">Admin dapat mencabut produk yang melanggar (barang ilegal, penipuan, dsb).</div>`);
};

/* ================= KEUANGAN & KOMISI ================= */
Admin.register('keuangan', 'Keuangan & Komisi Sistem', function(el){
  const led = Admin.ledger();
  const rev = Admin.revenue();
  el.innerHTML = `
    <div class="grid g4 mb">
      <div class="stat"><div class="lbl">Pendapatan Membership</div><div class="val up">${U.rp(rev.membership)}</div></div>
      <div class="stat"><div class="lbl">Fee Grup (${KOMISI.grupSistem*100}%)</div><div class="val up">${U.rp(rev.grup)}</div></div>
      <div class="stat"><div class="lbl">Fee Produk (${KOMISI.produkSistem*100}%)</div><div class="val up">${U.rp(rev.produk)}</div></div>
      <div class="stat"><div class="lbl">Komisi referral dibayar</div><div class="val down">−${U.rp(rev.referralPaid)}</div></div>
    </div>
    <div class="alert ok mb"><b>Pendapatan bersih sistem: ${U.rp(rev.total)}</b> — membership + fee grup + fee produk − komisi referral.</div>
    <div class="card" style="overflow-x:auto">
      <div class="row between mb wrap">
        <h3 style="margin:0">📜 Buku Besar (${led.length} entri)</h3>
        <div class="row">
          <button class="btn ghost sm" onclick="Admin.exportCSV()">⬇ Ekspor CSV</button>
          <button class="btn red sm" onclick="if(confirm('Kosongkan seluruh buku besar?')){DB.set('ledger',[]);Admin.navigate();}">🗑 Kosongkan</button>
        </div>
      </div>
      ${led.length ? `<table>
        <tr><th>Waktu</th><th>Tipe</th><th>Kanal</th><th>Kode</th><th>Detail</th><th class="num">Jumlah</th><th>Status</th><th></th></tr>
        ${led.slice(0,100).map(l=>`<tr>
          <td class="hint">${U.dtm(l.at)}</td>
          <td><span class="badge ${l.tipe==='klik-afiliasi'?'b-cyn':l.tipe==='membership'?'b-pur':l.tipe==='fee-sistem'?'b-yel':l.tipe==='referral-membership'?'b-pri':'b-grn'}">${l.tipe}</span></td>
          <td>${U.esc(l.kanal||'—')}</td><td class="hint">${U.esc(l.kode||'—')}</td>
          <td class="hint" style="max-width:260px">${U.esc((l.detail||l.url||'—').slice(0,80))}</td>
          <td class="num ${(l.jumlah||0)>=0?'up':'down'}">${l.jumlah!=null?U.rp(l.jumlah):'—'}</td>
          <td class="hint">${U.esc(l.status||'')}</td>
          <td><button class="btn ghost sm" onclick="DB.set('ledger',DB.get('ledger',[]).filter(x=>x.id!=='${l.id}'));Admin.navigate()">✕</button></td>
        </tr>`).join('')}
      </table>` : '<div class="empty">Buku besar kosong.</div>'}
    </div>`;
});
Admin.exportCSV = ()=>{
  const led = Admin.ledger();
  const rows = [['waktu','tipe','kanal','kode','detail','jumlah','status','url']]
    .concat(led.map(l=>[l.at,l.tipe,l.kanal||'',l.kode||'',(l.detail||'').replace(/[\n;]/g,' '),l.jumlah!=null?l.jumlah:'',l.status||'',l.url||'']));
  const csv = rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\ufeff'+csv], {type:'text/csv;charset=utf-8'}));
  a.download = 'ghub-ledger.csv'; a.click();
};

/* ================= MONITOR SUMBER DATA ================= */
Admin.register('sumber', 'Monitor Sumber Data', function(el){
  const SOURCES = [
    { id:'yahoo', nama:'Yahoo Finance (saham IDX, IHSG, dividen)', test: ()=>API.quote('^JKSE'), fmt: r=>`IHSG ${U.num(r.price,0)} (${U.num(r.chgPct,2)}%)` },
    { id:'cg', nama:'CoinGecko (kripto & emas PAXG)', test: ()=>API.cryptoGold(), fmt: r=>`BTC $${U.num(r.data.bitcoin.usd,0)} · PAXG $${U.num(r.data['pax-gold'].usd,0)}` },
    { id:'fx', nama:'ExchangeRate-API (kurs valas)', test: ()=>API.fx(), fmt: r=>`USD/IDR ${U.num(r.rates.IDR,0)}` },
    { id:'wb', nama:'World Bank Open Data (makro resmi)', test: ()=>API.worldBank('FP.CPI.TOTL.ZG','Inflasi'), fmt: r=>`Inflasi ${U.num(r.value,2)}% (data ${r.year})` },
    { id:'rss', nama:'RSS Berita (CNBC Indonesia / ANTARA)', test: ()=>API.news(), fmt: r=>`${r.items.length} artikel · ${U.esc(r.source)}` }
  ];
  const cacheKeys = Object.keys(localStorage).filter(k=>k.startsWith('ghubc_'));
  el.innerHTML = `
    <div class="card mb">
      <div class="row between wrap">
        <div><h3 style="margin:0">📡 Kesehatan Sumber Data Realtime</h3>
        <div class="hint mts">Uji langsung setiap sumber dari browser ini — status, latensi, dan contoh data terbaru.</div></div>
        <button class="btn sm" onclick="Admin.testAll()">▶ Uji semua sumber</button>
      </div>
      <div class="mt" style="overflow-x:auto"><table id="srcTable">
        <tr><th>Sumber</th><th>Status</th><th class="num">Latensi</th><th>Contoh data</th></tr>
        ${SOURCES.map(s=>`<tr id="src_${s.id}"><td><b>${s.nama}</b></td><td><span class="badge b-mut">belum diuji</span></td><td class="num">—</td><td class="hint">—</td></tr>`).join('')}
      </table></div>
    </div>
    <div class="grid g2">
      <div class="card">
        <h3>🗄 Cache data (${cacheKeys.length} entri)</h3>
        <div class="hint">Cache ber-TTL menghormati rate-limit sumber (harga 3 mnt, kurs 30 mnt, makro 24 jam, dividen 6 jam). Kosongkan untuk memaksa pengambilan ulang dari sumber asli.</div>
        <button class="btn ghost sm mt" onclick="Object.keys(localStorage).filter(k=>k.startsWith('ghubc_')).forEach(k=>localStorage.removeItem(k));Toast.show('Cache dikosongkan — data akan diambil ulang dari sumber');Admin.navigate()">🧹 Kosongkan semua cache</button>
      </div>
      <div class="card">
        <h3>🧾 Kebijakan atribusi</h3>
        <div class="hint" style="line-height:1.8">
          Semua kartu data di aplikasi pengguna menampilkan <b>sumber + jam pengambilan</b>.<br>
          Data ketetapan (UMP, BI-Rate, iuran BPJS) menautkan dokumen/rilis resminya.<br>
          Jika sumber gagal dimuat, aplikasi menampilkan error jujur — tidak pernah memalsukan angka.
        </div>
      </div>
    </div>`;
  Admin._sources = SOURCES;
});
Admin.testAll = async ()=>{
  for(const s of Admin._sources){
    const row = document.getElementById('src_'+s.id); if(!row) continue;
    row.cells[1].innerHTML = '<span class="badge b-yel">menguji…</span>';
    const t0 = performance.now();
    try{
      const r = await s.test();
      const ms = Math.round(performance.now()-t0);
      row.cells[1].innerHTML = '<span class="badge b-grn">✔ OK</span>';
      row.cells[2].textContent = ms+' ms';
      row.cells[3].innerHTML = s.fmt(r);
    }catch(e){
      row.cells[1].innerHTML = '<span class="badge b-red">✕ gagal</span>';
      row.cells[2].textContent = Math.round(performance.now()-t0)+' ms';
      row.cells[3].innerHTML = '<span class="hint">'+U.esc(e.message)+'</span>';
    }
  }
};

/* ================= PENGATURAN ================= */
Admin.register('setting', 'Pengaturan Sistem', function(el){
  const k = KOMISI;
  const c = Admin.creds();
  el.innerHTML = `
    <div class="grid g2">
      <div class="card">
        <h3>💸 Tarif Komisi Platform</h3>
        <div class="hint">Berlaku untuk transaksi baru di seluruh aplikasi (link terbungkus, grup, referral).</div>
        <label class="fl">Komisi produk — porsi pengguna/kreator (%)</label><input id="kProdUser" type="number" step="any" value="${k.produkUser*100}">
        <label class="fl">Komisi produk — porsi sistem (%)</label><input id="kProdSis" type="number" step="any" value="${k.produkSistem*100}">
        <label class="fl">Fee sistem langganan grup (%)</label><input id="kGrup" type="number" step="any" value="${k.grupSistem*100}">
        <label class="fl">Komisi referral membership (%)</label><input id="kRef" type="number" step="any" value="${k.membershipRef*100}">
        <button class="btn mt" onclick="Admin.saveKomisi()">💾 Simpan tarif</button>
      </div>
      <div class="card">
        <h3>⭐ Harga Paket Membership</h3>
        ${PLANS.filter(p=>p.harga>0 || p.id!=='free').map(p=>`
          <label class="fl">${p.nama} (Rp/bulan)</label><input id="plan_${p.id}" type="number" value="${p.harga}">`).join('')}
        <button class="btn mt" onclick="Admin.savePlans()">💾 Simpan harga</button>
        <div class="divider"></div>
        <h3>🔐 Kredensial Admin</h3>
        <label class="fl">Username</label><input id="admNewUser" value="${U.esc(c.user)}">
        <label class="fl">Password baru</label><input id="admNewPass" type="password" placeholder="min. 6 karakter">
        <button class="btn mt" onclick="Admin.savePass()">🔑 Ganti kredensial</button>
      </div>
    </div>
    <div class="card mt">
      <h3>⚠️ Zona Berbahaya</h3>
      <div class="row wrap mt">
        <button class="btn red sm" onclick="if(confirm('Hapus SEMUA data platform (konten, grup, keuangan, pengguna) di perangkat ini?')){Object.keys(localStorage).filter(x=>x.startsWith('ghub')).forEach(x=>localStorage.removeItem(x));Toast.show('Semua data platform dihapus');setTimeout(()=>location.reload(),800);}">🗑 Reset seluruh data platform</button>
      </div>
    </div>`;
});
Admin.saveKomisi = ()=>{
  const v = id => Math.max(0, Number(document.getElementById(id).value)||0)/100;
  const o = { produkUser: v('kProdUser'), produkSistem: v('kProdSis'), grupSistem: v('kGrup'), membershipRef: v('kRef') };
  localStorage.setItem('ghub_komisi', JSON.stringify(o));
  Object.assign(KOMISI, o);
  Toast.show('Tarif komisi tersimpan ✔'); Admin.navigate();
};
Admin.savePlans = ()=>{
  const o = {};
  PLANS.forEach(p=>{ const el = document.getElementById('plan_'+p.id); if(el){ o[p.id] = Math.max(0, Number(el.value)||0); p.harga = o[p.id]; } });
  localStorage.setItem('ghub_plans', JSON.stringify(o));
  Toast.show('Harga paket tersimpan ✔'); Admin.navigate();
};
Admin.savePass = ()=>{
  const user = document.getElementById('admNewUser').value.trim();
  const pass = document.getElementById('admNewPass').value;
  if(!user) return Toast.show('Username wajib diisi');
  if(pass && pass.length < 6) return Toast.show('Password minimal 6 karakter');
  const c = Admin.creds();
  DB.set('admin', { user, pass: pass || c.pass });
  Toast.show('Kredensial admin diperbarui 🔑');
};
