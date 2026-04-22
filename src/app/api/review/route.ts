import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { isReviewReason, type FlaggedSessionRow } from "@/lib/review";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const rows = getDb()
    .prepare(
      `SELECT s.id, s.contractor_id, c.name AS contractor_name,
              s.started_at, s.ended_at, s.duration_seconds, s.notes,
              s.review_reason, s.review_note, s.reviewed_at
         FROM sessions s
         JOIN contractors c ON c.id = s.contractor_id
        WHERE s.status = 'flagged'
        ORDER BY s.started_at DESC
        LIMIT 200`
    )
    .all() as FlaggedSessionRow[];

  return Response.json(rows);
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { sessionId?: unknown; reason?: unknown; note?: unknown }
    | null;

  const sessionId =
    typeof body?.sessionId === "number" && Number.isInteger(body.sessionId)
      ? body.sessionId
      : NaN;

  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return new Response("Invalid session id", { status: 400 });
  }

  if (!isReviewReason(body?.reason)) {
    return new Response("Invalid review reason", { status: 400 });
  }

  const note =
    typeof body?.note === "string" ? body.note.trim() : body?.note == null ? "" : null;

  if (note === null) {
    return new Response("Invalid review note", { status: 400 });
  }

  if (body.reason === "Other" && !note) {
    return new Response("Review note is required for Other", { status: 400 });
  }

  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM sessions WHERE id = ? AND status = 'flagged'")
    .get(sessionId) as { id: number } | undefined;

  if (!existing) {
    return new Response("Flagged session not found", { status: 404 });
  }

  db.prepare(
    `UPDATE sessions
        SET status = 'closed',
            review_reason = ?,
            review_note = ?,
            reviewed_at = ?
      WHERE id = ?`
  ).run(body.reason, note || null, new Date().toISOString(), sessionId);

  const reviewed = db
    .prepare(
      `SELECT s.id, s.contractor_id, c.name AS contractor_name
         FROM sessions s
         JOIN contractors c ON c.id = s.contractor_id
        WHERE s.id = ?`
    )
    .get(sessionId) as { id: number; contractor_id: number; contractor_name: string } | undefined;

  auditLog({
    level: "info",
    category: "review",
    action: "review.resolved",
    message: `Session ${sessionId} reviewed as ${body.reason}.`,
    request,
    actor: session.username,
    contractorId: reviewed?.contractor_id ?? null,
    details: {
      contractor: reviewed?.contractor_name ?? null,
      reason: body.reason,
      note: note || null,
      outcome: "closed",
    },
  });

  return Response.json({ ok: true });
}
