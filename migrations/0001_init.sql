-- 0001_init.sql
-- Initial schema for Crest House Access Control System. See AGENTS.md §"Database schema".

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS contractors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  role        TEXT,
  vehicle_reg TEXT    NOT NULL UNIQUE,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contractors_reg ON contractors(vehicle_reg);

CREATE TABLE IF NOT EXISTS gate_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  plate_raw     TEXT    NOT NULL,
  event_type    TEXT    NOT NULL CHECK (event_type IN ('enter','exit')),
  occurred_at   TEXT    NOT NULL,
  source        TEXT,
  received_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_contractor_time ON gate_events(contractor_id, occurred_at);

CREATE TABLE IF NOT EXISTS sessions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  contractor_id    INTEGER NOT NULL REFERENCES contractors(id) ON DELETE CASCADE,
  enter_event_id   INTEGER NOT NULL REFERENCES gate_events(id),
  exit_event_id    INTEGER          REFERENCES gate_events(id),
  started_at       TEXT    NOT NULL,
  ended_at         TEXT,
  duration_seconds INTEGER,
  status           TEXT    NOT NULL CHECK (status IN ('open','closed','flagged')),
  notes            TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_contractor_started ON sessions(contractor_id, started_at);
