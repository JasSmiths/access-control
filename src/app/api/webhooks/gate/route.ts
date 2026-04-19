import {
  checkWebhookSecret,
  isAutoEvent,
  normalisePlate,
  parseWebhookPayload,
} from "@/lib/webhook";
import { findActiveContractorByPlate, ingestEvent } from "@/lib/sessions";
import { getDb } from "@/lib/db";
import { auditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!checkWebhookSecret(request.headers.get("x-webhook-secret"))) {
    auditLog({
      level: "warn",
      category: "webhook",
      action: "webhook.auth_failed",
      message: "Webhook rejected due to invalid secret.",
      request,
    });
    return new Response("Unauthorized", { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    auditLog({
      level: "warn",
      category: "webhook",
      action: "webhook.invalid_json",
      message: "Webhook payload was invalid JSON.",
      request,
    });
    return new Response("Invalid JSON", { status: 400 });
  }

  const result = parseWebhookPayload(body);

  if (result.type === "unknown") {
    auditLog({
      level: "warn",
      category: "webhook",
      action: "webhook.bad_payload",
      message: "Webhook payload did not match expected format.",
      request,
      details: body,
    });
    return new Response("Bad payload", { status: 400 });
  }

  // UniFi test ping — record it and confirm receipt.
  if (result.type === "test") {
    const { device, source, timestamp } = result.test;
    try {
      getDb()
        .prepare(
          "INSERT INTO webhook_tests (device, source, occurred_at) VALUES (?, ?, ?)"
        )
        .run(device, source, timestamp);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "db error";
      auditLog({
        level: "error",
        category: "webhook",
        action: "webhook.test_store_failed",
        message: `Failed to store webhook test event: ${msg}`,
        request,
        deviceId: device,
      });
      return new Response(msg, { status: 500 });
    }
    auditLog({
      category: "webhook",
      action: "webhook.test_received",
      message: "Webhook test event recorded.",
      request,
      deviceId: device,
      eventId: "testEventId",
      details: { source, timestamp },
    });
    return Response.json(
      { ok: true, type: "test", message: "Test event recorded", device, timestamp },
      { status: 200 }
    );
  }

  // Regular gate event
  const payload = result.payload;
  const plate = normalisePlate(payload.plate);
  const contractor = findActiveContractorByPlate(plate);
  if (!contractor) {
    // Silently ignore unknown/inactive plate per product decision.
    auditLog({
      category: "webhook",
      action: "webhook.plate_ignored",
      message: `Webhook event ignored: no active contractor for plate ${plate}.`,
      request,
      plate,
      deviceId: payload.device_id ?? null,
      eventId: payload.event_id ?? null,
      details: { source: payload.source },
    });
    return new Response(null, { status: 204 });
  }

  // For UniFi-style payloads there is no explicit enter/exit.
  // Resolve direction by checking whether this contractor has an open session:
  //   open session exists → this is an exit
  //   no open session     → this is an enter
  let eventType = payload.event;
  if (isAutoEvent(payload)) {
    const openSession = getDb()
      .prepare(
        "SELECT id FROM sessions WHERE contractor_id = ? AND status = 'open' LIMIT 1"
      )
      .get(contractor.id);
    eventType = openSession ? "exit" : "enter";
  }

  try {
    const ingested = ingestEvent({
      contractorId: contractor.id,
      plateRaw: payload.plate,
      eventType,
      occurredAt: new Date(payload.timestamp).toISOString(),
      source: payload.source,
      contractor,
    });
    auditLog({
      category: "webhook",
      action: "webhook.event_ingested",
      message: `Webhook event ingested as ${eventType} for ${contractor.name}.`,
      request,
      contractorId: contractor.id,
      plate,
      deviceId: payload.device_id ?? null,
      eventId: payload.event_id ?? null,
      details: {
        source: payload.source,
        emitted: ingested.emits.map((e) => e.name),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ingest failed";
    auditLog({
      level: "error",
      category: "webhook",
      action: "webhook.ingest_failed",
      message: `Webhook ingest failed: ${msg}`,
      request,
      contractorId: contractor.id,
      plate,
      deviceId: payload.device_id ?? null,
      eventId: payload.event_id ?? null,
    });
    return new Response(msg, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
