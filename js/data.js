/* ========== GHub One — Data referensi RESMI (bersumber & tertaut) ==========
 * Berisi data yang sifatnya ketetapan resmi/publikasi berkala (bukan tick data):
 * UMP 2026, BI-Rate, iuran BPJS, referensi biaya pendidikan, universe emiten.
 * Setiap blok memuat sumber resmi + tanggal berlaku. Data harga/indikator pasar
 * TIDAK ada di sini — semuanya diambil realtime lewat js/api.js.
 */

/* ---- UMP 2026 per provinsi ----
 * Dasar hukum: PP No. 49 Tahun 2025 tentang Pengupahan, berlaku 1 Januari 2026.
 * Sumber: Kementerian Ketenagakerjaan RI (dipublikasikan a.l. Kompas.tv 26/12/2025,
 * https://www.kompas.tv/info-publik/639870/ ). Aceh & Papua Pegunungan memakai
 * angka finalisasi pemberitaan Januari 2026 (spkep-spsi.org).
 */
const UMP2026 = {
  meta: {
    tahun: 2026, dasar: 'PP No. 49 Tahun 2025 (Pengupahan)', berlaku: '1 Januari 2026',
    sumber: 'Kemnaker RI via Kompas.tv & SPKEP-SPSI',
    url: 'https://www.kompas.tv/info-publik/639870/daftar-lengkap-ump-2026-di-seluruh-provinsi-dki-jakarta-tertinggi-dengan-rp5-729-876'
  },
  data: {
    'Aceh': 3932552, 'Sumatera Utara': 3228971, 'Sumatera Barat': 3182955, 'Riau': 3780495,
    'Kepulauan Riau': 3879520, 'Jambi': 3471497, 'Bengkulu': 2827250, 'Sumatera Selatan': 3942963,
    'Kepulauan Bangka Belitung': 4035000, 'Lampung': 3047734,
    'DKI Jakarta': 5729876, 'Banten': 3100881, 'Jawa Barat': 2317601, 'Jawa Tengah': 2327386,
    'DI Yogyakarta': 2417495, 'Jawa Timur': 2446880,
    'Bali': 3207459, 'Nusa Tenggara Barat': 2673861, 'Nusa Tenggara Timur': 2455898,
    'Kalimantan Barat': 3054552, 'Kalimantan Tengah': 3686138, 'Kalimantan Selatan': 3725000,
    'Kalimantan Timur': 3762431, 'Kalimantan Utara': 3775243,
    'Sulawesi Utara': 4002630, 'Gorontalo': 3405144, 'Sulawesi Tengah': 3179565,
    'Sulawesi Tenggara': 3306496, 'Sulawesi Barat': 3315934, 'Sulawesi Selatan': 3921088,
    'Maluku': 3334490, 'Maluku Utara': 3552840,
    'Papua Barat': 3841000, 'Papua Barat Daya': 3766000, 'Papua Tengah': 4285848,
    'Papua': 4436283, 'Papua Selatan': 4508850, 'Papua Pegunungan': 4508714
  }
};

/* ---- BI-Rate (ketetapan RDG terakhir) ----
 * Sumber: Siaran Pers Bank Indonesia, RDG 21–22 Juli 2026 (idxchannel/Antara).
 */
const BI_RATE = {
  rate: 5.75, depositFacility: 4.75, lendingFacility: 6.50,
  rdg: 'RDG BI 21–22 Juli 2026', ditetapkan: '2026-07-22',
  sumber: 'Bank Indonesia (Siaran Pers RDG)',
  url: 'https://www.bi.go.id/id/publikasi/ruang-media/news-release/default.aspx'
};

/* ---- Skala ekuivalensi kebutuhan rumah tangga (OECD-modified) ----
 * Metodologi standar internasional utk mengalikan kebutuhan per tanggungan.
 * Sumber: OECD, "What are equivalence scales?" — kepala keluarga 1.0,
 * dewasa tambahan 0.5, anak <14 th 0.3.
 */
