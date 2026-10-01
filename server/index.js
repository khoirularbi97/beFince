import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router } from './routes.js';
import { authRouter, requireAuth } from './auth.js';
import { HttpError } from './util.js';
import { pool, q, runSqlFile } from './db.js';

const app = express();
app.set('trust proxy', 1); // Render berada di belakang satu proxy; dipakai pembatas percobaan login
app.disable('x-powered-by');
// Alamat frontend harus persis sama dengan yang tampil di browser, tanpa garis miring di akhir (dibersihkan otomatis)
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: '100kb' }));

app.get('/', (_req, res) => res.json({ name: 'beFince API', ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
// Cek koneksi ke database (sengaja tidak dipakai sebagai health check Render, supaya Neon bisa tidur)
app.get('/api/health/db', async (_req, res) => {
  try { await q('SELECT 1'); res.json({ ok: true }); } catch (e) { res.status(503).json({ ok: false, error: e.message }); }
});
app.use('/api/auth', authRouter);
app.use('/api', requireAuth, router); // semua rute data wajib login

app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Format JSON tidak valid' });
  // Kesalahan basis data yang umum: data terkait tidak ada, duplikat, format salah
  if (err.code === '23503') return res.status(400).json({ error: 'Data terkait (dompet/kategori) tidak ditemukan' });
  if (err.code === '23505') return res.status(409).json({ error: 'Data sudah ada' });
  if (['22P02', '22007', '22008'].includes(err.code)) return res.status(400).json({ error: 'Format data tidak valid' });
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server' });
});

process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e));

// Opsional: buat/upgrade tabel otomatis saat server menyala (db.sql aman dijalankan berulang)
if (process.env.AUTO_DB_INIT === 'true') {
  try { await runSqlFile('./db.sql'); console.log('Tabel database siap (AUTO_DB_INIT)'); }
  catch (e) { console.error('Gagal menyiapkan tabel:', e.message); process.exit(1); }
}

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API siap di :${port}`);
  console.log(`CORS: ${origins.length ? origins.join(', ') : 'semua asal diizinkan (isi CLIENT_ORIGIN untuk membatasi)'}`);
  console.log(`Pendaftaran akun baru: ${process.env.ALLOW_REGISTRATION === 'false' ? 'ditutup' : 'terbuka'}`);
});
process.on('SIGTERM', () => pool.end().finally(() => process.exit(0)));
