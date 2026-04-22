PRAGMA foreign_keys = ON;

ALTER TABLE settings
  ADD COLUMN log_level TEXT NOT NULL DEFAULT 'debug'
  CHECK (log_level IN ('errors', 'debug'));
