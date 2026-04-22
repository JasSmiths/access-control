/**
 * Types and constants shared between server and client code.
 * No server-only imports here.
 */

export type SettingsRow = {
  id: number;
  site_address: string | null;
  apprise_url: string | null;
  log_level: "errors" | "debug";
  notif_arrived: number;
  notif_exited: number;
  notif_unauthorized: number;
  notif_flagged: number;
  report_sections: string | null;
  report_theme_color: string | null;
  report_company_name: string | null;
  updated_at: string;
};

export type ReportSection = {
  key: string;
  label: string;
  enabled: boolean;
};

export const DEFAULT_REPORT_SECTIONS: ReportSection[] = [
  { key: "header", label: "Header / Branding", enabled: true },
  { key: "summary", label: "Summary Table", enabled: true },
  { key: "sessions", label: "Detailed Sessions", enabled: true },
  { key: "flagged", label: "Flagged Items", enabled: true },
];

export function parseReportSections(json: string | null): ReportSection[] {
  if (!json) return DEFAULT_REPORT_SECTIONS;
  try {
    return JSON.parse(json) as ReportSection[];
  } catch {
    return DEFAULT_REPORT_SECTIONS;
  }
}
