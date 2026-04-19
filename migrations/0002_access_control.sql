-- 0002_access_control.sql
-- Adds per-contractor access-control rules and a global settings table.

PRAGMA foreign_keys = ON;

-- allowed_hours: "HH:MM-HH:MM" e.g. "07:00-19:00", NULL = unrestricted
-- allowed_days:  "all" | "weekdays" | "weekends" | "custom:Mon,Tue,Wed,Thu,Fri"
ALTER TABLE contractors ADD COLUMN allowed_hours TEXT;
ALTER TABLE contractors ADD COLUMN allowed_days  TEXT NOT NULL DEFAULT 'all';

-- Global singleton settings row (id always = 1)
CREATE TABLE IF NOT EXISTS settings (
  id                   INTEGER PRIMARY KEY CHECK (id = 1),
  site_address         TEXT,
  apprise_url          TEXT,
  notif_arrived        INTEGER NOT NULL DEFAULT 0,
  notif_exited         INTEGER NOT NULL DEFAULT 0,
  notif_unauthorized   INTEGER NOT NULL DEFAULT 0,
  notif_flagged        INTEGER NOT NULL DEFAULT 0,
  report_sections      TEXT,   -- JSON array of section keys (order + visibility)
  report_theme_color   TEXT,   -- hex string e.g. "#2563eb"
  report_company_name  TEXT,
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (id) VALUES (1);
