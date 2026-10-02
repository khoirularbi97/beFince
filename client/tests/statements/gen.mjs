// Membuat PDF contoh yang meniru susunan kolom e-statement dari berbagai bank (data buatan, nama dan nomor rekening disamarkan).
// Dipakai untuk menguji pembaca PDF tanpa berkas asli. Jalankan: node tests/statements/gen.mjs
import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), 'pdf');
fs.mkdirSync(OUT, { recursive: true });

function doc(file, size = [595, 842]) {
  const d = new PDFDocument({ size, margin: 0, autoFirstPage: true });
  d.pipe(fs.createWriteStream(path.join(OUT, file)));
  return d;
}
// Teks pada koordinat tertentu. align: left | right (x = tepi kanan) | center (x = tengah)
function T(d, s, x, y, { size = 8, align = 'left', bold = false } = {}) {
  d.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
  const w = d.widthOfString(String(s));
  const x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  d.text(String(s), x0, y, { lineBreak: false });
}
// Kata per kata sebagai potongan teks terpisah (meniru PDF yang memecah teks)
function W(d, s, x, y, size = 8) {
  d.font('Helvetica').fontSize(size);
  let cx = x;
  for (const w of String(s).split(' ')) { d.text(w, cx, y, { lineBreak: false }); cx += d.widthOfString(w + ' '); }
}
const expected = {};

