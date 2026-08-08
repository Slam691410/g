/* ========== Dashboard — ringkasan realtime lintas modul ========== */
App.register('dashboard', 'Dashboard', function(el){
  const p = getProfile();
  el.innerHTML = `
    <div class="card mb" style="background:linear-gradient(135deg,rgba(91,140,255,.15),rgba(169,122,255,.08))">
      <div class="row between wrap">
        <div>
          <div class="big">Halo, ${U.esc(p.nama || 'Sobat GHub')} 👋</div>
          <div class="sub mts">Semua data pasar & makro di bawah diambil <b>langsung dari sumber aslinya</b> saat halaman dibuka — lengkap dengan atribusi sumber & jam pengambilan.</div>
        </div>
        <button class="btn" onclick="location.hash='#/screening'">🔎 Buka Screening</button>
      </div>
    </div>

    <div class="grid g4 mb" id="dashStats">
      ${['IHSG (^JKSE)','USD/IDR','Bitcoin','Emas (PAXG/oz)'].map(t=>`<div class="stat"><div class="lbl">${t}</div><div class="val">…</div><div class="d sub">memuat…</div></div>`).join('')}
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>📰 Berita Ekonomi Terkini <span class="badge badge-live">LIVE RSS</span></h3>
        <div id="dashNews">${loadingBox('Memuat berita asli dari RSS media nasional…')}</div>
      </div>
      <div>
        <div class="card mb">
          <h3>🧭 Menu Cepat</h3>
          <div class="grid g2">
            ${[['#/social','🌐 Sosial Hub'],['#/project','📋 Projek Tim'],['#/income','💰 Income'],['#/khl','🏡 KHL & Budget'],['#/proteksi','🛡️ Proteksi'],['#/invest','🎯 Tujuan Investasi'],['#/dividen','📅 Dividen'],['#/membership','⭐ Membership']]
              .map(([h,l])=>`<button class="btn ghost" onclick="location.hash='${h}'">${l}</button>`).join('')}
          </div>
        </div>
        <div class="card">
          <h3>🧾 Pertanggungjawaban Data</h3>
          <div class="hint">
            • Harga saham/indeks: <b>Yahoo Finance</b> (data bursa resmi, delayed sesuai ketentuan bursa)<br>
            • Kripto & emas: <b>CoinGecko API</b> · Kurs: <b>ExchangeRate-API</b><br>
            • Makro: <b>World Bank Open Data</b> + ketetapan resmi <b>Bank Indonesia</b><br>
            • UMP 2026: <b>Kemnaker RI (PP 49/2025)</b> · Iuran BPJS: <b>Perpres 64/2020</b><br>
            • Berita: RSS <b>CNBC Indonesia / ANTARA</b> — tautan menuju artikel asli<br>
            Setiap kartu data menampilkan sumber + jam pengambilan. Tidak ada data pasar yang di-hardcode/mock.
          </div>
        </div>
      </div>
    </div>`;

  // Statistik realtime
  (async ()=>{
    const wrap = document.getElementById('dashStats');
    const boxes = wrap.children;
    const setBox = (i, lbl, val, sub, cls)=>{ boxes[i].innerHTML = `<div class="lbl">${lbl}</div><div class="val">${val}</div><div class="d ${cls||'sub'}">${sub}</div>`; };
    try{
      const q = await API.quote('^JKSE');
      setBox(0, 'IHSG (^JKSE)', U.num(q.price,0), (q.chgPct>=0?'▲ +':'▼ ') + U.num(q.chgPct,2) + '% · Yahoo Finance ' + U.time(q.fetchedAt), q.chgPct>=0?'up':'down');
    }catch(e){ setBox(0,'IHSG','—','gagal memuat: '+e.message); }
    try{
      const fx = await API.fx();
      setBox(1, 'USD/IDR', U.num(fx.rates.IDR,0), 'ExchangeRate-API · ' + U.time(fx.fetchedAt));
    }catch(e){ setBox(1,'USD/IDR','—','gagal memuat'); }
    try{
      const cg = await API.cryptoGold();
      const btc = cg.data.bitcoin, gold = cg.data['pax-gold'];
      setBox(2, 'Bitcoin', 'Rp' + U.num(btc.idr/1e6,1) + ' jt', (btc.idr_24h_change>=0?'▲ +':'▼ ') + U.num(btc.idr_24h_change,2) + '%/24j · CoinGecko', btc.idr_24h_change>=0?'up':'down');
      setBox(3, 'Emas (PAXG/oz)', '$' + U.num(gold.usd,0), '≈ ' + U.rp(gold.idr) + ' · CoinGecko ' + U.time(cg.fetchedAt));
    }catch(e){ setBox(2,'Bitcoin','—','gagal memuat'); setBox(3,'Emas','—','gagal memuat'); }
  })();

  // Berita realtime
  (async ()=>{
    const nEl = document.getElementById('dashNews');
    try{
      const news = await API.news();
      nEl.innerHTML = news.items.slice(0,8).map(it=>`
        <div style="padding:9px 0;border-bottom:1px solid rgba(35,46,78,.6)">
          <a href="${U.esc(it.link)}" target="_blank" rel="noopener" style="font-weight:600">${U.esc(it.title)}</a>
          <div class="hint">${U.esc(it.pub)}</div>
        </div>`).join('') + SRC(news.source, news.sourceUrl, news.fetchedAt);
    }catch(e){ nEl.innerHTML = errorBox(e.message); }
  })();
});
