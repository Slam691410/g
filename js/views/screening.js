/* ========== Screening: makro realtime → fase ekonomi → sektor unggulan → emiten
   fundamental + red flag + histori/afiliasi/manajemen/PSP + teknikal entry-exit ========== */
const Scr = {
  tab: DB.get('scr_tab', 'makro'),
  sektor: DB.get('scr_sektor', null),
  emiten: null,
  setTab(t){ this.tab = t; DB.set('scr_tab', t); App.navigate(); },
  setSektor(s){ this.sektor = s; DB.set('scr_sektor', s); this.setTab('emiten'); },

  /* Skor fundamental 0–100 */
  score(e, per, pbv){
    let s = 0;
    if(e.roe != null){ s += e.roe >= 15 ? 25 : e.roe >= 10 ? 18 : e.roe >= 5 ? 8 : 0; }
    if(e.der != null){ s += e.der <= 0.5 ? 15 : e.der <= 1 ? 10 : e.der <= 2 ? 4 : 0; } else s += 10; // bank pakai regulasi CAR
    s += e.npm >= 15 ? 15 : e.npm >= 8 ? 10 : e.npm > 0 ? 5 : 0;
    s += e.growth >= 10 ? 15 : e.growth >= 5 ? 10 : e.growth >= 0 ? 5 : 0;
    if(per != null && per > 0){ s += per <= 10 ? 15 : per <= 15 ? 11 : per <= 25 ? 6 : 2; }
    if(pbv != null && pbv > 0){ s += pbv <= 1.5 ? 15 : pbv <= 3 ? 10 : pbv <= 5 ? 5 : 1; }
    const badHist = e.hist.filter(h=>h.lvl==='bad').length;
    s -= badHist * 30;
    return U.clamp(Math.round(s), 0, 100);
  },
  redFlags(e, per, pbv){
    const f = [];
    if(e.eps <= 0) f.push('Rugi bersih (EPS negatif) pada laporan terakhir');
    if(e.roe != null && e.roe < 5 && e.eps > 0) f.push('ROE < 5% — profitabilitas sangat lemah');
    if(e.der != null && e.der > 2) f.push('DER > 2× — utang berlebihan');
    if(e.growth < -15) f.push('Pendapatan turun tajam (>15%)');
    if(e.bvps <= 0) f.push('Ekuitas negatif — red flag berat');
    if(pbv != null && pbv > 6) f.push('Valuasi PBV sangat mahal (>6×)');
    e.hist.forEach(h=>{ if(h.lvl==='bad') f.push('Histori: ' + h.txt); });
    // MESIN BLACKLIST LINTAS-EMITEN: manajemen/PSP/grup bermasalah menular ke semua emiten terafiliasi
    blacklistHits(e.t).forEach(b=> f.push(`⛔ ENTITAS BERMASALAH: ${b.nama} (${b.tipe}) — ${b.kasus}`));
    return f;
  },
  isExcluded(t){ return blacklistHits(t).length > 0; },

  async openTeknikal(t, nama){
    Modal.open(`<h3>📈 Teknikal ${t} — Entry / Exit</h3><div id="tekBox">${loadingBox('Mengambil 6 bulan data harga asli dari Yahoo Finance…')}</div>`);
    try{
      const h = await API.history(t + '.JK', '6mo', '1d');
      const closes = h.rows.map(r=>r.c);
      const last = closes.at(-1);
      const sma20 = API.sma(closes, 20), sma50 = API.sma(closes, 50);
      const rsi = API.rsi(closes, 14);
      const lows = h.rows.slice(-60).map(r=>r.l), highs = h.rows.slice(-60).map(r=>r.h);
      const support = Math.min(...lows), resist = Math.max(...highs);
      const s20 = sma20.at(-1), s50 = sma50.at(-1);
      const trendUp = s20 != null && s50 != null && s20 > s50 && last > s20;
      const trendDown = s20 != null && s50 != null && s20 < s50 && last < s20;

      let sinyal, cls;
      if(trendUp && rsi < 70){ sinyal = 'ENTRY LAYAK — uptrend (harga > SMA20 > SMA50), RSI belum overbought. Entry bertahap; stop-loss di bawah SMA50/support.'; cls='ok'; }
      else if(trendUp && rsi >= 70){ sinyal = 'TAHAN / TUNGGU — uptrend tapi RSI overbought (>70). Tunggu pullback ke SMA20 untuk entry.'; cls='warn'; }
      else if(trendDown && rsi <= 30){ sinyal = 'PANTAU REVERSAL — downtrend tapi RSI oversold (<30). Jangan menangkap pisau jatuh; tunggu harga kembali di atas SMA20.'; cls='warn'; }
      else if(trendDown){ sinyal = 'HINDARI ENTRY / EXIT — downtrend (harga < SMA20 < SMA50). Bila punya posisi, disiplin stop-loss.'; cls='bad'; }
      else { sinyal = 'SIDEWAYS — tunggu breakout resistance dengan volume, atau beli dekat support dengan stop ketat.'; cls='info'; }

      document.getElementById('tekBox').innerHTML = `
        <canvas id="tekChart" width="520" height="220" style="width:100%;background:#0d1322;border-radius:10px"></canvas>
        <div class="grid g3 mt">
          <div class="stat"><div class="lbl">Harga terakhir</div><div class="val" style="font-size:16px">${U.rp(last)}</div></div>
          <div class="stat"><div class="lbl">RSI(14)</div><div class="val ${rsi>70?'down':rsi<30?'up':''}" style="font-size:16px">${U.num(rsi,1)}</div></div>
          <div class="stat"><div class="lbl">SMA20 / SMA50</div><div class="val" style="font-size:16px">${U.num(s20,0)} / ${U.num(s50,0)}</div></div>
        </div>
        <div class="row mt between"><span class="hint">Support (60 hari): <b class="up">${U.rp(support)}</b></span><span class="hint">Resistance: <b class="down">${U.rp(resist)}</b></span></div>
        <div class="alert ${cls} mt"><b>Sinyal eksekusi:</b> ${sinyal}</div>
        <div class="hint mt">Stop-loss saran: ${U.rp(Math.round(Math.max(support, s50 ? s50*0.97 : support)))} · Target awal: resistance ${U.rp(resist)} (R:R ≥ 1:2 disarankan). Bukan rekomendasi resmi — lakukan analisis mandiri.</div>
        ${SRC(h.source + ' — data harga harian asli', h.sourceUrl, h.fetchedAt)}`;

      // chart
      const cv = document.getElementById('tekChart'); const ctx = cv.getContext('2d');
      const W = cv.width, Hh = cv.height, pad = 8;
      const min = Math.min(...closes), max = Math.max(...closes);
      const x = i => pad + i/(closes.length-1)*(W-2*pad);
      const y = v => Hh-pad - (v-min)/(max-min||1)*(Hh-2*pad);
      const line = (arr, color)=>{ ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.6;
        let started = false;
        arr.forEach((v,i)=>{ if(v==null) return; if(!started){ ctx.moveTo(x(i),y(v)); started=true; } else ctx.lineTo(x(i),y(v)); });
        ctx.stroke(); };
      line(closes, '#7aa2ff'); line(sma20, '#2fd882'); line(sma50, '#ffc45d');
      ctx.fillStyle = '#8b96b5'; ctx.font = '11px sans-serif';
      ctx.fillText('— Harga', 12, 14); ctx.fillStyle='#2fd882'; ctx.fillText('— SMA20', 70, 14); ctx.fillStyle='#ffc45d'; ctx.fillText('— SMA50', 130, 14);
    }catch(e){ document.getElementById('tekBox').innerHTML = errorBox(e.message); }
  },

  openRiset(t, nama){
    const em = Object.values(EMITEN).flat().find(x=>x.t===t);
    const bl = blacklistHits(t);
    const lintas = blacklistLintas(t);
    Modal.open(`
      <h3>🕵️ Riset Histori ${t} — ${U.esc(nama)}</h3>
      <div class="hint">Histori perusahaan, afiliasi, manajemen & PSP — plus <b>intel berita seluruh internet</b> (agregasi ribuan media) yang dipindai kata kunci risiko secara otomatis.</div>

      ${bl.length ? bl.map(b=>`<div class="alert bad mts">⛔ <b>ENTITAS BERMASALAH — ${U.esc(b.nama)}</b> (${U.esc(b.tipe)})<br>${U.esc(b.kasus)}
        ${b.lintas?`<div class="hint mts">🔗 Lintas emiten — entitas ini juga terkait: <b>${b.tickers.filter(x=>x!==t).join(', ')}</b> → semuanya ikut ter-EXCLUDE.</div>`:''}</div>`).join('')
      : ''}
      ${lintas.length && !bl.length ? `<div class="alert warn mts">🔗 Terjangkit lintas-emiten: ${lintas.map(U.esc).join('; ')}</div>` : ''}
      ${em && em.hist.length ? em.hist.map(h=>`<div class="alert ${h.lvl==='bad'?'bad':'warn'} mts">${h.lvl==='bad'?'🚩':'⚠️'} ${U.esc(h.txt)}</div>`).join('') : ''}
      ${!bl.length && !(em && em.hist.some(h=>h.lvl==='bad')) ? `<div class="alert ok mts">✔ Tidak ada catatan di registri entitas bermasalah (${ENTITAS_BERMASALAH.length} entitas, lintas-emiten). Cek juga intel berita di bawah.</div>` : ''}

      <div class="divider"></div>
      <b style="font-size:13px">📡 Intel Media — himpunan berita internet ttg ${t} <span class="badge b-cyn">pindai otomatis</span></b>
      <div id="intelBox" class="mts">${loadingBox('Menghimpun berita dari ribuan media (Google News RSS) & memindai kata kunci risiko…')}</div>

      <div class="divider"></div>
      <b style="font-size:13px">Checklist wajib sebelum beli:</b>
      <div class="hint mt" style="line-height:1.9">
        ☐ Keterbukaan informasi & sanksi di IDX (5 th terakhir)<br>
        ☐ Rekam jejak direksi/komisaris — <b>cek juga jabatan mereka di emiten lain</b><br>
        ☐ PSP & afiliasi: transaksi pihak berelasi yang merugikan minoritas? <b>Grup yang sama di emiten lain bermasalah?</b><br>
        ☐ Aksi korporasi (rights issue dilutif, private placement murah) + mitigasi: baca prospektus, hitung dilusi, cek penggunaan dana<br>
        ☐ Opini auditor & pergantian auditor mendadak<br>
        ☐ Sentimen sosial media (tautan di bawah)
      </div>
      <div class="pill-row mt">
        ${risetLinks(t, nama).map(l=>`<a class="btn ghost sm" href="${l.url}" target="_blank" rel="noopener">${l.nama} ↗</a>`).join('')}
      </div>`);

    // Intel: himpun berita internet per emiten + pindai risiko
    (async ()=>{
      const box = document.getElementById('intelBox'); if(!box) return;
      try{
        const news = await API.gnews(`"${t}" OR "${nama}" saham`);
        const scan = API.riskScan(news.items);
        box.innerHTML = `
          <div class="row wrap mb" style="gap:6px">
            <span class="badge ${scan.risk.length? 'b-red':'b-grn'}">🚨 ${scan.risk.length} berita berindikasi risiko</span>
            <span class="badge b-grn">👍 ${scan.good.length} positif</span>
            <span class="badge b-mut">${scan.total} artikel dihimpun</span>
            ${scan.risk.length ? `<span class="badge b-red">skor risiko media ${scan.riskScore}%</span>` : ''}
          </div>
          ${scan.risk.slice(0,5).map(r=>`<div class="alert bad mts" style="padding:8px 10px">🚨 <a href="${U.esc(r.item.link)}" target="_blank" rel="noopener">${U.esc(r.item.title)}</a><div class="hint">kata terpicu: ${r.words.join(', ')}</div></div>`).join('')}
          ${news.items.slice(0,6).map(it=>`<div style="padding:6px 0;border-bottom:1px solid rgba(35,46,78,.5)"><a href="${U.esc(it.link)}" target="_blank" rel="noopener" style="font-size:12.5px">${U.esc(it.title)}</a></div>`).join('')}
          ${SRC(news.source, 'https://news.google.com', news.fetchedAt)}
          <div class="hint mts">Sosial media: API X/Stockbit tidak tersedia gratis — gunakan tombol X & Stockbit di bawah utk menyelami sentimen manual.</div>`;
        if(scan.risk.length >= 3) box.insertAdjacentHTML('afterbegin',
          `<div class="alert bad mb"><b>⛔ Auto red-flag media:</b> ${scan.risk.length} pemberitaan berindikasi risiko terdeteksi — hindari entry sampai terverifikasi bersih.</div>`);
      }catch(e){ box.innerHTML = errorBox(e.message); }
    })();
  }
};

