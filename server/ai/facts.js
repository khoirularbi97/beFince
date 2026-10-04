// Menghitung "fakta" keuangan dari data mentah. Semua angka di analisa berasal dari sini, bukan dari model.
// Murni JavaScript: masukan berupa array biasa, jadi bisa dipakai server (data dari database) dan pratinjau (data contoh).
import { fmtVal } from './format.js';

const pad = (n) => String(n).padStart(2, '0');
const shift = (m, k) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1 + k, 1)).toISOString().slice(0, 7);
const daysIn = (m) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate();
const isoDow = (d) => new Date(d + 'T00:00:00Z').getUTCDay() || 7;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
// Nama buatan pengguna masuk ke prompt sebagai data: bersihkan karakter aneh dan batasi panjang
export const safeName = (s) => String(s ?? '').replace(/[^\p{L}\p{N} &().,'/-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Tanpa nama';

export function buildFacts({ month, today, tx, categories, wallets, goals, budgets }) {
  const facts = [];
  const add = (key, label, type, value) => {
    if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) return;
    facts.push({ key, label, type, value, text: type === 'text' || type === 'count' ? String(value) : fmtVal(type, value) });
  };
  const months = [-5, -4, -3, -2, -1, 0].map((k) => shift(month, k));
  const agg = Object.fromEntries(months.map((m) => [m, { income: 0, expense: 0, n: 0, cat: {} }]));
  const catName = new Map(categories.map((c) => [c.id, safeName(c.name)]));
  for (const t of tx) {
    const a = agg[t.date.slice(0, 7)];
    if (!a) continue;
    a.n++;
    if (t.type === 'income') a.income += t.amount;
    else { a.expense += t.amount; const k = t.category_id ?? 0; a.cat[k] = (a.cat[k] || 0) + t.amount; }
  }
  const cur = agg[month], prev = agg[shift(month, -1)];
  const base = months.slice(0, 5).filter((m) => agg[m].n > 0).slice(-3);
  const avgExpense = base.length ? mean(base.map((m) => agg[m].expense).filter((x) => x > 0)) || cur.expense : cur.expense;
  const avgIncome = base.length ? mean(base.map((m) => agg[m].income).filter((x) => x > 0)) || cur.income : cur.income;
  const n3 = months.slice(3).reduce((a, m) => a + agg[m].n, 0);

  const net = cur.income - cur.expense;
  add('income', 'Pemasukan bulan ini', 'rp', cur.income);
  add('expense', 'Pengeluaran bulan ini', 'rp', cur.expense);
  add('net', 'Sisa uang bulan ini', 'rp', net);
  add('net_abs', 'Selisih pemasukan dan pengeluaran', 'rp', Math.abs(net));
  if (cur.income > 0) add('savings_rate', 'Porsi pemasukan yang tersisa', 'pct', net / cur.income);
  if (prev.expense > 0) { add('expense_prev', 'Pengeluaran bulan lalu', 'rp', prev.expense); add('expense_change', 'Perubahan pengeluaran dari bulan lalu', 'pcts', (cur.expense - prev.expense) / prev.expense); }
  add('avg_expense', 'Rata-rata pengeluaran bulanan (3 bulan terakhir yang ada datanya)', 'rp', avgExpense);
  add('avg_income', 'Rata-rata pemasukan bulanan (3 bulan terakhir yang ada datanya)', 'rp', avgIncome);
  add('months_data', 'Jumlah bulan yang punya data (dari 6 bulan terakhir)', 'count', months.filter((m) => agg[m].n > 0).length);
  const incomes = months.filter((m) => agg[m].income > 0).map((m) => agg[m].income);
  if (incomes.length >= 3) { const mu = mean(incomes); add('income_cv', 'Sebaran pemasukan antar bulan', 'pct', Math.sqrt(mean(incomes.map((x) => (x - mu) ** 2))) / mu); }

  // kategori pengeluaran terbesar
  const ranked = Object.entries(cur.cat).map(([id, amount]) => ({ id: +id, amount })).sort((a, b) => b.amount - a.amount);
  const named = ranked.filter((c) => c.id !== 0).slice(0, 5);
  named.forEach((c, i) => {
    add(`cat${i}_name`, `Kategori pengeluaran terbesar ke-${i + 1}`, 'text', catName.get(c.id) || 'Tanpa nama');
    add(`cat${i}_amount`, `Pengeluaran kategori ke-${i + 1}`, 'rp', c.amount);
    add(`cat${i}_share`, `Porsi kategori ke-${i + 1} dari total pengeluaran`, 'pct', cur.expense ? c.amount / cur.expense : 0);
    const p = prev.cat[c.id] || 0;
    if (p > 0) { add(`cat${i}_prev`, `Pengeluaran kategori ke-${i + 1} bulan lalu`, 'rp', p); add(`cat${i}_change`, `Perubahan kategori ke-${i + 1}`, 'pcts', (c.amount - p) / p); }
  });
  if (cur.cat[0]) { add('uncat_amount', 'Pengeluaran tanpa kategori', 'rp', cur.cat[0]); add('uncat_share', 'Porsi pengeluaran tanpa kategori', 'pct', cur.cat[0] / cur.expense); }

  // budget
  const withBudget = budgets.filter((b) => b.budget > 0);
  if (withBudget.length) {
    const tb = withBudget.reduce((a, b) => a + b.budget, 0), tu = withBudget.reduce((a, b) => a + b.spent, 0);
    add('budget_total', 'Total budget bulan ini', 'rp', tb);
    add('budget_used', 'Porsi budget yang terpakai', 'pct', tu / tb);
    add('budget_left', 'Sisa budget', 'rp', tb - tu);
    const over = withBudget.filter((b) => b.spent > b.budget).sort((a, b) => b.spent - b.budget - (a.spent - a.budget));
    add('over_count', 'Jumlah kategori yang melewati budget', 'count', over.length);
    over.slice(0, 3).forEach((b, i) => { add(`over${i}_name`, `Kategori melewati budget ke-${i + 1}`, 'text', safeName(b.name)); add(`over${i}_amount`, `Kelebihan kategori ke-${i + 1} dari budget`, 'rp', b.spent - b.budget); });
  }

  // proyeksi akhir bulan (hanya untuk bulan berjalan)
  const dim = daysIn(month), dom = +today.slice(8);
  if (today.slice(0, 7) === month && dom >= 3 && dom < dim && cur.expense > 0) {
    const proj = (cur.expense / dom) * dim;
    add('proj_expense', 'Perkiraan pengeluaran akhir bulan', 'rp', Math.round(proj));
    if (facts.some((f) => f.key === 'budget_total')) add('proj_gap', 'Perkiraan kelebihan dari budget', 'rp', Math.round(proj - facts.find((f) => f.key === 'budget_total').value));
  }

  // akhir pekan vs hari kerja (rata-rata per hari)
  const until = today.slice(0, 7) === month ? Math.min(dom, dim) : today.slice(0, 7) > month ? dim : 0;
  if (until >= 7) {
    let we = 0, wd = 0, weDays = 0, wdDays = 0;
    for (let d = 1; d <= until; d++) (isoDow(`${month}-${pad(d)}`) >= 6 ? weDays++ : wdDays++);
    for (const t of tx) if (t.type === 'expense' && t.date.slice(0, 7) === month && +t.date.slice(8) <= until) (isoDow(t.date) >= 6 ? (we += t.amount) : (wd += t.amount));
    if (weDays && wdDays && wd > 0) {
      const a = we / weDays, b = wd / wdDays;
      add('weekend_avg', 'Rata-rata pengeluaran per hari di akhir pekan', 'rp', Math.round(a));
      add('weekday_avg', 'Rata-rata pengeluaran per hari di hari kerja', 'rp', Math.round(b));
      add('weekend_ratio', 'Selisih akhir pekan terhadap hari kerja', 'pcts', (a - b) / b);
    }
  }

  // dompet dan dana cadangan
  const total = wallets.reduce((a, w) => a + w.balance, 0);
  add('total_balance', 'Total saldo semua dompet', 'rp', total);
  [...wallets].sort((a, b) => b.balance - a.balance).slice(0, 4).forEach((w, i) => {
    add(`wallet${i}_name`, `Dompet ke-${i + 1}`, 'text', safeName(w.name));
    add(`wallet${i}_balance`, `Saldo dompet ke-${i + 1}`, 'rp', w.balance);
  });
  if (avgExpense > 0) {
    add('runway', 'Lama saldo bertahan dengan pengeluaran rata-rata', 'months', total / avgExpense);
    add('emergency_target', 'Dana darurat 3 bulan pengeluaran (pedoman umum)', 'rp', Math.round(avgExpense * 3));
    add('emergency_gap', 'Kekurangan dari dana darurat 3 bulan', 'rp', Math.max(0, Math.round(avgExpense * 3 - total)));
  }
  if (avgIncome > 0) { add('save_10', '10% dari rata-rata pemasukan', 'rp', Math.round(avgIncome * 0.1)); add('save_20', '20% dari rata-rata pemasukan', 'rp', Math.round(avgIncome * 0.2)); }

  // target tabungan
  add('goal_count', 'Jumlah target tabungan', 'count', goals.length);
  const ty = +today.slice(0, 4) * 12 + +today.slice(5, 7);
  add('goal_done_count', 'Target tabungan yang sudah tercapai', 'count', goals.filter((g) => g.saved >= g.target).length);
  goals.slice(0, 3).forEach((g, i) => {
    add(`goal${i}_name`, `Target tabungan ke-${i + 1}`, 'text', safeName(g.name));
    add(`goal${i}_pct`, `Kemajuan target ke-${i + 1}`, 'pct', g.target ? Math.min(1, g.saved / g.target) : 0);
    add(`goal${i}_saved`, `Terkumpul untuk target ke-${i + 1}`, 'rp', g.saved);
    add(`goal${i}_target`, `Nominal target ke-${i + 1}`, 'rp', g.target);
    add(`goal${i}_pace`, `Laju menabung per bulan (3 bulan terakhir) untuk target ke-${i + 1}`, 'rp', g.pace || 0);
    if (g.deadline && g.target > g.saved) {
      const left = +g.deadline.slice(0, 4) * 12 + +g.deadline.slice(5, 7) - ty;
      if (left >= 1) add(`goal${i}_need`, `Perlu ditabung per bulan untuk target ke-${i + 1}`, 'rp', Math.ceil((g.target - g.saved) / left));
    }
  });

  // tiga pengeluaran tunggal terbesar (tanpa catatan, hanya kategori, nominal, dan tanggal)
  tx.filter((t) => t.type === 'expense' && t.date.slice(0, 7) === month).sort((a, b) => b.amount - a.amount).slice(0, 3).forEach((t, i) => {
    add(`big${i}_amount`, `Pengeluaran tunggal terbesar ke-${i + 1}`, 'rp', t.amount);
    add(`big${i}_cat`, `Kategori pengeluaran terbesar ke-${i + 1}`, 'text', catName.get(t.category_id) || 'Tanpa kategori');
  });

  const by = new Map(facts.map((f) => [f.key, f]));
  return { facts, by, enough: n3 >= 8, count3m: n3, month };
}

// Sidik jari fakta: kalau tidak berubah, laporan AI sebelumnya dipakai ulang (tanpa panggilan baru)
export function factsKey(f) {
  const s = JSON.stringify(f.facts.map((x) => [x.key, x.value]));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${f.month}:${(h >>> 0).toString(36)}:${s.length}`;
}
