/* ========== Profil: data pribadi, keluarga & tanggungan ========== */
App.register('profil', 'Profil', function(el){
  const p = getProfile();
  const kc = DB.get('khl_cfg', { pasangan:false, tanggunganLain:0 });
  const anak = DB.get('khl_anak', []);
  el.innerHTML = `
    <div class="grid g2">
      <div class="card">
        <h3>👤 Data Pribadi</h3>
        <label class="fl">Nama lengkap</label><input id="prNama" value="${U.esc(p.nama)}" placeholder="Nama Anda">
        <div class="grid g2">
          <div><label class="fl">Email</label><input id="prEmail" type="email" value="${U.esc(p.email)}"></div>
          <div><label class="fl">No. HP</label><input id="prTelp" value="${U.esc(p.telp)}"></div>
        </div>
        <div class="grid g2">
          <div><label class="fl">Tanggal lahir</label><input id="prLahir" type="date" value="${p.lahir||''}"></div>
          <div><label class="fl">Status</label>
            <select id="prStatus"><option value="lajang" ${p.status==='lajang'?'selected':''}>Lajang</option>
            <option value="menikah" ${p.status==='menikah'?'selected':''}>Menikah</option></select></div>
        </div>
        <div class="grid g2">
          <div><label class="fl">Provinsi domisili</label>
            <select id="prProv">${Object.keys(UMP2026.data).map(x=>`<option ${p.provinsi===x?'selected':''}>${x}</option>`).join('')}</select></div>
          <div><label class="fl">Kota</label><input id="prKota" value="${U.esc(p.kota)}"></div>
        </div>
        <div class="grid g2">
          <div><label class="fl">Pekerjaan</label><input id="prKerja" value="${U.esc(p.pekerjaan)}"></div>
          <div><label class="fl">Penghasilan/bulan (Rp)</label><input id="prGaji" type="number" value="${p.penghasilan||''}"></div>
        </div>
        <label class="fl">Bio singkat (tampil di Sosial Hub)</label><textarea id="prBio" rows="2">${U.esc(p.bio)}</textarea>
        <button class="btn mt" onclick="Profil.save()">💾 Simpan Profil</button>
      </div>
      <div>
        <div class="card mb">
          <h3>👨‍👩‍👧 Keluarga & Tanggungan <span class="badge b-cyn">dipakai modul KHL, Proteksi & Tujuan Investasi</span></h3>
          <div class="row wrap">
            <label class="row" style="gap:5px;font-size:13px"><input type="checkbox" id="prPasangan" style="width:auto" ${kc.pasangan?'checked':''} onchange="Profil.saveKeluarga()"> Punya pasangan</label>
            <div class="row" style="gap:6px;flex:1;min-width:180px">
              <label class="fl" style="margin:0;white-space:nowrap">Tanggungan dewasa lain</label>
              <input id="prTanggungan" type="number" min="0" value="${kc.tanggunganLain||0}" style="width:70px" onchange="Profil.saveKeluarga()" title="orang tua, adik/kakak, kerabat yang Anda tanggung">
            </div>
          </div>
          <div class="divider"></div>
          <div class="row between wrap">
            <b style="font-size:13px">👶 Data Anak (${anak.length})</b>
            <button class="btn sm" onclick="KHL.addAnak()">＋ Tambah anak</button>
          </div>
          ${anak.length ? anak.map(a=>`
            <div class="row between mts" style="border-bottom:1px solid rgba(35,46,78,.6);padding-bottom:7px">
              <span><b>${U.esc(a.nama)}</b> <span class="hint">· lahir ${U.dt(a.lahir)} (${U.age(a.lahir)} th) · sekolah ${a.sek}</span></span>
              <button class="btn ghost sm" onclick="KHL.delAnak('${a.id}')">🗑</button>
            </div>`).join('')
          : `<div class="hint mts">Belum ada data anak. Tanggal lahir anak dipakai otomatis untuk: jalur & biaya sekolah (KHL), skala kebutuhan keluarga, dan tujuan Dana Pendidikan.</div>`}
        </div>
        <div class="card mb">
          <h3>🔗 Terhubung dengan modul lain</h3>
          <div class="hint" style="line-height:1.8">
            • <b>Provinsi</b> → default perbandingan UMP/KHL<br>
            • <b>Penghasilan</b> → basis rekomendasi Proteksi & Budget<br>
            • <b>Pasangan, tanggungan & anak</b> → Kebutuhan Keluarga (KHL), UP asuransi, Dana Pendidikan & Pensiun<br>
            • <b>Tanggal lahir</b> → usia untuk premi asuransi & rencana pensiun<br>
            • <b>Nama</b> → identitas konten Sosial Hub & grup
          </div>
        </div>
        <div class="card">
          <h3>💾 Data Anda</h3>
          <div class="hint">Akun: <b>@${Store.me?Store.me.username:'—'}</b>. Semua data tersimpan di <b>database server (SQLite)</b> per akun — bisa diakses dari perangkat mana pun dengan login.</div>
          <div class="row mt wrap">
            <button class="btn ghost sm" onclick="Profil.exportData()">⬇ Ekspor JSON</button>
            <button class="btn ghost sm" onclick="Profil.importData()">⬆ Impor JSON</button>
            <button class="btn red sm" onclick="Profil.reset()">🗑 Hapus semua data</button>
          </div>
        </div>
      </div>
    </div>`;
});

