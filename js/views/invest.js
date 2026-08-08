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
      <div class="sub">Rencana lengkap: target → setoran bulanan otomatis (dengan bunga majemuk) → pantau progres.</div>
      <button class="btn" onclick="Invest.openForm()">＋ Buat Tujuan</button>
    </div>
    ${gs.length ? `<div class="grid g2">${gs.map(g=>{
      const inst = Invest.INSTRUMEN.find(i=>i.id===g.inst) || Invest.INSTRUMEN[0];
      const bulan = Invest.bulanKe(g.tgl);
      const setoran = Invest.setoranBulanan(g.target, (g.awal||0)+(g.now||0), bulan, inst.ret);
      const prog = U.clamp((g.now||0)/g.target*100, 0, 100);
      const onTrackNow = ((g.awal||0)+(g.now||0));
      return `<div class="card">
        <div class="row between wrap">
          <b style="font-size:15px">🎯 ${U.esc(g.nama)}</b>
          <span class="badge ${inst.risk==='Rendah'?'b-grn':inst.risk==='Menengah'?'b-yel':'b-red'}">${inst.nama}</span>
        </div>
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
    : `<div class="empty">Belum ada tujuan investasi.<br>Contoh: DP Rumah 5 tahun, Dana Pendidikan anak (sinkron dengan modul KHL), Dana Pensiun.</div>`}`;
});
