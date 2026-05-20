-- Precio Real FastAPI/Postgres ingestion schema.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  url TEXT UNIQUE NOT NULL,
  title TEXT,
  seller TEXT,
  image_url TEXT,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::BIGINT
);

CREATE TABLE IF NOT EXISTS prices (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ARS',
  scraped_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM now())::BIGINT
);

CREATE INDEX IF NOT EXISTS idx_products_url ON products(url);
CREATE INDEX IF NOT EXISTS idx_prices_product_id ON prices(product_id);
CREATE INDEX IF NOT EXISTS idx_prices_scraped_at ON prices(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_prices_product_scraped ON prices(product_id, scraped_at DESC);
