/* ========== Income: catat & auto-kategorisasi transaksi + SEMUA kelas aset dengan harga REALTIME ========== */
const Income = {
  tab: DB.get('income_tab', 'transaksi'),
  txs(){ return DB.get('txs', []); },
  save(t){ DB.set('txs', t); },
  holds(){ return DB.get('holdings', []); },
  saveHolds(h){ DB.set('holdings', h); },
  setTab(t){ this.tab = t; DB.set('income_tab', t); App.navigate(); },

  TIPE: ['Pemasukan','Pengeluaran','Penempatan Aset','Mutasi Aset','Pos Investasi'],
  /* Aturan auto-kategorisasi berdasar kata kunci */
  RULES: [
    { k: ['gaji','salary','payroll','thr','bonus'], kat: 'Gaji & Tunjangan', tipe: 'Pemasukan' },
    { k: ['dividen','deviden','kupon','bunga deposito','bagi hasil'], kat: 'Hasil Investasi', tipe: 'Pemasukan' },
    { k: ['freelance','proyek','komisi','fee','honor'], kat: 'Usaha & Freelance', tipe: 'Pemasukan' },
    { k: ['jual','penjualan','omzet','sewa'], kat: 'Usaha & Penjualan', tipe: 'Pemasukan' },
    { k: ['makan','warung','resto','gofood','grabfood','shopeefood','kopi','sarapan'], kat: 'Makan & Minum', tipe: 'Pengeluaran' },
    { k: ['listrik','pln','pdam','air','wifi','internet','indihome','pulsa','token'], kat: 'Utilitas', tipe: 'Pengeluaran' },
    { k: ['bensin','pertamax','gojek','grab','krl','mrt','tol','parkir','transj'], kat: 'Transportasi', tipe: 'Pengeluaran' },
    { k: ['sewa','kontrakan','kos','kpr','cicilan rumah'], kat: 'Tempat Tinggal', tipe: 'Pengeluaran' },
    { k: ['spp','sekolah','ukt','kuliah','buku','les','bimbel'], kat: 'Pendidikan', tipe: 'Pengeluaran' },
    { k: ['dokter','obat','apotek','rumah sakit','bpjs','vitamin'], kat: 'Kesehatan', tipe: 'Pengeluaran' },
    { k: ['belanja','shopee','tokopedia','lazada','baju','sepatu'], kat: 'Belanja', tipe: 'Pengeluaran' },
    { k: ['premi','asuransi','proteksi'], kat: 'Proteksi/Asuransi', tipe: 'Pengeluaran' },
    { k: ['zakat','infaq','sedekah','donasi'], kat: 'Sosial & Ibadah', tipe: 'Pengeluaran' },
    { k: ['beli saham','beli reksadana','rdn','sbn','ori','sukuk','beli emas','beli btc','beli bitcoin','dca'], kat: 'Pos Investasi', tipe: 'Pos Investasi' },
    { k: ['deposito','tabungan berjangka','penempatan'], kat: 'Penempatan Aset', tipe: 'Penempatan Aset' },
    { k: ['transfer antar','pindah rekening','top up rdn','mutasi','tarik dana'], kat: 'Mutasi Aset', tipe: 'Mutasi Aset' }
  ],
  autoCat(desc){
    const d = desc.toLowerCase();
    for(const r of this.RULES){ if(r.k.some(k=>d.includes(k))) return { kat: r.kat, tipe: r.tipe }; }
    return null;
  },

  openForm(){
    Modal.open(`
      <h3>＋ Catat Transaksi</h3>
      <label class="fl">Deskripsi (kategori terisi otomatis dari deskripsi)</label>
      <input id="txDesc" placeholder="mis. Gaji September / GoFood makan siang / Beli saham BBCA">
      <div id="txAutoHint" class="hint mts"></div>
      <div class="grid g2">
        <div><label class="fl">Jumlah (Rp)</label><input id="txNilai" type="number" placeholder="500000"></div>
        <div><label class="fl">Tanggal</label><input id="txTgl" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
      </div>
      <div class="grid g2">
        <div><label class="fl">Tipe</label><select id="txTipe">${this.TIPE.map(t=>`<option>${t}</option>`).join('')}</select></div>
        <div><label class="fl">Kategori</label><input id="txKat" placeholder="otomatis / isi manual"></div>
      </div>
      <button class="btn mt" onclick="Income.submit()">Simpan</button>`);
    document.getElementById('txDesc').oninput = (e)=>{
      const a = this.autoCat(e.target.value);
      const h = document.getElementById('txAutoHint');
      if(a){ document.getElementById('txKat').value = a.kat; document.getElementById('txTipe').value = a.tipe;
        h.innerHTML = `🤖 Terdeteksi otomatis: <b>${a.tipe}</b> → kategori <b>${a.kat}</b>`; }
      else h.textContent = '';
    };
  },
  submit(){
    const desc = document.getElementById('txDesc').value.trim();
    const nilai = Number(document.getElementById('txNilai').value);
    if(!desc || !nilai) return Toast.show('Deskripsi & jumlah wajib diisi');
    const ts = this.txs();
    ts.unshift({ id: U.uid(), desc, nilai, tgl: document.getElementById('txTgl').value,
      tipe: document.getElementById('txTipe').value, kat: document.getElementById('txKat').value.trim() || 'Lainnya' });
    this.save(ts); Modal.close(); Toast.show('Transaksi tercatat ✔'); App.navigate();
  },
  del(id){ this.save(this.txs().filter(t=>t.id!==id)); App.navigate(); },

  /* ================= KELAS ASET LENGKAP =================
   * Harga live dari sumber asli bila tersedia; aset non-pasar
   * (properti, deposito, SBN) dihitung otomatis dgn akrual/indeksasi. */
  JENIS: {
    saham:     { nama:'📈 Saham IDX', unit:'lembar', hint:'Kode emiten (BBCA, TLKM…) — harga live Yahoo Finance' },
    kripto:    { nama:'🪙 Kripto', unit:'koin', hint:'Id CoinGecko: bitcoin, ethereum, solana, tether…' },
    logam:     { nama:'🥇 Logam Mulia', unit:'gram', hint:'Emas / Perak / Platinum / Palladium — harga dunia live (PAXG & Yahoo futures) per gram' },
    valas:     { nama:'💵 Valas', unit:'unit mata uang', hint:'Kode ISO: USD, EUR, SGD, JPY, SAR… (160+ mata uang, kurs live)' },
    sbn:       { nama:'🏛 SBN / Obligasi Ritel', unit:'Rp nominal', hint:'ORI/SR/ST/FR — nilai = nominal + akrual kupon berjalan (otomatis)' },
    reksadana: { nama:'📊 Reksa Dana', unit:'unit penyertaan', hint:'NAB/unit diinput manual — perbarui dari pasardana.id / aplikasi RD Anda (tidak ada API NAB publik gratis)' },
    deposito:  { nama:'🏦 Deposito', unit:'Rp pokok', hint:'Nilai berjalan otomatis: pokok + bunga harian (netto pajak 20%)' },
    tabungan:  { nama:'💳 Tabungan Bank', unit:'Rp saldo', hint:'Bisa banyak bank — BCA, BRI, Mandiri, bank digital, e-wallet…' },
    properti:  { nama:'🏠 Properti (rumah/ruko/apartemen)', unit:'Rp nilai', hint:'Nilai appraisal + indeksasi apresiasi %/tahun otomatis' },
    tanah:     { nama:'🌾 Tanah', unit:'Rp nilai', hint:'Nilai pasar/NJOP + indeksasi apresiasi %/tahun otomatis' }
  },
  LOGAM: { emas:{lbl:'Emas', sym:null}, perak:{lbl:'Perak', sym:'SI=F'}, platinum:{lbl:'Platinum', sym:'PL=F'}, palladium:{lbl:'Palladium', sym:'PA=F'} },
  OZ: 31.1035,

  openHoldForm(){
    Modal.open(`
      <h3>＋ Tambah Aset</h3>
      <label class="fl">Kelas aset</label>
      <select id="hJenis" onchange="Income.renderHoldFields()">
        ${Object.entries(this.JENIS).map(([k,v])=>`<option value="${k}">${v.nama}</option>`).join('')}
      </select>
      <div class="hint mts" id="hHint"></div>
      <div id="hFields"></div>
      <button class="btn mt" onclick="Income.submitHold()">Simpan Aset</button>`);
    this.renderHoldFields();
  },
  renderHoldFields(){
    const j = document.getElementById('hJenis').value;
    document.getElementById('hHint').textContent = this.JENIS[j].hint;
    const F = {
      saham: `<div class="grid g2"><div><label class="fl">Kode emiten</label><input id="hKode" placeholder="BBCA"></div>
        <div><label class="fl">Jumlah lembar</label><input id="hQty" type="number" step="any"></div></div>
        <label class="fl">Harga beli rata²/lembar (Rp)</label><input id="hAvg" type="number" step="any">`,
      kripto: `<div class="grid g2"><div><label class="fl">Id CoinGecko</label><input id="hKode" placeholder="bitcoin"></div>
        <div><label class="fl">Jumlah koin</label><input id="hQty" type="number" step="any"></div></div>
        <label class="fl">Harga beli rata²/koin (Rp)</label><input id="hAvg" type="number" step="any">`,
      logam: `<div class="grid g2"><div><label class="fl">Jenis logam</label>
        <select id="hSub">${Object.entries(this.LOGAM).map(([k,v])=>`<option value="${k}">${v.lbl}</option>`).join('')}</select></div>
        <div><label class="fl">Berat (gram)</label><input id="hQty" type="number" step="any"></div></div>
        <label class="fl">Harga beli rata²/gram (Rp)</label><input id="hAvg" type="number" step="any">`,
      valas: `<div class="grid g2"><div><label class="fl">Kode mata uang (ISO)</label><input id="hKode" placeholder="USD / EUR / SGD / SAR"></div>
        <div><label class="fl">Jumlah</label><input id="hQty" type="number" step="any"></div></div>
        <label class="fl">Kurs beli rata² (Rp)</label><input id="hAvg" type="number" step="any">`,
      sbn: `<label class="fl">Seri</label><input id="hKode" placeholder="mis. ORI026 / SR021 / ST014">
        <div class="grid g3"><div><label class="fl">Nominal (Rp)</label><input id="hQty" type="number"></div>
        <div><label class="fl">Kupon %/th</label><input id="hX1" type="number" step="any" placeholder="6.3"></div>
        <div><label class="fl">Tanggal beli</label><input id="hX2" type="date"></div></div>
        <div class="hint mts">Cek kupon seri berjalan: <a href="https://www.kemenkeu.go.id/sbnritel" target="_blank">kemenkeu.go.id/sbnritel</a></div>`,
      reksadana: `<label class="fl">Nama produk</label><input id="hKode" placeholder="mis. Sucorinvest Money Market Fund">
        <div class="grid g2"><div><label class="fl">Unit penyertaan</label><input id="hQty" type="number" step="any"></div>
        <div><label class="fl">NAB/unit terkini (Rp)</label><input id="hX1" type="number" step="any"></div></div>
        <label class="fl">Modal beli total (Rp)</label><input id="hAvg" type="number" step="any">
        <div class="hint mts">Perbarui NAB berkala dari <a href="https://pasardana.id/fund" target="_blank">pasardana.id</a> (klik ✏️ di tabel)</div>`,
      deposito: `<label class="fl">Bank</label><input id="hKode" placeholder="mis. BCA / SeaBank / Krom">
        <div class="grid g3"><div><label class="fl">Pokok (Rp)</label><input id="hQty" type="number"></div>
        <div><label class="fl">Bunga %/th</label><input id="hX1" type="number" step="any" placeholder="4.0"></div>
        <div><label class="fl">Tanggal mulai</label><input id="hX2" type="date"></div></div>
        <div class="hint mts">Nilai berjalan dihitung otomatis harian, bunga netto pajak 20% (PPh final bunga deposito).</div>`,
      tabungan: `<div class="grid g2"><div><label class="fl">Bank / e-wallet</label><input id="hKode" placeholder="mis. BCA / Mandiri / GoPay"></div>
        <div><label class="fl">Saldo (Rp)</label><input id="hQty" type="number"></div></div>`,
      properti: `<label class="fl">Nama / lokasi</label><input id="hKode" placeholder="mis. Rumah Depok / Ruko Margonda">
        <div class="grid g3"><div><label class="fl">Nilai appraisal (Rp)</label><input id="hQty" type="number"></div>
        <div><label class="fl">Apresiasi %/th</label><input id="hX1" type="number" step="any" placeholder="5"></div>
        <div><label class="fl">Tanggal penilaian</label><input id="hX2" type="date"></div></div>
        <label class="fl">Harga perolehan (Rp, opsional)</label><input id="hAvg" type="number">`,
      tanah: `<label class="fl">Nama / lokasi</label><input id="hKode" placeholder="mis. Kavling Bogor 200m²">
        <div class="grid g3"><div><label class="fl">Nilai pasar/NJOP (Rp)</label><input id="hQty" type="number"></div>
        <div><label class="fl">Apresiasi %/th</label><input id="hX1" type="number" step="any" placeholder="7"></div>
        <div><label class="fl">Tanggal penilaian</label><input id="hX2" type="date"></div></div>
        <label class="fl">Harga perolehan (Rp, opsional)</label><input id="hAvg" type="number">`
    };
    document.getElementById('hFields').innerHTML = F[j];
  },
  submitHold(){
    const jenis = document.getElementById('hJenis').value;
    const g = id => { const e = document.getElementById(id); return e ? e.value : ''; };
    const kode = (g('hKode') || (jenis==='logam' ? g('hSub') : '')).trim();
    const qty = Number(g('hQty'));
    if((jenis!=='logam' && !kode) || !qty) return Toast.show('Lengkapi data aset');
    const hs = this.holds();
    hs.push({ id: U.uid(), jenis, kode: jenis==='logam' ? g('hSub') : kode.toUpperCase(),
      label: jenis==='logam' ? this.LOGAM[g('hSub')].lbl : kode,
      qty, avg: Number(g('hAvg'))||0, x1: Number(g('hX1'))||0, x2: g('hX2')||'' });
    this.saveHolds(hs); Modal.close(); Toast.show('Aset tersimpan ✔'); App.navigate();
  },
  editNab(id){
    const hs = this.holds(); const h = hs.find(x=>x.id===id); if(!h) return;
    const v = Number(prompt(h.jenis==='reksadana' ? 'NAB/unit terbaru (Rp):' : 'Nilai terbaru (Rp):', h.jenis==='reksadana' ? h.x1 : h.qty));
    if(!v) return;
    if(h.jenis==='reksadana') h.x1 = v; else { h.qty = v; h.x2 = new Date().toISOString().slice(0,10); }
    this.saveHolds(hs); Toast.show('Diperbarui ✔'); App.navigate();
  },
  delHold(id){ this.saveHolds(this.holds().filter(h=>h.id!==id)); App.navigate(); },

  yearsSince(d){ return d ? Math.max(0, (Date.now() - new Date(d).getTime()) / 31557600000) : 0; },

  /* Valuasi per aset — live bila ada pasar, akrual/indeksasi bila tidak */
  async valuate(h, ctx){
    const t = this;
    try{
      if(h.jenis==='saham'){ const q = await API.quote(h.kode + '.JK'); return { v: q.price*h.qty, m: h.avg*h.qty, src: 'Yahoo Finance ' + U.time(q.fetchedAt), unit: q.price }; }
      if(h.jenis==='kripto'){ const d = ctx.cg.data[h.kode.toLowerCase()]; if(!d) throw new Error('id CoinGecko tidak dikenal');
        return { v: d.idr*h.qty, m: h.avg*h.qty, src: 'CoinGecko ' + U.time(ctx.cg.fetchedAt), unit: d.idr }; }
      if(h.jenis==='logam'){
        if(h.kode==='emas'){ const gpg = ctx.cg.data['pax-gold'].idr / t.OZ; return { v: gpg*h.qty, m: h.avg*h.qty, src: 'CoinGecko PAXG/gram ' + U.time(ctx.cg.fetchedAt), unit: gpg }; }
        const sym = t.LOGAM[h.kode].sym;
        const q = await API.metal(sym); // USD/oz
        const gpg = q.price * ctx.usdidr / t.OZ;
        return { v: gpg*h.qty, m: h.avg*h.qty, src: `Yahoo ${sym} × kurs ` + U.time(q.fetchedAt), unit: gpg };
      }
      if(h.jenis==='valas'){ const r = ctx.fx.rates[h.kode]; if(!r) throw new Error('kode mata uang tidak dikenal');
        const idr = ctx.fx.rates.IDR / r;
        return { v: idr*h.qty, m: h.avg*h.qty, src: 'ExchangeRate-API ' + U.time(ctx.fx.fetchedAt), unit: idr }; }
      if(h.jenis==='sbn'){ const acc = h.qty * (h.x1/100) * t.yearsSince(h.x2);
        return { v: h.qty + acc, m: h.qty, src: `nominal + akrual kupon ${h.x1}%/th (otomatis)`, unit: null }; }
      if(h.jenis==='reksadana'){ return { v: h.x1*h.qty, m: h.avg||0, src: 'NAB manual — perbarui via ✏️ (pasardana.id)', unit: h.x1 }; }
      if(h.jenis==='deposito'){ const acc = h.qty * (h.x1/100) * 0.8 * t.yearsSince(h.x2);
        return { v: h.qty + acc, m: h.qty, src: `pokok + bunga ${h.x1}%/th netto pajak 20% (otomatis harian)`, unit: null }; }
      if(h.jenis==='tabungan'){ return { v: h.qty, m: h.qty, src: 'saldo nominal', unit: null }; }
      if(h.jenis==='properti' || h.jenis==='tanah'){
        const v = h.qty * Math.pow(1 + (h.x1||0)/100, t.yearsSince(h.x2));
        return { v, m: h.avg||h.qty, src: `appraisal ${h.x2?U.dt(h.x2):''} + indeks ${h.x1||0}%/th (otomatis)`, unit: null }; }
      return { v: h.qty, m: h.avg||0, src: 'nominal', unit: null };
    }catch(e){ return { v: null, m: h.avg*h.qty||h.qty, src: 'gagal: ' + e.message, unit: null }; }
  }
};

