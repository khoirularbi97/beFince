// Untuk database lama (sebelum ada login): serahkan semua data tanpa pemilik ke satu akun.
// Daftar dulu lewat aplikasi, lalu: npm run db:claim -- email@anda.com
import 'dotenv/config';
import { pool } from '../db.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Pakai: npm run db:claim -- email@anda.com'); process.exit(1); }
const client = await pool.connect();
try {
  const { rows: [u] } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!u) throw new Error(`Akun ${email} belum terdaftar`);
  const { rows: [c] } = await client.query(
    `SELECT (SELECT COUNT(*) FROM transactions WHERE user_id = $1)::int AS tx, (SELECT COUNT(*) FROM goals WHERE user_id = $1)::int AS goals`, [u.id]);
  if (c.tx || c.goals) throw new Error('Akun ini sudah punya data. Klaim hanya untuk akun yang masih kosong.');
  await client.query('BEGIN');
  // Buang dompet dan kategori awal yang dibuat otomatis saat daftar, supaya tidak ganda dengan data lama
  await client.query('DELETE FROM wallets WHERE user_id = $1', [u.id]);
  await client.query('DELETE FROM categories WHERE user_id = $1', [u.id]);
  for (const t of ['wallets', 'categories', 'transactions', 'transfers', 'budgets', 'goals', 'goal_deposits']) {
    const r = await client.query(`UPDATE ${t} SET user_id = $1 WHERE user_id IS NULL`, [u.id]);
    console.log(`${t}: ${r.rowCount} baris`);
  }
  await client.query('COMMIT');
  console.log(`OK: data lama sekarang milik ${email}`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Gagal:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