/* ============ 1) PermataBank: Tgl Trx | Tgl Valuta | Uraian | Debet | Kredit | Saldo, tanggal dd/mm tanpa tahun ============ */
for (const [file, rev] of [['permata.pdf', false], ['permata_terbalik.pdf', true]]) {
  const d = doc(file);
  T(d, 'PermataBank', 40, 40, { size: 20, bold: true });
  T(d, 'Periode Laporan', 330, 120); T(d, ': 01 MEI 2021 - 31 MEI 2021', 400, 120);
  T(d, 'Statement Period', 330, 129, { size: 6 });
  T(d, 'Tanggal Laporan', 330, 150); T(d, ': 1 JUNI 2021', 400, 150);
  T(d, 'No. Rekening', 30, 200); T(d, ': 0000000000', 100, 200);
  const hy = 300;
  [['Tgl Trx.', 30], ['Tgl Valuta', 72], ['Uraian Trx.', 175]].forEach(([s, x]) => T(d, s, x, hy, { bold: true }));
  [['Debet', 315], ['Kredit', 382], ['Saldo', 452]].forEach(([s, x]) => T(d, s, x, hy, { bold: true, align: 'center' }));
  [['Trx. Date', 30], ['Val. Date', 72], ['Trx. Description', 175]].forEach(([s, x]) => T(d, s, x, hy + 9, { size: 6 }));
  [['Debit', 315], ['Credit', 382], ['Balance', 452]].forEach(([s, x]) => T(d, s, x, hy + 9, { size: 6, align: 'center' }));
  T(d, '(dd/mm)', 30, hy + 17, { size: 6 }); T(d, '(dd/mm)', 72, hy + 17, { size: 6 });
  if (!rev) { T(d, 'SALDO AWAL', 115, 335); T(d, '58.485,00', 480, 335, { align: 'right' }); }
  const rows = [
    ['01/05', ['PB Dari PT SINAR DIGITAL TER Ke', 'NASABAH PERMATA GATEWAY 02:05:05', 'withdraw 9945005qOIX', '20210501020507CCY'], null, '994.500,00', '1.052.985,00'],
    ['01/05', ['BIAYA ADM. PAY GO-PAY CUSTOMER', '8980 PERMATAMOBILE', '02:19:13'], '1.000,00', null, '1.051.985,00'],
    ['01/05', ['PAY GO-PAY CUSTOMER', '8980XXXXXXX1288 PERMATAMOBILE', '02:19:13'], '340.000,00', null, '711.985,00'],
    ['02/05', ['QR PAYMENT 19:20:46 SUAR COFFEE', 'PEK ANBARU'], '25.000,00', null, '686.985,00'],
    ['03/05', ['BIAYA ADM. PAY GO-PAY CUSTOMER', '8980 PERMATAMOBILE', '05:03:43'], '1.000,00', null, '685.985,00'],
    ['03/05', ['PAY GO-PAY CUSTOMER', '8980XXXXXXX1288 PERMATAMOBILE', '05:03:43'], '50.000,00', null, '635.985,00'],
    ['03/05', ['BIAYA ADM. PAY GO-PAY CUSTOMER', '8980 PERMATAMOBILE', '19:22:44'], '1.000,00', null, '634.985,00'],
    ['03/05', ['PAY GO-PAY CUSTOMER', '8980XXXXXXX1288 PERMATAMOBILE', '19:22:44'], '34.000,00', null, '600.985,00'],
    ['07/05', ['TRF DARI NASABAH ATMALTO (BANK', 'PERMATA TBK) 14:58:58'], null, '500.000,00', '1.100.985,00'],
    ['07/05', ['TRF KE NASABAH 83481682481 BANK', 'NEGARA INDONESIA/PERMATAMOBILE', '15:01:56'], '1.010.000,00', null, '90.985,00'],
    ['10/05', ['PB Dari UPBITFINANCE18 Ke NASABAH', 'PERMATA GATEWAY 15:10:28 0 OY', '1888616591000968245O'], null, '1.413.975,00', '1.504.960,00'],
    ['10/05', ['Biaya Fall Below Fee MEI 2021'], '5.000,00', null, '1.499.960,00'],
    ['11/05', ["PB cb PermataME 10% 20% Apr '21"], null, '25.000,00', '1.524.960,00'],
    ['12/05', ['PB Dari PT SINAR DIGITAL TER Ke', 'NASABAH PERMATA GATEWAY', '13:06:49 payout 66JC8', '20210512130847CqqC'], null, '365.000,00', '1.889.960,00'],
    ['12/05', ['TRF DARI NASABAH ATMALTO (BANK', 'PERMATA TBK) 20:22:13'], null, '1.307.000,00', '3.196.960,00'],
  ];
  let y = 352;
  const key = file.replace('.pdf', '');
  expected[key] = [];
  for (const [dt, lines, deb, cre, bal] of (rev ? [...rows].reverse() : rows)) {
    T(d, dt, 30, y); T(d, dt, 72, y);
    lines.forEach((l, i) => W(d, l, 115, y + i * 9));
    if (deb) T(d, deb, 340, y, { align: 'right' });
    if (cre) T(d, cre, 410, y, { align: 'right' });
    T(d, bal, 480, y, { align: 'right' });
    expected[key].push([`2021-${dt.slice(3)}-${dt.slice(0, 2)}`, cre ? 'income' : 'expense', Number((cre || deb).replace(/\./g, '').replace(',00', ''))]);
    y += Math.max(26, lines.length * 9 + 8);
  }
  d.end();
}

