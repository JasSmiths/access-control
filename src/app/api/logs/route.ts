import { getSession } from "@/lib/auth";
import { clearLogs, loadLogsPage } from "@/lib/logs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
  return Response.json(loadLogsPage(page, pageSize));
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const deleted = clearLogs();
  return Response.json({ ok: true, deleted });
}
