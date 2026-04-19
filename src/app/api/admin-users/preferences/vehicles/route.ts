import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import {
  getAdminVehicleGroupOrder,
  updateAdminVehicleGroupOrder,
} from "@/lib/admin-preferences";
import { isVehicleGroupKey } from "@/lib/vehicle-groups";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  return Response.json({ order: getAdminVehicleGroupOrder(session.userId) });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const rawOrder = (body as { order?: unknown } | null)?.order;
  if (!Array.isArray(rawOrder)) {
    return new Response("Invalid order payload", { status: 400 });
  }

  const order = rawOrder.map((value) => String(value).trim().toLowerCase());
  if (order.length !== 4 || new Set(order).size !== 4 || !order.every(isVehicleGroupKey)) {
    return new Response("Invalid order values", { status: 400 });
  }

  const normalized = updateAdminVehicleGroupOrder(session.userId, order);
  auditLog({
    category: "settings",
    action: "vehicles.order_updated",
    message: `Vehicle group order updated by ${session.username}.`,
    request,
    actor: session.username,
    details: { order: normalized },
  });

  return Response.json({ ok: true, order: normalized });
}
