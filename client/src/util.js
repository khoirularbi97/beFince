export const rp = (n) => 'Rp' + Math.round(n).toLocaleString('id-ID');
export const rps = (n) => (n < 0 ? '−' : '') + rp(Math.abs(n));
export const jt = (n) => 'Rp' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt';

export const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export const DAYS_FULL = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => fmt(new Date());
export const curMonth = () => today().slice(0, 7);
export const shiftMonth = (m, d) => { const t = new Date(+m.slice(0, 4), +m.slice(5) - 1 + d, 1); return fmt(t).slice(0, 7); };
export const monthLabel = (m) => `${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
export const monthShort = (m) => `${MON[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
export const daysIn = (m) => new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
export const defaultDate = (m) => (m === curMonth() ? today() : `${m}-01`);

export function dayLabel(d) {
  const label = `${+d.slice(8)} ${MONTHS[+d.slice(5, 7) - 1]}`;
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d === today()) return `Hari ini, ${label}`;
  if (d === fmt(y)) return `Kemarin, ${label}`;
  return label;
}

// Sisa bulan dari bulan ini sampai bulan target (inklusif)
export const monthsLeft = (deadline) =>
  (+deadline.slice(0, 4) - +curMonth().slice(0, 4)) * 12 + (+deadline.slice(5) - +curMonth().slice(5)) + 1;

export const WALLET_ICON = { cash: '💵', bank: '🏦', ewallet: '📱' };
export const WALLET_VAR = { cash: '--w1', bank: '--w2', ewallet: '--w3' };
export const WALLET_HINT = { cash: 'Uang tunai', bank: 'Rekening bank', ewallet: 'Dompet digital' };
export const CAT_ICON = { Makan: '🍜', Transport: '🚌', Tagihan: '🧾', Belanja: '🛒', Hiburan: '🎬', Gaji: '💰', Freelance: '💼' };
