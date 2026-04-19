import { notFound } from "next/navigation";
import { ContractorForm } from "@/components/contractors/ContractorForm";
import { getDb } from "@/lib/db";
import type { ContractorRow } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function EditContractorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();
  const row = getDb()
    .prepare("SELECT * FROM contractors WHERE id = ?")
    .get(numericId) as ContractorRow | undefined;
  if (!row) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit vehicle</h1>
      <ContractorForm
        contractorId={numericId}
        initial={{
          name: row.name,
          role: row.role,
          vehicle_reg: row.vehicle_reg,
          phone: row.phone,
          email: row.email,
          notes: row.notes,
          active: row.active,
          allowed_hours: row.allowed_hours,
          allowed_days: row.allowed_days,
        }}
      />
    </div>
  );
}