const Profil = {
  USER_KEYS: ['profile','membership','tasks','projects','txs','holdings','khl_cfg','khl_anak','khl_biaya','khl_kelompok','utang','polis','goals','prot_q','income_tab','khl_tab','proj_view','social_tab','scr_tab','scr_sektor','scr_fase','div_bulan'],
  saveKeluarga(){
    const c = DB.get('khl_cfg', {});
    c.pasangan = document.getElementById('prPasangan').checked;
    c.tanggunganLain = Math.max(0, Number(document.getElementById('prTanggungan').value)||0);
    DB.set('khl_cfg', c);
    Toast.show('Data keluarga tersimpan — otomatis dipakai KHL, Proteksi & Tujuan Investasi ✔');
  },
  save(){
    const p = {
      nama: document.getElementById('prNama').value.trim(),
      email: document.getElementById('prEmail').value.trim(),
      telp: document.getElementById('prTelp').value.trim(),
      lahir: document.getElementById('prLahir').value,
      status: document.getElementById('prStatus').value,
      provinsi: document.getElementById('prProv').value,
      kota: document.getElementById('prKota').value.trim(),
      pekerjaan: document.getElementById('prKerja').value.trim(),
      penghasilan: Number(document.getElementById('prGaji').value)||0,
      bio: document.getElementById('prBio').value.trim()
    };
    DB.set('profile', p);
    const cfg = DB.get('khl_cfg', {}); cfg.provinsi = p.provinsi; if(p.penghasilan) cfg.gaji = cfg.gaji || p.penghasilan; DB.set('khl_cfg', cfg);
    App.refreshChrome(); Toast.show('Profil tersimpan ke database ✔');
  },
  exportData(){
    const out = { _akun: Store.me ? Store.me.username : '', _diekspor: new Date().toISOString(), data: Store.cache.user };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
    a.download = 'ghub-one-backup.json'; a.click();
  },
  importData(){
    const inp = document.createElement('input'); inp.type='file'; inp.accept='.json';
    inp.onchange = ()=>{ const f = inp.files[0]; const r = new FileReader();
      r.onload = ()=>{ try{ const d = JSON.parse(r.result);
        const data = d.data || d;
        Object.entries(data).forEach(([k,v])=>{ if(this.USER_KEYS.includes(k)) DB.set(k, v); });
        Toast.show('Data terimpor & tersinkron ke server ✔'); App.refreshChrome(); App.navigate();
      }catch(e){ Toast.show('File tidak valid'); } };
      r.readAsText(f); };
    inp.click();
  },
  reset(){
    if(!confirm('Hapus SEMUA data akun ini di database server?')) return;
    this.USER_KEYS.forEach(k=>{ if(k!=='membership') DB.set(k, null); });
    Toast.show('Data akun dikosongkan'); App.refreshChrome(); setTimeout(()=>App.navigate(), 500);
  }
};
