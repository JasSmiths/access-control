import { getSession } from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { getSettings, updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function redactSettingAuditValue(key: string, value: unknown) {
  if (key === "apprise_url") {
    return value == null || value === "" ? null : "[redacted]";
  }
  return value;
}

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  return Response.json(getSettings());
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

  const b = (body ?? {}) as Record<string, unknown>;
  const previous = getSettings();
  const patch: Parameters<typeof updateSettings>[0] = {};

  if ("site_address" in b) patch.site_address = b.site_address ? String(b.site_address) : null;
  if ("apprise_url" in b) patch.apprise_url = b.apprise_url ? String(b.apprise_url) : null;
  if ("log_level" in b) {
    const raw = String(b.log_level ?? "").trim().toLowerCase();
    if (raw !== "errors" && raw !== "debug") {
      return new Response("Invalid log_level", { status: 400 });
    }
    patch.log_level = raw;
  }
  if ("notif_arrived" in b) patch.notif_arrived = b.notif_arrived ? 1 : 0;
  if ("notif_exited" in b) patch.notif_exited = b.notif_exited ? 1 : 0;
  if ("notif_unauthorized" in b) patch.notif_unauthorized = b.notif_unauthorized ? 1 : 0;
  if ("notif_flagged" in b) patch.notif_flagged = b.notif_flagged ? 1 : 0;
  if ("report_sections" in b) patch.report_sections = b.report_sections ? JSON.stringify(b.report_sections) : null;
  if ("report_theme_color" in b) patch.report_theme_color = b.report_theme_color ? String(b.report_theme_color) : null;
  if ("report_company_name" in b) patch.report_company_name = b.report_company_name ? String(b.report_company_name) : null;

  const updated = updateSettings(patch);
  const changedKeys = Object.keys(patch);
  auditLog({
    level: "info",
    category: "settings",
    action: "settings.updated",
    message: `Settings updated (${changedKeys.length} field${changedKeys.length === 1 ? "" : "s"}).`,
    request,
    actor: session.username,
    details: {
      changed: changedKeys.map((key) => ({
        key,
        before: redactSettingAuditValue(key, (previous as Record<string, unknown>)[key]),
        after: redactSettingAuditValue(key, (updated as Record<string, unknown>)[key]),
      })),
    },
  });
  return Response.json(updated);
}
