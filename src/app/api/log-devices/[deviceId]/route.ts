import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { upsertDeviceName } from "@/lib/logs";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ deviceId: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { deviceId } = await params;
  if (!deviceId || deviceId.trim().length < 2) {
    return new Response("Invalid device id", { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const name = typeof (body as { name?: unknown })?.name === "string"
    ? (body as { name: string }).name.trim()
    : "";
  if (name.length < 2) {
    return new Response("Name must be at least 2 characters", { status: 400 });
  }

  upsertDeviceName(deviceId, name);
  auditLog({
    category: "logs",
    action: "logs.device_named",
    message: `Device ${deviceId} named as "${name}".`,
    request,
    actor: session.username,
    deviceId,
  });

  return Response.json({ ok: true, deviceId, name });
}
