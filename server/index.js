import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router } from './routes.js';
import { authRouter, requireAuth } from './auth.js';
import { HttpError } from './util.js';

const app = express();
app.set('trust proxy', 1); // Render berada di belakang satu proxy; dipakai pembatas percobaan login
const origins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: '100kb' }));

app.get('/', (_req, res) => res.json({ name: 'beFince API', ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));
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

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API siap di :${port}`));