const EQUIV = { kepala: 1.0, dewasa: 0.5, anak: 0.3,
  sumber: 'OECD Equivalence Scales', url: 'https://www.oecd.org/economy/growth/OECD-Note-EquivalenceScales.pdf' };

/* ---- Jenjang pendidikan & referensi biaya ----
 * Usia masuk mengacu Permendikbud 1/2021 (PPDB): SD ≥6 th (prioritas 7),
 * SMP 13, SMA 16. Biaya = rata-rata pengeluaran pendidikan per siswa/tahun
 * (BPS, Statistik Pendidikan / Susenas — negeri) & rentang umum swasta.
 * Nilai bisa diubah pengguna; disesuaikan inflasi realtime (World Bank CPI).
 */
const JENJANG = [
  { kode: 'PAUD', nama: 'PAUD/TK', masuk: 5, lama: 2, biayaNegeri: 1500000, biayaSwasta: 6000000 },
  { kode: 'SD',   nama: 'SD/MI',   masuk: 7, lama: 6, biayaNegeri: 3300000, biayaSwasta: 15000000 },
  { kode: 'SMP',  nama: 'SMP/MTs', masuk: 13, lama: 3, biayaNegeri: 4800000, biayaSwasta: 18000000 },
  { kode: 'SMA',  nama: 'SMA/SMK', masuk: 16, lama: 3, biayaNegeri: 6500000, biayaSwasta: 22000000 },
  { kode: 'PT',   nama: 'Kuliah (S1)', masuk: 19, lama: 4, biayaNegeri: 12000000, biayaSwasta: 35000000 }
];
const JENJANG_SRC = { label: 'BPS — Statistik Pendidikan (pengeluaran per siswa) & Permendikbud 1/2021',
  url: 'https://www.bps.go.id/id/publication?title=statistik+pendidikan' };

/* ---- Iuran BPJS Kesehatan (resmi, Perpres 64/2020 jo. 59/2024 — masih berlaku) ---- */
const BPJS = {
  kelas: [ { nama: 'Kelas 1 (PBPU)', iuran: 150000 }, { nama: 'Kelas 2 (PBPU)', iuran: 100000 },
           { nama: 'Kelas 3 (PBPU, setelah subsidi)', iuran: 35000 } ],
  sumber: 'BPJS Kesehatan / Perpres 64 Tahun 2020', url: 'https://bpjs-kesehatan.go.id/#/kontribusi'
};

/* ---- Benchmark premi proteksi (rate publikasi industri; verifikasi realtime ke marketplace) ---- */
const PROTEKSI_REF = {
  termLifePerMille: [ // premi tahunan per Rp1.000 UP, asuransi jiwa berjangka, non-perokok (benchmark publikasi agregator)
    { usiaMax: 30, rate: 1.1 }, { usiaMax: 35, rate: 1.4 }, { usiaMax: 40, rate: 1.9 },
    { usiaMax: 45, rate: 2.8 }, { usiaMax: 50, rate: 4.4 }, { usiaMax: 60, rate: 8.0 }
  ],
  kesehatanSwastaBulanan: { min: 300000, max: 1500000 },
  cekHarga: [
    { nama: 'Lifepal (bandingkan premi realtime)', url: 'https://lifepal.co.id/asuransi/' },
    { nama: 'Qoala', url: 'https://www.qoala.app/id/asuransi' },
    { nama: 'PasarPolis', url: 'https://www.pasarpolis.com' },
    { nama: 'Cek produk & perusahaan berizin (OJK)', url: 'https://ojk.go.id/id/kanal/iknb/data-dan-statistik/direktori/asuransi/default.aspx' }
  ],
  sumber: 'Benchmark agregator asuransi berizin OJK', url: 'https://lifepal.co.id/media/asuransi-jiwa-term-life/'
};

/* ---- Universe emiten IDX per sektor ----
 * Harga & valuasi → realtime (Yahoo Finance). EPS/BVPS/rasio dasar → laporan
 * keuangan terakhir yang dipublikasikan perusahaan (angka pembulatan; tiap
 * emiten punya tautan verifikasi resmi IDX). fund.per = periode laporan.
 */
