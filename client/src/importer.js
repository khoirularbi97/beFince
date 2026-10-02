// Pembaca mutasi rekening/e-wallet. Murni JavaScript tanpa React, jadi mudah diuji.
// Semua berjalan di browser: berkas tidak diunggah ke server sebelum kamu menekan Simpan.

const MON = { jan: 1, januari: 1, january: 1, feb: 2, februari: 2, february: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4,
  mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, ags: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, nop: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12 };
export const monthNum = (w) => MON[String(w || '').toLowerCase().replace(/\.$/, '')] || null;
const pad = (n) => String(n).padStart(2, '0');
const shiftDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

function ymd(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null;
}

// Mengenali 2026-09-01, 01/09/2026, 01-09-26, 1 Sep 2026, 01 Agustus 2026, dan 01/09 (tanpa tahun)
// Mengisi tahun untuk tanggal tanpa tahun: pakai periode e-statement kalau ada, kalau tidak pakai hari ini
function inPeriod(d, mo, period, today) {
  if (period) {
    const years = [...new Set([+period.start.slice(0, 4), +period.end.slice(0, 4)])];
    for (const y of years) { const r = ymd(y, mo, d); if (r && r >= period.start && r <= period.end) return r; }
    return ymd(years[years.length - 1], mo, d);
  }
  if (!today) return null;
  const y = +today.slice(0, 4);
  let r = ymd(y, mo, d);
  if (r && r > shiftDays(today, 31)) r = ymd(y - 1, mo, d); // tanpa tahun dan di masa depan: berarti tahun lalu
  return r;
}

export function parseDate(s, today, period) {
  const t = String(s ?? '').toLowerCase();
  let m = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = t.match(/(?<!\d)(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})(?!\d)/);
  if (m) return ymd(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = t.match(/(?<!\d)(\d{1,2})\s*[-/. ]?\s*([a-z]{3,9})\.?,?\s*[-/. ]?\s*(\d{4}|\d{2})(?!\d)/);
  if (m && monthNum(m[2])) return ymd(+m[3] < 100 ? 2000 + +m[3] : +m[3], monthNum(m[2]), +m[1]);
  m = t.match(/(?<![\d/.-])(\d{1,2})[/-](\d{1,2})(?![\d/.-])/);
  if (m) return inPeriod(+m[1], +m[2], period, today);
  m = t.match(/(?<!\d)(\d{1,2})\s*([a-z]{3,9})\.?(?![a-z\d])/);
  if (m && monthNum(m[2])) return inPeriod(+m[1], monthNum(m[2]), period, today);
  return null;
}

