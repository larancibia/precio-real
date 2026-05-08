-- precio-real D1 schema
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS products (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  url        TEXT    UNIQUE NOT NULL,
  title      TEXT,
  seller     TEXT,
  image_url  TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS prices (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price      REAL    NOT NULL,
  currency   TEXT    NOT NULL DEFAULT 'ARS',
  scraped_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_products_url        ON products(url);
CREATE INDEX IF NOT EXISTS idx_prices_product_id   ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_scraped_at   ON prices(scraped_at DESC);