const EMITEN = {
  'Keuangan': [
    { t: 'BBCA', n: 'Bank Central Asia', eps: 455, bvps: 2140, roe: 21.5, der: null, npm: 46, growth: 10, hist: [] },
    { t: 'BBRI', n: 'Bank Rakyat Indonesia', eps: 396, bvps: 2090, roe: 18.9, der: null, npm: 34, growth: 3, hist: [] },
    { t: 'BMRI', n: 'Bank Mandiri', eps: 598, bvps: 3120, roe: 20.1, der: null, npm: 38, growth: 7, hist: [] },
    { t: 'BBNI', n: 'Bank Negara Indonesia', eps: 575, bvps: 4230, roe: 14.2, der: null, npm: 31, growth: 4, hist: [] },
    { t: 'BRIS', n: 'Bank Syariah Indonesia', eps: 152, bvps: 1010, roe: 16.0, der: null, npm: 30, growth: 18, hist: [] }
  ],
  'Konsumer Primer': [
    { t: 'ICBP', n: 'Indofood CBP', eps: 452, bvps: 3860, roe: 12.8, der: 0.7, npm: 13, growth: 7, hist: [] },
    { t: 'INDF', n: 'Indofood Sukses Makmur', eps: 705, bvps: 7350, roe: 10.1, der: 0.6, npm: 8, growth: 4, hist: [] },
    { t: 'MYOR', n: 'Mayora Indah', eps: 138, bvps: 720, roe: 19.5, der: 0.6, npm: 9, growth: 11, hist: [] },
    { t: 'CPIN', n: 'Charoen Pokphand Indonesia', eps: 232, bvps: 1720, roe: 13.5, der: 0.4, npm: 6, growth: 8, hist: [] },
    { t: 'UNVR', n: 'Unilever Indonesia', eps: 88, bvps: 92, roe: 95, der: 1.6, npm: 12, growth: -6,
      hist: [{ lvl: 'warn', txt: 'Tren penjualan & pangsa pasar menurun beberapa tahun terakhir (laporan keuangan) — teliti sebelum masuk.' }] }
  ],
  'Kesehatan': [
    { t: 'KLBF', n: 'Kalbe Farma', eps: 69, bvps: 505, roe: 14.0, der: 0.2, npm: 10, growth: 7, hist: [] },
    { t: 'SIDO', n: 'Industri Jamu Sido Muncul', eps: 38, bvps: 118, roe: 32.5, der: 0.1, npm: 32, growth: 8, hist: [] },
    { t: 'MIKA', n: 'Mitra Keluarga Karyasehat', eps: 78, bvps: 420, roe: 18.5, der: 0.1, npm: 26, growth: 12, hist: [] }
  ],
  'Telekomunikasi & Infrastruktur': [
    { t: 'TLKM', n: 'Telkom Indonesia', eps: 238, bvps: 1460, roe: 16.3, der: 0.4, npm: 16, growth: 2, hist: [] },
    { t: 'ISAT', n: 'Indosat Ooredoo Hutchison', eps: 138, bvps: 1150, roe: 12.0, der: 0.9, npm: 8, growth: 9, hist: [] },
    { t: 'TOWR', n: 'Sarana Menara Nusantara', eps: 68, bvps: 350, roe: 19.4, der: 2.4, npm: 27, growth: 6,
      hist: [{ lvl: 'warn', txt: 'Leverage tinggi (DER > 2×) — sensitif terhadap suku bunga.' }] }
  ],
  'Energi': [
    { t: 'ADRO', n: 'Alamtri Resources (d/h Adaro)', eps: 510, bvps: 3400, roe: 15.0, der: 0.2, npm: 22, growth: -10,
      hist: [{ lvl: 'warn', txt: 'Siklikal harga batu bara; ada aksi korporasi spin-off AADI (2024) — pahami struktur barunya.' }] },
    { t: 'ITMG', n: 'Indo Tambangraya Megah', eps: 2980, bvps: 24100, roe: 12.4, der: 0.1, npm: 17, growth: -12, hist: [] },
    { t: 'PTBA', n: 'Bukit Asam', eps: 452, bvps: 1830, roe: 24.7, der: 0.1, npm: 13, growth: -8, hist: [] },
    { t: 'PGAS', n: 'Perusahaan Gas Negara', eps: 182, bvps: 1720, roe: 10.6, der: 0.4, npm: 9, growth: 3, hist: [] },
    { t: 'UNTR', n: 'United Tractors', eps: 5480, bvps: 24300, roe: 22.5, der: 0.2, npm: 15, growth: -5, hist: [] }
  ],
  'Bahan Baku': [
    { t: 'ANTM', n: 'Aneka Tambang', eps: 158, bvps: 1320, roe: 12.0, der: 0.1, npm: 8, growth: 15, hist: [] },
    { t: 'INCO', n: 'Vale Indonesia', eps: 280, bvps: 3900, roe: 7.2, der: 0.1, npm: 15, growth: -20, hist: [] },
    { t: 'SMGR', n: 'Semen Indonesia', eps: 118, bvps: 7150, roe: 1.7, der: 0.3, npm: 3, growth: -4,
      hist: [{ lvl: 'warn', txt: 'ROE sangat rendah & industri semen oversupply — fundamental lemah saat ini.' }] },
    { t: 'MDKA', n: 'Merdeka Copper Gold', eps: -12, bvps: 620, roe: -1.5, der: 0.8, npm: -1, growth: 10,
      hist: [{ lvl: 'bad', txt: 'Masih rugi bersih pada laporan terakhir — red flag profitabilitas.' }] }
  ],
  'Industri & Otomotif': [
    { t: 'ASII', n: 'Astra International', eps: 838, bvps: 5150, roe: 16.1, der: 0.4, npm: 10, growth: 1, hist: [] },
    { t: 'AUTO', n: 'Astra Otoparts', eps: 380, bvps: 2800, roe: 13.4, der: 0.2, npm: 9, growth: 5, hist: [] }
  ],
  'Ritel & Konsumer Siklikal': [
    { t: 'ACES', n: 'Aspirasi Hidup Indonesia (ACE)', eps: 52, bvps: 385, roe: 13.6, der: 0.2, npm: 10, growth: 9, hist: [] },
    { t: 'MAPI', n: 'Mitra Adiperkasa', eps: 118, bvps: 700, roe: 17.0, der: 0.7, npm: 5, growth: 12, hist: [] },
    { t: 'ERAA', n: 'Erajaya Swasembada', eps: 68, bvps: 480, roe: 14.0, der: 0.9, npm: 2, growth: 10, hist: [] }
  ],
  'Properti': [
    { t: 'BSDE', n: 'Bumi Serpong Damai', eps: 220, bvps: 2200, roe: 10.0, der: 0.3, npm: 25, growth: 6, hist: [] },
    { t: 'CTRA', n: 'Ciputra Development', eps: 118, bvps: 1100, roe: 10.8, der: 0.4, npm: 19, growth: 8, hist: [] },
    { t: 'PWON', n: 'Pakuwon Jati', eps: 42, bvps: 400, roe: 10.5, der: 0.3, npm: 32, growth: 5, hist: [] }
  ],
  'Teknologi': [
    { t: 'GOTO', n: 'GoTo Gojek Tokopedia', eps: -3, bvps: 32, roe: -9, der: 0.1, npm: -20, growth: 12,
      hist: [{ lvl: 'bad', txt: 'Belum laba bersih konsisten; dilusi & goodwill besar pasca-merger — red flag fundamental.' }] },
    { t: 'EMTK', n: 'Elang Mahkota Teknologi', eps: 28, bvps: 700, roe: 4.0, der: 0.1, npm: 6, growth: 3, hist: [] },
    { t: 'BUKA', n: 'Bukalapak', eps: 2, bvps: 240, roe: 1.0, der: 0.05, npm: 2, growth: -35,
      hist: [{ lvl: 'bad', txt: 'Menutup lini marketplace fisik (2025, pemberitaan publik) — model bisnis berubah drastis.' }] }
  ],
  'Konstruksi (contoh histori bermasalah)': [
    { t: 'WSKT', n: 'Waskita Karya', eps: -180, bvps: 800, roe: -20, der: 3.5, npm: -15, growth: -10,
      hist: [
        { lvl: 'bad', txt: 'Gagal bayar & restrukturisasi utang obligasi (2023–2024); saham pernah disuspensi lama (pemberitaan publik & keterbukaan IDX).' },
        { lvl: 'bad', txt: 'Mantan petinggi terjerat kasus korupsi (putusan pengadilan, pemberitaan nasional) — histori manajemen cacat.' }
      ] },
    { t: 'GIAA', n: 'Garuda Indonesia', eps: 10, bvps: -50, roe: null, der: null, npm: 2, growth: 5,
      hist: [
        { lvl: 'bad', txt: 'PKPU & restrukturisasi utang masif (2021–2022); ekuitas pernah negatif; eks-dirut divonis kasus korupsi (putusan pengadilan).' }
      ] }
  ]
};
const EMITEN_SRC = { label: 'Laporan keuangan terakhir yang dipublikasikan emiten (IDX) — angka pembulatan, WAJIB verifikasi di tautan resmi',
  url: 'https://www.idx.co.id/id/perusahaan-tercatat/laporan-keuangan-dan-tahunan' };

