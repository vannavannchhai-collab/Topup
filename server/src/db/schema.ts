/**
 * NOVA database schema. Pure SQL, applied idempotently on boot.
 * Money is stored in integer cents (USD) to avoid floating point drift.
 */
export const SCHEMA_SQL = /* sql */ `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'customer',
  phone         TEXT,
  locale        TEXT NOT NULL DEFAULT 'km',
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  points        INTEGER NOT NULL DEFAULT 0,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  sku           TEXT NOT NULL UNIQUE,
  name_en       TEXT NOT NULL,
  name_km       TEXT NOT NULL,
  category      TEXT NOT NULL,
  provider      TEXT NOT NULL,
  face_value_cents INTEGER NOT NULL,
  price_cents   INTEGER NOT NULL,
  data_gb       REAL,
  minutes       INTEGER,
  validity_days INTEGER,
  description_en TEXT NOT NULL DEFAULT '',
  description_km TEXT NOT NULL DEFAULT '',
  tags          TEXT NOT NULL DEFAULT '',
  badge         TEXT,
  popularity    REAL NOT NULL DEFAULT 0.5,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id            TEXT PRIMARY KEY,
  reference     TEXT NOT NULL UNIQUE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id    TEXT NOT NULL REFERENCES products(id),
  recipient     TEXT NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  amount_cents  INTEGER NOT NULL,
  points_earned INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'paid',
  delivery_code TEXT,
  risk_score    REAL NOT NULL DEFAULT 0,
  risk_flags    TEXT NOT NULL DEFAULT '[]',
  channel       TEXT NOT NULL DEFAULT 'web',
  idempotency_key TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  reference   TEXT,
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL,
  content         TEXT NOT NULL,
  meta            TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  name       TEXT NOT NULL,
  payload    TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user   ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user       ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_conv      ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_products_cat  ON products(category, active);
CREATE INDEX IF NOT EXISTS idx_events_name   ON events(name, created_at DESC);
`;

/** Indexes that depend on additive migrations (run after they are applied). */
export const POST_MIGRATION_SQL = /* sql */ `
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idem ON orders(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
`;
