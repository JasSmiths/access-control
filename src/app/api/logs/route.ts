import { getSession } from "@/lib/auth";
import { loadLogs } from "@/lib/logs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 200);
  const rows = loadLogs(limit);
  return Response.json({ rows });
}
