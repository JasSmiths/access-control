import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { forceExitOpenSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    auditLog({
      level: "warn",
      category: "sessions",
      action: "session.force_exit_unauthorized",
      message: "Force exit rejected: unauthorized.",
      request: _request,
    });
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const sessionId = Number(id);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return new Response("Invalid session id", { status: 400 });
  }

  try {
    const result = forceExitOpenSession(sessionId);
    auditLog({
      category: "sessions",
      action: "session.force_exit",
      message: `Session ${sessionId} force exited by ${session.username}.`,
      request: _request,
      actor: session.username,
      details: { eventId: result.eventId, occurredAt: result.occurredAt },
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Force exit failed";
    auditLog({
      level: "warn",
      category: "sessions",
      action: "session.force_exit_failed",
      message: `Force exit failed for session ${sessionId}: ${message}`,
      request: _request,
      actor: session.username,
    });
    if (message === "Open session not found") {
      return new Response(message, { status: 404 });
    }
    if (message === "Session is no longer the active open session") {
      return new Response(message, { status: 409 });
    }
    return new Response(message, { status: 500 });
  }
}
