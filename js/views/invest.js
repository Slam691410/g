/* ========== Tujuan Investasi — lengkap: target, proyeksi, setoran bulanan, progres ========== */
const Invest = {
  goals(){ return DB.get('goals', []); },
  save(g){ DB.set('goals', g); },
  INSTRUMEN: [
    { id: 'deposito', nama: 'Deposito', ret: 4.0, risk: 'Rendah' },
    { id: 'sbn', nama: 'SBN Ritel (ORI/ST/SR)', ret: 6.3, risk: 'Rendah' },
    { id: 'rdpu', nama: 'Reksa Dana Pasar Uang', ret: 4.5, risk: 'Rendah' },
    { id: 'rdpt', nama: 'RD Pendapatan Tetap', ret: 6.0, risk: 'Menengah' },
    { id: 'emas', nama: 'Emas', ret: 8.0, risk: 'Menengah' },
    { id: 'indeks', nama: 'RD Indeks / ETF Saham', ret: 9.0, risk: 'Tinggi' },
    { id: 'saham', nama: 'Saham (rata² IHSG jangka panjang)', ret: 10.0, risk: 'Tinggi' }
  ],

  bulanKe(target){ return Math.max(1, Math.round((new Date(target) - new Date()) / (30.44*864e5))); },
  setoranBulanan(target, awal, bulan, retTahunan){
    const i = retTahunan/100/12;
    const fvAwal = awal * Math.pow(1+i, bulan);
    const sisa = Math.max(0, target - fvAwal);
    if(i===0) return sisa/bulan;
    return sisa * i / (Math.pow(1+i, bulan) - 1);
  },

  /* ---- Katalog tujuan investasi — kehidupan itu banyak tujuannya ----
   * Catatan: Dana Darurat dihitung di menu KHL (bukan di sini);
   * Dana Pensiun, Waris & Hibah ada di menu Legacy. */
  TEMPLATES: [
    { id:'nikah', ic:'💍', nama:'Menikah', kat:'Keluarga', th:3, inst:'rdpt', target:100000000, note:'Estimasi resepsi sederhana-menengah — sangat bervariasi, sesuaikan' },
    { id:'melahirkan', ic:'👶', nama:'Dana Melahirkan', kat:'Keluarga', th:1, inst:'rdpu', target:25000000, note:'Persalinan + kontrol kehamilan (bisa lebih rendah dgn BPJS)' },
    { id:'dprumah', ic:'🏠', nama:'DP Rumah (20%)', kat:'Properti', th:5, inst:'rdpt', target:150000000, note:'DP 20% utk rumah ±Rp750 jt — sesuaikan harga di kotamu' },
    { id:'renov', ic:'🛠', nama:'Renovasi Rumah', kat:'Properti', th:3, inst:'rdpt', target:50000000 },
    { id:'mobil', ic:'🚗', nama:'Mobil', kat:'Kendaraan', th:5, inst:'rdpt', target:250000000 },
    { id:'motor', ic:'🏍', nama:'Motor', kat:'Kendaraan', th:2, inst:'rdpu', target:25000000 },
    { id:'haji', ic:'🕋', nama:'Haji', kat:'Ibadah', th:10, inst:'rdpt', target:95000000, note:'BPIH 2025 ±Rp89–94 jt (Kemenag; setoran awal Rp25 jt utk antre porsi — antrean bisa belasan tahun)' },
    { id:'umroh', ic:'🕌', nama:'Umroh', kat:'Ibadah', th:2, inst:'rdpu', target:35000000, note:'Biaya referensi umroh ±Rp30–40 jt (paket standar)' },
    { id:'kurban', ic:'🐐', nama:'Kurban Tahunan', kat:'Ibadah', th:1, inst:'rdpu', target:5000000 },
    { id:'liburan', ic:'✈️', nama:'Liburan', kat:'Gaya Hidup', th:1, inst:'rdpu', target:20000000 },
    { id:'gadget', ic:'💻', nama:'Gadget / Laptop', kat:'Gaya Hidup', th:1, inst:'rdpu', target:15000000 },
    { id:'usaha', ic:'🏪', nama:'Modal Usaha', kat:'Produktif', th:3, inst:'rdpt', target:50000000 },
    { id:'s2', ic:'📚', nama:'Pendidikan Diri (S2/Sertifikasi)', kat:'Produktif', th:4, inst:'indeks', target:60000000 },
    { id:'sehat', ic:'🏥', nama:'Dana Kesehatan Orang Tua', kat:'Keluarga', th:2, inst:'rdpu', target:30000000 },
    { id:'wakaf', ic:'🤲', nama:'Wakaf / Sedekah Besar', kat:'Sosial', th:10, inst:'indeks', target:100000000 }
  ],
  openTemplates(){
    const kats = [...new Set(this.TEMPLATES.map(t=>t.kat))];
    Modal.open(`
      <h3>🗂 Katalog Tujuan Investasi (${this.TEMPLATES.length} template + otomatis)</h3>
      <div class="hint">Hidup punya banyak tujuan — haji, kurban, liburan, rumah, kendaraan, usaha, dan banyak lagi. Pilih; angka default terisi (estimasi awal, bisa diedit). <b>Dana Darurat</b> dihitung di menu KHL · <b>Dana Pensiun/Waris/Hibah</b> di menu Legacy.</div>
      <div class="row wrap mt">
        <button class="btn grn sm" onclick="Invest.autoEdu()">🎓 Otomatis: Dana Pendidikan per Anak (dari Profil)</button>
        <button class="btn ghost sm" onclick="Modal.close();location.hash='#/legacy'">👴 Dana Pensiun → menu Legacy</button>
      </div>
      ${kats.map(k=>`
        <div class="nav-sec" style="padding-left:0">${k}</div>
        <div class="pill-row">
          ${this.TEMPLATES.filter(t=>t.kat===k).map(t=>`
            <button class="btn ghost sm" title="${U.esc(t.note||'')}" onclick="Invest.createTemplate('${t.id}')">${t.ic} ${t.nama}</button>`).join('')}
        </div>`).join('')}`);
  },
  createTemplate(id){
    const t = this.TEMPLATES.find(x=>x.id===id); if(!t) return;
    const target = t.hitung ? t.hitung() : t.target;
    const d = new Date(); d.setFullYear(d.getFullYear()+t.th);
    const gs = this.goals();
    gs.push({ id:U.uid(), at:new Date().toISOString(), nama:t.ic+' '+t.nama, kat:t.kat, target: Math.round(target),
      tgl: d.toISOString().slice(0,10), awal:0, now:0, inst:t.inst, note:t.note||'' });
    this.save(gs); Modal.close();
    Toast.show(t.nama+' dibuat — sesuaikan target via ✏️ Edit'); App.navigate();
  },
  /* 🎓 Generator otomatis: satu tujuan per jenjang per anak, dari tanggal lahir (data Profil/KHL),
     target = biaya jenjang × inflasi pendidikan ±10%/th (riset umum inflasi biaya pendidikan ID) */
  autoEdu(){
    const anak = DB.get('khl_anak', []);
    if(!anak.length) return Toast.show('Isi data anak dulu di menu Profil 👨‍👩‍👧');
    const gs = this.goals();
    let n = 0;
    for(const a of anak){
      const { path } = KHL.eduPath(a);
      for(const p of path){
        if(p.sedang) continue; // yang berjalan dibiayai dari cashflow (modul KHL)
        const nama = `🎓 ${a.nama} — ${p.j.nama}`;
        if(gs.some(g=>g.nama===nama)) continue;
        const biayaNow = (a.sek==='swasta' ? p.j.biayaSwasta : p.j.biayaNegeri) * p.j.lama;
        const target = biayaNow * Math.pow(1.10, p.tahunMulai);
        const d = new Date(); d.setFullYear(d.getFullYear() + Math.max(1, p.tahunMulai));
        gs.push({ id:U.uid(), at:new Date().toISOString(), nama, kat:'Pendidikan Anak', target: Math.round(target/100000)*100000,
          tgl: d.toISOString().slice(0,10), awal:0, now:0, inst: p.tahunMulai>=5?'indeks':'rdpt',
          note:`Auto dari tanggal lahir: masuk ~${p.tahunMulai} th lagi · biaya kini ${U.rp(biayaNow)} × inflasi pendidikan 10%/th` });
        n++;
      }
    }
    this.save(gs); Modal.close();
    Toast.show(n ? n+' tujuan Dana Pendidikan dibuat otomatis 🎓' : 'Semua tujuan pendidikan sudah ada'); App.navigate();
  },

  openForm(id){
    const g = id ? this.goals().find(x=>x.id===id) : null;
    Modal.open(`
      <h3>${g?'✏️ Edit':'🎯 Buat'} Tujuan Investasi</h3>
      <label class="fl">Nama tujuan</label><input id="gNama" value="${g?U.esc(g.nama):''}" placeholder="mis. DP Rumah, Dana Pendidikan, Pensiun">
      <div class="grid g2">
        <div><label class="fl">Target dana (Rp)</label><input id="gTarget" type="number" value="${g?g.target:''}" placeholder="100000000"></div>
        <div><label class="fl">Tanggal target</label><input id="gTgl" type="date" value="${g?g.tgl:''}"></div>
      </div>
      <div class="grid g2">
        <div><label class="fl">Dana awal (Rp)</label><input id="gAwal" type="number" value="${g?g.awal:0}"></div>
        <div><label class="fl">Terkumpul saat ini (Rp)</label><input id="gNow" type="number" value="${g?g.now:0}"></div>
      </div>
      <label class="fl">Instrumen (menentukan asumsi imbal hasil)</label>
      <select id="gInst">${this.INSTRUMEN.map(i=>`<option value="${i.id}" ${g&&g.inst===i.id?'selected':''}>${i.nama} — ~${i.ret}%/th (risiko ${i.risk})</option>`).join('')}</select>
      <div class="hint mts">Asumsi imbal hasil: SBN ≈ kupon seri ritel terakhir (cek <a href="https://www.kemenkeu.go.id/sbnritel" target="_blank">kemenkeu.go.id/sbnritel</a>); saham ≈ rata² historis IHSG jangka panjang. Sesuaikan sendiri bila perlu.</div>
      <div class="row mt between">
        <button class="btn" onclick="Invest.submit('${id||''}')">${g?'Simpan':'Buat Tujuan'}</button>
        ${g?`<button class="btn red" onclick="Invest.del('${id}')">Hapus</button>`:''}
      </div>`);
  },
  submit(id){
    const nama = document.getElementById('gNama').value.trim();
    const target = Number(document.getElementById('gTarget').value);
    const tgl = document.getElementById('gTgl').value;
    if(!nama||!target||!tgl) return Toast.show('Nama, target & tanggal wajib diisi');
    if(new Date(tgl) <= new Date()) return Toast.show('Tanggal target harus di masa depan');
    const val = { nama, target, tgl, awal: Number(document.getElementById('gAwal').value)||0,
      now: Number(document.getElementById('gNow').value)||0, inst: document.getElementById('gInst').value };
    const gs = this.goals();
    if(id){ Object.assign(gs.find(x=>x.id===id), val); }
    else gs.push(Object.assign({ id: U.uid(), at: new Date().toISOString() }, val));
    this.save(gs); Modal.close(); Toast.show('Tujuan tersimpan 🎯'); App.navigate();
  },
  del(id){ if(!confirm('Hapus tujuan?')) return; this.save(this.goals().filter(g=>g.id!==id)); Modal.close(); App.navigate(); },
  topup(id){
    const v = Number(prompt('Tambah dana terkumpul (Rp):')); if(!v) return;
    const gs = this.goals(); const g = gs.find(x=>x.id===id); g.now = (g.now||0)+v; this.save(gs); App.navigate();
  }
};

