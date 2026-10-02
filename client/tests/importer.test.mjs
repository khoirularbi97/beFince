import * as I from '../src/importer.js';
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log((ok ? 'PASS ' : 'FAIL ') + m + (ok ? '' : `\n   dapat:   ${JSON.stringify(a)}\n   harusnya: ${JSON.stringify(b)}`)); ok ? pass++ : fail++; };
const T = '2026-09-30';
// --- angka
const A = (s) => I.parseAmount(s)?.value;
eq([A('1.500.000'), A('1,500,000.00'), A('1.500.000,00'), A('Rp 25.000'), A('25.000'), A('150.50'), A('1500000'), A('0,50')], [1500000, 1500000, 1500000, 25000, 25000, 151, 1500000, 1], 'parseAmount: format Indonesia/Inggris/Rp/ribuan');
eq([I.parseAmount('-25.000').neg, I.parseAmount('(25.000)').neg, I.parseAmount('1,500,000.00 DB').tag, I.parseAmount('250.000,00 CR').tag, I.parseAmount('abc')], [true, true, 'DB', 'CR', null], 'parseAmount: negatif, DB/CR, bukan angka');
// --- tanggal
const D = (s) => I.parseDate(s, T);
eq([D('2026-09-01'), D('01/09/2026'), D('01-09-26'), D('1 Sep 2026'), D('01 Agustus 2026'), D('15/09'), D('31/12'), D('30/02/2026'), D('01/09/2026 14:30:05')], ['2026-09-01', '2026-09-01', '2026-09-01', '2026-09-01', '2026-08-01', '2026-09-15', '2025-12-31', null, '2026-09-01'], 'parseDate: banyak format, tanpa tahun, tanggal tidak valid');

// --- 1) CSV Indonesia: Tanggal;Keterangan;Debet;Kredit;Saldo, desimal koma
const s1 = `Rekening: 1234567890\nPeriode: 01/09/2026 - 30/09/2026\n\nTanggal;Keterangan;Debet;Kredit;Saldo\n01/09/2026;GAJI PT MAJU JAYA;0,00;7.500.000,00;8.000.000,00\n02/09/2026;KFC SUDIRMAN;85.000,00;0,00;7.915.000,00\n03/09/2026;TOPUP GOPAY;500.000,00;0,00;7.415.000,00\n04/09/2026;PLN TOKEN 1234;200.000,00;0,00;7.215.000,00\nSaldo Akhir;;;;7.215.000,00`;
let r = I.readTable(s1, T);
eq([r.ok, r.guessed, r.items.length, r.skipped], [true, false, 4, 1], '1) CSV titik-koma bergaya Indonesia: judul terdeteksi, 4 transaksi');
eq(r.items.map((x) => [x.type, x.amount, x.category, x.hint]), [['income', 7500000, 'Gaji', null], ['expense', 85000, 'Makan', null], ['expense', 500000, null, 'transfer'], ['expense', 200000, 'Tagihan', null]], '1) arah, nominal, kategori otomatis, petunjuk transfer (TOPUP GOPAY)');

// --- 2) CSV Inggris: amount bertanda, ribuan koma desimal titik, dikutip
const s2 = `Date,Description,Amount,Balance\n2026-09-05,"GRAB* TRIP, JAKARTA","-45,000.00","7,000,000.00"\n2026-09-06,"TRANSFER FROM BUDI","1,250,000.00","8,250,000.00"\n2026-09-07,"INDOMARET 123","-23,500.00","8,226,500.00"`;
r = I.readTable(s2, T);
eq(r.items.map((x) => [x.date, x.type, x.amount, x.category]), [['2026-09-05', 'expense', 45000, 'Transport'], ['2026-09-06', 'income', 1250000, null], ['2026-09-07', 'expense', 23500, 'Belanja']], '2) CSV Inggris: tanda minus, koma di dalam kutipan, ribuan koma');

// --- 3) Jumlah dengan akhiran DB/CR (tanpa kolom debit/kredit terpisah)
const s3 = `Tanggal,Keterangan,Cabang,Jumlah\n01/09,TRSF E-BANKING,0000,"500,000.00 DB"\n02/09,BUNGA,0000,"1,250.00 CR"\n03/09,BYR VA SHOPEE,0000,"150,000.00 DB"`;
r = I.readTable(s3, T);
eq(r.items.map((x) => [x.date, x.type, x.amount]), [['2026-09-01', 'expense', 500000], ['2026-09-02', 'income', 1250], ['2026-09-03', 'expense', 150000]], '3) jumlah berakhiran DB/CR, tanggal tanpa tahun');

