# Panduan deploy beFince: Neon, Render, Vercel

Urutan: **GitHub → Neon (database) → Render (backend) → Vercel (frontend) → sambungkan → daftar akun**.
Siapkan Notepad untuk mencatat tiga alamat: string koneksi Neon, URL Render, dan URL Vercel.

| Bagian | Platform | Folder | Yang perlu kamu isi |
|---|---|---|---|
| Database | Neon | - | menyalin string koneksi |
| Backend | Render | `server` | `DATABASE_URL`, `CLIENT_ORIGIN` (`JWT_SECRET` dibuat otomatis) |
| Frontend | Vercel | `client` | `VITE_API_URL` |

Beri nama berbeda dari project pertamamu supaya tidak tertukar (Blueprint memakai `befince-api`, di Vercel pakai `befince-web`).

## 0. Taruh kode di GitHub

Buat repo **private** kosong di GitHub, lalu di folder `befince`:

```
git init
git add .
git commit -m "beFince"
git branch -M main
git remote add origin https://github.com/USERNAME/befince.git
git push -u origin main
```

Cek dulu dengan `git status` bahwa tidak ada berkas `.env` yang ikut (sudah diabaikan lewat `.gitignore`). Jangan pernah commit `.env`.

## 1. Neon (database)

1. Daftar di neon.tech, klik **Create project**. Pilih region **AWS Asia Pacific (Singapore)** supaya dekat dengan Indonesia. Region tidak bisa diubah setelah project dibuat.
2. Di dashboard, klik **Connect**. Matikan toggle **Connection pooling** supaya string tidak mengandung `-pooler` (koneksi langsung). Aplikasi ini hanya satu server dengan sedikit koneksi, jadi koneksi langsung sudah cukup.
3. Salin string koneksinya. Bentuknya:
   `postgresql://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
   Bagian `&channel_binding=require` kalau ada boleh dibiarkan. Tabel dibuat otomatis di langkah 2, tidak perlu menjalankan SQL manual.

## 2. Render (backend)

**Cara cepat (Blueprint):**

1. Daftar di render.com dengan akun GitHub. Klik **New → Blueprint**, pilih repo `befince`. Render membaca `render.yaml` di akar repo.
2. Render meminta dua isian:
   - `DATABASE_URL`: tempel string koneksi dari Neon.
   - `CLIENT_ORIGIN`: isi sementara `http://localhost:5173` (alamat Vercel belum ada, nanti diganti di langkah 4).
3. Klik **Apply**. Tunggu sampai status **Live**. Buka tab **Logs**, pastikan ada baris `Tabel database siap` dan `API siap`.
4. Catat URL layanan, misalnya `https://befince-api.onrender.com`. Kalau nama sudah dipakai orang lain, Render menambah akhiran acak, jadi salin URL yang tampil di dashboard.
5. Tes: buka `URL-RENDER/api/health` (harus `{"ok":true}`) lalu `URL-RENDER/api/health/db` (harus `{"ok":true}`, artinya backend berhasil menjangkau Neon).

**Cara manual** (kalau tidak memakai Blueprint): **New → Web Service**, pilih repo, lalu isi:

| Kolom | Nilai |
|---|---|
| Root Directory | `server` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Region | Singapore |
| Health Check Path | `/api/health` |
| Environment | `NODE_VERSION=22`, `DATABASE_URL`, `CLIENT_ORIGIN`, `JWT_SECRET` (isi acak minimal 32 karakter, lihat cara membuatnya di `server/.env.example`), `AUTO_DB_INIT=true`, `ALLOW_REGISTRATION=true`, `APP_TZ=Asia/Jakarta` |

## 3. Vercel (frontend)

1. Daftar di vercel.com dengan akun GitHub. **Add New → Project**, impor repo `befince`.
2. Atur:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite (biasanya terdeteksi otomatis)
   - **Build Command**: `npm run build`, **Output Directory**: `dist`
   - **Environment Variables**: `VITE_API_URL` = URL Render dari langkah 2, memakai `https://` dan tanpa garis miring di akhir.
3. Klik **Deploy**. Catat URL-nya, misalnya `https://befince-web.vercel.app`.

Penting: `VITE_API_URL` tertanam saat build. Kalau kamu mengubahnya nanti, lakukan **Redeploy** di Vercel, kalau tidak aplikasi tetap memakai alamat lama.

## 4. Sambungkan frontend ke backend

Di Render buka layanan `befince-api` → **Environment** → ubah `CLIENT_ORIGIN` menjadi URL Vercel persis seperti di address bar, `https://befince-web.vercel.app`, tanpa garis miring di akhir. Simpan. Render otomatis deploy ulang.