/* ============ 2) Mandiri (e-Statement): No | Tanggal (tanggal + jam) | Keterangan | Nominal bertanda +/- | Saldo; 2 halaman ============ */
{
  const d = doc('mandiri.pdf');
  const rows = [
    ['02 Sep 2026', '20:31:33', ['Penarikan tunai di ATM', 'BANK MANDIRI BKS IM CIANTRA 01'], -300000, '9.213.701,80'],
    ['02 Sep 2026', '22:24:34', ['Biaya transfer BI Fast'], -2500, '9.211.201,80'],
    ['02 Sep 2026', '22:24:34', ['Transfer BI Fast', 'Ke BTN', 'NASABAH SAMPLE 0000000000'], -4000000, '5.211.201,80'],
    ['02 Sep 2026', '22:25:09', ['Pembayaran kartu kredit', '0000000000000000'], -69110, '5.142.091,80'],
    ['03 Sep 2026', '02:12:40', ['Biaya transfer BI Fast'], -2500, '5.139.591,80'],
    ['03 Sep 2026', '02:12:40', ['Transfer BI Fast', 'Ke SEABANK INDONESIA', 'NASABAH SAMPLE 0000000000'], -3000000, '2.139.591,80'],
    ['03 Sep 2026', '05:52:32', ['Biaya administrasi kartu debit'], -9000, '2.130.591,80'],
    ['07 Sep 2026', '19:57:59', ['Transfer BI Fast', 'Dari SEABANK INDONESIA', 'NASABAH SAMPLE 0000000000'], 300000, '2.430.591,80'],
    ['07 Sep 2026', '19:58:37', ['Penarikan tunai di ATM', 'BANK MANDIRI BKS GD ATMRUKOCIANTRA 01'], -300000, '2.130.591,80'],
    ['08 Sep 2026', '02:05:19', ['Transfer ke BANK MANDIRI', 'NASABAH LAIN 0000000000'], -2000000, '130.591,80'],
    ['10 Sep 2026', '21:03:37', ['Biaya saldo tidak cukup'], -3000, '127.591,80'],
    ['10 Sep 2026', '21:03:43', ['Transfer BI Fast', 'Dari SEABANK INDONESIA', 'NASABAH SAMPLE 0000000000'], 200000, '327.591,80'],
    ['10 Sep 2026', '21:04:11', ['Biaya penarikan tunai di ATM Link', '1011114'], -7500, '320.091,80'],
    ['10 Sep 2026', '21:04:11', ['Penarikan tunai di ATM Link', '1011114'], -300000, '20.091,80'],
    ['16 Sep 2026', '19:11:10', ['Transfer BI Fast', 'Dari SEABANK INDONESIA', 'NASABAH SAMPLE 0000000000'], 200000, '220.091,80'],
    ['16 Sep 2026', '19:11:47', ['Penarikan tunai di ATM', 'BANK MANDIRI BKS IM CIANTRA 01'], -200000, '20.091,80'],
    ['20 Sep 2026', '15:37:15', ['Transfer BI Fast', 'Dari SEABANK INDONESIA', 'NASABAH SAMPLE 0000000000'], 200000, '220.091,80'],
    ['20 Sep 2026', '15:38:17', ['Biaya penarikan tunai di ATM Link', '1010989'], -7500, '212.591,80'],
    ['20 Sep 2026', '15:38:17', ['Penarikan tunai di ATM Link', '1010989'], -200000, '12.591,80'],
  ];
  const fmt = (n) => (n < 0 ? '-' : '+') + Math.abs(n).toLocaleString('id-ID') + ',00';
  const header = (page2) => {
    d.rect(0, 0, 595, 70).fill('#0a4fb3'); d.fillColor('black');
    T(d, 'e-Statement', 30, 25, { size: 14, bold: true }); d.fillColor('black');
    T(d, 'Nama/Name', 30, 90); T(d, 'NASABAH SAMPLE', 110, 90);
    T(d, 'Periode/Period', 330, 90); T(d, ': 01 Sep 2026 - 30 Sep 2026', 400, 90);
    T(d, page2 ? '2 dari 4' : '1 dari 4', 560, 90, { align: 'right', bold: true });
    T(d, 'Cabang/Branch', 30, 105); T(d, ': KC Jakarta Sample', 110, 105);
    T(d, 'Dicetak pada/Issued on', 330, 105); T(d, ': 01 Oct 2026', 440, 105);
    const hy = 145;
    T(d, 'No', 30, hy, { bold: true }); T(d, 'Tanggal', 62, hy, { bold: true }); T(d, 'Keterangan', 160, hy, { bold: true });
    T(d, 'Nominal (IDR)', 470, hy, { bold: true, align: 'right' }); T(d, 'Saldo (IDR)', 555, hy, { bold: true, align: 'right' });
    T(d, 'No', 30, hy + 9, { size: 6 }); T(d, 'Date', 62, hy + 9, { size: 6 }); T(d, 'Remarks', 160, hy + 9, { size: 6 });
    T(d, 'Amount (IDR)', 470, hy + 9, { size: 6, align: 'right' }); T(d, 'Balance (IDR)', 555, hy + 9, { size: 6, align: 'right' });
  };
  const footer = () => {
    T(d, 'PT Bank Mandiri (Persero) Tbk. berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) dan Bank Indonesia (BI),', 30, 775, { size: 6 });
    T(d, 'serta merupakan peserta penjamin Lembaga Penjamin Simpanan (LPS)', 30, 783, { size: 6 }); T(d, 'Mandiri Call 14000', 560, 775, { size: 6, align: 'right' });
  };
  header(false);
  expected.mandiri = [];
  let y = 185;
  rows.forEach(([dt, tm, lines, amt, bal], i) => {
    if (i === 10) { footer(); d.addPage(); header(true); y = 185; }
    T(d, String(i + 1), 30, y); T(d, dt, 62, y); T(d, tm + ' WIB', 62, y + 9);
    lines.forEach((l, k) => W(d, l, 160, y + k * 9));
    T(d, fmt(amt), 470, y, { align: 'right' }); T(d, bal, 555, y, { align: 'right' });
    const [dd, mm, yy] = dt.split(' ');
    expected.mandiri.push([`${yy}-09-${dd}`, amt < 0 ? 'expense' : 'income', Math.abs(amt)]);
    y += 40;
  });
  footer();
  d.end();
}