/* Pemetaan fase ekonomi → sektor unggulan (kerangka sector rotation standar, a.l. Fidelity Business Cycle Approach) */
const FASE_SEKTOR = {
  'Ekspansi Awal':  { sektor: ['Keuangan', 'Ritel & Konsumer Siklikal', 'Properti', 'Industri & Otomotif'], alasan: 'Suku bunga rendah/turun & pertumbuhan mulai naik → kredit, konsumsi siklikal, dan properti diuntungkan.' },
  'Ekspansi Tengah':{ sektor: ['Teknologi', 'Industri & Otomotif', 'Telekomunikasi & Infrastruktur', 'Keuangan'], alasan: 'Pertumbuhan stabil, margin melebar → sektor pertumbuhan & industrials unggul.' },
  'Ekspansi Akhir': { sektor: ['Energi', 'Bahan Baku', 'Konsumer Primer', 'Kesehatan'], alasan: 'Inflasi & harga komoditas naik → energi/bahan baku unggul; mulai rotasi ke defensif.' },
  'Kontraksi':      { sektor: ['Konsumer Primer', 'Kesehatan', 'Telekomunikasi & Infrastruktur'], alasan: 'Pertumbuhan melambat → sektor defensif dengan permintaan inelastis paling tahan.' }
};
const FASE_SRC = { label: 'Kerangka rotasi sektor siklus bisnis (Fidelity Investments)', url: 'https://institutional.fidelity.com/advisors/insights/topics/investing-ideas/sector-investing-business-cycle' };

