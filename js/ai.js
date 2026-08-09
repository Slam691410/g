/* ========== AI Asisten GHub One ==========
 * Dua lapis, jujur & transparan:
 * 1) ANALISIS CERDAS LOKAL (rule-based/heuristik) — berjalan di perangkat,
 *    membaca data Anda sendiri (income, KHL, proteksi, tujuan, aset) dan
 *    menyusun insight + rekomendasi. Tanpa kirim data ke mana pun.
 * 2) AI GENERATIF (opsional, BYO API key) — sambungkan endpoint kompatibel
 *    OpenAI (OpenAI/Groq/OpenRouter/lokal Ollama). Key disimpan HANYA di
 *    perangkat Anda, tidak pernah dikirim ke server GHub.
 */
const AI = {
  cfg(){ return JSON.parse(localStorage.getItem('ghub_ai_cfg') || '{"endpoint":"https://api.openai.com/v1/chat/completions","model":"gpt-4o-mini","key":""}'); },
  saveCfg(){
    localStorage.setItem('ghub_ai_cfg', JSON.stringify({
      endpoint: document.getElementById('aiEp').value.trim(),
      model: document.getElementById('aiModel').value.trim(),
      key: document.getElementById('aiKey').value.trim()
    }));
    Toast.show('Konfigurasi AI tersimpan (hanya di perangkat ini) 🔒');
  },

  /* ---- ringkasan data pengguna (utk insight lokal & konteks LLM) ---- */
  context(){
    const now = new Date();
    const ts = DB.get('txs', []);
    const inMonth = t => { const d = new Date(t.tgl); return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear(); };
    const masuk = ts.filter(t=>t.tipe==='Pemasukan'&&inMonth(t)).reduce((s,t)=>s+t.nilai,0);
    const keluar = ts.filter(t=>t.tipe==='Pengeluaran'&&inMonth(t)).reduce((s,t)=>s+t.nilai,0);
    const kc = DB.get('khl_cfg', {});
    const anak = DB.get('khl_anak', []);
    const goals = DB.get('goals', []);
    const polis = DB.get('polis', []);
    const utang = DB.get('utang', []).filter(u=>!u.lunas);
    const holds = DB.get('holdings', []);
    const m = getMembership();
    return { masuk, keluar, gaji: kc.gaji||0, pasangan: !!kc.pasangan, tanggunganLain: kc.tanggunganLain||0,
      anak: anak.length, goals: goals.length, goalNames: goals.map(g=>g.nama).slice(0,10),
      polis: polis.length, utangAktif: utang.length,
      totalUtang: utang.filter(u=>u.jenis==='hutang').reduce((s,u)=>s+u.nilai,0),
      cicilan: utang.filter(u=>u.jenis==='hutang').reduce((s,u)=>s+u.cicil,0),
      asetJenis: [...new Set(holds.map(h=>h.jenis))], nAset: holds.length,
      plan: m.plan, provinsi: kc.provinsi||getProfile().provinsi };
  },

  /* ---- 1) insight lokal rule-based ---- */
  localInsights(){
    const c = this.context();
    const out = [];
    if(!c.gaji) out.push(['warn','Gaji belum diisi (menu KHL) — sebagian besar analisis butuh ini. Isi dulu agar AI bisa menilai kesehatan finansialmu.']);
    if(c.masuk || c.keluar){
      const net = c.masuk - c.keluar;
      out.push([net>=0?'ok':'bad', `Arus kas bulan ini: pemasukan ${U.rp(c.masuk)} − pengeluaran ${U.rp(c.keluar)} = <b>${U.rp(net)}</b> ${net>=0?'(surplus — alokasikan sesuai Budget Dinamis)':'(DEFISIT — audit kategori pengeluaran terbesar di modul Income)'}`]);
    } else out.push(['info','Belum ada transaksi bulan ini — catat rutin agar dana darurat & pensiun dihitung dari pengeluaran NYATA, bukan asumsi.']);
    if(c.gaji && c.cicilan){
      const dsr = c.cicilan/c.gaji*100;
      out.push([dsr>35?'bad':'ok', `Rasio cicilan (DSR): <b>${U.num(dsr,0)}%</b> dari gaji ${dsr>35?'— MELEBIHI ambang sehat 35%! Prioritaskan pelunasan bunga tertinggi (avalanche)':'— masih sehat (≤35%)'}`]);
    }
    if(c.pasangan || c.anak || c.tanggunganLain){
      const nT = (c.pasangan?1:0)+c.anak+c.tanggunganLain;
      const punyaJiwa = DB.get('polis',[]).some(p=>/jiwa/i.test(p.jenis));
      if(!punyaJiwa) out.push(['warn', `Kamu punya ${nT} tanggungan tapi belum tercatat punya asuransi JIWA — jika terjadi risiko, penghasilan keluarga hilang. Buka modul Proteksi (term life, bukan unit link).`]);
      else out.push(['ok', `${nT} tanggungan & asuransi jiwa sudah ada ✔ — tinjau ulang UP tiap tanggungan/utang bertambah.`]);
    }
    if(c.anak && !DB.get('goals',[]).some(g=>g.kat==='Pendidikan Anak'))
      out.push(['warn', `Ada ${c.anak} anak tapi belum ada tujuan Dana Pendidikan — biaya pendidikan naik ±10%/th. Buka Tujuan Investasi → 🎓 generator otomatis.`]);
    if(!DB.get('pensiun', null)) out.push(['info','Dana Pensiun belum direncanakan — makin muda mulai, makin ringan setorannya (bunga majemuk). Buka menu Legacy.']);
    if(c.nAset){
      out.push(['info', `Portofolio: ${c.nAset} aset di ${c.asetJenis.length} kelas (${c.asetJenis.join(', ')}). ${c.asetJenis.length<3?'Diversifikasi masih sempit — pertimbangkan sebar ke kelas lain.':'Diversifikasi lintas kelas sudah baik ✔'}`]);
    } else out.push(['info','Belum ada aset tercatat di Income → tab Aset. Catat agar kekayaan bersih & progres tujuan terpantau otomatis.']);
    out.push(['info','Semua analisis di atas dihitung heuristik LOKAL dari datamu sendiri — tanpa keluar dari perangkat. Untuk tanya-jawab bebas, sambungkan LLM di bawah (opsional).']);
    return out;
  },

  open(){
    const cfg = this.cfg();
    Modal.open(`
      <h3>🤖 AI Asisten Finansial</h3>
      <div class="hint">Lapis 1: analisis heuristik lokal (privasi penuh). Lapis 2: LLM generatif opsional (BYO key — tersimpan hanya di perangkatmu).</div>
      <button class="btn grn mt" onclick="AI.renderInsights()">⚡ Analisis Cerdas Datamu (lokal, instan)</button>
      <div id="aiInsights" class="mt"></div>
      <div class="divider"></div>
      <details ${cfg.key?'open':''}>
        <summary style="cursor:pointer;font-weight:700;font-size:13px">🧠 AI Generatif (opsional — OpenAI/Groq/OpenRouter/Ollama)</summary>
        <div class="grid g2 mt">
          <div><label class="fl">Endpoint (OpenAI-compatible)</label><input id="aiEp" value="${U.esc(cfg.endpoint)}"></div>
          <div><label class="fl">Model</label><input id="aiModel" value="${U.esc(cfg.model)}"></div>
        </div>
        <label class="fl">API Key <span class="hint">(disimpan lokal, TIDAK dikirim ke server GHub)</span></label>
        <input id="aiKey" type="password" value="${U.esc(cfg.key)}" placeholder="sk-…">
        <button class="btn ghost sm mt" onclick="AI.saveCfg()">💾 Simpan konfigurasi</button>
        <label class="fl">Pertanyaanmu</label>
        <textarea id="aiQ" rows="2" placeholder="mis. Dengan gaji & tanggunganku, mana yang kudahulukan: lunasi utang atau mulai investasi?"></textarea>
        <button class="btn mt" onclick="AI.ask()">🚀 Tanya AI (dengan konteks datamu)</button>
        <div id="aiAnswer" class="mt"></div>
      </details>`);
  },
  renderInsights(){
    const box = document.getElementById('aiInsights');
    box.innerHTML = this.localInsights().map(([lvl, txt]) =>
      `<div class="alert ${lvl==='ok'?'ok':lvl==='bad'?'bad':lvl==='warn'?'warn':'info'} mts" style="padding:8px 12px;font-size:12.5px">${txt}</div>`).join('');
  },
  async ask(){
    const cfg = { endpoint: document.getElementById('aiEp').value.trim(), model: document.getElementById('aiModel').value.trim(), key: document.getElementById('aiKey').value.trim() };
    const q = document.getElementById('aiQ').value.trim();
    const box = document.getElementById('aiAnswer');
    if(!cfg.key) return Toast.show('Isi API key dulu (Groq/OpenRouter menyediakan tier gratis)');
    if(!q) return Toast.show('Tulis pertanyaan dulu');
    localStorage.setItem('ghub_ai_cfg', JSON.stringify(cfg));
    box.innerHTML = loadingBox('Bertanya ke LLM (langsung dari browser → penyedia AI, tanpa lewat server GHub)…');
    try{
      const c = this.context();
      const r = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
        body: JSON.stringify({ model: cfg.model, temperature: 0.4, messages: [
          { role: 'system', content: 'Kamu penasihat keuangan pribadi Indonesia yang jujur, ringkas, dan tidak menjual produk. Jawab dalam bahasa Indonesia. Konteks data pengguna (ringkas): ' + JSON.stringify(c) + '. Ingatkan bahwa ini bukan nasihat investasi resmi.' },
          { role: 'user', content: q } ] })
      });
      const j = await r.json();
      if(!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
      const ans = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : JSON.stringify(j).slice(0, 400);
      box.innerHTML = `<div class="alert info" style="white-space:pre-wrap">${U.esc(ans)}</div><div class="hint mts">Model: ${U.esc(cfg.model)} · dipanggil langsung dari browser Anda.</div>`;
    }catch(e){ box.innerHTML = errorBox('LLM: ' + e.message); }
  }
};
