import "server-only";
import { emit } from "./events-bus";
import { getDb } from "./db";
import { getClientIp, getPathname } from "./request";

type AuditLevel = "info" | "warn" | "error";

type AuditInput = {
  level?: AuditLevel;
  category: string;
  action: string;
  message: string;
  request?: Request;
  ip?: string | null;
  method?: string | null;
  path?: string | null;
  actor?: string | null;
  contractorId?: number | null;
  plate?: string | null;
  deviceId?: string | null;
  eventId?: string | null;
  details?: unknown;
};

export function auditLog(input: AuditInput): number | null {
  try {
    const request = input.request;
    const ip = input.ip ?? (request ? getClientIp(request) : null);
    const method = input.method ?? (request ? request.method : null);
    const path = input.path ?? (request ? getPathname(request) : null);
    const detailsJson =
      input.details === undefined ? null : JSON.stringify(input.details);

    const result = getDb()
      .prepare(
        `INSERT INTO audit_logs
          (level, category, action, message, ip, method, path, actor, contractor_id, plate, device_id, event_id, details_json)
         VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.level ?? "info",
        input.category,
        input.action,
        input.message,
        ip ?? null,
        method ?? null,
        path ?? null,
        input.actor ?? null,
        input.contractorId ?? null,
        input.plate ?? null,
        input.deviceId ?? null,
        input.eventId ?? null,
        detailsJson
      );

    const id = Number(result.lastInsertRowid);
    emit("log.created", { id });
    return id;
  } catch {
    return null;
  }
}