/* Ticker likuid pembagi dividen rutin utk modul Dividen (riwayat asli ditarik dari Yahoo Finance) */
const DIV_TICKERS = ['BBCA','BBRI','BMRI','BBNI','BRIS','TLKM','ASII','UNTR','ITMG','PTBA','ADRO','PGAS','ANTM','ICBP','INDF','MYOR','KLBF','SIDO','MIKA','ACES','BSDE','PWON','CPIN','ISAT','AUTO','EXCL','SMGR','INCO','TOWR','MAPI'];

/* Marketplace global utk keranjang afiliasi (jutaan produk eksternal, tautan pencarian & produk asli) */
const MARKETPLACES = [
  { id: 'shopee',    nama: 'Shopee',     search: q => 'https://shopee.co.id/search?keyword=' + encodeURIComponent(q) },
  { id: 'tokopedia', nama: 'Tokopedia',  search: q => 'https://www.tokopedia.com/search?q=' + encodeURIComponent(q) },
  { id: 'lazada',    nama: 'Lazada',     search: q => 'https://www.lazada.co.id/catalog/?q=' + encodeURIComponent(q) },
  { id: 'blibli',    nama: 'Blibli',     search: q => 'https://www.blibli.com/cari/' + encodeURIComponent(q) },
  { id: 'amazon',    nama: 'Amazon',     search: q => 'https://www.amazon.com/s?k=' + encodeURIComponent(q) },
  { id: 'aliexpress',nama: 'AliExpress', search: q => 'https://www.aliexpress.com/wholesale?SearchText=' + encodeURIComponent(q) },
  { id: 'ebay',      nama: 'eBay',       search: q => 'https://www.ebay.com/sch/i.html?_nkw=' + encodeURIComponent(q) }
];