/* ============ 3) SeaBank: TANGGAL (kadang hanya bulan) | TRANSAKSI + sub-label | KELUAR | MASUK, tanpa kolom saldo ============ */
{
  const d = doc('seabank.pdf');
  T(d, 'SEABANK INDONESIA', 40, 60, { size: 12, bold: true });
  T(d, 'RINGKASAN REKENING', 297, 130, { size: 10, bold: true, align: 'center' });
  T(d, '01 APR 2022 to 30 APR 2022', 297, 143, { size: 8, align: 'center' });
  ['REKENING', 'SALDO AWAL (IDR)', 'TRANSAKSI KELUAR (IDR)', 'TRANSAKSI MASUK (IDR)', 'SALDO AKHIR (IDR)'].forEach((s, i) => T(d, s, 50 + i * 100, 170, { size: 6 }));
  ['TABUNGAN', '102.000.010.281.928', '100.000.000.234.000', '101.090.011.338.000', '1.401.910.029.000'].forEach((s, i) => T(d, s, 50 + i * 100, 190, { size: 6 }));
  T(d, 'TABUNGAN - RINCIAN TRANSAKSI', 297, 240, { size: 10, bold: true, align: 'center' });
  const hy = 270;
  T(d, 'TANGGAL', 50, hy, { size: 6 }); T(d, 'TRANSAKSI', 130, hy, { size: 6 });
  T(d, 'KELUAR (IDR)', 380, hy, { size: 6, align: 'right' }); T(d, 'MASUK (IDR)', 520, hy, { size: 6, align: 'right' });
  const rows = [
    ['APR', 'Bunga Tabungan', 'Bunga', null, '12.234.000'],
    ['APR', 'Pajak Bunga Tabungan', 'Pajak', '2.446.800', null],
    ['06 APR', 'Lorem Ipsum', 'Transfer', null, '234.000'],
    ['06 APR', 'Contoh Nama', 'Transfer', null, '234.000'],
    ['12 APR', 'Lorem Ipsum', 'Transfer', '234.000', null],
    ['12 APR', 'Shopee', 'Pembayaran', '234.000.000', null],
    ['14 APR', 'Shopee', 'Pembayaran', null, '234.000.000'],
    ['15 APR', 'ShopeePay', 'Pembayaran', null, '234.000'],
    ['20 APR', 'SeaBank', 'Adjustment', null, '234.000'],
  ];
  let y = 295;
  expected.seabank = [];
  for (const [dt, t, sub, out, inn] of rows) {
    T(d, dt, 50, y, { size: 7 }); T(d, t, 130, y, { size: 7 }); T(d, sub, 130, y + 9, { size: 5 });
    if (out) T(d, out, 380, y, { size: 7, align: 'right' });
    if (inn) T(d, inn, 520, y, { size: 7, align: 'right' });
    const day = dt.length > 3 ? dt.slice(0, 2) : '30';
    expected.seabank.push([`2022-04-${day}`, inn ? 'income' : 'expense', Number((inn || out).replace(/\./g, ''))]);
    y += 26;
  }
  d.end();
}

