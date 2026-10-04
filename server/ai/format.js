// Format angka, penanda {{kunci}}, dan pemeriksa keluaran model. Murni JavaScript (tanpa Node/DOM) supaya dipakai bersama oleh server dan pratinjau.
export const rp = (n) => (n < 0 ? '−' : '') + 'Rp' + Math.abs(Math.round(n)).toLocaleString('id-ID');
const pct = (x) => Math.round(Math.abs(x) * 100) + '%';
export function fmtVal(type, v) {
  if (type === 'rp') return rp(v);
  if (type === 'pct') return (v < 0 ? '−' : '') + pct(v);
  if (type === 'pcts') return (v < 0 ? '−' : '+') + pct(v);
  if (type === 'months') return `${(Math.round(v * 10) / 10).toLocaleString('id-ID')} bulan`;
  return String(v);
}

const PH = () => /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
export const placeholders = (text) => [...String(text).matchAll(PH())].map((m) => m[1].toLowerCase());
export const resolveText = (text, by, used) => String(text).replace(PH(), (_m, k) => {
  const f = by.get(k.toLowerCase());
  if (!f) return '—';
  used?.add(f.key);
  return f.text;
});

// Angka yang ditulis sendiri oleh model dilarang (nominal, persen, desimal, angka 3 digit ke atas). Angka waktu kecil seperti "3 bulan" atau "30 hari" boleh.
export const strayNumber = (text) => /rp\s*\d|\d\s*%|\d\s*persen|\d[.,]\d|\b\d{3,}\b/i.test(String(text).replace(PH(), ' '));

const HEALTH = ['baik', 'perlu_perhatian', 'waspada'], SEV = ['good', 'info', 'warn'], HOR = ['minggu_ini', '30_hari', '3_bulan'];
const clean = (s) => String(s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, max) => (s.length <= max ? s : s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…');

// Model kecil sering menulis nilai pilihan dengan variasi ("warning", "30 hari", "this week"). Ratakan ke nilai yang kita pakai.
const norm = (v) => String(v ?? '').toLowerCase().trim().replace(/[\s\-]+/g, '_');
const SEV_MAP = { good: 'good', positive: 'good', success: 'good', baik: 'good', ok: 'good', info: 'info', information: 'info', informasi: 'info', neutral: 'info', note: 'info', warn: 'warn', warning: 'warn', peringatan: 'warn', caution: 'warn', alert: 'warn', danger: 'warn', critical: 'warn' };
const HOR_MAP = { minggu_ini: 'minggu_ini', this_week: 'minggu_ini', week: 'minggu_ini', '1_minggu': 'minggu_ini', segera: 'minggu_ini', '30_hari': '30_hari', '30_days': '30_hari', '30_day': '30_hari', bulan_ini: '30_hari', this_month: '30_hari', '1_bulan': '30_hari', '3_bulan': '3_bulan', '3_months': '3_bulan', '90_hari': '3_bulan', jangka_panjang: '3_bulan' };
const HEALTH_MAP = { baik: 'baik', good: 'baik', healthy: 'baik', ok: 'baik', sehat: 'baik', perlu_perhatian: 'perlu_perhatian', attention: 'perlu_perhatian', needs_attention: 'perlu_perhatian', caution: 'perlu_perhatian', waspada: 'waspada', alert: 'waspada', warning: 'waspada', critical: 'waspada', bad: 'waspada' };
const mapv = (v, map) => map[norm(v)] ?? v;
// Buka bungkus ({"analysis": {...}}) dan ratakan nilai pilihan; tidak mengubah isi teks
export function normalizeReport(raw) {
  if (!raw || typeof raw !== 'object') return raw;
  let r = raw;
  if (!Array.isArray(r.findings) && !Array.isArray(r.steps)) {
    const inner = Object.values(r).find((v) => v && typeof v === 'object' && (Array.isArray(v.findings) || Array.isArray(v.steps)));
    if (inner) r = inner;
  }
  return {
    ...r, health: mapv(r.health, HEALTH_MAP),
    findings: Array.isArray(r.findings) ? r.findings.map((f) => (f && typeof f === 'object' ? { ...f, severity: mapv(f.severity, SEV_MAP) } : f)) : r.findings,
    steps: Array.isArray(r.steps) ? r.steps.map((x) => (x && typeof x === 'object' ? { ...x, horizon: mapv(x.horizon, HOR_MAP) } : x)) : r.steps,
  };
}

// Satu teks: wajib terisi (kecuali opsional), penanda harus dikenal, dan tidak boleh ada angka karangan.
// truncate=true (mode penyelamatan) memotong teks yang kepanjangan, bukan menolaknya.
function checkText(v, max, name, by, errors, { required = true, truncate = false } = {}) {
  if (typeof v !== 'string' || !clean(v)) { if (required) errors.push(`${name} harus berupa teks`); return ''; }
  let c = clean(v);
  if (c.length > max) { if (truncate) c = clip(c, max); else errors.push(`${name} terlalu panjang (maksimal ${max} karakter)`); }
  for (const k of placeholders(c)) if (!by.has(k)) errors.push(`${name} memakai penanda yang tidak ada: {{${k}}}`);
  if (strayNumber(c)) errors.push(`${name} memuat angka yang ditulis sendiri; pakai penanda {{kunci}}`);
  return c;
}
const oneOf = (v, list, name, errors) => { if (!list.includes(v)) errors.push(`${name} harus salah satu dari ${list.join(', ')}`); return v; };
const finding = (f, i, by, errors, o) => ({ title: checkText(f?.title, 80, `findings[${i}].title`, by, errors, o), detail: checkText(f?.detail, 300, `findings[${i}].detail`, by, errors, o), severity: oneOf(f?.severity, SEV, `findings[${i}].severity`, errors) });
const step = (s, i, by, errors, o) => ({ title: checkText(s?.title, 80, `steps[${i}].title`, by, errors, o), why: checkText(s?.why, 200, `steps[${i}].why`, by, errors, { ...o, required: false }), how: checkText(s?.how, 300, `steps[${i}].how`, by, errors, o), horizon: oneOf(s?.horizon, HOR, `steps[${i}].horizon`, errors) });
const list = (v, min, max, name, errors) => { if (!Array.isArray(v) || v.length < min || v.length > max) { errors.push(`${name} harus berisi ${min} sampai ${max} butir`); return []; } return v; };

// Memeriksa keluaran model secara ketat: bentuk, panjang, nilai yang diizinkan, penanda dikenal, dan tidak ada angka karangan.
export function validateModelReport(input, by) {
  const errors = [];
  const raw = normalizeReport(input);
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['keluaran bukan objek'] };
  const report = {
    headline: checkText(raw.headline, 160, 'headline', by, errors),
    health: oneOf(raw.health, HEALTH, 'health', errors),
    findings: list(raw.findings, 2, 6, 'findings', errors).map((f, i) => finding(f, i, by, errors)),
    steps: list(raw.steps, 2, 5, 'steps', errors).map((s, i) => step(s, i, by, errors)),
    watch: (raw.watch == null ? [] : list(raw.watch, 0, 3, 'watch', errors)).map((w, i) => checkText(w, 160, `watch[${i}]`, by, errors)),
    missing_data: (raw.missing_data == null ? [] : list(raw.missing_data, 0, 2, 'missing_data', errors)).map((w, i) => checkText(w, 160, `missing_data[${i}]`, by, errors)),
  };
  return { ok: errors.length === 0, errors, report };
}

