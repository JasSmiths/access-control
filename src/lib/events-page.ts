import "server-only";
import { getDb } from "./db";

export type EventRow = {
  id: number;
  contractor_id: number;
  contractor_name: string;
  contractor_role: string | null;
  event_type: "enter" | "exit";
  occurred_at: string;
  source: string | null;
  next_enter_at: string | null;
  previous_exit_at: string | null;
};

export type SessionListRow = {
  id: number;
  contractor_id: number;
  contractor_name: string;
  contractor_role: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: "open" | "closed" | "flagged";
  notes: string | null;
};

export type EventsPageData = {
  events: EventRow[];
  sessions: SessionListRow[];
};

export function loadEventsPageData(limit = 100): EventsPageData {
  const db = getDb();
  const safeLimit = Math.min(500, Math.max(1, limit));

  const events = db
    .prepare(
      `SELECT e.id,
              e.contractor_id,
              c.name AS contractor_name,
              c.role AS contractor_role,
              e.event_type,
              e.occurred_at,
              e.source,
              (
                SELECT MIN(e2.occurred_at)
                  FROM gate_events e2
                 WHERE e2.contractor_id = e.contractor_id
                   AND e2.event_type = 'enter'
                   AND e2.occurred_at > e.occurred_at
              ) AS next_enter_at,
              (
                SELECT MAX(e3.occurred_at)
                  FROM gate_events e3
                 WHERE e3.contractor_id = e.contractor_id
                   AND e3.event_type = 'exit'
                   AND e3.occurred_at < e.occurred_at
              ) AS previous_exit_at
         FROM gate_events e
         JOIN contractors c ON c.id = e.contractor_id
        ORDER BY e.occurred_at DESC
        LIMIT ?`
    )
    .all(safeLimit) as EventRow[];

  const sessions = db
    .prepare(
      `SELECT s.id, s.contractor_id, c.name AS contractor_name, c.role AS contractor_role, s.started_at, s.ended_at,
              s.duration_seconds, s.status, s.notes
         FROM sessions s
         JOIN contractors c ON c.id = s.contractor_id
        ORDER BY s.started_at DESC
        LIMIT ?`
    )
    .all(safeLimit) as SessionListRow[];

  return { events, sessions };
}
