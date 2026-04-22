import { clearSession, getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  await clearSession();
  if (session) {
    auditLog({
      level: "info",
      category: "auth",
      action: "auth.logout",
      message: `User ${session.username} logged out.`,
      request,
      actor: session.username,
    });
  }
  return Response.json({ ok: true });
}