/* ============ 4) BNI (templat berbahasa Inggris, tanggal masih mm/dd/yyyy): Credit di kiri Debit ============ */
const bniRows = [
  ['0302432', 'Account Interest', null, '19.95', '10,875.97'],
  ['0302433', 'Branch Deposit', '20,000.00', null, '30,875.97'],
  ['0302434', 'Branch Deposit', null, '600.00', '30,275.97'],
  ['0302435', 'Branch Deposit', null, '630.00', '29,645.97'],
  ['0302436', 'Branch Cheque - MC Kean & Park', '1,430.00', null, '31,075.97'],
  ['0302437', 'Cost of Bank Cheque', '100.00', null, '31,175.97'],
  ['0302438', 'Branch Deposit', '500.00', null, '31,675.97'],
  ['0302439', 'FED Bank Account Debits Tax', '1.05', null, '31,677.02'],
  ['0302440', 'VIC FID Charge', '1.67', null, '31,678.69'],
];
for (const [file, dates] of [['bni_template.pdf', null], ['bni_varian.pdf', ['03/10/2021', '04/10/2021', '04/10/2021', '05/10/2021', '06/10/2021', '06/10/2021', '07/10/2021', '08/10/2021', '09/10/2021']]]) {
  const d = doc(file);
  T(d, 'BNI', 60, 80, { size: 24, bold: true }); T(d, 'Statement of Account', 740 / 1.33, 100, { size: 14, align: 'right' });
  T(d, 'PERIOD', 460, 150, { size: 6 }); T(d, 'mm/dd/yyyy', 470, 165);
  const hy = 345 / 1.33;
  T(d, 'Date', 80 / 1.33, hy, { bold: true }); T(d, 'Reference', 165 / 1.33, hy, { bold: true }); T(d, 'Transaction Description', 290 / 1.33, hy, { bold: true });
  T(d, 'Credit', 560 / 1.33, hy, { bold: true, align: 'right' }); T(d, 'Debit', 640 / 1.33, hy, { bold: true, align: 'right' }); T(d, 'Balance', 722 / 1.33, hy, { bold: true, align: 'right' });
  let y = 372 / 1.33;
  bniRows.forEach(([ref, desc, cr, db, bal], i) => {
    T(d, dates ? dates[i] : 'mm/dd/yyyy', 52 / 1.33, y, { size: 7 }); T(d, ref, 145 / 1.33, y, { size: 7 }); T(d, desc, 210 / 1.33, y, { size: 7 });
    if (cr) T(d, cr, 576 / 1.33, y, { size: 7, align: 'right' }); if (db) T(d, db, 650 / 1.33, y, { size: 7, align: 'right' });
    T(d, bal, 730 / 1.33, y, { size: 7, align: 'right' });
    y += 16;
  });
  T(d, 'Total', 400 / 1.33, 918 / 1.33, { bold: true }); T(d, '22,032.72', 576 / 1.33, 918 / 1.33, { align: 'right', bold: true }); T(d, '1,249.95', 650 / 1.33, 918 / 1.33, { align: 'right', bold: true });
  d.end();
  if (dates) expected.bni_varian = bniRows.map(([, , cr, db], i) => [`2021-10-${dates[i].slice(0, 2)}`, cr ? 'income' : 'expense', Math.round(Number((cr || db).replace(/,/g, '')))]).filter((x) => x[2] > 0);
}

