import { ReportForm } from "@/components/reports/ReportForm";
import { ReportDesigner } from "@/components/reports/ReportDesigner";
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function ReportsPage() {
  const contractors = getDb()
    .prepare("SELECT id, name FROM contractors WHERE active = 1 ORDER BY name ASC")
    .all() as { id: number; name: string }[];

  const settings = getSettings();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Generate and preview PDF reports, or customise the report design.
        </p>
      </div>
      <ReportForm contractors={contractors} />
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-4">Report design</h2>
        <ReportDesigner initial={settings} />
      </div>
    </div>
  );
}
