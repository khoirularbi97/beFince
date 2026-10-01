# beFince

beFince adalah aplikasi pencatatan keuangan pribadi dengan login: transaksi harian, dompet (tunai, rekening bank, e-wallet),
budget, tren, pola pengeluaran per hari dalam seminggu, target tabungan, dan ekspor laporan bulanan (PDF/CSV).

- `server/` : Express + PostgreSQL (Neon), login JWT
- `client/` : React + Vite, tampilan responsif. Bisa dipasang ke layar HP lewat menu browser "Tambahkan ke layar utama" (ada manifest dan ikon)
- `branding/` : logo (SVG) dan ikon aplikasi (PNG 1024x1024, versi terang dan gelap). Navy Blue `#0A2540`

## Jalankan di komputer sendiri

1. Buat database di Neon, salin connection string-nya.
2. Backend:
   ```
   cd server
   cp .env.example .env     # isi DATABASE_URL dan JWT_SECRET (cara membuatnya ada di dalam file)
   npm install
   npm run db:init          # membuat tabel (aman dijalankan ulang)
   npm run dev              # http://localhost:4000
   ```
3. Frontend:
   ```
   cd client
   cp .env.example .env
   npm install
   npm run dev              # http://localhost:5173
   ```
4. Buka aplikasinya, pilih **Daftar**, lalu buat akunmu. Akun baru otomatis mendapat 3 dompet (Tunai, Rekening Bank,
   E-wallet) dan kategori awal. Saldo awal dompet diisi lewat `PUT /api/wallets/:id` atau SQL Editor Neon.
5. Opsional, data contoh untuk akun yang masih kosong: `npm run db:seed -- email@anda.com`

## Login dan keamanan

- Kata sandi disimpan sebagai hash scrypt. Token login (JWT, berlaku 7 hari) dikirim lewat header `Authorization`.
- Setiap tabel data punya kolom `user_id`, dan setiap query memfilter berdasarkan akun yang login. Dompet, kategori,
  atau target milik akun lain ditolak walaupun id-nya ditebak.
- `JWT_SECRET` wajib diisi (minimal 32 karakter). Kalau bocor, orang bisa memalsukan login: ganti nilainya dan semua sesi otomatis tidak berlaku.
- Setelah akunmu dibuat, isi `ALLOW_REGISTRATION=false` di server supaya orang lain tidak bisa mendaftar.
- Percobaan masuk, daftar, dan ganti kata sandi dibatasi 30 kali per 15 menit per alamat IP (dihitung bersama).
- **Ganti kata sandi**: menu Akun (inisial nama di pojok atas) > Ganti kata sandi. Setelah diganti, sesi di perangkat
  lain otomatis keluar, sedangkan perangkat yang dipakai tetap masuk.
- **Lupa kata sandi**: belum ada pemulihan lewat email. Sebagai pemilik server, jalankan
  `npm run user:reset -- email@anda.com` di folder `server`. Skrip mencetak kata sandi sementara dan mengeluarkan semua sesi lama.
- Token disimpan di `localStorage` browser, jadi jangan membuka aplikasi di komputer umum tanpa menekan Keluar.

### Punya database dari versi sebelum login?
Jalankan `npm run db:init` (menambah kolom `user_id`), daftar akun lewat aplikasi, lalu
`npm run db:claim -- email@anda.com` untuk menyerahkan data lama ke akun itu. Akun harus masih kosong.

## Deploy (project ke-2, terpisah dari project pertama)

| Bagian | Platform | Pengaturan |
|---|---|---|
| Database | Neon | Buat project atau database baru. Jalankan `npm run db:init` sekali dengan `DATABASE_URL` Neon. |
| Backend | Render (Web Service) | Root Directory `server`, Build `npm install`, Start `npm start`. Env: `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` (URL Vercel). |
| Frontend | Vercel | Root Directory `client`, framework Vite. Env: `VITE_API_URL` (URL Render). |

Beri nama berbeda dari project pertama, misalnya `befince-api` dan `befince-web`.
Urutan: Neon, lalu Render, lalu Vercel, lalu isi `CLIENT_ORIGIN` di Render dengan URL Vercel. Setelah mendaftar, set
`ALLOW_REGISTRATION=false`. Cek paket gratis Render: service bisa "tidur" saat lama tidak dipakai, sehingga permintaan
pertama lebih lambat.

## Catatan desain

- Nominal disimpan sebagai `BIGINT` rupiah (bukan desimal), jadi hitungan tidak meleset.
- Saldo dompet = saldo awal + pemasukan - pengeluaran +/- transfer - setoran tabungan.
  Transfer dan setoran tabungan tidak dihitung sebagai pemasukan/pengeluaran.
- Budget bulan baru otomatis mewarisi budget bulan sebelumnya sampai diubah.
- CSV memakai pemisah titik koma. Kalau terbuka dalam satu kolom di Excel, pakai Data > From Text/CSV.

## Endpoint

Tanpa login: `GET /api/health`, `POST /api/auth/register`, `POST /api/auth/login`.
Perlu login: `GET /api/auth/me`, `PUT /api/auth/password`, `GET /api/meta`, `GET|POST /api/transactions`, `PUT|DELETE /api/transactions/:id`,
`GET|POST /api/wallets`, `POST /api/transfers`, `GET|PUT /api/budgets`, `GET /api/budgets/suggest`,
`GET|POST /api/goals`, `POST /api/goals/:id/deposits`, `GET /api/reports/monthly|trend|weekday`,
`GET /api/export/csv|pdf?month=YYYY-MM`.
