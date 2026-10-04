-- Jalankan sekali di database Neon: npm run db:init (aman dijalankan ulang, juga untuk database lama tanpa login)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,                            -- selalu huruf kecil
  password_hash TEXT NOT NULL,                           -- scrypt, bukan kata sandi asli
  token_version INT NOT NULL DEFAULT 0,                  -- naik setiap ganti kata sandi; token lama otomatis tidak berlaku
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('cash','bank','ewallet')),
  opening_balance BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount BIGINT NOT NULL CHECK (amount > 0),            -- rupiah, bilangan bulat
  category_id INT REFERENCES categories(id) ON DELETE SET NULL,
  wallet_id INT NOT NULL REFERENCES wallets(id),
  date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','import')),  -- impor: created_at adalah waktu impor, bukan waktu kejadian
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()          -- timestamp pencatatan; sumber jam transaksi
);

CREATE TABLE IF NOT EXISTS transfers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_wallet INT NOT NULL REFERENCES wallets(id),
  to_wallet INT NOT NULL REFERENCES wallets(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  CHECK (from_wallet <> to_wallet)
);

CREATE TABLE IF NOT EXISTS budgets (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month CHAR(7) NOT NULL,                                -- 'YYYY-MM'
  amount BIGINT NOT NULL CHECK (amount >= 0),            -- 0 = tanpa budget
  PRIMARY KEY (category_id, month)
);

CREATE TABLE IF NOT EXISTS goals (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🎯',
  target BIGINT NOT NULL CHECK (target > 0),
  saved_before BIGINT NOT NULL DEFAULT 0,                -- tabungan yang sudah ada sebelum dicatat di aplikasi
  deadline CHAR(7),                                      -- 'YYYY-MM'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goal_deposits (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id INT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  wallet_id INT NOT NULL REFERENCES wallets(id),
  amount BIGINT NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_consent_at TIMESTAMPTZ;   -- izin mengirim ringkasan angka ke penyedia AI (kosong = tidak ada izin)

-- Analisa AI: laporan terakhir (dipakai ulang kalau angkanya tidak berubah) dan pemakaian harian
CREATE TABLE IF NOT EXISTS ai_reports (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month CHAR(7) NOT NULL,
  facts_key TEXT NOT NULL,
  model TEXT NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_reports_user_month ON ai_reports (user_id, month, id DESC);
CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  calls INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- Upgrade dari versi tanpa login: tambahkan user_id (dibiarkan kosong sampai diklaim lewat npm run db:claim)
ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','import'));
ALTER TABLE wallets       ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE categories    ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transactions  ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE transfers     ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE budgets       ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE goals         ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE goal_deposits ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;

-- Nama kategori harus unik per pengguna, bukan global
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_type ON categories (user_id, name, type);

CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions (wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_dep_goal ON goal_deposits (goal_id);
-- Dompet dan kategori awal dibuat otomatis saat pengguna mendaftar (lihat auth.js)
