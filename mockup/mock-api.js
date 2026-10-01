// Backend tiruan di dalam halaman: meniru API beFince dengan data contoh, supaya desain asli bisa dicoba tanpa server.
import SEED from './seed.json';

const MOCK_TODAY = '2026-09-30'; // "hari ini" dalam pratinjau
window.__MOCK_TODAY__ = MOCK_TODAY;

const S = JSON.parse(JSON.stringify(SEED));
let { transactions: T, transfers: TR, budgets: BUD, goals: G, goal_deposits: D } = S;
const W = S.wallets, C = S.categories;
const nid = { tx: Math.max(...T.map((x) => x.id)) + 1, tr: Math.max(...TR.map((x) => x.id)) + 1, g: Math.max(...G.map((x) => x.id)) + 1, d: Math.max(...D.map((x) => x.id)) + 1 };

const pad = (n) => String(n).padStart(2, '0');
const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const shiftM = (m, k) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5) - 1 + k, 1)).toISOString().slice(0, 7);
const bounds = (m) => [m + '-01', shiftM(m, 1) + '-01'];
const lastDay = (m) => m + '-' + pad(new Date(Date.UTC(+m.slice(0, 4), +m.slice(5), 0)).getUTCDate());
const monthOf = (m) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(m || '') ? m : MOCK_TODAY.slice(0, 7));
const catName = (id) => C.find((c) => c.id === id)?.name ?? null;
const walletName = (id) => W.find((w) => w.id === id)?.name;
const inRange = (d, s, e) => d >= s && d < e;
const isoDow = (d) => new Date(d + 'T00:00:00Z').getUTCDay() || 7;

class HttpErr extends Error { constructor(s, m) { super(m); this.status = s; } }
const bad = (m) => { throw new HttpErr(400, m); };
const posInt = (v, label) => { const n = Number(v); if (!Number.isInteger(n) || n <= 0) bad(`${label} harus bilangan bulat lebih dari 0`); return n; };

// ---------- perhitungan (sama dengan query di server) ----------
function walletBal(id, end = '9999-12-31') {
  const w = W.find((x) => x.id === id);
  return w.opening_balance
    + sum(T.filter((t) => t.wallet_id === id && t.date < end), (t) => (t.type === 'income' ? t.amount : -t.amount))
    + sum(TR.filter((t) => t.to_wallet === id && t.date < end), (t) => t.amount)
    - sum(TR.filter((t) => t.from_wallet === id && t.date < end), (t) => t.amount)
    - sum(D.filter((t) => t.wallet_id === id && t.date < end), (t) => t.amount);
}
function needBalance(id, amount) {
  if (!W.some((w) => w.id === id)) bad('Dompet tidak ditemukan');
  const b = walletBal(id);
  if (b < amount) bad(`Saldo dompet tidak cukup (tersedia ${rp(b)})`);
}
function monthReport(m) {
  const [s, e] = bounds(m), tx = T.filter((t) => inRange(t.date, s, e));
  const exp = tx.filter((t) => t.type === 'expense');
  const income = sum(tx.filter((t) => t.type === 'income'), (t) => t.amount), expense = sum(exp, (t) => t.amount);
  const by = {};
  exp.forEach((t) => { const n = catName(t.category_id) || 'Tanpa kategori'; by[n] = (by[n] || 0) + t.amount; });
  const daily = Array(+lastDay(m).slice(8)).fill(0);
  exp.forEach((t) => { daily[+t.date.slice(8) - 1] += t.amount; });
  return { month: m, income, expense, balance: income - expense,
    byCategory: Object.entries(by).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total), daily };
}

