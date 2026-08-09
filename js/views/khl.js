/* ========== KHL: UMR vs Kebutuhan Hidup Layak, tanggungan & sekolah, hutang-piutang,
   dana darurat otomatis, budgeting DINAMIS — data resmi + penyesuaian inflasi realtime ========== */
const KHL = {
  tab: DB.get('khl_tab', 'khl'),
  setTab(t){ this.tab = t; DB.set('khl_tab', t); App.navigate(); },

  cfg(){ return DB.get('khl_cfg', { provinsi: getProfile().provinsi || 'DKI Jakarta', gaji: 0, pasangan: false, tanggunganLain: 0 }); },
  saveCfg(c){ DB.set('khl_cfg', c); },

  /* ---- DATA KHL (terpisah dari UMP!) — 7 kelompok, 64 komponen (Permenaker 18/2020) ---- */
  defaultKelompok(){
    // estimasi awal per kelompok memakai proporsi tipikal survei KHL × biaya hidup provinsi (proxy);
    // WAJIB disesuaikan dengan harga pasar nyata di daerah pengguna (itulah hakikat survei KHL)
    const basis = UMP2026.data[this.cfg().provinsi] || 3000000;
    const o = {};
    KHL_PERMENAKER.kelompok.forEach(k => o[k.id] = Math.round(k.porsi * basis / 1000) * 1000);
    return o;
  },
  kelompokVals(){
    const saved = DB.get('khl_kelompok', null);
    return (saved && saved.vals) ? saved.vals : this.defaultKelompok();
  },
  setKelompok(id, v){
    const vals = this.kelompokVals(); vals[id] = Number(v) || 0;
    DB.set('khl_kelompok', { vals, editedAt: new Date().toISOString() }); App.navigate();
  },
  resetKelompok(){ DB.set('khl_kelompok', null); Toast.show('Kembali ke estimasi awal — sesuaikan dgn harga daerahmu'); App.navigate(); },
  anak(){ return DB.get('khl_anak', []); },
  saveAnak(a){ DB.set('khl_anak', a); },
  utang(){ return DB.get('utang', []); },
  saveUtang(u){ DB.set('utang', u); },
  biaya(){ return DB.get('khl_biaya', Object.fromEntries(JENJANG.map(j=>[j.kode, j.biayaNegeri]))); },

  updateCfg(){
    const c = this.cfg();
    c.provinsi = document.getElementById('khlProv').value;
    c.gaji = Number(document.getElementById('khlGaji').value)||0;
    c.pasangan = document.getElementById('khlPas').checked;
    c.tanggunganLain = document.getElementById('khlTgl') ? Math.max(0, Number(document.getElementById('khlTgl').value)||0) : (c.tanggunganLain||0);
    this.saveCfg(c); App.navigate();
  },

  addAnak(){
    Modal.open(`
      <h3>＋ Tambah Anak / Tanggungan</h3>
      <label class="fl">Nama</label><input id="anNama" placeholder="Nama anak">
      <label class="fl">Tanggal lahir</label><input id="anLahir" type="date">
      <label class="fl">Jenis sekolah (untuk estimasi biaya)</label>
      <select id="anSek"><option value="negeri">Negeri</option><option value="swasta">Swasta</option></select>
      <button class="btn mt" onclick="KHL.submitAnak()">Simpan</button>
      <div class="hint mt">Jenjang & lama sekolah dihitung otomatis dari tanggal lahir (usia masuk SD ≥6–7 th sesuai Permendikbud 1/2021), hingga estimasi lulus kuliah.</div>`);
  },
  submitAnak(){
    const nama = document.getElementById('anNama').value.trim();
    const lahir = document.getElementById('anLahir').value;
    if(!nama || !lahir) return Toast.show('Nama & tanggal lahir wajib diisi');
    const as = this.anak(); as.push({ id: U.uid(), nama, lahir, sek: document.getElementById('anSek').value });
    this.saveAnak(as); Modal.close(); App.navigate();
  },
  delAnak(id){ this.saveAnak(this.anak().filter(a=>a.id!==id)); App.navigate(); },

  /* Jalur pendidikan anak: jenjang saat ini + sisa tahapan hingga lulus */
  eduPath(a){
    const usia = U.age(a.lahir);
    const path = [];
    for(const j of JENJANG){
      const mulaiUsia = j.masuk, lulusUsia = j.masuk + j.lama;
      if(usia >= lulusUsia) continue;               // sudah lewat jenjang ini
      const tahunMulai = Math.max(0, mulaiUsia - usia);
      const sisaTahun = usia >= mulaiUsia ? (lulusUsia - usia) : j.lama;
      path.push({ j, tahunMulai, sisaTahun, sedang: usia >= mulaiUsia && usia < lulusUsia });
    }
    return { usia, path };
  },

  addUtang(){
    Modal.open(`
      <h3>＋ Catat Hutang / Piutang</h3>
      <label class="fl">Jenis</label>
      <select id="utJenis"><option value="hutang">Hutang (saya berutang)</option><option value="piutang">Piutang (orang berutang ke saya)</option></select>
      <label class="fl">Pihak</label><input id="utPihak" placeholder="mis. Bank X / Budi">
      <div class="grid g2">
        <div><label class="fl">Nominal (Rp)</label><input id="utNilai" type="number"></div>
        <div><label class="fl">Cicilan/bulan (Rp)</label><input id="utCicil" type="number" placeholder="0"></div>
      </div>
      <div class="grid g2">
        <div><label class="fl">Bunga %/tahun</label><input id="utBunga" type="number" step="any" placeholder="0"></div>
        <div><label class="fl">Jatuh tempo</label><input id="utTempo" type="date"></div>
      </div>
      <button class="btn mt" onclick="KHL.submitUtang()">Simpan</button>`);
  },
  submitUtang(){
    const pihak = document.getElementById('utPihak').value.trim();
    const nilai = Number(document.getElementById('utNilai').value);
    if(!pihak || !nilai) return Toast.show('Pihak & nominal wajib diisi');
    const us = this.utang();
    us.push({ id: U.uid(), jenis: document.getElementById('utJenis').value, pihak, nilai,
      cicil: Number(document.getElementById('utCicil').value)||0, bunga: Number(document.getElementById('utBunga').value)||0,
      tempo: document.getElementById('utTempo').value, lunas: false, at: new Date().toISOString() });
    this.saveUtang(us); Modal.close(); App.navigate();
  },
  toggleLunas(id){ const us=this.utang(); const u=us.find(x=>x.id===id); u.lunas=!u.lunas; this.saveUtang(us); App.navigate(); },
  delUtang(id){ this.saveUtang(this.utang().filter(u=>u.id!==id)); App.navigate(); },

  /* Hitung inti — UMP dan KHL DIPISAH:
     - UMP  : ketetapan resmi provinsi (konteks upah minimum)
     - KHL  : dijumlah dari 7 kelompok / 64 komponen Permenaker 18/2020 (konteks kebutuhan hidup),
              disesuaikan inflasi realtime, lalu dikalikan skala keluarga + biaya sekolah anak. */
  hitung(inflasi){
    const c = this.cfg();
    const ump = UMP2026.data[c.provinsi];
    const adj = inflasi != null ? (1 + inflasi/100 * ((Date.now() - new Date('2026-01-01')) / 31557600000)) : 1;
    const vals = this.kelompokVals();
    const khlLajangRaw = Object.values(vals).reduce((a,b)=>a+(Number(b)||0),0);
    const khlSatu = khlLajangRaw * adj;
    const anak = this.anak();
    let faktor = EQUIV.kepala + (c.pasangan ? EQUIV.dewasa : 0) + (c.tanggunganLain||0) * EQUIV.dewasa;
    let biayaSek = 0; const detail = [];
    const biaya = this.biaya();
    for(const a of anak){
      const { usia, path } = this.eduPath(a);
      faktor += usia < 14 ? EQUIV.anak : EQUIV.dewasa;
      const cur = path.find(p=>p.sedang);
      if(cur){
        const perTahun = a.sek==='swasta' ? cur.j.biayaSwasta : (biaya[cur.j.kode] ?? cur.j.biayaNegeri);
        biayaSek += perTahun * adj / 12;
        detail.push({ a, usia, jenjang: cur.j.nama, perTahun: perTahun*adj });
      }
    }
    const khlKeluarga = khlSatu * faktor + biayaSek;
    return { c, ump, adj, vals, khlLajangRaw, khlSatu, faktor, biayaSek, khlKeluarga, detail, anak,
      rasio: khlKeluarga ? (c.gaji / khlKeluarga) : 0,
      umpVsKhl: khlSatu ? (ump / khlSatu) : 0 };
  },

  /* PPh 21 estimasi (UU HPP 7/2021): biaya jabatan 5% maks 6jt/th, PTKP TK/K + anak (maks 3), tarif progresif */
  hitungPPh21(gajiBulanan, kawin, jmlAnak){
    const bruto = gajiBulanan * 12;
    const biayaJabatan = Math.min(bruto * 0.05, 6000000);
    const ptkp = 54000000 + (kawin ? 4500000 : 0) + Math.min(jmlAnak||0, 3) * 4500000;
    let pkp = Math.max(0, Math.floor((bruto - biayaJabatan - ptkp) / 1000) * 1000);
    const layers = [[60000000,.05],[190000000,.15],[250000000,.25],[4500000000,.30],[Infinity,.35]];
    let pajak = 0;
    for(const [cap, rate] of layers){
      const take = Math.min(pkp, cap);
      pajak += take * rate; pkp -= take;
      if(pkp <= 0) break;
    }
    return { tahunan: pajak, bulanan: pajak / 12, ptkp,
      status: (kawin?'K':'TK') + '/' + Math.min(jmlAnak||0,3) };
  },

  /* Budgeting DINAMIS — bukan 50/30/20. Alokasi menyesuaikan rasio gaji/KHL. */
  budgetDinamis(rasio){
    if(rasio < 1)    return { tier: 'Bertahan (Survival)', warna: 'b-red', a: { 'Kebutuhan pokok': 90, 'Cicilan/darurat': 8, 'Sosial': 2, 'Gaya hidup': 0, 'Investasi': 0 },
      pesan: 'Gaji masih di bawah KHL keluarga. Fokus 90% ke kebutuhan pokok — jangan dipaksakan menabung besar; cari tambahan penghasilan & bantuan yang tersedia.' };
    if(rasio < 1.3)  return { tier: 'Pra-Stabil', warna: 'b-yel', a: { 'Kebutuhan pokok': 75, 'Dana darurat': 10, 'Cicilan': 10, 'Gaya hidup': 3, 'Investasi': 2 },
      pesan: 'Sedikit di atas KHL. Prioritas: bangun dana darurat kecil dulu (target 1× pengeluaran), gaya hidup ditahan.' };
    if(rasio < 2)    return { tier: 'Stabil', warna: 'b-pri', a: { 'Kebutuhan pokok': 60, 'Dana darurat': 10, 'Investasi': 12, 'Proteksi': 5, 'Gaya hidup': 10, 'Sosial': 3 },
      pesan: 'Kebutuhan aman. Mulai rutin investasi & lengkapi proteksi (BPJS + term life bila ada tanggungan).' };
    if(rasio < 3.5)  return { tier: 'Mapan', warna: 'b-grn', a: { 'Kebutuhan pokok': 45, 'Investasi': 25, 'Proteksi': 6, 'Gaya hidup': 15, 'Sosial': 5, 'Pendidikan/upgrade diri': 4 },
      pesan: 'Porsi investasi dinaikkan agresif (25%+). Diversifikasi: SBN, reksa dana indeks, saham fundamental bagus.' };
    return           { tier: 'Sejahtera', warna: 'b-pur', a: { 'Kebutuhan pokok': 30, 'Investasi': 35, 'Proteksi': 5, 'Gaya hidup': 18, 'Sosial & filantropi': 8, 'Pendidikan': 4 },
      pesan: 'Fokus akumulasi aset produktif & filantropi. Pertimbangkan perencanaan pajak & warisan.' };
  }
};

