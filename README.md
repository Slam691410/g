# GHub One — Super App (Sosial, Proyek, Finansial)

Aplikasi web 10 modul: Sosial Hub (konten + grup berlangganan + keranjang afiliasi),
Projek Tim (Kanban/Kalender/Tabel), Income, KHL & Budget Dinamis, Proteksi,
Tujuan Investasi, Screening saham, Kalender Dividen, Profil, Membership & Komisi —
plus **Panel Admin** (`/admin.html`).

Data pasar/makro diambil **realtime dari sumber asli** (Yahoo Finance, CoinGecko,
World Bank, ExchangeRate-API, RSS CNBC/ANTARA) dengan atribusi sumber + jam
pengambilan di setiap kartu. Data ketetapan (UMP 2026, BI-Rate, iuran BPJS)
menautkan dokumen resminya.

## Menjalankan

```bash
node server.js        # default port 8000 (env PORT untuk mengubah)
```

Tanpa dependensi eksternal — hanya Node.js ≥ 22 (memakai `node:sqlite` bawaan).
Database dibuat otomatis di `data/ghub.sqlite`. Akun admin bawaan: `admin / admin123`
(ganti segera lewat Panel Admin → Pengaturan).

## Arsitektur Backend (server.js)

| Lapisan | Implementasi |
|---|---|
| Database | SQLite (`node:sqlite`, WAL): `users`, `sessions`, `kv_user`, `kv_shared`, `posts`, `groups`, `ledger`, `clicks` |
| Auth | scrypt + salt per user, sesi Bearer token, role `user`/`admin` |
| Logika bisnis | Dihitung **di server**: komisi langganan grup (kreator + fee sistem), pembayaran & referral membership, konversi afiliasi, kepemilikan konten |
| Keamanan | Rate-limit (auth 20/5mnt, klik 60/mnt, relay 120/mnt), validasi & pemotongan input, guard path traversal, `server.js` & `data/` tidak disajikan statis |
| Relay data pasar | `GET /api/relay?url=` — proxy server-side ber-allowlist (Yahoo, CoinGecko, er-api, World Bank, RSS); klien fallback otomatis ke jalur browser bila relay tidak tersedia |

## Ringkasan API

### Publik
| Endpoint | Keterangan |
|---|---|
| `POST /api/auth/register` `{username, password, nama}` | Daftar → `{token, user}` |
| `POST /api/auth/login` `{username, password}` | Masuk → `{token, user}` |
| `POST /api/click` `{kode, kanal, url}` | Catat klik link terbungkus — **statistik saja, Rp0** (anti-fraud) |
| `GET /api/deeplink?url=…&subid=…` | Bungkus URL produk ke format jaringan afiliasi (template admin) + Sub-ID pengguna |
| `GET/POST /api/affiliate/postback?key=…&sub_id=…&amount=…&order_id=…` | **Webhook S2S jaringan afiliasi** — komisi produk hanya lahir dari pembelian terverifikasi; payout dibagi pengguna 70% / sistem 30% (bisa diatur); anti-duplikat via `order_id` |
| `GET /api/relay?url=…` | Relay data pasar (allowlist host) |

### Model komisi (adil & anti-fraud)
- **Klik = statistik, Rp0.** Sistem tidak pernah membayar klik.
- **Komisi produk** hanya dari pembelian yang **dikonfirmasi jaringan afiliasi eksternal** via postback — payout dibagi hasil pengguna/sistem.
- **Langganan grup = 100% pendapatan kreator grup.** Sistem tidak memotong.
- **Referral membership** (30%) dibayar sistem hanya saat referral benar-benar mendaftar & membayar.
- Cara sistem ikut program eksternal: daftar **sekali** sebagai publisher di jaringan agregator (Involve Asia, ACCESSTRADE, Amazon Associates, AliExpress Portals, eBay EPN, Impact/CJ/Rakuten/Awin, atau Sovrn Commerce/Skimlinks untuk auto-monetize semua link) → deeplink API + Sub-ID pengguna → postback S2S. Panduannya ada di Panel Admin → Pengaturan.

### Terautentikasi (`Authorization: Bearer <token>`)
| Endpoint | Keterangan |
|---|---|
| `GET /api/data` | Seluruh data user + koleksi bersama (posts, groups, ledger *milik sendiri*, settings) |
| `PUT /api/data/user/:key` | Simpan koleksi pribadi (tasks, txs, holdings, khl_*, polis, goals, …) |
| `POST /api/posts` / `DELETE /api/posts/:id` | Unggah / hapus konten (pemilik/admin) |
| `POST /api/posts/:id/like` · `/comment` · `/cart` | Interaksi & keranjang afiliasi (cart: pemilik saja) |
| `POST /api/groups` · `POST /api/groups/:id/join` | Buat grup · gabung/berlangganan — **100% harga langganan tercatat sebagai pendapatan kreator** |
| `POST /api/membership/buy` `{plan, ref}` | Daftar/perpanjang membership — pembayaran + komisi referral dihitung server |

### Admin (role `admin`)
| Endpoint | Keterangan |
|---|---|
| `GET /api/admin/stats` · `GET /api/admin/users` | Statistik agregat · daftar semua akun + membership |
| `PUT /api/admin/user/:id/membership` `{plan, bulan}` | Set plan/masa aktif member |
| `DELETE /api/admin/user/:id` | Hapus akun + seluruh datanya |
| `PUT /api/admin/password` | Ganti password admin |
| `PUT /api/data/shared/settings` | Tarif komisi & harga paket global |
| `PUT /api/data/shared/posts|groups|ledger` | Moderasi massal (ganti isi tabel) |

## Struktur proyek

```
server.js          ← backend (API + DB + static + relay)
index.html         ← aplikasi pengguna (gerbang login/daftar)
admin.html         ← panel admin sistem
go.html            ← pembungkus link afiliasi (catat klik → redirect)
js/store.js        ← auth + sinkronisasi cache ↔ server
js/api.js          ← lapisan data realtime (sumber asli + relay/fallback)
js/data.js         ← data ketetapan resmi bersumber (UMP 2026, BI-Rate, dll)
js/app.js          ← router & util   ·   js/admin.js ← panel admin
js/views/*.js      ← 10 modul aplikasi
data/ghub.sqlite   ← database (di-.gitignore)
```
