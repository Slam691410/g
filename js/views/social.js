/* ========== Sosial Hub: feed, unggah konten, grup berlangganan, keranjang afiliasi ========== */
const Social = {
  tab: DB.get('social_tab', 'feed'),
  draftCart: [],

  posts(){ return DB.get('posts', []); },
  savePosts(p){ DB.set('posts', p); },
  groups(){ return DB.get('groups', []); },
  saveGroups(g){ DB.set('groups', g); },

  setTab(t){ this.tab = t; DB.set('social_tab', t); App.navigate(); },

  /* ---- Keranjang afiliasi: cari produk eksternal / tempel URL produk asli ---- */
  openCartPicker(postId){
    Modal.open(`
      <h3>🛒 Keranjang Afiliasi</h3>
      <div class="hint">Tautkan produk dari <b>jutaan produk marketplace eksternal seluruh dunia</b>. Link otomatis <b>dibungkus sistem</b> (go.html) — komisi tercatat untuk Anda (${(KOMISI.produkUser*100)}%) dan sistem (${(KOMISI.produkSistem*100)}%), lalu pengunjung dialihkan ke produk aslinya.</div>
      <label class="fl">Cari produk (buka marketplace asli, salin URL produknya)</label>
      <div class="row"><input id="cartQ" placeholder="mis. sepatu lari, kamera mirrorless, skincare…"></div>
      <div class="pill-row mts" id="cartMkts"></div>
      <div class="divider"></div>
      <label class="fl">Nama produk</label><input id="cartNama" placeholder="mis. Sepatu Lari XYZ Air Max">
      <label class="fl">URL produk asli (dari marketplace mana pun di dunia)</label><input id="cartUrl" placeholder="https://...">
      <label class="fl">Harga (opsional, Rp)</label><input id="cartHarga" type="number" placeholder="250000">
      <div class="row mt">
        <button class="btn grn" onclick="Social.addCartItem('${postId||''}')">＋ Tambahkan ke keranjang</button>
      </div>
      <div id="cartDraft" class="mt"></div>`);
    const renderMkts = ()=>{
      const q = document.getElementById('cartQ').value.trim() || 'produk';
      document.getElementById('cartMkts').innerHTML = MARKETPLACES.map(m=>
        `<a class="btn ghost sm" href="${m.search(q)}" target="_blank" rel="noopener">🔗 ${m.nama}</a>`).join('');
    };
    document.getElementById('cartQ').oninput = renderMkts; renderMkts();
    this.renderDraftCart();
  },
  renderDraftCart(){
    const box = document.getElementById('cartDraft'); if(!box) return;
    box.innerHTML = this.draftCart.length ? `<div class="cart-box">${this.draftCart.map((c,i)=>`
      <div class="cart-item"><div><b>${U.esc(c.nama)}</b>${c.harga?` · ${U.rp(c.harga)}`:''}<div class="hint">${U.esc(c.url.slice(0,60))}…</div></div>
      <button class="btn red sm" onclick="Social.draftCart.splice(${i},1);Social.renderDraftCart()">✕</button></div>`).join('')}</div>
      <button class="btn mt" onclick="Modal.close();App.navigate()">Selesai (${this.draftCart.length} produk)</button>` : '';
  },
  addCartItem(postId){
    const nama = document.getElementById('cartNama').value.trim();
    const url = document.getElementById('cartUrl').value.trim();
    const harga = Number(document.getElementById('cartHarga').value) || null;
    if(!nama || !/^https?:\/\//i.test(url)) return Toast.show('Isi nama & URL produk yang valid (https://…)');
    const item = { id: U.uid(), nama, url, harga };
    if(postId){
      const ps = this.posts(); const p = ps.find(x=>x.id===postId);
      if(p){ p.cart = p.cart||[]; p.cart.push(item); this.savePosts(ps); Toast.show('Produk ditambahkan ke konten'); Modal.close(); App.navigate(); return; }
    }
    this.draftCart.push(item);
    document.getElementById('cartNama').value=''; document.getElementById('cartUrl').value=''; document.getElementById('cartHarga').value='';
    this.renderDraftCart(); Toast.show('Masuk keranjang draft');
  },

  /* ---- Unggah konten ---- */
  publish(groupId){
    const txt = document.getElementById('postTxt').value.trim();
    const img = (document.getElementById('postImg')||{}).value ? document.getElementById('postImg').value.trim() : '';
    if(!txt && !img) return Toast.show('Tulis sesuatu atau lampirkan gambar dulu');
    const p = getProfile();
    const meU = Store.me ? Store.me.username : '';
    const ps = this.posts();
    ps.unshift({ id: U.uid(), at: new Date().toISOString(), author: p.nama || Store.me?.nama || meU || 'Saya',
      authorUser: meU, group: groupId||null,
      text: txt, img, cart: this.draftCart.splice(0), likes: 0, comments: [] });
    this.savePosts(ps); Toast.show('Konten terunggah 🎉'); App.navigate();
  },
  like(id){ const ps=this.posts(); const p=ps.find(x=>x.id===id); if(p){ p.likes++; this.savePosts(ps); App.navigate(); } },
  delPost(id){
    const p = this.posts().find(x=>x.id===id);
    if(p && p.authorUser && Store.me && p.authorUser !== Store.me.username) return Toast.show('Hanya pemilik konten yang bisa menghapus');
    if(!confirm('Hapus konten ini?')) return; this.savePosts(this.posts().filter(x=>x.id!==id)); App.navigate(); },
  comment(id){ const inp=document.getElementById('cmt_'+id); const v=inp.value.trim(); if(!v) return;
    const ps=this.posts(); const p=ps.find(x=>x.id===id);
    p.comments.push({ by:getProfile().nama||'Saya', at:new Date().toISOString(), text:v });
    this.savePosts(ps); App.navigate(); },

  /* ---- Grup & langganan ---- */
  openGroupForm(){
    Modal.open(`
      <h3>👥 Buat Grup</h3>
      <label class="fl">Nama grup</label><input id="grpNama" placeholder="mis. Komunitas Value Investor">
      <label class="fl">Deskripsi</label><textarea id="grpDesc" rows="2" placeholder="Tentang apa grup ini?"></textarea>
      <label class="fl">Tipe grup</label>
      <select id="grpTipe" onchange="document.getElementById('grpHargaWrap').style.display=this.value==='langganan'?'block':'none'">
        <option value="gratis">Gratis (terbuka)</option>
        <option value="langganan">Khusus — Berlangganan (berbayar)</option>
      </select>
      <div id="grpHargaWrap" style="display:none">
        <label class="fl">Harga langganan / bulan (Rp)</label><input id="grpHarga" type="number" placeholder="25000">
        <div class="hint mts">Sistem memotong ${(KOMISI.grupSistem*100)}% biaya platform; sisanya jadi pendapatan Anda (lihat modul Membership).</div>
      </div>
      <button class="btn mt" onclick="Social.createGroup()">Buat Grup</button>`);
  },
  createGroup(){
    const nama = document.getElementById('grpNama').value.trim();
    if(!nama) return Toast.show('Nama grup wajib diisi');
    const tipe = document.getElementById('grpTipe').value;
    const harga = tipe==='langganan' ? (Number(document.getElementById('grpHarga').value)||0) : 0;
    const gs = this.groups();
    gs.unshift({ id: U.uid(), nama, desc: document.getElementById('grpDesc').value.trim(), tipe, harga,
      owner: getProfile().nama || Store.me?.nama || Store.me?.username || 'Saya',
      ownerUser: Store.me ? Store.me.username : '', at: new Date().toISOString(), members: [], subs: [] });
    this.saveGroups(gs); Modal.close(); Toast.show('Grup dibuat 🎉'); App.navigate();
  },
  joinGroup(id){
    const gs = this.groups(); const g = gs.find(x=>x.id===id); if(!g) return;
    const me = Store.me ? Store.me.username : (getProfile().nama || 'Saya');
    if(g.tipe==='langganan'){
      if(!confirm(`Berlangganan grup "${g.nama}" seharga ${U.rp(g.harga)}/bulan?`)) return;
      const exp = new Date(); exp.setMonth(exp.getMonth()+1);
      g.subs.push({ by: me, at: new Date().toISOString(), until: exp.toISOString(), harga: g.harga });
      const sistem = Math.round(g.harga * KOMISI.grupSistem);
      const pairId = U.uid();
      // komisi kreator diatribusikan ke PEMILIK grup, fee ke sistem
      logCommission({ tipe:'langganan-grup', kanal:g.nama, kode:'', user:g.ownerUser||g.owner, jumlah:g.harga - sistem, status:'komisi kreator', pairId, detail:`Langganan oleh @${me}: ${U.rp(g.harga)} − fee sistem ${U.rp(sistem)}` });
      logCommission({ tipe:'fee-sistem', kanalTipe:'grup', kanal:g.nama, kode:'SISTEM', user:'SISTEM', jumlah:sistem, status:'pendapatan sistem', pairId, detail:`Fee platform ${KOMISI.grupSistem*100}% dari langganan ${U.rp(g.harga)}` });
      Toast.show('Berlangganan aktif 1 bulan ✔');
    }
    if(!g.members.includes(me)) g.members.push(me);
    this.saveGroups(gs); App.navigate();
  },
  isSubscribed(g){
    const me = Store.me ? Store.me.username : (getProfile().nama || 'Saya');
    if(g.tipe!=='langganan') return g.members.includes(me);
    if(g.ownerUser && Store.me && g.ownerUser === Store.me.username) return true; // pemilik selalu punya akses
    return g.subs.some(s=>s.by===me && new Date(s.until)>new Date());
  }
};

App.register('social', 'Sosial Hub', function(el){
  const tab = Social.tab;
  let body = '';

  if(tab==='feed'){
    const posts = Social.posts().filter(p=>!p.group);
    body = `
      <div class="card mb">
        <h3>✍️ Unggah Konten</h3>
        <textarea id="postTxt" rows="3" placeholder="Bagikan ide, analisis, atau ceritamu…"></textarea>
        <label class="fl">URL Gambar (opsional)</label>
        <input id="postImg" placeholder="https://… (tempel tautan gambar)">
        <div class="row mt between wrap">
          <button class="btn ghost" onclick="Social.openCartPicker()">🛒 Keranjang Afiliasi ${Social.draftCart.length?`(${Social.draftCart.length})`:''}</button>
          <button class="btn" onclick="Social.publish()">🚀 Unggah</button>
        </div>
      </div>
      ${posts.length ? posts.map(p=>renderPost(p)).join('') : `<div class="empty">Belum ada konten. Jadilah yang pertama mengunggah! 🎬</div>`}`;
  }
  else if(tab==='grup'){
    const gs = Social.groups();
    body = `
      <div class="row between mb wrap">
        <div class="sub">Buat komunitasmu — gratis atau <b>grup khusus berlangganan</b> (monetisasi).</div>
        <button class="btn" onclick="Social.openGroupForm()">＋ Buat Grup</button>
      </div>
      <div class="grid g2">
        ${gs.length ? gs.map(g=>{
          const sub = Social.isSubscribed(g);
          return `<div class="group-card">
            <div class="row between">
              <b>${U.esc(g.nama)}</b>
              ${g.tipe==='langganan' ? `<span class="badge b-pur">🔒 ${U.rp(g.harga)}/bln</span>` : `<span class="badge b-grn">Gratis</span>`}
            </div>
            <div class="hint mts">${U.esc(g.desc||'')} · oleh ${U.esc(g.owner)} · ${g.members.length} anggota</div>
            <div class="row mt">
              ${sub ? `<button class="btn grn sm" onclick="Social.setTab('g_${g.id}')">Buka Grup ➜</button>`
                    : `<button class="btn sm" onclick="Social.joinGroup('${g.id}')">${g.tipe==='langganan'?'💳 Berlangganan':'Gabung'}</button>`}
            </div>
          </div>`; }).join('') : `<div class="empty" style="grid-column:1/-1">Belum ada grup. Buat grup pertamamu!</div>`}
      </div>`;
  }
  else if(tab.startsWith('g_')){
    const g = Social.groups().find(x=>x.id===tab.slice(2));
    if(!g){ Social.setTab('grup'); return; }
    const posts = Social.posts().filter(p=>p.group===g.id);
    body = `
      <div class="card mb">
        <div class="row between wrap">
          <div><b style="font-size:17px">${U.esc(g.nama)}</b> ${g.tipe==='langganan'?`<span class="badge b-pur">🔒 Berlangganan</span>`:''}
          <div class="hint">${U.esc(g.desc||'')}</div></div>
          <button class="btn ghost sm" onclick="Social.setTab('grup')">← Semua grup</button>
        </div>
      </div>
      ${Social.isSubscribed(g) ? `
        <div class="card mb">
          <h3>✍️ Posting ke grup</h3>
          <textarea id="postTxt" rows="2" placeholder="Konten khusus anggota…"></textarea>
          <div class="row mt between">
            <button class="btn ghost sm" onclick="Social.openCartPicker()">🛒 Keranjang</button>
            <button class="btn sm" onclick="Social.publish('${g.id}')">Unggah</button>
          </div>
        </div>
        ${posts.length ? posts.map(p=>renderPost(p)).join('') : `<div class="empty">Belum ada konten grup.</div>`}`
      : `<div class="alert warn">Konten grup ini khusus pelanggan. Berlangganan dulu untuk mengakses. <button class="btn sm mt" onclick="Social.joinGroup('${g.id}')">💳 Berlangganan ${U.rp(g.harga)}/bln</button></div>`}`;
  }

  el.innerHTML = `
    <div class="tabs">
      <button class="tab ${tab==='feed'?'active':''}" onclick="Social.setTab('feed')">📡 Feed</button>
      <button class="tab ${tab==='grup'||tab.startsWith('g_')?'active':''}" onclick="Social.setTab('grup')">👥 Grup</button>
    </div>
    ${body}`;

  function renderPost(p){
    return `<div class="post">
      <div class="post-head">
        <div class="post-av" style="background:${U.color(p.author)}">${U.initials(p.author)}</div>
        <div><b>${U.esc(p.author)}</b><div class="hint">${U.ago(p.at)}</div></div>
        <div style="margin-left:auto"><button class="btn ghost sm" onclick="Social.delPost('${p.id}')">🗑</button></div>
      </div>
      <div style="white-space:pre-wrap">${U.esc(p.text)}</div>
      ${p.img ? `<img class="post-img" src="${U.esc(p.img)}" onerror="this.style.display='none'">` : ''}
      ${p.cart && p.cart.length ? `
        <div class="cart-box">
          <b style="font-size:12.5px">🛒 Keranjang — produk terkait (link dibungkus sistem)</b>
          ${p.cart.map(c=>`
            <div class="cart-item">
              <div><b>${U.esc(c.nama)}</b>${c.harga?`<div class="hint">${U.rp(c.harga)} · est. komisi Anda ${U.rp(c.harga*KOMISI.produkUser)} + sistem ${U.rp(c.harga*KOMISI.produkSistem)}</div>`:''}</div>
              <a class="btn sm grn" href="${wrapLink(c.url,'konten')}" target="_blank" rel="noopener">Beli ➜</a>
            </div>`).join('')}
        </div>` : ''}
      <div class="post-actions">
        <span onclick="Social.like('${p.id}')">👍 ${p.likes||0}</span>
        <span>💬 ${p.comments.length}</span>
        <span onclick="Social.openCartPicker('${p.id}')">🛒 + produk</span>
      </div>
      ${p.comments.map(c=>`<div class="hint mts" style="padding-left:10px;border-left:2px solid var(--line)"><b>${U.esc(c.by)}</b>: ${U.esc(c.text)}</div>`).join('')}
      <div class="row mts">
        <input id="cmt_${p.id}" placeholder="Tulis komentar…" style="flex:1">
        <button class="btn ghost sm" onclick="Social.comment('${p.id}')">Kirim</button>
      </div>
    </div>`;
  }
});