App.register('khl', 'KHL & Budget Dinamis', function(el){
  const tab = KHL.tab;
  el.innerHTML = `
    <div class="tabs">
      <button class="tab ${tab==='khl'?'active':''}" onclick="KHL.setTab('khl')">🏡 UMR vs KHL</button>
      <button class="tab ${tab==='utang'?'active':''}" onclick="KHL.setTab('utang')">🤝 Hutang-Piutang</button>
      <button class="tab ${tab==='darurat'?'active':''}" onclick="KHL.setTab('darurat')">🚨 Dana Darurat</button>
      <button class="tab ${tab==='budget'?'active':''}" onclick="KHL.setTab('budget')">⚖️ Budget Dinamis</button>
    </div>
    <div id="khlBody">${loadingBox('Mengambil inflasi terkini (World Bank) untuk penyesuaian realtime…')}</div>`;

  (async ()=>{
    let inflasi = null, inflasiMeta = null;
    try{ inflasiMeta = await API.worldBank('FP.CPI.TOTL.ZG', 'Inflasi (CPI, % YoY)'); inflasi = inflasiMeta.value; }catch(e){ /* tetap jalan tanpa penyesuaian */ }
    const H = KHL.hitung(inflasi);
    const body = document.getElementById('khlBody'); if(!body) return;

    const srcRealtime = `
      <div class="card mt">
        <h3>🧾 Sumber & pembaruan data</h3>
        <div class="hint">
          • <b>UMP ≠ KHL (konteks terpisah)</b> — UMP ${UMP2026.meta.tahun}: <b>${U.esc(UMP2026.meta.dasar)}</b>, berlaku ${U.esc(UMP2026.meta.berlaku)} — <a href="${UMP2026.meta.url}" target="_blank">${U.esc(UMP2026.meta.sumber)}</a><br>
          • Data KHL: <a href="${KHL_PERMENAKER.url}" target="_blank">${U.esc(KHL_PERMENAKER.dasar)}</a> — nilai per kelompok diisi sesuai harga daerah (prinsip survei pasar KHL)<br>
          • Skala tanggungan: <a href="${EQUIV.url}" target="_blank">${U.esc(EQUIV.sumber)}</a> (dewasa +0,5 · anak &lt;14 th +0,3)<br>
          • Biaya sekolah: <a href="${JENJANG_SRC.url}" target="_blank">${U.esc(JENJANG_SRC.label)}</a><br>
          • Penyesuaian inflasi <b>realtime</b>: ${inflasiMeta ? `<a href="${inflasiMeta.sourceUrl}" target="_blank">World Bank CPI</a> = <b>${U.pct(inflasi)}</b> (data ${inflasiMeta.year}, diambil ${U.time(inflasiMeta.fetchedAt)}) — KHL di atas sudah disesuaikan ${U.num((H.adj-1)*100,2)}% sejak Jan 2026` : 'gagal dimuat (nilai tanpa penyesuaian)'}
        </div>
      </div>`;

    if(tab==='khl'){
      body.innerHTML = `
        <div class="card mb">
          <h3>⚙️ Profil Keluarga <span class="badge b-cyn">tersinkron dengan menu Profil</span></h3>
          <div class="grid g4">
            <div><label class="fl">Provinsi (UMP resmi 2026)</label>
              <select id="khlProv" onchange="KHL.updateCfg()">${Object.keys(UMP2026.data).map(p=>`<option ${H.c.provinsi===p?'selected':''}>${p}</option>`).join('')}</select></div>
            <div><label class="fl">Gaji bulanan Anda (Rp)</label>
              <input id="khlGaji" type="number" value="${H.c.gaji||''}" placeholder="mis. 6000000" onchange="KHL.updateCfg()"></div>
            <div><label class="fl">Tanggungan dewasa lain</label>
              <input id="khlTgl" type="number" min="0" value="${H.c.tanggunganLain||0}" onchange="KHL.updateCfg()" title="orang tua, adik, dll yang Anda tanggung"></div>
            <div><label class="fl">Pasangan</label>
              <div class="row" style="padding-top:8px">
                <label class="row" style="gap:5px;font-size:13px"><input type="checkbox" id="khlPas" style="width:auto" ${H.c.pasangan?'checked':''} onchange="KHL.updateCfg()"> Punya pasangan</label>
              </div></div>
          </div>
          <div class="hint mts">Tanggungan dewasa lain = orang tua, adik/kakak, atau kerabat yang hidupnya Anda tanggung (masing-masing +0,5 skala kebutuhan).</div>
        </div>

        <div class="alert info mb">
          ⚖️ <b>UMP ≠ KHL — dua konteks berbeda, data terpisah.</b> UMP = ketetapan upah minimum pemerintah (formula PP 49/2025). KHL versi resmi <b>Permenaker 18/2020 (64 komponen, 7 kelompok) memang dihitung untuk 1 orang pekerja lajang</b> — tapi kita tidak hidup sendiri, maka sistem menambah lapisan terpisah: <b>Kebutuhan Keluarga</b> = KHL lajang × skala tanggungan (pasangan, tanggungan dewasa lain, anak) + biaya sekolah anak.
        </div>

        <div class="grid g4 mb">
          <div class="stat"><div class="lbl">📌 UMP ${H.c.provinsi} (resmi)</div><div class="val">${U.rp(H.ump)}</div><div class="d sub">konteks: upah minimum</div></div>
          <div class="stat"><div class="lbl">🧺 KHL resmi — 1 orang lajang</div><div class="val">${U.rp(H.khlSatu)}</div><div class="d sub">64 komponen · ×${U.num(H.adj,4)} inflasi</div></div>
          <div class="stat"><div class="lbl">👨‍👩‍👧 Kebutuhan Keluarga (×${U.num(H.faktor,1)} + sekolah)</div><div class="val">${U.rp(H.khlKeluarga)}</div><div class="d sub">${H.c.pasangan?'pasangan · ':''}${H.c.tanggunganLain?H.c.tanggunganLain+' tanggungan dewasa · ':''}${H.anak.length} anak · sekolah ${U.rp(H.biayaSek)}/bln</div></div>
          <div class="stat"><div class="lbl">Gaji vs KHL keluarga</div>
            <div class="val ${H.rasio>=1?'up':'down'}">${H.c.gaji?U.num(H.rasio*100,0)+'%':'—'}</div>
            <div class="d ${H.rasio>=1?'up':'down'}">${H.c.gaji ? (H.rasio>=1 ? 'di atas KHL ✔' : 'DI BAWAH KHL ⚠') : 'isi gaji dulu'}</div></div>
        </div>

        <div class="alert ${H.umpVsKhl>=1?'ok':'warn'} mb">
          📊 <b>Perbandingan UMP vs KHL:</b> UMP ${H.c.provinsi} (${U.rp(H.ump)}) ${H.umpVsKhl>=1
            ? `menutup <b>${U.num(H.umpVsKhl*100,0)}%</b> KHL lajang versi Anda — di atas kebutuhan hidup layak.`
            : `hanya menutup <b>${U.num(H.umpVsKhl*100,0)}%</b> dari KHL lajang versi Anda (${U.rp(H.khlSatu)}) — bekerja dgn upah minimum saja belum hidup layak di sini.`}
        </div>

        <div class="card mb">
          <div class="row between wrap">
            <h3 style="margin:0">🧺 Data KHL — Permenaker 18/2020 <span class="badge b-yel">7 kelompok · 64 komponen</span></h3>
            <button class="btn ghost sm" onclick="KHL.resetKelompok()">↺ Reset estimasi awal</button>
          </div>
          <div class="hint mt">Isi nilai per kelompok sesuai <b>harga pasar nyata di daerahmu</b> (prinsip survei KHL). Klik tiap kelompok untuk melihat poin-poin komponennya.</div>
          <div class="mt">
            ${KHL_PERMENAKER.kelompok.map(k=>`
              <details style="border-bottom:1px solid rgba(35,46,78,.6);padding:8px 0">
                <summary style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;list-style:none">
                  <span><b>${k.nama}</b> <span class="badge b-mut">${k.n} komponen</span></span>
                  <span class="row" style="gap:6px">Rp <input type="number" value="${H.vals[k.id]||0}" style="width:130px;padding:5px 8px"
                    onchange="KHL.setKelompok('${k.id}', this.value)" onclick="event.preventDefault()">/bln</span>
                </summary>
                <div class="hint mts" style="padding-left:4px">📋 Poin komponen: ${k.poin}</div>
              </details>`).join('')}
            <div class="row between mt"><b>Total KHL lajang (sebelum inflasi)</b><b style="font-size:16px">${U.rp(H.khlLajangRaw)}/bln</b></div>
          </div>
          ${SRC(KHL_PERMENAKER.dasar, KHL_PERMENAKER.url)}
        </div>

        ${H.c.gaji ? `<div class="alert ${H.rasio>=1.3?'ok':H.rasio>=1?'info':'bad'} mb">
          ${H.rasio>=1 ? `Gaji Anda <b>${U.rp(H.c.gaji)}</b> = <b>${U.num(H.rasio,2)}×</b> KHL keluarga (${U.rp(H.khlKeluarga)}). Selisih ${U.rp(H.c.gaji-H.khlKeluarga)}/bulan bisa dialokasikan sesuai <a href="#" onclick="KHL.setTab('budget');return false">Budget Dinamis</a>.`
          : `Gaji Anda <b>${U.rp(H.c.gaji)}</b> masih di bawah KHL keluarga <b>${U.rp(H.khlKeluarga)}</b> (kurang ${U.rp(H.khlKeluarga-H.c.gaji)}). Buka tab <a href="#" onclick="KHL.setTab('budget');return false">Budget Dinamis</a> — mode survival, alokasi difokuskan ke kebutuhan pokok.`}
        </div>` : ''}

        <div class="card">
          <div class="row between mb wrap"><h3 style="margin:0">👶 Anak / Tanggungan & Jalur Sekolah (otomatis dari tanggal lahir)</h3>
            <button class="btn sm" onclick="KHL.addAnak()">＋ Anak</button></div>
          ${H.anak.length ? H.anak.map(a=>{
            const { usia, path } = KHL.eduPath(a);
            return `<div class="group-card mb">
              <div class="row between wrap"><b>${U.esc(a.nama)}</b>
                <div class="row"><span class="badge b-cyn">${usia} tahun</span><span class="badge ${a.sek==='swasta'?'b-pur':'b-grn'}">${a.sek}</span>
                <button class="btn ghost sm" onclick="KHL.delAnak('${a.id}')">🗑</button></div></div>
              ${path.length ? `<div class="flow mt">${path.map(p=>`
                <div class="flow-item"><b>${p.j.nama}</b> ${p.sedang?'<span class="badge b-grn">SEDANG DIJALANI</span>':`<span class="hint">mulai ~${p.tahunMulai} th lagi (usia ${p.j.masuk})</span>`}
                  — ${p.sisaTahun} th ${p.sedang?'tersisa':''} · est. ${U.rp((a.sek==='swasta'?p.j.biayaSwasta:p.j.biayaNegeri)*H.adj)}/th
                  · total jenjang ${U.rp((a.sek==='swasta'?p.j.biayaSwasta:p.j.biayaNegeri)*H.adj*p.sisaTahun)}</div>`).join('')}
                <div class="flow-item"><b>🎓 Estimasi lulus kuliah</b> — usia 23 th (${new Date(new Date(a.lahir).getFullYear()+23, 5).getFullYear()}), total biaya tersisa
                <b>${U.rp(path.reduce((s,p)=>s+(a.sek==='swasta'?p.j.biayaSwasta:p.j.biayaNegeri)*H.adj*p.sisaTahun,0))}</b></div></div>`
              : `<div class="hint mt">Sudah melewati usia pendidikan formal.</div>`}
            </div>`; }).join('') : `<div class="empty">Belum ada tanggungan anak. Tambahkan — jenjang sekolah & estimasi biaya hingga lulus dihitung otomatis dari tanggal lahir.</div>`}
        </div>
        ${srcRealtime}`;
    }
    else if(tab==='utang'){
      const us = KHL.utang();
      const totalH = us.filter(u=>u.jenis==='hutang'&&!u.lunas).reduce((s,u)=>s+u.nilai,0);
      const totalP = us.filter(u=>u.jenis==='piutang'&&!u.lunas).reduce((s,u)=>s+u.nilai,0);
      const cicilan = us.filter(u=>u.jenis==='hutang'&&!u.lunas).reduce((s,u)=>s+u.cicil,0);
      const dsr = H.c.gaji ? cicilan/H.c.gaji*100 : null;
      body.innerHTML = `
        <div class="grid g4 mb">
          <div class="stat"><div class="lbl">Total Hutang aktif</div><div class="val down">${U.rp(totalH)}</div></div>
          <div class="stat"><div class="lbl">Total Piutang aktif</div><div class="val up">${U.rp(totalP)}</div></div>
          <div class="stat"><div class="lbl">Cicilan/bulan</div><div class="val">${U.rp(cicilan)}</div></div>
          <div class="stat"><div class="lbl">Rasio cicilan (DSR)</div><div class="val ${dsr==null?'':dsr>35?'down':'up'}">${dsr==null?'—':U.num(dsr,0)+'%'}</div>
            <div class="d sub">sehat ≤ 35% gaji (standar OJK/SLIK)</div></div>
        </div>
        ${dsr!=null && dsr>35 ? `<div class="alert bad mb">⚠ Cicilan ${U.num(dsr,0)}% dari gaji — melebihi ambang sehat 35%. Prioritaskan pelunasan bunga tertinggi (metode avalanche).</div>`:''}
        <div class="card">
          <div class="row between mb wrap"><h3 style="margin:0">🤝 Daftar Hutang & Piutang</h3><button class="btn sm" onclick="KHL.addUtang()">＋ Catat</button></div>
          ${us.length ? `<div style="overflow-x:auto"><table>
            <tr><th>Jenis</th><th>Pihak</th><th class="num">Nominal</th><th class="num">Cicilan/bln</th><th class="num">Bunga</th><th>Jatuh tempo</th><th>Status</th><th></th></tr>
            ${us.map(u=>`<tr>
              <td><span class="badge ${u.jenis==='hutang'?'b-red':'b-grn'}">${u.jenis}</span></td>
              <td><b>${U.esc(u.pihak)}</b></td><td class="num">${U.rp(u.nilai)}</td><td class="num">${U.rp(u.cicil)}</td>
              <td class="num">${U.pct(u.bunga,1)}</td>
              <td>${u.tempo ? (new Date(u.tempo)<new Date()&&!u.lunas?`<span class="down">${U.dt(u.tempo)} ⚠ lewat</span>`:U.dt(u.tempo)) : '—'}</td>
              <td><button class="btn ${u.lunas?'grn':'ghost'} sm" onclick="KHL.toggleLunas('${u.id}')">${u.lunas?'✓ Lunas':'Belum'}</button></td>
              <td><button class="btn ghost sm" onclick="KHL.delUtang('${u.id}')">🗑</button></td></tr>`).join('')}
          </table></div>` : `<div class="empty">Belum ada catatan hutang/piutang.</div>`}
        </div>`;
    }
    else if(tab==='darurat'){
      // pengeluaran bulanan aktual dari modul Income (otomatis), fallback KHL keluarga
      const ts = DB.get('txs', []);
      const now = new Date(); const last3 = [];
      for(let i=0;i<3;i++){ const m=new Date(now.getFullYear(),now.getMonth()-i,1);
        last3.push(ts.filter(t=>t.tipe==='Pengeluaran' && new Date(t.tgl).getMonth()===m.getMonth() && new Date(t.tgl).getFullYear()===m.getFullYear()).reduce((s,t)=>s+t.nilai,0)); }
      const avgOut = last3.filter(x=>x>0).length ? last3.reduce((a,b)=>a+b,0)/Math.max(1,last3.filter(x=>x>0).length) : 0;
      const basis = avgOut || H.khlKeluarga;
      const basisLbl = avgOut ? 'rata-rata pengeluaran 3 bulan terakhir (otomatis dari modul Income)' : 'KHL keluarga (belum ada data pengeluaran)';
      const nTanggungan = (H.c.pasangan?1:0) + H.anak.length;
      const bulan = nTanggungan===0 ? 3 : nTanggungan<=2 ? 6 : nTanggungan<=4 ? 9 : 12;
      const target = basis * bulan;
      const kas = DB.get('holdings', []).filter(h=>h.jenis==='cash').reduce((s,h)=>s+h.qty,0);
      body.innerHTML = `
        <div class="grid g3 mb">
          <div class="stat"><div class="lbl">Basis pengeluaran/bulan</div><div class="val">${U.rp(basis)}</div><div class="d sub">${basisLbl}</div></div>
          <div class="stat"><div class="lbl">Kebutuhan (otomatis)</div><div class="val">${bulan}× bulan</div><div class="d sub">${nTanggungan} tanggungan → standar perencana keuangan</div></div>
          <div class="stat"><div class="lbl">🎯 Target Dana Darurat</div><div class="val" style="color:var(--yel)">${U.rp(target)}</div></div>
        </div>
        <div class="card">
          <h3>Progres dana darurat</h3>
          <div class="row between"><span class="sub">Kas/deposito tercatat di modul Income → Aset</span><b>${U.rp(kas)} / ${U.rp(target)}</b></div>
          <div class="bar-wrap mt" style="height:14px"><div class="bar" style="width:${U.clamp(kas/Math.max(target,1)*100,0,100)}%;background:linear-gradient(90deg,var(--yel),var(--grn))"></div></div>
          <div class="hint mt">Aturan jumlah bulan: lajang 3×, ≤2 tanggungan 6×, 3–4 tanggungan 9×, >4 tanggungan 12× pengeluaran bulanan — praktik standar perencanaan keuangan (OJK Sikapi Uangmu).</div>
          ${SRC('OJK — Sikapi Uangmu: Dana Darurat', 'https://sikapiuangmu.ojk.go.id')}
        </div>`;
    }
    else { // budget dinamis
      const B = KHL.budgetDinamis(H.rasio || 0);
      const gaji = H.c.gaji || 0;
      // 🏛 PAJAK: estimasi PPh 21 otomatis (status kawin & anak dari Profil/KHL)
      const pph = KHL.hitungPPh21(gaji, H.c.pasangan, H.anak.length);
      // 🕌 ZAKAT: 2,5% penghasilan bila mencapai nisab (85 gr emas/tahun) — harga emas LIVE
      let goldGram = null;
      try{ const cg = await API.cryptoGold(); goldGram = cg.data['pax-gold'].idr / 31.1035; }catch(e){}
      const nisabBulanan = goldGram ? goldGram * 85 / 12 : null;
      const zakatOn = H.c.zakatOn !== false;
      const wajibZakat = nisabBulanan != null ? gaji >= nisabBulanan : gaji >= 7000000;
      const zakat = (zakatOn && wajibZakat) ? gaji * 0.025 : 0;
      const netto = Math.max(0, gaji - pph.bulanan - zakat);
      const pokokPct = B.a['Kebutuhan pokok'] || 0;
      const alokasiPokok = netto * pokokPct / 100;
      body.innerHTML = `
        ${gaji ? '' : `<div class="alert warn mb">Isi gaji & profil di tab <a href="#" onclick="KHL.setTab('khl');return false">UMR vs KHL</a> dulu agar alokasi dihitung.</div>`}
        <div class="grid g3 mb">
          <div class="stat"><div class="lbl">Basis: KHL keluarga = jumlah orang × KHL</div><div class="val">${U.rp(H.khlKeluarga)}</div>
            <div class="d sub">KHL lajang ${U.rp(H.khlSatu)} × skala ${U.num(H.faktor,1)} orang-setara + sekolah ${U.rp(H.biayaSek)}</div></div>
          <div class="stat"><div class="lbl">Gaji bruto → netto</div><div class="val">${gaji?U.rp(netto):'—'}</div>
            <div class="d sub">${gaji?`bruto ${U.rp(gaji)} − pajak ${U.rp(pph.bulanan)} − zakat ${U.rp(zakat)}`:''}</div></div>
          <div class="stat"><div class="lbl">Rasio Gaji ÷ KHL keluarga</div><div class="val ${H.rasio>=1?'up':'down'}">${gaji?U.num(H.rasio*100,0)+'%':'—'}</div></div>
        </div>

        <div class="card mb">
          <h3>🧾 Kewajiban Dulu: Zakat & Pajak (dipotong sebelum alokasi)</h3>
          <div class="row between mts"><span>🏛 <b>Pajak PPh 21</b> <span class="hint">(estimasi, status ${pph.status} · PTKP ${U.rp(pph.ptkp)}/th otomatis dari data pasangan & anak)</span></span><b class="down">−${U.rp(pph.bulanan)}/bln</b></div>
          <div class="bar-wrap mts"><div class="bar" style="width:${gaji?U.clamp(pph.bulanan/gaji*100,1,100):0}%;background:var(--red)"></div></div>
          <div class="row between mt">
            <span>🕌 <b>Zakat penghasilan 2,5%</b>
              <label class="hint" style="cursor:pointer"><input type="checkbox" id="khlZakatOn" style="width:auto" ${zakatOn?'checked':''} onchange="(function(){const c=KHL.cfg();c.zakatOn=document.getElementById('khlZakatOn').checked;KHL.saveCfg(c);App.navigate();})()"> ikutkan</label>
              <span class="hint">${nisabBulanan!=null?`· nisab ${U.rp(nisabBulanan)}/bln (85 gr emas ÷ 12, harga emas live) → ${wajibZakat?'<b class="up">mencapai nisab, wajib</b>':'<b>di bawah nisab — tidak wajib</b>'}`:'· nisab: 85 gr emas/tahun (harga emas gagal dimuat)'}</span></span>
            <b class="${zakat?'down':''}">${zakat?'−'+U.rp(zakat)+'/bln':'Rp0'}</b>
          </div>
          <div class="bar-wrap mts"><div class="bar" style="width:${gaji&&zakat?U.clamp(zakat/gaji*100,1,100):0}%;background:var(--grn)"></div></div>
          <div class="hint mt">📎 Sumber: <a href="https://baznas.go.id/zakatpenghasilan" target="_blank">BAZNAS — zakat penghasilan 2,5%, nisab 85 gr emas/th</a> · <a href="https://peraturan.bpk.go.id/Details/234926/uu-no-7-tahun-2021" target="_blank">UU HPP 7/2021 — tarif PPh 21 & PTKP</a>. Zakat yang dibayar via BAZNAS/LAZ resmi menjadi <b>pengurang penghasilan kena pajak</b>.</div>
        </div>

        <div class="card mb">
          <div class="row between wrap">
            <h3 style="margin:0">⚖️ Budget Dinamis — bukan 50/30/20</h3>
            <span class="badge ${B.warna}" style="font-size:13px">Tier: ${B.tier} (${U.num((H.rasio||0)*100,0)}% dari KHL keluarga)</span>
          </div>
          <div class="hint mt">Alokasi menyesuaikan <b>rasio gaji ÷ (jumlah orang × KHL)</b>, dan dihitung dari <b>gaji NETTO ${U.rp(netto)}</b> (setelah pajak & zakat).</div>
          <div class="alert info mt">${B.pesan}</div>
          ${gaji && alokasiPokok < H.khlKeluarga*0.8 && H.rasio < 1.5 ? `<div class="alert warn mt">⚠ Alokasi kebutuhan pokok ${U.rp(alokasiPokok)} masih di bawah kebutuhan keluarga ${U.rp(H.khlKeluarga)} — tutup selisihnya dgn menekan pos lain / tambah penghasilan.</div>` : ''}
          <div class="mt">
            ${Object.entries(B.a).map(([k,v])=>`
              <div class="row between mts"><span>${k} <span class="hint">(${v}% netto)</span>${k==='Kebutuhan pokok'?`<span class="hint"> — vs KHL keluarga ${U.rp(H.khlKeluarga)}</span>`:''}</span><b>${gaji?U.rp(netto*v/100):v+'%'}</b></div>
              <div class="bar-wrap mts"><div class="bar" style="width:${v}%;background:${v>=40?'var(--red)':v>=20?'var(--yel)':'var(--grn)'}"></div></div>`).join('')}
          </div>
        </div>
        <div class="card">
          <h3>Bagaimana tier dihitung?</h3>
          <div style="overflow-x:auto"><table>
            <tr><th>Rasio Gaji/KHL</th><th>Tier</th><th>Fokus utama</th></tr>
            <tr><td>&lt; 100%</td><td><span class="badge b-red">Bertahan</span></td><td>90% kebutuhan pokok — belum saatnya dipaksa investasi</td></tr>
            <tr><td>100–130%</td><td><span class="badge b-yel">Pra-Stabil</span></td><td>Dana darurat mini + tahan gaya hidup</td></tr>
            <tr><td>130–200%</td><td><span class="badge b-pri">Stabil</span></td><td>Mulai investasi rutin 12% + proteksi</td></tr>
            <tr><td>200–350%</td><td><span class="badge b-grn">Mapan</span></td><td>Investasi agresif 25%</td></tr>
            <tr><td>&gt; 350%</td><td><span class="badge b-pur">Sejahtera</span></td><td>Akumulasi aset 35% + filantropi</td></tr>
          </table></div>
        </div>
        ${srcRealtime}`;
    }
  })();
});
