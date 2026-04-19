import { getSession } from "@/lib/auth";
import { loadEventsPageData } from "@/lib/events-page";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const data = loadEventsPageData(limit);
  return Response.json(data);
}
