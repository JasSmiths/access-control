import { loadDashboard } from "@/lib/dashboard";
import { verifyApiKey } from "@/lib/api-keys";
import { auditLog } from "@/lib/audit";
import { getLatestGateSignal } from "@/lib/gate-signals";

export const dynamic = "force-dynamic";

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, value] = auth.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim();
}

export async function GET(request: Request) {
  const token = extractBearerToken(request);
  if (!token) {
    auditLog({
      level: "warn",
      category: "api",
      action: "api.auth_failed",
      message: "API request rejected: missing bearer token.",
      request,
      path: "/api/v1/status",
    });
    return new Response("Missing bearer token", { status: 401 });
  }

  const key = verifyApiKey(token);
  if (!key) {
    auditLog({
      level: "warn",
      category: "api",
      action: "api.auth_failed",
      message: "API request rejected: invalid API key.",
      request,
      path: "/api/v1/status",
    });
    return new Response("Invalid API key", { status: 401 });
  }

  const snapshot = loadDashboard();
  auditLog({
    category: "api",
    action: "api.request",
    message: "API status endpoint called.",
    request,
    path: "/api/v1/status",
    actor: `api_key:${key.key_prefix}`,
  });

  return Response.json({
    ok: true,
    generated_at: new Date().toISOString(),
    contractors: snapshot.contractors,
    people: snapshot.people,
    on_site: snapshot.openSessions.length,
    flagged_today: snapshot.flaggedToday,
    open_sessions: snapshot.openSessions,
    recent_events: snapshot.recent,
    latest_gate_signal: getLatestGateSignal(),
  });
}
