-- Admin auth schema (PostgreSQL).
-- Location data stays in Hyperbase; only admin users live here.
-- gen_random_uuid() is a core function since PostgreSQL 13 (no pgcrypto needed).

CREATE TABLE IF NOT EXISTS admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'admin',
  created_at    timestamptz NOT NULL DEFAULT now()
);
