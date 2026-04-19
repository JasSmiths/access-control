import { getDb } from "@/lib/db";
import { ReviewTable } from "@/components/review/ReviewTable";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { AlertTriangle } from "lucide-react";
import { type FlaggedSessionRow } from "@/lib/review";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const rows = getDb()
    .prepare(
      `SELECT s.id, s.contractor_id, c.name AS contractor_name,
              s.started_at, s.ended_at, s.duration_seconds, s.notes,
              s.review_reason, s.review_note, s.reviewed_at
         FROM sessions s
         JOIN contractors c ON c.id = s.contractor_id
        WHERE s.status = 'flagged'
        ORDER BY s.started_at DESC
        LIMIT 200`
    )
    .all() as FlaggedSessionRow[];

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[var(--warning)]/10 p-2.5 text-[var(--warning)] mt-0.5">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flagged Items</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            Sessions that require review — unauthorized entries, anomalies, and timing issues.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.length} flagged session{rows.length !== 1 ? "s" : ""}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <ReviewTable initialRows={rows} todayISO={todayISO} />
        </CardBody>
      </Card>
    </div>
  );
}
