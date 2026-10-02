export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = (msg) => { throw new HttpError(400, msg); };
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

// Tanggal hari ini menurut zona waktu aplikasi (bukan UTC), supaya tanggal tidak mundur sehari saat dini hari WIB
export const APP_TZ = process.env.APP_TZ || 'Asia/Jakarta';
export const todayStr = () => new Date().toLocaleDateString('en-CA', { timeZone: APP_TZ });
// Jam transaksi (HH:MM) diambil dari timestamp pencatatan (created_at), dalam zona waktu aplikasi.
// Hanya dipakai untuk transaksi manual yang dicatat pada hari yang sama dengan tanggalnya. Transaksi impor atau yang
// dicatat mundur tidak punya jam, karena timestamp-nya adalah waktu impor/pencatatan, bukan waktu kejadian.
// `tz` adalah penanda parameter SQL (misalnya '$4') yang berisi nama zona waktu.
export const timeExpr = (tz, t = 't') =>
  `CASE WHEN ${t}.source = 'manual' AND (${t}.created_at AT TIME ZONE ${tz})::date = ${t}.date THEN to_char(${t}.created_at AT TIME ZONE ${tz}, 'HH24:MI') END`;
export const monthOf = (m) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(m || '') ? m : todayStr().slice(0, 7));
export const bounds = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return [`${m}-01`, new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10)];
};
export const lastDay = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
};
export const shiftMonth = (m, d) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1 + d, 1)).toISOString().slice(0, 7);
};

export const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s));
export const dateOf = (s) => (s ? (isDate(s) ? s : bad('Tanggal tidak valid')) : todayStr());
export const amountOf = (v, label = 'Nominal') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) bad(`${label} harus bilangan bulat lebih dari 0`);
  return n;
};
export const idOf = (v, label = 'ID') => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) bad(`${label} tidak valid`);
  return n;
};
export const oneOf = (v, list, label) => (list.includes(v) ? v : bad(`${label} tidak valid`));
export const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
export const text = (v, max = 200) => String(v ?? '').trim().slice(0, max);
