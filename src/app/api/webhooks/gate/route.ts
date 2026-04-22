import {
  checkWebhookSecret,
  normalisePlate,
  parseWebhookPayload,
} from "@/lib/webhook";
import { findActiveContractorByPlate } from "@/lib/sessions";
import { getDb } from "@/lib/db";
import { auditLog, getConfiguredAuditLogLevel } from "@/lib/audit";
import { resolveWebhookBurst } from "@/lib/webhook-bursts";

export const dynamic = "force-dynamic";

function buildWebhookIngestKey(source: string | undefined, eventId: string | undefined) {
  if (!eventId) return null;
  return `${source ?? "unknown"}:${eventId}`;
}

function withCapturedWebhookDetails(
  details: unknown,
  rawWebhook: unknown,
  captureWebhook: boolean
) {
  if (!captureWebhook) return details;
  const capture = {
    captured_at_log_level: "debug" as const,
    payload: rawWebhook,
  };

  if (details === undefined) {
    return { _webhook_capture: capture };
  }
  if (details && typeof details === "object" && !Array.isArray(details)) {
    return { ...(details as Record<string, unknown>), _webhook_capture: capture };
  }
  return { value: details, _webhook_capture: capture };
}

export async function POST(request: Request) {
  if (!checkWebhookSecret(request.headers.get("x-webhook-secret"))) {
    auditLog({
      level: "debug",
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
      level: "debug",
      category: "webhook",
      action: "webhook.invalid_json",
      message: "Webhook payload was invalid JSON.",
      request,
    });
    return new Response("Invalid JSON", { status: 400 });
  }

  const result = parseWebhookPayload(body);
  const captureWebhook = getConfiguredAuditLogLevel() === "debug";

  if (result.type === "unknown") {
    auditLog({
      level: "debug",
      category: "webhook",
      action: "webhook.bad_payload",
      message: "Webhook payload did not match expected format.",
      request,
      details: withCapturedWebhookDetails(body, body, captureWebhook),
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
        details: withCapturedWebhookDetails(undefined, body, captureWebhook),
      });
      return new Response(msg, { status: 500 });
    }
    auditLog({
      level: "info",
      category: "webhook",
      action: "webhook.test_received",
      message: "Webhook test event recorded.",
      request,
      deviceId: device,
      eventId: "testEventId",
      details: withCapturedWebhookDetails({ source, timestamp }, body, captureWebhook),
    });
    return Response.json(
      { ok: true, type: "test", message: "Test event recorded", device, timestamp },
      { status: 200 }
    );
  }

  // Regular gate event
  const payload = result.payload;
  const plate = normalisePlate(payload.plate);
  const ingestKey = buildWebhookIngestKey(payload.source, payload.event_id);
  const contractor = findActiveContractorByPlate(plate);

  try {
    const resolved = await resolveWebhookBurst({
      payload,
      ingestKey,
      contractor,
    });

    if (resolved.duplicateIngestKey) {
      auditLog({
        level: "debug",
        category: "webhook",
        action: "webhook.duplicate_ignored",
        message: "Duplicate webhook delivery ignored.",
        request,
        contractorId: resolved.finalized.contractorId,
        plate,
        deviceId: payload.device_id ?? null,
        eventId: payload.event_id ?? null,
        details: withCapturedWebhookDetails(
          {
            burstId: resolved.burstId,
            candidateId: resolved.duplicateCandidateId,
            gateEventId: resolved.finalized.gateEventId,
            ingestKey,
          },
          body,
          captureWebhook
        ),
      });
      return Response.json({
        ok: true,
        duplicate: true,
        gate_event_id: resolved.finalized.gateEventId,
      });
    }

    if (resolved.finalized.status === "processed") {
      auditLog({
        level: "info",
        category: "webhook",
        action: "webhook.event_ingested",
        message: contractor
          ? `Webhook burst resolved for ${contractor.name}.`
          : `Webhook burst resolved using known plate ${resolved.finalized.chosenPlate}.`,
        request,
        contractorId: resolved.finalized.contractorId,
        plate,
        deviceId: payload.device_id ?? null,
        eventId: payload.event_id ?? null,
        details: withCapturedWebhookDetails(
          {
            source: payload.source,
            burstId: resolved.burstId,
            gateEventId: resolved.finalized.gateEventId,
            chosenPlate: resolved.finalized.chosenPlate,
            eventType: resolved.finalized.eventType,
          },
          body,
          captureWebhook
        ),
      });
      return Response.json(
        {
          ok: true,
          burst_id: resolved.burstId,
          gate_event_id: resolved.finalized.gateEventId,
          event_type: resolved.finalized.eventType,
          chosen_plate: resolved.finalized.chosenPlate,
        },
        { status: 200 }
      );
    }

    if (!contractor) {
      auditLog({
        level: "debug",
        category: "webhook",
        action: "webhook.plate_pending",
        message: `Unknown plate ${plate} parked pending burst resolution.`,
        request,
        plate,
        deviceId: payload.device_id ?? null,
        eventId: payload.event_id ?? null,
        details: withCapturedWebhookDetails(
          {
            source: payload.source,
            burstId: resolved.burstId,
          },
          body,
          captureWebhook
        ),
      });
      return Response.json(
        {
          ok: true,
          pending: true,
          burst_id: resolved.burstId,
        },
        { status: 202 }
      );
    }

    auditLog({
      level: "debug",
      category: "webhook",
      action: "webhook.burst_ignored",
      message: "Webhook burst ignored because no known plate was found in time.",
      request,
      plate,
      deviceId: payload.device_id ?? null,
      eventId: payload.event_id ?? null,
      details: withCapturedWebhookDetails(
        {
          source: payload.source,
          burstId: resolved.burstId,
        },
        body,
        captureWebhook
      ),
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "ingest failed";
    auditLog({
      level: "error",
      category: "webhook",
      action: "webhook.ingest_failed",
      message: `Webhook ingest failed: ${msg}`,
      request,
      contractorId: contractor?.id,
      plate,
      deviceId: payload.device_id ?? null,
      eventId: payload.event_id ?? null,
      details: withCapturedWebhookDetails(undefined, body, captureWebhook),
    });
    return new Response(msg, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
