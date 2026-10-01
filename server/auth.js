import jwt from 'jsonwebtoken';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool, q } from './db.js';
import { HttpError, bad, text, wrap } from './util.js';
import { hashPassword, verifyPassword } from './password.js';

const SECRET = process.env.JWT_SECRET || '';
if (SECRET.length < 32) {
  console.error('JWT_SECRET wajib diisi (minimal 32 karakter). Buat dengan:\n  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  process.exit(1);
}

// Dipakai saat email tidak ditemukan, supaya waktu respons tidak membocorkan email mana yang terdaftar
const DUMMY_HASH = await hashPassword('kata-sandi-palsu');

// ---- token ----
const signToken = (u) => jwt.sign({ sub: String(u.id), tv: u.token_version ?? 0 }, SECRET, { algorithm: 'HS256', expiresIn: process.env.JWT_EXPIRES || '7d' });

const EXPIRED = 'Sesi berakhir, silakan masuk lagi';
export async function requireAuth(req, _res, next) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return next(new HttpError(401, 'Silakan masuk terlebih dahulu'));
  let p;
  try { p = jwt.verify(m[1], SECRET, { algorithms: ['HS256'] }); } catch { return next(new HttpError(401, EXPIRED)); }
  try {
    // Token hanya sah kalau akunnya masih ada dan versinya sama (ganti kata sandi mencabut token lama)
    const [u] = await q('SELECT token_version FROM users WHERE id = $1', [Number(p.sub)]);
    if (!u || u.token_version !== (p.tv ?? 0)) return next(new HttpError(401, EXPIRED));
    req.userId = Number(p.sub);
    next();
  } catch (e) { next(e); }
}

// ---- data awal untuk pengguna baru ----
export async function seedDefaults(client, uid) {
  await client.query(
    `INSERT INTO wallets (user_id, name, kind) VALUES ($1,'Tunai','cash'), ($1,'Rekening Bank','bank'), ($1,'E-wallet','ewallet')`, [uid]);
  await client.query(
    `INSERT INTO categories (user_id, name, type) VALUES
       ($1,'Makan','expense'), ($1,'Transport','expense'), ($1,'Tagihan','expense'), ($1,'Belanja','expense'),
       ($1,'Hiburan','expense'), ($1,'Lainnya','expense'), ($1,'Gaji','income'), ($1,'Freelance','income'), ($1,'Lainnya','income')`, [uid]);
}

export const authRouter = Router();
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.' },
});
const emailOf = (v) => String(v || '').trim().toLowerCase();

authRouter.post('/register', limiter, wrap(async (req, res) => {
  if (process.env.ALLOW_REGISTRATION === 'false') throw new HttpError(403, 'Pendaftaran akun baru sedang dinonaktifkan');
  const name = text(req.body.name, 60), email = emailOf(req.body.email), pw = String(req.body.password || '');
  if (!name) bad('Nama wajib diisi');
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad('Format email tidak valid');
  if (pw.length < 8 || pw.length > 128) bad('Kata sandi minimal 8 karakter');
  const hash = await hashPassword(pw);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [user] } = await client.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, name, email, token_version', [name, email, hash]);
    await seedDefaults(client, user.id);
    await client.query('COMMIT');
    res.status(201).json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') throw new HttpError(409, 'Email sudah terdaftar');
    throw e;
  } finally {
    client.release();
  }
}));

authRouter.post('/login', limiter, wrap(async (req, res) => {
  const email = emailOf(req.body.email), pw = String(req.body.password || '').slice(0, 128);
  const [u] = await q('SELECT id, name, email, password_hash, token_version FROM users WHERE email = $1', [email]);
  const ok = await verifyPassword(pw, u ? u.password_hash : DUMMY_HASH);
  if (!u || !ok) throw new HttpError(401, 'Email atau kata sandi salah');
  res.json({ token: signToken(u), user: { id: u.id, name: u.name, email: u.email } });
}));

authRouter.get('/me', requireAuth, wrap(async (req, res) => {
  const [u] = await q('SELECT id, name, email FROM users WHERE id = $1', [req.userId]);
  if (!u) throw new HttpError(401, 'Akun tidak ditemukan, silakan masuk lagi');
  res.json(u);
}));

// Ganti kata sandi: wajib kata sandi lama. Token di perangkat lain otomatis tidak berlaku; token baru dikembalikan untuk perangkat ini.
// Kata sandi lama yang salah dibalas 400 (bukan 401) supaya aplikasi tidak mengira sesi berakhir.
authRouter.put('/password', limiter, requireAuth, wrap(async (req, res) => {
  const current = String(req.body.current_password || '').slice(0, 128);
  const fresh = String(req.body.new_password || '');
  if (fresh.length < 8 || fresh.length > 128) bad('Kata sandi baru minimal 8 karakter');
  const [u] = await q('SELECT id, password_hash FROM users WHERE id = $1', [req.userId]);
  if (!u || !(await verifyPassword(current, u.password_hash))) bad('Kata sandi saat ini salah');
  if (current === fresh) bad('Kata sandi baru harus berbeda dari yang lama');
  const [n] = await q(
    'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2 RETURNING id, name, email, token_version',
    [await hashPassword(fresh), u.id]);
  res.json({ token: signToken(n), user: { id: n.id, name: n.name, email: n.email } });
}));
