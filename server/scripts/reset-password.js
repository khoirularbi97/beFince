// Lupa kata sandi (aplikasi ini belum mengirim email): buat kata sandi sementara untuk satu akun.
// Pakai: npm run user:reset -- email@anda.com  → catat kata sandi yang tercetak, lalu ganti lewat Akun > Ganti kata sandi.
import 'dotenv/config';
import crypto from 'node:crypto';
import { pool } from '../db.js';
import { hashPassword } from '../password.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Pakai: npm run user:reset -- email@anda.com'); process.exit(1); }
try {
  const temp = crypto.randomBytes(9).toString('base64url');
  const { rowCount } = await pool.query(
    'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE email = $2', [await hashPassword(temp), email]);
  if (!rowCount) throw new Error(`Akun ${email} tidak ditemukan`);
  console.log(`Kata sandi sementara untuk ${email}: ${temp}`);
  console.log('Semua sesi lama sudah dikeluarkan. Ganti kata sandi ini segera setelah masuk.');
} catch (e) {
  console.error('Gagal:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
