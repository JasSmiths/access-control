/**
 * Notification dispatch.
 *
 * Supports two URL flavours stored in settings.apprise_url:
 *   1. Apprise URL schemes  – pushover://, tgram://, json://, jsons://, ...
 *   2. Plain HTTP(S) URLs   – treated as an Apprise-API stateless REST endpoint
 *                             (POST /notify/ with { title, body, type })
 *
 * All functions are best-effort: they never throw.
 */

export interface NotifPayload {
  title: string;
  body: string;
  type?: "info" | "warning" | "failure" | "success";
}

// ─── Public entry point ──────────────────────────────────────────────────────

export async function sendNotification(opts: {
  appriseUrl: string;
  title: string;
  body: string;
  type?: "info" | "warning" | "failure" | "success";
}): Promise<{ ok: boolean; error?: string }> {
  const payload: NotifPayload = {
    title: opts.title,
    body: opts.body,
    type: opts.type ?? "info",
  };
  try {
    return await dispatchByScheme(opts.appriseUrl, payload);
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ─── Scheme dispatcher ───────────────────────────────────────────────────────

async function dispatchByScheme(
  rawUrl: string,
  payload: NotifPayload
): Promise<{ ok: boolean; error?: string }> {
  const url = rawUrl.trim();

  if (url.startsWith("pushover://")) return pushover(url, payload);
  if (url.startsWith("tgram://"))    return telegram(url, payload);
  if (url.startsWith("json://"))     return jsonHttp("http", url, payload);
  if (url.startsWith("jsons://"))    return jsonHttp("https", url, payload);
  if (url.startsWith("http://") || url.startsWith("https://"))
    return appriseRestApi(url, payload);

  return { ok: false, error: `Unsupported URL scheme: ${url.split("://")[0]}` };
}

// ─── Pushover ────────────────────────────────────────────────────────────────
// Scheme: pushover://USER_KEY/TOKEN_ID

function parsePushover(raw: string): { userKey: string; token: string } | null {
  // Strip scheme
  const rest = raw.replace(/^pushover:\/\//, "");
  const parts = rest.replace(/\/$/, "").split("/");
  if (parts.length < 2) return null;
  return { userKey: parts[0], token: parts[1] };
}

async function pushover(
  raw: string,
  payload: NotifPayload
): Promise<{ ok: boolean; error?: string }> {
  const creds = parsePushover(raw);
  if (!creds) return { ok: false, error: "Invalid pushover:// URL (expected pushover://USER_KEY/TOKEN)" };

  const priority = payload.type === "failure" || payload.type === "warning" ? 1 : 0;

  const body = new URLSearchParams({
    token:   creds.token,
    user:    creds.userKey,
    title:   payload.title,
    message: payload.body,
    priority: String(priority),
  });

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return { ok: false, error: `Pushover API ${res.status}: ${text}` };
  }
  return { ok: true };
}

// ─── Telegram ────────────────────────────────────────────────────────────────
// Scheme: tgram://BOT_TOKEN/CHAT_ID

function parseTelegram(raw: string): { botToken: string; chatId: string } | null {
  const rest = raw.replace(/^tgram:\/\//, "");
  const parts = rest.replace(/\/$/, "").split("/");
  if (parts.length < 2) return null;
  return { botToken: parts[0], chatId: parts[1] };
}

async function telegram(
  raw: string,
  payload: NotifPayload
): Promise<{ ok: boolean; error?: string }> {
  const creds = parseTelegram(raw);
  if (!creds) return { ok: false, error: "Invalid tgram:// URL (expected tgram://BOT_TOKEN/CHAT_ID)" };

  const text = `*${payload.title}*\n${payload.body}`;
  const res = await fetch(
    `https://api.telegram.org/bot${creds.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: creds.chatId, text, parse_mode: "Markdown" }),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) {
    const text2 = await res.text().catch(() => res.statusText);
    return { ok: false, error: `Telegram API ${res.status}: ${text2}` };
  }
  return { ok: true };
}

// ─── Generic JSON endpoint (json:// / jsons://) ───────────────────────────────
// Used for self-hosted Apprise API or any JSON webhook

async function jsonHttp(
  proto: "http" | "https",
  raw: string,
  payload: NotifPayload
): Promise<{ ok: boolean; error?: string }> {
  const httpUrl = raw.replace(/^jsons?:\/\//, `${proto}://`);
  return appriseRestApi(httpUrl, payload);
}

// ─── Apprise REST API (plain http/https URL) ─────────────────────────────────
// Expects a stateless Apprise-API endpoint: POST /notify/ { title, body, type }

async function appriseRestApi(
  url: string,
  payload: NotifPayload
): Promise<{ ok: boolean; error?: string }> {
  const endpoint = url.replace(/\/$/, "");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: payload.title, body: payload.body, type: payload.type }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return { ok: false, error: `HTTP ${res.status}: ${text}` };
  }
  return { ok: true };
}

// ─── Access control helper (unchanged) ───────────────────────────────────────

/**
 * Check if an event timestamp is within allowed hours and days.
 * Returns null if allowed, or a reason string if unauthorized.
 */
export function checkAccessControl(
  occurredAt: string,
  allowedHours: string | null,
  allowedDays: string
): string | null {
  const date = new Date(occurredAt);
  const dayIndex = date.getDay();
  const hour = date.getHours();
  const minute = date.getMinutes();

  if (allowedDays !== "all") {
    if (allowedDays === "weekdays" && (dayIndex === 0 || dayIndex === 6)) {
      return "entry outside allowed days (weekdays only)";
    }
    if (allowedDays === "weekends" && dayIndex !== 0 && dayIndex !== 6) {
      return "entry outside allowed days (weekends only)";
    }
    if (allowedDays.startsWith("custom:")) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const allowed = allowedDays.slice(7).split(",").map((d) => d.trim());
      if (!allowed.includes(dayNames[dayIndex])) {
        return `entry outside allowed days (${allowed.join(", ")} only)`;
      }
    }
  }

  if (allowedHours) {
    const match = allowedHours.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (match) {
      const startMins = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      const endMins   = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
      const nowMins   = hour * 60 + minute;
      if (nowMins < startMins || nowMins > endMins) {
        return `entry outside allowed hours (${allowedHours})`;
      }
    }
  }

  return null;
}
