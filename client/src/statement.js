// Pembaca e-statement PDF berbasis tata letak. Tidak ada aturan khusus per bank: yang dicari adalah baris judul kolom
// (Tanggal, Keterangan, Debet/Debit, Kredit, Keluar, Masuk, Mutasi/Nominal, Saldo), lalu setiap potongan teks
// dimasukkan ke kolom terdekat berdasarkan posisinya di halaman. Murni JavaScript (tanpa pdf.js) supaya bisa diuji.
import { parseDate, parseAmount, dirFromText, makeItem, findPeriod, monthNum } from './importer.js';

const ROLES = [
  ['valdate', /(tgl\.?\s*valuta|val\.?\s*date|value\s*date|tanggal\s*valuta)/],
  ['no', /^(no\.?|nomor)$/],
  ['cbg', /^(cbg|cabang|branch)$/],
  ['balance', /(saldo|balance)/],
  ['date', /^(tgl|tanggal|date|waktu)\b|(trx|transaksi|transaction)\.?\s*(date|tgl|tanggal)/],
  ['debit', /^(debet|debit|debits|keluar|pengeluaran|withdrawals?)\b/],
  ['credit', /^(kredit|credit|credits|masuk|pemasukan|deposits?)\b/],
  ['amount', /^(mutasi|nominal|jumlah|amount|nilai)\b/],
  ['desc', /(keterangan|uraian|deskripsi|description|remarks?|transaksi|transaction|rincian|berita|detail)/],
  ['ref', /^(reference|referensi|ref\.?)$/],
];
const roleOf = (s) => { const t = s.toLowerCase().trim(); for (const [r, rx] of ROLES) if (rx.test(t)) return r; return null; };
const MONEY_ROLES = ['debit', 'credit', 'amount', 'balance'];
const STOP = /^(total\b|jumlah\b|sub ?total|saldo\s*(awal|akhir)|opening balance|closing balance|ending balance|balance brought|mutasi\s*(cr|db)\b|ringkasan|page\b|halaman\b|bersambung|catatan\b|note\b)/i;
const TIME = /^\d{1,2}:\d{2}(:\d{2})?(\s*(WIB|WITA|WIT))?$/i;
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] || 8; };

// Potongan teks -> baris (berdasarkan y) -> segmen (kata yang berdekatan digabung)
export function toLines(items) {
  const tol = Math.max(2.5, 0.5 * median(items.map((i) => i.h)));
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(it.y - last.y) <= tol) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines.map((l) => {
    const its = l.items.sort((a, b) => a.x - b.x);
    const segs = [];
    for (const it of its) {
      const p = segs[segs.length - 1];
      const gap = p ? it.x - p.x1 : 0;
      if (p && gap < Math.max(4, 0.7 * it.h)) { p.str = (p.str + (gap > 0.15 * it.h ? ' ' : '') + it.str).replace(/\s+/g, ' '); p.x1 = it.x + it.w; p.h = Math.max(p.h, it.h); }
      else segs.push({ str: it.str.trim(), x0: it.x, x1: it.x + it.w, h: it.h });
    }
    segs.forEach((s) => { s.cx = (s.x0 + s.x1) / 2; s.str = s.str.trim(); });
    const h = Math.max(...segs.map((s) => s.h));
    return { y: l.y, h, segs, text: segs.map((s) => s.str).join(' ') };
  });
}

// Cari baris judul kolom (boleh dua bahasa dan beberapa baris)
function findHeader(lines) {
  for (let i = 0; i < lines.length; i++) {
    const cols = {};
    for (const s of lines[i].segs) { const r = roleOf(s.str); if (r && !cols[r]) cols[r] = { x0: s.x0, x1: s.x1, cx: s.cx }; }
    if (cols.date && (cols.debit || cols.credit || cols.amount)) {
      let end = i;
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const segs = lines[j].segs;
        const hits = segs.filter((s) => roleOf(s.str)).length;
        if (hits >= 2 || segs.every((s) => /^\(?(dd|mm|yy)/i.test(s.str))) end = j; else break;
      }
      return { cols, end };
    }
  }
  return null;
}

function isMoney(s) {
  const a = parseAmount(s);
  if (!a) return false;
  const c = s.replace(/\s/g, '');
  if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(c)) return false; // itu tanggal
  return /[.,]/.test(c) || !!a.tag || /^[-+−–(]/.test(c);
}

