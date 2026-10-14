-- YusrFlow schema for Supabase / PostgreSQL.
-- Paste this into the Supabase SQL editor to provision the database by hand.
-- This must stay in sync with the SCHEMA_SQL constant in server/src/db.ts
-- (ensureSchema() runs the same statements automatically on server boot).

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  risk TEXT NOT NULL,
  user_count INTEGER NOT NULL,
  cost_per_user DOUBLE PRECISION NOT NULL,
  flat_monthly_cost DOUBLE PRECISION NOT NULL,
  billing_cycle TEXT NOT NULL,
  renewal_date TEXT NOT NULL,
  source TEXT NOT NULL,
  spec TEXT NOT NULL,
  compliance_score INTEGER,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS control_results (
  app_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  framework TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence TEXT NOT NULL,
  PRIMARY KEY (app_id, code)
);

CREATE TABLE IF NOT EXISTS issues (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  framework TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date TEXT,
  guide TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  UNIQUE (app_id, code)
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  app_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  happened_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  provider TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  connected_at TEXT,
  last_discovery_at TEXT,
  detail TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  html TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
