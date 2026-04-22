import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { createApiKey, listApiKeys } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const keys = listApiKeys(session.userId);
  return Response.json({ keys });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const created = createApiKey(session.userId, session.username);
  auditLog({
    level: "info",
    category: "api",
    action: "api.key_created",
    message: `API key created by ${session.username}.`,
    request,
    actor: session.username,
    details: { keyPrefix: created.keyPrefix },
  });

  return Response.json({
    id: created.id,
    keyPrefix: created.keyPrefix,
    token: created.token,
  });
}