// ---------- rute ----------
function route(method, path, p, body) {
  const m = monthOf(p.get('month'));
  let r;
  if (method === 'GET' && path === '/api/meta') return { wallets: W.map(({ id, name, kind }) => ({ id, name, kind })), categories: C };

  if (method === 'GET' && path === '/api/reports/monthly') {
    const cur = monthReport(m), prev = monthReport(shiftM(m, -1));
    return { ...cur, prevExpense: prev.expense, prevByCategory: prev.byCategory };
  }
  if (method === 'GET' && path === '/api/reports/trend') {
    const n = Math.min(Math.max(Number(p.get('months')) || 6, 2), 24);
    return Array.from({ length: n }, (_, i) => { const mm = shiftM(m, i - n + 1), x = monthReport(mm); return { month: mm, income: x.income, expense: x.expense }; });
  }
  if (method === 'GET' && path === '/api/reports/weekday') {
    const [s, e] = bounds(m), last = lastDay(m), until = last < MOCK_TODAY ? last : MOCK_TODAY;
    const total = Array(7).fill(0), days = Array(7).fill(0);
    T.filter((t) => t.type === 'expense' && inRange(t.date, s, e)).forEach((t) => { total[isoDow(t.date) - 1] += t.amount; });
    for (let d = s; d <= until; d = new Date(Date.parse(d + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10)) days[isoDow(d) - 1]++;
    return { month: m, total, days, avg: total.map((t, i) => (days[i] ? t / days[i] : 0)) };
  }

  if (path === '/api/transactions' && method === 'GET') {
    const from = p.get('from') || bounds(m)[0], to = p.get('to') || lastDay(m), kw = (p.get('q') || '').toLowerCase();
    const limit = Math.min(Number(p.get('limit')) || 500, 1000);
    return T.filter((t) => t.date >= from && t.date <= to
        && (!p.get('type') || t.type === p.get('type')) && (!p.get('category_id') || t.category_id === +p.get('category_id'))
        && (!p.get('wallet_id') || t.wallet_id === +p.get('wallet_id'))
        && (!kw || ((catName(t.category_id) || '') + ' ' + t.note).toLowerCase().includes(kw)))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)).slice(0, limit)
      .map((t) => ({ id: t.id, type: t.type, amount: t.amount, category_id: t.category_id, category: catName(t.category_id),
        wallet_id: t.wallet_id, wallet: walletName(t.wallet_id), date: t.date, note: t.note }));
  }
  if (path === '/api/transactions' && method === 'POST' || /^\/api\/transactions\/\d+$/.test(path) && method === 'PUT') {
    if (!['income', 'expense'].includes(body.type)) bad('Jenis tidak valid');
    const v = { type: body.type, amount: posInt(body.amount, 'Nominal'), category_id: body.category_id ? +body.category_id : null,
      wallet_id: +body.wallet_id, date: body.date, note: String(body.note || '').slice(0, 200) };
    if (!W.some((w) => w.id === v.wallet_id)) bad('Dompet tidak ditemukan');
    if (v.category_id && !C.some((c) => c.id === v.category_id)) bad('Kategori tidak ditemukan');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date || '')) bad('Tanggal tidak valid');
    if (method === 'POST') { T.push({ id: nid.tx, ...v }); return { id: nid.tx++, status: 201 }; }
    const t = T.find((x) => x.id === +path.split('/').pop());
    if (!t) throw new HttpErr(404, 'Transaksi tidak ditemukan');
    Object.assign(t, v); return { ok: true };
  }
  if (/^\/api\/transactions\/\d+$/.test(path) && method === 'DELETE') { const id = +path.split('/').pop(); T = T.filter((x) => x.id !== id); return { ok: true }; }

  if (method === 'GET' && path === '/api/wallets') {
    const [s, e] = bounds(m);
    const wallets = W.map((w) => {
      const tx = T.filter((t) => t.wallet_id === w.id && inRange(t.date, s, e));
      return { id: w.id, name: w.name, kind: w.kind, opening_balance: w.opening_balance, balance: walletBal(w.id, e),
        income: sum(tx.filter((t) => t.type === 'income'), (t) => t.amount), expense: sum(tx.filter((t) => t.type === 'expense'), (t) => t.amount) };
    });
    const transfers = TR.filter((t) => inRange(t.date, s, e)).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));
    const saved = sum(D.filter((d) => inRange(d.date, s, e)), (d) => d.amount), tot = (k) => sum(wallets, (w) => w[k]);
    return { month: m, wallets, transfers, totals: { balance: tot('balance'), income: tot('income'), expense: tot('expense'), saved, net: tot('income') - tot('expense') - saved } };
  }
  if (method === 'POST' && path === '/api/transfers') {
    const f = +body.from_wallet, t = +body.to_wallet, a = posInt(body.amount, 'Nominal');
    if (f === t) bad('Dompet asal dan tujuan harus berbeda');
    needBalance(f, a);
    if (!W.some((w) => w.id === t)) bad('Dompet tujuan tidak ditemukan');
    TR.push({ id: nid.tr, from_wallet: f, to_wallet: t, amount: a, date: body.date || MOCK_TODAY, note: String(body.note || '').trim() || 'Transfer' });
    return { id: nid.tr++, status: 201 };
  }
  if (method === 'DELETE' && /^\/api\/transfers\/\d+$/.test(path)) { const id = +path.split('/').pop(); TR = TR.filter((x) => x.id !== id); return { ok: true }; }

  if (method === 'GET' && path === '/api/budgets') {
    const [s, e] = bounds(m);
    return { month: m, items: C.filter((c) => c.type === 'expense').map((c) => {
      const row = BUD.filter((b) => b.category_id === c.id && b.month <= m).sort((a, b) => (a.month < b.month ? 1 : -1))[0];
      return { category_id: c.id, name: c.name, budget: row ? row.amount : null,
        spent: sum(T.filter((t) => t.type === 'expense' && t.category_id === c.id && inRange(t.date, s, e)), (t) => t.amount) };
    }) };
  }
  if (method === 'GET' && path === '/api/budgets/suggest') {
    const s = bounds(m)[0], from = shiftM(m, -3) + '-01';
    return C.filter((c) => c.type === 'expense').map((c) => ({ category_id: c.id, name: c.name,
      avg: Math.round(sum(T.filter((t) => t.type === 'expense' && t.category_id === c.id && inRange(t.date, from, s)), (t) => t.amount) / 3) }));
  }
  if (method === 'PUT' && path === '/api/budgets') {
    const mm = monthOf(body.month);
    (body.items || []).forEach((it) => {
      const amount = Number(it.amount || 0); if (!Number.isInteger(amount) || amount < 0) bad('Nominal budget tidak valid');
      const row = BUD.find((b) => b.category_id === +it.category_id && b.month === mm);
      if (row) row.amount = amount; else BUD.push({ category_id: +it.category_id, month: mm, amount });
    });
    return { ok: true };
  }

  if (method === 'GET' && path === '/api/goals') {
    const cut = new Date(Date.parse(MOCK_TODAY + 'T00:00:00Z') - 90 * 864e5).toISOString().slice(0, 10);
    return G.map((g) => { const ds = D.filter((d) => d.goal_id === g.id);
      return { id: g.id, name: g.name, emoji: g.emoji, target: g.target, deadline: g.deadline,
        saved: g.saved_before + sum(ds, (d) => d.amount), pace: Math.round(sum(ds.filter((d) => d.date > cut), (d) => d.amount) / 3) }; });
  }
  if (method === 'POST' && path === '/api/goals') {
    const name = String(body.name || '').trim().slice(0, 40); if (!name) bad('Nama target wajib diisi');
    G.push({ id: nid.g, name, emoji: String(body.emoji || '🎯').slice(0, 4), target: posInt(body.target, 'Target'),
      saved_before: Number(body.saved_before || 0), deadline: body.deadline || null });
    return { id: nid.g++, status: 201 };
  }
  if (method === 'DELETE' && /^\/api\/goals\/\d+$/.test(path)) { const id = +path.split('/').pop(); G = G.filter((g) => g.id !== id); D = D.filter((d) => d.goal_id !== id); return { ok: true }; }
  if (method === 'POST' && (r = /^\/api\/goals\/(\d+)\/deposits$/.exec(path))) {
    const gid = +r[1], wid = +body.wallet_id, a = posInt(body.amount, 'Setoran');
    if (!G.some((g) => g.id === gid)) bad('Target tidak ditemukan');
    needBalance(wid, a);
    D.push({ id: nid.d, goal_id: gid, wallet_id: wid, amount: a, date: body.date || MOCK_TODAY, note: String(body.note || '').trim() || 'Setoran' });
    return { id: nid.d++, status: 201 };
  }
  throw new HttpErr(404, 'Rute tidak ditemukan');
}

