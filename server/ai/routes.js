import { Router } from 'express';
import { q } from '../db.js';
import * as R from '../queries.js';
import { HttpError, bad, wrap, monthOf, bounds, shiftMonth, todayStr } from '../util.js';
import { buildFacts, factsKey } from './facts.js';
import { rulesReport } from './rules.js';
import { resolveReport } from './format.js';
import { askModel, aiConfig } from './model.js';

export const aiRouter = Router();

// Data mentah 6 bulan terakhir -> fakta. Catatan transaksi sengaja tidak dibaca sama sekali.
async function loadFacts(uid, month) {
  const from = shiftMonth(month, -5) + '-01', to = bounds(month)[1];
  const [tx, categories, wallets, goals, budgets] = await Promise.all([
    q('SELECT type, amount, date, category_id FROM transactions WHERE user_id = $1 AND date >= $2 AND date < $3', [uid, from, to]),
    q('SELECT id, name, type FROM categories WHERE user_id = $1', [uid]),
    R.wallets(uid, '2099-12'), R.goals(uid), R.budgets(uid, month),
  ]);
  return buildFacts({ month, today: todayStr(), tx, categories, wallets, goals, budgets });
}

const usageToday = async (uid) => (await q('SELECT calls FROM ai_usage WHERE user_id = $1 AND day = $2::date', [uid, todayStr()]))[0]?.calls ?? 0;

async function aiState(uid, month, key) {
  const cfg = aiConfig();
  const [u] = await q('SELECT ai_consent_at FROM users WHERE id = $1', [uid]);
  const consent = !!u?.ai_consent_at;
  const used = cfg.enabled ? await usageToday(uid) : 0;
  let cached = null;
  if (cfg.enabled && consent) {
    const [row] = await q('SELECT report, facts_key, model, created_at FROM ai_reports WHERE user_id = $1 AND month = $2 ORDER BY id DESC LIMIT 1', [uid, month]);
    if (row) cached = { ...row.report, model: row.model, created_at: row.created_at, fresh: row.facts_key === key };
  }
  return { enabled: cfg.enabled, consent, limit: cfg.limit, remaining: Math.max(0, cfg.limit - used), model: cfg.enabled ? cfg.model : null, provider: cfg.enabled ? cfg.name : null, notice: cfg.enabled ? cfg.notice : null, cached };
}

// Analisa cepat berbasis aturan (tanpa AI) + status fitur AI
aiRouter.get('/insights', wrap(async (req, res) => {
  const month = monthOf(req.query.month);
  const F = await loadFacts(req.userId, month);
  const rules = rulesReport(F);
  const report = resolveReport(rules, F.by);
  res.json({
    month, enough: F.enough, count3m: F.count3m,
    facts: F.facts.map(({ key, label, type, text }) => ({ key, label, type, text })),
    report: { ...report, source: 'aturan', enough: rules.enough },
    ai: await aiState(req.userId, month, factsKey(F)),
  });
}));

// Izin pengguna untuk mengirim ringkasan angka ke penyedia AI. Dicabut = laporan AI tersimpan ikut dihapus.
aiRouter.post('/ai/consent', wrap(async (req, res) => {
  const granted = req.body?.granted === true;
  await q('UPDATE users SET ai_consent_at = CASE WHEN $1::boolean THEN now() ELSE NULL END WHERE id = $2', [granted, req.userId]);
  if (!granted) await q('DELETE FROM ai_reports WHERE user_id = $1', [req.userId]);
  res.json({ consent: granted });
}));

aiRouter.post('/ai/analysis', wrap(async (req, res) => {
  const cfg = aiConfig();
  if (!cfg.enabled) throw new HttpError(403, 'Analisa AI belum diaktifkan di server ini');
  const [u] = await q('SELECT ai_consent_at FROM users WHERE id = $1', [req.userId]);
  if (!u?.ai_consent_at) throw new HttpError(403, 'Izin analisa AI belum diberikan');
  const month = monthOf(req.body?.month);
  const F = await loadFacts(req.userId, month);
  if (!F.enough) bad('Data belum cukup untuk dianalisa (minimal 8 transaksi dalam 3 bulan terakhir)');
  const key = factsKey(F);

  if (req.body?.refresh !== true) {
    const [row] = await q('SELECT report, model, created_at FROM ai_reports WHERE user_id = $1 AND month = $2 AND facts_key = $3 ORDER BY id DESC LIMIT 1', [req.userId, month, key]);
    if (row) return res.json({ source: 'ai', cached: true, report: { ...row.report, model: row.model, created_at: row.created_at }, remaining: cfg.limit - (await usageToday(req.userId)) });
  }
  // batas harian: dihitung per permintaan yang benar-benar memanggil model
  if (cfg.limit <= 0) throw new HttpError(429, 'Analisa AI dinonaktifkan (batas harian 0). Analisa aturan tetap tersedia.');
  const [use] = await q(
    `INSERT INTO ai_usage (user_id, day, calls) VALUES ($1, $2::date, 1)
     ON CONFLICT (user_id, day) DO UPDATE SET calls = ai_usage.calls + 1 WHERE ai_usage.calls < $3 RETURNING calls`,
    [req.userId, todayStr(), cfg.limit]);
  if (!use) throw new HttpError(429, `Batas analisa AI hari ini (${cfg.limit} kali) sudah tercapai. Analisa aturan tetap tersedia.`);

  const hints = rulesReport(F).findings;
  let out;
  try {
    out = await askModel({ facts: F.facts, by: F.by, hints, month });
  } catch (e) {
    console.warn('Analisa AI gagal:', e.message);
    if (e.status === 429) { // dibatasi penyedia (umum di tingkat gratis): tidak memakai jatah harian pengguna
      await q('UPDATE ai_usage SET calls = GREATEST(calls - 1, 0) WHERE user_id = $1 AND day = $2::date', [req.userId, todayStr()]);
      throw new HttpError(503, 'Penyedia AI sedang membatasi permintaan (tingkat gratis punya batas per menit dan per hari). Jatah harianmu tidak terpakai, coba lagi beberapa menit lagi.');
    }
    if (e.status === 401 || e.status === 403) console.warn('Kunci API ditolak penyedia AI: periksa AI_API_KEY dan AI_PROVIDER di pengaturan server.');
    throw new HttpError(502, 'Analisa AI gagal atau tidak lolos pemeriksaan. Analisa aturan tetap tersedia, dan kamu bisa coba lagi nanti.');
  }
  const report = { ...resolveReport(out.report, F.by), source: 'ai', month };
  await q('INSERT INTO ai_reports (user_id, month, facts_key, model, report) VALUES ($1,$2,$3,$4,$5)', [req.userId, month, key, out.model, JSON.stringify(report)]);
  res.json({ source: 'ai', cached: false, report: { ...report, model: out.model, created_at: new Date().toISOString() }, remaining: Math.max(0, cfg.limit - use.calls) });
}));
