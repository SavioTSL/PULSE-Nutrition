CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, version INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT 'PULSE Nutrition',
 category TEXT NOT NULL, description TEXT NOT NULL, label TEXT NOT NULL DEFAULT '',
 image_url TEXT NOT NULL, tag TEXT NOT NULL DEFAULT '', variants JSONB NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, demonstrative BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS store_settings (
 id INTEGER PRIMARY KEY CHECK (id=1), checkout_enabled BOOLEAN NOT NULL DEFAULT FALSE,
 shipping_fee_cents INTEGER CHECK(shipping_fee_cents >= 0), contact_email TEXT NOT NULL DEFAULT '',
 whatsapp TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO store_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS orders (
 id UUID PRIMARY KEY, checkout_key UUID UNIQUE NOT NULL, request_hash TEXT NOT NULL,
 access_hash TEXT NOT NULL, customer JSONB NOT NULL, items JSONB NOT NULL,
 subtotal_cents INTEGER NOT NULL CHECK(subtotal_cents>0), shipping_cents INTEGER NOT NULL CHECK(shipping_cents>=0),
 total_cents INTEGER NOT NULL CHECK(total_cents>0), status TEXT NOT NULL DEFAULT 'creating',
 fulfillment TEXT NOT NULL DEFAULT 'pending', preference_id TEXT, checkout_url TEXT,
 payment_id TEXT, payment_status TEXT, expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS rate_limits (
 key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_expiry_idx ON orders(expires_at) WHERE status IN ('creating','pending');

ALTER TABLE products ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL);
