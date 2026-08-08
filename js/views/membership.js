/* ========== Membership: daftar/perpanjang + kode afiliasi + pantau semua komisi ========== */
const Member = {
  async buy(planId){
    const plan = PLANS.find(p=>p.id===planId);
    const ref = (location.hash.split('ref=')[1]||'').slice(0,10);
    try{
      const r = await Store.api('/api/membership/buy', { method:'POST', body:{ plan: planId, ref } });
      Store.cache.user.membership = r.membership;
      await Store.refreshShared();
      App.refreshChrome();
      Toast.show(planId==='free' ? 'Kembali ke paket Free' :
        `Membership ${plan.nama} aktif s.d. ${U.dt(r.membership.expiry)} 🎉 (diproses server)`);
      App.navigate();
    }catch(e){ Toast.show(e.message); }
  },
  copyAff(){
    const link = location.origin + location.pathname + '#/membership?ref=' + affCode();
    navigator.clipboard.writeText(link).then(()=>Toast.show('Link afiliasi tersalin 📋'));
  },
  async simulasiKonversi(){
    try{
      await Store.api('/api/affiliate/convert', { method:'POST', body:{} });
      await Store.refreshShared();
      Toast.show('Konversi tercatat — komisi dihitung server ✔'); App.navigate();
    }catch(e){ Toast.show(e.message); }
  }
};

App.register('membership', 'Membership & Komisi', function(el){
  const m = getMembership();
  const active = m.expiry && new Date(m.expiry) > new Date();
  const meU = Store.me ? Store.me.username : '';
  // ledger bersama (semua pengguna) → tampilkan hanya milik akun ini
  const ledAll = DB.get('ledger', []);
  const mine = l => (l.kode && l.kode === affCode()) || (l.user && l.user === meU);
  const led = ledAll.filter(mine);
  const sum = f => led.filter(f).reduce((s,l)=>s+(l.jumlah||0),0);
  const komisiSistem = sum(l=>l.tipe==='referral-membership');
  const komisiProduk = sum(l=>l.tipe==='komisi-produk');
  const komisiGrup = sum(l=>l.tipe==='langganan-grup');
  const klikCount = led.filter(l=>l.tipe==='klik-afiliasi').length;
  const ref = (location.hash.split('ref=')[1]||'').slice(0,10);

  el.innerHTML = `
    ${ref ? `<div class="alert info mb">Anda datang lewat link afiliasi <b>${U.esc(ref)}</b> — pemilik kode akan mendapat komisi ${KOMISI.membershipRef*100}% saat Anda berlangganan.</div>` : ''}
    <div class="card mb" style="background:linear-gradient(135deg,rgba(169,122,255,.15),rgba(91,140,255,.08))">
      <div class="row between wrap">
        <div>
          <div class="big">${active ? `Membership ${PLANS.find(p=>p.id===m.plan).nama} Aktif ✨` : 'Kamu di paket Free'}</div>
          <div class="sub mts">${active ? `Berlaku sampai <b>${U.dt(m.expiry)}</b> — perpanjang kapan saja, masa aktif ditambahkan.` : 'Upgrade untuk membuka grup berlangganan, keranjang afiliasi & screening lengkap.'}</div>
        </div>
        <div class="chip" style="font-size:14px">Kode Afiliasi: <b>${affCode()}</b></div>
      </div>
    </div>

    <div class="grid g3 mb">
      ${PLANS.map(p=>`
        <div class="card" style="${m.plan===p.id&&active?'border-color:var(--pur)':''}">
          <div class="row between"><h3 style="margin:0">${p.nama}</h3>${m.plan===p.id&&active?'<span class="badge b-pur">AKTIF</span>':''}</div>
          <div class="big mt">${p.harga?U.rp(p.harga):'Gratis'}<span class="hint" style="font-weight:400">${p.harga?'/bulan':''}</span></div>
          <div class="hint mt" style="line-height:1.9">${p.fitur.map(f=>'✔ '+f).join('<br>')}</div>
          ${p.harga ? `<button class="btn ${p.id==='elite'?'pur':''} mt" style="width:100%" onclick="Member.buy('${p.id}')">${m.plan===p.id&&active?'🔁 Perpanjang 1 bulan':'Daftar '+p.nama}</button>`
                    : `<button class="btn ghost mt" style="width:100%" ${!active?'disabled':''} onclick="Member.buy('free')">Turun ke Free</button>`}
        </div>`).join('')}
    </div>

    <div class="grid g2 mb">
      <div class="card">
        <h3>🔗 Link Afiliasi Kamu</h3>
        <div class="hint">Bagikan — setiap pendaftaran membership lewat link ini memberimu komisi <b>${KOMISI.membershipRef*100}%</b>. Semua link produk di kontenmu juga otomatis terbungkus sistem (komisi kamu ${KOMISI.produkUser*100}% + sistem ${KOMISI.produkSistem*100}%).</div>
        <div class="mono mt">${location.origin + location.pathname}#/membership?ref=${affCode()}</div>
        <div class="row mt">
          <button class="btn sm" onclick="Member.copyAff()">📋 Salin link</button>
          <button class="btn ghost sm" onclick="Member.simulasiKonversi()">⚡ Catat konversi dari klik</button>
        </div>
      </div>
      <div class="card">
        <h3>💸 Ringkasan Komisi</h3>
        <div class="row between mts"><span class="sub">Komisi afiliasi sistem (referral membership)</span><b class="up">${U.rp(komisiSistem)}</b></div>
        <div class="row between mts"><span class="sub">Komisi afiliasi produk konten (${klikCount} klik tercatat)</span><b class="up">${U.rp(komisiProduk)}</b></div>
        <div class="row between mts"><span class="sub">Komisi langganan grup Sosial Hub</span><b class="up">${U.rp(komisiGrup)}</b></div>
        <div class="divider"></div>
        <div class="row between"><b>Total komisi</b><b class="up" style="font-size:18px">${U.rp(komisiSistem+komisiProduk+komisiGrup)}</b></div>
      </div>
    </div>

    <div class="card">
      <h3>📜 Riwayat Komisi & Aktivitas Afiliasi</h3>
      ${led.length ? `<div style="overflow-x:auto"><table>
        <tr><th>Waktu</th><th>Tipe</th><th>Kanal</th><th>Detail</th><th class="num">Jumlah</th><th>Status</th></tr>
        ${led.slice(0,30).map(l=>`<tr>
          <td class="hint">${U.dtm(l.at)}</td>
          <td><span class="badge ${l.tipe==='klik-afiliasi'?'b-cyn':l.tipe==='langganan-grup'?'b-pur':l.tipe==='membership'?'b-mut':'b-grn'}">${l.tipe}</span></td>
          <td>${U.esc(l.kanal||'—')}</td>
          <td class="hint">${U.esc(l.detail||l.url||'—')}</td>
          <td class="num ${(l.jumlah||0)>=0?'up':'down'}">${l.jumlah!=null?U.rp(l.jumlah):'—'}</td>
          <td class="hint">${U.esc(l.status||'')}</td></tr>`).join('')}
      </table></div>` : `<div class="empty">Belum ada aktivitas. Bagikan konten dengan keranjang afiliasi, buat grup berlangganan, atau sebarkan link membership-mu.</div>`}
    </div>`;
});
