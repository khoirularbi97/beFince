import { Router } from 'express';
import { q, pool } from './db.js';
import * as R from './queries.js';
import { sendCsv, sendPdf } from './export.js';
import {
  HttpError, bad, wrap, monthOf, bounds, lastDay, shiftMonth, dateOf,
  amountOf, idOf, oneOf, rp, text,
} from './util.js';

// Semua rute di sini sudah lewat requireAuth, jadi req.userId selalu ada.
export const router = Router();
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

router.post('/categories', wrap(async (req, res) => {
  const name = text(req.body.name, 40);
  if (!name) bad('Nama kategori wajib diisi');
  const rows = await q(
    'INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id, name, type',
    [req.userId, name, oneOf(req.body.type, TYPES, 'Tipe')]);
  res.status(201).json(rows[0] || {});
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
  const rows = await q(
    `SELECT t.id, t.type, t.amount, t.category_id, c.name AS category, t.wallet_id, w.name AS wallet,
            t.date, t.note
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     JOIN wallets w ON w.id = t.wallet_id
     WHERE ${where.join(' AND ')} ORDER BY t.date DESC, t.id DESC LIMIT ${limit}`, p);
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

router.post('/wallets', wrap(async (req, res) => {
  const name = text(req.body.name, 40);
  if (!name) bad('Nama dompet wajib diisi');
  const open = Number(req.body.opening_balance || 0);
  if (!Number.isInteger(open)) bad('Saldo awal harus bilangan bulat');
  const [row] = await q('INSERT INTO wallets (user_id, name, kind, opening_balance) VALUES ($1,$2,$3,$4) RETURNING id',
    [req.userId, name, oneOf(req.body.kind, KINDS, 'Jenis dompet'), open]);
  res.status(201).json(row);
}));

router.put('/wallets/:id', wrap(async (req, res) => {
  const name = text(req.body.name, 40);
  const open = Number(req.body.opening_balance || 0);
  if (!name || !Number.isInteger(open)) bad('Nama atau saldo awal tidak valid');
  const rows = await q('UPDATE wallets SET name=$1, kind=$2, opening_balance=$3 WHERE id=$4 AND user_id=$5 RETURNING id',
    [name, oneOf(req.body.kind, KINDS, 'Jenis dompet'), open, idOf(req.params.id), req.userId]);
  if (!rows.length) throw new HttpError(404, 'Dompet tidak ditemukan');
  res.json({ ok: true });
}));

router.delete('/wallets/:id', wrap(async (req, res) => {
  try {
    await q('DELETE FROM wallets WHERE id = $1 AND user_id = $2', [idOf(req.params.id), req.userId]);
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

router.post('/goals', wrap(async (req, res) => {
  const name = text(req.body.name, 40);
  if (!name) bad('Nama target wajib diisi');
  const deadline = req.body.deadline ? monthOf(req.body.deadline) : null;
  const saved = Number(req.body.saved_before || 0);
  if (!Number.isInteger(saved) || saved < 0) bad('Tabungan awal tidak valid');
  const [row] = await q(
    'INSERT INTO goals (user_id, name, emoji, target, saved_before, deadline) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
    [req.userId, name, text(req.body.emoji, 4) || '🎯', amountOf(req.body.target, 'Target'), saved, deadline]);
  res.status(201).json(row);
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
