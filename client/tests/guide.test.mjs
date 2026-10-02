// Menjaga panduan tetap sesuai aplikasi: setiap tulisan di layar yang disebut panduan (refs) harus masih ada di kode antarmuka.
import fs from 'node:fs';
import path from 'node:path';
import { GUIDE, plain } from '../src/guideContent.js';

const SRC = path.join(path.dirname(new URL(import.meta.url).pathname), '../src');
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(jsx?|css)$/.test(f.name) && f.name !== 'guideContent.js') files.push(p);
  }
})(SRC);
const code = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };

ok(new Set(GUIDE.map((s) => s.id)).size === GUIDE.length, `id bagian unik (${GUIDE.length} bagian)`);
const types = new Set(['p', 'steps', 'list', 'tip', 'warn', 'qa']);
const bad = GUIDE.flatMap((s) => s.blocks.filter((b) => !types.has(b.t) || (b.t === 'qa' ? !b.q || !b.a : !(Array.isArray(b.x) ? b.x.length && b.x.every(Boolean) : b.x))).map((b) => `${s.id}:${b.t}`));
ok(bad.length === 0, 'semua blok punya jenis dan isi yang valid' + (bad.length ? ': ' + bad.join(', ') : ''));
ok(GUIDE.every((s) => s.title && s.summary && s.icon && s.blocks.length), 'tiap bagian punya judul, ringkasan, ikon, dan isi');

const missing = [];
for (const s of GUIDE) for (const r of s.refs) if (!code.includes(r)) missing.push(`${s.id}: "${r}"`);
ok(missing.length === 0, `semua ${GUIDE.reduce((a, s) => a + s.refs.length, 0)} tulisan layar yang dirujuk panduan masih ada di aplikasi` + (missing.length ? '\n   hilang: ' + missing.join(' | ') : ''));

// kata tebal yang menyebut tombol/menu juga harus ada di aplikasi
const known = ['Catat transaksi', 'Simpan transaksi', 'Ubah', 'Hapus', 'Transfer', 'Pindahkan saldo', 'Atur budget', 'Simpan budget', 'Setor', 'Target baru', 'Riwayat', 'Baca data', 'Impor mutasi', 'Simpan', 'Unduh PDF', 'Unduh CSV', 'Keluar', 'Ganti kata sandi', 'Ganti nama', 'Kelola dompet dan kategori', 'Rencana', 'Ringkasan', 'Transaksi', 'Dompet', 'Budget', 'Target tabungan', 'Tren'];
const bolds = [...new Set(GUIDE.flatMap((s) => s.blocks.flatMap((b) => (b.t === 'qa' ? [b.a] : Array.isArray(b.x) ? b.x : [b.x]))).flatMap((t) => [...String(t).matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1])))];
const uiBolds = bolds.filter((t) => known.includes(t));
ok(uiBolds.every((t) => code.includes(t)), `${uiBolds.length} nama tombol/menu yang dicetak tebal ada di aplikasi`);

// pencarian
ok(GUIDE.filter((s) => plain(s).includes('duplikat')).map((s) => s.id).includes('impor'), 'pencarian "duplikat" menemukan bagian impor');
ok(GUIDE.filter((s) => plain(s).includes('zzzqqq')).length === 0, 'kata yang tidak ada tidak menghasilkan apa pun');
ok(!plain(GUIDE[0]).includes('**') && !plain(GUIDE[1]).includes('`'), 'teks pencarian tidak memuat penanda tebal atau kode');
// panjang wajar
const words = GUIDE.reduce((a, s) => a + plain(s).split(/\s+/).length, 0);
ok(words > 1200 && words < 6000, `panjang panduan wajar: ${words} kata`);
console.log(`\n${pass} lolos, ${fail} gagal`); process.exit(fail ? 1 : 0);
