import { getDb } from "@/lib/db";
import { SimulatePanel } from "@/components/simulate/SimulatePanel";
import type { ContractorRow } from "@/lib/sessions";

export const dynamic = "force-dynamic";

type WebhookTestRow = {
  id: number;
  device: string;
  source: string;
  occurred_at: string;
  received_at: string;
};

export default function SimulatePage() {
  const contractors = getDb()
    .prepare(
      "SELECT id, name, vehicle_reg, role FROM contractors WHERE active = 1 ORDER BY name ASC"
    )
    .all() as Pick<ContractorRow, "id" | "name" | "vehicle_reg" | "role">[];

  const webhookTests = getDb()
    .prepare(
      `SELECT id, device, source, occurred_at, received_at
       FROM webhook_tests
       ORDER BY received_at DESC
       LIMIT 10`
    )
    .all() as WebhookTestRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulate events</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          Fire fake gate events for testing. Uses active contractors only.
          You can also call{" "}
          <code className="px-1 py-0.5 rounded bg-[var(--bg-elevated)] text-xs">
            GET /api/simulate?plate=REG&amp;event=enter
          </code>{" "}
          directly.
        </p>
      </div>
      <SimulatePanel contractors={contractors} webhookTests={webhookTests} />
    </div>
  );
}
