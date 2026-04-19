import "server-only";
import { getDb } from "./db";

export type GateSignalRow = {
  id: number;
  source: string;
  entity_id: string | null;
  state: string;
  occurred_at: string;
  created_at: string;
};

export function recordGateSignal(args: {
  source: string;
  entityId?: string | null;
  state: string;
  occurredAt: string;
}) {
  const result = getDb()
    .prepare(
      `INSERT INTO gate_signals (source, entity_id, state, occurred_at)
       VALUES (?, ?, ?, ?)`
    )
    .run(args.source, args.entityId ?? null, args.state, args.occurredAt);

  return Number(result.lastInsertRowid);
}

export function getLatestGateSignal(entityId?: string | null): GateSignalRow | null {
  const row = entityId
    ? (getDb()
        .prepare(
          `SELECT id, source, entity_id, state, occurred_at, created_at
             FROM gate_signals
            WHERE entity_id = ?
            ORDER BY occurred_at DESC
            LIMIT 1`
        )
        .get(entityId) as GateSignalRow | undefined)
    : (getDb()
        .prepare(
          `SELECT id, source, entity_id, state, occurred_at, created_at
             FROM gate_signals
            ORDER BY occurred_at DESC
            LIMIT 1`
        )
        .get() as GateSignalRow | undefined);

  return row ?? null;
}

export function wasGateOpenedRecently(args?: {
  entityId?: string | null;
  withinSeconds?: number;
}) {
  const latest = getLatestGateSignal(args?.entityId);
  if (!latest) return false;
  if (latest.state !== "open" && latest.state !== "opening") return false;

  const occurredMs = Date.parse(latest.occurred_at);
  if (!Number.isFinite(occurredMs)) return false;

  const withinSeconds = Math.max(1, args?.withinSeconds ?? 30);
  return Date.now() - occurredMs <= withinSeconds * 1000;
}
