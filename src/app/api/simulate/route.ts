/**
 * GET /api/simulate?plate=ABC123&event=enter&source=test&timestamp=2024-01-01T12:00:00Z
 *
 * Simulates a gate event for testing. Requires an active login session.
 * - plate    (required) vehicle registration plate
 * - event    (required) "enter" or "exit"
 * - source   (optional) defaults to "simulate"
 * - timestamp (optional) ISO string, defaults to now
 *
 * Returns JSON describing what happened.
 */

import { getSession } from "@/lib/auth";
import { findActiveContractorByPlate, ingestEvent } from "@/lib/sessions";
import { normalisePlate } from "@/lib/webhook";
import { getDb } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import type { ContractorRow } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    auditLog({
      level: "warn",
      category: "simulate",
      action: "simulate.unauthorized",
      message: "Simulate endpoint rejected due to missing session.",
      request,
    });
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawPlate = searchParams.get("plate");
  const event = searchParams.get("event");
  const source = searchParams.get("source") ?? "simulate";
  const tsParam = searchParams.get("timestamp");

  // If no params, return list of active contractors for reference
  if (!rawPlate && !event) {
    const contractors = getDb()
      .prepare("SELECT id, name, vehicle_reg, role FROM contractors WHERE active = 1 ORDER BY name ASC")
      .all() as Pick<ContractorRow, "id" | "name" | "vehicle_reg" | "role">[];

    auditLog({
      category: "simulate",
      action: "simulate.list",
      message: "Listed active contractors for simulation.",
      request,
      actor: session.username,
    });
    return Response.json({
      hint: "Pass ?plate=REG&event=enter (or exit) to simulate a gate event.",
      active_contractors: contractors.map((c) => ({
        id: c.id,
        name: c.name,
        vehicle_reg: c.vehicle_reg,
        role: c.role,
        simulate_enter: `/api/simulate?plate=${encodeURIComponent(c.vehicle_reg)}&event=enter`,
        simulate_exit:  `/api/simulate?plate=${encodeURIComponent(c.vehicle_reg)}&event=exit`,
      })),
    });
  }

  // Validate required params
  if (!rawPlate) {
    auditLog({
      level: "warn",
      category: "simulate",
      action: "simulate.invalid_input",
      message: "Simulation failed: missing plate.",
      request,
      actor: session.username,
    });
    return new Response("plate is required", { status: 400 });
  }
  if (event !== "enter" && event !== "exit") {
    auditLog({
      level: "warn",
      category: "simulate",
      action: "simulate.invalid_input",
      message: "Simulation failed: invalid event type.",
      request,
      actor: session.username,
    });
    return new Response('event must be "enter" or "exit"', { status: 400 });
  }

  // Parse timestamp
  const occurredAt = tsParam
    ? new Date(tsParam).toISOString()
    : new Date().toISOString();
  if (Number.isNaN(Date.parse(occurredAt))) {
    auditLog({
      level: "warn",
      category: "simulate",
      action: "simulate.invalid_input",
      message: "Simulation failed: invalid timestamp.",
      request,
      actor: session.username,
    });
    return new Response("invalid timestamp", { status: 400 });
  }

  const plate = normalisePlate(rawPlate);
  const contractor = findActiveContractorByPlate(plate);
  if (!contractor) {
    const all = getDb()
      .prepare("SELECT vehicle_reg, name FROM contractors WHERE active = 1 ORDER BY name")
      .all() as { vehicle_reg: string; name: string }[];
    auditLog({
      level: "warn",
      category: "simulate",
      action: "simulate.contractor_not_found",
      message: `Simulation failed: no active contractor for plate ${plate}.`,
      request,
      actor: session.username,
      plate,
    });
    return Response.json(
      {
        ok: false,
        error: `No active contractor with plate "${plate}"`,
        active_plates: all.map((c) => `${c.vehicle_reg} (${c.name})`),
      },
      { status: 404 }
    );
  }

  const { eventId, emits } = ingestEvent({
    contractorId: contractor.id,
    plateRaw: rawPlate,
    eventType: event,
    occurredAt,
    source,
    contractor,
  });

  auditLog({
    category: "simulate",
    action: "simulate.ingested",
    message: `Simulated ${event} event for ${contractor.name}.`,
    request,
    actor: session.username,
    contractorId: contractor.id,
    plate,
    details: { source, emitted: emits.map((e) => e.name), eventId },
  });

  return Response.json({
    ok: true,
    event_id: eventId,
    contractor: { id: contractor.id, name: contractor.name },
    plate,
    event,
    occurred_at: occurredAt,
    source,
    emitted: emits.map((e) => e.name),
  });
}
