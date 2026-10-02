const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Token login disimpan di localStorage dan dikirim lewat header Authorization
const KEY = 'befince_token';
export const auth = {
  get() { try { return localStorage.getItem(KEY); } catch { return null; } },
  set(t) { try { localStorage.setItem(KEY, t); } catch { /* penyimpanan tidak tersedia */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* abaikan */ } },
};
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };
const authHeader = () => (auth.get() ? { Authorization: `Bearer ${auth.get()}` } : {});

async function req(path, opts = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error('Tidak bisa terhubung ke server. Cek VITE_API_URL dan pastikan backend menyala.');
  }
  const data = await res.json().catch(() => ({}));
  // Token ditolak/kedaluwarsa: keluar otomatis (kecuali saat memang sedang masuk/daftar)
  if (res.status === 401 && !/^\/api\/auth\/(login|register)/.test(path)) { auth.clear(); onUnauthorized(); }
  if (!res.ok) throw new Error(data.error || 'Permintaan gagal');
  return data;
}

const qs = (o) => '?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();
const send = (method, path, body) => req(path, { method, body });

export const api = {
  login: (b) => send('POST', '/api/auth/login', b),
  register: (b) => send('POST', '/api/auth/register', b),
  me: () => req('/api/auth/me'),
  changePassword: (b) => send('PUT', '/api/auth/password', b),
  meta: () => req('/api/meta'),
  report: (month) => req(`/api/reports/monthly${qs({ month })}`),
  trend: (month, months = 6) => req(`/api/reports/trend${qs({ month, months })}`),
  weekday: (month) => req(`/api/reports/weekday${qs({ month })}`),
  transactions: (p) => req(`/api/transactions${qs(p)}`),
  addTx: (b) => send('POST', '/api/transactions', b),
  importCheck: (b) => send('POST', '/api/import/check', b),
  importCommit: (b) => send('POST', '/api/import/commit', b),
  updTx: (id, b) => send('PUT', `/api/transactions/${id}`, b),
  delTx: (id) => send('DELETE', `/api/transactions/${id}`),
  wallets: (month) => req(`/api/wallets${qs({ month })}`),
  addWallet: (b) => send('POST', '/api/wallets', b),
  updWallet: (id, b) => send('PUT', `/api/wallets/${id}`, b),
  delWallet: (id) => send('DELETE', `/api/wallets/${id}`),
  categories: () => req('/api/categories'),
  addCategory: (b) => send('POST', '/api/categories', b),
  updCategory: (id, b) => send('PUT', `/api/categories/${id}`, b),
  delCategory: (id, moveTo) => send('DELETE', `/api/categories/${id}${moveTo ? `?move_to=${moveTo}` : ''}`),
  addTransfer: (b) => send('POST', '/api/transfers', b),
  delTransfer: (id) => send('DELETE', `/api/transfers/${id}`),
  budgets: (month) => req(`/api/budgets${qs({ month })}`),
  budgetSuggest: (month) => req(`/api/budgets/suggest${qs({ month })}`),
  saveBudgets: (month, items) => send('PUT', '/api/budgets', { month, items }),
  goals: () => req('/api/goals'),
  addGoal: (b) => send('POST', '/api/goals', b),
  updGoal: (id, b) => send('PUT', `/api/goals/${id}`, b),
  delGoal: (id) => send('DELETE', `/api/goals/${id}`),
  deposit: (id, b) => send('POST', `/api/goals/${id}/deposits`, b),
  goalDeposits: (id) => req(`/api/goals/${id}/deposits`),
  updDeposit: (id, did, b) => send('PUT', `/api/goals/${id}/deposits/${did}`, b),
  delDeposit: (id, did) => send('DELETE', `/api/goals/${id}/deposits/${did}`),
};

export async function download(path, filename) {
  let res;
  try { res = await fetch(BASE + path, { headers: authHeader() }); } catch { throw new Error('Tidak bisa terhubung ke server'); }
  if (res.status === 401) { auth.clear(); onUnauthorized(); }
  if (!res.ok) throw new Error('Gagal membuat berkas ekspor');
  const url = URL.createObjectURL(await res.blob());
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