- Alamat harus sama persis. Tanpa ini browser memblokir permintaan (error CORS).
- Alamat preview Vercel (yang berubah tiap deploy) tidak akan diterima. Pakai alamat production. Kalau memakai domain sendiri, tulis keduanya dipisah koma.

## 5. Daftar akun dan isi saldo awal

1. Buka URL Vercel, pilih **Daftar**, buat akunmu. Akun baru otomatis mendapat dompet Tunai, Rekening Bank, E-wallet, dan kategori awal.
2. Saldo awal dompet masih 0. Isi lewat **SQL Editor** di Neon (ganti angka dan emailmu):
   ```sql
   UPDATE wallets SET opening_balance = 500000
   WHERE kind = 'cash' AND user_id = (SELECT id FROM users WHERE email = 'emailmu@contoh.com');
   ```
   Ulangi untuk `'bank'` dan `'ewallet'`.
3. **Tutup pendaftaran**: di Render ubah `ALLOW_REGISTRATION` menjadi `false`. Setelah itu orang lain tidak bisa membuat akun di servermu, tapi kamu tetap bisa masuk.
4. Opsional: ubah `AUTO_DB_INIT` menjadi `false`. Kalau suatu saat skema berubah dan kamu memperbarui kode, nyalakan lagi sementara.

## 5b. Opsional: mengaktifkan analisa AI

Analisa cepat (tanpa AI) sudah jalan tanpa langkah ini. Untuk analisa AI, pilih satu penyedia lalu isi di Render, di layanan backend, tab **Environment**,
**+ Add Environment Variable**, lalu **Save and deploy**.

**Pilihan gratis, tanpa kartu kredit: Groq (paling mudah)**

1. Buka console.groq.com, daftar, lalu buka **API Keys** dan buat kunci. Salin kuncinya.
2. Di Render tambahkan:

| Variabel | Isi |
|---|---|
| `AI_ENABLED` | `true` |
| `AI_PROVIDER` | `groq` |
| `AI_API_KEY` | kunci dari Groq |
| `AI_DAILY_LIMIT` | opsional, bawaan 5 per pengguna per hari |

Model bawaan (`openai/gpt-oss-120b`) dipakai otomatis. Groq sering mengganti katalognya (`llama-3.3-70b-versatile` dihentikan 16 Agustus 2026). Kalau aplikasi menampilkan "model ... tidak tersedia atau sudah dihentikan", lihat daftar model terbaru di console.groq.com/docs/models lalu isi `AI_MODEL`.

Saat mencoba pertama kali, naikkan `AI_DAILY_LIMIT` (misalnya 20) supaya tidak terbatas oleh jatah harian. Kegagalan di sisi penyedia tidak memakai jatah, tapi jawaban yang ditolak pemeriksa memakainya.

**Alternatif: Google Gemini.** Buat kunci di Google AI Studio, lalu isi `AI_PROVIDER=gemini` dan `AI_API_KEY`. Di tingkat gratis, Google boleh memakai prompt dan jawaban
untuk memperbaiki produknya, jadi pertimbangkan itu untuk data keuangan.

**Alternatif berbayar: Anthropic.** `AI_PROVIDER=anthropic` (bawaan) dan `AI_API_KEY` dari Claude Console. Pasang batas pengeluaran bulanan di konsolnya.

Pastikan `AUTO_DB_INIT=true` pada deploy pertama versi ini, karena tabel dan kolom untuk analisa dibuat server saat menyala.
Pengguna tetap harus memberi izin di dalam aplikasi sebelum datanya dikirim. Untuk mematikan AI, ubah `AI_ENABLED` menjadi `false`.

## 6. Daftar periksa setelah deploy

- [ ] `URL-RENDER/api/health/db` menjawab `{"ok":true}`
- [ ] Bisa daftar dan masuk dari URL Vercel
- [ ] Catat transaksi, lalu muat ulang halaman: datanya tetap ada
- [ ] Tombol Unduh PDF dan CSV di Ringkasan menghasilkan berkas
- [ ] Ganti kata sandi berhasil
- [ ] Dibuka di HP, lalu "Tambahkan ke layar utama"
- [ ] `ALLOW_REGISTRATION=false` sudah diatur
- [ ] Pembuatan akun dari jendela penyamaran ditolak (pendaftaran sudah tertutup)

## 7. Server gratis yang "tidur"