/* ============ 5) BRI (templat berbahasa Inggris): Date dd/mm/yyyy hh:mm | Description | Debits | Credits, nominal desimal titik ============ */
{
  const d = doc('bri_template.pdf', [595, 842]);
  T(d, 'BANK BRI', 40, 50, { size: 20, bold: true });
  T(d, 'Statement Period:', 560, 130, { align: 'right', bold: true }); T(d, 'Dec 16, 2020 to Jan 03, 2021', 560, 142, { align: 'right' });
  const hy = 250;
  T(d, 'Date', 80, hy, { bold: true, align: 'center' }); T(d, 'Description', 250, hy, { bold: true, align: 'center' });
  T(d, 'Debits (Rp)', 410, hy, { bold: true, align: 'center' }); T(d, 'Credits (Rp)', 500, hy, { bold: true, align: 'center' });
  const rows = [
    ['19/12/2021 6:24', 'DDA Credit-VERIFYBANK PAYPAL PAYPAL', null, '0.07'],
    ['19/12/2021 6:27', 'DDA Credit-VERIFYBANK PAYPAL PAYPAL', '0.08', null],
    ['20/12/2021 14:49', 'Original Credit PAYPAL* John Citizen', null, '28.00'],
    ['21/12/2021 0:47', 'New Gift Card Purchase Order - Reversal', null, '2.00'],
    ['21/12/2021 0:47', 'New Gift Card Purchase Order - Fee Reversal', null, '0.25'],
    ['21/12/2021 0:47', 'Fee - New Gift Card Purchase Order', '0.25', null],
    ['21/12/2021 0:47', 'New Gift Card Purchase Order', '3.00', null],
    ['21/12/2021 0:48', 'New Gift Card Purchase Order - Reversal', null, '2.00'],
  ];
  let y = 275;
  expected.bri_template = [];
  for (const [dt, desc, deb, cre] of rows) {
    T(d, dt, 40, y, { size: 7 }); T(d, desc, 130, y, { size: 7 });
    if (deb) T(d, deb, 430, y, { size: 7, align: 'right' }); if (cre) T(d, cre, 520, y, { size: 7, align: 'right' });
    const v = Math.round(Number(deb || cre));
    if (v > 0) expected.bri_template.push([`2021-12-${dt.slice(0, 2)}`, cre ? 'income' : 'expense', v]);
    y += 18;
  }
  T(d, 'Total', 40, y, { bold: true }); T(d, '3.33', 430, y, { align: 'right', bold: true }); T(d, '32.00', 520, y, { align: 'right', bold: true });
  d.end();
}