// --- 4) bergaya e-wallet: tanggal+waktu, jenis, status (gagal dilewati)
const s4 = `Tanggal,Waktu,Jenis Transaksi,Keterangan,Nominal,Status\n10 Sep 2026,08:15,Pembayaran,Kopi Kenangan,Rp 28.000,Berhasil\n10 Sep 2026,09:00,Top Up,Top Up dari BCA,Rp 200.000,Berhasil\n11 Sep 2026,10:00,Pembayaran,Tokopedia,Rp 150.000,Gagal\n12 Sep 2026,11:00,Terima Uang,Dari Andi,Rp 75.000,Berhasil`;
r = I.readTable(s4, T);
eq([r.items.length, r.skipped], [3, 1], '4) e-wallet: baris berstatus Gagal dilewati');
eq(r.items.map((x) => [x.type, x.amount, x.hint, x.uncertain]), [['expense', 28000, null, false], ['income', 200000, 'transfer', false], ['income', 75000, null, false]], '4) jenis Pembayaran/Top Up/Terima menentukan arah; Top Up diberi petunjuk transfer');

// --- 5) Debit/Kredit kolom dengan dua kolom keterangan dan tanggal berbulan (gaya "Description" ganda)
const s5 = `Account No,Date,Val Date,Transaction Code,Description,Description,Reference No,Debit,Credit\n123,"1 Sep 2026","1 Sep 2026",9999,TRANSFER,"KE ANDI",REF1,"150,000.00","0.00"\n123,"2 Sep 2026","2 Sep 2026",9999,SETORAN,"GAJI",REF2,"0.00","5,000,000.00"`;
r = I.readTable(s5, T);
eq(r.items.map((x) => [x.date, x.type, x.amount, x.note]), [['2026-09-01', 'expense', 150000, 'TRANSFER KE ANDI'], ['2026-09-02', 'income', 5000000, 'SETORAN GAJI']], '5) dua kolom deskripsi digabung; debit/kredit bergaya Inggris');

// --- 5b) petunjuk perpindahan antar dompet
const hint = (n) => I.parseText(`01/09/2026 ${n} 50.000,00 DB`, T).items[0]?.hint;
eq([hint('PAY GO-PAY CUSTOMER 8980 PERMATAMOBILE'), hint('BIAYA ADM. PAY GO-PAY CUSTOMER'), hint('TOPUP OVO'), hint('TRF KE DANA 0812'), hint('QR PAYMENT SUAR COFFEE'), hint('Biaya admin top up')], ['transfer', null, 'transfer', 'transfer', null, null], '5b) top up/bayar ke e-wallet = transfer antar dompet; biaya admin tetap pengeluaran');
// --- 6) tanpa judul kolom: ditebak dari isi
const s6 = `01/09/2026;WARUNG MAKAN;45.000,00;5.955.000,00\n02/09/2026;BAYAR LISTRIK;350.000,00;5.605.000,00`;
r = I.readTable(s6, T);
eq([r.guessed, r.items.length, r.items[0]?.amount, r.items[1]?.amount], [true, 2, 45000, 350000], '6) tanpa judul kolom: ditebak (kolom terakhir dianggap saldo)');

// --- 6b) pemetaan kolom manual (jalur "Atur kolom")
r = I.extractRows(I.parseDelimited('01-09-2026|Beli sesuatu|12.000\n02-09-2026|Gaji|8.500'), { date: 0, desc: [1], amount: 2 }, 0, T);
eq(r.items.map((x) => [x.date, x.type, x.amount, x.note]), [['2026-09-01', 'expense', 12000, 'Beli sesuatu'], ['2026-09-02', 'income', 8500, 'Gaji']], '6b) kolom dipilih manual: tanggal, keterangan, jumlah (arah dari kata kunci)');
// --- 7) tempel notifikasi
const n1 = `Pembayaran berhasil\nRp25.000 ke Kopi Kenangan\n10 Sep 2026 08:15\nSisa saldo Rp1.234.567\n\nKamu menerima Rp150.000 dari Budi\n12/09/2026\n\nTransfer ke DANA Rp500.000 berhasil`;
r = I.parseText(n1, T);
eq(r.items.map((x) => [x.date, x.type, x.amount, x.uncertain, x.hint]), [['2026-09-10', 'expense', 25000, false, null], ['2026-09-12', 'income', 150000, false, null], [T, 'expense', 500000, false, 'transfer']], '7) notifikasi: nominal bukan saldo, arah dari kata kunci, tanggal bila ada, hint transfer ke DANA');
// --- 8) salinan baris e-statement PDF
const p1 = `01/09/2026 TRSF E-BANKING DB 500.000,00 DB 4.500.000,00\n02/09/2026 GAJI SEPTEMBER 7.500.000,00 CR 12.000.000,00\n03/09/2026 INDOMARET 23.500,00 DB`;
r = I.parseText(p1, T);
eq(r.items.map((x) => [x.date, x.type, x.amount]), [['2026-09-01', 'expense', 500000], ['2026-09-02', 'income', 7500000], ['2026-09-03', 'expense', 23500]], '8) baris salinan e-statement: penanda DB/CR menentukan nominal dan arah');
// --- 9) masukan kosong / sampah
eq([I.readTable('', T).items.length, I.parseText('halo dunia tanpa angka', T).items.length, I.parseText('   ', T).skipped], [0, 0, 0], '9) masukan kosong atau tanpa nominal tidak menghasilkan transaksi');
console.log(`\n${pass} lolos, ${fail} gagal`);
process.exit(fail ? 1 : 0);
