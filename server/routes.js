import { Router } from 'express';
import { q, pool } from './db.js';
import * as R from './queries.js';
import { sendCsv, sendPdf } from './export.js';
import { aiRouter } from './ai/routes.js';
import {
  HttpError, bad, wrap, monthOf, bounds, lastDay, shiftMonth, dateOf,
  amountOf, idOf, oneOf, rp, text, APP_TZ, timeExpr,
} from './util.js';

// Semua rute di sini sudah lewat requireAuth, jadi req.userId selalu ada.
export const router = Router();
router.use(aiRouter); // analisa keuangan: /insights dan /ai/*
const TYPES = ['income', 'expense'];
const KINDS = ['cash', 'bank', 'ewallet'];

// Pastikan baris yang dirujuk benar-benar milik pengguna ini (mencegah memakai dompet/kategori orang lain)
async function own(table, id, uid, label) {
  const rows = await q(`SELECT 1 FROM ${table} WHERE id = $1 AND user_id = $2`, [id, uid]);
  if (!rows.length) throw new HttpError(400, `${label} tidak ditemukan`);
}
async function needBalance(uid, walletId, amount) {
  const bal = await R.balanceOf(uid, walletId);
  if (bal === undefined) throw new HttpError(400, 'Dompet tidak ditemukan');
  if (bal < amount) throw new HttpError(400, `Saldo dompet tidak cukup (tersedia ${rp(bal)})`);
}

// ---------- meta & kategori ----------
router.get('/meta', wrap(async (req, res) => {
  res.json({
    wallets: await q('SELECT id, name, kind FROM wallets WHERE user_id = $1 ORDER BY id', [req.userId]),
    categories: await q('SELECT id, name, type FROM categories WHERE user_id = $1 ORDER BY type, id', [req.userId]),
  });
}));

// Ubah pelanggaran UNIQUE menjadi pesan yang jelas
const unique = async (fn, msg) => {
  try { return await fn(); } catch (e) { if (e.code === '23505') throw new HttpError(409, msg); throw e; }
};

// ---------- kelola kategori ----------
router.get('/categories', wrap(async (req, res) => {
  res.json(await q(
    `SELECT c.id, c.name, c.type, (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS uses
     FROM categories c WHERE c.user_id = $1 ORDER BY (c.type = 'income'), c.id`, [req.userId]));
}));

const categoryNameTaken = async (uid, name, type, exceptId = null) =>
  (await q('SELECT 1 FROM categories WHERE user_id = $1 AND type = $2 AND lower(name) = lower($3) AND ($4::int IS NULL OR id <> $4)', [uid, type, name, exceptId])).length > 0;

router.post('/categories', wrap(async (req, res) => {
  const name = text(req.body.name, 40);
  if (!name) bad('Nama kategori wajib diisi');
  const type = oneOf(req.body.type, TYPES, 'Tipe');
  if (await categoryNameTaken(req.userId, name, type)) throw new HttpError(409, 'Nama kategori sudah ada');
  const [row] = await unique(() => q(
    'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3) RETURNING id, name, type',
    [req.userId, name, type]), 'Nama kategori sudah ada');
  res.status(201).json(row);
}));

// Hanya nama yang bisa diubah. Jenis (pemasukan/pengeluaran) tetap, karena transaksi dan budget bergantung padanya.
router.put('/categories/:id', wrap(async (req, res) => {
  const name = text(req.body.name, 40);
  if (!name) bad('Nama kategori wajib diisi');
  const id = idOf(req.params.id, 'Kategori');
  const [cat] = await q('SELECT type FROM categories WHERE id = $1 AND user_id = $2', [id, req.userId]);
  if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan');
  if (await categoryNameTaken(req.userId, name, cat.type, id)) throw new HttpError(409, 'Nama kategori sudah ada');
  await unique(() => q('UPDATE categories SET name = $1 WHERE id = $2 AND user_id = $3', [name, id, req.userId]), 'Nama kategori sudah ada');
  res.json({ ok: true });
}));

