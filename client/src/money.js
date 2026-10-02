import { parseAmount } from './importer.js';

export const MAX_DIGITS = 13; // cukup sampai ribuan triliun, dan aman untuk BIGINT di database

// "1500000" -> "1.500.000"
export const fmtDigits = (d) => String(d ?? '').replace(/\D/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Ambil angkanya saja dari isian: "Rp 1.500.000" -> "1500000", tanpa nol di depan
export const cleanDigits = (s) => String(s ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_DIGITS);

// Hasil tempel dari m-banking atau spreadsheet: "Rp 1.500.000,00" atau "1,500,000.00" -> "1500000". null kalau bukan nominal
export function pastedDigits(text) {
  const a = parseAmount(text);
  return a && a.value > 0 ? cleanDigits(String(a.value)) : null;
}

// Posisi kursor di teks berformat setelah `n` angka
export function caretAfterDigits(formatted, n) {
  let seen = 0, i = 0;
  for (; i < formatted.length && seen < n; i++) if (/\d/.test(formatted[i])) seen++;
  return i;
}
