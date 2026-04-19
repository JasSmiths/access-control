import "server-only";

export function normalisePlate(input: string): string {
  return String(input).toUpperCase().replace(/\s+/g, "");
}

export function checkWebhookSecret(headerValue: string | null): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected) return false;
  if (!headerValue) return false;
  if (headerValue.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ headerValue.charCodeAt(i);
  }
  return diff === 0;
}

export type WebhookPayload = {
  plate: string;
  event: "enter" | "exit";
  timestamp: string;
  source?: string;
  device_id?: string;
  event_id?: string;
};

/**
 * Parses the simple legacy format:
 *   { plate, event, timestamp, source? }
 */
function parseLegacyPayload(o: Record<string, unknown>): WebhookPayload | null {
  const plate = typeof o.plate === "string" ? o.plate : null;
  const event = o.event === "enter" || o.event === "exit" ? o.event : null;
  const timestamp = typeof o.timestamp === "string" ? o.timestamp : null;
  const source = typeof o.source === "string" ? o.source : undefined;
  if (!plate || !event || !timestamp) return null;
  if (Number.isNaN(Date.parse(timestamp))) return null;
  return { plate, event, timestamp, source };
}

/**
 * Parses the UniFi Protect / Home Assistant LPR alarm format:
 * {
 *   alarm: {
 *     name: string,
 *     sources: [{ device, type }],
 *     triggers: [{ device, value, key, timestamp, eventId, ... }],
 *     ...
 *   },
 *   timestamp: number   // epoch ms
 * }
 *
 * The plate is in alarm.triggers[0].value.
 * There is no built-in enter/exit concept — the caller resolves direction
 * by checking whether the contractor already has an open session.
 */
function parseUnifiPayload(
  o: Record<string, unknown>
): Omit<WebhookPayload, "event"> | null {
  const alarm = o.alarm as Record<string, unknown> | undefined;
  if (!alarm || typeof alarm !== "object") return null;

  const triggers = alarm.triggers as unknown[] | undefined;
  if (!Array.isArray(triggers) || triggers.length === 0) return null;

  const trigger = triggers[0] as Record<string, unknown>;
  const plate = typeof trigger.value === "string" ? trigger.value.trim() : null;
  if (!plate) return null;

  // Prefer trigger-level timestamp (ms epoch), fall back to root timestamp
  const rawTs =
    typeof trigger.timestamp === "number"
      ? trigger.timestamp
      : typeof o.timestamp === "number"
        ? o.timestamp
        : null;

  const timestamp = rawTs
    ? new Date(rawTs).toISOString()
    : new Date().toISOString();

  const device =
    typeof trigger.device === "string"
      ? trigger.device
      : typeof alarm.name === "string"
        ? alarm.name
        : "unifi-protect";

  const eventId = typeof trigger.eventId === "string" ? trigger.eventId : undefined;
  const source = device;

  return { plate, timestamp, source, device_id: device, event_id: eventId };
}

export type WebhookTestEvent = {
  device: string;
  source: string;
  timestamp: string;
};

export type WebhookParseResult =
  | { type: "event"; payload: WebhookPayload }
  | { type: "test"; test: WebhookTestEvent }
  | { type: "unknown" };

/**
 * Detects the UniFi test event format:
 * trigger.eventId === "testEventId" and trigger.value is absent.
 */
function parseUnifiTestEvent(
  o: Record<string, unknown>
): WebhookTestEvent | null {
  const alarm = o.alarm as Record<string, unknown> | undefined;
  if (!alarm || typeof alarm !== "object") return null;

  const triggers = alarm.triggers as unknown[] | undefined;
  if (!Array.isArray(triggers) || triggers.length === 0) return null;

  const trigger = triggers[0] as Record<string, unknown>;
  if (trigger.eventId !== "testEventId") return null;

  const rawTs =
    typeof trigger.timestamp === "number"
      ? trigger.timestamp
      : typeof o.timestamp === "number"
        ? o.timestamp
        : null;
  const timestamp = rawTs
    ? new Date(rawTs).toISOString()
    : new Date().toISOString();

  const device =
    typeof trigger.device === "string"
      ? trigger.device
      : typeof alarm.name === "string"
        ? alarm.name
        : "unifi-protect";

  const source =
    typeof alarm.name === "string" ? alarm.name : "UniFi Test Event";

  return { device, source, timestamp };
}

/**
 * Try all payload formats. Returns a discriminated union so the route
 * can handle regular events and test pings differently.
 */
export function parseWebhookPayload(raw: unknown): WebhookParseResult {
  if (!raw || typeof raw !== "object") return { type: "unknown" };
  const o = raw as Record<string, unknown>;

  // Test event must be checked before the general UniFi parser
  // because the test payload is missing trigger.value.
  const testEvent = parseUnifiTestEvent(o);
  if (testEvent) return { type: "test", test: testEvent };

  // Legacy simple format: { plate, event, timestamp }
  const legacy = parseLegacyPayload(o);
  if (legacy) return { type: "event", payload: legacy };

  // UniFi LPR format — direction resolved by the route from session state.
  const unifi = parseUnifiPayload(o);
  if (unifi) {
    return {
      type: "event",
      payload: { ...unifi, event: "__auto__" as "enter" | "exit" },
    };
  }

  return { type: "unknown" };
}

/** True when the payload came from the UniFi format and direction must be resolved. */
export function isAutoEvent(payload: WebhookPayload): boolean {
  return (payload.event as string) === "__auto__";
}
