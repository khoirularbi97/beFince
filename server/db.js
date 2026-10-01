import 'dotenv/config';
import fs from 'node:fs';
import pg from 'pg';

// BIGINT dan NUMERIC dibaca sebagai number; DATE tetap string 'YYYY-MM-DD' (tanpa geseran zona waktu)
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);

// String koneksi Neon biasanya berakhiran ?sslmode=require&channel_binding=require.
// Pakai verify-full secara eksplisit (itu yang sebenarnya dilakukan pg untuk "require") dan buang channel_binding,
// supaya tidak muncul peringatan keamanan dan perilakunya tidak berubah saat pg versi berikutnya terbit.
const cleanUrl = (u) => (u || '')
  .replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full')
  .replace(/[?&]channel_binding=[^&]*/g, (m) => (m.startsWith('?') ? '?' : ''))
  .replace(/\?&/, '?')
  .replace(/\?$/, '');

export const pool = new pg.Pool({
  connectionString: cleanUrl(process.env.DATABASE_URL),
  ssl: process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: true },
  max: Number(process.env.DB_POOL_MAX) || 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 20_000, // memberi waktu Neon bangun dari tidur (scale to zero)
});
// Neon memutus koneksi yang menganggur. Tanpa penangan ini, event 'error' pada koneksi idle akan mematikan server.
pool.on('error', (e) => console.warn('Koneksi database menganggur terputus, akan dibuka ulang otomatis:', e.message));

export const q = (text, params) => pool.query(text, params).then((r) => r.rows);

// Jalankan berkas .sql di folder server (dipakai db:init dan AUTO_DB_INIT)
export const runSqlFile = (file) => pool.query(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
export { cleanUrl };
