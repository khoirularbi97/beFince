// Isi Panduan pengguna. Format sederhana supaya mudah diubah:
//   blocks: { t: 'p' | 'steps' | 'list' | 'tip' | 'warn' | 'qa' , ... }
//   **teks** = tebal. `refs` = tulisan di layar yang disebut panduan; tests/guide.test.mjs memastikan semuanya masih ada di aplikasi,
//   jadi kalau tombol diganti namanya dan panduan lupa diperbarui, uji akan gagal.
export const GUIDE = [
  {
    id: 'mulai', icon: '🚀', title: 'Mulai cepat', summary: 'Lima langkah supaya beFince siap dipakai',
    refs: ['Kelola dompet dan kategori', 'Catat transaksi', 'Atur budget', 'Target baru'],
    blocks: [
      { t: 'p', x: 'Ikuti daftar di atas dari atas ke bawah. Tanda ✓ muncul otomatis begitu langkahnya selesai.' },
      { t: 'tip', x: '**Saldo awal itu penting.** Isi dengan uang yang sudah ada di tiap dompet sebelum kamu mulai mencatat. Dari situ saldo dompet dihitung: saldo awal ditambah pemasukan, dikurangi pengeluaran. Kalau saldo awal salah, saldo dompetmu ikut salah.' },
      { t: 'p', x: 'Semua bagian aplikasi menampilkan data **bulan yang dipilih**. Ganti bulan dengan tombol ‹ dan › di pojok atas.' },
    ],
  },
  {
    id: 'catat', icon: '✍️', title: 'Mencatat transaksi', summary: 'Pengeluaran dan pemasukan harian',
    refs: ['Catat transaksi', 'Simpan transaksi', 'Ubah', 'Hapus'],
    blocks: [
      { t: 'steps', x: [
        'Ketuk **Catat transaksi** (tombol mengambang di tab Ringkasan, Transaksi, dan Dompet).',
        'Pilih **Pengeluaran** atau **Pemasukan**.',
        'Isi nominal. Titik ribuan muncul otomatis, jadi cukup ketik `85000` untuk Rp85.000. Nominal yang disalin dari m-banking juga bisa ditempel.',
        'Pilih kategori dan dompet, atur tanggal, lalu tulis catatan kalau perlu.',
        'Ketuk **Simpan transaksi**.',
      ] },
      { t: 'p', x: '**Mengubah atau menghapus:** buka tab **Transaksi**, lalu ketuk **Ubah** pada baris yang salah. Untuk menghapus, ketuk **Hapus** dua kali: ketukan pertama meminta konfirmasi, ketukan kedua menghapus.' },
      { t: 'p', x: '**Jam transaksi** diambil otomatis dari waktu pencatatan, dan hanya muncul untuk transaksi yang kamu catat sendiri di hari kejadiannya. Transaksi yang dicatat mundur atau hasil impor tidak punya jam.' },
      { t: 'tip', x: 'Catat segera setelah membayar, selagi ingat. Kalau terlambat, pilih tanggal yang benar di form.' },
    ],
  },
  {
    id: 'ringkasan', icon: '📊', title: 'Membaca Ringkasan', summary: 'Gambaran uangmu bulan ini',
    refs: ['Sisa uang bulan ini', 'Ke mana uangnya pergi', 'Pengeluaran per hari', 'Transaksi terbaru'],
    blocks: [
      { t: 'list', x: [
        '**Sisa uang bulan ini**: pemasukan dikurangi pengeluaran pada bulan yang dipilih.',
        'Bar di bawahnya menunjukkan berapa persen pemasukan sudah terpakai, beserta perbandingan pengeluaran dengan bulan lalu.',
        '**Ke mana uangnya pergi**: pengeluaran per kategori, dari yang terbesar.',
        '**Pengeluaran per hari**: batang tertinggi adalah hari paling boros.',
        '**Transaksi terbaru**: lima transaksi terakhir di bulan itu.',
      ] },
      { t: 'warn', x: 'Sisa uang bulan ini **bukan** saldo dompet. Saldo dompet ada di tab Dompet dan memperhitungkan saldo awal, transfer, dan setoran tabungan.' },
    ],
  },
  {
    id: 'transaksi', icon: '🔎', title: 'Mencari dan menyaring transaksi', summary: 'Temukan transaksi tertentu dengan cepat',
    refs: ['Cari dan filter', 'Semua kategori', 'Semua jenis', 'Semua dompet'],
    blocks: [
      { t: 'steps', x: [
        'Buka tab **Transaksi**.',
        'Ketik kata di kolom pencarian (dicocokkan dengan nama kategori dan catatan).',
        'Pilih filter kategori, jenis (pengeluaran atau pemasukan), dompet, dan rentang tanggal.',
        'Baris ringkasan di bawah filter menunjukkan jumlah transaksi dan total masuk serta keluarnya.',
      ] },
    ],
  },
  {
    id: 'dompet', icon: '👛', title: 'Dompet dan transfer', summary: 'Tunai, rekening bank, e-wallet, dan perpindahan uang',
    refs: ['Pengeluaran dari mana', 'Transfer antar dompet', 'Transfer', 'Pindahkan saldo'],
    blocks: [
      { t: 'p', x: 'Setiap dompet mewakili satu tempat uangmu: tunai, rekening bank, atau e-wallet. Kamu boleh punya banyak, misalnya Mandiri, BCA, GoPay, dan DANA. Tambahkan lewat **Kelola dompet dan kategori**.' },
      { t: 'list', x: [
        'Kartu dompet menampilkan saldo sampai akhir bulan yang dipilih, serta total masuk dan keluar di bulan itu.',
        '**Pengeluaran dari mana** menunjukkan pembagian pengeluaranmu per dompet.',
        'Saldo = saldo awal + pemasukan − pengeluaran ± transfer − setoran tabungan.',
      ] },
      { t: 'p', x: '**Transfer** memindahkan uang antar dompetmu sendiri, misalnya tarik tunai atau isi saldo e-wallet. Transfer hanya memindahkan saldo, tidak dihitung sebagai pemasukan atau pengeluaran, dan ditolak kalau saldo dompet asal kurang.' },
      { t: 'steps', x: ['Buka tab **Dompet** lalu ketuk **Transfer**.', 'Pilih dompet **Dari** dan **Ke**, lalu isi nominal.', 'Ketuk **Pindahkan saldo**.'] },
    ],
  },
  {
    id: 'tren', icon: '📈', title: 'Tren dan pola pengeluaran', summary: 'Melihat kebiasaan dari bulan ke bulan',
    refs: ['Pemasukan dan pengeluaran 6 bulan', 'Pola pengeluaran per hari dalam seminggu', 'Perubahan per kategori'],
    blocks: [
      { t: 'list', x: [
        '**Pemasukan dan pengeluaran 6 bulan** membandingkan enam bulan terakhir, lengkap dengan sisa uang dan rata-rata pengeluaran.',
        '**Pola pengeluaran per hari dalam seminggu** menunjukkan rata-rata per hari (Senin sampai Minggu) dan membandingkan akhir pekan dengan hari kerja. Karena memakai rata-rata, bulan yang punya lebih banyak hari tertentu tidak menyesatkan.',
        '**Perubahan per kategori** membandingkan pengeluaran tiap kategori dengan bulan lalu.',
      ] },
      { t: 'tip', x: 'Tren baru berguna setelah beberapa bulan terisi. Impor mutasi bulan-bulan lalu untuk mengisinya.' },
    ],
  },
  {
    id: 'budget', icon: '🎯', title: 'Budget dan proyeksi', summary: 'Batas pengeluaran per kategori',
    refs: ['Atur budget', 'Simpan budget', 'Isi dari rata-rata 3 bulan terakhir', 'Proyeksi akhir bulan', 'Budget bulan ini'],
    blocks: [
      { t: 'steps', x: [
        'Buka tab **Rencana**, bagian **Budget**.',
        'Ketuk **Atur budget** lalu isi nominal tiap kategori. Kosongkan atau isi 0 kalau kategori tidak perlu budget.',
        'Ketuk **Simpan budget**.',
      ] },
      { t: 'list', x: [
        'Bulan baru otomatis memakai budget bulan sebelumnya sampai kamu mengubahnya.',
        '**Isi dari rata-rata 3 bulan terakhir** mengisi angka awal dari pengeluaranmu sendiri. Angkanya tetap bisa kamu ubah.',
        'Warna bar: hijau berarti aman, kuning berarti sudah 90% atau lebih, merah berarti melewati budget.',
        '**Proyeksi akhir bulan**: garis putus-putus memperkirakan total pengeluaran akhir bulan kalau laju sekarang berlanjut. Geser **Simulasi** untuk mencoba tanggal lain.',
      ] },
    ],
  },
  {
    id: 'tabungan', icon: '🐷', title: 'Target tabungan', summary: 'Menabung untuk tujuan tertentu',
    refs: ['Target baru', 'Setor', 'Riwayat', 'Ubah', 'Target tabungan'],
    blocks: [
      { t: 'steps', x: [
        'Buka tab **Rencana**, pilih **Target tabungan**, lalu ketuk **Target baru**.',
        'Isi nama, pilih ikon, isi nominal target. Tabungan awal dan tenggat boleh dikosongkan.',
        'Ketuk **Setor** setiap kali menabung, lalu pilih dompet asal uangnya.',
      ] },
      { t: 'list', x: [
        'Setoran mengurangi saldo dompet yang dipilih, tapi **tidak dihitung sebagai pengeluaran**.',
        '**Ubah** mengganti nama, ikon, target, tabungan awal, dan tenggat. Setoran yang sudah tercatat tidak ikut berubah.',
        '**Riwayat (n)** menampilkan setoran per target. Di sana kamu bisa mengubah atau menghapus setoran yang salah input, dan saldo dompet mengikuti.',
        'Kartu target menunjukkan berapa yang perlu ditabung per bulan sampai tenggat, dibandingkan dengan laju 3 bulan terakhir.',
        'Menghapus target ikut menghapus riwayat setorannya, dan uangnya kembali ke dompet.',
      ] },
    ],
  },
  {
    id: 'impor', icon: '📥', title: 'Impor mutasi bank dan e-wallet', summary: 'Memasukkan banyak transaksi sekaligus',
    refs: ['Impor mutasi', 'Berkas CSV/PDF', 'Tempel teks', 'Baca data', 'Mungkin sudah ada', 'Mungkin perpindahan antar dompet', 'Transfer'],
    blocks: [
      { t: 'p', x: 'beFince **tidak terhubung langsung** ke bank atau e-wallet. Kamu mengunduh mutasinya dari aplikasi bank, lalu mengimpornya ke beFince.' },
      { t: 'steps', x: [
        'Di aplikasi bank atau e-wallet, cari menu e-statement, mutasi, atau riwayat transaksi, lalu unduh sebagai PDF atau CSV. Nama menunya berbeda tiap bank.',
        'Di beFince buka tab **Transaksi** lalu ketuk **Impor mutasi**.',
        'Pilih dompet tujuan, lalu pilih sumber: **Berkas CSV/PDF** atau **Tempel teks** (untuk notifikasi atau baris yang disalin).',
        'Ketuk **Baca data**.',
        'Periksa pratinjau. Kamu bisa mengubah tanggal, nominal, arah masuk atau keluar, kategori, dan catatan. Hilangkan centang pada baris yang tidak mau diimpor.',
        'Ketuk **Simpan**.',
      ] },
      { t: 'p', x: '**Arti tanda di pratinjau:**' },
      { t: 'list', x: [
        '**Mungkin sudah ada** (duplikat): di dompet itu sudah ada transaksi dengan tanggal, jenis, dan nominal yang sama. Baris ini tidak dicentang otomatis.',
        '**Mungkin perpindahan antar dompet**: biasanya top up atau transfer ke e-wallet, tarik tunai, dan sejenisnya. Tidak dicentang otomatis supaya tidak tercatat dua kali.',
        'Tanda kuning: arah, nominal, atau tanggal belum pasti. Periksa dulu.',
        'Untuk PDF yang punya kolom saldo, beFince mencocokkan selisih saldo dengan nominal. Kalau cocok, arah masuk atau keluarnya terverifikasi.',
      ] },
      { t: 'tip', x: '**Satu rekening, satu dompet.** Impor mutasi BCA ke dompet BCA, mutasi GoPay ke dompet GoPay. Kalau kamu top up GoPay dari rekening, baris di bank (keluar) dan di GoPay (masuk) adalah satu perpindahan uang. Biarkan keduanya tidak dicentang, lalu catat satu **Transfer** di tab Dompet.' },
      { t: 'list', x: [
        'Mengimpor berkas yang sama dua kali aman: baris yang sudah ada ditandai dan tidak dicentang.',
        'Maksimal 1000 baris sekali impor.',
        'PDF harus berisi teks. Hasil scan, foto, atau tangkapan layar belum bisa dibaca. PDF yang terkunci sandi harus dibuka kuncinya dulu.',
        'Berkasnya dibaca di perangkatmu dan baru dikirim ke server saat kamu menekan Simpan.',
      ] },
      { t: 'warn', x: 'Selalu periksa pratinjau. Format tiap bank bisa berbeda dan bisa berubah, jadi hasil baca kadang meleset.' },
    ],
  },
  {
    id: 'ekspor', icon: '📤', title: 'Ekspor laporan bulanan', summary: 'PDF dan CSV',
    refs: ['Ekspor laporan bulan ini', 'Unduh PDF', 'Unduh CSV'],
    blocks: [
      { t: 'steps', x: ['Buka tab **Ringkasan** dan pilih bulannya.', 'Geser ke bawah ke **Ekspor laporan bulan ini**.', 'Ketuk **Unduh PDF** atau **Unduh CSV**.'] },
      { t: 'list', x: [
        '**PDF**: ringkasan, budget per kategori, saldo dompet, target tabungan, dan 10 pengeluaran terbesar.',
        '**CSV**: semua transaksi bulan itu, dengan kolom Tanggal, Jam, Jenis, Kategori, Dompet, Catatan, Nominal. Pemisahnya titik koma, supaya rapi di Excel dengan pengaturan Indonesia.',
      ] },
      { t: 'tip', x: 'Kalau CSV terbuka dalam satu kolom di Excel, pakai Data lalu From Text/CSV.' },
    ],
  },
  {
    id: 'kelola', icon: '⚙️', title: 'Kelola dompet dan kategori', summary: 'Tambah, ubah nama, atau hapus',
    refs: ['Kelola dompet dan kategori', 'Ganti nama', 'Hapus kategori', 'Tambah dompet'],
    blocks: [
      { t: 'steps', x: ['Ketuk **inisial namamu** di pojok atas.', 'Pilih **Kelola dompet dan kategori**.'] },
      { t: 'list', x: [
        '**Dompet**: tambah (nama, jenis, saldo awal), ubah, dan hapus. Dompet yang sudah dipakai transaksi, transfer, atau setoran tidak bisa dihapus, dan harus selalu ada minimal satu dompet.',
        '**Kategori**: tambah, **Ganti nama**, dan hapus. Jenisnya (pemasukan atau pengeluaran) tidak bisa diubah.',
        'Saat menghapus kategori yang sudah dipakai, kamu memilih ke kategori mana transaksinya dipindahkan, atau dibiarkan menjadi "Tanpa kategori". Budget kategori itu ikut terhapus.',
      ] },
      { t: 'tip', x: 'Saat mengubah saldo awal dompet, dialog menampilkan pratinjau saldo sesudah diubah.' },
    ],
  },
  {
    id: 'akun', icon: '🔐', title: 'Akun dan keamanan', summary: 'Kata sandi, keluar, dan tema',
    refs: ['Ganti kata sandi', 'Keluar'],
    blocks: [
      { t: 'list', x: [
        '**Ganti kata sandi**: ketuk inisial namamu, lalu **Ganti kata sandi**. Minimal 8 karakter. Setelah diganti, perangkat lain yang sedang masuk otomatis keluar.',
        'Ketuk **Keluar** setelah selesai kalau memakai perangkat bersama.',
        'Tombol ☾ dan ☀ di pojok atas mengganti tema gelap dan terang.',
        'Belum ada pemulihan kata sandi lewat email. Kalau lupa, minta pemilik aplikasi mereset kata sandimu.',
      ] },
      { t: 'warn', x: 'Jangan biarkan beFince terbuka di komputer umum atau bersama tanpa menekan Keluar.' },
    ],
  },
  {
    id: 'rutinitas', icon: '📅', title: 'Rutinitas yang disarankan', summary: 'Supaya catatan tetap akurat',
    refs: [],
    blocks: [
      { t: 'list', x: [
        '**Harian atau tiap beberapa hari**: catat transaksi, atau impor mutasi bank dan e-wallet.',
        '**Mingguan**: cocokkan saldo tiap dompet dengan saldo asli di aplikasi bank. Kalau beda, cari transaksi atau biaya yang belum dicatat.',
        '**Awal bulan**: lihat Tren bulan lalu, atur budget bulan ini, unduh PDF laporan bulan lalu, dan setor ke target tabungan.',
      ] },
    ],
  },
  {
    id: 'tanya', icon: '❓', title: 'Tanya jawab', summary: 'Masalah yang sering muncul',
    refs: [],
    blocks: [
      { t: 'qa', q: 'Saldo dompet di beFince tidak sama dengan saldo asli.', a: 'Periksa tiga hal: (1) saldo awal dompet sudah benar, (2) ada transaksi atau biaya admin yang belum dicatat, (3) perpindahan antar dompet sudah dicatat sebagai Transfer, bukan pengeluaran dan pemasukan. Sebagai jalan pintas terakhir, ubah saldo awal sebesar selisihnya.' },
      { t: 'qa', q: 'Saldo dompet bulan lalu berbeda dengan bulan ini. Kenapa?', a: 'Kartu dompet menampilkan saldo sampai akhir bulan yang kamu pilih, jadi angkanya memang berubah mengikuti bulan.' },
      { t: 'qa', q: 'Top up e-wallet tercatat dua kali.', a: 'Top up adalah perpindahan uang, bukan belanja. Saat impor, jangan centang baris top up di bank maupun di e-wallet, lalu catat satu Transfer di tab Dompet.' },
      { t: 'qa', q: 'Impor menandai hampir semua baris "Mungkin sudah ada".', a: 'Baris dianggap sudah ada kalau di dompet yang sama ada transaksi dengan tanggal, jenis, dan nominal yang sama. Itu wajar kalau kamu mengimpor ulang berkas yang sama. Kalau transaksinya memang berbeda (misalnya dua parkir Rp5.000 di hari yang sama), centang barisnya.' },
      { t: 'qa', q: 'PDF tidak terbaca atau hasilnya salah.', a: 'Pastikan PDF-nya e-statement asli yang berisi teks, bukan hasil scan atau foto, dan tidak terkunci sandi. Kalau tetap bermasalah, coba berkas CSV atau salin barisnya ke Tempel teks. Periksa selalu pratinjaunya.' },
      { t: 'qa', q: 'Kenapa transaksiku tidak punya jam?', a: 'Jam hanya ada untuk transaksi yang kamu catat sendiri pada hari kejadiannya. Transaksi yang dicatat mundur atau hasil impor tidak punya jam karena waktu pencatatannya bukan waktu kejadian.' },
      { t: 'qa', q: 'Dompet tidak bisa dihapus.', a: 'Dompet yang sudah dipakai transaksi, transfer, atau setoran tabungan tidak bisa dihapus, dan harus ada minimal satu dompet. Ubah saja nama atau saldo awalnya.' },
      { t: 'qa', q: 'Budget bulan ini kosong.', a: 'Budget belum pernah diatur. Setelah kamu mengaturnya sekali, bulan-bulan berikutnya otomatis memakai budget yang sama sampai diubah.' },
      { t: 'qa', q: 'Aplikasi lambat saat pertama dibuka.', a: 'Server di paket gratis "tidur" kalau lama tidak dipakai, dan butuh sekitar satu menit untuk bangun. Setelah itu normal.' },
      { t: 'qa', q: 'Muncul "Sesi berakhir, silakan masuk lagi".', a: 'Masuk lagi saja. Ini terjadi kalau masa berlaku masuk (7 hari) habis, atau kata sandi diganti dari perangkat lain.' },
      { t: 'qa', q: 'Muncul "Terlalu banyak percobaan".', a: 'Ada pembatas keamanan untuk masuk dan ganti kata sandi. Tunggu sekitar 15 menit lalu coba lagi.' },
    ],
  },
  {
    id: 'batas', icon: '🧭', title: 'Yang belum bisa', summary: 'Batasan beFince saat ini',
    refs: [],
    blocks: [
      { t: 'list', x: [
        'Belum terhubung otomatis ke rekening bank atau e-wallet. Data masuk lewat catatan manual atau impor mutasi.',
        'Belum bisa membaca foto atau scan nota, e-statement hasil scan, dan tangkapan layar.',
        'Hanya rupiah, dan butuh koneksi internet.',
        'Belum ada berbagi akun antar orang, dan belum ada fitur ekspor semua data atau hapus akun dari dalam aplikasi.',
      ] },
    ],
  },
  {
    id: 'istilah', icon: '📖', title: 'Istilah singkat', summary: 'Arti kata yang dipakai di aplikasi',
    refs: [],
    blocks: [
      { t: 'list', x: [
        '**Saldo awal**: uang di dompet sebelum kamu mulai mencatat di beFince.',
        '**Transfer**: perpindahan uang antar dompetmu sendiri. Tidak dihitung pemasukan atau pengeluaran.',
        '**Setoran**: uang yang kamu tabung ke sebuah target. Mengurangi saldo dompet, bukan pengeluaran.',
        '**Laju ideal**: garis yang menunjukkan pengeluaran jika dibagi rata setiap hari sesuai budget.',
        '**Proyeksi**: perkiraan total pengeluaran akhir bulan kalau laju sekarang berlanjut.',
        '**Duplikat**: baris impor yang tampaknya sudah pernah dicatat.',
      ] },
    ],
  },
];

const strip = (s) => String(s).replace(/\*\*/g, '').replace(/`/g, '');
// Teks polos satu bagian, untuk pencarian
export const plain = (sec) => strip([sec.title, sec.summary, ...sec.blocks.flatMap((b) => (b.t === 'qa' ? [b.q, b.a] : Array.isArray(b.x) ? b.x : [b.x]))].join(' ')).toLowerCase();