// Hapus kategori. Transaksinya dipindah ke kategori lain (?move_to=ID, harus sejenis) atau menjadi "Tanpa kategori".
// Budget kategori yang dihapus ikut terhapus.
router.delete('/categories/:id', wrap(async (req, res) => {
  const id = idOf(req.params.id, 'Kategori');
  const [cat] = await q('SELECT id, type FROM categories WHERE id = $1 AND user_id = $2', [id, req.userId]);
  if (!cat) throw new HttpError(404, 'Kategori tidak ditemukan');
  let to = null;
  if (req.query.move_to) {
    to = idOf(req.query.move_to, 'Kategori tujuan');
    if (to === id) bad('Kategori tujuan harus berbeda');
    const [t] = await q('SELECT type FROM categories WHERE id = $1 AND user_id = $2', [to, req.userId]);
    if (!t) bad('Kategori tujuan tidak ditemukan');
    if (t.type !== cat.type) bad('Kategori tujuan harus sejenis (sama-sama pemasukan atau pengeluaran)');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let moved = 0;
    if (to) moved = (await client.query('UPDATE transactions SET category_id = $1 WHERE category_id = $2 AND user_id = $3', [to, id, req.userId])).rowCount;
    await client.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, req.userId]);
    await client.query('COMMIT');
    res.json({ ok: true, moved });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}));

// ---------- transaksi ----------
router.get('/transactions', wrap(async (req, res) => {
  const month = monthOf(req.query.month);
  const p = [req.userId];
  const where = ['t.user_id = $1'];
  const add = (sql, v) => { p.push(v); where.push(sql.replaceAll('?', `$${p.length}`)); };
  add('t.date >= ?', req.query.from || bounds(month)[0]);
  add('t.date <= ?', req.query.to || lastDay(month));
  if (req.query.type) add('t.type = ?', oneOf(req.query.type, TYPES, 'Tipe'));
  if (req.query.category_id) add('t.category_id = ?', idOf(req.query.category_id, 'Kategori'));
  if (req.query.wallet_id) add('t.wallet_id = ?', idOf(req.query.wallet_id, 'Dompet'));
  if (req.query.q) add('(c.name ILIKE ? OR t.note ILIKE ?)', `%${text(req.query.q, 60)}%`);
  const limit = Math.min(Number(req.query.limit) || 500, 1000);
  p.push(APP_TZ);
  const rows = await q(
    `SELECT t.id, t.type, t.amount, t.category_id, c.name AS category, t.wallet_id, w.name AS wallet,
            t.date, ${timeExpr('$' + p.length)} AS "time", t.note
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     JOIN wallets w ON w.id = t.wallet_id
     WHERE ${where.join(' AND ')} ORDER BY t.date DESC, "time" DESC NULLS LAST, t.id DESC LIMIT ${limit}`, p);
  res.json(rows);
}));

async function txValues(uid, b) {
  const v = [
    oneOf(b.type, TYPES, 'Jenis'), amountOf(b.amount),
    b.category_id ? idOf(b.category_id, 'Kategori') : null,
    idOf(b.wallet_id, 'Dompet'), dateOf(b.date), text(b.note),
  ];
  await own('wallets', v[3], uid, 'Dompet');
  if (v[2]) await own('categories', v[2], uid, 'Kategori');
  return v;
}