// ---------- login tiruan ----------
let curPw = null;
const mkToken = (name, email) => 'mock.' + btoa(unescape(encodeURIComponent(JSON.stringify({ name, email }))));
const readToken = (h) => {
  const t = /^Bearer mock\.(.+)$/.exec(h || '')?.[1];
  try { return t ? JSON.parse(decodeURIComponent(escape(atob(t)))) : null; } catch { return null; }
};
const nameOf = (email) => { const n = email.split('@')[0].replace(/[._-]+/g, ' ').trim(); return n ? n[0].toUpperCase() + n.slice(1) : 'Pengguna'; };

function toast(msg) {
  const el = Object.assign(document.createElement('div'), { className: 'mock-toast', textContent: msg, role: 'status' });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

const realFetch = window.fetch ? window.fetch.bind(window) : null;
window.fetch = async (url, opts = {}) => {
  if (!String(url).startsWith('http://mock')) return realFetch ? realFetch(url, opts) : Promise.reject(new TypeError('offline'));
  await new Promise((r) => setTimeout(r, 70));
  const u = new URL(url), path = u.pathname, method = (opts.method || 'GET').toUpperCase();
  const body = opts.body ? JSON.parse(opts.body) : {};
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  try {
    if (path === '/api/auth/login') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email.includes('@') || !body.password) throw new HttpErr(401, 'Email atau kata sandi salah');
      curPw = String(body.password); const name = nameOf(email);
      return json({ token: mkToken(name, email), user: { id: 1, name, email } });
    }
    if (path === '/api/auth/register') {
      const email = String(body.email || '').trim().toLowerCase(), name = String(body.name || '').trim();
      if (!name) bad('Nama wajib diisi');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('Format email tidak valid');
      if (String(body.password || '').length < 8) bad('Kata sandi minimal 8 karakter');
      curPw = String(body.password);
      return json({ token: mkToken(name, email), user: { id: 1, name, email } }, 201);
    }
    const me = readToken(opts.headers && opts.headers.Authorization);
    if (!me) throw new HttpErr(401, 'Sesi berakhir, silakan masuk lagi');
    if (path === '/api/auth/me') return json({ id: 1, ...me });
    if (path === '/api/auth/password' && method === 'PUT') {
      if (curPw !== null && body.current_password !== curPw) bad('Kata sandi saat ini salah');
      if (String(body.new_password || '').length < 8) bad('Kata sandi baru minimal 8 karakter');
      if (body.new_password === body.current_password) bad('Kata sandi baru harus berbeda dari yang lama');
      curPw = body.new_password;
      return json({ token: mkToken(me.name, me.email), user: { id: 1, ...me } });
    }
    if (path === '/api/export/csv' || path === '/api/export/pdf') {
      const kind = path.endsWith('pdf') ? 'PDF' : 'CSV';
      toast(`Pratinjau: di aplikasi asli, laporan ${kind} bulan ${monthOf(u.searchParams.get('month'))} akan terunduh. Unduhan dinonaktifkan di halaman ini.`);
      return new Response('pratinjau', { status: 200 });
    }
    const out = route(method, path, u.searchParams, body);
    return json(out, out && out.status ? out.status : 200);
  } catch (e) {
    if (e instanceof HttpErr) return json({ error: e.message }, e.status);
    console.error(e); return json({ error: 'Terjadi kesalahan di pratinjau' }, 500);
  }
};

// Buka langsung ke dasbor saat pertama kali; setelah Keluar, layar masuk muncul seperti aplikasi asli
try {
  if (!localStorage.getItem('befince_token') && !localStorage.getItem('befince_mock_seen')) {
    localStorage.setItem('befince_token', mkToken('Arbi', 'arbi@befince.id'));
    localStorage.setItem('befince_mock_seen', '1');
  }
} catch { /* penyimpanan tidak tersedia: layar masuk tampil, login menerima isian apa saja */ }
