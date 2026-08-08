/* ========== Dividen: kalender Jan–Des dari riwayat dividen ASLI (Yahoo Finance) ========== */
const Div = {
  bulan: DB.get('div_bulan', 0),
  data: null, loading: false,
  setBulan(b){ this.bulan = b; DB.set('div_bulan', b); App.navigate(); },

  async load(force){
    if(this.loading) return;
    this.loading = true;
    const box = document.getElementById('divBox');
    let done = 0;
    const results = [];
    // batch 6 paralel agar tidak menghantam rate limit relay
    const tickers = DIV_TICKERS.slice();
    const worker = async ()=>{
      while(tickers.length){
        const t = tickers.shift();
        try{ results.push(await API.dividends(t + '.JK', '3y')); }
        catch(e){ results.push({ symbol: t + '.JK', divs: [], error: e.message }); }
        done++;
        const prog = document.getElementById('divProg');
        if(prog) prog.textContent = `Mengambil riwayat dividen asli… ${done}/${DIV_TICKERS.length} emiten`;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
    this.data = results;
    this.loading = false;
    App.navigate();
  },

  perBulan(b){
    if(!this.data) return [];
    const out = [];
    for(const r of this.data){
      if(!r.divs || !r.divs.length) continue;
      const inMonth = r.divs.filter(d=>d.date.getMonth()===b);
      if(!inMonth.length) continue;
      const years = [...new Set(inMonth.map(d=>d.date.getFullYear()))];
      const totalAll = r.divs.reduce((s,d)=>s+d.amount,0);
      const lastYearTotal = r.divs.filter(d=>d.date.getFullYear()>=new Date().getFullYear()-1).reduce((s,d)=>s+d.amount,0);
      out.push({
        t: r.symbol.replace('.JK',''),
        events: inMonth.sort((a,b2)=>b2.date-a.date),
        years, rutin: years.length >= 2,
        dpsSetahun: lastYearTotal, fetchedAt: r.fetchedAt
      });
    }
    return out.sort((a,b2)=>(b2.rutin-a.rutin) || (b2.years.length-a.years.length));
  }
};

App.register('dividen', 'Kalender Dividen', function(el){
  const b = Div.bulan;
  el.innerHTML = `
    <div class="card mb">
      <div class="row between wrap">
        <div>
          <h3 style="margin:0">📅 Perusahaan yang Rutin Bagi Dividen per Bulan (Januari–Desember)</h3>
          <div class="hint mts">Riwayat dividen <b>asli 3 tahun terakhir</b> ditarik langsung dari Yahoo Finance (tanggal ex-dividend & nominal per saham) untuk ${DIV_TICKERS.length} emiten likuid IDX. "Rutin" = membagi di bulan tsb pada ≥2 tahun berbeda.</div>
        </div>
        ${Div.data ? `<button class="btn ghost sm" onclick="Div.data=null;Div.load(true)">↻ Muat ulang</button>` : ''}
      </div>
    </div>
    <div class="tabs">
      ${U.monthsShort.map((m,i)=>`<button class="tab ${i===b?'active':''}" onclick="Div.setBulan(${i})">${m}</button>`).join('')}
    </div>
    <div id="divBox">
      ${Div.data ? renderMonth() : `
        <div class="empty">
          <div id="divProg">Data belum dimuat.</div>
          <button class="btn mt" onclick="Div.load()">📥 Ambil riwayat dividen asli (${DIV_TICKERS.length} emiten, ±20 detik)</button>
        </div>`}
    </div>`;

  if(Div.loading){
    document.getElementById('divBox').innerHTML = `<div class="empty"><div id="divProg">Mengambil riwayat dividen asli…</div></div>`;
  }

  function renderMonth(){
    const rows = Div.perBulan(b);
    if(!rows.length) return `<div class="empty">Tidak ada emiten (dari universe ${DIV_TICKERS.length}) yang tercatat membagi dividen di bulan ${U.months[b]} dalam 3 tahun terakhir.</div>`;
    return `<div class="card" style="overflow-x:auto"><table>
      <tr><th>Emiten</th><th>Status</th><th>Tahun bagi di ${U.months[b]}</th><th>Riwayat di bulan ini (ex-date · Rp/saham)</th><th class="num">DPS ±12 bln</th></tr>
      ${rows.map(r=>`<tr>
        <td><b>${r.t}</b></td>
        <td>${r.rutin?`<span class="badge b-grn">✔ RUTIN (${r.years.length} th)</span>`:`<span class="badge b-yel">1× tercatat</span>`}</td>
        <td>${r.years.sort().join(', ')}</td>
        <td class="hint">${r.events.slice(0,4).map(e=>`${e.date.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'2-digit'})} · Rp${U.num(e.amount,0)}`).join(' &nbsp;|&nbsp; ')}</td>
        <td class="num"><b>Rp${U.num(r.dpsSetahun,0)}</b></td>
      </tr>`).join('')}
    </table>
    ${SRC('Yahoo Finance — riwayat dividen (events=div), data bursa asli', 'https://finance.yahoo.com', rows[0] && rows[0].fetchedAt)}
    </div>
    <div class="hint mt">💡 Strategi: susun portofolio "gaji dividen" dengan memilih emiten rutin dari tiap bulan Januari–Desember. Cek yield efektif = DPS ÷ harga beli Anda; pastikan fundamentalnya tetap sehat lewat modul Screening.</div>`;
  }
});
