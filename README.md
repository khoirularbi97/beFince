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
   npm run db:init          # membuat tabel (aman dijalankan ulang; atau set AUTO_DB_INIT=true agar otomatis saat server menyala)
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

## Kelola dompet dan kategori

Buka lewat menu Akun (inisial nama di pojok atas) > **Kelola dompet dan kategori**.

- **Dompet**: tambah, ubah nama, jenis, dan saldo awal (dengan pratinjau saldo sesudah diubah), serta hapus. Dompet yang sudah dipakai
  transaksi, transfer, atau setoran tabungan tidak bisa dihapus, dan dompet terakhir tidak bisa dihapus. Nama dompet tidak boleh
  kembar (huruf besar/kecil dianggap sama).
- **Kategori**: tambah, ganti nama, dan hapus. Jenis (pemasukan atau pengeluaran) tidak bisa diubah. Saat menghapus kategori yang sudah
  dipakai, kamu memilih ke kategori mana transaksinya dipindahkan (hanya yang sejenis), atau dibiarkan menjadi "Tanpa kategori".
  Budget kategori yang dihapus ikut terhapus.
- Perubahan langsung terlihat di form Catat transaksi, filter, dan halaman lain.

## Isian nominal rupiah

Semua isian nominal (catat transaksi, transfer, budget, target tabungan, setoran, dan pratinjau impor) otomatis diformat saat diketik:
`1500000` tampil `1.500.000`, dengan awalan "Rp". Di HP muncul keypad angka. Kursor tidak melompat saat titik pemisah muncul,
huruf dibuang, nol di depan dihapus, dan nilai 0 ditolak. Teks yang ditempel dari m-banking atau spreadsheet, misalnya
`Rp 1.500.000,00` atau `1,500,000.00`, dibaca sebagai Rp1.500.000. Yang dikirim ke server tetap angka biasa.

## Jam transaksi

Jam diambil otomatis dari timestamp saat transaksi dicatat (kolom `created_at`), dalam zona waktu `APP_TZ`
(WIB `Asia/Jakarta`, WITA `Asia/Makassar`, WIT `Asia/Jayapura`). Tidak ada isian jam manual. Jam tampil di daftar transaksi dan di
kolom **Jam** pada ekspor CSV.

Jam hanya ditampilkan kalau transaksi dicatat **manual pada hari yang sama dengan tanggalnya**. Transaksi yang dicatat mundur
(misalnya kemarin) atau hasil impor tidak punya jam, karena timestamp-nya adalah waktu pencatatan atau impor, bukan waktu kejadian
sebenarnya. Kalau tanggalnya kamu ubah ke hari lain, jam otomatis hilang.

## Impor mutasi (bank dan e-wallet)

beFince tidak terhubung langsung ke bank atau e-wallet. Sebagai gantinya, buka **Transaksi > Impor mutasi**:

- **Berkas CSV/PDF**: pilih e-statement PDF (yang berisi teks, bukan hasil scan atau foto) atau mutasi CSV. Excel (.xlsx) simpan dulu sebagai CSV.
- **Tempel teks**: tempel notifikasi transfer atau pembayaran, atau baris yang disalin dari e-statement.

Berkas dibaca di browser dan baru dikirim ke server saat kamu menekan Simpan. Sebelum itu ada pratinjau yang bisa diedit
(tanggal, nominal, arah, kategori, catatan).

**Cara membaca PDF.** Tidak ada aturan khusus per bank. Pembaca mencari baris judul kolom (Tanggal, Keterangan, Debet/Debit,
Kredit, Keluar/Masuk, Mutasi/Nominal, Saldo), lalu memasukkan tiap potongan teks ke kolom terdekat berdasarkan posisinya.
Selain itu:

- **Periode** (misalnya "01 MEI 2021 - 31 MEI 2021" atau "PERIODE : MEI 2022") dipakai untuk mengisi tahun pada tanggal `dd/mm`.
- **Saldo dicocokkan**: kalau e-statement punya kolom Saldo, selisih saldo antar baris dibandingkan dengan nominal. Kalau cocok, arah
  masuk atau keluarnya terverifikasi, dan baris yang tidak cocok ditandai kuning.
- Keterangan yang menyambung ke beberapa baris digabung, satu tanggal dengan beberapa nominal dipecah jadi beberapa transaksi,
  dan catatan kaki, total, serta ringkasan saldo diabaikan.
