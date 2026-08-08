/* ========== Income: catat & auto-kategorisasi transaksi + aset dengan harga REALTIME ========== */
const Income = {
  tab: DB.get('income_tab', 'transaksi'),
  txs(){ return DB.get('txs', []); },
  save(t){ DB.set('txs', t); },
  holds(){ return DB.get('holdings', []); },
  saveHolds(h){ DB.set('holdings', h); },
  setTab(t){ this.tab = t; DB.set('income_tab', t); App.navigate(); },

  TIPE: ['Pemasukan','Pengeluaran','Penempatan Aset','Mutasi Aset','Pos Investasi'],
  /* Aturan auto-kategorisasi berdasar kata kunci (bisa dipelajari dari kebiasaan) */
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

  openHoldForm(){
    Modal.open(`
      <h3>＋ Tambah Aset (harga realtime)</h3>
      <label class="fl">Jenis aset</label>
      <select id="hJenis" onchange="Income.holdHint()">
        <option value="saham">Saham IDX (Yahoo Finance)</option>
        <option value="crypto">Kripto (CoinGecko)</option>
        <option value="emas">Emas — gram (CoinGecko PAXG)</option>
        <option value="usd">Valas USD (ExchangeRate-API)</option>
        <option value="cash">Kas / Deposito (nilai tetap)</option>
      </select>
      <label class="fl">Kode / simbol</label><input id="hKode" placeholder="mis. BBCA">
      <div class="hint mts" id="hHint">Saham: kode emiten IDX, mis. BBCA, TLKM, ANTM.</div>
      <div class="grid g2">
        <div><label class="fl">Jumlah unit (lembar/koin/gram/USD/Rp)</label><input id="hQty" type="number" step="any"></div>
        <div><label class="fl">Harga beli rata² per unit (Rp)</label><input id="hAvg" type="number" step="any"></div>
      </div>
      <button class="btn mt" onclick="Income.submitHold()">Simpan Aset</button>`);
  },
  holdHint(){
    const j = document.getElementById('hJenis').value;
    document.getElementById('hHint').textContent = {
      saham: 'Saham: kode emiten IDX, mis. BBCA, TLKM, ANTM.',
      crypto: 'Kripto: id CoinGecko — bitcoin, ethereum, solana, tether.',
      emas: 'Emas: isi kode "EMAS" — dihargai dari PAXG (1 oz = 31,1035 gr).',
      usd: 'Valas: isi kode "USD" — unit dalam USD.',
      cash: 'Kas: isi kode bebas, unit = nilai rupiah, harga rata² = 1.'
    }[j];
  },
  submitHold(){
    const jenis = document.getElementById('hJenis').value;
    const kode = document.getElementById('hKode').value.trim().toUpperCase();
    const qty = Number(document.getElementById('hQty').value);
    if(!kode || !qty) return Toast.show('Kode & jumlah wajib diisi');
    const hs = this.holds();
    hs.push({ id: U.uid(), jenis, kode, qty, avg: Number(document.getElementById('hAvg').value)||0 });
    this.saveHolds(hs); Modal.close(); App.navigate();
  },
  delHold(id){ this.saveHolds(this.holds().filter(h=>h.id!==id)); App.navigate(); }
};

