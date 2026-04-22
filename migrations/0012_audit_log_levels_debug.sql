PRAGMA foreign_keys = ON;

ALTER TABLE audit_logs RENAME TO audit_logs_legacy_levels;

CREATE TABLE audit_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  level         TEXT    NOT NULL CHECK (level IN ('debug', 'info', 'error')),
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

INSERT INTO audit_logs (
  id,
  occurred_at,
  level,
  category,
  action,
  message,
  ip,
  method,
  path,
  actor,
  contractor_id,
  plate,
  device_id,
  event_id,
  details_json
)
SELECT
  id,
  occurred_at,
  CASE
    WHEN level = 'warn' THEN 'debug'
    WHEN level IN ('debug', 'info', 'error') THEN level
    ELSE 'info'
  END AS level,
  category,
  action,
  message,
  ip,
  method,
  path,
  actor,
  contractor_id,
  plate,
  device_id,
  event_id,
  details_json
FROM audit_logs_legacy_levels;

DROP TABLE audit_logs_legacy_levels;

CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred ON audit_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_device ON audit_logs(device_id, occurred_at DESC);
