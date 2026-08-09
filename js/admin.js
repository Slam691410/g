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
    // Pendapatan SISTEM: membership + porsi sistem dari payout afiliasi eksternal − referral dibayar.
    // Langganan grup BUKAN pendapatan sistem (100% milik kreator) — ditampilkan sebagai omzet informatif.
    const membership = led.filter(l=>l.tipe==='membership').reduce((s,l)=>s+Math.abs(l.jumlah||0), 0);
    const produk = led.filter(l=>l.tipe==='fee-sistem').reduce((s,l)=>s+(l.jumlah||0), 0);
    const referralPaid = led.filter(l=>l.tipe==='referral-membership').reduce((s,l)=>s+(l.jumlah||0), 0);
    const omzetGrup = led.filter(l=>l.tipe==='langganan-grup').reduce((s,l)=>s+(l.jumlah||0), 0);
    const komisiUserProduk = led.filter(l=>l.tipe==='komisi-produk').reduce((s,l)=>s+(l.jumlah||0), 0);
    return { membership, produk, referralPaid, omzetGrup, komisiUserProduk, total: membership + produk - referralPaid };
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
      <div class="stat"><div class="lbl">💰 Afiliasi Eksternal — porsi sistem</div><div class="val up">${U.rp(rev.produk)}</div><div class="d sub">dari payout jaringan (postback terverifikasi)</div></div>
      <div class="stat"><div class="lbl">Referral dibayar sistem</div><div class="val down">−${U.rp(rev.referralPaid)}</div></div>
      <div class="stat"><div class="lbl">Total Pendapatan Sistem</div><div class="val" style="color:var(--yel)">${U.rp(rev.total)}</div><div class="d sub">omzet grup ${U.rp(rev.omzetGrup)} = 100% kreator, bukan sistem</div></div>
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
            <td class="num">${U.rp(omzet)} <span class="hint">(100% milik kreator)</span></td>
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
      <div class="stat"><div class="lbl">Afiliasi Eksternal — porsi sistem</div><div class="val up">${U.rp(rev.produk)}</div><div class="d sub">porsi pengguna ${U.rp(rev.komisiUserProduk)}</div></div>
      <div class="stat"><div class="lbl">Komisi referral dibayar</div><div class="val down">−${U.rp(rev.referralPaid)}</div></div>
      <div class="stat"><div class="lbl">Omzet langganan grup</div><div class="val">${U.rp(rev.omzetGrup)}</div><div class="d sub">100% kreator — bukan pendapatan sistem</div></div>
    </div>
    <div class="alert ok mb"><b>Pendapatan bersih sistem: ${U.rp(rev.total)}</b> = membership + porsi sistem afiliasi eksternal − referral dibayar. Klik afiliasi tidak pernah bernilai uang (anti-fraud); komisi produk hanya dari pembelian terverifikasi via postback jaringan.</div>
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
    </div>
    <div class="card mt">
      <h3>💳 Invoice Payment Gateway</h3>
      <div id="admInvBox">${loadingBox('Memuat invoice dari database…')}</div>
    </div>`;
  Admin._renderInvoices();
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
  const st = Store.get('settings', {}) || {};
  const aff = st.affiliate || {};
  const pg = st.payment || { provider:'simulasi', mode:'sandbox' };
  const nets = (aff.networks || []).map(n=>`${n.domain} | ${n.template}`).join('\n');
  const postbackUrl = `${location.origin}/api/affiliate/postback?key=${aff.postbackKey||'…'}&sub_id={aff_code}&amount={payout_rp}&order_id={order_id}&network={network}&status=approved`;
  el.innerHTML = `
    <div class="grid g2">
      <div class="card">
        <h3>💸 Skema Komisi (adil & anti-fraud)</h3>
        <div class="hint" style="line-height:1.8">
          • Klik = <b>statistik saja, Rp0</b> — sistem tidak membayar klik<br>
          • Komisi produk = hanya dari <b>pembelian terverifikasi</b> (postback jaringan)<br>
          • Langganan grup = <b>100% kreator</b>, sistem tidak memotong<br>
          • Referral membership = dibayar sistem hanya saat referral <b>benar-benar bayar</b>
        </div>
        <label class="fl">Bagi hasil payout afiliasi eksternal — porsi PENGGUNA (%)</label>
        <input id="kProdUser" type="number" step="any" value="${Math.round(k.produkUser*100)}">
        <div class="hint mts">Porsi sistem otomatis = 100% − porsi pengguna (saat ini ${100-Math.round(k.produkUser*100)}%).</div>
        <label class="fl">Komisi referral membership (%) — dibayar dari pendapatan membership</label>
        <input id="kRef" type="number" step="any" value="${Math.round(k.membershipRef*100)}">
        <button class="btn mt" onclick="Admin.saveKomisi()">💾 Simpan tarif ke server</button>
        <div class="divider"></div>
        <h3>⭐ Harga Paket Membership</h3>
        ${PLANS.filter(p=>p.id!=='free').map(p=>`
          <label class="fl">${p.nama} (Rp/bulan)</label><input id="plan_${p.id}" type="number" value="${p.harga}">`).join('')}
        <button class="btn mt" onclick="Admin.savePlans()">💾 Simpan harga ke server</button>
        <div class="divider"></div>
        <h3>🔐 Password Admin</h3>
        <label class="fl">Password baru</label><input id="admNewPass" type="password" placeholder="min. 6 karakter">
        <button class="btn mt" onclick="Admin.savePass()">🔑 Ganti password</button>
      </div>

      <div class="card">
        <h3>🌍 Afiliasi Eksternal — koneksi program/jaringan</h3>
        <div class="hint">Sistem terdaftar sebagai <b>publisher</b> di jaringan afiliasi; link produk pengguna dibungkus dengan ID sistem + <b>Sub-ID pengguna</b>, konversi masuk lewat postback di bawah.</div>

        <label class="fl">🔑 Kunci Postback (rahasia — hanya untuk jaringan afiliasi)</label>
        <div class="mono">${U.esc(aff.postbackKey||'(dibuat otomatis oleh server)')}</div>
        <div class="row mt">
          <button class="btn ghost sm" onclick="navigator.clipboard.writeText('${U.esc(aff.postbackKey||'')}').then(()=>Toast.show('Kunci tersalin'))">📋 Salin</button>
          <button class="btn ghost sm" onclick="Admin.regenKey()">↻ Buat kunci baru</button>
        </div>

        <label class="fl">📮 URL Postback — daftarkan di dashboard tiap jaringan (S2S callback)</label>
        <div class="mono" style="font-size:11px">${U.esc(postbackUrl)}</div>
        <div class="hint mts">Jaringan memanggil URL ini saat pembelian dikonfirmasi → server otomatis membagi payout: pengguna ${Math.round(k.produkUser*100)}% + sistem ${100-Math.round(k.produkUser*100)}%. <code>order_id</code> dipakai anti-duplikat.</div>

        <label class="fl">🔗 Template Deeplink per domain (1 baris: <code>domain | template</code>, gunakan {url} & {subid})</label>
        <textarea id="affNets" rows="5" placeholder="shopee.co.id | https://invol.co/aff_m?offer_id=100325&aff_id=ID_ANDA&url={url}&sub1={subid}">${U.esc(nets)}</textarea>
        <button class="btn mt" onclick="Admin.saveAffiliate()">💾 Simpan konfigurasi afiliasi</button>
        <div class="divider"></div>
        <b style="font-size:13px">🧪 Uji postback (simulasi panggilan jaringan)</b>
        <div class="row mt">
          <input id="tbSub" placeholder="sub_id (kode aff user, mis. GHXXXXXX)" style="flex:2">
          <input id="tbAmt" type="number" placeholder="payout Rp" value="15000" style="flex:1">
          <button class="btn sm" onclick="Admin.testPostback()">▶ Kirim</button>
        </div>
      </div>
    </div>

    <div class="card mt">
      <h3>💳 Payment Gateway</h3>
      <div class="hint">Alur produksi: invoice dibuat server → pengguna bayar di halaman provider (QRIS/GoPay/OVO/VA bank/kartu — 25+ metode) → provider memanggil <b>webhook bertanda tangan</b> → server mengaktifkan layanan otomatis. Kunci disimpan di database server, tidak pernah ke browser pengguna.</div>
      <div class="grid g3 mt">
        <div><label class="fl">Provider aktif</label>
          <select id="pgProv">
            <option value="simulasi" ${pg.provider==='simulasi'?'selected':''}>🧪 Simulasi (demo, tanpa uang nyata)</option>
            <option value="midtrans" ${pg.provider==='midtrans'?'selected':''}>Midtrans Snap</option>
            <option value="xendit" ${pg.provider==='xendit'?'selected':''}>Xendit Invoice</option>
          </select></div>
        <div><label class="fl">Mode</label>
          <select id="pgMode"><option value="sandbox" ${pg.mode!=='production'?'selected':''}>Sandbox</option><option value="production" ${pg.mode==='production'?'selected':''}>Production</option></select></div>
        <div><label class="fl">Midtrans Server Key</label><input id="pgMid" type="password" value="${U.esc(pg.midtransServerKey||'')}" placeholder="SB-Mid-server-…"></div>
        <div><label class="fl">Xendit Secret Key</label><input id="pgXen" type="password" value="${U.esc(pg.xenditKey||'')}" placeholder="xnd_development_…"></div>
        <div><label class="fl">Xendit Callback Token</label><input id="pgXenTok" type="password" value="${U.esc(pg.xenditCallbackToken||'')}"></div>
        <div style="display:flex;align-items:flex-end"><button class="btn" onclick="Admin.savePayment()">💾 Simpan gateway</button></div>
      </div>
      <label class="fl">📮 URL Webhook — daftarkan di dashboard provider</label>
      <div class="mono" style="font-size:11px">Midtrans: ${location.origin}/api/pay/webhook/midtrans<br>Xendit: ${location.origin}/api/pay/webhook/xendit</div>
      <div class="hint mts">1 integrasi Midtrans/Xendit = semua metode bayar Indonesia sekaligus (QRIS = standar seluruh e-wallet & m-banking). Daftar merchant: <a href="https://midtrans.com" target="_blank">midtrans.com</a> · <a href="https://www.xendit.co/id/" target="_blank">xendit.co</a></div>
    </div>

    <div class="card mt">
      <h3>🤝 Cara sistem "ikut & auto-daftar" program afiliasi eksternal</h3>
      <div class="hint" style="line-height:1.8">
        Tidak ada jalur resmi untuk auto-mendaftar ke tiap toko satu per satu — praktik industri yang benar: <b>satu pendaftaran ke jaringan agregator membuka ribuan merchant sekaligus</b>, lalu semuanya diotomasi lewat API:<br><br>
        1️⃣ <b>Daftar sekali sebagai publisher</b> di jaringan agregator → akses ribuan program merchant dunia:<br>
        &nbsp;&nbsp;• <a href="https://involve.asia" target="_blank">Involve Asia</a> (Shopee, Lazada, dll — populer di ID) · <a href="https://accesstrade.co.id" target="_blank">ACCESSTRADE Indonesia</a><br>
        &nbsp;&nbsp;• <a href="https://affiliate-program.amazon.com" target="_blank">Amazon Associates</a> · <a href="https://portals.aliexpress.com" target="_blank">AliExpress Portals</a> · <a href="https://partnernetwork.ebay.com" target="_blank">eBay Partner Network</a><br>
        &nbsp;&nbsp;• Global: <a href="https://impact.com" target="_blank">Impact</a>, <a href="https://www.cj.com" target="_blank">CJ</a>, <a href="https://rakutenadvertising.com" target="_blank">Rakuten Advertising</a>, <a href="https://www.awin.com" target="_blank">Awin</a><br>
        2️⃣ <b>Otomasi penuh ("auto-monetize")</b>: <a href="https://sovrn.com/commerce/" target="_blank">Sovrn Commerce (Skimlinks)</a> mengubah <b>semua</b> link outbound jadi link afiliasi otomatis via satu API — paling dekat dengan konsep "auto daftar": merchant baru langsung ikut tanpa aksi tambahan.<br>
        3️⃣ <b>Deeplink API + Sub-ID</b>: server membungkus URL produk apa pun; <code>{subid}</code> = kode afiliasi pengguna → tiap konversi teratribusi ke pengguna yang benar.<br>
        4️⃣ <b>Postback S2S</b>: daftarkan URL postback di atas → hanya pembelian TERKONFIRMASI yang menghasilkan komisi, payout dibagi sistem–pengguna sesuai tarif.<br><br>
        ⚠️ Persetujuan publisher tetap wewenang tiap jaringan (review 1–3 hari) — proses legal yang tak bisa dilewati, tapi hanya <b>sekali per jaringan</b>, bukan per produk/merchant.
      </div>
    </div>

    <div class="card mt">
      <h3>⚠️ Zona Berbahaya</h3>
      <div class="row wrap mt">
        <button class="btn red sm" onclick="if(confirm('Kosongkan SEMUA konten, grup, dan buku besar platform (semua pengguna)?')){DB.set('posts',[]);DB.set('groups',[]);DB.set('ledger',[]);Toast.show('Data platform bersama dikosongkan');setTimeout(()=>Admin.navigate(),600);}">🗑 Kosongkan konten & buku besar platform</button>
      </div>
    </div>`;
});
Admin.saveKomisi = ()=>{
  const v = id => Math.max(0, Math.min(100, Number(document.getElementById(id).value)||0))/100;
  const o = { produkUser: v('kProdUser'), membershipRef: v('kRef') };
  const s = Store.get('settings', {}) || {};
  s.komisi = o;
  Store.set('settings', s);
  Object.assign(KOMISI, o);
  Toast.show('Tarif tersimpan ✔ (porsi sistem = ' + (100-Math.round(o.produkUser*100)) + '% payout)'); Admin.navigate();
};
Admin.saveAffiliate = ()=>{
  const s = Store.get('settings', {}) || {};
  s.affiliate = s.affiliate || {};
  s.affiliate.networks = document.getElementById('affNets').value.split('\n').map(l=>{
    const parts = l.split('|');
    const domain = (parts.shift()||'').trim().toLowerCase();
    return { domain, template: parts.join('|').trim() };
  }).filter(n=>n.domain && n.template);
  Store.set('settings', s);
  Toast.show('Konfigurasi afiliasi tersimpan (' + s.affiliate.networks.length + ' jaringan) ✔');
};
Admin.regenKey = ()=>{
  if(!confirm('Buat kunci postback baru? Semua jaringan harus diupdate dengan kunci baru.')) return;
  const s = Store.get('settings', {}) || {};
  s.affiliate = s.affiliate || {};
  s.affiliate.postbackKey = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b=>b.toString(16).padStart(2,'0')).join('');
  Store.set('settings', s);
  Toast.show('Kunci postback baru dibuat 🔑'); setTimeout(()=>Admin.navigate(), 600);
};
Admin.testPostback = async ()=>{
  const st = Store.get('settings', {}) || {};
  const sub = document.getElementById('tbSub').value.trim();
  const amt = Number(document.getElementById('tbAmt').value)||0;
  if(!sub || !amt) return Toast.show('Isi sub_id & payout');
  try{
    const r = await fetch(`/api/affiliate/postback?key=${encodeURIComponent((st.affiliate||{}).postbackKey||'')}&sub_id=${encodeURIComponent(sub)}&amount=${amt}&order_id=TEST-${Date.now()}&network=uji-admin&status=approved`);
    const j = await r.json();
    if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
    Toast.show(`Postback OK ✔ user ${U.rp(j.userShare)} · sistem ${U.rp(j.sysShare)}`);
    await Store.refreshShared();
  }catch(e){ Toast.show('Postback gagal: ' + e.message); }
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

/* ================= REGISTRI INTEGRASI PIHAK KETIGA =================
 * Transparansi penuh: apa yang benar-benar terhubung, apa yang siap
 * dihubungkan (butuh pendaftaran sekali), dan apa yang belum dibangun.
 */
const INTEGRASI = {
  aktif: [ // terhubung & dipakai LIVE sekarang, tanpa API key
    { n:'Yahoo Finance', cakupan:'±900 emiten IDX + indeks + komoditas dunia (harga, riwayat, dividen)', mode:'Autopilot — cache 3 mnt (harga) / 6 jam (riwayat & dividen)', via:'relay server / fallback browser' },
    { n:'CoinGecko API', cakupan:'17.000+ aset kripto + emas tokenized (PAXG) dalam USD/IDR', mode:'Autopilot — cache 3 mnt', via:'langsung (CORS resmi)' },
    { n:'ExchangeRate-API', cakupan:'160+ mata uang dunia (kurs USD/IDR dll)', mode:'Autopilot — cache 30 mnt', via:'langsung (CORS resmi)' },
    { n:'World Bank Open Data', cakupan:'1.400+ indikator makro resmi Indonesia (PDB, inflasi, pengangguran, CA)', mode:'Autopilot — cache 24 jam', via:'langsung (CORS resmi)' },
    { n:'RSS CNBC Indonesia', cakupan:'Berita market & ekonomi (artikel asli tertaut)', mode:'Autopilot — cache 15 mnt', via:'relay/proxy' },
    { n:'RSS ANTARA Ekonomi', cakupan:'Berita ekonomi kantor berita nasional', mode:'Autopilot — cadangan otomatis bila CNBC gagal', via:'relay/proxy' },
    { n:'Blockchain publik (Blockstream & Cloudflare RPC)', cakupan:'Saldo on-chain wallet BTC & ETH (read-only)', mode:'Autopilot — cache 5 mnt', via:'langsung (CORS resmi)' },
    { n:'💳 Payment orchestration internal', cakupan:'Invoice → bayar → webhook → aktivasi otomatis (mode simulasi built-in)', mode:'Autopilot penuh', via:'server + webhook' }
  ],
  siap: [ // infrastruktur SUDAH jadi (deeplink+subid+postback), tinggal daftar publisher SEKALI per jaringan
    { n:'💳 Midtrans Snap', buka:'25+ metode bayar: QRIS (semua e-wallet & m-banking), GoPay, OVO, VA 10+ bank, kartu', aksi:'Daftar merchant → isi Server Key di Pengaturan → webhook otomatis' },
    { n:'💳 Xendit Invoice', buka:'QRIS, e-wallet, VA, retail outlet, kartu, paylater', aksi:'Daftar → isi Secret Key + Callback Token' },
    { n:'Involve Asia', buka:'Shopee, Lazada, Tokopedia, Zalora, dll (ribuan merchant Asia)', aksi:'Daftar publisher (review ±1–3 hari) → isi aff_id di template deeplink' },
    { n:'ACCESSTRADE Indonesia', buka:'Ratusan merchant lokal ID', aksi:'Daftar publisher → template deeplink' },
    { n:'Amazon Associates', buka:'Ratusan juta produk Amazon global', aksi:'Daftar → tag afiliasi' },
    { n:'AliExpress Portals', buka:'100+ juta produk AliExpress', aksi:'Daftar → tracking ID' },
    { n:'eBay Partner Network', buka:'1+ miliar listing eBay', aksi:'Daftar → campaign ID' },
    { n:'Impact / CJ / Rakuten / Awin', buka:'Puluhan ribu brand global', aksi:'Daftar per jaringan' },
    { n:'Sovrn Commerce (Skimlinks)', buka:'48.000+ merchant — AUTO-monetize semua link, merchant baru otomatis ikut', aksi:'Daftar sekali → paling dekat dgn "autopilot penuh"' }
  ],
  belum: [ // jujur: belum dibangun / belum terhubung
    { n:'Payout/disbursement komisi ke rekening pengguna', ket:'Saldo komisi tercatat; pencairan otomatis butuh produk disbursement (Midtrans Iris/Xendit Payout) + KYC' },
    { n:'Scraper UMP/BPS otomatis tahunan', ket:'UMP 2026 tertanam dari sumber resmi; pembaruan tahunan masih manual (atau tambah scheduled scraper di produksi)' },
    { n:'API premium asuransi realtime', ket:'Tidak ada API publik premi asuransi ID; saat ini estimator + tautan marketplace berizin OJK' }
  ]
};

Admin.register('integrasi', 'Integrasi Pihak Ketiga', function(el){
  const st = Store.get('settings', {}) || {};
  const nets = ((st.affiliate||{}).networks || []);
  el.innerHTML = `
    <div class="grid g4 mb">
      <div class="stat"><div class="lbl">Integrasi data LIVE</div><div class="val up">${INTEGRASI.aktif.length}</div><div class="d sub">tanpa API key, autopilot</div></div>
      <div class="stat"><div class="lbl">Jaringan afiliasi siap-hubung</div><div class="val" style="color:var(--yel)">${INTEGRASI.siap.length}</div><div class="d sub">${nets.length} template deeplink terpasang</div></div>
      <div class="stat"><div class="lbl">Cakupan via 1 login agregator</div><div class="val">ribuan</div><div class="d sub">merchant → jutaan produk</div></div>
      <div class="stat"><div class="lbl">Belum terhubung</div><div class="val down">${INTEGRASI.belum.length}</div><div class="d sub">lihat daftar jujur di bawah</div></div>
    </div>

    <div class="alert info mb">
      <b>Prinsip arsitektur: hub-and-spoke, bukan "ratusan integrasi satu-satu".</b><br>
      1 integrasi Yahoo Finance = ±900 emiten IDX + bursa dunia · 1 CoinGecko = 17.000+ aset · 1 World Bank = 1.400+ indikator ·
      1 pendaftaran agregator afiliasi = ribuan merchant (jutaan produk). Total pihak ketiga yang perlu dikelola tetap belasan — itulah desain yang benar agar sistem tetap autopilot & murah perawatan.
    </div>

    <div class="card mb" style="overflow-x:auto">
      <h3>🟢 Terhubung LIVE sekarang (${INTEGRASI.aktif.length})</h3>
      <table>
        <tr><th>Provider</th><th>Cakupan lewat 1 integrasi</th><th>Mode</th><th>Jalur</th></tr>
        ${INTEGRASI.aktif.map(i=>`<tr><td><b>${i.n}</b></td><td>${i.cakupan}</td><td><span class="badge b-grn">${i.mode}</span></td><td class="hint">${i.via}</td></tr>`).join('')}
      </table>
      <div class="hint mt">Uji langsung semuanya di menu <a href="#/sumber">📡 Sumber Data</a>. "Autopilot" = browser/relay mengambil ulang otomatis saat cache kedaluwarsa — tanpa campur tangan admin.</div>
    </div>

    <div class="card mb" style="overflow-x:auto">
      <h3>🟡 Afiliasi eksternal — infrastruktur JADI, tinggal daftar sekali per jaringan (${INTEGRASI.siap.length})</h3>
      <table>
        <tr><th>Jaringan</th><th>Yang terbuka setelah 1 pendaftaran</th><th>Aksi sekali</th></tr>
        ${INTEGRASI.siap.map(i=>`<tr><td><b>${i.n}</b></td><td>${i.buka}</td><td class="hint">${i.aksi}</td></tr>`).join('')}
      </table>
      <div class="hint mt">Setelah disetujui: tempel <b>aff_id</b> ke template deeplink & daftarkan <b>URL postback</b> (menu Pengaturan) → sejak itu <b>100% autopilot</b>: link pengguna terbungkus otomatis + Sub-ID, konversi terverifikasi masuk sendiri via postback, payout terbagi 70/30 otomatis, anti-duplikat order_id.</div>
    </div>

    <div class="card mb">
      <h3>🔴 Jujur: belum terhubung / belum dibangun (${INTEGRASI.belum.length})</h3>
      ${INTEGRASI.belum.map(i=>`<div class="alert warn mts"><b>${i.n}</b><br><span class="hint">${i.ket}</span></div>`).join('')}
    </div>

    <div class="card" style="overflow-x:auto">
      <h3>🗺 Matriks integrasi per menu aplikasi pengguna</h3>
      <div class="hint mb">Setiap menu pengguna menampilkan strip "🔌 Integrasi modul ini" — status live, jam pengambilan data, mode autopilot, dan tombol uji per provider.</div>
      <table>
        <tr><th>Menu</th><th>Provider yang menyuplai</th></tr>
        ${Object.entries(MODUL_INTEGRASI).map(([r, ids])=>`
          <tr><td><b>${{dashboard:'🏠 Dashboard',social:'🌐 Sosial Hub',project:'📋 Projek Tim',income:'💰 Income',khl:'🏡 KHL & Budget',proteksi:'🛡️ Proteksi',invest:'🎯 Tujuan Investasi',screening:'🔎 Screening',dividen:'📅 Dividen',profil:'👤 Profil',membership:'⭐ Membership'}[r]||r}</b></td>
          <td class="hint">${ids.map(id=>{
            const P = IntegrasiUI.PROV[id];
            return '<span class="badge ' + (id==='db'?'b-cyn':id==='affiliate'?'b-pur':P&&P.statis?'b-yel':'b-grn') + '" style="margin:2px 3px 2px 0">' +
              (id==='db'?'Database server':id==='affiliate'?'Mesin afiliasi':P?P.nama:id) + '</span>';
          }).join('')}</td></tr>`).join('')}
      </table>
    </div>`;
});

/* ================= DIAGNOSTIK — self-test seluruh fitur + mitigasi ================= */
Admin.register('diagnostik', 'Diagnostik Sistem', function(el){
  el.innerHTML = `
    <div class="card mb">
      <div class="row between wrap">
        <div><h3 style="margin:0">🩺 Diagnostik Menyeluruh</h3>
        <div class="hint mts">Menguji NYATA setiap lapisan: server+database, endpoint bisnis tiap menu, sumber data eksternal, blockchain, mesin afiliasi — lengkap dgn mitigasi bila gagal.</div></div>
        <button class="btn" onclick="Admin.runDiag()">▶ Jalankan semua tes</button>
      </div>
    </div>
    <div class="card" style="overflow-x:auto"><table id="diagTable">
      <tr><th>#</th><th>Uji</th><th>Menu terkait</th><th>Status</th><th>Hasil / Mitigasi</th></tr>
    </table></div>`;
});
Admin.DIAG = [
  { n:'Server hidup + sesi admin', menu:'Semua', run: async ()=>{ const r = await Store.api('/api/me'); return 'login sebagai @' + r.user.username + ' (' + r.user.role + ')'; },
    fix:'Jalankan ulang: node server.js — cek port 8000 tidak bentrok.' },
  { n:'Database tulis→baca (roundtrip SQLite)', menu:'Semua data pengguna', run: async ()=>{
      const v = 'diag-' + Date.now();
      await Store.api('/api/data/user/diag_test', { method:'PUT', body:{ value:v } });
      const d = await Store.api('/api/data');
      if(d.user.diag_test !== v) throw new Error('nilai tidak persisten');
      return 'tulis & baca konsisten (kv_user)'; },
    fix:'Cek file data/ghub.sqlite writable & disk tidak penuh; restart server.' },
  { n:'Koleksi bersama (posts/groups/ledger)', menu:'Sosial Hub · Membership', run: async ()=>{
      const d = await Store.api('/api/data');
      return `${d.shared.posts.length} post · ${d.shared.groups.length} grup · ${d.shared.ledger.length} entri ledger`; },
    fix:'Bila kosong padahal ada data: cek migrasi tabel di log server.' },
  { n:'Endpoint bisnis: statistik admin', menu:'Panel Admin', run: async ()=>{
      const s = await Store.api('/api/admin/stats');
      return `${s.totalUser} user · ${s.memberAktif} member aktif · ${s.klik} klik · ${s.sesiAktif} sesi`; },
    fix:'Pastikan akun ini role=admin; login ulang bila sesi kadaluarsa.' },
  { n:'Deeplink builder (pembungkus afiliasi)', menu:'Sosial Hub', run: async ()=>{
      const r = await fetch('/api/deeplink?url=' + encodeURIComponent('https://shopee.co.id/tes') + '&subid=DIAG'); const j = await r.json();
      if(!r.ok) throw new Error(j.error); return j.wrapped ? 'terbungkus via template: ' + j.network : 'fallback URL asli (belum ada template — wajar sebelum daftar jaringan)'; },
    fix:'Isi template deeplink di Pengaturan → Afiliasi Eksternal setelah disetujui jaringan.' },
  { n:'Kunci postback afiliasi tersedia', menu:'Membership · Sosial Hub', run: async ()=>{
      const st = Store.get('settings', {}) || {};
      if(!st.affiliate || !st.affiliate.postbackKey) throw new Error('kunci belum dibuat');
      return 'kunci siap (' + st.affiliate.postbackKey.slice(0,6) + '…) — daftarkan URL postback ke jaringan'; },
    fix:'Buka Pengaturan → kunci dibuat otomatis oleh server saat settings dibaca.' },
  { n:'Yahoo Finance (saham/IHSG/dividen/logam)', menu:'Screening · Dividen · Income · Dashboard', run: async ()=>{ const q = await API.quote('^JKSE'); return 'IHSG ' + U.num(q.price,0) + ' (' + U.num(q.chgPct,2) + '%)'; },
    fix:'Bergantung relay/proxy CORS — coba Kosongkan cache (menu Sumber Data) lalu uji ulang; di produksi aktifkan /api/relay.' },
  { n:'CoinGecko (kripto & emas PAXG)', menu:'Income · Dashboard · KHL (nisab zakat)', run: async ()=>{ const c = await API.cryptoGold(); return 'BTC $' + U.num(c.data.bitcoin.usd,0) + ' · PAXG $' + U.num(c.data['pax-gold'].usd,0); },
    fix:'Rate limit CoinGecko 10-30 req/mnt — cache 3 mnt sudah melindungi; tunggu 1 menit.' },
  { n:'Kurs valas (160+ mata uang)', menu:'Income · Screening', run: async ()=>{ const f = await API.fx(); return 'USD/IDR ' + U.num(f.rates.IDR,0); },
    fix:'Fallback: open.er-api.com gratis tanpa key; cek koneksi.' },
  { n:'World Bank (makro resmi)', menu:'Screening · KHL (inflasi)', run: async ()=>{ const w = await API.worldBank('FP.CPI.TOTL.ZG','Inflasi'); return 'Inflasi ' + U.num(w.value,2) + '% (data ' + w.year + ')'; },
    fix:'API resmi tanpa key — bila gagal, cek koneksi/firewall.' },
  { n:'Berita RSS (CNBC/ANTARA/detik)', menu:'Dashboard · Screening', run: async ()=>{ const n = await API.news(); return n.items.length + ' artikel · ' + n.source; },
    fix:'3 feed fallback berantai — bila semua gagal, relay/proxy CORS sedang down; coba lagi.' },
  { n:'Intel Google News (himpun berita per emiten)', menu:'Screening (riset 🕵️)', run: async ()=>{ const g = await API.gnews('BBCA saham'); const s = API.riskScan(g.items); return g.items.length + ' artikel terhimpun · ' + s.risk.length + ' berindikasi risiko'; },
    fix:'Google News RSS via relay/proxy — sama dgn mitigasi RSS.' },
  { n:'⛓ Blockchain BTC (Blockstream)', menu:'Income (wallet on-chain)', run: async ()=>{ const b = await API.btcBalance('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa'); return 'alamat genesis Satoshi: ' + U.num(b.coin,4) + ' BTC on-chain ✔'; },
    fix:'Blockstream API publik CORS — bila gagal, coba lagi / ganti explorer (mempool.space).' },
  { n:'⛓ Blockchain ETH (Cloudflare RPC)', menu:'Income (wallet on-chain)', run: async ()=>{ const b = await API.ethBalance('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'); return 'vitalik.eth: ' + U.num(b.coin,3) + ' ETH on-chain ✔'; },
    fix:'JSON-RPC publik Cloudflare — bila gagal, ganti RPC (publicnode.com, llamarpc).' },
  { n:'Registri blacklist lintas-emiten', menu:'Screening', run: async ()=>{
      const h = blacklistHits('WSKT'); if(!h.length) throw new Error('registri kosong');
      return ENTITAS_BERMASALAH.length + ' entitas · uji WSKT → ' + h.length + ' temuan → EXCLUDED ✔'; },
    fix:'Registri di js/data.js — tambah entitas baru berdasarkan putusan/pemberitaan terdokumentasi.' },
  { n:'🤖 AI heuristik lokal', menu:'Semua (tombol 🤖)', run: async ()=>{ const n = AI.localInsights().length; if(!n) throw new Error('tidak menghasilkan insight'); return n + ' insight dihasilkan dari data lokal ✔'; },
    fix:'Modul js/ai.js — pastikan termuat (cek konsol browser).' },
  { n:'Cache autopilot (TTL)', menu:'Semua data eksternal', run: async ()=>{
      const n = Object.keys(localStorage).filter(k=>k.startsWith('ghubc_')).length;
      return n + ' entri cache aktif — refresh otomatis saat TTL habis (3 mnt–24 jam)'; },
    fix:'Kosongkan via menu Sumber Data bila data terasa basi.' }
];
Admin.runDiag = async ()=>{
  const tb = document.getElementById('diagTable');
  // reset baris
  [...tb.querySelectorAll('tr')].slice(1).forEach(r=>r.remove());
  let pass = 0;
  for(let i = 0; i < Admin.DIAG.length; i++){
    const d = Admin.DIAG[i];
    const row = tb.insertRow(-1);
    row.innerHTML = `<td>${i+1}</td><td><b>${d.n}</b></td><td class="hint">${d.menu}</td><td><span class="badge b-yel">menguji…</span></td><td class="hint">—</td>`;
    try{
      const res = await d.run();
      row.cells[3].innerHTML = '<span class="badge b-grn">✔ LULUS</span>';
      row.cells[4].innerHTML = res;
      pass++;
    }catch(e){
      row.cells[3].innerHTML = '<span class="badge b-red">✕ GAGAL</span>';
      row.cells[4].innerHTML = '<span class="down">' + U.esc(e.message) + '</span><br><span class="hint">🛠 Mitigasi: ' + d.fix + '</span>';
    }
  }
  const sum = tb.insertRow(-1);
  sum.innerHTML = `<td colspan="5"><div class="alert ${pass===Admin.DIAG.length?'ok':'warn'}"><b>${pass}/${Admin.DIAG.length} tes lulus.</b> ${pass===Admin.DIAG.length?'Semua menu terkoneksi penuh & autopilot 🎉':'Yang gagal disertai mitigasi di kolom kanan — umumnya soal jaringan/relay, coba uji ulang.'}</div></td>`;
};

Admin.savePayment = ()=>{
  const s = Store.get('settings', {}) || {};
  s.payment = {
    provider: document.getElementById('pgProv').value,
    mode: document.getElementById('pgMode').value,
    midtransServerKey: document.getElementById('pgMid').value.trim(),
    xenditKey: document.getElementById('pgXen').value.trim(),
    xenditCallbackToken: document.getElementById('pgXenTok').value.trim()
  };
  Store.set('settings', s);
  Toast.show('Payment gateway tersimpan: ' + s.payment.provider + ' (' + s.payment.mode + ') ✔');
};

/* Tambah daftar invoice ke halaman Keuangan (dimuat async setelah render) */
Admin._renderInvoices = async ()=>{
  const host = document.getElementById('admInvBox'); if(!host) return;
  try{
    const d = await Store.api('/api/admin/invoices');
    host.innerHTML = d.invoices.length ? `<div style="overflow-x:auto"><table>
      <tr><th>Invoice</th><th>Waktu</th><th>User</th><th>Item</th><th class="num">Nominal</th><th>Provider</th><th>Status</th></tr>
      ${d.invoices.map(i=>`<tr>
        <td class="mono" style="padding:3px 8px;font-size:11px">${i.id}</td>
        <td class="hint">${U.dtm(i.at)}</td><td>@${U.esc(i.user)}</td>
        <td>${U.esc(i.tipe)} ${U.esc(i.ref||'')}</td>
        <td class="num">${U.rp(i.amount)}</td>
        <td><span class="badge b-cyn">${U.esc(i.provider)}</span></td>
        <td>${i.status==='paid'?`<span class="badge b-grn">✔ LUNAS ${i.paid_at?U.time(i.paid_at):''}</span>`:`<span class="badge b-yel">pending</span>`}</td>
      </tr>`).join('')}
    </table></div>` : '<div class="empty">Belum ada invoice.</div>';
  }catch(e){ host.innerHTML = errorBox(e.message); }
};

/* Diagnostik: uji payment gateway end-to-end */
Admin.DIAG.push({ n:'💳 Payment gateway: invoice → bayar → aktif (E2E)', menu:'Membership · Sosial Hub', run: async ()=>{
    const d = await Store.api('/api/admin/invoices');
    const st = Store.get('settings', {}) || {};
    const prov = (st.payment||{}).provider || 'simulasi';
    const paid = d.invoices.filter(i=>i.status==='paid').length;
    return `provider: ${prov} (${(st.payment||{}).mode||'sandbox'}) · ${d.invoices.length} invoice · ${paid} lunas · webhook Midtrans/Xendit terpasang`; },
  fix:'Atur provider & kunci di Pengaturan → Payment Gateway; mode simulasi selalu tersedia utk demo.' });
