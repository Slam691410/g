/* ========== GHub One — Panel Admin Sistem (terhubung database server) ========== */
const Admin = {
  routes: {},

  /* ---------- Auth: akun role 'admin' di database server ---------- */
  isAuthed(){ return !!(Store.me && Store.me.role === 'admin'); },
  async login(){
    const u = document.getElementById('admUser').value.trim();
    const p = document.getElementById('admPass').value;
    try{
      const user = await Store.login(u, p);
      if(user.role !== 'admin'){
        Store.token = null; Store.me = null; localStorage.removeItem('ghub_token');
        return Toast.show('Akun ini bukan admin — gunakan akun role admin');
      }
      await Store.init();
      this.show(); Toast.show('Selamat datang, Admin 🛡');
    }catch(e){ Toast.show(e.message); }
  },
  logout(){ Store.logout(); },

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
    // segarkan data bersama dari database utk halaman moderasi/keuangan
    if(['overview','konten','keuangan'].includes(name) && !this._refreshing){
      this._refreshing = true;
      Store.refreshShared().then(ch=>{
        const cur = (location.hash.replace(/^#\//,'') || 'overview').split('?')[0];
        if(ch && cur === name) this.navigate();
      }).finally(()=>{ this._refreshing = false; });
    }
  },
  async init(){
    window.addEventListener('hashchange', ()=>{ if(this.isAuthed()) this.navigate(); });
    document.getElementById('burger').onclick = ()=>document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('modalWrap').onclick = (e)=>{ if(e.target.id==='modalWrap') Modal.close(); };
    setInterval(()=>{ const c=document.getElementById('clock'); if(c) c.textContent = new Date().toLocaleTimeString('id-ID'); }, 1000);
    await Store.init();
    if(Store.me && Store.me.role !== 'admin'){
      // login sebagai user biasa → jangan pakai sesi ini di panel admin
      Store.token = null; Store.me = null;
    }
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
  const led = Admin.ledger();
  const rev = Admin.revenue();
  el.innerHTML = `
    <div class="alert info mb">Terhubung ke <b>database server (SQLite)</b> — angka di bawah adalah agregat <b>seluruh pengguna</b> platform.</div>
    <div class="grid g4 mb" id="admStats">
      ${['Pengguna terdaftar','Member berbayar aktif','Konten / Grup','Klik afiliasi (server)'].map(t=>`<div class="stat"><div class="lbl">${t}</div><div class="val">…</div><div class="d sub">memuat…</div></div>`).join('')}
    </div>
    <div class="grid g4 mb">
      <div class="stat"><div class="lbl">💰 Pendapatan Membership</div><div class="val up">${U.rp(rev.membership)}</div></div>
      <div class="stat"><div class="lbl">💰 Fee Sistem — Grup (${KOMISI.grupSistem*100}%)</div><div class="val up">${U.rp(rev.grup)}</div></div>
      <div class="stat"><div class="lbl">💰 Fee Sistem — Produk (${KOMISI.produkSistem*100}%)</div><div class="val up">${U.rp(rev.produk)}</div></div>
      <div class="stat"><div class="lbl">Total Pendapatan Sistem</div><div class="val" style="color:var(--yel)">${U.rp(rev.total)}</div><div class="d sub">setelah komisi referral ${U.rp(rev.referralPaid)}</div></div>
    </div>
    <div class="grid g2">
      <div class="card">
        <h3>🕒 Aktivitas terakhir (semua pengguna)</h3>
        ${led.length ? led.slice(0,8).map(l=>`
          <div class="row between" style="padding:7px 0;border-bottom:1px solid rgba(35,46,78,.6)">
            <span><span class="badge ${l.tipe==='klik-afiliasi'?'b-cyn':l.tipe==='membership'?'b-pur':l.tipe==='fee-sistem'?'b-yel':'b-grn'}">${l.tipe}</span>
            ${l.user?`<span class="hint">@${U.esc(l.user)}</span>`:''}
            <span class="hint"> ${U.esc((l.detail||l.kanal||l.url||'').slice(0,44))}</span></span>
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
        <h3>🗄 Infrastruktur</h3>
        <div class="hint" style="line-height:1.9" id="admInfra">
          Server: <b>Node.js ${''} (server.js)</b> · Database: <b>SQLite (data/ghub.sqlite)</b><br>
          Auth: sesi token + scrypt hash · API: REST /api/*
        </div>
      </div>
    </div>`;
  (async ()=>{
    try{
      const s = await Store.api('/api/admin/stats');
      const boxes = document.getElementById('admStats'); if(!boxes) return;
      const set = (i,lbl,val,sub)=>{ boxes.children[i].innerHTML = `<div class="lbl">${lbl}</div><div class="val">${val}</div><div class="d sub">${sub}</div>`; };
      set(0,'Pengguna terdaftar', s.totalUser, s.sesiAktif + ' sesi login aktif');
      set(1,'Member berbayar aktif', s.memberAktif, 'dari ' + s.totalUser + ' pengguna');
      set(2,'Konten / Grup', s.posts + ' / ' + s.groups, 'koleksi bersama');
      set(3,'Klik afiliasi (server)', s.klik, 'tercatat di tabel clicks');
    }catch(e){ Toast.show('Gagal memuat statistik: ' + e.message); }
  })();
});

/* ================= PENGGUNA & MEMBER ================= */
Admin.register('users', 'Pengguna & Member', function(el){
  el.innerHTML = `<div class="card"><h3>👥 Semua Pengguna (database server)</h3><div id="admUsers">${loadingBox('Memuat daftar pengguna dari database…')}</div></div>`;
  (async ()=>{
    try{
      const d = await Store.api('/api/admin/users');
      const box = document.getElementById('admUsers'); if(!box) return;
      box.innerHTML = `<div style="overflow-x:auto"><table>
        <tr><th>ID</th><th>Akun</th><th>Nama</th><th>Role</th><th>Plan</th><th>Masa aktif</th><th>Kode aff</th><th>Data</th><th>Kelola membership</th><th></th></tr>
        ${d.users.map(u=>{
          const mem = u.membership || { plan:'free' };
          const active = mem.expiry && new Date(mem.expiry) > new Date();
          return `<tr>
            <td class="hint">#${u.id}</td>
            <td><b>@${U.esc(u.username)}</b><div class="hint">${U.dt(u.created_at)}</div></td>
            <td>${U.esc(u.nama || (u.profile&&u.profile.nama) || '—')}</td>
            <td>${u.role==='admin'?'<span class="badge b-red">admin</span>':'<span class="badge b-mut">user</span>'}</td>
            <td><span class="badge ${active?(mem.plan==='elite'?'b-pur':'b-pri'):'b-mut'}">${active?mem.plan:'free'}</span></td>
            <td>${mem.expiry?U.dt(mem.expiry):'—'} ${active?'<span class="badge b-grn">aktif</span>':''}</td>
            <td class="hint">${mem.affCode||'—'}</td>
            <td class="hint">${u.counts.tasks} tugas · ${u.counts.txs} trx · ${u.counts.goals} goal</td>
            <td>${u.role==='admin' ? '<span class="hint">—</span>' : `
              <div class="row" style="gap:4px">
                <select id="uPlan_${u.id}" style="width:90px;padding:5px 8px">
                  ${PLANS.map(p=>`<option value="${p.id}" ${mem.plan===p.id?'selected':''}>${p.nama}</option>`).join('')}
                </select>
                <input id="uBulan_${u.id}" type="number" value="1" min="0" style="width:56px;padding:5px 8px" title="bulan">
                <button class="btn sm" onclick="Admin.applyMember(${u.id})">💾</button>
              </div>`}</td>
            <td>${u.role==='admin' ? '' : `<button class="btn red sm" title="Hapus akun & seluruh datanya" onclick="Admin.deleteUser(${u.id},'${U.esc(u.username)}')">🗑</button>`}</td>
          </tr>`; }).join('')}
      </table></div>
      <div class="hint mt">💾 = terapkan plan + masa aktif (bulan dari sekarang; 0 = nonaktifkan). Perubahan admin tidak membuat entri pembayaran.</div>`;
    }catch(e){ const box = document.getElementById('admUsers'); if(box) box.innerHTML = errorBox(e.message); }
  })();
});
Admin.applyMember = async (uid)=>{
  const plan = document.getElementById('uPlan_'+uid).value;
  const bulan = Number(document.getElementById('uBulan_'+uid).value)||0;
  try{
    await Store.api('/api/admin/user/'+uid+'/membership', { method:'PUT', body:{ plan, bulan } });
    Toast.show('Membership diperbarui ✔'); Admin.navigate();
  }catch(e){ Toast.show(e.message); }
};
Admin.deleteUser = async (uid, uname)=>{
  if(!confirm(`Hapus akun @${uname} beserta SELURUH datanya dari database?`)) return;
  try{
    await Store.api('/api/admin/user/'+uid, { method:'DELETE' });
    Toast.show('Akun dihapus'); Admin.navigate();
  }catch(e){ Toast.show(e.message); }
};

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
  el.innerHTML = `
    <div class="grid g2">
      <div class="card">
        <h3>💸 Tarif Komisi Platform</h3>
        <div class="hint">Tersimpan di database server (koleksi <b>settings</b>) — berlaku untuk semua pengguna & transaksi baru.</div>
        <label class="fl">Komisi produk — porsi pengguna/kreator (%)</label><input id="kProdUser" type="number" step="any" value="${k.produkUser*100}">
        <label class="fl">Komisi produk — porsi sistem (%)</label><input id="kProdSis" type="number" step="any" value="${k.produkSistem*100}">
        <label class="fl">Fee sistem langganan grup (%)</label><input id="kGrup" type="number" step="any" value="${k.grupSistem*100}">
        <label class="fl">Komisi referral membership (%)</label><input id="kRef" type="number" step="any" value="${k.membershipRef*100}">
        <button class="btn mt" onclick="Admin.saveKomisi()">💾 Simpan tarif ke server</button>
      </div>
      <div class="card">
        <h3>⭐ Harga Paket Membership</h3>
        ${PLANS.filter(p=>p.id!=='free').map(p=>`
          <label class="fl">${p.nama} (Rp/bulan)</label><input id="plan_${p.id}" type="number" value="${p.harga}">`).join('')}
        <button class="btn mt" onclick="Admin.savePlans()">💾 Simpan harga ke server</button>
        <div class="divider"></div>
        <h3>🔐 Password Admin</h3>
        <div class="hint">Akun: <b>@${Store.me?Store.me.username:'admin'}</b> (database server, hash scrypt)</div>
        <label class="fl">Password baru</label><input id="admNewPass" type="password" placeholder="min. 6 karakter">
        <button class="btn mt" onclick="Admin.savePass()">🔑 Ganti password</button>
      </div>
    </div>
    <div class="card mt">
      <h3>⚠️ Zona Berbahaya</h3>
      <div class="row wrap mt">
        <button class="btn red sm" onclick="if(confirm('Kosongkan SEMUA konten, grup, dan buku besar platform (semua pengguna)?')){DB.set('posts',[]);DB.set('groups',[]);DB.set('ledger',[]);Toast.show('Data platform bersama dikosongkan');setTimeout(()=>Admin.navigate(),600);}">🗑 Kosongkan konten & buku besar platform</button>
      </div>
      <div class="hint mt">Akun pengguna & data pribadinya dihapus satu per satu lewat menu Pengguna & Member.</div>
    </div>`;
});
Admin.saveKomisi = ()=>{
  const v = id => Math.max(0, Number(document.getElementById(id).value)||0)/100;
  const o = { produkUser: v('kProdUser'), produkSistem: v('kProdSis'), grupSistem: v('kGrup'), membershipRef: v('kRef') };
  const s = Store.get('settings', {}) || {};
  s.komisi = o;
  Store.set('settings', s);
  Object.assign(KOMISI, o);
  Toast.show('Tarif komisi tersimpan ke server ✔'); Admin.navigate();
};
Admin.savePlans = ()=>{
  const o = {};
  PLANS.forEach(p=>{ const el = document.getElementById('plan_'+p.id); if(el){ o[p.id] = Math.max(0, Number(el.value)||0); p.harga = o[p.id]; } });
  const s = Store.get('settings', {}) || {};
  s.plans = o;
  Store.set('settings', s);
  Toast.show('Harga paket tersimpan ke server ✔'); Admin.navigate();
};
Admin.savePass = async ()=>{
  const pass = document.getElementById('admNewPass').value;
  if(pass.length < 6) return Toast.show('Password minimal 6 karakter');
  try{
    await Store.api('/api/admin/password', { method:'PUT', body:{ password: pass } });
    Toast.show('Password admin diganti 🔑');
  }catch(e){ Toast.show(e.message); }
};
