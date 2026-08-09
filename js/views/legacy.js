/* ========== Legacy: Waris, Hibah & Dana Pensiun ========== */
const Legacy = {
  tab: DB.get('legacy_tab', 'pensiun'),
  setTab(t){ this.tab = t; DB.set('legacy_tab', t); App.navigate(); },

  /* ---- Dana Pensiun ---- */
  pensiun(){
    const p = getProfile();
    const kc = DB.get('khl_cfg', {});
    const ts = DB.get('txs', []);
    const now = new Date();
    const out3 = ts.filter(t=>t.tipe==='Pengeluaran' && (now - new Date(t.tgl)) < 92*864e5).reduce((s,t)=>s+t.nilai,0)/3;
    return DB.get('pensiun', {
      usiaPensiun: 55,
      bulanan: Math.round(out3 || (kc.gaji||5000000)*0.7),
      terkumpul: 0, ret: 9
    });
  },
  savePensiun(){
    DB.set('pensiun', {
      usiaPensiun: Number(document.getElementById('pnUsia').value)||55,
      bulanan: Number(document.getElementById('pnBulanan').value)||0,
      terkumpul: Number(document.getElementById('pnKumpul').value)||0,
      ret: Number(document.getElementById('pnRet').value)||9
    });
    App.navigate();
  },

  /* ---- Waris ---- */
  waris(){ return DB.get('waris', { harta: 0, ahli: [], docs: {} }); },
  saveWaris(w){ DB.set('waris', w); },
  addAhli(){
    Modal.open(`
      <h3>＋ Ahli Waris</h3>
      <label class="fl">Nama</label><input id="awNama">
      <div class="grid g2">
        <div><label class="fl">Hubungan</label>
          <select id="awHub"><option>Istri/Suami</option><option>Anak laki-laki</option><option>Anak perempuan</option><option>Ayah</option><option>Ibu</option><option>Saudara</option><option>Lainnya</option></select></div>
        <div><label class="fl">Porsi (%)</label><input id="awPorsi" type="number" step="any" placeholder="mis. 12.5"></div>
      </div>
      <button class="btn mt" onclick="Legacy.submitAhli()">Simpan</button>
      <div class="hint mt">Rujukan pembagian: hukum waris Islam (faraid/KHI — mis. istri 1/8 bila ada anak; anak laki : perempuan = 2 : 1), KUHPerdata, atau kesepakatan keluarga. Konsultasikan ke notaris/ahli waris utk keabsahan.</div>`);
  },
  submitAhli(){
    const nama = document.getElementById('awNama').value.trim();
    if(!nama) return Toast.show('Nama wajib diisi');
    const w = this.waris();
    w.ahli.push({ id: U.uid(), nama, hub: document.getElementById('awHub').value, porsi: Number(document.getElementById('awPorsi').value)||0 });
    this.saveWaris(w); Modal.close(); App.navigate();
  },
  delAhli(id){ const w=this.waris(); w.ahli=w.ahli.filter(a=>a.id!==id); this.saveWaris(w); App.navigate(); },
  setHarta(v){ const w=this.waris(); w.harta=Number(v)||0; this.saveWaris(w); App.navigate(); },
  toggleDoc(k){ const w=this.waris(); w.docs[k]=!w.docs[k]; this.saveWaris(w); App.navigate(); },

  /* ---- Hibah ---- */
  hibah(){ return DB.get('hibah', []); },
  saveHibah(h){ DB.set('hibah', h); },
  addHibah(){
    Modal.open(`
      <h3>＋ Rencana Hibah</h3>
      <label class="fl">Penerima</label><input id="hbNama">
      <div class="grid g2">
        <div><label class="fl">Hubungan</label>
          <select id="hbHub"><option>Anak</option><option>Orang tua</option><option>Pasangan</option><option>Saudara</option><option>Keponakan</option><option>Lembaga sosial/wakaf</option><option>Lainnya</option></select></div>
        <div><label class="fl">Nilai (Rp)</label><input id="hbNilai" type="number"></div>
      </div>
      <label class="fl">Target tanggal</label><input id="hbTgl" type="date">
      <label class="fl">Bentuk</label>
      <select id="hbBentuk"><option>Uang tunai</option><option>Tanah/properti</option><option>Emas/logam mulia</option><option>Saham/efek</option><option>Kendaraan</option><option>Lainnya</option></select>
      <button class="btn mt" onclick="Legacy.submitHibah()">Simpan</button>`);
  },
  submitHibah(){
    const nama = document.getElementById('hbNama').value.trim();
    const nilai = Number(document.getElementById('hbNilai').value);
    if(!nama || !nilai) return Toast.show('Penerima & nilai wajib diisi');
    const hs = this.hibah();
    hs.push({ id: U.uid(), nama, hub: document.getElementById('hbHub').value, nilai,
      tgl: document.getElementById('hbTgl').value, bentuk: document.getElementById('hbBentuk').value, done: false });
    this.saveHibah(hs); Modal.close(); App.navigate();
  },
  toggleHibah(id){ const hs=this.hibah(); const h=hs.find(x=>x.id===id); h.done=!h.done; this.saveHibah(hs); App.navigate(); },
  delHibah(id){ this.saveHibah(this.hibah().filter(h=>h.id!==id)); App.navigate(); }
};