const lastOf = (y, m) => ymd(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
// Mencari periode e-statement dari teks judul: "01 MEI 2021 - 31 MEI 2021", "Dec 16, 2020 to Jan 03, 2021",
// "01/05/2021 s/d 31/05/2021", atau "PERIODE : MEI 2022"
export function findPeriod(lines) {
  const SEP = '(?:-|–|—|s\\/d|s\\.d\\.?|sd|sampai|to|until)';
  const R = [
    [new RegExp(`(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})\\s*${SEP}\\s*(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})`, 'i'), (m) => [ymd(+m[3], +m[2], +m[1]), ymd(+m[6], +m[5], +m[4])]],
    [new RegExp(`(\\d{1,2})\\s+([a-z]{3,9})\\.?,?\\s+(\\d{4})\\s*${SEP}\\s*(\\d{1,2})\\s+([a-z]{3,9})\\.?,?\\s+(\\d{4})`, 'i'),
      (m) => monthNum(m[2]) && monthNum(m[5]) ? [ymd(+m[3], monthNum(m[2]), +m[1]), ymd(+m[6], monthNum(m[5]), +m[4])] : null],
    [new RegExp(`([a-z]{3,9})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\s*${SEP}\\s*([a-z]{3,9})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'),
      (m) => monthNum(m[1]) && monthNum(m[4]) ? [ymd(+m[3], monthNum(m[1]), +m[2]), ymd(+m[6], monthNum(m[4]), +m[5])] : null],
    [/period[e]?[^a-z0-9]{0,12}([a-z]{3,9})\s+(\d{4})/i, (m) => monthNum(m[1]) ? [ymd(+m[2], monthNum(m[1]), 1), lastOf(+m[2], monthNum(m[1]))] : null],
  ];
  for (const [rx, f] of R) {
    for (const l of lines) {
      const m = String(l).match(rx);
      const r = m && f(m);
      if (r && r[0] && r[1] && r[0] <= r[1]) return { start: r[0], end: r[1] };
    }
  }
  return null;
}

// Mengenali 1.500.000 | 1,500,000.00 | 1.500.000,00 | Rp 25.000 | -25000 | (25.000) | 1,500,000.00 DB
export function parseAmount(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return null;
  let tag = null;
  const mt = s.match(/\s*\b(db|dr|d|cr|k)\.?\s*$/i) || s.match(/^\s*(db|cr)\b\s*/i);
  if (mt) { tag = /^(db|dr|d)$/i.test(mt[1]) ? 'DB' : 'CR'; s = s.replace(mt[0], ''); }
  const neg = /^\s*[-−–]/.test(s) || /^\(.*\)$/.test(s.trim());
  s = s.replace(/rp\.?|idr/gi, '').replace(/[\s()+\-−–]/g, '');
  if (!/^\d[\d.,]*$/.test(s)) return null;
  const dot = s.lastIndexOf('.'), com = s.lastIndexOf(',');
  let ip = s, dec = '';
  if (dot > -1 && com > -1) { const i = Math.max(dot, com); ip = s.slice(0, i); dec = s.slice(i + 1); }
  else if (dot > -1 || com > -1) {
    const parts = s.split(dot > -1 ? '.' : ',');
    const last = parts[parts.length - 1];
    if (parts.length > 2 || (last.length === 3 && parts[0] !== '0')) { ip = s; dec = ''; } // pemisah ribuan
    else { ip = parts[0]; dec = last; }
  }
  const value = Math.round(Number(ip.replace(/[.,]/g, '') + (dec ? '.' + dec : '')));
  return Number.isFinite(value) ? { value, neg, tag } : null;
}

// ---------- tabel (CSV / TSV / tempel dari spreadsheet) ----------
export function parseDelimited(text) {
  const t = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const head = t.split('\n').filter((l) => l.trim()).slice(0, 15);
  const median = (d) => { const c = head.map((l) => l.split(d).length - 1).sort((a, b) => a - b); return c[Math.floor(c.length / 2)] || 0; };
  const D = [';', '\t', '|', ','].map((d) => [d, median(d)]).sort((a, b) => b[1] - a[1])[0];
  const delim = D[1] > 0 ? D[0] : ',';
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell); rows.push(row);
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

const H = {
  balance: /saldo|balance/i,
  date: /tanggal|tgl|date|waktu|timestamp/i,
  debit: /^(debit|debet|db|keluar|pengeluaran|uang keluar|withdrawal|dr)\b/i,
  credit: /^(credit|kredit|cr|masuk|pemasukan|uang masuk|deposit)\b/i,
  amount: /^(jumlah|nominal|amount|mutasi|nilai|total)\b/i,
  type: /^(jenis|tipe|type|db\/cr|d\/k|dk|cr\/db|mutasi\s*\(?db)/i,
  status: /^status/i,
  desc: /keterangan|uraian|deskripsi|description|remark|berita|detail|narasi|merchant|tujuan|catatan|transaksi$/i,
};

// Cari baris judul kolom; kalau tidak ada, tebak kolom dari isinya
export function detectColumns(rows, today) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cols = { desc: [] };
    rows[i].forEach((c, j) => {
      const cell = c.toLowerCase().trim();
      if (!cell) return;
      if (H.balance.test(cell)) { cols.balance = j; return; }
      if (H.debit.test(cell) && cols.debit === undefined) cols.debit = j;
      else if (H.credit.test(cell) && cols.credit === undefined) cols.credit = j;
      else if (H.amount.test(cell) && cols.amount === undefined) cols.amount = j;
      else if (H.status.test(cell)) cols.status = j;
      else if (H.type.test(cell) && cols.type === undefined) cols.type = j;
      else if (H.date.test(cell) && cols.date === undefined) cols.date = j;
      else if (H.desc.test(cell)) cols.desc.push(j);
    });
    if (cols.date !== undefined && (cols.debit !== undefined || cols.credit !== undefined || cols.amount !== undefined)) {
      return { cols, start: i + 1, guessed: false };
    }
  }
  // tebak dari isi
  const body = rows.filter((r) => r.length >= 3).slice(0, 60);
  const n = Math.max(0, ...body.map((r) => r.length));
  const frac = (j, fn) => { const v = body.map((r) => r[j]).filter((x) => x !== undefined && x !== ''); return v.length ? v.filter(fn).length / v.length : 0; };
  let date, best = 0.6;
  for (let j = 0; j < n; j++) { const f = frac(j, (x) => parseDate(x, today)); if (f >= best) { best = f; date = j; } }
  if (date === undefined) return { cols: { desc: [] }, start: 0, guessed: true };
  const nums = [];
  for (let j = 0; j < n; j++) if (j !== date && frac(j, (x) => parseAmount(x)) >= 0.6) nums.push(j);
  const textCols = [];
  for (let j = 0; j < n; j++) if (j !== date && !nums.includes(j)) textCols.push(j);
  textCols.sort((a, b) => body.reduce((s, r) => s + (r[b] || '').length, 0) - body.reduce((s, r) => s + (r[a] || '').length, 0));
  const cols = { date, desc: textCols.slice(0, 1) };
  if (nums.length === 1) cols.amount = nums[0];
  else if (nums.length === 2) { cols.amount = nums[0]; cols.balance = nums[1]; }
  else if (nums.length >= 3) { cols.debit = nums[0]; cols.credit = nums[1]; cols.balance = nums[2]; }
  return { cols, start: 0, guessed: true };
}

// ---------- arah transaksi, kategori, dan petunjuk ----------
const IN_RX = /\b(masuk|menerima|terima|diterima|top ?up|topup|isi saldo|cashback|refund|pengembalian|gaji|salary|kredit|credit|setor|bunga|incoming|dari|from|cr)\b/i;
const OUT_RX = /\b(keluar|bayar|pembayaran|beli|pembelian|transfer ke|kirim|tarik|debit|debet|biaya|admin|tagihan|belanja|payment|purchase|outgoing|db)\b/i;
export function dirFromText(s) {
  const t = String(s ?? '');
  const i = IN_RX.test(t), o = OUT_RX.test(t);
  if (i && !o) return 'income';
  if (o && !i) return 'expense';
  return null;
}
// Top up, tarik tunai, dan transfer ke e-wallet biasanya perpindahan antar dompet milikmu, bukan belanja
const TRANSFER_RX = /(top ?up|isi saldo|tarik tunai|setor tunai|pindah buku|overbooking|(trf|transfer|tf)[^a-z0-9]+(ke |dari )?(dana|ovo|gopay|go-pay|shopeepay|shopee pay|linkaja)|(pay|bayar|pembayaran|payment)[^a-z0-9]+(go-?pay|ovo|dana|shopee ?pay|linkaja))/i;
// Biaya admin untuk top up itu pengeluaran sungguhan, jadi tidak dianggap perpindahan antar dompet
const FEE_RX = /\b(biaya|adm|admin|fee)\b/i;

const CATS = [
  ['Makan', /\b(gofood|grabfood|shopeefood|kfc|mcd|mcdonald|burger|pizza|starbucks|kopi|coffee|warung|resto|restoran|bakso|nasi|ayam|mie|cafe|kantin|makan|jco|hokben|yoshinoya|bakmi)\b/i],
  ['Transport', /\b(gojek|goride|gocar|grab|grabcar|bluebird|krl|mrt|lrt|transjakarta|kai|kereta|tol|etoll|e-toll|parkir|pertamina|spbu|shell|bbm|bensin|maxim|indrive)\b/i],
  ['Tagihan', /\b(pln|listrik|token|pdam|indihome|telkom|telkomsel|xl|axis|indosat|tri|smartfren|pulsa|paket data|bpjs|asuransi|cicilan|kpr|wifi|iuran|spp)\b/i],
  ['Belanja', /\b(indomaret|alfamart|alfamidi|tokopedia|shopee|lazada|blibli|bukalapak|tiktok|supermarket|hypermart|transmart|superindo|miniso|uniqlo)\b/i],
  ['Hiburan', /\b(netflix|spotify|youtube|disney|vidio|cgv|xxi|bioskop|steam|playstation|game|tiket|konser)\b/i],
];
const INCOME_CATS = [['Gaji', /\b(gaji|salary|payroll|thr|bonus)\b/i], ['Freelance', /\b(freelance|honor|fee|project)\b/i]];
export function guessCategory(note, type) {
  for (const [name, rx] of type === 'income' ? INCOME_CATS : CATS) if (rx.test(note || '')) return name;
  return null;
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
export function makeItem({ date, type, amount, note, uncertain, reason }) {
  const n = clean(note);
  return { date, type, amount, note: n, uncertain: !!uncertain, reason: uncertain ? reason || null : null, hint: TRANSFER_RX.test(n) && !FEE_RX.test(n) ? 'transfer' : null, category: guessCategory(n, type) };
}

// ---------- ubah baris tabel menjadi transaksi ----------
const BAD_STATUS = /gagal|failed|batal|cancel|expired|ditolak|dibatalkan/i;
export function extractRows(rows, cols, start, today) {
  const items = [];
  let skipped = 0;
  // Kalau ada nominal bertanda minus di berkas, berarti nominal positif adalah uang masuk
  const signed = cols.amount !== undefined && rows.slice(start).some((r) => parseAmount(r[cols.amount])?.neg);
  for (const r of rows.slice(start)) {
    const date = parseDate(r[cols.date], today);
    if (!date) { skipped++; continue; }
    if (cols.status !== undefined && BAD_STATUS.test(r[cols.status] || '')) { skipped++; continue; }
    const note = (cols.desc || []).map((j) => r[j]).filter(Boolean).join(' ');
    const typeText = cols.type !== undefined ? r[cols.type] || '' : '';
    let type = null, amount = 0, uncertain = false;
    const d = cols.debit !== undefined ? parseAmount(r[cols.debit]) : null;
    const c = cols.credit !== undefined ? parseAmount(r[cols.credit]) : null;
    if ((d && d.value > 0) || (c && c.value > 0)) {
      if (d && d.value > 0 && c && c.value > 0) { uncertain = true; }
      if (c && c.value > 0 && !(d && d.value > 0)) { type = 'income'; amount = c.value; }
      else { type = 'expense'; amount = d.value; }
    } else if (cols.amount !== undefined) {
      const a = parseAmount(r[cols.amount]);
      if (!a || a.value <= 0) { skipped++; continue; }
      amount = a.value;
      type = a.tag === 'DB' ? 'expense' : a.tag === 'CR' ? 'income' : a.neg ? 'expense'
        : /^(db|d|debit|debet|keluar)$/i.test(typeText.trim()) ? 'expense' : /^(cr|k|kredit|credit|masuk)$/i.test(typeText.trim()) ? 'income'
        : dirFromText(typeText) || dirFromText(note) || (signed ? 'income' : null);
      if (!type) { type = 'expense'; uncertain = true; }
    } else { skipped++; continue; }
    items.push(makeItem({ date, type, amount, note: note || typeText, uncertain }));
  }
  return { items, skipped };
}

// Baca teks tabel (isi berkas CSV/TSV)
export function readTable(text, today) {
  const rows = parseDelimited(text);
  if (!rows.length) return { rows, cols: { desc: [] }, start: 0, guessed: true, items: [], skipped: 0 };
  const det = detectColumns(rows, today);
  const ok = det.cols.date !== undefined && (det.cols.amount !== undefined || det.cols.debit !== undefined || det.cols.credit !== undefined);
  const { items, skipped } = ok ? extractRows(rows, det.cols, det.start, today) : { items: [], skipped: 0 };
  return { rows, ...det, items, skipped, ok };
}

// ---------- tempel teks: notifikasi bank/e-wallet atau baris salinan e-statement PDF ----------
const DATE_ALL = /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|(?<!\d)\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}|(?<!\d)\d{1,2}\s*[a-z]{3,9}\.?,?\s*\d{4}|(?<![\d/.-])\d{1,2}[/-]\d{1,2}(?![\d/.-])|\d{1,2}:\d{2}(?::\d{2})?/gi;
function moneyTokens(block) {
  const s = block.replace(DATE_ALL, ' ');
  const out = [];
  for (const m of s.matchAll(/(?:rp\.?|idr)\s*(-?\d[\d.,]*)/gi)) out.push({ raw: m[1], idx: m.index, tag: null });
  if (!out.length) {
    for (const m of s.matchAll(/(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{2})(?!\d)(?:\s*(db|cr|dr|d|k)\b)?/gi)) {
      out.push({ raw: m[1], idx: m.index, tag: m[2] ? (/^(db|dr|d)$/i.test(m[2]) ? 'DB' : 'CR') : null });
    }
  }
  const noBalance = out.filter((t) => !/(saldo|balance|sisa)[^\d]{0,12}$/i.test(s.slice(Math.max(0, t.idx - 16), t.idx)));
  return { tokens: noBalance.length ? noBalance : out, text: s };
}
export function parseText(text, today) {
  const t = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!t) return { items: [], skipped: 0 };
  let blocks = t.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 1) {
    const lines = blocks[0].split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.filter((l) => moneyTokens(l).tokens.length).length > 1) blocks = lines; // satu baris satu transaksi
  }
  const items = [];
  let skipped = 0;
  for (const b of blocks) {
    const { tokens } = moneyTokens(b);
    if (!tokens.length) { skipped++; continue; }
    const pick = tokens.find((x) => x.tag) || tokens[0];
    const a = parseAmount(pick.raw);
    if (!a || a.value <= 0) { skipped++; continue; }
    const date = parseDate(b, today) || today;
    let type = pick.tag === 'DB' ? 'expense' : pick.tag === 'CR' ? 'income' : a.neg ? 'expense' : dirFromText(b);
    let uncertain = tokens.length > 1 && !pick.tag;
    if (!type) { type = 'expense'; uncertain = true; }
    const note = b.replace(DATE_ALL, ' ').replace(/(?:rp\.?|idr)\s*-?\d[\d.,]*/gi, ' ').replace(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\s*(?:db|cr)?/gi, ' ').replace(/[|;]+/g, ' ');
    items.push(makeItem({ date, type, amount: a.value, note, uncertain }));
  }
  return { items, skipped };
}
