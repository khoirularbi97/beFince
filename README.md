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

## Analisa dan saran keuangan (AI opsional)

Di tab Ringkasan, kartu **Analisa cepat** membuka halaman analisa: kesimpulan, temuan, dan langkah ke depan (minggu ini, 30 hari, 3 bulan).

**Analisa cepat (selalu ada, tanpa AI).** Server menghitung sisa uang, perubahan dari bulan lalu, kategori terbesar dan lonjakannya, budget dan proyeksi
akhir bulan, dana darurat (pedoman umum 3 bulan pengeluaran), pola akhir pekan, dan kemajuan target tabungan, lalu menyusun temuan dan langkah
dari aturan di `server/ai/rules.js`. Tidak ada data yang keluar dari server.

**Analisa AI (opsional, mati secara bawaan).** AI menyusun kalimat dan prioritas dari angka yang sama. Cara mengaktifkan di server:

```
AI_ENABLED=true
AI_PROVIDER=groq             # anthropic (bawaan) | groq | gemini | openrouter | openai | compat
AI_API_KEY=...               # kunci API penyedia itu, simpan sebagai rahasia (jangan di-commit)
AI_MODEL=...                 # opsional untuk anthropic, groq, gemini; wajib untuk openrouter, openai, compat
AI_BASE_URL=...              # hanya untuk compat, atau menimpa alamat bawaan
AI_DAILY_LIMIT=5             # opsional; batas per pengguna per hari
```

### Analisa AI gratis

Ada beberapa penyedia dengan tingkat gratis. Batas dan kebijakannya berubah-ubah, jadi cek halaman resminya sebelum bergantung padanya.

| Penyedia | `AI_PROVIDER` | Model bawaan | Catatan |
|---|---|---|---|
| **Groq** (paling mudah) | `groq` | `openai/gpt-oss-120b` | Tingkat gratis tanpa kartu kredit, dengan batas per menit, per hari, dan per menit token yang berbeda tiap model (menurut ringkasan pihak ketiga, sekitar 30 permintaan per menit dan 8 ribu token per menit untuk model ini; cek di console.groq.com). Katalog modelnya sering berganti: `llama-3.3-70b-versatile` sudah dihentikan pada 16 Agustus 2026. |
| **Google Gemini** | `gemini` | `gemini-2.5-flash` | Ada tingkat gratis untuk beberapa model lewat Google AI Studio. **Di tingkat gratis, prompt dan jawaban boleh dipakai Google untuk memperbaiki produknya**; tingkat berbayar tidak. |
| **OpenRouter** | `openrouter` | (wajib isi `AI_MODEL`) | Model berlabel `:free` punya batas permintaan harian yang kecil, dan daftarnya sering berganti. |
| Server sendiri / lainnya | `compat` | (wajib isi `AI_MODEL`, `AI_BASE_URL`) | Server apa pun yang meniru Chat Completions OpenAI, misalnya Ollama. Server Render tidak bisa menjangkau laptopmu, jadi servernya harus bisa diakses dari internet. |

Contoh Groq di Render: `AI_ENABLED=true`, `AI_PROVIDER=groq`, `AI_API_KEY=` (kunci dari console.groq.com, menu API Keys). Model bawaan dipakai otomatis.

Hal-hal yang berlaku untuk penyedia gratis:

- **Nama model bisa hilang kapan saja.** Kalau model dihentikan, aplikasi menampilkan alasannya ("model ... tidak tersedia atau sudah dihentikan") dan jatah hariannya tidak terpakai. Isi `AI_MODEL` dengan model yang masih ada (lihat console.groq.com/docs/models atau halaman deprecations).
- **Batas token per menit.** Tingkat gratis punya batas token per menit yang kecil. Satu analisa memakai beberapa ribu token, jadi jangan menekan tombolnya berkali-kali dalam satu menit.
- **Model gratis lebih kecil.** Kemampuan mengikuti format terstruktur berbeda-beda. Pemeriksa kita membuang butir yang memuat angka karangan dan menerima sisanya (laporan menampilkan berapa butir yang dibuang). Kalau terlalu banyak yang rusak, jawaban ditolak dan aplikasi kembali ke Analisa cepat. Kalau sering terjadi, coba model yang lebih besar.
- **Jatah harian.** Kegagalan di sisi penyedia (batas 429, model dihentikan, kunci salah, error server, timeout) tidak memakai jatah harian pengguna. Jawaban yang diterima tetapi ditolak pemeriksa tetap memakai satu jatah, supaya tidak bisa dipakai menguras penyedia berbayar.
- **Penyesuaian otomatis.** Kalau sebuah penyedia menolak bentuk permintaan memakai fungsi, aplikasi turun otomatis ke cara yang lebih sederhana (fungsi otomatis, lalu JSON di isi pesan).
- **Kebijakan data.** Baca ketentuan penyedia sebelum mengizinkan. Yang dikirim hanya ringkasan angka, tapi tetap data keuangan. Aplikasi menampilkan nama penyedia di layar izin.

