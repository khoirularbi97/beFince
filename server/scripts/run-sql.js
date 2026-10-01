import 'dotenv/config';
import { pool, runSqlFile } from '../db.js';

const file = process.argv[2];
if (!file) { console.error('Pakai: node scripts/run-sql.js <file.sql>'); process.exit(1); }
try {
  await runSqlFile('./' + file);
  console.log('OK:', file);
} catch (e) {
  console.error('Gagal:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
