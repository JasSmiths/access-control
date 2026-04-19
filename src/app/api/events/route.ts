import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

  const events = getDb()
    .prepare(
      `SELECT e.id, e.contractor_id, c.name AS contractor_name, e.plate_raw,
              e.event_type, e.occurred_at, e.source, e.received_at
         FROM gate_events e
         JOIN contractors c ON c.id = e.contractor_id
        ORDER BY e.occurred_at DESC
        LIMIT ?`
    )
    .all(limit);
  return Response.json({ events });
}
