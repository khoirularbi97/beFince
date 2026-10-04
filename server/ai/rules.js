// Analisa berbasis aturan: bekerja tanpa AI, instan, dan privat. Semua angka lewat penanda {{kunci}} yang diisi dari fakta.
// Ambang batas adalah pedoman umum, bukan nasihat keuangan profesional.
const SEV_ORDER = { warn: 0, info: 1, good: 2 };
const HOR_ORDER = { minggu_ini: 0, '30_hari': 1, '3_bulan': 2 };

export function rulesReport({ by, enough }) {
  const v = (k) => by.get(k)?.value;
  const has = (k) => by.has(k);
  const F = [], S = [], W = [];
  const f = (id, severity, title, detail) => F.push({ id, severity, title, detail });
  const s = (id, horizon, title, how, why = '') => S.push({ id, horizon, title, how, why });
  if (!enough) {
    return { source: 'aturan', enough: false, headline: 'Data belum cukup untuk dianalisa.', health: 'perlu_perhatian',
      findings: [{ id: 'DATA', severity: 'info', title: 'Data masih sedikit', detail: 'Catat atau impor lebih banyak transaksi (minimal 8 dalam 3 bulan terakhir), lalu analisa akan lebih bermakna.' }],
      steps: [{ id: 'DATA', horizon: 'minggu_ini', title: 'Isi data dulu', how: 'Catat transaksi harian atau impor mutasi bank dan e-wallet beberapa bulan terakhir lewat Transaksi > Impor mutasi.', why: '' }], watch: [], missing_data: [] };
  }
  let critical = false;

  if (has('income') && v('net') < 0) {
    critical = true;
    f('NEG_NET', 'warn', 'Pengeluaran melebihi pemasukan', 'Bulan ini pengeluaran {{expense}} lebih besar dari pemasukan {{income}}, selisihnya {{net_abs}}.');
    s('NEG_NET', 'minggu_ini', 'Tutup selisih lebih dulu', has('cat0_name') ? 'Tinjau kategori terbesar ({{cat0_name}}, {{cat0_amount}}) dan tunda pengeluaran yang belum mendesak sampai arus kas kembali positif.' : 'Tunda pengeluaran yang belum mendesak sampai arus kas kembali positif.');
  } else if (has('savings_rate') && v('savings_rate') < 0.1) {
    f('LOW_SAVE', 'warn', 'Sisa uang bulan ini tipis', 'Hanya {{savings_rate}} dari pemasukan yang tersisa ({{net}}).');
    if (has('save_10')) s('LOW_SAVE', '30_hari', 'Sisihkan di awal bulan', 'Begitu pemasukan masuk, pindahkan {{save_10}} (pedoman umum 10% pemasukan) ke target tabungan. Mulai lebih kecil kalau terasa berat, yang penting rutin.', 'Menyisihkan di awal lebih berhasil daripada menabung dari sisa.');
  } else if (has('savings_rate') && v('savings_rate') >= 0.2) {
    f('GOOD_SAVE', 'good', 'Sisa uang bulan ini sehat', '{{savings_rate}} dari pemasukan tersisa ({{net}}).');
  }

  if (has('expense_change') && v('expense_change') >= 0.15) f('EXP_UP', 'warn', 'Pengeluaran naik dari bulan lalu', 'Pengeluaran {{expense}} dibanding {{expense_prev}} bulan lalu ({{expense_change}}). Lihat kategori yang naik di bawah.');
  else if (has('expense_change') && v('expense_change') <= -0.15) f('EXP_DOWN', 'good', 'Pengeluaran turun dari bulan lalu', 'Pengeluaran {{expense}} dibanding {{expense_prev}} bulan lalu ({{expense_change}}).');

  if (has('cat0_share') && v('cat0_share') >= 0.4) {
    f('CAT_TOP', 'info', 'Satu kategori mendominasi', '{{cat0_name}} menyumbang {{cat0_share}} ({{cat0_amount}}) dari seluruh pengeluaran.');
    s('CAT_TOP', '30_hari', 'Pasang budget untuk {{cat0_name}}', 'Buka Rencana > Budget > Atur budget, lalu tetapkan batas untuk kategori ini berdasarkan rata-rata bulan-bulan sebelumnya.');
  }
  let spikes = 0;
  for (let i = 0; i < 5 && spikes < 2; i++) {
    if (has(`cat${i}_change`) && v(`cat${i}_change`) >= 0.3 && v(`cat${i}_share`) >= 0.05) {
      spikes++;
      f(`CAT_SPIKE${i}`, 'warn', `{{cat${i}_name}} naik tajam`, `{{cat${i}_amount}} bulan ini dibanding {{cat${i}_prev}} bulan lalu ({{cat${i}_change}}).`);
    }
  }

  if (has('over_count') && v('over_count') > 0) {
    f('OVER_BUDGET', 'warn', 'Ada kategori yang melewati budget', '{{over_count}} kategori melewati budget. Yang terbesar {{over0_name}}, lebih {{over0_amount}} dari batasnya.');
    s('OVER_BUDGET', 'minggu_ini', 'Tinjau kategori yang melewati budget', 'Putuskan untuk {{over0_name}}: kurangi pengeluarannya sisa bulan ini, atau naikkan budgetnya kalau batas lamamu memang tidak realistis.');
  } else if (has('budget_used') && v('budget_used') >= 0.9) {
    f('BUDGET_90', 'warn', 'Budget hampir habis', '{{budget_used}} budget sudah terpakai, tersisa {{budget_left}}.');
  } else if (!has('budget_total')) {
    f('NO_BUDGET', 'info', 'Belum ada budget bulan ini', 'Tanpa budget, sulit melihat kapan pengeluaran sudah terlalu besar.');
    s('NO_BUDGET', '30_hari', 'Atur budget kategori utama', 'Buka Rencana > Budget > Atur budget, lalu coba tombol "Isi dari rata-rata 3 bulan terakhir" sebagai angka awal.');
  }
  if (has('proj_gap') && v('proj_gap') > 0) {
    f('PROJ_OVER', 'warn', 'Proyeksi melewati budget', 'Dengan laju sekarang, pengeluaran akhir bulan sekitar {{proj_expense}}, melebihi budget {{budget_total}} sebesar {{proj_gap}}.');
    s('PROJ_OVER', 'minggu_ini', 'Kurangi laju pengeluaran', 'Cek proyeksi di Rencana > Budget tiap beberapa hari, dan tahan pengeluaran non-esensial supaya total akhir bulan kembali di bawah budget.');
  }

  if (has('runway')) {
    const r = v('runway');
    if (r < 1) { critical = true; f('RUNWAY_LOW', 'warn', 'Saldo hanya cukup kurang dari sebulan', 'Total saldo {{total_balance}} setara {{runway}} pengeluaran rata-rata ({{avg_expense}} per bulan).'); }
    else if (r < 3) f('RUNWAY_MID', 'warn', 'Dana cadangan masih di bawah 3 bulan', 'Total saldo {{total_balance}} setara {{runway}} pengeluaran rata-rata ({{avg_expense}} per bulan).');
    else if (r >= 6) f('RUNWAY_OK', 'good', 'Dana cadangan kuat', 'Total saldo {{total_balance}} setara {{runway}} pengeluaran rata-rata.');
    if (r < 3 && has('emergency_gap')) s('RUNWAY', '3_bulan', 'Bangun dana darurat bertahap', 'Pedoman umum: cadangan sekitar 3 bulan pengeluaran, yaitu {{emergency_target}}. Kekurangannya sekarang {{emergency_gap}}, jadi bagi ke beberapa bulan.', 'Dana darurat mencegah kamu berutang saat ada kebutuhan mendadak.');
  }

  if (has('weekend_ratio') && v('weekend_ratio') >= 0.3) {
    f('WEEKEND', 'info', 'Akhir pekan lebih boros', 'Rata-rata akhir pekan {{weekend_avg}} per hari, {{weekend_ratio}} di atas hari kerja ({{weekday_avg}}).');
    s('WEEKEND', '30_hari', 'Tentukan batas akhir pekan', 'Pilih batas pengeluaran per akhir pekan yang masuk akal, lalu pantau lewat Tren > Pola pengeluaran per hari dalam seminggu.');
  }

  if (has('goal_count') && v('goal_count') === 0) {
    f('NO_GOAL', 'info', 'Belum ada target tabungan', 'Target membuat menabung lebih konkret dan mudah dipantau.');
    s('NO_GOAL', '30_hari', 'Buat satu target kecil', 'Mulai dari dana darurat atau satu tujuan jangka pendek lewat Rencana > Target tabungan.');
  }
  for (let i = 0; i < 3; i++) {
    if (has(`goal${i}_need`) && v(`goal${i}_pace`) < v(`goal${i}_need`) * 0.8) {
      f(`GOAL${i}`, 'warn', 'Target {{goal' + i + '_name}} belum sesuai jalur', `Perlu menabung {{goal${i}_need}} per bulan, sedangkan laju 3 bulan terakhir {{goal${i}_pace}}.`);
      s(`GOAL${i}`, '30_hari', 'Atur setoran rutin untuk {{goal' + i + '_name}}', `Targetkan setoran sekitar {{goal${i}_need}} per bulan, atau geser tenggatnya lewat Ubah kalau terlalu ketat.`);
      break;
    }
  }
  if (has('goal_done_count') && v('goal_done_count') > 0) f('GOAL_DONE', 'good', 'Ada target tabungan yang tercapai', '{{goal_done_count}} target sudah tercapai. Pertimbangkan target berikutnya.');

  if (has('uncat_share') && v('uncat_share') >= 0.2) {
    f('UNCAT', 'info', 'Banyak pengeluaran belum berkategori', '{{uncat_share}} pengeluaran ({{uncat_amount}}) belum punya kategori, jadi analisa kurang tajam.');
    s('UNCAT', 'minggu_ini', 'Rapikan kategori', 'Buka Transaksi, saring jenis Pengeluaran, lalu beri kategori pada transaksi besar yang masih kosong.');
  }
  if (has('income_cv') && v('income_cv') >= 0.3) {
    f('INCOME_VAR', 'info', 'Pemasukan naik-turun antar bulan', 'Pemasukan bulanan cukup bervariasi (sebaran {{income_cv}}), sehingga bulan baik sebaiknya tidak langsung dihabiskan.');
    s('INCOME_VAR', '3_bulan', 'Siapkan bantalan', 'Susun budget berdasarkan pemasukan terendah yang wajar, dan simpan kelebihan di bulan yang baik.');
  }

  if (F.length < 2) f('SUMMARY', 'info', 'Ringkasan bulan ini', 'Pemasukan {{income}}, pengeluaran {{expense}}, tersisa {{net}}.');
  F.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  S.sort((a, b) => HOR_ORDER[a.horizon] - HOR_ORDER[b.horizon]);
  if (S.length === 0) s('KEEP', '30_hari', 'Pertahankan kebiasaan baik', 'Lanjutkan mencatat dan cocokkan saldo dompet dengan saldo asli tiap minggu.');
  if (has('cat0_name')) W.push('Pantau pengeluaran {{cat0_name}}, kategori terbesarmu.');
  if (has('proj_expense')) W.push('Cek proyeksi akhir bulan tiap beberapa hari.');
  const warn = F.filter((x) => x.severity === 'warn').length;
  const health = critical ? 'waspada' : warn > 0 ? 'perlu_perhatian' : 'baik';
  const headline = critical ? 'Ada hal yang perlu segera dibereskan: ' + (has('net') && v('net') < 0 ? 'pengeluaran melebihi pemasukan ({{net_abs}}).' : 'dana cadanganmu tipis.')
    : warn > 0 ? 'Secara umum terkendali, tapi ada ' + warn + ' hal yang perlu diperhatikan.' : 'Kondisi bulan ini baik: tersisa {{net}} dari pemasukan.';
  return { source: 'aturan', enough: true, headline, health, findings: F.slice(0, 6), steps: S.slice(0, 5), watch: W.slice(0, 3), missing_data: [] };
}
