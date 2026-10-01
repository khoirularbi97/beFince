import 'dotenv/config';
import pg from 'pg';

// BIGINT dan NUMERIC dibaca sebagai number; DATE tetap string 'YYYY-MM-DD' (tanpa geseran zona waktu)
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'off' ? false : { rejectUnauthorized: false },
});

export const q = (text, params) => pool.query(text, params).then((r) => r.rows);
