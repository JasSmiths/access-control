PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS api_keys (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  key_prefix    TEXT    NOT NULL,
  key_hash      TEXT    NOT NULL UNIQUE,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT,
  revoked_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_api_keys_admin_user ON api_keys(admin_user_id, created_at);

CREATE TABLE IF NOT EXISTS integration_devices (
  device_id   TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  level         TEXT    NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  category      TEXT    NOT NULL,
  action        TEXT    NOT NULL,
  message       TEXT    NOT NULL,
  ip            TEXT,
  method        TEXT,
  path          TEXT,
  actor         TEXT,
  contractor_id INTEGER,
  plate         TEXT,
  device_id     TEXT,
  event_id      TEXT,
  details_json  TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred ON audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_device ON audit_logs(device_id, occurred_at DESC);
