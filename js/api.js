/* ========== GHub One — Lapisan Data REALTIME (API asli, bukan mock) ==========
 * Semua data eksternal diambil langsung oleh browser dari sumber aslinya:
 *  - Yahoo Finance (harga saham IDX, indeks, komoditas, riwayat dividen) — data bursa resmi (delayed sesuai ketentuan bursa)
 *  - CoinGecko API (kripto & emas tokenized PAXG)
 *  - open.er-api.com (kurs valas)
 *  - World Bank Open Data API (indikator makro resmi Indonesia)
 *  - RSS media nasional (CNBC Indonesia, Antara) — tautan ke artikel asli
 * Endpoint tanpa header CORS (Yahoo, RSS) dilewatkan relay CORS publik.
 * Setiap hasil membawa metadata { source, sourceUrl, fetchedAt } untuk atribusi.
 * Cache localStorage ber-TTL untuk menghormati rate-limit sumber.
 */
const API = {
  PROXIES: [
    u => '/api/relay?url=' + encodeURIComponent(u), // relay backend sendiri (server-side, produksi)
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
    u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u)
  ],

  cacheGet(key, ttlMs){
    try{
      const raw = localStorage.getItem('ghubc_' + key);
      if(!raw) return null;
      const { t, v } = JSON.parse(raw);
      if(Date.now() - t > ttlMs){ return null; }
      return v;
    }catch(e){ return null; }
  },
  cacheSet(key, v){
    try{ localStorage.setItem('ghubc_' + key, JSON.stringify({ t: Date.now(), v })); }catch(e){ /* penuh */ }
  },

  async fetchDirect(url, asText){
    const r = await fetch(url, { headers: { 'Accept': asText ? 'text/*,*/*' : 'application/json,*/*' } });
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return asText ? r.text() : r.json();
  },

  async fetchVia(url, { proxy = false, asText = false } = {}){
    if(!proxy){
      try{ return await this.fetchDirect(url, asText); }catch(e){ /* lanjut ke proxy */ }
    }
    let lastErr;
    for(const p of this.PROXIES){
      try{
        const r = await fetch(p(url));
        if(!r.ok) throw new Error('HTTP ' + r.status);
        const txt = await r.text();
        if(asText) return txt;
        return JSON.parse(txt);
      }catch(e){ lastErr = e; }
    }
    throw lastErr || new Error('Semua jalur gagal');
  },

  async get(url, { key, ttlMin = 10, proxy = false, asText = false } = {}){
    const ck = key || url;
    const hit = this.cacheGet(ck, ttlMin * 60000);
    if(hit) return hit;
    const data = await this.fetchVia(url, { proxy, asText });
    const wrapped = { data, fetchedAt: new Date().toISOString() };
    this.cacheSet(ck, wrapped);
    return wrapped;
  },

  /* ---------- Yahoo Finance ---------- */
  async yahooChart(symbol, range = '1d', interval = '1d', events = ''){
    const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}${events ? '&events=' + events : ''}`;
    const ttl = range === '1d' ? 3 : 60 * 6;
    const { data, fetchedAt } = await this.get(u, { key: 'y_' + symbol + '_' + range + '_' + interval + '_' + events, ttlMin: ttl, proxy: true });
    const res = data && data.chart && data.chart.result && data.chart.result[0];
    if(!res) throw new Error('Data ' + symbol + ' tidak tersedia');
    return { res, fetchedAt };
  },

  async quote(symbol){
    const { res, fetchedAt } = await this.yahooChart(symbol, '5d', '1d');
    const m = res.meta;
    const closes = ((res.indicators.quote[0] || {}).close || []).filter(x => x != null);
    const price = m.regularMarketPrice != null ? m.regularMarketPrice : closes[closes.length - 1];
    const prev = m.chartPreviousClose != null ? m.chartPreviousClose : closes[closes.length - 2];
    return {
      symbol, price, prev,
      chg: (price != null && prev) ? (price - prev) : null,
      chgPct: (price != null && prev) ? ((price - prev) / prev * 100) : null,
      name: m.longName || m.shortName || symbol,
      currency: m.currency, exchange: m.exchangeName,
      marketTime: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString() : null,
      fetchedAt,
      source: 'Yahoo Finance (' + (m.exchangeName || 'bursa') + ')',
      sourceUrl: 'https://finance.yahoo.com/quote/' + encodeURIComponent(symbol)
    };
  },

  async quotes(symbols){
    const out = {};
    await Promise.all(symbols.map(async s => {
      try{ out[s] = await this.quote(s); }
      catch(e){ out[s] = { symbol: s, error: e.message }; }
    }));
    return out;
  },

  async history(symbol, range = '6mo', interval = '1d'){
    const { res, fetchedAt } = await this.yahooChart(symbol, range, interval);
    const ts = res.timestamp || [];
    const q = (res.indicators.quote[0]) || {};
    const rows = [];
    for(let i = 0; i < ts.length; i++){
      if(q.close && q.close[i] != null)
        rows.push({ t: ts[i] * 1000, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume ? q.volume[i] : null });
    }
    return { rows, fetchedAt, source: 'Yahoo Finance', sourceUrl: 'https://finance.yahoo.com/quote/' + encodeURIComponent(symbol) + '/history' };
  },

  async dividends(symbol, range = '3y'){
    const { res, fetchedAt } = await this.yahooChart(symbol, range, '1mo', 'div');
    const evs = (res.events && res.events.dividends) ? Object.values(res.events.dividends) : [];
    return {
      symbol,
      divs: evs.map(d => ({ date: new Date(d.date * 1000), amount: d.amount })).sort((a, b) => a.date - b.date),
      fetchedAt, source: 'Yahoo Finance (riwayat dividen)', sourceUrl: 'https://finance.yahoo.com/quote/' + encodeURIComponent(symbol) + '/history?filter=div'
    };
  },

  /* ---------- CoinGecko: kripto + emas (PAXG = 1 troy oz emas) ---------- */
  async cryptoGold(){
    const u = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,tether,pax-gold&vs_currencies=usd,idr&include_24hr_change=true';
    const { data, fetchedAt } = await this.get(u, { key: 'cg', ttlMin: 3 });
    return { data, fetchedAt, source: 'CoinGecko API', sourceUrl: 'https://www.coingecko.com' };
  },

  /* ---------- Kurs valas ---------- */
  async fx(){
    const { data, fetchedAt } = await this.get('https://open.er-api.com/v6/latest/USD', { key: 'fx', ttlMin: 30 });
    if(!data || !data.rates) throw new Error('Kurs tidak tersedia');
    return { rates: data.rates, updated: data.time_last_update_utc, fetchedAt, source: 'ExchangeRate-API (open.er-api.com)', sourceUrl: 'https://www.exchangerate-api.com' };
  },

  /* ---------- World Bank Open Data (indikator resmi Indonesia) ---------- */
  async worldBank(indicator, label){
    const u = `https://api.worldbank.org/v2/country/IDN/indicator/${indicator}?format=json&per_page=10`;
    const { data, fetchedAt } = await this.get(u, { key: 'wb_' + indicator, ttlMin: 60 * 24 });
    const rows = (data && data[1]) ? data[1].filter(r => r.value != null) : [];
    const latest = rows[0];
    return {
      indicator, label,
      value: latest ? latest.value : null,
      year: latest ? latest.date : null,
      series: rows.slice(0, 8).reverse(),
      fetchedAt, source: 'World Bank Open Data',
      sourceUrl: 'https://data.worldbank.org/indicator/' + indicator + '?locations=ID'
    };
  },

  /* ---------- Berita RSS asli (tautan ke artikel sumber) ---------- */
  async rss(feedUrl, label){
    const { data, fetchedAt } = await this.get(feedUrl, { key: 'rss_' + feedUrl, ttlMin: 15, proxy: true, asText: true });
    const doc = new DOMParser().parseFromString(data, 'text/xml');
    const items = [...doc.querySelectorAll('item')].slice(0, 12).map(it => ({
      title: (it.querySelector('title') || {}).textContent || '',
      link: (it.querySelector('link') || {}).textContent || '',
      pub: (it.querySelector('pubDate') || {}).textContent || '',
      desc: ((it.querySelector('description') || {}).textContent || '').replace(/<[^>]+>/g, '').slice(0, 180)
    })).filter(x => x.title && x.link);
    if(!items.length) throw new Error('RSS kosong');
    return { items, fetchedAt, source: label, sourceUrl: feedUrl };
  },

  async news(){
    const feeds = [
      { url: 'https://www.cnbcindonesia.com/market/rss', label: 'CNBC Indonesia — Market' },
      { url: 'https://www.antaranews.com/rss/ekonomi.xml', label: 'ANTARA — Ekonomi' },
      { url: 'https://finance.detik.com/rss', label: 'detikFinance' },
      { url: 'https://www.cnbcindonesia.com/news/rss', label: 'CNBC Indonesia — News' }
    ];
    for(const f of feeds){
      try{ return await this.rss(f.url, f.label); }catch(e){ /* coba feed berikutnya */ }
    }
    throw new Error('Semua sumber berita gagal dimuat');
  },

  /* ---------- INTEL: menghimpun berita seluruh internet per topik/emiten ----------
   * Google News RSS mengagregasi ribuan media di internet dalam satu feed
   * per kueri — inilah cara sistem "menghimpun berita yang berseliweran"
   * menjadi data terstruktur, lalu dipindai kata kunci risiko/positif.
   */
  async gnews(query){
    const u = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=id&gl=ID&ceid=ID:id';
    return await this.rss(u, 'Google News (agregat ribuan media) — "' + query + '"');
  },
  riskScan(items){
    const risk = [], good = [];
    for(const it of items){
      const t = (it.title + ' ' + (it.desc || '')).toLowerCase();
      const rw = RISK_WORDS.filter(w => t.includes(w));
      const gw = GOOD_WORDS.filter(w => t.includes(w));
      if(rw.length) risk.push({ item: it, words: rw });
      else if(gw.length) good.push({ item: it, words: gw });
    }
    return { risk, good, total: items.length,
      riskScore: items.length ? Math.round(risk.length / items.length * 100) : 0 };
  },

  /* Harga logam mulia dunia via Yahoo futures (USD/troy oz) */
  async metal(symbol){ // GC=F emas, SI=F perak, PL=F platinum, PA=F palladium
    return await this.quote(symbol);
  },

  /* ---------- Indikator teknikal ---------- */
  sma(arr, n){ const out = []; for(let i = 0; i < arr.length; i++){ if(i < n - 1){ out.push(null); continue; } let s = 0; for(let j = i - n + 1; j <= i; j++) s += arr[j]; out.push(s / n); } return out; },
  rsi(closes, n = 14){
    if(closes.length < n + 1) return null;
    let g = 0, l = 0;
    for(let i = 1; i <= n; i++){ const d = closes[i] - closes[i - 1]; if(d >= 0) g += d; else l -= d; }
    let ag = g / n, al = l / n;
    for(let i = n + 1; i < closes.length; i++){
      const d = closes[i] - closes[i - 1];
      ag = (ag * (n - 1) + Math.max(d, 0)) / n;
      al = (al * (n - 1) + Math.max(-d, 0)) / n;
    }
    if(al === 0) return 100;
    return 100 - 100 / (1 + ag / al);
  }
};

/* Placeholder loading & error untuk kartu data */
function loadingBox(msg){ return `<div class="empty">⏳ ${U.esc(msg || 'Memuat data realtime dari sumber asli…')}</div>`; }
function errorBox(msg){ return `<div class="alert warn">⚠️ Gagal memuat data realtime: ${U.esc(msg)}.<br>Periksa koneksi internet Anda lalu coba lagi — data diambil langsung dari sumber asli, tanpa mock.</div>`; }
