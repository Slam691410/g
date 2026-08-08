/* ========== Proteksi: rekomendasi asuransi yang tepat + manajemen polis ========== */
const Prot = {
  polis(){ return DB.get('polis', []); },
  save(p){ DB.set('polis', p); },
  q(){ return DB.get('prot_q', { usia: 30, merokok: false, tanggungan: 0, utang: 0, bpjs: false, kesehatanSwasta: false, jiwa: false, asetLikuid: 0 }); },

  hitungUP(qz, gajiBulanan){
    // Metode kebutuhan: (pengeluaran keluarga tahunan × 10 th) + utang − aset likuid (pendekatan Human Life Value/DIME yang lazim)
    const tahunan = gajiBulanan * 12;
    return Math.max(0, tahunan * 10 + qz.utang - qz.asetLikuid);
  },
  premiTermLife(usia, up){
    const r = PROTEKSI_REF.termLifePerMille.find(x=>usia<=x.usiaMax) || PROTEKSI_REF.termLifePerMille.at(-1);
    return up / 1000 * r.rate; // premi per tahun
  },

  simpanQ(){
    const qz = {
      usia: Number(document.getElementById('pUsia').value)||30,
      merokok: document.getElementById('pRokok').checked,
      tanggungan: Number(document.getElementById('pTang').value)||0,
      utang: Number(document.getElementById('pUtang').value)||0,
      asetLikuid: Number(document.getElementById('pAset').value)||0,
      bpjs: document.getElementById('pBpjs').checked,
      kesehatanSwasta: document.getElementById('pKesSwasta').checked,
      jiwa: document.getElementById('pJiwa').checked
    };
    DB.set('prot_q', qz); App.navigate();
  },

  addPolis(){
    Modal.open(`
      <h3>＋ Tambah Polis</h3>
      <label class="fl">Jenis</label>
      <select id="plJenis"><option>BPJS Kesehatan</option><option>Asuransi Jiwa (Term Life)</option><option>Asuransi Kesehatan Swasta</option><option>Asuransi Penyakit Kritis</option><option>Asuransi Kendaraan</option><option>Asuransi Properti</option><option>Lainnya</option></select>
      <label class="fl">Penyedia</label><input id="plProv" placeholder="mis. BPJS / Allianz / Prudential">
      <div class="grid g2">
        <div><label class="fl">Premi / bulan (Rp)</label><input id="plPremi" type="number"></div>
        <div><label class="fl">Uang pertanggungan (Rp)</label><input id="plUP" type="number" placeholder="0"></div>
      </div>
      <label class="fl">Jatuh tempo perpanjangan</label><input id="plTempo" type="date">
      <button class="btn mt" onclick="Prot.submitPolis()">Simpan</button>`);
  },
  submitPolis(){
    const prov = document.getElementById('plProv').value.trim();
    if(!prov) return Toast.show('Penyedia wajib diisi');
    const ps = this.polis();
    ps.push({ id: U.uid(), jenis: document.getElementById('plJenis').value, prov,
      premi: Number(document.getElementById('plPremi').value)||0, up: Number(document.getElementById('plUP').value)||0,
      tempo: document.getElementById('plTempo').value });
    this.save(ps); Modal.close(); App.navigate();
  },
  delPolis(id){ this.save(this.polis().filter(p=>p.id!==id)); App.navigate(); }
};

