PRAGMA foreign_keys = ON;

ALTER TABLE gate_events ADD COLUMN ingest_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gate_events_ingest_key
  ON gate_events(ingest_key)
  WHERE ingest_key IS NOT NULL;
