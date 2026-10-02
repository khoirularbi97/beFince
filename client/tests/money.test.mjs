import { fmtDigits, cleanDigits, pastedDigits, caretAfterDigits } from '../src/money.js';
let pass = 0, fail = 0;
const eq = (a, b, m) => { const ok = JSON.stringify(a) === JSON.stringify(b); console.log((ok ? 'PASS ' : 'FAIL ') + m + (ok ? '' : `\n   dapat: ${JSON.stringify(a)}\n   harusnya: ${JSON.stringify(b)}`)); ok ? pass++ : fail++; };
eq([fmtDigits('0'), fmtDigits('999'), fmtDigits('1000'), fmtDigits('1500000'), fmtDigits(85000), fmtDigits(''), fmtDigits(null), fmtDigits('1234567890123')], ['0', '999', '1.000', '1.500.000', '85.000', '', '', '1.234.567.890.123'], 'fmtDigits: pemisah ribuan titik, angka atau teks, kosong');
eq([cleanDigits('1.500.000'), cleanDigits('Rp 25.000'), cleanDigits('007'), cleanDigits('0'), cleanDigits('abc'), cleanDigits('12345678901234567')], ['1500000', '25000', '7', '0', '', '1234567890123'], 'cleanDigits: hanya angka, tanpa nol di depan, maksimal 13 angka');
eq([pastedDigits('Rp 1.500.000,00'), pastedDigits('1,500,000.00'), pastedDigits('Rp25.000'), pastedDigits('150.000'), pastedDigits('halo'), pastedDigits('0')], ['1500000', '1500000', '25000', '150000', null, null], 'pastedDigits: salinan dari m-banking/spreadsheet dibaca benar, bukan nominal → null');
eq([caretAfterDigits('159.500.000', 3), caretAfterDigits('159.500.000', 4), caretAfterDigits('1.500', 1), caretAfterDigits('1.500', 0), caretAfterDigits('1.500', 99)], [3, 5, 1, 0, 5], 'caretAfterDigits: kursor mengikuti jumlah angka di depannya');
console.log(`\n${pass} lolos, ${fail} gagal`);process.exit(fail ? 1 : 0);
