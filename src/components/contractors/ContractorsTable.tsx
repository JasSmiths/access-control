"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TR, TH, TD } from "@/components/ui/Table";
import type { ContractorRow } from "@/lib/sessions";

export function ContractorsTable({ rows }: { rows: ContractorRow[] }) {
  const router = useRouter();

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Type</TH>
          <TH>Vehicle reg</TH>
          <TH>Access</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <tbody>
        {rows.map((c) => (
          <TR
            key={c.id}
            onClick={() => router.push(`/vehicles/${c.id}`)}
            className="cursor-pointer hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <TD className="font-medium">{c.name}</TD>
            <TD className="text-[var(--fg-muted)]">{formatTypeLabel(c.role)}</TD>
            <TD className="font-mono text-xs">{c.vehicle_reg}</TD>
            <TD className="text-sm text-[var(--fg-muted)]">
              <div className="leading-tight">
                <div>{c.allowed_hours ?? "All day"}</div>
                <div className="text-xs">{formatDaysLabel(c.allowed_days)}</div>
              </div>
            </TD>
            <TD>
              <Badge tone={c.active ? "success" : "neutral"}>
                {c.active ? "Active" : "Inactive"}
              </Badge>
            </TD>
          </TR>
        ))}
      </tbody>
    </Table>
  );
}

function formatDaysLabel(allowed_days: string): string {
  if (allowed_days === "all") return "Everyday";
  if (allowed_days === "weekdays") return "Weekdays";
  if (allowed_days === "weekends") return "Weekends";
  if (allowed_days.startsWith("custom:")) return allowed_days.slice(7).replace(/,/g, ", ");
  return allowed_days;
}

function formatTypeLabel(role: string | null | undefined): string {
  const value = (role ?? "").trim().toLowerCase();
  if (value === "family") return "Family";
  if (value === "friend" || value === "friends") return "Friends";
  if (value === "visitor" || value === "visitors") return "Visitors";
  return "Contractors";
}