- Tanggal yang hanya berupa bulan (misalnya "APR" pada SeaBank) memakai akhir periode dan ditandai.
- PDF yang terkunci sandi atau hasil scan ditolak dengan pesan yang jelas. Teks gambar (foto atau tangkapan layar) belum bisa dibaca.
- pdf.js hanya dimuat saat kamu memilih PDF, jadi aplikasi tetap ringan.

**Pembaca CSV dan teks** mengenali judul kolom umum (Tanggal, Keterangan, Debet/Debit, Kredit, Jumlah, DB/CR), format angka Indonesia
maupun Inggris, dan melewati baris berstatus gagal. Kalau kolom tidak dikenali, ada panel **Atur kolom**.

Selain itu:

- **Kategori** ditebak dari kata kunci (misalnya KFC dan GoFood jadi Makan, PLN dan pulsa jadi Tagihan).
- **Duplikat**: baris yang tanggal, jenis, dan nominalnya sudah ada di dompet yang sama ditandai "Mungkin sudah ada" dan tidak
  dicentang. Mengimpor berkas yang sama dua kali aman.
- **Top up dan transfer antar dompet** (misalnya "TOPUP GOPAY" atau "PAY GO-PAY CUSTOMER") tidak dicentang otomatis, supaya tidak
  tercatat dua kali (pengeluaran di bank dan pemasukan di e-wallet). Biaya admin top up tetap tercatat sebagai pengeluaran. Catat
  perpindahannya sebagai Transfer di tab Dompet.
- Satu impor maksimal 1000 baris. Jam transaksi dari e-statement (misalnya Mandiri) belum disimpan.

**Cara pengujian:** `cd client && npm test`. Uji membuat PDF contoh yang meniru susunan kolom Permata, Mandiri, SeaBank, BNI,
BRI, dan BCA (data buatan, nama dan nomor rekening disamarkan), lalu memastikan semua transaksi, tanggal, dan arahnya terbaca benar.

**Catatan jujur:** PDF contoh itu *meniru susunan* dari contoh yang kamu kirim, bukan berkas PDF asli, jadi pembaca belum teruji pada
PDF asli dari bank. Dua contoh yang kamu kirim (BNI dan BRI) ternyata templat dari internet dengan teks bahasa Inggris dan tanggal
placeholder, bukan e-statement asli kedua bank itu. Belum ada contoh untuk DANA, OVO, GoPay, dan ShopeePay. Selalu periksa pratinjau
sebelum menyimpan, dan kalau ada format yang salah terbaca, kirim contoh PDF aslinya (tutupi nama dan nomor rekening).

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

## Deploy

Langkah lengkap Neon, Render, dan Vercel (beserta daftar periksa dan pemecahan masalah) ada di **[DEPLOY.md](DEPLOY.md)**.
Ringkasnya: kode ke GitHub, buat database di Neon, deploy backend ke Render lewat `render.yaml`, deploy frontend ke Vercel
(Root Directory `client`, variabel `VITE_API_URL`), lalu isi `CLIENT_ORIGIN` di Render dengan alamat Vercel.

## Catatan desain

- Nominal disimpan sebagai `BIGINT` rupiah (bukan desimal), jadi hitungan tidak meleset.
- Saldo dompet = saldo awal + pemasukan - pengeluaran +/- transfer - setoran tabungan.
  Transfer dan setoran tabungan tidak dihitung sebagai pemasukan/pengeluaran.
- Budget bulan baru otomatis mewarisi budget bulan sebelumnya sampai diubah.
- CSV memakai pemisah titik koma. Kalau terbuka dalam satu kolom di Excel, pakai Data > From Text/CSV.

## Endpoint

Tanpa login: `GET /api/health`, `GET /api/health/db`, `POST /api/auth/register`, `POST /api/auth/login`.
Perlu login: `GET /api/auth/me`, `PUT /api/auth/password`, `GET /api/meta`, `GET|POST /api/transactions`, `PUT|DELETE /api/transactions/:id`, `POST /api/import/check|commit`,
`GET|POST /api/wallets`, `PUT|DELETE /api/wallets/:id`, `GET|POST /api/categories`, `PUT|DELETE /api/categories/:id` (hapus: `?move_to=ID`), `POST /api/transfers`, `GET|PUT /api/budgets`, `GET /api/budgets/suggest`,
`GET|POST /api/goals`, `PUT|DELETE /api/goals/:id`, `GET|POST /api/goals/:id/deposits`, `PUT|DELETE /api/goals/:id/deposits/:depId`, `GET /api/reports/monthly|trend|weekday`,
`GET /api/export/csv|pdf?month=YYYY-MM`.
