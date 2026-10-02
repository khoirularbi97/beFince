import { q } from './db.js';
import { bounds, lastDay, todayStr, APP_TZ, timeExpr } from './util.js';

// Semua fungsi menerima `uid` (id pengguna) sebagai argumen pertama dan hanya membaca data milik pengguna itu.

// Saldo dompet = saldo awal + pemasukan - pengeluaran +/- transfer - setoran tabungan,
// dihitung sampai akhir bulan yang diminta ($2). $1..$2 = rentang bulan untuk angka masuk/keluar. $3 = pengguna.
const walletSql = (extra = '') => `
  SELECT w.id, w.name, w.kind, w.opening_balance,
    w.opening_balance
      + COALESCE((SELECT SUM(CASE WHEN t.type='income' THEN t.amount ELSE -t.amount END) FROM transactions t WHERE t.wallet_id = w.id AND t.date < $2), 0)
      + COALESCE((SELECT SUM(x.amount) FROM transfers x WHERE x.to_wallet = w.id AND x.date < $2), 0)
      - COALESCE((SELECT SUM(x.amount) FROM transfers x WHERE x.from_wallet = w.id AND x.date < $2), 0)
      - COALESCE((SELECT SUM(d.amount) FROM goal_deposits d WHERE d.wallet_id = w.id AND d.date < $2), 0) AS balance,
    (SELECT COUNT(*) FROM transactions t WHERE t.wallet_id = w.id) + (SELECT COUNT(*) FROM transfers x WHERE x.from_wallet = w.id OR x.to_wallet = w.id)
      + (SELECT COUNT(*) FROM goal_deposits d WHERE d.wallet_id = w.id) AS uses,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.wallet_id = w.id AND t.type='income' AND t.date >= $1 AND t.date < $2), 0) AS income,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.wallet_id = w.id AND t.type='expense' AND t.date >= $1 AND t.date < $2), 0) AS expense
  FROM wallets w WHERE w.user_id = $3 ${extra} ORDER BY w.id`;

export const wallets = (uid, month) => {
  const [s, e] = bounds(month);
  return q(walletSql(), [s, e, uid]);
};
export const balanceOf = async (uid, id) =>
  (await q(walletSql('AND w.id = $4'), ['0001-01-01', '9999-12-31', uid, id]))[0]?.balance;

export async function monthReport(uid, month) {
  const [s, e] = bounds(month);
  const days = Number(lastDay(month).slice(8));
  const [tot] = await q(
    `SELECT COALESCE(SUM(amount) FILTER (WHERE type='income'), 0) AS income,
            COALESCE(SUM(amount) FILTER (WHERE type='expense'), 0) AS expense
     FROM transactions WHERE user_id = $3 AND date >= $1 AND date < $2`, [s, e, uid]);
  const byCategory = await q(
    `SELECT COALESCE(c.name, 'Tanpa kategori') AS name, SUM(t.amount) AS total
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $3 AND t.type='expense' AND t.date >= $1 AND t.date < $2 GROUP BY 1 ORDER BY total DESC`, [s, e, uid]);
  const dr = await q(
    `SELECT EXTRACT(DAY FROM date)::int AS day, SUM(amount) AS total
     FROM transactions WHERE user_id = $3 AND type='expense' AND date >= $1 AND date < $2 GROUP BY 1`, [s, e, uid]);
  const daily = Array(days).fill(0);
  dr.forEach((r) => { daily[r.day - 1] = r.total; });
  return { month, income: tot.income, expense: tot.expense, balance: tot.income - tot.expense, byCategory, daily };
}

export async function trend(uid, month, n = 6) {
  const [s] = bounds(month);
  return q(
    `SELECT to_char(m, 'YYYY-MM') AS month,
            COALESCE(SUM(t.amount) FILTER (WHERE t.type='income'), 0) AS income,
            COALESCE(SUM(t.amount) FILTER (WHERE t.type='expense'), 0) AS expense
     FROM generate_series($1::date - make_interval(months => $2::int - 1), $1::date, '1 month') m
     LEFT JOIN transactions t ON t.user_id = $3 AND date_trunc('month', t.date) = date_trunc('month', m)
     GROUP BY m ORDER BY m`, [s, n, uid]);
}