App.register('invest', 'Tujuan Investasi', function(el){
  const gs = Invest.goals();
  const totTarget = gs.reduce((s,g)=>s+g.target,0);
  const totNow = gs.reduce((s,g)=>s+(g.now||0),0);

  el.innerHTML = `
    <div class="grid g3 mb">
      <div class="stat"><div class="lbl">Jumlah tujuan</div><div class="val">${gs.length}</div></div>
      <div class="stat"><div class="lbl">Total target</div><div class="val">${U.rp(totTarget)}</div></div>
      <div class="stat"><div class="lbl">Total terkumpul</div><div class="val up">${U.rp(totNow)} <span class="hint">(${totTarget?U.num(totNow/totTarget*100,0):0}%)</span></div></div>
    </div>
    <div class="row between mb wrap">
      <div class="sub">Hidup punya banyak tujuan — pakai katalog agar tak ada yang terlewat: pendidikan tiap anak, pensiun, haji, rumah, dana darurat, dst.</div>
      <div class="row wrap">
        <button class="btn pur" onclick="Invest.openTemplates()">🗂 Katalog Tujuan (${Invest.TEMPLATES.length}+)</button>
        <button class="btn" onclick="Invest.openForm()">＋ Buat Manual</button>
      </div>
    </div>
    ${gs.length ? `<div class="grid g2">${gs.map(g=>{
      const inst = Invest.INSTRUMEN.find(i=>i.id===g.inst) || Invest.INSTRUMEN[0];
      const bulan = Invest.bulanKe(g.tgl);
      const setoran = Invest.setoranBulanan(g.target, (g.awal||0)+(g.now||0), bulan, inst.ret);
      const prog = U.clamp((g.now||0)/g.target*100, 0, 100);
      const onTrackNow = ((g.awal||0)+(g.now||0));
      return `<div class="card">
        <div class="row between wrap">
          <b style="font-size:15px">${U.esc(g.nama)}</b>
          <span class="row" style="gap:4px">${g.kat?`<span class="badge b-cyn">${U.esc(g.kat)}</span>`:''}
          <span class="badge ${inst.risk==='Rendah'?'b-grn':inst.risk==='Menengah'?'b-yel':'b-red'}">${inst.nama}</span></span>
        </div>
        ${g.note?`<div class="hint mts">${U.esc(g.note)}</div>`:''}
        <div class="row between mt"><span class="sub">Target ${U.dt(g.tgl)} (${bulan} bln lagi)</span><b>${U.rp(g.target)}</b></div>
        <div class="bar-wrap mt" style="height:12px"><div class="bar" style="width:${prog}%"></div></div>
        <div class="row between mts"><span class="hint">Terkumpul ${U.rp(g.now||0)}</span><span class="hint">${U.num(prog,1)}%</span></div>
        <div class="alert info mt">
          Setoran rutin yang dibutuhkan: <b>${U.rp(Math.ceil(setoran/1000)*1000)}/bulan</b><br>
          <span class="hint">asumsi ${inst.ret}%/th majemuk bulanan · dana awal ${U.rp(onTrackNow)} ikut tumbuh</span>
        </div>
        <div class="row mt">
          <button class="btn grn sm" onclick="Invest.topup('${g.id}')">＋ Setor</button>
          <button class="btn ghost sm" onclick="Invest.openForm('${g.id}')">✏️ Edit</button>
        </div>
      </div>`; }).join('')}</div>`
    : `<div class="empty">Belum ada tujuan investasi.<br>Buka <b>🗂 Katalog Tujuan</b> — ${Invest.TEMPLATES.length} template (menikah, haji, umroh, kurban, liburan, DP rumah, kendaraan, modal usaha, dll) + generator otomatis <b>Dana Pendidikan per anak</b> (dari tanggal lahir di Profil).<br><span class="hint">Dana Darurat → menu KHL · Dana Pensiun, Waris & Hibah → menu Legacy.</span></div>`}`;
});
