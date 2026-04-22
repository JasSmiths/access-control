import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { emit } from "@/lib/events-bus";
import { normalisePlate } from "@/lib/webhook";
import type { ContractorRow } from "@/lib/sessions";

export const dynamic = "force-dynamic";

async function requireAuth() {
  const s = await getSession();
  return s ? null : new Response("Unauthorized", { status: 401 });
}

function getContractor(id: number) {
  return getDb()
    .prepare("SELECT * FROM contractors WHERE id = ?")
    .get(id) as ContractorRow | undefined;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireAuth();
  if (unauth) return unauth;
  const { id } = await params;
  const row = getContractor(Number(id));
  if (!row) return new Response("Not found", { status: 404 });
  return Response.json(row);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const numericId = Number(id);
  const existing = getContractor(numericId);
  if (!existing) return new Response("Not found", { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const b = (body ?? {}) as Partial<ContractorRow>;

  const fields: Record<string, string | number | null> = {};
  if (b.name !== undefined) fields.name = String(b.name).trim();
  if (b.role !== undefined) fields.role = b.role ? String(b.role).trim() : null;
  if (b.vehicle_reg !== undefined) {
    const reg = normalisePlate(String(b.vehicle_reg));
    if (reg.length < 2) return new Response("vehicle_reg too short", { status: 400 });
    fields.vehicle_reg = reg;
  }
  if (b.phone !== undefined) fields.phone = b.phone ? String(b.phone).trim() : null;
  if (b.email !== undefined) fields.email = b.email ? String(b.email).trim() : null;
  if (b.notes !== undefined) fields.notes = b.notes ? String(b.notes).trim() : null;
  if (b.active !== undefined) fields.active = b.active ? 1 : 0;
  if (b.allowed_hours !== undefined) fields.allowed_hours = b.allowed_hours ? String(b.allowed_hours).trim() : null;
  if (b.allowed_days !== undefined) fields.allowed_days = b.allowed_days ? String(b.allowed_days).trim() : "all";

  const keys = Object.keys(fields);
  if (keys.length === 0) return Response.json(existing);

  const before = existing as Record<string, unknown>;
  const changes = keys.map((k) => ({
    field: k,
    before: before[k],
    after: fields[k],
  }));

  const sql = `UPDATE contractors SET ${keys
    .map((k) => `${k} = ?`)
    .join(", ")}, updated_at = datetime('now') WHERE id = ?`;

  try {
    getDb()
      .prepare(sql)
      .run(...keys.map((k) => fields[k]), numericId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "update failed";
    if (msg.includes("UNIQUE") && msg.includes("vehicle_reg")) {
      return new Response("Vehicle reg already in use", { status: 409 });
    }
    return new Response(msg, { status: 500 });
  }
  const row = getContractor(numericId)!;
  auditLog({
    level: "info",
    category: "contractors",
    action: "contractor.updated",
    message: `Contractor ${row.name} updated (${changes.length} field${changes.length === 1 ? "" : "s"}).`,
    request,
    actor: session.username,
    contractorId: numericId,
    details: { changes },
  });
  emit("contractor.updated", { contractorId: numericId });
  return Response.json(row);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const numericId = Number(id);
  const existing = getContractor(numericId);
  if (!existing) return new Response("Not found", { status: 404 });
  getDb().prepare("DELETE FROM contractors WHERE id = ?").run(numericId);
  auditLog({
    level: "info",
    category: "contractors",
    action: "contractor.deleted",
    message: `Contractor ${existing.name} (${existing.vehicle_reg}) deleted.`,
    request: req,
    actor: session.username,
    contractorId: numericId,
  });
  emit("contractor.updated", { contractorId: numericId });
  return Response.json({ ok: true });
}