/* Skema komisi platform (nilai efektif diambil dari settings server)
 * - Klik link afiliasi   : STATISTIK saja, tidak bernilai uang (anti-fraud).
 * - produkUser           : porsi PENGGUNA dari payout jaringan afiliasi eksternal
 *                          saat pembelian TERVERIFIKASI (postback); sisanya porsi sistem.
 * - Langganan grup       : 100% menjadi pendapatan kreator grup (tanpa potongan sistem).
 * - membershipRef        : komisi referral, dibayar sistem hanya jika referral
 *                          benar-benar mendaftar & membayar membership.
 */
const KOMISI = {
  produkUser: 0.70,
  membershipRef: 0.30
};

/* Paket membership */
const PLANS = [
  { id: 'free',  nama: 'Free',  harga: 0,      fitur: ['Sosial Hub dasar', 'Projek Tim 1 proyek', 'Income & KHL', 'Screening ringkas'] },
  { id: 'pro',   nama: 'Pro',   harga: 49000,  fitur: ['Semua fitur Free', 'Grup berlangganan (jadi kreator)', 'Keranjang afiliasi di konten', 'Screening lengkap + teknikal', 'Proyek tak terbatas'] },
  { id: 'elite', nama: 'Elite', harga: 129000, fitur: ['Semua fitur Pro', 'Komisi afiliasi rate tertinggi', 'Prioritas data realtime', 'Laporan PDF', 'Dukungan prioritas'] }
];

/* Tautan riset histori perusahaan/manajemen/PSP — "menyelami berita & sosial media" */
function risetLinks(ticker, nama){
  const q = encodeURIComponent(ticker + ' ' + nama);
  return [
    { nama: 'Keterbukaan Informasi IDX', url: 'https://www.idx.co.id/id/perusahaan-tercatat/keterbukaan-informasi?kodeEmiten=' + ticker },
    { nama: 'Profil Perusahaan IDX', url: 'https://www.idx.co.id/id/perusahaan-tercatat/profil-perusahaan-tercatat/' + ticker },
    { nama: 'Google News', url: 'https://news.google.com/search?q=' + q + '&hl=id' },
    { nama: 'X / Twitter (sosmed)', url: 'https://x.com/search?q=%24' + ticker + '&f=live' },
    { nama: 'Stockbit (komunitas)', url: 'https://stockbit.com/symbol/' + ticker },
    { nama: 'Berita korupsi/kasus (riset)', url: 'https://news.google.com/search?q=' + q + '%20kasus%20OR%20korupsi%20OR%20gagal%20bayar&hl=id' }
  ];
}

/* ---- Override admin (tarif komisi & harga paket) — diatur dari admin.html ---- */
try{
  const _k = JSON.parse(localStorage.getItem('ghub_komisi') || 'null');
  if(_k) Object.assign(KOMISI, _k);
  const _p = JSON.parse(localStorage.getItem('ghub_plans') || 'null');
  if(_p) PLANS.forEach(pl => { if(_p[pl.id] != null) pl.harga = _p[pl.id]; });
}catch(e){ /* abaikan */ }

/* ---- Pemetaan INTEGRASI per menu/modul ----
 * Dipakai IntegrasiUI (app.js) utk menampilkan strip status integrasi
 * di atas SETIAP menu: provider apa yang menyuplai modul tsb, status
 * live/cache, mode autopilot, dan tautan sumber resmi.
 */