App.register('legacy', 'Legacy — Waris, Hibah & Pensiun', function(el){
  const tab = Legacy.tab;
  let body = '';

  if(tab === 'pensiun'){
    const p = getProfile();
    const usia = p.lahir ? U.age(p.lahir) : null;
    const pn = Legacy.pensiun();
    const sisaTahun = usia != null ? Math.max(0, pn.usiaPensiun - usia) : null;
    const target = pn.bulanan * 12 * 25; // aturan 4% — 25× pengeluaran tahunan
    const bulan = sisaTahun ? sisaTahun * 12 : null;
    const setoran = bulan ? Invest.setoranBulanan(target, pn.terkumpul, bulan, pn.ret) : null;
    const prog = U.clamp(pn.terkumpul / Math.max(target,1) * 100, 0, 100);
    body = `
      <div class="grid g2">
        <div class="card">
          <h3>⚙️ Rencana Pensiun</h3>
          ${usia == null ? `<div class="alert warn mb">Isi tanggal lahir di menu <a href="#/profil">Profil</a> agar usia & sisa waktu terhitung otomatis.</div>` : `<div class="hint mb">Usia sekarang: <b>${usia} tahun</b> (dari Profil) → sisa waktu menabung <b>${sisaTahun} tahun</b>.</div>`}
          <div class="grid g2">
            <div><label class="fl">Usia pensiun</label><input id="pnUsia" type="number" value="${pn.usiaPensiun}" onchange="Legacy.savePensiun()"></div>
            <div><label class="fl">Imbal hasil asumsi %/th</label><input id="pnRet" type="number" step="any" value="${pn.ret}" onchange="Legacy.savePensiun()"></div>
          </div>
          <label class="fl">Pengeluaran bulanan saat pensiun (Rp)</label>
          <input id="pnBulanan" type="number" value="${pn.bulanan}" onchange="Legacy.savePensiun()">
          <div class="hint mts">Default otomatis dari rata² pengeluaran nyata 3 bulan (modul Income) atau 70% gaji.</div>
          <label class="fl">Sudah terkumpul (Rp)</label>
          <input id="pnKumpul" type="number" value="${pn.terkumpul}" onchange="Legacy.savePensiun()">
        </div>
        <div class="card">
          <h3>🎯 Hasil Perhitungan (aturan 4% — Trinity Study)</h3>
          <div class="stat mb"><div class="lbl">Target dana pensiun (25× pengeluaran tahunan)</div><div class="val" style="color:var(--yel)">${U.rp(target)}</div>
            <div class="d sub">dgn penarikan 4%/th, dana menghasilkan ${U.rp(pn.bulanan)}/bln tanpa habis</div></div>
          ${bulan ? `<div class="alert info">Setoran rutin yang dibutuhkan: <b>${U.rp(Math.ceil((setoran||0)/1000)*1000)}/bulan</b> selama ${sisaTahun} th (asumsi ${pn.ret}%/th majemuk).</div>` : ''}
          <div class="row between mt"><span class="sub">Progres</span><b>${U.rp(pn.terkumpul)} / ${U.rp(target)}</b></div>
          <div class="bar-wrap mt" style="height:13px"><div class="bar" style="width:${prog}%;background:linear-gradient(90deg,var(--pur),var(--pri))"></div></div>
          <div class="hint mt">💡 Instrumen jangka panjang yang lazim: RD indeks/ETF saham, SBN ritel bertahap, DPLK. Cek modul <a href="#/invest">Tujuan Investasi</a> utk tujuan-tujuan lain (haji, kurban, liburan, pendidikan, dll).</div>
        </div>
      </div>`;
  }
  else if(tab === 'waris'){
    const w = Legacy.waris();
    const totalPorsi = w.ahli.reduce((s,a)=>s+a.porsi,0);
    const DOCS = [ ['wasiat','Surat wasiat (notaris/bawah tangan + saksi)'], ['aset','Daftar lengkap aset & akses (rekening, RDN, wallet)'],
      ['utang','Daftar utang & kewajiban'], ['polis','Polis asuransi jiwa (UP & ahli waris terdaftar)'],
      ['akta','Akta/sertifikat (tanah, rumah, kendaraan)'], ['keluarga','Ahli waris tahu keberadaan dokumen ini'] ];
    body = `
      <div class="grid g2">
        <div class="card">
          <div class="row between mb wrap"><h3 style="margin:0">📜 Rencana Waris</h3><button class="btn sm" onclick="Legacy.addAhli()">＋ Ahli waris</button></div>
          <label class="fl">Estimasi total harta bersih (Rp) — lihat total aset di modul Income</label>
          <input type="number" value="${w.harta||''}" placeholder="mis. 500000000" onchange="Legacy.setHarta(this.value)">
          ${w.ahli.length ? `<div class="mt" style="overflow-x:auto"><table>
            <tr><th>Ahli waris</th><th>Hubungan</th><th class="num">Porsi</th><th class="num">Estimasi nilai</th><th></th></tr>
            ${w.ahli.map(a=>`<tr><td><b>${U.esc(a.nama)}</b></td><td>${U.esc(a.hub)}</td>
              <td class="num">${U.num(a.porsi,1)}%</td><td class="num">${U.rp((w.harta||0)*a.porsi/100)}</td>
              <td><button class="btn ghost sm" onclick="Legacy.delAhli('${a.id}')">🗑</button></td></tr>`).join('')}
          </table></div>
          <div class="alert ${Math.abs(totalPorsi-100)<0.01?'ok':'warn'} mt">Total porsi: <b>${U.num(totalPorsi,1)}%</b> ${Math.abs(totalPorsi-100)<0.01?'— pas 100% ✔':'— sisakan/sesuaikan hingga 100%'}</div>`
          : `<div class="empty mt">Belum ada ahli waris. Tambahkan & tetapkan porsinya.</div>`}
          <div class="hint mt">Rujukan: faraid/KHI (waris Islam), KUHPerdata (bagian mutlak/legitime portie), atau wasiat maks. 1/3 (Islam). Sahkan lewat notaris.</div>
        </div>
        <div class="card">
          <h3>✅ Checklist Dokumen Warisan</h3>
          ${DOCS.map(([k,label])=>`
            <label class="row mts" style="gap:8px;font-size:13px;cursor:pointer">
              <input type="checkbox" style="width:auto" ${w.docs[k]?'checked':''} onchange="Legacy.toggleDoc('${k}')"> ${label}
            </label>`).join('')}
          <div class="bar-wrap mt"><div class="bar" style="width:${DOCS.filter(([k])=>w.docs[k]).length/DOCS.length*100}%"></div></div>
          <div class="hint mt">Warisan yang rapi = keluarga tidak berebut & tidak kehilangan akses aset. Simpan salinan digital terenkripsi + beritahu 1–2 orang tepercaya.</div>
        </div>
      </div>`;
  }
  else { // hibah
    const hs = Legacy.hibah();
    const total = hs.filter(h=>!h.done).reduce((s,h)=>s+h.nilai,0);
    body = `
      <div class="card">
        <div class="row between mb wrap">
          <h3 style="margin:0">🎁 Rencana Hibah <span class="badge b-pri">${U.rp(total)} belum terlaksana</span></h3>
          <button class="btn sm" onclick="Legacy.addHibah()">＋ Hibah</button>
        </div>
        ${hs.length ? `<div style="overflow-x:auto"><table>
          <tr><th>Penerima</th><th>Hubungan</th><th>Bentuk</th><th class="num">Nilai</th><th>Target</th><th>Status</th><th></th></tr>
          ${hs.map(h=>`<tr>
            <td><b>${U.esc(h.nama)}</b></td><td>${U.esc(h.hub)}</td><td>${U.esc(h.bentuk)}</td>
            <td class="num">${U.rp(h.nilai)}</td><td>${h.tgl?U.dt(h.tgl):'—'}</td>
            <td><button class="btn ${h.done?'grn':'ghost'} sm" onclick="Legacy.toggleHibah('${h.id}')">${h.done?'✓ Diberikan':'Rencana'}</button></td>
            <td><button class="btn ghost sm" onclick="Legacy.delHibah('${h.id}')">🗑</button></td></tr>`).join('')}
        </table></div>` : `<div class="empty">Belum ada rencana hibah. Hibah semasa hidup mengurangi potensi sengketa waris.</div>`}
        <div class="alert info mt">
          💡 <b>Aturan pajak hibah (resmi):</b> hibah kepada keluarga sedarah garis keturunan lurus satu derajat (orang tua ↔ anak), serta badan keagamaan/pendidikan/sosial, <b>dikecualikan dari objek PPh</b> — Pasal 4 ayat (3) huruf a UU PPh. Hibah tanah/bangunan tetap ada BPHTB (dgn pengurangan utk keluarga langsung, aturan daerah).
          ${SRC('UU No. 36/2008 (PPh) Pasal 4 ayat (3) — JDIH Kemenkeu', 'https://jdih.kemenkeu.go.id/fulltext/2008/36TAHUN2008UU.HTM')}
        </div>
      </div>`;
  }

  el.innerHTML = `
    <div class="alert info mb" style="padding:9px 14px">🏛 <b>Legacy</b> — merencanakan yang kita tinggalkan & masa tua: <b>Dana Pensiun</b> (dipindah ke sini), <b>Waris</b>, dan <b>Hibah</b>. Tujuan hidup lain (pendidikan, haji, kurban, liburan, rumah, dll) tetap di menu <a href="#/invest">Tujuan Investasi</a>.</div>
    <div class="tabs">
      <button class="tab ${tab==='pensiun'?'active':''}" onclick="Legacy.setTab('pensiun')">👴 Dana Pensiun</button>
      <button class="tab ${tab==='waris'?'active':''}" onclick="Legacy.setTab('waris')">📜 Waris</button>
      <button class="tab ${tab==='hibah'?'active':''}" onclick="Legacy.setTab('hibah')">🎁 Hibah</button>
    </div>
    ${body}`;
});
