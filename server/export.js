import fs from 'node:fs';
import PDFDocument from 'pdfkit';
import * as R from './queries.js';
import { rp } from './util.js';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const label = (m) => `${MONTHS[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;

export async function sendCsv(res, uid, month) {
  const rows = await R.transactions(uid, month);
  // Pemisah titik koma: terbuka rapi di Excel dengan pengaturan regional Indonesia dan di Google Sheets.
  const cell = (v) => {
    if (typeof v === 'number') return String(v);
    const t = String(v ?? '');
    return /[;"\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
  };
  const lines = [['Tanggal', 'Jam', 'Jenis', 'Kategori', 'Dompet', 'Catatan', 'Nominal']].concat(
    rows.map((r) => [r.date, r.time ?? '', r.type === 'income' ? 'Pemasukan' : 'Pengeluaran', r.category ?? 'Tanpa kategori', r.wallet, r.note, r.amount]));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="laporan-${month}.csv"`);
  res.send('\uFEFF' + lines.map((l) => l.map(cell).join(';')).join('\r\n'));
}

export async function sendPdf(res, uid, month) {
  const [rep, wallets, bud, goals, tx] = await Promise.all([
    R.monthReport(uid, month), R.wallets(uid, month), R.budgets(uid, month), R.goals(uid), R.transactions(uid, month),
  ]);
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="laporan-${month}.pdf"`);
  doc.pipe(res);

  const row = (l, r, bold) => {
    if (doc.y > 760) doc.addPage();
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10.5);
    doc.text(l, 48, y, { width: 330, lineBreak: false, ellipsis: true });
    doc.text(r, 380, y, { width: 167, align: 'right', lineBreak: false });
    doc.y = y + 16;
  };
  const head = (t) => { doc.moveDown(0.8); doc.font('Helvetica-Bold').fontSize(13).text(t, 48); doc.moveDown(0.3); };

  const logo = new URL('./assets/logo.png', import.meta.url);
  if (fs.existsSync(logo)) doc.image(logo.pathname, 48, 44, { height: 30 });
  doc.font('Helvetica').fontSize(9).fillColor('#5a6a7e').text('beFince', 48, 50, { width: 499, align: 'right' }).fillColor('#000000');
  doc.y = 88;
  doc.font('Helvetica-Bold').fontSize(20).text(`Laporan Keuangan ${label(month)}`, 48);
  head('Ringkasan');
  row('Pemasukan', rp(rep.income));
  row('Pengeluaran', rp(rep.expense));
  row('Sisa bulan ini', (rep.balance < 0 ? '-' : '') + rp(Math.abs(rep.balance)), true);

  head('Pengeluaran per kategori');
  rep.byCategory.forEach((c) => {
    const b = bud.find((x) => x.name === c.name && x.budget > 0);
    row(c.name, b ? `${rp(c.total)} dari ${rp(b.budget)}` : rp(c.total));
  });
  if (!rep.byCategory.length) row('Belum ada pengeluaran', '');

  head('Saldo dompet (akhir bulan)');
  wallets.forEach((w) => row(w.name, (w.balance < 0 ? '-' : '') + rp(Math.abs(w.balance))));

  if (goals.length) {
    head('Target tabungan');
    goals.forEach((g) => row(`${g.name} (${Math.min(100, Math.round((g.saved / g.target) * 100))}%)`, `${rp(g.saved)} dari ${rp(g.target)}`));
  }

  head('Pengeluaran terbesar');
  tx.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 10)
    .forEach((t) => row(`${t.date}  ${t.category ?? '-'}  ${t.note || ''}`, rp(t.amount)));
  doc.end();
}