App.register('income', 'Income', function(el){
  const ts = Income.txs();
  const now = new Date(); const bulanIni = t => { const d = new Date(t.tgl); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); };
  const sum = (arr)=>arr.reduce((s,t)=>s+t.nilai,0);
  const masuk = sum(ts.filter(t=>t.tipe==='Pemasukan' && bulanIni(t)));
  const keluar = sum(ts.filter(t=>t.tipe==='Pengeluaran' && bulanIni(t)));
  const invest = sum(ts.filter(t=>(t.tipe==='Pos Investasi'||t.tipe==='Penempatan Aset') && bulanIni(t)));

  const byKat = {};
  ts.filter(bulanIni).forEach(t=>{ const key = t.tipe+'|'+t.kat; byKat[key]=(byKat[key]||0)+t.nilai; });

  let body = '';
  if(Income.tab==='transaksi'){
    body = `
      <div class="card">
        <div class="row between mb wrap"><h3 style="margin:0">📒 Transaksi (${U.months[now.getMonth()]})</h3>
          <button class="btn sm" onclick="Income.openForm()">＋ Catat</button></div>
        ${ts.length ? `<div style="overflow-x:auto"><table>
          <tr><th>Tanggal</th><th>Deskripsi</th><th>Kategori</th><th>Tipe</th><th class="num">Jumlah</th><th></th></tr>
          ${ts.slice(0,50).map(t=>`<tr>
            <td>${U.dt(t.tgl)}</td><td><b>${U.esc(t.desc)}</b></td><td>${U.esc(t.kat)}</td>
            <td><span class="badge ${t.tipe==='Pemasukan'?'b-grn':t.tipe==='Pengeluaran'?'b-red':t.tipe==='Mutasi Aset'?'b-cyn':'b-pur'}">${t.tipe}</span></td>
            <td class="num ${t.tipe==='Pemasukan'?'up':t.tipe==='Pengeluaran'?'down':''}">${t.tipe==='Pengeluaran'?'−':t.tipe==='Pemasukan'?'+':''}${U.rp(t.nilai)}</td>
            <td><button class="btn ghost sm" onclick="Income.del('${t.id}')">🗑</button></td></tr>`).join('')}
        </table></div>` : `<div class="empty">Belum ada transaksi. Klik ＋ Catat — kategori & tipe akan terdeteksi <b>otomatis</b> dari deskripsi.</div>`}
      </div>
      <div class="card mt">
        <h3>🧩 Kategorisasi Otomatis — bulan ini</h3>
        ${Object.keys(byKat).length ? Object.entries(byKat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{
          const [tipe,kat]=k.split('|'); const tot = tipe==='Pemasukan'?masuk:(tipe==='Pengeluaran'?keluar:invest)||1;
          return `<div class="mts"><div class="row between"><span><span class="badge ${tipe==='Pemasukan'?'b-grn':tipe==='Pengeluaran'?'b-red':'b-pur'}" style="margin-right:6px">${tipe}</span>${U.esc(kat)}</span><b>${U.rp(v)}</b></div>
          <div class="bar-wrap mts"><div class="bar" style="width:${U.clamp(v/tot*100,2,100)}%;background:${tipe==='Pemasukan'?'var(--grn)':tipe==='Pengeluaran'?'var(--red)':'var(--pur)'}"></div></div></div>`; }).join('')
        : `<div class="empty">Belum ada data bulan ini.</div>`}
      </div>`;
  } else {
    const hs = Income.holds();
    body = `
      <div class="card">
        <div class="row between mb wrap"><h3 style="margin:0">💼 Semua Kelas Aset — ${Object.keys(Income.JENIS).length} jenis <span class="badge badge-live">REALTIME/OTOMATIS</span></h3>
          <button class="btn sm" onclick="Income.openHoldForm()">＋ Aset</button></div>
        <div class="pill-row mb">${Object.values(Income.JENIS).map(j=>`<span class="badge b-mut">${j.nama}</span>`).join('')}</div>
        <div id="holdTable">${hs.length?loadingBox('Menghitung nilai seluruh aset (harga live + akrual/indeksasi otomatis)…'):`<div class="empty">Belum ada aset.<br>Tambahkan saham, kripto, 4 logam mulia, valas, SBN, reksa dana, deposito, tabungan multi-bank, properti, hingga tanah — nilai dihitung otomatis.</div>`}</div>
      </div>`;
  }

  el.innerHTML = `
    <div class="grid g4 mb">
      <div class="stat"><div class="lbl">Pemasukan bulan ini</div><div class="val up">${U.rp(masuk)}</div></div>
      <div class="stat"><div class="lbl">Pengeluaran bulan ini</div><div class="val down">${U.rp(keluar)}</div></div>
      <div class="stat"><div class="lbl">Pos Investasi + Penempatan</div><div class="val" style="color:var(--pur)">${U.rp(invest)}</div></div>
      <div class="stat"><div class="lbl">Arus kas bersih</div><div class="val ${masuk-keluar-invest>=0?'up':'down'}">${U.rp(masuk-keluar-invest)}</div></div>
    </div>
    <div class="tabs">
      <button class="tab ${Income.tab==='transaksi'?'active':''}" onclick="Income.setTab('transaksi')">📒 Transaksi</button>
      <button class="tab ${Income.tab==='aset'?'active':''}" onclick="Income.setTab('aset')">💼 Aset (${Income.holds().length})</button>
    </div>
    ${body}`;

  if(Income.tab==='aset' && Income.holds().length){
    (async ()=>{
      const hs = Income.holds();
      const box = document.getElementById('holdTable');
      try{
        const needCg = hs.some(h=>h.jenis==='kripto' || (h.jenis==='logam'&&h.kode==='emas'));
        const needFx = hs.some(h=>['valas'].includes(h.jenis) || (h.jenis==='logam'&&h.kode!=='emas'));
        const [cg, fx] = await Promise.all([
          needCg ? API.cryptoGold() : null,
          needFx ? API.fx() : null
        ]);
        const ctx = { cg, fx, usdidr: fx ? fx.rates.IDR : null };
        const rows = await Promise.all(hs.map(async h=>({ h, r: await Income.valuate(h, ctx) })));
        const total = rows.reduce((s,x)=>s+(x.r.v||0),0);
        const totalModal = rows.reduce((s,x)=>s+(x.r.m||0),0);
        // alokasi per kelas
        const byJenis = {};
        rows.forEach(x=>{ byJenis[x.h.jenis] = (byJenis[x.h.jenis]||0) + (x.r.v||0); });
        box.innerHTML = `
          <div class="grid g2 mb">
            <div class="stat"><div class="lbl">Total nilai seluruh aset</div><div class="val">${U.rp(total)}</div></div>
            <div class="stat"><div class="lbl">Untung/Rugi vs modal</div><div class="val ${total-totalModal>=0?'up':'down'}">${U.rp(total-totalModal)} (${totalModal?U.num((total-totalModal)/totalModal*100,1):0}%)</div></div>
          </div>
          <div class="mb">
            ${Object.entries(byJenis).sort((a,b)=>b[1]-a[1]).map(([j,v])=>`
              <div class="row between mts"><span>${Income.JENIS[j].nama}</span><b>${U.rp(v)} <span class="hint">(${total?U.num(v/total*100,1):0}%)</span></b></div>
              <div class="bar-wrap mts"><div class="bar" style="width:${total?U.clamp(v/total*100,1,100):0}%"></div></div>`).join('')}
          </div>
          <div style="overflow-x:auto"><table>
          <tr><th>Aset</th><th class="num">Unit</th><th class="num">Harga/unit</th><th class="num">Nilai kini</th><th class="num">±</th><th>Metode & sumber</th><th></th></tr>
          ${rows.map(({h,r})=>`<tr>
            <td><b>${U.esc(h.label||h.kode)}</b><div class="hint">${Income.JENIS[h.jenis].nama}</div></td>
            <td class="num">${U.num(h.qty)}</td>
            <td class="num">${r.unit!=null?U.rp(r.unit,2):'—'}</td>
            <td class="num"><b>${r.v!=null?U.rp(r.v):'—'}</b></td>
            <td class="num ${r.v-r.m>=0?'up':'down'}">${r.m&&r.v!=null?U.num((r.v-r.m)/r.m*100,1)+'%':'—'}</td>
            <td class="hint">${U.esc(r.src)}</td>
            <td class="row" style="gap:4px">
              ${['reksadana','properti','tanah','tabungan'].includes(h.jenis)?`<button class="btn ghost sm" title="Perbarui nilai/NAB" onclick="Income.editNab('${h.id}')">✏️</button>`:''}
              <button class="btn ghost sm" onclick="Income.delHold('${h.id}')">🗑</button></td></tr>`).join('')}
          </table></div>
          ${SRC('Yahoo Finance (saham & futures logam) · CoinGecko (kripto, PAXG) · ExchangeRate-API (160+ valas) · akrual/indeksasi otomatis utk SBN/deposito/properti/tanah', 'https://finance.yahoo.com')}`;
      }catch(e){ box.innerHTML = errorBox(e.message); }
    })();
  }
});
