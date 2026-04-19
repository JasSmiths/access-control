import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = getDb()
    .prepare(
      `SELECT id, device, source, occurred_at, received_at
       FROM webhook_tests
       ORDER BY received_at DESC
       LIMIT 20`
    )
    .all();
  return Response.json(rows);
}
