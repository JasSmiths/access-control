-- 0003_webhook_tests.sql
-- Stores UniFi test-event pings (eventId === "testEventId") for connectivity verification.

CREATE TABLE IF NOT EXISTS webhook_tests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  device      TEXT    NOT NULL,
  source      TEXT,
  occurred_at TEXT    NOT NULL,
  received_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