const MODUL_INTEGRASI = {
  dashboard: ['yahoo','coingecko','fx','rss','ai','db'],
  social: ['affiliate','payment','marketplaces','db'],
  project: ['db'],
  income: ['yahoo','coingecko','fx','blockchain','ai','db'],
  khl: ['ump','khl','slik','worldbank','bps','db'],
  proteksi: ['bpjs','ojkmarket','db'],
  invest: ['sbn','yahoo','db'],
  screening: ['worldbank','yahoo','fx','coingecko','bi','rss','gnews','blacklist'],
  dividen: ['yahoo'],
  legacy: ['db'],
  profil: ['db'],
  membership: ['affiliate','payment','db']
};

/* ================================================================
 * KHL ≠ UMP — DUA KONTEKS BERBEDA, DATA TERPISAH
 * - UMP  : ketetapan upah minimum oleh gubernur (formula PP 51/2023
 *          jo. PP 49/2025) — konteks PENGUPAHAN.
 * - KHL  : standar kebutuhan hidup layak pekerja lajang / bulan —
 *          konteks KEBUTUHAN HIDUP. Diatur Permenaker No. 18 Tahun 2020
 *          (perubahan atas Permenaker 21/2016): 64 KOMPONEN dalam
 *          7 KELOMPOK. Nilai rupiahnya disurvei pasar per daerah;
 *          di sini tiap kelompok bisa diisi sesuai harga nyata di
 *          daerah Anda (default = estimasi awal, WAJIB disesuaikan).
 * ================================================================ */
const KHL_PERMENAKER = {
  dasar: 'Permenaker No. 18 Tahun 2020 jo. Permenaker 21/2016 — 64 komponen KHL, 7 kelompok (standar pekerja lajang/bulan)',
  url: 'https://peraturan.bpk.go.id/Details/163986/permenaker-no-18-tahun-2020',
  kelompok: [
    { id:'makan',   nama:'I. Makanan & Minuman', n:11, porsi:0.26,
      poin:'beras · sumber protein (daging/ikan/telur) · kacang-kacangan (tempe/tahu) · susu bubuk · gula pasir · minyak goreng · sayuran · buah-buahan · karbohidrat lain (mie/tepung) · teh/kopi · bumbu-bumbuan' },
    { id:'sandang', nama:'II. Sandang', n:13, porsi:0.07,
      poin:'celana/rok panjang · celana pendek · ikat pinggang · kemeja/blus · kaos oblong/BH · celana dalam · sarung/kain panjang · sepatu · kaos kaki · perlengkapan pembersih sepatu · sandal jepit · handuk mandi · perlengkapan ibadah' },
    { id:'rumah',   nama:'III. Perumahan', n:26, porsi:0.32,
      poin:'sewa kamar · dipan/tempat tidur · kasur & bantal · seprei & sarung bantal · meja & kursi · lemari pakaian · sapu · perlengkapan makan (piring/gelas/sendok-garpu) · ceret aluminium · wajan · panci · sendok masak · rice cooker · kompor & perlengkapan (kompor gas 1 tungku, selang & regulator, tabung 3 kg) · gas elpiji · ember plastik · gayung plastik · listrik (900 VA) · bola lampu · air bersih · sabun cuci pakaian · sabun cuci piring · setrika · rak piring · pisau dapur · cermin' },
    { id:'didik',   nama:'IV. Pendidikan', n:2, porsi:0.02,
      poin:'bacaan (tabloid/surat kabar) atau radio · ballpoint/pensil' },
    { id:'sehat',   nama:'V. Kesehatan', n:5, porsi:0.05,
      poin:'sarana kesehatan (pasta gigi, sabun mandi, sikat gigi, sampo, pembalut/alat cukur) · deodoran · obat anti nyamuk · potong rambut · sisir' },
    { id:'transp',  nama:'VI. Transportasi', n:1, porsi:0.18,
      poin:'transportasi kerja & lainnya (angkutan umum PP)' },
    { id:'rekre',   nama:'VII. Rekreasi & Tabungan', n:6, porsi:0.10,
      poin:'rekreasi (2×/bulan) · tabungan (2% dari total KHL) · jaminan sosial + komponen penunjang lainnya' }
  ]
};

