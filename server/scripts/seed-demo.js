// Isi data contoh untuk satu akun yang SUDAH terdaftar: npm run db:seed -- email@anda.com
import 'dotenv/config';
import fs from 'node:fs';
import { pool } from '../db.js';

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) { console.error('Pakai: npm run db:seed -- email@anda.com (daftar dulu lewat aplikasi)'); process.exit(1); }
const client = await pool.connect();
try {
  const { rows: [u] } = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  if (!u) throw new Error(`Akun ${email} belum terdaftar`);
  const { rows: [n] } = await client.query('SELECT COUNT(*)::int AS n FROM transactions WHERE user_id = $1', [u.id]);
  if (n.n > 0) throw new Error('Akun ini sudah punya transaksi. Data contoh hanya untuk akun kosong.');
  const uid = Number(u.id);
  let sql = fs.readFileSync(new URL('../seed-demo.sql', import.meta.url), 'utf8')
    .replace(/^(BEGIN|COMMIT);\s*$/gm, '')
    .replace(/FROM (categories|wallets|goals) WHERE /g, `FROM $1 WHERE user_id = ${uid} AND `)
    .replace(/^(UPDATE wallets SET .*?) WHERE /gm, `$1 WHERE user_id = ${uid} AND `);
  const tables = ['transactions', 'transfers', 'budgets', 'goals', 'goal_deposits'];
  await client.query('BEGIN');
  for (const t of tables) await client.query(`ALTER TABLE ${t} ALTER COLUMN user_id SET DEFAULT ${uid}`);
  await client.query(sql);
  for (const t of tables) await client.query(`ALTER TABLE ${t} ALTER COLUMN user_id DROP DEFAULT`);
  await client.query('COMMIT');
  console.log(`OK: data contoh dimasukkan untuk ${email}`);
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Gagal:', e.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