export async function weekday(uid, month) {
  const [s, e] = bounds(month);
  const until = lastDay(month) < todayStr() ? lastDay(month) : todayStr();
  const tot = await q(
    `SELECT EXTRACT(ISODOW FROM date)::int AS dow, SUM(amount) AS total
     FROM transactions WHERE user_id = $3 AND type='expense' AND date >= $1 AND date < $2 GROUP BY 1`, [s, e, uid]);
  const cnt = await q(
    `SELECT EXTRACT(ISODOW FROM d)::int AS dow, COUNT(*) AS days
     FROM generate_series($1::date, $2::date, '1 day') d GROUP BY 1`, [s, until]);
  const total = Array(7).fill(0), days = Array(7).fill(0);
  tot.forEach((r) => { total[r.dow - 1] = r.total; });
  cnt.forEach((r) => { days[r.dow - 1] = r.days; });
  return { month, total, days, avg: total.map((t, i) => (days[i] ? t / days[i] : 0)) };
}

// Budget bulan ini = budget terakhir yang diatur sampai bulan tersebut (otomatis mewarisi bulan sebelumnya)
export async function budgets(uid, month) {
  const [s, e] = bounds(month);
  return q(
    `SELECT c.id AS category_id, c.name, b.amount AS budget, COALESCE(sp.spent, 0) AS spent
     FROM categories c
     LEFT JOIN LATERAL (SELECT amount FROM budgets WHERE category_id = c.id AND month <= $1 ORDER BY month DESC LIMIT 1) b ON true
     LEFT JOIN (SELECT category_id, SUM(amount) AS spent FROM transactions
                WHERE user_id = $4 AND type='expense' AND date >= $2 AND date < $3 GROUP BY 1) sp ON sp.category_id = c.id
     WHERE c.user_id = $4 AND c.type = 'expense' ORDER BY c.id`, [month, s, e, uid]);
}

export const budgetSuggest = (uid, month) => {
  const [s] = bounds(month);
  return q(
    `SELECT c.id AS category_id, c.name,
            COALESCE(ROUND(SUM(t.amount) / 3.0), 0) AS avg
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id AND t.type='expense'
          AND t.date >= $1::date - interval '3 months' AND t.date < $1::date
     WHERE c.user_id = $2 AND c.type = 'expense' GROUP BY c.id ORDER BY c.id`, [s, uid]);
};

export const goals = (uid) =>
  q(`SELECT g.id, g.name, g.emoji, g.target, g.deadline,
            g.saved_before, g.saved_before + COALESCE(d.total, 0) AS saved,
            ROUND(COALESCE(d.recent, 0) / 3.0) AS pace, COALESCE(d.n, 0) AS deposits
     FROM goals g
     LEFT JOIN (SELECT goal_id, SUM(amount) AS total, COUNT(*) AS n,
                       SUM(amount) FILTER (WHERE date > CURRENT_DATE - 90) AS recent
                FROM goal_deposits WHERE user_id = $1 GROUP BY 1) d ON d.goal_id = g.id
     WHERE g.user_id = $1 ORDER BY g.id`, [uid]);

export const transactions = (uid, month) => {
  const [s, e] = bounds(month);
  return q(
    `SELECT t.date, ${timeExpr('$4')} AS "time", t.type, c.name AS category, w.name AS wallet, t.note, t.amount
     FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
     JOIN wallets w ON w.id = t.wallet_id
     WHERE t.user_id = $3 AND t.date >= $1 AND t.date < $2 ORDER BY t.date, "time", t.id`, [s, e, uid, APP_TZ]);
};
