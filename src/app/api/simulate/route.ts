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
import { POST as handleWebhookGatePost } from "@/app/api/webhooks/gate/route";
import type { ContractorRow } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const LPR_WEBHOOK_SAMPLE_TEMPLATE = {
  alarm: {
    name: "Home Assistant LPR",
    sources: [{ device: "942A6FD09D64", type: "include" }],
    conditions: [{ condition: { type: "is", source: "license_plate_unknown" } }],
    triggers: [
      {
        device: "942A6FD09D64",
        value: "SVA673",
        key: "license_plate_unknown",
        group: { name: "SVA673" },
        zones: { loiter: [], zone: [], line: [] },
        eventId: "template-event-id",
        timestamp: 0,
      },
    ],
    eventPath: "/protect/events/event/template-event-id",
    eventLocalLink: "https://10.0.0.2/protect/events/event/template-event-id",
  },
  timestamp: 0,
};

type SimulatedLprWebhookPayload = {
  alarm: {
    name: string;
    sources: Array<{ device: string; type: string }>;
    conditions: Array<{ condition: { type: string; source: string } }>;
    triggers: Array<{
      device: string;
      value: string;
      key: string;
      group: { name: string };
      zones: { loiter: unknown[]; zone: unknown[]; line: unknown[] };
      eventId: string;
      timestamp: number;
    }>;
    eventPath: string;
    eventLocalLink: string;
  };
  timestamp: number;
};

function buildSimulatedLprWebhookSample(plate: string): SimulatedLprWebhookPayload {
  const eventId = crypto.randomUUID();
  const triggerTimestamp = Date.now();
  const rootTimestamp = triggerTimestamp + 543;
  const normalizedPlate = normalisePlate(plate);
  return {
    alarm: {
      ...LPR_WEBHOOK_SAMPLE_TEMPLATE.alarm,
      triggers: LPR_WEBHOOK_SAMPLE_TEMPLATE.alarm.triggers.map((trigger) => ({
        ...trigger,
        value: normalizedPlate,
        group: { name: normalizedPlate },
        eventId,
        timestamp: triggerTimestamp,
      })),
      eventPath: `/protect/events/event/${eventId}`,
      eventLocalLink: `https://10.0.0.2/protect/events/event/${eventId}`,
    },
    timestamp: rootTimestamp,
  };
}

function withJsonBody(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sanitizeWebhookPlate(input: unknown): string {
  const normalized = normalisePlate(String(input ?? "").trim());
  return normalized || "SVA673";
}

function mutatePlate(plate: string): string {
  if (plate.length < 2) return plate;
  const chars = plate.split("");
  const index = Math.floor(Math.random() * chars.length);
  const swaps: Record<string, string> = {
    S: "5",
    "5": "S",
    A: "4",
    "4": "A",
    O: "0",
    "0": "O",
    I: "1",
    "1": "I",
    T: "7",
    "7": "T",
    B: "8",
    "8": "B",
    G: "6",
    "6": "G",
  };
  chars[index] = swaps[chars[index]] ?? randomPlateChar();
  return chars.join("");
}

function randomPlateChar() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return alphabet[Math.floor(Math.random() * alphabet.length)] ?? "X";
}

function buildMisreadPlateSequence(correctPlate: string): string[] {
  const normalized = sanitizeWebhookPlate(correctPlate);
  const total = 5;
  const correctIndex = Math.floor(Math.random() * total);
  const sequence: string[] = [];
  const seen = new Set<string>([normalized]);

  while (sequence.length < total - 1) {
    let candidate = mutatePlate(normalized);
    if (Math.random() < 0.35 && normalized.length > 3) {
      candidate = normalized.slice(0, Math.max(3, normalized.length - 1));
    }
    candidate = sanitizeWebhookPlate(candidate);
    if (candidate === normalized || seen.has(candidate)) continue;
    seen.add(candidate);
    sequence.push(candidate);
  }

  sequence.splice(correctIndex, 0, normalized);
  return sequence;
}

