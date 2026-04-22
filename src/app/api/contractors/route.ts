import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { emit } from "@/lib/events-bus";
import { normalisePlate } from "@/lib/webhook";
import type { ContractorRow } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const rows = getDb()
    .prepare("SELECT * FROM contractors ORDER BY name ASC")
    .all() as ContractorRow[];
  return Response.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const b = (body ?? {}) as Partial<ContractorRow> & { vehicle_reg?: string };
  if (!b.name || !b.vehicle_reg) {
    return new Response("name and vehicle_reg required", { status: 400 });
  }
  const reg = normalisePlate(b.vehicle_reg);
  if (reg.length < 2) return new Response("vehicle_reg too short", { status: 400 });

  try {
    const info = getDb()
      .prepare(
        `INSERT INTO contractors (name, role, vehicle_reg, phone, email, notes, active, allowed_hours, allowed_days)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(b.name).trim(),
        b.role ? String(b.role).trim() : null,
        reg,
        b.phone ? String(b.phone).trim() : null,
        b.email ? String(b.email).trim() : null,
        b.notes ? String(b.notes).trim() : null,
        b.active === 0 ? 0 : 1,
        b.allowed_hours ? String(b.allowed_hours).trim() : null,
        b.allowed_days ? String(b.allowed_days).trim() : "all"
      );
    const row = getDb()
      .prepare("SELECT * FROM contractors WHERE id = ?")
      .get(info.lastInsertRowid) as ContractorRow;
    auditLog({
      level: "info",
      category: "contractors",
      action: "contractor.created",
      message: `Contractor ${row.name} (${row.vehicle_reg}) created.`,
      request,
      actor: session.username,
      contractorId: row.id,
      details: {
        role: row.role,
        active: row.active,
        allowed_hours: row.allowed_hours,
        allowed_days: row.allowed_days,
      },
    });
    emit("contractor.updated", { contractorId: row.id });
    return Response.json(row, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "insert failed";
    if (msg.includes("UNIQUE") && msg.includes("vehicle_reg")) {
      return new Response("Vehicle reg already in use", { status: 409 });
    }
    return new Response(msg, { status: 500 });
  }
}