App.register('proteksi', 'Proteksi', function(el){
  const qz = Prot.q();
  const gaji = (DB.get('khl_cfg', {}).gaji) || getProfile().penghasilan || 0;
  const up = Prot.hitungUP(qz, gaji);
  const premiJiwa = Prot.premiTermLife(qz.usia, up) * (qz.merokok ? 1.7 : 1);
  const ps = Prot.polis();
  const totalPremi = ps.reduce((s,p)=>s+p.premi,0);

  // rekomendasi berurutan (piramida proteksi standar)
  const rek = [];
  if(!qz.bpjs) rek.push({ p: 1, nama: 'BPJS Kesehatan (wajib, fondasi)', why: 'Fondasi proteksi kesehatan seluruh keluarga — biaya paling efisien, ditanggung negara.',
    harga: `Iuran resmi/orang: ${BPJS.kelas.map(k=>`${k.nama} ${U.rp(k.iuran)}`).join(' · ')}`, src: BPJS });
  if(qz.tanggungan > 0 && !qz.jiwa) rek.push({ p: 2, nama: 'Asuransi Jiwa Berjangka (Term Life)', why: `Anda punya ${qz.tanggungan} tanggungan — jika terjadi risiko, keluarga kehilangan penghasilan. Term life = UP besar, premi murah (hindari unit link untuk proteksi murni).`,
    harga: gaji ? `Kebutuhan UP ≈ <b>${U.rp(up)}</b> (10× penghasilan tahunan + utang − aset). Estimasi premi ≈ <b>${U.rp(premiJiwa/12)}/bln</b> (${U.rp(premiJiwa)}/th, benchmark usia ${qz.usia}${qz.merokok?', perokok':''})` : 'Isi gaji di modul KHL untuk hitung UP otomatis', src: PROTEKSI_REF });
  if(qz.bpjs && !qz.kesehatanSwasta && gaji > 8000000) rek.push({ p: 3, nama: 'Asuransi Kesehatan Swasta (pelengkap)', why: 'Penghasilan Anda cukup untuk menambah kenyamanan (kamar, non-antre) di atas BPJS.',
    harga: `Kisaran pasar: ${U.rp(PROTEKSI_REF.kesehatanSwastaBulanan.min)}–${U.rp(PROTEKSI_REF.kesehatanSwastaBulanan.max)}/bln — cek premi realtime di tautan bawah`, src: PROTEKSI_REF });
  if(!rek.length) rek.push({ p: 1, nama: 'Proteksi dasar Anda sudah sesuai ✔', why: 'Pertahankan; tinjau ulang UP tiap kali tanggungan/utang bertambah.', harga: '', src: PROTEKSI_REF });

  el.innerHTML = `
    <div class="grid g2 mb">
      <div class="card">
        <h3>🧮 Profil Risiko (rekomendasi menyesuaikan otomatis)</h3>
        <div class="grid g2">
          <div><label class="fl">Usia</label><input id="pUsia" type="number" value="${qz.usia}" onchange="Prot.simpanQ()"></div>
          <div><label class="fl">Jumlah tanggungan</label><input id="pTang" type="number" value="${qz.tanggungan}" onchange="Prot.simpanQ()"></div>
          <div><label class="fl">Total utang (Rp)</label><input id="pUtang" type="number" value="${qz.utang}" onchange="Prot.simpanQ()"></div>
          <div><label class="fl">Aset likuid (Rp)</label><input id="pAset" type="number" value="${qz.asetLikuid}" onchange="Prot.simpanQ()"></div>
        </div>
        <div class="pill-row mt">
          <label class="row" style="gap:5px;font-size:13px"><input type="checkbox" id="pRokok" style="width:auto" ${qz.merokok?'checked':''} onchange="Prot.simpanQ()"> Merokok</label>
          <label class="row" style="gap:5px;font-size:13px"><input type="checkbox" id="pBpjs" style="width:auto" ${qz.bpjs?'checked':''} onchange="Prot.simpanQ()"> Sudah BPJS</label>
          <label class="row" style="gap:5px;font-size:13px"><input type="checkbox" id="pKesSwasta" style="width:auto" ${qz.kesehatanSwasta?'checked':''} onchange="Prot.simpanQ()"> Asuransi kesehatan swasta</label>
          <label class="row" style="gap:5px;font-size:13px"><input type="checkbox" id="pJiwa" style="width:auto" ${qz.jiwa?'checked':''} onchange="Prot.simpanQ()"> Asuransi jiwa</label>
        </div>
      </div>
      <div class="card">
        <h3>✅ Rekomendasi Proteksi yang Tepat (berurutan prioritas)</h3>
        ${rek.map(r=>`
          <div class="alert ${r.p===1?'ok':'info'} mts">
            <b>#${r.p} ${r.nama}</b><br>${r.why}${r.harga?`<div class="hint mts">💰 ${r.harga}</div>`:''}
          </div>`).join('')}
        <div class="divider"></div>
        <b style="font-size:13px">🔗 Cek harga premi terkini (realtime di marketplace berizin OJK):</b>
        <div class="pill-row mt">
          ${PROTEKSI_REF.cekHarga.map(c=>`<a class="btn ghost sm" href="${c.url}" target="_blank" rel="noopener">${c.nama} ↗</a>`).join('')}
        </div>
        ${SRC(BPJS.sumber + ' (iuran resmi)', BPJS.url)}
      </div>
    </div>

    <div class="card">
      <div class="row between mb wrap">
        <h3 style="margin:0">📁 Kelola Polis Saya <span class="badge b-pri">${U.rp(totalPremi)}/bln total premi</span></h3>
        <button class="btn sm" onclick="Prot.addPolis()">＋ Polis</button>
      </div>
      ${gaji && totalPremi ? `<div class="alert ${totalPremi/gaji<=0.1?'ok':'warn'} mb">Premi total = ${U.num(totalPremi/gaji*100,1)}% dari gaji — ideal ≤10% (panduan umum perencana keuangan/OJK).</div>` : ''}
      ${ps.length ? `<div style="overflow-x:auto"><table>
        <tr><th>Jenis</th><th>Penyedia</th><th class="num">Premi/bln</th><th class="num">UP</th><th>Perpanjangan</th><th></th></tr>
        ${ps.map(p=>`<tr>
          <td><b>${U.esc(p.jenis)}</b></td><td>${U.esc(p.prov)}</td>
          <td class="num">${U.rp(p.premi)}</td><td class="num">${U.rp(p.up)}</td>
          <td>${p.tempo ? (new Date(p.tempo)-new Date() < 30*864e5 ? `<span class="down">${U.dt(p.tempo)} ⚠ segera</span>` : U.dt(p.tempo)) : '—'}</td>
          <td><button class="btn ghost sm" onclick="Prot.delPolis('${p.id}')">🗑</button></td></tr>`).join('')}
      </table></div>` : `<div class="empty">Belum ada polis tercatat.</div>`}
    </div>`;
});
