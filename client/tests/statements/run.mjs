// Uji pembaca e-statement PDF: node tests/statements/run.mjs (PDF contoh dibuat dulu oleh gen.mjs)
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pagesFromDoc } from '../../src/pdfItems.js';
import { parseStatement } from '../../src/statement.js';
import fs from 'node:fs';
import path from 'node:path';
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname), 'pdf') + '/';
const exp = JSON.parse(fs.readFileSync(DIR + 'expected.json', 'utf8'));
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };
const read = async (n) => { const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(DIR + n + '.pdf')), useSystemFonts: true, verbosity: 0 }).promise; return parseStatement(await pagesFromDoc(doc), '2026-10-02'); };
const cmp = (n, r, e) => {
  const got = r.items.map((x) => [x.date, x.type, x.amount]);
  const same = JSON.stringify(got) === JSON.stringify(e);
  ok(same, `${n}: ${got.length}/${e.length} transaksi sama persis dengan yang diharapkan`);
  if (!same) { const L = Math.max(got.length, e.length); for (let i = 0; i < L; i++) if (JSON.stringify(got[i]) !== JSON.stringify(e[i])) console.log(`   baris ${i + 1}: dapat ${JSON.stringify(got[i])} | harusnya ${JSON.stringify(e[i])}`); }
};
for (const n of ['permata', 'permata_terbalik', 'mandiri', 'seabank', 'bni_varian', 'bri_template', 'bca']) {
  const r = await read(n);
  cmp(n, r, exp[n]);
  if (process.env.V) console.log('   periode', JSON.stringify(r.period), 'catatan', r.notes.join(','), '\n   ', r.items.map((x) => `${x.type[0]}${x.amount} "${x.note.slice(0, 40)}"${x.uncertain ? '?' : ''}${x.hint ? '[T]' : ''}`).join('\n    '));
}
// tidak ada teks catatan kaki yang menempel ke keterangan transaksi terakhir
const m = await read('mandiri'); ok(!m.items.some((x) => /OJK|Otoritas|Penjamin|Call 14000/.test(x.note)), 'mandiri: catatan kaki halaman tidak ikut ke keterangan transaksi');
ok(m.verified >= 17 && m.mismatch === 0, `mandiri: saldo cocok untuk ${m.verified} baris, tidak ada yang meleset`);
const pt = await read('permata_terbalik'); ok(pt.items.every((x) => !x.uncertain), 'permata_terbalik: urutan terbaru-di-atas tidak menimbulkan tanda curiga palsu');
const sb = await read('seabank'); ok(sb.items.filter((x) => x.uncertain).length === 2 && sb.items.filter((x) => x.uncertain).every((x) => /hanya bulan/.test(x.reason)), 'seabank: dua baris tanpa tanggal lengkap ditandai dengan alasan yang jelas');
const t = await read('bni_template'); ok(t.items.length === 0, `bni_template: tanggal masih placeholder mm/dd/yyyy, tidak ada transaksi yang dikarang (${t.items.length})`);
console.log(`\n${pass} lolos, ${fail} gagal`); process.exit(fail ? 1 : 0);