App.register('screening', 'Screening Saham', function(el){
  const tab = Scr.tab;
  el.innerHTML = `
    <div class="tabs">
      <button class="tab ${tab==='makro'?'active':''}" onclick="Scr.setTab('makro')">🌏 1. Makro & Fase</button>
      <button class="tab ${tab==='emiten'?'active':''}" onclick="Scr.setTab('emiten')">🏆 2. Emiten Unggulan</button>
    </div>
    <div id="scrBody">${loadingBox('Mengambil data makro & pasar realtime dari World Bank, Yahoo Finance, CoinGecko…')}</div>`;

  const body = ()=>document.getElementById('scrBody');

  if(tab==='makro'){
    (async ()=>{
      const [gdp, inf, unemp, ca, jkse, fx, cg] = await Promise.all([
        API.worldBank('NY.GDP.MKTP.KD.ZG','Pertumbuhan PDB riil (% YoY)').catch(e=>null),
        API.worldBank('FP.CPI.TOTL.ZG','Inflasi CPI (% YoY)').catch(e=>null),
        API.worldBank('SL.UEM.TOTL.ZS','Pengangguran (% angkatan kerja)').catch(e=>null),
        API.worldBank('BN.CAB.XOKA.GD.ZS','Neraca transaksi berjalan (% PDB)').catch(e=>null),
        API.quote('^JKSE').catch(e=>null),
        API.fx().catch(e=>null),
        API.cryptoGold().catch(e=>null)
      ]);
      if(!body()) return;

      // Penentuan fase ekonomi (heuristik dari data asli)
      const g = gdp && gdp.value, i = inf && inf.value;
      const gTrend = gdp && gdp.series.length>=2 ? gdp.series.at(-1).value - gdp.series.at(-2).value : 0;
      let fase;
      if(g == null) fase = 'Ekspansi Tengah';
      else if(g < 3) fase = 'Kontraksi';
      else if(g >= 4.5 && i != null && i > 4) fase = 'Ekspansi Akhir';
      else if(g >= 4.5 && gTrend >= 0) fase = 'Ekspansi Tengah';
      else if(g >= 3 && gTrend > 0) fase = 'Ekspansi Awal';
      else fase = 'Ekspansi Akhir';
      DB.set('scr_fase', fase);
      const F = FASE_SEKTOR[fase];

      const wbCard = (d, suffix)=> d ? `
        <div class="stat"><div class="lbl">${d.label}</div><div class="val">${U.num(d.value,2)}${suffix||'%'}</div>
        <div class="d sub">data ${d.year} · World Bank · ${U.time(d.fetchedAt)}</div></div>`
        : `<div class="stat"><div class="lbl">—</div><div class="val">—</div><div class="d sub">gagal memuat</div></div>`;

      body().innerHTML = `
        <div class="grid g4 mb">
          ${wbCard(gdp)}${wbCard(inf)}${wbCard(unemp)}${wbCard(ca, '% PDB')}
        </div>
        <div class="grid g4 mb">
          <div class="stat"><div class="lbl">BI-Rate (ketetapan resmi)</div><div class="val">${U.pct(BI_RATE.rate)}</div>
            <div class="d sub">${BI_RATE.rdg} · <a href="${BI_RATE.url}" target="_blank">BI</a></div></div>
          <div class="stat"><div class="lbl">IHSG</div><div class="val">${jkse?U.num(jkse.price,0):'—'}</div>
            <div class="d ${jkse&&jkse.chgPct>=0?'up':'down'}">${jkse?(jkse.chgPct>=0?'▲ +':'▼ ')+U.num(jkse.chgPct,2)+'%':'gagal'} · Yahoo ${jkse?U.time(jkse.fetchedAt):''}</div></div>
          <div class="stat"><div class="lbl">USD/IDR</div><div class="val">${fx?U.num(fx.rates.IDR,0):'—'}</div>
            <div class="d sub">${fx?'ExchangeRate-API · '+U.time(fx.fetchedAt):'gagal'}</div></div>
          <div class="stat"><div class="lbl">Emas (PAXG)</div><div class="val">${cg?'$'+U.num(cg.data['pax-gold'].usd,0):'—'}</div>
            <div class="d sub">${cg?'CoinGecko · '+U.time(cg.fetchedAt):'gagal'}</div></div>
        </div>

        <div class="card mb">
          <div class="row between wrap">
            <h3 style="margin:0">🧭 Fase Ekonomi Terdeteksi: <span class="badge b-pri" style="font-size:14px">${fase}</span></h3>
          </div>
          <div class="hint mt">Dihitung dari PDB ${g!=null?U.num(g,2)+'%':'—'} (tren ${gTrend>=0?'naik':'turun'}), inflasi ${i!=null?U.num(i,2)+'%':'—'}, BI-Rate ${BI_RATE.rate}% — heuristik siklus bisnis atas data resmi di atas.</div>
          <div class="alert info mt"><b>Sektor paling diunggulkan pada fase ini:</b><br>${F.alasan}</div>
          <div class="pill-row mt">
            ${F.sektor.map((s,idx)=>`<button class="btn ${idx===0?'grn':'ghost'} sm" onclick="Scr.setSektor('${s}')">${idx===0?'⭐ ':''}${s} ➜</button>`).join('')}
          </div>
          ${SRC(FASE_SRC.label, FASE_SRC.url)}
        </div>

        <div class="card">
          <h3>📰 Berita makro terkini (asli, tertaut sumber)</h3>
          <div id="scrNews">${loadingBox('Memuat RSS…')}</div>
        </div>`;

      try{
        const news = await API.news();
        const nEl = document.getElementById('scrNews');
        if(nEl) nEl.innerHTML = news.items.slice(0,6).map(it=>
          `<div style="padding:8px 0;border-bottom:1px solid rgba(35,46,78,.6)"><a href="${U.esc(it.link)}" target="_blank" rel="noopener">${U.esc(it.title)}</a> <span class="hint">· ${U.esc(it.pub.slice(0,22))}</span></div>`).join('')
          + SRC(news.source, news.sourceUrl, news.fetchedAt);
      }catch(e){ const nEl=document.getElementById('scrNews'); if(nEl) nEl.innerHTML = errorBox(e.message); }
    })();
  }
  else { // emiten
    const fase = DB.get('scr_fase', 'Ekspansi Tengah');
    const unggulan = FASE_SEKTOR[fase].sektor;
    const sektor = Scr.sektor && EMITEN[Scr.sektor] ? Scr.sektor : unggulan[0];
    Scr.sektor = sektor;

    body().innerHTML = `
      <div class="row between mb wrap">
        <div class="pill-row">
          ${Object.keys(EMITEN).map(s=>`<button class="tab ${s===sektor?'active':''}" onclick="Scr.setSektor('${s}')">${unggulan.includes(s)?'⭐':''} ${s}</button>`).join('')}
        </div>
      </div>
      ${unggulan.includes(sektor)
        ? `<div class="alert ok mb">⭐ <b>${sektor}</b> termasuk sektor unggulan fase <b>${fase}</b> — lanjut pilih emiten fundamental terbaik & bebas red flag di bawah.</div>`
        : `<div class="alert warn mb"><b>${sektor}</b> BUKAN sektor unggulan fase ${fase} (unggulan: ${unggulan.join(', ')}). Boleh riset, tapi bobot portofolio sebaiknya kecil.</div>`}
      <div id="emTable">${loadingBox('Mengambil harga realtime tiap emiten dari Yahoo Finance untuk hitung PER/PBV live…')}</div>`;

    (async ()=>{
      const list = EMITEN[sektor];
      const qs = await API.quotes(list.map(e=>e.t + '.JK'));
      const rows = list.map(e=>{
        const q = qs[e.t + '.JK'];
        const price = q && !q.error ? q.price : null;
        const per = price!=null && e.eps>0 ? price/e.eps : null;
        const pbv = price!=null && e.bvps>0 ? price/e.bvps : null;
        const flags = Scr.redFlags(e, per, pbv);
        const score = Scr.score(e, per, pbv);
        return { e, q, price, per, pbv, flags, score };
      }).sort((a,b)=>b.score-a.score);
      const box = document.getElementById('emTable'); if(!box) return;
      const best = rows.filter(r=>r.score>=70 && !r.flags.length);

      box.innerHTML = `
        ${best.length ? `<div class="alert ok mb">✅ <b>Rekomendasi teratas sektor ini (skor ≥70, nol red flag, lolos registri entitas bermasalah lintas-emiten):</b> ${best.map(r=>`<b>${r.e.t}</b> (skor ${r.score})`).join(' · ')} — tetap jalankan 🕵️ intel media & checklist sebelum beli.</div>`
        : `<div class="alert warn mb">Tidak ada emiten di sektor ini yang lolos saringan ketat (skor ≥70 + nol red flag + bebas entitas bermasalah).</div>`}
        <div class="alert bad mb" style="font-size:12px">⛔ <b>Prinsip eksklusi keras:</b> fundamental buruk, aksi korporasi merugikan, manajemen/perusahaan/afiliasi pernah bermasalah, atau PSP tercela → <b>otomatis tidak direkomendasikan</b>. Registri entitas bermasalah bersifat <b>lintas-emiten</b> (${ENTITAS_BERMASALAH.length} entitas terpantau — satu nama bermasalah menular ke semua emiten terafiliasinya).</div>
        <div class="card" style="overflow-x:auto"><table>
          <tr><th>Skor</th><th>Emiten</th><th class="num">Harga <span class="badge badge-live">LIVE</span></th><th class="num">±%</th><th class="num">PER</th><th class="num">PBV</th><th class="num">ROE</th><th class="num">DER</th><th class="num">NPM</th><th class="num">Growth</th><th>Red Flag</th><th>Aksi</th></tr>
          ${rows.map(r=>`<tr>
            <td><span class="score-ring" style="font-size:16px;color:${r.score>=70?'var(--grn)':r.score>=45?'var(--yel)':'var(--red)'}">${r.score}</span></td>
            <td><b>${r.e.t}</b><div class="hint">${U.esc(r.e.n)}</div></td>
            <td class="num">${r.price!=null?U.rp(r.price):'<span class="hint">gagal</span>'}</td>
            <td class="num ${r.q&&r.q.chgPct>=0?'up':'down'}">${r.q&&!r.q.error?U.num(r.q.chgPct,1)+'%':'—'}</td>
            <td class="num">${r.per!=null?U.num(r.per,1)+'×':'—'}</td>
            <td class="num">${r.pbv!=null?U.num(r.pbv,1)+'×':'—'}</td>
            <td class="num">${r.e.roe!=null?U.num(r.e.roe,1)+'%':'n/a'}</td>
            <td class="num">${r.e.der!=null?U.num(r.e.der,1)+'×':'bank'}</td>
            <td class="num">${U.num(r.e.npm,0)}%</td>
            <td class="num ${r.e.growth>=0?'up':'down'}">${U.num(r.e.growth,0)}%</td>
            <td>${Scr.isExcluded(r.e.t)?`<span class="badge b-red" title="${U.esc(r.flags.join(' | '))}">⛔ EXCLUDED</span>`:r.flags.length?`<span class="badge b-red" title="${U.esc(r.flags.join(' | '))}">🚩 ${r.flags.length}</span>`:`<span class="badge b-grn">✔ bersih</span>`}</td>
            <td class="row" style="gap:4px">
              <button class="btn ghost sm" title="Riset histori & sosmed" onclick="Scr.openRiset('${r.e.t}','${U.esc(r.e.n)}')">🕵️</button>
              <button class="btn ghost sm" title="Teknikal entry/exit" onclick="Scr.openTeknikal('${r.e.t}','${U.esc(r.e.n)}')">📈</button>
            </td>
          </tr>`).join('')}
        </table>
        ${SRC('Harga: Yahoo Finance (live) · EPS/BVPS & rasio: ' + EMITEN_SRC.label, EMITEN_SRC.url)}
        </div>
        <div class="hint mt">Alur lengkap: fase makro → sektor unggulan → skor fundamental (ROE, DER, NPM, growth, PER & PBV dihitung dari <b>harga live</b>) → saring red flag → 🕵️ selami histori perusahaan/manajemen/PSP di berita & sosmed → 📈 eksekusi entry/exit pakai teknikal (SMA, RSI, support/resistance). Bukan nasihat investasi.</div>`;
    })().catch(e=>{ const box=document.getElementById('emTable'); if(box) box.innerHTML = errorBox(e.message); });
  }
});