router.post('/transactions', wrap(async (req, res) => {
  const [row] = await q(
    'INSERT INTO transactions (user_id, type, amount, category_id, wallet_id, date, note) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [req.userId, ...(await txValues(req.userId, req.body))]);
  res.status(201).json(row);
}));

router.put('/transactions/:id', wrap(async (req, res) => {
  const rows = await q(
    'UPDATE transactions SET type=$1, amount=$2, category_id=$3, wallet_id=$4, date=$5, note=$6 WHERE id=$7 AND user_id=$8 RETURNING id',
    [...(await txValues(req.userId, req.body)), idOf(req.params.id), req.userId]);
  if (!rows.length) throw new HttpError(404, 'Transaksi tidak ditemukan');
  res.json({ ok: true });
}));

router.delete('/transactions/:id', wrap(async (req, res) => {
  await q('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [idOf(req.params.id), req.userId]);
  res.json({ ok: true });
}));

// ---------- impor mutasi ----------
// Berkas dibaca di browser (tidak diunggah). Server hanya menerima baris yang sudah dikoreksi pengguna, memeriksa duplikat, lalu menyimpan.
const MAX_IMPORT = 1000;
async function importPlan(uid, body) {
  const walletId = idOf(body.wallet_id, 'Dompet');
  await own('wallets', walletId, uid, 'Dompet');
  const items = Array.isArray(body.items) ? body.items : bad('Daftar transaksi tidak valid');
  if (!items.length || items.length > MAX_IMPORT) bad(`Jumlah transaksi harus 1 sampai ${MAX_IMPORT}`);
  const mine = new Set((await q('SELECT id FROM categories WHERE user_id = $1', [uid])).map((r) => r.id));
  const rows = items.map((it) => {
    const cid = it.category_id ? idOf(it.category_id, 'Kategori') : null;
    if (cid && !mine.has(cid)) bad('Kategori tidak ditemukan');
    return { type: oneOf(it.type, TYPES, 'Jenis'), amount: amountOf(it.amount), date: dateOf(it.date),
             note: text(it.note, 200), category_id: cid, force: it.force === true };
  });
  // Duplikat = di dompet yang sama sudah ada transaksi dengan tanggal, jenis, dan nominal yang sama.
  // Dicocokkan per jumlah: kalau sudah ada 1 dan berkas memuat 2, hanya 1 yang dianggap duplikat.
  const dates = rows.map((r) => r.date).sort();
  const have = new Map();
  const existing = await q(
    'SELECT type, amount, date FROM transactions WHERE user_id = $1 AND wallet_id = $2 AND date BETWEEN $3 AND $4',
    [uid, walletId, dates[0], dates[dates.length - 1]]);
  existing.forEach((r) => { const k = `${r.date}|${r.type}|${r.amount}`; have.set(k, (have.get(k) || 0) + 1); });
  const dup = rows.map((r) => {
    if (r.force) return false;
    const k = `${r.date}|${r.type}|${r.amount}`, n = have.get(k) || 0;
    if (n > 0) { have.set(k, n - 1); return true; }
    return false;
  });
  return { walletId, rows, dup };
}

router.post('/import/check', wrap(async (req, res) => {
  const { dup } = await importPlan(req.userId, req.body);
  res.json({ duplicates: dup });
}));

router.post('/import/commit', wrap(async (req, res) => {
  const { walletId, rows, dup } = await importPlan(req.userId, req.body);
  const ins = rows.filter((_, i) => !dup[i]);
  if (ins.length) {
    await q(
      `INSERT INTO transactions (user_id, type, amount, category_id, wallet_id, date, note, source)
       SELECT $1::int, t.type, t.amount, t.cat, $2::int, t.date, t.note, 'import'
       FROM unnest($3::text[], $4::bigint[], $5::int[], $6::date[], $7::text[]) AS t(type, amount, cat, date, note)`,
      [req.userId, walletId, ins.map((r) => r.type), ins.map((r) => r.amount), ins.map((r) => r.category_id),
       ins.map((r) => r.date), ins.map((r) => r.note)]);
  }
  res.status(201).json({ inserted: ins.length, skipped: rows.length - ins.length });
}));

// ---------- dompet & transfer ----------
router.get('/wallets', wrap(async (req, res) => {
  const month = monthOf(req.query.month);
  const [s, e] = bounds(month);
  const wallets = await R.wallets(req.userId, month);
  const transfers = await q(
    'SELECT id, from_wallet, to_wallet, amount, date, note FROM transfers WHERE user_id = $3 AND date >= $1 AND date < $2 ORDER BY date DESC, id DESC',
    [s, e, req.userId]);
  const [dep] = await q('SELECT COALESCE(SUM(amount), 0) AS total FROM goal_deposits WHERE user_id = $3 AND date >= $1 AND date < $2', [s, e, req.userId]);
  const sum = (k) => wallets.reduce((a, w) => a + w[k], 0);
  res.json({
    month, wallets, transfers,
    totals: { balance: sum('balance'), income: sum('income'), expense: sum('expense'), saved: dep.total,
              net: sum('income') - sum('expense') - dep.total },
  });
}));

const walletNameTaken = async (uid, name, exceptId = null) =>
  (await q('SELECT 1 FROM wallets WHERE user_id = $1 AND lower(name) = lower($2) AND ($3::int IS NULL OR id <> $3)', [uid, name, exceptId])).length > 0;

router.post('/wallets', wrap(async (req, res) => {
  const name = text(req.body.name, 40);
  if (!name) bad('Nama dompet wajib diisi');
  const open = Number(req.body.opening_balance || 0);
  if (!Number.isInteger(open)) bad('Saldo awal harus bilangan bulat');
  if (await walletNameTaken(req.userId, name)) throw new HttpError(409, 'Nama dompet sudah dipakai');
  const [row] = await q('INSERT INTO wallets (user_id, name, kind, opening_balance) VALUES ($1,$2,$3,$4) RETURNING id',
    [req.userId, name, oneOf(req.body.kind, KINDS, 'Jenis dompet'), open]);
  res.status(201).json(row);
}));

router.put('/wallets/:id', wrap(async (req, res) => {
  const name = text(req.body.name, 40);
  const open = Number(req.body.opening_balance || 0);
  if (!name || !Number.isInteger(open)) bad('Nama atau saldo awal tidak valid');
  const wid = idOf(req.params.id, 'Dompet');
  if (!(await q('SELECT 1 FROM wallets WHERE id = $1 AND user_id = $2', [wid, req.userId])).length) throw new HttpError(404, 'Dompet tidak ditemukan');
  if (await walletNameTaken(req.userId, name, wid)) throw new HttpError(409, 'Nama dompet sudah dipakai');
  const rows = await q('UPDATE wallets SET name=$1, kind=$2, opening_balance=$3 WHERE id=$4 AND user_id=$5 RETURNING id',
    [name, oneOf(req.body.kind, KINDS, 'Jenis dompet'), open, wid, req.userId]);
  if (!rows.length) throw new HttpError(404, 'Dompet tidak ditemukan');
  res.json({ ok: true });
}));

router.delete('/wallets/:id', wrap(async (req, res) => {
  const wid = idOf(req.params.id, 'Dompet');
  if (!(await q('SELECT 1 FROM wallets WHERE id = $1 AND user_id = $2', [wid, req.userId])).length) throw new HttpError(404, 'Dompet tidak ditemukan');
  const [n] = await q('SELECT COUNT(*)::int AS n FROM wallets WHERE user_id = $1', [req.userId]);
  if (n.n <= 1) throw new HttpError(409, 'Minimal harus ada satu dompet');
  try {
    await q('DELETE FROM wallets WHERE id = $1 AND user_id = $2', [wid, req.userId]);
  } catch (e) {
    if (e.code === '23503') throw new HttpError(409, 'Dompet masih dipakai transaksi, transfer, atau setoran');
    throw e;
  }
  res.json({ ok: true });
}));

router.post('/transfers', wrap(async (req, res) => {
  const from = idOf(req.body.from_wallet, 'Dompet asal');
  const to = idOf(req.body.to_wallet, 'Dompet tujuan');
  if (from === to) bad('Dompet asal dan tujuan harus berbeda');
  const amount = amountOf(req.body.amount);
  await own('wallets', from, req.userId, 'Dompet asal');
  await own('wallets', to, req.userId, 'Dompet tujuan');
  await needBalance(req.userId, from, amount);
  const [row] = await q(
    'INSERT INTO transfers (user_id, from_wallet, to_wallet, amount, date, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [req.userId, from, to, amount, dateOf(req.body.date), text(req.body.note) || 'Transfer']);
  res.status(201).json(row);
}));

router.delete('/transfers/:id', wrap(async (req, res) => {
  await q('DELETE FROM transfers WHERE id = $1 AND user_id = $2', [idOf(req.params.id), req.userId]);
  res.json({ ok: true });
}));

// ---------- budget ----------
router.get('/budgets', wrap(async (req, res) => {
  const month = monthOf(req.query.month);
  res.json({ month, items: await R.budgets(req.userId, month) });
}));

router.get('/budgets/suggest', wrap(async (req, res) => {
  res.json(await R.budgetSuggest(req.userId, monthOf(req.query.month)));
}));

router.put('/budgets', wrap(async (req, res) => {
  const month = monthOf(req.body.month);
  const items = Array.isArray(req.body.items) ? req.body.items : bad('Daftar budget tidak valid');
  const mine = new Set((await q('SELECT id FROM categories WHERE user_id = $1', [req.userId])).map((r) => r.id));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const it of items) {
      const amount = Number(it.amount || 0);
      if (!Number.isInteger(amount) || amount < 0) bad('Nominal budget tidak valid');
      const cid = idOf(it.category_id, 'Kategori');
      if (!mine.has(cid)) bad('Kategori tidak ditemukan');
      await client.query(
        `INSERT INTO budgets (user_id, category_id, month, amount) VALUES ($1,$2,$3,$4)
         ON CONFLICT (category_id, month) DO UPDATE SET amount = EXCLUDED.amount`,
        [req.userId, cid, month, amount]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  res.json({ ok: true });
}));

// ---------- target tabungan ----------
router.get('/goals', wrap(async (req, res) => res.json(await R.goals(req.userId))));

// Isian target tabungan (dipakai saat buat dan saat ubah)
function goalBody(b) {
  const name = text(b.name, 40);
  if (!name) bad('Nama target wajib diisi');
  if (b.deadline && !/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.deadline))) bad('Tenggat tidak valid (format YYYY-MM)');
  const saved = Number(b.saved_before || 0);
  if (!Number.isInteger(saved) || saved < 0) bad('Tabungan awal tidak valid');
  return [name, text(b.emoji, 4) || '🎯', amountOf(b.target, 'Target'), saved, b.deadline || null];
}

router.post('/goals', wrap(async (req, res) => {
  const [row] = await q(
    'INSERT INTO goals (user_id, name, emoji, target, saved_before, deadline) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [req.userId, ...goalBody(req.body)]);
  res.status(201).json(row);
}));

// Ubah target. Setoran yang sudah tercatat tidak berubah; hanya nama, ikon, nominal target, tabungan awal, dan tenggat.
router.put('/goals/:id', wrap(async (req, res) => {
  const rows = await q(
    'UPDATE goals SET name = $1, emoji = $2, target = $3, saved_before = $4, deadline = $5 WHERE id = $6 AND user_id = $7 RETURNING id',
    [...goalBody(req.body), idOf(req.params.id, 'Target'), req.userId]);
  if (!rows.length) throw new HttpError(404, 'Target tidak ditemukan');
  res.json({ ok: true });
}));

router.delete('/goals/:id', wrap(async (req, res) => {
  await q('DELETE FROM goals WHERE id = $1 AND user_id = $2', [idOf(req.params.id), req.userId]);
  res.json({ ok: true });
}));

router.post('/goals/:id/deposits', wrap(async (req, res) => {
  const goalId = idOf(req.params.id, 'Target');
  const walletId = idOf(req.body.wallet_id, 'Dompet');
  const amount = amountOf(req.body.amount, 'Setoran');
  await own('goals', goalId, req.userId, 'Target');
  await own('wallets', walletId, req.userId, 'Dompet');
  await needBalance(req.userId, walletId, amount);
  const [row] = await q(
    'INSERT INTO goal_deposits (user_id, goal_id, wallet_id, amount, date, note) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [req.userId, goalId, walletId, amount, dateOf(req.body.date), text(req.body.note) || 'Setoran']);
  res.status(201).json(row);
}));

// Riwayat setoran per target: lihat, ubah, hapus (untuk membetulkan salah input)
router.get('/goals/:id/deposits', wrap(async (req, res) => {
  const goalId = idOf(req.params.id, 'Target');
  await own('goals', goalId, req.userId, 'Target');
  res.json(await q(
    `SELECT d.id, d.wallet_id, w.name AS wallet, d.amount, d.date, d.note
     FROM goal_deposits d JOIN wallets w ON w.id = d.wallet_id
     WHERE d.goal_id = $1 AND d.user_id = $2 ORDER BY d.date DESC, d.id DESC`, [goalId, req.userId]));
}));

router.put('/goals/:id/deposits/:depId', wrap(async (req, res) => {
  const goalId = idOf(req.params.id, 'Target'), depId = idOf(req.params.depId, 'Setoran');
  const walletId = idOf(req.body.wallet_id, 'Dompet');
  const amount = amountOf(req.body.amount, 'Setoran'), date = dateOf(req.body.date), note = text(req.body.note) || 'Setoran';
  const [old] = await q('SELECT wallet_id, amount FROM goal_deposits WHERE id = $1 AND goal_id = $2 AND user_id = $3', [depId, goalId, req.userId]);
  if (!old) throw new HttpError(404, 'Setoran tidak ditemukan');
  await own('wallets', walletId, req.userId, 'Dompet');
  // Saldo yang bisa dipakai = saldo sekarang, ditambah setoran lama kalau dompetnya sama (karena setoran lama akan diganti)
  const avail = (await R.balanceOf(req.userId, walletId)) + (walletId === old.wallet_id ? old.amount : 0);
  if (avail < amount) throw new HttpError(400, `Saldo dompet tidak cukup (tersedia ${rp(avail)})`);
  await q('UPDATE goal_deposits SET wallet_id = $1, amount = $2, date = $3, note = $4 WHERE id = $5', [walletId, amount, date, note, depId]);
  res.json({ ok: true });
}));

router.delete('/goals/:id/deposits/:depId', wrap(async (req, res) => {
  const rows = await q('DELETE FROM goal_deposits WHERE id = $1 AND goal_id = $2 AND user_id = $3 RETURNING id',
    [idOf(req.params.depId, 'Setoran'), idOf(req.params.id, 'Target'), req.userId]);
  if (!rows.length) throw new HttpError(404, 'Setoran tidak ditemukan');
  res.json({ ok: true });
}));

// ---------- laporan ----------
router.get('/reports/monthly', wrap(async (req, res) => {
  const month = monthOf(req.query.month);
  const [cur, prev] = await Promise.all([R.monthReport(req.userId, month), R.monthReport(req.userId, shiftMonth(month, -1))]);
  res.json({ ...cur, prevExpense: prev.expense, prevByCategory: prev.byCategory });
}));

router.get('/reports/trend', wrap(async (req, res) => {
  const n = Math.min(Math.max(Number(req.query.months) || 6, 2), 24);
  res.json(await R.trend(req.userId, monthOf(req.query.month), n));
}));

router.get('/reports/weekday', wrap(async (req, res) => res.json(await R.weekday(req.userId, monthOf(req.query.month)))));

router.get('/export/csv', wrap(async (req, res) => sendCsv(res, req.userId, monthOf(req.query.month))));
router.get('/export/pdf', wrap(async (req, res) => sendPdf(res, req.userId, monthOf(req.query.month))));