// Tentukan peran tiap segmen pada satu baris data
function classify(line, cols, period, today) {
  const rec = { y: line.y, h: line.h, dateText: null, desc: [], money: [] };
  const numeric = MONEY_ROLES.filter((r) => cols[r]);
  const minNum = numeric.length ? Math.min(...numeric.map((r) => cols[r].x0)) : Infinity;
  const dateRight = Math.max(cols.date.x1, cols.valdate?.x1 ?? 0) + 10;
  const dateLike = (s) => parseDate(s, today, period) !== null || monthNum(s) !== null;
  for (const seg of line.segs) {
    const s = seg.str;
    if (!s) continue;
    if (numeric.length && seg.x1 > minNum - 8 && isMoney(s)) {
      const role = numeric.map((r) => [r, Math.min(Math.abs(seg.cx - cols[r].cx), Math.abs(seg.x1 - cols[r].x1))]).sort((a, b) => a[1] - b[1])[0][0];
      rec.money.push({ role, str: s });
    } else if (numeric.length && /^(db|cr|dr)$/i.test(s) && seg.x0 > minNum - 30 && rec.money.length) {
      rec.money[rec.money.length - 1].str += ' ' + s;
    } else if (cols.no && /^\d{1,3}$/.test(s) && seg.x1 < cols.date.x0 - 2) {
      continue; // nomor urut
    } else if (seg.x0 < dateRight && dateLike(s) && !(cols.cbg && seg.x0 > cols.cbg.x0 - 6)) {
      const dv = cols.valdate ? Math.abs(seg.cx - cols.valdate.cx) : Infinity;
      if (dv < Math.abs(seg.cx - cols.date.cx)) continue; // tanggal valuta: diabaikan
      if (!rec.dateText) rec.dateText = s;
    } else if (seg.x0 < dateRight && TIME.test(s)) {
      continue; // jam di kolom tanggal
    } else if (cols.cbg && seg.cx > cols.cbg.x0 - 6 && seg.cx < cols.cbg.x1 + 6 && /^\d{1,5}$/.test(s)) {
      continue; // kode cabang
    } else {
      rec.desc.push(s);
    }
  }
  return rec;
}

const clean = (s) => s.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ').replace(/\s+/g, ' ').trim();
const monthEnd = (period, mo) => {
  const y = period ? (+period.start.slice(0, 4) === +period.end.slice(0, 4) || mo >= +period.start.slice(5, 7) ? +period.start.slice(0, 4) : +period.end.slice(0, 4)) : null;
  return y ? `${y}-${String(mo).padStart(2, '0')}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, '0')}` : null;
};