/* ============ 6) BCA Tahapan Xpresi: TANGGAL dd/mm | KETERANGAN | CBG | MUTASI (suffix DB; kredit tanpa suffix) | SALDO ============ */
{
  const d = doc('bca.pdf', [720, 1010]);
  T(d, 'Bersambung ke Halaman berikut', 700, 70, { size: 8, align: 'right' });
  T(d, 'REKENING TAHAPAN XPRESI', 360, 105, { size: 18, bold: true, align: 'center' });
  T(d, 'NO. REKENING', 400, 160, { size: 8, bold: true }); T(d, ': 0000000000', 495, 160, { size: 8 });
  T(d, 'HALAMAN', 400, 178, { size: 8, bold: true }); T(d, ': 2/2', 495, 178, { size: 8 });
  T(d, 'PERIODE', 400, 196, { size: 8, bold: true }); T(d, ': MEI 2022', 495, 196, { size: 8 });
  T(d, 'MATA UANG', 400, 214, { size: 8, bold: true }); T(d, ': IDR', 495, 214, { size: 8 });
  const hy = 342;
  T(d, 'TANGGAL', 66, hy, { bold: true, align: 'center' }); T(d, 'KETERANGAN', 245, hy, { bold: true, align: 'center' });
  T(d, 'CBG', 387, hy, { bold: true, align: 'center' }); T(d, 'MUTASI', 487, hy, { bold: true, align: 'center' }); T(d, 'SALDO', 640, hy, { bold: true, align: 'center' });
  const s = 8;
  // baris 1
  T(d, '22/05', 50, 366, { size: s }); T(d, 'TRSF E-BANKING CR', 106, 366, { size: s }); T(d, '2205/FTSCY/WS99073', 235, 366, { size: s });
  T(d, '5,000,000.00', 570, 366, { size: s, align: 'right' }); T(d, '10,707,000.00', 697, 366, { size: s, align: 'right' }); T(d, '5000000.00', 330, 378, { size: s });
  // baris 2 (tanpa tanggal, masih blok 22/05)
  T(d, 'TRSF E-BANKING CR', 106, 396, { size: s }); T(d, '1,750,000.00', 570, 396, { size: s, align: 'right' });
  T(d, '2205/FTSCY/WS95051', 235, 408, { size: s }); T(d, '1750000.00', 330, 419, { size: s }); T(d, '12,457,000.00', 697, 428, { size: s, align: 'right' });
  // dua penarikan ATM
  T(d, '22/05', 50, 442, { size: s });
  T(d, '22/05', 50, 455, { size: s }); T(d, 'TARIKAN ATM 22/05', 106, 455, { size: s }); T(d, '2,000,000.00 DB', 570, 455, { size: s, align: 'right' });
  T(d, 'TARIKAN ATM 22/05', 106, 468, { size: s }); T(d, '2,000,000.00 DB', 570, 468, { size: s, align: 'right' });
  // transfer keluar: nominal sedikit di atas keterangan
  T(d, '25/05', 50, 490, { size: s }); T(d, '250,000.00 DB', 570, 496, { size: s, align: 'right' });
  T(d, 'TRSF E-BANKING DB', 106, 503, { size: s }); T(d, '2505/FTFVA/WSZ94V9', 235, 520, { size: s });
  T(d, '27/05', 50, 543, { size: s }); T(d, '500,000.00', 570, 558, { size: s, align: 'right' }); T(d, 'TRSF E-BANKING CR', 106, 566, { size: s });
  T(d, '2705/FTSCY/WS95964', 235, 580, { size: s }); T(d, '500000.00', 330, 593, { size: s }); T(d, '9,207,000.00', 697, 610, { size: s, align: 'right' });
  // satu tanggal, tiga nominal
  T(d, '30/05', 50, 630, { size: s }); T(d, 'TARIKAN ATM 30/05', 106, 630, { size: s }); T(d, '2,000,000.00 DB', 570, 622, { size: s, align: 'right' });
  T(d, '5,000.00 DB', 570, 637, { size: s, align: 'right' }); T(d, '15,000.00 DB', 570, 652, { size: s, align: 'right' });
  // ringkasan akhir (harus diabaikan)
  T(d, 'SALDO AWAL :', 218, 690, { size: 9 }); T(d, '1,779,000.00', 462, 686, { size: 9, align: 'right' });
  T(d, 'MUTASI CR', 218, 704, { size: 9 }); T(d, ':', 292, 704, { size: 9 }); T(d, '4,077,500.00', 462, 700, { size: 9, align: 'right' });
  T(d, 'MUTASI DB', 218, 718, { size: 9 }); T(d, ':', 305, 718, { size: 9 }); T(d, '4,077,500.00', 462, 714, { size: 9, align: 'right' });
  T(d, 'SALDO AKHIR :', 218, 732, { size: 9 }); T(d, '7,187,000.00', 462, 728, { size: 9, align: 'right' });
  d.end();
  expected.bca = [
    ['2022-05-22', 'income', 5000000], ['2022-05-22', 'income', 1750000], ['2022-05-22', 'expense', 2000000], ['2022-05-22', 'expense', 2000000],
    ['2022-05-25', 'expense', 250000], ['2022-05-27', 'income', 500000], ['2022-05-30', 'expense', 2000000], ['2022-05-30', 'expense', 5000], ['2022-05-30', 'expense', 15000],
  ];
}
expected.bni_template = [];
fs.writeFileSync(path.join(OUT, 'expected.json'), JSON.stringify(expected, null, 1));
console.log('PDF contoh dibuat di', OUT, Object.keys(expected).join(', '));
