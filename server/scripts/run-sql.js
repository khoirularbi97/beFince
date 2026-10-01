import 'dotenv/config';
import fs from 'node:fs';
import { pool } from '../db.js';

const file = process.argv[2];
if (!file) { console.error('Pakai: node scripts/run-sql.js <file.sql>'); process.exit(1); }
try {
  await pool.query(fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
  console.log('OK:', file);
} catch (e) {
  console.error('Gagal:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