export function parseStatement(pages, today) {
  const pageLines = pages.map((p) => toLines(p.items));
  const period = findPeriod(pageLines.flatMap((l) => l.map((x) => x.text)));
  const notes = [];
  let cols = null;
  const blocks = [];
  let opening = null;
  let skipped = 0;

  for (const lines of pageLines) {
    const h = findHeader(lines);
    let start = 0;
    if (h) { cols = h.cols; start = h.end + 1; } else if (!cols) continue;
    let block = null;
    let prev = null;
    for (const ln of lines.slice(start)) {
      const rec = classify(ln, cols, period, today);
      const d = rec.desc.join(' ').trim();
      if (STOP.test(d)) {
        const bal = rec.money.find((m) => m.role === 'balance');
        if (bal && /saldo\s*awal|opening/i.test(d)) opening = parseAmount(bal.str)?.value ?? null;
        block = null; prev = null; continue;
      }
      if (rec.dateText) {
        // Nominal yang tercetak tepat di atas baris tanggal (tanpa keterangan) adalah milik transaksi baru ini, bukan blok sebelumnya
        const pulled = [];
        while (block && block.lines.length > 1) {
          const last = block.lines[block.lines.length - 1];
          const hasAmt = last.money.some((m) => m.role !== 'balance');
          if (hasAmt && !last.desc.length && ln.y - last.y <= 1.25 * ln.h) pulled.unshift(block.lines.pop()); else break;
        }
        block = { dateText: rec.dateText, lines: [...pulled, rec] };
        blocks.push(block);
      }
      else if (block && prev && ln.y - prev.y <= 2.5 * Math.max(ln.h, prev.h)) block.lines.push(rec);
      else { block = null; if (rec.desc.length || rec.money.length) skipped++; } // baris di luar tabel (catatan kaki dll) menutup blok
      prev = ln;
    }
  }

  // arah untuk kolom nominal tunggal: kalau ada tanda DB atau minus di berkas, nominal polos berarti uang masuk
  const amts = blocks.flatMap((b) => b.lines.flatMap((l) => l.money.filter((m) => m.role === 'amount').map((m) => parseAmount(m.str))));
  const hasDB = amts.some((a) => a?.tag === 'DB'), hasNeg = amts.some((a) => a?.neg);

  const txns = [];
  for (const b of blocks) {
    let date = parseDate(b.dateText, today, period), uncertain = false;
    let reason = null;
    if (!date && monthNum(b.dateText)) { date = monthEnd(period, monthNum(b.dateText)); uncertain = true; reason = 'Tanggal hanya bulan: dipakai akhir periode'; notes.push('month'); }
    if (!date) { skipped++; continue; }
    const idx = b.lines.map((l, i) => (l.money.some((m) => m.role !== 'balance' && (parseAmount(m.str)?.value || 0) > 0) ? i : -1)).filter((i) => i >= 0);
    idx.forEach((ai, k) => {
      const line = b.lines[ai];
      const to = k + 1 < idx.length ? idx[k + 1] : b.lines.length;
      let parts = b.lines.slice(k === 0 ? 0 : ai, to).flatMap((l) => l.desc);
      if (!parts.length) parts = b.lines.find((l) => l.desc.length)?.desc || [];
      const m = line.money.filter((x) => x.role !== 'balance' && (parseAmount(x.str)?.value || 0) > 0);
      const deb = m.find((x) => x.role === 'debit'), cre = m.find((x) => x.role === 'credit'), amt = m.find((x) => x.role === 'amount');
      let type, value, u = uncertain, why = reason;
      if (deb && cre) { type = 'expense'; value = parseAmount(deb.str).value; u = true; why = 'Debit dan kredit sama-sama terisi'; }
      else if (deb) { type = 'expense'; value = parseAmount(deb.str).value; }
      else if (cre) { type = 'income'; value = parseAmount(cre.str).value; }
      else {
        const a = parseAmount(amt.str);
        value = a.value;
        type = a.tag === 'DB' ? 'expense' : a.tag === 'CR' ? 'income' : a.neg ? 'expense' : /^\s*\+/.test(amt.str) ? 'income'
          : (hasDB || hasNeg) ? 'income' : dirFromText(parts.join(' '));
        if (!type) { type = 'expense'; u = true; why = 'Arah transaksi tidak pasti'; }
      }
      const note = clean(parts.join(' ')).split(' ').filter((w) => !(/^\d{4,}[.,]\d{2}$/.test(w) && Number(w.replace(',', '.')) === value)).join(' ');
      const bal = line.money.find((x) => x.role === 'balance');
      txns.push({ date, type, amount: value, note, uncertain: u, reason: why, bal: bal ? parseAmount(bal.str)?.value ?? null : null });
    });
  }

  // Cocokkan dengan kolom saldo: selisih saldo antar baris harus sama dengan nominal, jadi arah bisa dipastikan
  const pairs = txns.map((t, i) => (i && t.bal != null && txns[i - 1].bal != null ? i : -1)).filter((i) => i > 0);
  const fwd = (i) => Math.abs(txns[i].bal - txns[i - 1].bal) === txns[i].amount;
  const rev = (i) => Math.abs(txns[i - 1].bal - txns[i].bal) === txns[i - 1].amount;
  const F = pairs.filter(fwd).length + (opening != null && txns[0]?.bal != null && Math.abs(txns[0].bal - opening) === txns[0].amount ? 1 : 0);
  const Rv = pairs.filter(rev).length;
  let verified = 0, mismatch = 0;
  if (F >= Rv && F > 0) {
    let prevBal = opening;
    txns.forEach((t) => {
      if (t.bal != null && prevBal != null) {
        const d = t.bal - prevBal;
        if (Math.abs(d) === t.amount) { t.type = d > 0 ? 'income' : 'expense'; t.uncertain = false; t.reason = null; verified++; } else { t.uncertain = true; t.reason = 'Saldo tidak cocok dengan nominal'; mismatch++; }
      }
      prevBal = t.bal;
    });
    if (verified) notes.push(`saldo:${verified}`);
    if (mismatch) notes.push(`mismatch:${mismatch}`);
  }

  const items = txns.filter((t) => t.amount > 0).map((t) => makeItem(t));
  return { items, skipped, period, notes, ok: items.length > 0, verified, mismatch,
    monthOnly: notes.filter((n) => n === 'month').length };
}
