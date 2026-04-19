import "server-only";
import { getDb } from "./db";
import type { SettingsRow } from "./settings-shared";

export type { SettingsRow, ReportSection } from "./settings-shared";
export { DEFAULT_REPORT_SECTIONS, parseReportSections } from "./settings-shared";

export function getSettings(): SettingsRow {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO settings (id) VALUES (1)").run();
  return db.prepare("SELECT * FROM settings WHERE id = 1").get() as SettingsRow;
}

export function updateSettings(patch: Partial<Omit<SettingsRow, "id" | "updated_at">>) {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO settings (id) VALUES (1)").run();

  const fields = Object.keys(patch) as Array<keyof typeof patch>;
  if (fields.length === 0) return getSettings();

  const sql = `UPDATE settings SET ${fields.map((k) => `${k} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = 1`;
  db.prepare(sql).run(...fields.map((k) => patch[k] as string | number | null));
  return getSettings();
}
