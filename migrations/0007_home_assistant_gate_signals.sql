CREATE TABLE IF NOT EXISTS gate_signals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT    NOT NULL,
  entity_id  TEXT,
  state      TEXT    NOT NULL,
  occurred_at TEXT   NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gate_signals_entity_occurred
  ON gate_signals(entity_id, occurred_at DESC);