Aturan keamanannya:

- **Izin per pengguna.** AI hanya jalan setelah pengguna menekan "Izinkan dan buat analisa AI" dan membaca apa yang dikirim. Izin bisa dicabut, dan laporan tersimpan ikut terhapus.
- **Data minimum.** Yang dikirim hanya ringkasan angka (total, kategori terbesar, budget, saldo, target). Catatan transaksi, nama, email, nomor rekening, dan daftar transaksi tidak dikirim. Ini diuji: uji API memastikan teks catatan dan nomor rekening tidak ada di permintaan ke penyedia.
- **Angka tidak ditebak model.** Model hanya boleh menulis penanda `{{kunci}}`; server menggantinya dengan angka hasil hitungan. Keluaran yang memuat nominal, persen, atau penanda yang tidak ada ditolak, dicoba ulang sekali, lalu jatuh kembali ke analisa cepat.
- **Hasil terstruktur.** Memakai tool use dengan skema tetap, jadi model tidak bisa mengembalikan teks bebas. Tanda `<` dan `>` dibuang dari teksnya.
- **Biaya terkendali.** Batas harian per pengguna (percobaan yang gagal tetap dihitung), hasil yang sama dipakai ulang selama angkanya tidak berubah, batas waktu 40 detik, dan keluaran dibatasi panjangnya. Cek harga model terbaru di situs penyedia.
- **Bukan nasihat profesional.** Prompt melarang rekomendasi produk investasi, pajak, dan hukum, dan halaman menampilkan penafian.

**Catatan jujur:** bagian AI diuji dengan penyedia palsu yang meniru format Anthropic dan OpenAI (`server/tests/fake-ai.mjs`), bukan dengan API sungguhan.
Nama model dan alamat bawaan diperiksa dari dokumentasi penyedia, tapi belum dipanggil dengan kunci asli. Coba dulu dengan kunci milikmu dan periksa hasilnya.
Untuk mencoba tanpa kunci: `node server/tests/fake-ai.mjs`, lalu set `AI_ENABLED=true`, `AI_PROVIDER=compat`, `AI_API_KEY=apa-saja`,
`AI_BASE_URL=http://localhost:4200/openai/v1`, dan `AI_MODEL=uji`. Hasil dari penyedia palsu hanya contoh tetap.

## Geser antar tab

Di HP, geser layar ke kiri atau kanan untuk pindah ke tab berikutnya atau sebelumnya (Ringkasan, Transaksi, Dompet, Tren, Rencana).
Halaman baru masuk dari arah geseran, dan ketuk menu bawah memakai arah animasi yang sama. Geseran diabaikan, supaya tidak salah pindah, kalau:

- ada jendela terbuka, atau halaman Panduan, Kelola, atau Impor mutasi sedang dibuka (data pratinjau impor tidak hilang),
- kamu sedang mengetik di sebuah isian,
- sentuhan dimulai di tepi layar (dibiarkan untuk gestur kembali milik HP), memakai dua jari, terlalu pendek, terlalu miring, atau terlalu lambat,
- sentuhan berada di area yang punya geseran sendiri, yaitu daftar kartu dompet, deret chip, dan slider.

Di ujung (Ringkasan atau Rencana) geseran tidak berputar. Pengaturan "kurangi gerakan" di HP dihormati: tetap pindah, tanpa animasi.
Logikanya ada di `client/src/swipe.js`.

## Panduan pengguna

Ketuk tombol **?** di pojok atas (atau menu Akun > Panduan pengguna). Isinya 16 bagian yang bisa dibuka satu per satu dan dicari:
mulai cepat (daftar langkah yang bertanda otomatis dari datamu), mencatat transaksi, membaca Ringkasan, dompet dan transfer,
tren, budget, target tabungan, impor mutasi, ekspor, kelola dompet dan kategori, akun, rutinitas, tanya jawab, batasan, dan istilah.
Halaman impor dan kartu "Belum ada pengeluaran" punya tautan langsung ke bagian yang relevan.

Isi panduan ada di `client/src/guideContent.js`. Saat mengubah nama tombol atau menu di aplikasi, perbarui panduannya juga:
`npm test` di folder `client` memeriksa bahwa semua tulisan layar yang disebut panduan masih ada di kode.

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
- Setiap kolom kata sandi (masuk, daftar, ganti kata sandi) punya **tombol mata** untuk menampilkan atau menyembunyikan isinya. Kolom selalu mulai tersembunyi, dan tombolnya tidak mencuri fokus dari isian.
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
`GET|POST /api/goals`, `PUT|DELETE /api/goals/:id`, `GET|POST /api/goals/:id/deposits`, `PUT|DELETE /api/goals/:id/deposits/:depId`, `GET /api/reports/monthly|trend|weekday`, `GET /api/insights`, `POST /api/ai/consent`, `POST /api/ai/analysis`,
`GET /api/export/csv|pdf?month=YYYY-MM`.
