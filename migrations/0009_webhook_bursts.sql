PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS webhook_bursts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  source              TEXT    NOT NULL,
  first_received_at   TEXT    NOT NULL,
  last_received_at    TEXT    NOT NULL,
  expires_at          TEXT    NOT NULL,
  status              TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'processed', 'ignored')),
  chosen_candidate_id INTEGER REFERENCES webhook_burst_candidates(id),
  chosen_contractor_id INTEGER REFERENCES contractors(id) ON DELETE SET NULL,
  chosen_plate        TEXT,
  event_type          TEXT    CHECK (event_type IN ('enter', 'exit')),
  gate_event_id       INTEGER REFERENCES gate_events(id) ON DELETE SET NULL,
  processed_at        TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_webhook_bursts_source_expiry
  ON webhook_bursts(source, expires_at);

CREATE TABLE IF NOT EXISTS webhook_burst_candidates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  burst_id         INTEGER NOT NULL REFERENCES webhook_bursts(id) ON DELETE CASCADE,
  ingest_key       TEXT,
  source           TEXT    NOT NULL,
  device_id        TEXT,
  event_id         TEXT,
  plate_raw        TEXT    NOT NULL,
  plate_normalized TEXT    NOT NULL,
  occurred_at      TEXT    NOT NULL,
  received_at      TEXT    NOT NULL,
  event_type       TEXT    NOT NULL,
  contractor_id    INTEGER REFERENCES contractors(id) ON DELETE SET NULL,
  is_known         INTEGER NOT NULL DEFAULT 0,
  was_selected     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_webhook_burst_candidates_burst
  ON webhook_burst_candidates(burst_id, received_at DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_burst_candidates_ingest_key
  ON webhook_burst_candidates(ingest_key)
  WHERE ingest_key IS NOT NULL;
