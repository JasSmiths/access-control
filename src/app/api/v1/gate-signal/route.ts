import { verifyApiKey } from "@/lib/api-keys";
import { auditLog } from "@/lib/audit";
import { recordGateSignal, getLatestGateSignal } from "@/lib/gate-signals";

export const dynamic = "force-dynamic";

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, value] = auth.split(" ");
  if (!scheme || !value) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return value.trim();
}

export async function POST(request: Request) {
  const token = extractBearerToken(request);
  if (!token) return new Response("Missing bearer token", { status: 401 });

  const key = verifyApiKey(token);
  if (!key) return new Response("Invalid API key", { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const body = payload as
    | {
        entity_id?: unknown;
        state?: unknown;
        occurred_at?: unknown;
        source?: unknown;
      }
    | undefined;

  const state = typeof body?.state === "string" ? body.state.trim() : "";
  const occurredAt =
    typeof body?.occurred_at === "string" ? body.occurred_at.trim() : "";
  const entityId =
    typeof body?.entity_id === "string" ? body.entity_id.trim() : null;
  const source =
    typeof body?.source === "string" && body.source.trim().length > 0
      ? body.source.trim()
      : "home_assistant";

  if (!state || !occurredAt || Number.isNaN(Date.parse(occurredAt))) {
    return new Response("Invalid gate signal payload", { status: 400 });
  }

  const signalId = recordGateSignal({
    source,
    entityId,
    state,
    occurredAt,
  });

  auditLog({
    category: "api",
    action: "api.gate_signal_received",
    message: `Gate signal received from ${source}: ${state}.`,
    request,
    path: "/api/v1/gate-signal",
    actor: `api_key:${key.key_prefix}`,
    details: { signalId, entityId, state, occurredAt, source },
  });

  return Response.json({
    ok: true,
    signal_id: signalId,
    latest_gate_signal: getLatestGateSignal(entityId),
  });
}