App.register('income', 'Income', function(el){
  const ts = Income.txs();
  const now = new Date(); const bulanIni = t => { const d = new Date(t.tgl); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); };
  const sum = (arr)=>arr.reduce((s,t)=>s+t.nilai,0);
  const masuk = sum(ts.filter(t=>t.tipe==='Pemasukan' && bulanIni(t)));
  const keluar = sum(ts.filter(t=>t.tipe==='Pengeluaran' && bulanIni(t)));
  const invest = sum(ts.filter(t=>(t.tipe==='Pos Investasi'||t.tipe==='Penempatan Aset') && bulanIni(t)));

  // breakdown kategori
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
        <div class="row between mb wrap"><h3 style="margin:0">💼 Aset & Penempatan — harga <span class="badge badge-live">REALTIME</span></h3>
          <button class="btn sm" onclick="Income.openHoldForm()">＋ Aset</button></div>
        <div id="holdTable">${hs.length?loadingBox('Mengambil harga terkini dari Yahoo Finance / CoinGecko / ExchangeRate-API…'):`<div class="empty">Belum ada aset. Tambahkan saham, kripto, emas, valas, atau kas — nilainya dihargai realtime dari sumber asli.</div>`}</div>
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
      <button class="tab ${Income.tab==='aset'?'active':''}" onclick="Income.setTab('aset')">💼 Aset (Realtime)</button>
    </div>
    ${body}`;

  if(Income.tab==='aset' && Income.holds().length){
    (async ()=>{
      const hs = Income.holds();
      const box = document.getElementById('holdTable');
      try{
        const needFx = hs.some(h=>['crypto','emas','usd'].includes(h.jenis));
        const [cg, fx] = await Promise.all([
          hs.some(h=>['crypto','emas'].includes(h.jenis)) ? API.cryptoGold() : null,
          needFx ? API.fx() : null
        ]);
        const usdidr = fx ? fx.rates.IDR : null;
        const rows = await Promise.all(hs.map(async h=>{
          let price = null, src = '';
          try{
            if(h.jenis==='saham'){ const q = await API.quote(h.kode + '.JK'); price = q.price; src = 'Yahoo Finance ' + U.time(q.fetchedAt); }
            else if(h.jenis==='crypto'){ const d = cg.data[h.kode.toLowerCase()]; price = d ? d.idr : null; src = 'CoinGecko ' + U.time(cg.fetchedAt); }
            else if(h.jenis==='emas'){ const g = cg.data['pax-gold']; price = g ? g.idr/31.1035 : null; src = 'CoinGecko PAXG/gram ' + U.time(cg.fetchedAt); }
            else if(h.jenis==='usd'){ price = usdidr; src = 'ExchangeRate-API ' + U.time(fx.fetchedAt); }
            else { price = 1; src = 'nilai nominal'; }
          }catch(e){ src = 'gagal: ' + e.message; }
          const nilai = price!=null ? price*h.qty : null;
          const modal = h.avg*h.qty;
          return { h, price, nilai, modal, src };
        }));
        const total = rows.reduce((s,r)=>s+(r.nilai||0),0);
        const totalModal = rows.reduce((s,r)=>s+(r.modal||0),0);
        box.innerHTML = `
          <div class="grid g2 mb">
            <div class="stat"><div class="lbl">Total nilai aset (realtime)</div><div class="val">${U.rp(total)}</div></div>
            <div class="stat"><div class="lbl">Untung/Rugi vs modal</div><div class="val ${total-totalModal>=0?'up':'down'}">${U.rp(total-totalModal)} (${totalModal?U.num((total-totalModal)/totalModal*100,1):0}%)</div></div>
          </div>
          <div style="overflow-x:auto"><table>
          <tr><th>Aset</th><th class="num">Unit</th><th class="num">Harga kini</th><th class="num">Nilai</th><th class="num">±</th><th>Sumber</th><th></th></tr>
          ${rows.map(r=>`<tr>
            <td><b>${U.esc(r.h.kode)}</b> <span class="hint">${r.h.jenis}</span></td>
            <td class="num">${U.num(r.h.qty)}</td>
            <td class="num">${r.price!=null?U.rp(r.price,2):'—'}</td>
            <td class="num"><b>${r.nilai!=null?U.rp(r.nilai):'—'}</b></td>
            <td class="num ${r.nilai-r.modal>=0?'up':'down'}">${r.modal&&r.nilai!=null?U.num((r.nilai-r.modal)/r.modal*100,1)+'%':'—'}</td>
            <td class="hint">${U.esc(r.src)}</td>
            <td><button class="btn ghost sm" onclick="Income.delHold('${r.h.id}')">🗑</button></td></tr>`).join('')}
          </table></div>
          ${SRC('Yahoo Finance · CoinGecko · ExchangeRate-API (harga langsung dari sumber)', 'https://finance.yahoo.com')}`;
      }catch(e){ box.innerHTML = errorBox(e.message); }
    })();
  }
});
