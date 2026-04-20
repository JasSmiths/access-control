import { getSession } from "@/lib/auth";
import { listActiveApiStreams } from "@/lib/api-streams";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  return Response.json({ streams: listActiveApiStreams() });
}