/* ================================================================
 * REGISTRI ENTITAS BERMASALAH — LINTAS EMITEN
 * Manajemen/PSP/grup yang tercatat bermasalah berdasarkan PUTUSAN
 * PENGADILAN, tindakan regulator, atau keterbukaan/pemberitaan
 * nasional. Satu entitas bisa menjangkiti BANYAK emiten (lintas
 * emiten) → semua ticker terafiliasi otomatis di-EXCLUDE dari
 * rekomendasi Screening. Verifikasi mandiri via tautan riset.
 * ================================================================ */
const ENTITAS_BERMASALAH = [
  { nama:'Benny Tjokrosaputro', tipe:'PSP / Manajemen', lintas:true,
    kasus:'Terpidana korupsi Jiwasraya & Asabri (putusan pengadilan; pemberitaan nasional).',
    tickers:['MYRX','RIMO','HOTL'] },
  { nama:'Heru Hidayat', tipe:'PSP', lintas:true,
    kasus:'Terpidana korupsi Jiwasraya & Asabri (putusan pengadilan).',
    tickers:['TRAM','IIKP','PORT','SMRU'] },
  { nama:'Emirsyah Satar (eks Dirut)', tipe:'Manajemen (historis)', lintas:false,
    kasus:'Terpidana suap & pencucian uang pengadaan pesawat (putusan pengadilan).',
    tickers:['GIAA'] },
  { nama:'Destiawan Soewardjono (eks Dirut)', tipe:'Manajemen (historis)', lintas:false,
    kasus:'Diproses hukum kasus penyimpangan fasilitas kredit (pemberitaan nasional 2023–2024).',
    tickers:['WSKT'] },
  { nama:'Grup Bakrie', tipe:'Grup / PSP', lintas:true,
    kasus:'Riwayat gagal bayar & restrukturisasi utang berulang, aksi korporasi dilutif yang merugikan minoritas (keterbukaan informasi & pemberitaan bertahun-tahun).',
    tickers:['BUMI','ENRG','ELTY','BNBR','VIVA','DEWA','UNSP'] },
  { nama:'Manajemen lama AISA (era 2017)', tipe:'Manajemen (historis)', lintas:false,
    kasus:'Skandal penggelembungan laporan keuangan & kasus beras (2017–2018, temuan audit & pemberitaan).',
    tickers:['AISA'] },
  { nama:'Grup Kresna', tipe:'Grup', lintas:true,
    kasus:'Izin usaha Kresna Life dicabut OJK; gagal bayar produk investasi (2020–2023).',
    tickers:['KREN','ASMI'] },
  { nama:'Sri Rejeki Isman (korporasi)', tipe:'Perusahaan', lintas:false,
    kasus:'Dinyatakan pailit (putusan 2024); riwayat gagal bayar & delisting.',
    tickers:['SRIL'] },
  { nama:'Tata niaga timah (kasus 2024)', tipe:'Perusahaan & afiliasi', lintas:true,
    kasus:'Perkara korupsi tata niaga timah dengan kerugian negara sangat besar (persidangan 2024; melibatkan mitra swasta perusahaan).',
    tickers:['TINS'] }
];
function blacklistHits(ticker){
  return ENTITAS_BERMASALAH.filter(e => e.tickers.includes(ticker));
}
function blacklistLintas(ticker){
  // emiten lain yang terjangkit lewat entitas yang sama (lintas emiten)
  const out = new Set();
  blacklistHits(ticker).forEach(e => e.tickers.forEach(t => { if(t !== ticker) out.add(t + ' (via ' + e.nama + ')'); }));
  return [...out];
}

/* Kata kunci pemindai risiko utk mesin penghimpun berita (Intel) */
const RISK_WORDS = ['korupsi','kasus','tersangka','terdakwa','gagal bayar','default','pkpu','pailit','bangkrut','suspensi','digugat','gugatan','manipulasi','sanksi','denda ojk','delisting','fraud','penipuan','penggelapan','disita','buron','dicabut izin','restrukturisasi utang','rugi besar','phk massal'];
const GOOD_WORDS = ['laba naik','dividen','cetak laba','rekor','ekspansi','buyback','kinerja positif','tumbuh','naik'];