- Layanan gratis Render tidur setelah sekitar 15 menit tanpa permintaan, dan permintaan pertama sesudahnya lebih lambat (bisa sampai sekitar satu menit). Aplikasi menampilkan petunjuk "Server sedang bangun" kalau menunggu lebih dari beberapa detik.
- Neon gratis juga menidurkan database setelah 5 menit tanpa aktivitas. Bangunnya cepat, dan server sudah menangani koneksi yang putus saat itu.
- Supaya Render tidak tidur, kamu bisa memakai layanan ping gratis (misalnya UptimeRobot) ke `URL-RENDER/api/health` setiap 10 sampai 14 menit. Cek dulu batas jam gratis di halaman harga Render. Ping ke `/api/health` tidak membangunkan Neon, jadi database tetap bisa tidur.
- Batas dan harga paket bisa berubah. Cek halaman harga Neon, Render, dan Vercel sebelum bergantung padanya. Paket Hobby Vercel ditujukan untuk pemakaian pribadi non-komersial.

## 8. Memperbarui aplikasi

Ubah kode, lalu `git add . && git commit -m "pesan" && git push`. Render dan Vercel deploy otomatis. Kalau berubah di `server/db.sql`, pastikan `AUTO_DB_INIT=true` supaya tabel ikut diperbarui.

## 9. Lupa kata sandi

Belum ada pemulihan lewat email. Dari komputermu, di folder `server` (sudah `npm install`):

```
# Windows PowerShell
$env:DATABASE_URL="string-koneksi-neon"; npm run user:reset -- emailmu@contoh.com

# Mac/Linux
DATABASE_URL="string-koneksi-neon" npm run user:reset -- emailmu@contoh.com
```

Skrip mencetak kata sandi sementara dan mengeluarkan semua sesi lama. Masuk dengan kata sandi itu, lalu ganti lewat **Akun → Ganti kata sandi**.

## 10. Kalau ada masalah

| Gejala | Kemungkinan penyebab | Perbaikan |
|---|---|---|
| Layar masuk: "Tidak bisa terhubung ke server" | `VITE_API_URL` salah, memakai `http://`, atau belum Redeploy setelah diubah | Perbaiki di Vercel, lalu Redeploy. Cek `URL-RENDER/api/health` di tab baru |
| Console browser: error CORS | `CLIENT_ORIGIN` tidak persis sama dengan alamat Vercel | Samakan, tanpa garis miring di akhir |
| Render gagal start: "JWT_SECRET wajib diisi" | Variabel `JWT_SECRET` tidak ada (kalau manual) | Isi nilai acak minimal 32 karakter |
| Log: "password authentication failed" | String koneksi Neon salah atau kata sandi database diganti | Salin ulang string dari Neon ke `DATABASE_URL` |
| `/api/health` jalan, `/api/health/db` 503 | Backend tidak bisa menjangkau Neon | Cek `DATABASE_URL`, dan pastikan project Neon aktif |
| "Terlalu banyak percobaan" | Pembatas login (30 kali per 15 menit per IP) | Tunggu 15 menit |
| Vercel menampilkan 404 | Root Directory bukan `client` | Ubah di Settings, lalu Redeploy |
| Jam transaksi selisih 1 sampai 2 jam | `APP_TZ` belum sesuai zona waktumu | Set `APP_TZ` di Render: `Asia/Jakarta` (WIB), `Asia/Makassar` (WITA), atau `Asia/Jayapura` (WIT) |
| Analisa AI: "belum diaktifkan di server ini" | `AI_ENABLED` bukan `true` atau `ANTHROPIC_API_KEY` kosong | Isi di Render, lalu tunggu deploy ulang |
| Analisa AI: "model ... tidak tersedia atau sudah dihentikan" | Nama model sudah tidak ada di penyedia | Isi `AI_MODEL` dengan model yang masih ada (cek daftar model penyedia) |
| Analisa AI: "kunci API ditolak" | `AI_API_KEY` salah, atau tidak cocok dengan `AI_PROVIDER` | Periksa keduanya di Render |
| Analisa AI: "jawaban model tidak lolos pemeriksaan" | Model kecil tidak mengikuti format | Coba lagi, atau pakai model yang lebih besar lewat `AI_MODEL`. Detail alasan ada di log Render (`Analisa AI gagal:`) |
| Analisa AI: "Penyedia AI sedang membatasi permintaan" | Batas tingkat gratis penyedia (per menit atau per hari) | Tunggu beberapa menit; jatah harian pengguna tidak terpakai |
| Semua pengguna keluar sendiri | `JWT_SECRET` diganti | Normal: masuk lagi. Jangan mengubahnya tanpa alasan |
| Permintaan pertama lama sekali | Render dan Neon baru bangun | Normal di paket gratis, lihat bagian 7 |