function buildBurstDelaysMs(count: number, windowMs: number): number[] {
  if (count <= 1) return [0];
  const gaps = count - 1;
  const weights = Array.from({ length: gaps }, () => Math.max(0.1, Math.random()));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const scaled = weights.map((value) => Math.round((value / totalWeight) * windowMs));
  const drift = windowMs - scaled.reduce((sum, value) => sum + value, 0);
  scaled[scaled.length - 1] = Math.max(0, scaled[scaled.length - 1] + drift);
  return [0, ...scaled];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dispatchWebhookSample(args: {
  request: Request;
  webhookSecret: string;
  payload: SimulatedLprWebhookPayload;
}) {
  const webhookUrl = new URL("/api/webhooks/gate", args.request.url);
  const webhookRequest = new Request(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": args.webhookSecret,
    },
    body: JSON.stringify(args.payload),
  });
  const upstream = await handleWebhookGatePost(webhookRequest);
  const raw = await upstream.text();
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw || null;
  }
  return { upstream, parsed };
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    auditLog({
      level: "debug",
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
      level: "debug",
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
      level: "debug",
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
      level: "debug",
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
      level: "debug",
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
      level: "debug",
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
    level: "info",
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

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    auditLog({
      level: "debug",
      category: "simulate",
      action: "simulate.webhook_sample_unauthorized",
      message: "Webhook sample simulation rejected due to missing session.",
      request,
    });
    return new Response("Unauthorized", { status: 401 });
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    auditLog({
      level: "error",
      category: "simulate",
      action: "simulate.webhook_sample_secret_missing",
      message: "Webhook sample simulation failed: WEBHOOK_SECRET is not configured.",
      request,
      actor: session.username,
    });
    return new Response("WEBHOOK_SECRET is not configured", { status: 500 });
  }

  try {
    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }
    const payload = (body ?? {}) as Record<string, unknown>;
    const modeRaw = String(payload.mode ?? "single").trim().toLowerCase();
    const mode = modeRaw === "misread_burst" ? "misread_burst" : "single";
    const plate = sanitizeWebhookPlate(payload.plate);

    if (mode === "misread_burst") {
      const plates = buildMisreadPlateSequence(plate);
      const delays = buildBurstDelaysMs(plates.length, 3000);
      const results: Array<{
        index: number;
        plate: string;
        event_id: string;
        delay_ms: number;
        status: number;
        ok: boolean;
        webhook_response: unknown;
      }> = [];

      for (let i = 0; i < plates.length; i++) {
        const delayMs = delays[i] ?? 0;
        if (i > 0 && delayMs > 0) {
          await sleep(delayMs);
        }
        const samplePayload = buildSimulatedLprWebhookSample(plates[i] ?? plate);
        const eventId = samplePayload.alarm.triggers[0]?.eventId ?? crypto.randomUUID();
        const dispatched = await dispatchWebhookSample({
          request,
          webhookSecret,
          payload: samplePayload,
        });
        results.push({
          index: i + 1,
          plate: plates[i] ?? plate,
          event_id: eventId,
          delay_ms: i === 0 ? 0 : delayMs,
          status: dispatched.upstream.status,
          ok: dispatched.upstream.ok,
          webhook_response: dispatched.parsed,
        });
      }

      const ok = results.every((result) => result.ok);
      const overallStatus = ok ? 200 : 207;
      const correctAt = results.findIndex((result) => result.plate === plate) + 1;

      auditLog({
        level: "info",
        category: "simulate",
        action: "simulate.webhook_misread_burst_sent",
        message: `Simulated LPR misread burst sent (${results.length} webhooks).`,
        request,
        actor: session.username,
        details: {
          source: "ui-webhook-misread-burst",
          correct_plate: plate,
          correct_plate_position: correctAt,
          results: results.map((result) => ({
            index: result.index,
            plate: result.plate,
            event_id: result.event_id,
            delay_ms: result.delay_ms,
            status: result.status,
            ok: result.ok,
          })),
        },
      });

      return withJsonBody(overallStatus, {
        ok,
        status: overallStatus,
        mode,
        requested_plate: plate,
        correct_plate_position: correctAt,
        sequence: results,
      });
    }

    const samplePayload = buildSimulatedLprWebhookSample(plate);
    const dispatched = await dispatchWebhookSample({
      request,
      webhookSecret,
      payload: samplePayload,
    });
    const eventId = samplePayload.alarm.triggers[0]?.eventId ?? null;

    auditLog({
      level: "info",
      category: "simulate",
      action: "simulate.webhook_sample_sent",
      message: `Simulated LPR webhook sent (upstream ${dispatched.upstream.status}).`,
      request,
      actor: session.username,
      details: {
        upstream_status: dispatched.upstream.status,
        upstream_ok: dispatched.upstream.ok,
        source: "ui-webhook-sample",
        requested_plate: plate,
        simulated_event_id: eventId,
      },
    });

    return withJsonBody(dispatched.upstream.status, {
      ok: dispatched.upstream.ok,
      status: dispatched.upstream.status,
      mode,
      requested_plate: plate,
      sample: samplePayload,
      webhook_response: dispatched.parsed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "simulate webhook failed";
    auditLog({
      level: "error",
      category: "simulate",
      action: "simulate.webhook_sample_failed",
      message: `Webhook sample simulation failed: ${message}`,
      request,
      actor: session.username,
    });
    return withJsonBody(500, { ok: false, error: message });
  }
}