// Mode penyelamatan untuk model yang kurang rapi: buang butir yang melanggar (angka karangan, penanda palsu), potong teks kepanjangan,
// dan terima sisanya kalau masih cukup. Angka yang tidak bisa diverifikasi tidak pernah ikut ditampilkan.
export function salvageModelReport(input, by, fallbackHeadline) {
  const raw = normalizeReport(input);
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['keluaran bukan objek'] };
  const o = { truncate: true };
  let dropped = 0;
  const keep = (arr, make) => (Array.isArray(arr) ? arr : []).map((x, i) => { const e = []; const r = make(x, i, e); if (e.length) { dropped++; return null; } return r; }).filter(Boolean);
  const findings = keep(raw.findings, (f, i, e) => finding(f, i, by, e, o)).slice(0, 6);
  const steps = keep(raw.steps, (x, i, e) => step(x, i, by, e, o)).slice(0, 5);
  const text = (arr, max, name) => keep(arr, (x, i, e) => checkText(x, max, `${name}[${i}]`, by, e, o));
  const e0 = [];
  let headline = checkText(raw.headline, 160, 'headline', by, e0, o);
  if (e0.length || !headline) { headline = fallbackHeadline; dropped++; }
  const ok = findings.length >= 2 && steps.length >= 2 && !!headline;
  return { ok, dropped, errors: ok ? [] : ['terlalu banyak butir yang tidak lolos pemeriksaan'],
    report: { headline, health: HEALTH.includes(raw.health) ? raw.health : 'perlu_perhatian', findings, steps, watch: text(raw.watch, 160, 'watch').slice(0, 3), missing_data: text(raw.missing_data, 160, 'missing_data').slice(0, 2) } };
}

// Ganti semua penanda dengan angka asli dan catat angka yang dipakai
export function resolveReport(r, by) {
  const used = new Set();
  const t = (s) => resolveText(s, by, used);
  const out = {
    headline: t(r.headline), health: r.health,
    findings: r.findings.map((f) => ({ ...f, title: t(f.title), detail: t(f.detail) })),
    steps: r.steps.map((s) => ({ ...s, title: t(s.title), why: s.why ? t(s.why) : '', how: t(s.how) })),
    watch: (r.watch || []).map(t), missing_data: (r.missing_data || []).map(t),
  };
  if (r.dropped) out.dropped = r.dropped;
  out.evidence = [...used].map((k) => ({ key: k, label: by.get(k).label, text: by.get(k).text }));
  return out;
}
