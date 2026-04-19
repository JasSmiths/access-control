import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { revokeApiKey } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const keyId = Number(id);
  if (!Number.isInteger(keyId) || keyId <= 0) {
    return new Response("Invalid API key id", { status: 400 });
  }

  const revoked = revokeApiKey(session.userId, keyId);
  if (!revoked) return new Response("API key not found", { status: 404 });

  auditLog({
    category: "api",
    action: "api.key_deleted",
    message: `API key ${keyId} deleted by ${session.username}.`,
    request,
    actor: session.username,
    details: { keyId },
  });

  return Response.json({ ok: true });
}
