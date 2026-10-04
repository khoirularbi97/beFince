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

// Memeriksa keluaran model: bentuk, panjang, nilai yang diizinkan, penanda dikenal, dan tidak ada angka karangan.
export function validateModelReport(raw, by) {
  const errors = [];
  const txt = (v, max, name, required = true) => {
    if (typeof v !== 'string' || !clean(v)) { if (required) errors.push(`${name} harus berupa teks`); return ''; }
    const c = clean(v);
    if (c.length > max) errors.push(`${name} terlalu panjang (maksimal ${max} karakter)`);
    for (const k of placeholders(c)) if (!by.has(k)) errors.push(`${name} memakai penanda yang tidak ada: {{${k}}}`);
    if (strayNumber(c)) errors.push(`${name} memuat angka yang ditulis sendiri; pakai penanda {{kunci}}`);
    return c;
  };
  const enumv = (v, list, name) => { if (!list.includes(v)) errors.push(`${name} harus salah satu dari ${list.join(', ')}`); return v; };
  const arr = (v, min, max, name) => { if (!Array.isArray(v) || v.length < min || v.length > max) { errors.push(`${name} harus berisi ${min} sampai ${max} butir`); return []; } return v; };
  if (!raw || typeof raw !== 'object') return { ok: false, errors: ['keluaran bukan objek'] };
  const report = {
    headline: txt(raw.headline, 160, 'headline'),
    health: enumv(raw.health, HEALTH, 'health'),
    findings: arr(raw.findings, 2, 6, 'findings').map((f, i) => ({
      title: txt(f?.title, 80, `findings[${i}].title`), detail: txt(f?.detail, 300, `findings[${i}].detail`), severity: enumv(f?.severity, SEV, `findings[${i}].severity`),
    })),
    steps: arr(raw.steps, 2, 5, 'steps').map((s, i) => ({
      title: txt(s?.title, 80, `steps[${i}].title`), why: txt(s?.why, 200, `steps[${i}].why`, false), how: txt(s?.how, 300, `steps[${i}].how`), horizon: enumv(s?.horizon, HOR, `steps[${i}].horizon`),
    })),
    watch: (raw.watch == null ? [] : arr(raw.watch, 0, 3, 'watch')).map((w, i) => txt(w, 160, `watch[${i}]`)),
    missing_data: (raw.missing_data == null ? [] : arr(raw.missing_data, 0, 2, 'missing_data')).map((w, i) => txt(w, 160, `missing_data[${i}]`)),
  };
  return { ok: errors.length === 0, errors, report };
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
  out.evidence = [...used].map((k) => ({ key: k, label: by.get(k).label, text: by.get(k).text }));
  return out;
}
